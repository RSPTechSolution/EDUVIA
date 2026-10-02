import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/models.dart';
import '../../core/config/app_config.dart';
import '../../shared/widgets/brand.dart';

String greeting(DateTime now) => now.hour < 12 ? 'Good morning' : (now.hour < 17 ? 'Good afternoon' : 'Good evening');

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider).value;
    if (auth is! SignedIn) return const SizedBox.shrink();
    final me = auth.me;
    final flavor = ref.watch(appConfigProvider).flavor;
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(children: [const BrandMark(size: 32), const SizedBox(width: 10), Wordmark(fontSize: 20, suffix: flavor.suffix)]),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(authControllerProvider.notifier).refreshProfile(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Text('${greeting(DateTime.now())}, ${me.firstName}', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text(DateFormat('EEEE, d MMMM').format(DateTime.now()), style: TextStyle(color: muted)),
            const SizedBox(height: 20),
            if (me.school != null) _SchoolCard(school: me.school!, role: me.role),
            const SizedBox(height: 16),
            _ComingUp(flavor: flavor, modules: me.modules),
          ],
        ),
      ),
    );
  }
}

class _SchoolCard extends StatelessWidget {
  const _SchoolCard({required this.school, required this.role});
  final SchoolBrief school;
  final String role;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(Icons.school_outlined, color: scheme.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(school.name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('${roleLabel(role)} · School ID ${school.slug}', style: TextStyle(color: scheme.onSurfaceVariant)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// What this app will show once the school's modules are live. Only features
/// the school has enabled are listed, so families aren't promised anything
/// their school doesn't use.
class _ComingUp extends StatelessWidget {
  const _ComingUp({required this.flavor, required this.modules});
  final AppFlavor flavor;
  final List<String> modules;

  static const _features = {
    AppFlavor.parent: [
      ('attendance', Icons.event_available_outlined, 'Attendance', 'Daily attendance and leave'),
      ('academics', Icons.menu_book_outlined, 'Homework & timetable', 'Assignments and class schedule'),
      ('fees', Icons.account_balance_wallet_outlined, 'Fees', 'Dues, online payment and receipts'),
      ('exams', Icons.assignment_outlined, 'Results', 'Marks and report cards'),
      ('transport', Icons.directions_bus_outlined, 'Bus tracking', 'Live location of the school bus'),
      ('communication', Icons.chat_bubble_outline, 'Messages', 'Notices and chat with teachers'),
    ],
    AppFlavor.staff: [
      ('attendance', Icons.fact_check_outlined, 'Take attendance', 'Mark classes or scan QR codes'),
      ('academics', Icons.menu_book_outlined, 'Homework', 'Assign and review work'),
      ('exams', Icons.edit_note_outlined, 'Marks entry', 'Enter and publish results'),
      ('hr', Icons.beach_access_outlined, 'Leave', 'Apply and track approvals'),
      ('communication', Icons.chat_bubble_outline, 'Messages', 'Talk to parents and colleagues'),
    ],
    AppFlavor.driver: [
      ('transport', Icons.route_outlined, 'Trips', 'Start trips and share live location'),
      ('transport', Icons.how_to_reg_outlined, 'Boarding', 'Mark students on and off the bus'),
    ],
  };

  @override
  Widget build(BuildContext context) {
    final items = _features[flavor]!.where((f) => modules.contains(f.$1)).toList();
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Coming to this app', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
            items.isEmpty
                ? "Your school hasn't turned on any features for this app yet."
                : 'Your school uses these features. They will appear here as each one is set up.',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          for (final (_, icon, title, subtitle) in items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(icon, color: scheme.primary),
              title: Text(title),
              subtitle: Text(subtitle),
            ),
        ]),
      ),
    );
  }
}
