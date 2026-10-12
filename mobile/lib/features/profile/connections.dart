import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/common.dart';

/// Your own profile's "connected to you" list, from GET /users/me/overview: your classes or children, books on loan,
/// bus duty, leave and pay this month, requests and meetings. Only what applies to you is shown.
final myOverviewProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final res = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/users/me/overview', parse: (d) => (d as Map).cast<String, dynamic>());
  return res.data;
});

class ConnectedToYou extends ConsumerWidget {
  const ConnectedToYou({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myOverviewProvider);
    return async.when(
      skipLoadingOnRefresh: true,
      loading: () => const SkeletonList(count: 3, padding: EdgeInsets.zero),
      error: (_, _) => const SizedBox.shrink(),
      data: (o) {
        final rows = _rows(o);
        if (rows.isEmpty) return const SizedBox.shrink();
        return Card(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Text('Connected to you', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
            for (final (icon, title, subtitle) in rows) ListTile(leading: Icon(icon), title: Text(title), subtitle: subtitle == null ? null : Text(subtitle)),
          ]),
        );
      },
    );
  }

  static List<(IconData, String, String?)> _rows(Map<String, dynamic> o) {
    List<Map<String, dynamic>> list(String k) => ((o[k] as List?) ?? const []).cast<Map>().map((m) => m.cast<String, dynamic>()).toList();
    final out = <(IconData, String, String?)>[];
    for (final s in list('class_teacher_of')) {
      out.add((Icons.groups_outlined, 'Class teacher of ${s['label']}', '${s['students']} students'));
    }
    final teaching = ((o['teaching'] as List?) ?? const []).cast<String>();
    if (teaching.isNotEmpty) out.add((Icons.menu_book_outlined, 'Teaches', teaching.join('\n')));
    for (final c in list('children')) {
      final due = (c['fee_due'] as num?)?.toDouble();
      final pct = (c['attendance_percent'] as num?)?.toDouble();
      out.add((Icons.child_care_outlined, '${c['name']} · ${c['class_section']}',
          [if (pct != null) 'Attendance ${pct.toStringAsFixed(0)}% this month', if (due != null) due > 0 ? '${inr(due)} ${c['fee_overdue'] == true ? 'overdue' : 'due'}' : 'Fees paid'].join(' · ')));
    }
    final student = o['student_overview'] as Map?;
    final lib = (o['library'] as Map?) ?? (student?['library'] as Map?);
    final loans = ((lib?['current'] as List?) ?? const []).cast<Map>();
    if (loans.isNotEmpty) {
      out.add((Icons.local_library_outlined, '${loans.length} library ${loans.length == 1 ? 'book' : 'books'} on loan',
          loans.map((b) => '${b['title']}${b['overdue'] == true ? ' (overdue)' : ' · due ${b['due_on']}'}').join('\n')));
    }
    final bus = student?['bus'] as Map?;
    if (bus != null) out.add((Icons.directions_bus_outlined, bus['route'] as String, [if (bus['stop'] != null) 'Stop: ${bus['stop']}', if (bus['pickup_time'] != null) 'pick-up ${bus['pickup_time']}'].join(' · ')));
    final hostel = student?['hostel'] as Map?;
    if (hostel != null) out.add((Icons.hotel_outlined, '${hostel['hostel']}, room ${hostel['room']}', null));
    for (final b in list('buses')) {
      out.add((Icons.directions_bus_outlined, 'Bus ${b['vehicle_number']}', ((b['routes'] as List).cast<String>()).join(', ')));
    }
    final hr = o['hr'] as Map?;
    if (hr != null) {
      out.add((Icons.badge_outlined, 'This month: ${hr['present_days']} days present', 'Absent ${hr['absent_days']} · on leave ${hr['leave_days']}'));
    }
    for (final r in [...list('requests'), ...?((student?['requests'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()))].take(3)) {
      out.add((Icons.event_busy_outlined, '${r['title']}${r['student_name'] != null ? ' · ${r['student_name']}' : ''}', '${r['status']} · ${r['detail'] ?? ''}'));
    }
    for (final m in list('ptm').take(2)) {
      out.add((Icons.handshake_outlined, m['title'] as String, '${m['on']} at ${m['slot']}${m['teacher_name'] != null ? ' with ${m['teacher_name']}' : ''}'));
    }
    return out;
  }
}
