import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/common.dart';
import '../../shared/widgets/open_file.dart';

List<Map<String, dynamic>> _list(Object? d) => [for (final x in (d as List).cast<Map>()) x.cast<String, dynamic>()];
final _d = DateFormat('d MMM');
final _iso = DateFormat('yyyy-MM-dd');
final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

final _balanceProvider = FutureProvider.autoDispose((ref) async =>
    (await ref.watch(apiClientProvider).get<List<Map<String, dynamic>>>('/hr/my/leave-balance', parse: _list)).data);
final _leaveProvider = FutureProvider.autoDispose((ref) async =>
    (await ref.watch(apiClientProvider).get<List<Map<String, dynamic>>>('/hr/leave', query: {'mine': true}, parse: _list)).data);
final _slipsProvider = FutureProvider.autoDispose((ref) async =>
    (await ref.watch(apiClientProvider).get<List<Map<String, dynamic>>>('/hr/my/payslips', parse: _list)).data);

/// Staff: leave balance, leave requests and payslips.
class MyHrScreen extends ConsumerWidget {
  const MyHrScreen({super.key});

  Future<void> _apply(BuildContext context, WidgetRef ref) async {
    final types = (await ref.read(apiClientProvider).get<List<Map<String, dynamic>>>('/hr/leave-types', parse: _list)).data
        .where((t) => t['is_active'] == true).toList();
    if (!context.mounted || types.isEmpty) return;
    var typeId = types.first['id'] as String;
    var from = DateTime.now().add(const Duration(days: 1));
    var to = from;
    var half = false;
    final reason = TextEditingController();
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Apply for leave', style: Theme.of(c).textTheme.titleLarge),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: typeId,
                items: [for (final t in types) DropdownMenuItem(value: t['id'] as String, child: Text(t['name'] as String))],
                onChanged: (v) => set(() => typeId = v ?? typeId),
              ),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Half day'), value: half, onChanged: (v) => set(() => half = v)),
              Row(children: [
                Expanded(child: OutlinedButton(
                  onPressed: () async {
                    final d = await showDatePicker(context: c, initialDate: from, firstDate: DateTime.now().subtract(const Duration(days: 30)),
                        lastDate: DateTime.now().add(const Duration(days: 365)));
                    if (d != null) set(() { from = d; if (to.isBefore(d)) to = d; });
                  },
                  child: Text('From ${_d.format(from)}'))),
                if (!half) ...[
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(
                    onPressed: () async {
                      final d = await showDatePicker(context: c, initialDate: to, firstDate: from, lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (d != null) set(() => to = d);
                    },
                    child: Text('To ${_d.format(to)}'))),
                ],
              ]),
              const SizedBox(height: 8),
              TextField(controller: reason, maxLines: 3, decoration: const InputDecoration(hintText: 'Reason')),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Apply')),
            ]),
          )),
    );
    if (sent != true || !context.mounted) return;
    try {
      await ref.read(apiClientProvider).post<Object?>('/hr/leave', body: {
        'leave_type_id': typeId, 'from_date': _iso.format(from), 'to_date': _iso.format(half ? from : to), 'half_day': half, 'reason': reason.text.trim(),
      });
      ref.invalidate(_leaveProvider);
      ref.invalidate(_balanceProvider);
      if (context.mounted) showSnack(context, 'Leave applied. HR has been told.');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.fieldErrors.values.firstOrNull ?? e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(_balanceProvider);
    final leave = ref.watch(_leaveProvider);
    final slips = ref.watch(_slipsProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('My leave and pay')),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _apply(context, ref), icon: const Icon(Icons.add), label: const Text('Apply for leave')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_balanceProvider);
          ref.invalidate(_leaveProvider);
          ref.invalidate(_slipsProvider);
        },
        child: ListView(padding: const EdgeInsets.fromLTRB(12, 12, 12, 96), children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final b in balance.value ?? const <Map<String, dynamic>>[])
              Chip(label: Text('${b['code']}: ${b['left'] ?? b['used']}${b['paid'] == true ? ' of ${b['allowed']} left' : ' taken'}')),
          ]),
          const SizedBox(height: 12),
          Text('Leave requests', style: Theme.of(context).textTheme.titleMedium),
          for (final l in leave.value ?? const <Map<String, dynamic>>[])
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${l['code']} · ${_d.format(DateTime.parse(l['from_date'] as String))}'
                  '${l['to_date'] != l['from_date'] ? ' – ${_d.format(DateTime.parse(l['to_date'] as String))}' : ''}'),
              subtitle: Text(l['reason'] as String, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: Text((l['status'] as String).toUpperCase(), style: TextStyle(fontSize: 12, color: scheme.primary, fontWeight: FontWeight.w700)),
            ),
          if ((leave.value ?? const []).isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('No leave requests yet.')),
          const Divider(height: 32),
          Text('Payslips', style: Theme.of(context).textTheme.titleMedium),
          for (final s in slips.value ?? const <Map<String, dynamic>>[])
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.receipt_long_outlined),
              title: Text(DateFormat('MMMM yyyy').format(DateTime.parse('${s['month']}-01'))),
              subtitle: Text('Net ${_inr.format(s['net'])}'),
              trailing: IconButton(tooltip: 'Open payslip', icon: const Icon(Icons.picture_as_pdf_outlined), onPressed: () => openApiFile(context, ref, '/hr/payslips/${s['id']}/pdf')),
            ),
          if ((slips.value ?? const []).isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('No payslips yet.')),
        ]),
      ),
    );
  }
}
