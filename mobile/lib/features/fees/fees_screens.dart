import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/auth/session.dart';
import '../../shared/widgets/common.dart';
import '../../shared/widgets/open_file.dart';
import 'fees_data.dart';

final _date = DateFormat('d MMM yyyy');
final _dateTime = DateFormat('d MMM yyyy, h:mm a');

/// The Fees tab: dues and online payment for families, collection for office staff.
class FeesScreen extends ConsumerWidget {
  const FeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    if (me == null) return const SizedBox.shrink();
    return me.isFamily ? const FamilyFeesView() : const StaffFeesView();
  }
}

class InvoiceStatusPill extends StatelessWidget {
  const InvoiceStatusPill(this.inv, {super.key});
  final Invoice inv;

  @override
  Widget build(BuildContext context) {
    final s = statusColors(context);
    if (inv.status == 'paid') return Pill('Paid', color: s.success, icon: Icons.check_circle);
    if (inv.overdue) return Pill('Overdue', color: s.danger, icon: Icons.error_outline);
    if (inv.status == 'partial') return Pill('Part paid', color: s.warning);
    return Pill('Due', color: s.info);
  }
}

// ---- families ------------------------------------------------------------------------------------

class FamilyFeesView extends ConsumerStatefulWidget {
  const FamilyFeesView({super.key});
  @override
  ConsumerState<FamilyFeesView> createState() => _FamilyFeesViewState();
}

class _FamilyFeesViewState extends ConsumerState<FamilyFeesView> {
  int child = 0;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myFeesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Fees')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myFeesProvider.future),
        child: AsyncView(
          value: async,
          onRetry: () => ref.invalidate(myFeesProvider),
          builder: (data) {
            if (data.children.isEmpty) {
              return ListView(children: const [EmptyPanel(icon: Icons.account_balance_wallet_outlined, title: 'Nothing to show yet', message: 'No student is linked to this account.')]);
            }
            final c = data.children[child.clamp(0, data.children.length - 1)];
            final overdue = data.children.fold<double>(0, (n, x) => n + x.overdue);
            return ListView(padding: const EdgeInsets.only(bottom: 24), children: [
              _DueHero(total: data.totalDue, overdue: overdue, testMode: data.testMode, many: data.children.length > 1),
              const SizedBox(height: 12),
              ChildSwitcher(
                names: [for (final x in data.children) x.name],
                subtitles: [for (final x in data.children) x.due > 0 ? '${inr(x.due)} due' : 'Paid up'],
                index: child,
                onChanged: (i) => setState(() => child = i),
              ),
              for (final inv in c.invoices)
                _InvoiceCard(
                  inv: inv,
                  canPay: data.onlinePayments,
                  onPay: () async {
                    final paid = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      showDragHandle: true,
                      builder: (_) => PaySheet(invoice: inv),
                    );
                    if (paid == true) ref.invalidate(myFeesProvider);
                  },
                ),
              if (c.invoices.isEmpty) const EmptyPanel(icon: Icons.receipt_long_outlined, title: 'No invoices yet'),
            ]);
          },
        ),
      ),
    );
  }
}

class _DueHero extends StatelessWidget {
  const _DueHero({required this.total, required this.overdue, required this.testMode, required this.many});
  final double total;
  final double overdue;
  final bool testMode;
  final bool many;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(colors: [Color(0xFF14295A), Color(0xFF1565D7), Color(0xFF0E8FA8)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        boxShadow: [BoxShadow(color: const Color(0xFF1565D7).withValues(alpha: 0.3), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: Stack(children: [
        const Positioned(right: -10, bottom: -18, child: Icon(Icons.account_balance_wallet_rounded, size: 110, color: Colors.white10)),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(many ? 'Total due for all children' : 'Total due', style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 4),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: total),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (_, v, _) => Text(inr(v), style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 6),
          Text(
            [
              total == 0 ? 'All paid up. Thank you!' : overdue > 0 ? '${inr(overdue)} is overdue' : 'Nothing overdue',
              if (testMode) 'Test payments',
            ].join(' · '),
            style: const TextStyle(color: Colors.white70),
          ),
        ]),
      ]),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.inv, required this.canPay, required this.onPay});
  final Invoice inv;
  final bool canPay;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = statusColors(context);
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: inv.overdue ? s.danger.withValues(alpha: 0.5) : scheme.outline)),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: inv.balance > 0,
        shape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: CircleAvatar(
          backgroundColor: (inv.balance > 0 ? scheme.primary : s.success).withValues(alpha: 0.12),
          child: Icon(inv.balance > 0 ? Icons.event_note_rounded : Icons.check_rounded, color: inv.balance > 0 ? scheme.primary : s.success),
        ),
        title: Text(inv.term, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Due ${_date.format(inv.dueDate)}', style: const TextStyle(fontSize: 12)),
        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(inr(inv.balance > 0 ? inv.balance : inv.net), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 2),
          InvoiceStatusPill(inv),
        ]),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        children: [
          const Divider(),
          for (final (name, amount) in inv.items) _Line(name, inr(amount)),
          if (inv.discount > 0) _Line(inv.discountReason ?? 'Concession', '−${inr(inv.discount)}', color: s.success),
          _Line('Total', inr(inv.net), bold: true),
          if (inv.paid > 0) _Line('Paid', inr(inv.paid)),
          const SizedBox(height: 8),
          for (final p in inv.payments)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.receipt_long_rounded, color: scheme.primary),
              title: Text('${inr(p.amount)} · ${methodLabels[p.method]?.$1 ?? p.method}'),
              subtitle: Text(_dateTime.format(p.paidAt)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/fees/receipt/${p.id}'),
            ),
          if (inv.balance > 0 && canPay)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: FilledButton.icon(
                onPressed: onPay,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                icon: const Icon(Icons.verified_user_rounded),
                label: Text('Pay ${inr(inv.balance)}'),
              ),
            ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value, {this.bold = false, this.color});
  final String label;
  final String value;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: color);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [Expanded(child: Text(label, style: style)), Text(value, style: style)]),
    );
  }
}

/// Online payment. In test mode the bank's answer is chosen here; no money moves.
class PaySheet extends ConsumerStatefulWidget {
  const PaySheet({super.key, required this.invoice});
  final Invoice invoice;
  @override
  ConsumerState<PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends ConsumerState<PaySheet> {
  Map<String, dynamic>? order;
  String? error;
  bool busy = false;
  ({bool ok, String message, FeePayment? payment})? result;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      final res = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/fees/invoices/${widget.invoice.id}/pay', parse: (d) => (d as Map).cast());
      if (mounted) setState(() => order = res.data);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> _confirm(String outcome) async {
    setState(() => busy = true);
    try {
      final res = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/fees/orders/${order!['order_id']}/confirm',
          body: {'outcome': outcome}, parse: (d) => (d as Map).cast());
      final d = res.data;
      final p = d['payment'] is Map ? FeePayment.fromJson((d['payment'] as Map).cast()) : null;
      if (d['status'] == 'paid') HapticFeedback.heavyImpact();
      setState(() => result = (ok: d['status'] == 'paid', message: d['message'] as String, payment: p));
    } on ApiException catch (e) {
      setState(() => result = (ok: false, message: e.message, payment: null));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = statusColors(context);
    final scheme = Theme.of(context).colorScheme;
    Widget body;
    if (error != null) {
      body = ErrorPanel(message: error!);
    } else if (result != null) {
      final r = result!;
      body = Column(mainAxisSize: MainAxisSize.min, children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 600),
          curve: Curves.elasticOut,
          builder: (_, t, child) => Transform.scale(scale: t, child: child),
          child: CircleAvatar(
            radius: 38,
            backgroundColor: (r.ok ? s.success : s.danger).withValues(alpha: 0.12),
            child: Icon(r.ok ? Icons.check_circle_rounded : Icons.cancel_rounded, size: 52, color: r.ok ? s.success : s.danger),
          ),
        ),
        const SizedBox(height: 14),
        Text(r.ok ? '${inr(r.payment!.amount)} paid' : 'Payment failed', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text([r.message, if (r.payment != null) 'Receipt ${r.payment!.receiptNo}'].join(' '), textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context, r.ok), child: const Text('Done'))),
          if (r.payment != null) ...[
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: () {
                  Navigator.pop(context, true);
                  context.push('/fees/receipt/${r.payment!.id}');
                },
                child: const Text('Receipt'),
              ),
            ),
          ],
        ]),
      ]);
    } else if (order == null) {
      body = const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
    } else {
      final o = order!;
      body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Text('Pay fees', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        Text('${widget.invoice.studentName} · ${widget.invoice.term}', style: TextStyle(color: scheme.onSurfaceVariant)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), gradient: const LinearGradient(colors: [Color(0xFF1565D7), Color(0xFF0E8FA8)])),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Amount to pay', style: TextStyle(color: Colors.white70)),
            Text(inr((o['amount'] as num).toDouble()), style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
            Text('Invoice ${o['invoice_no']}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ]),
        ),
        if (o['test_mode'] == true) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: s.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: s.warning.withValues(alpha: 0.4))),
            child: Row(children: [
              Icon(Icons.science_outlined, color: s.warning),
              const SizedBox(width: 10),
              Expanded(child: Text('Test mode: no real money moves. Choose what the bank would say.', style: TextStyle(color: s.warning, fontSize: 13))),
            ]),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: busy ? null : () => _confirm('success'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          icon: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.verified_user_rounded),
          label: Text(busy ? 'Processing…' : 'Pay ${inr((o['amount'] as num).toDouble())}'),
        ),
        if (o['test_mode'] == true) TextButton(onPressed: busy ? null : () => _confirm('failure'), child: const Text('Simulate a declined payment')),
      ]);
    }
    return SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), child: AnimatedSize(duration: const Duration(milliseconds: 250), child: body)));
  }
}

// ---- office staff --------------------------------------------------------------------------------

class StaffFeesView extends ConsumerStatefulWidget {
  const StaffFeesView({super.key});
  @override
  ConsumerState<StaffFeesView> createState() => _StaffFeesViewState();
}

class _StaffFeesViewState extends ConsumerState<StaffFeesView> {
  final _search = TextEditingController();
  String query = '';
  String status = 'due';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final summary = ref.watch(feeSummaryProvider);
    final invoices = ref.watch(invoiceSearchProvider((query, status)));
    final st = statusColors(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Fees')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(feeSummaryProvider);
          ref.invalidate(invoiceSearchProvider((query, status)));
          await ref.read(invoiceSearchProvider((query, status)).future);
        },
        child: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
          summary.when(
            data: (s) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(children: [
                Expanded(child: _Tile(label: 'Today', value: inr(s.collectedToday), color: st.success, icon: Icons.currency_rupee_rounded)),
                const SizedBox(width: 8),
                Expanded(child: _Tile(label: 'This month', value: inr(s.collectedMonth), color: Theme.of(context).colorScheme.primary, icon: Icons.trending_up_rounded)),
                const SizedBox(width: 8),
                Expanded(child: _Tile(label: 'Overdue', value: inr(s.overdue), color: st.danger, icon: Icons.warning_amber_rounded)),
              ]),
            ),
            loading: () => const SkeletonList(count: 1, height: 84),
            error: (_, _) => const SizedBox.shrink(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Student, admission or invoice no.',
                suffixIcon: query.isEmpty ? null : IconButton(tooltip: 'Clear', icon: const Icon(Icons.close), onPressed: () { _search.clear(); setState(() => query = ''); }),
              ),
              onSubmitted: (v) => setState(() => query = v.trim()),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              for (final (k, l) in [('due', 'Not fully paid'), ('overdue', 'Overdue'), ('paid', 'Paid')])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(label: Text(l), selected: status == k, onSelected: (_) => setState(() => status = k)),
                ),
            ]),
          ),
          AsyncView(
            value: invoices,
            onRetry: () => ref.invalidate(invoiceSearchProvider((query, status))),
            builder: (list) => list.isEmpty
                ? const EmptyPanel(icon: Icons.search_off_rounded, title: 'No invoices match')
                : Column(children: [
                    for (final inv in list)
                      ListTile(
                        title: Text(inv.studentName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${inv.classSection} · ${inv.term}', maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text(inr(inv.balance > 0 ? inv.balance : inv.net), style: const TextStyle(fontWeight: FontWeight.w700)),
                          InvoiceStatusPill(inv),
                        ]),
                        onTap: () async {
                          await context.push('/fees/invoice/${inv.id}');
                          ref.invalidate(invoiceSearchProvider((query, status)));
                          ref.invalidate(feeSummaryProvider);
                        },
                      ),
                  ]),
          ),
        ]),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value, required this.color, required this.icon});
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 6),
            FittedBox(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
            Text(label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ]),
        ),
      );
}

class InvoiceScreen extends ConsumerWidget {
  const InvoiceScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(invoiceProvider(id));
    final me = ref.watch(meProvider);
    final s = statusColors(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Invoice')),
      body: AsyncView(
        value: async,
        onRetry: () => ref.invalidate(invoiceProvider(id)),
        builder: (inv) => ListView(padding: const EdgeInsets.all(16), children: [
          Text(inv.studentName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          Text('${inv.classSection} · ${inv.admissionNo}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Expanded(child: Text(inv.term, style: const TextStyle(fontWeight: FontWeight.w600))), InvoiceStatusPill(inv)]),
                Text('${inv.invoiceNo} · due ${_date.format(inv.dueDate)}', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                const Divider(height: 24),
                for (final (name, amount) in inv.items) _Line(name, inr(amount)),
                if (inv.discount > 0) _Line(inv.discountReason ?? 'Concession', '−${inr(inv.discount)}', color: s.success),
                _Line('Total', inr(inv.net), bold: true),
                _Line('Paid', inr(inv.paid)),
                _Line('Balance', inr(inv.balance), bold: true, color: inv.overdue ? s.danger : null),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          for (final p in inv.payments)
            Card(
              child: ListTile(
                leading: Icon(methodLabels[p.method]?.$2 ?? Icons.payments_outlined, color: s.success),
                title: Text('${inr(p.amount)} · ${methodLabels[p.method]?.$1 ?? p.method}'),
                subtitle: Text('${p.receiptNo} · ${_dateTime.format(p.paidAt)}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/fees/receipt/${p.id}'),
              ),
            ),
          if (inv.balance > 0 && (me?.can('fees.collect') ?? false)) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              icon: const Icon(Icons.account_balance_wallet_rounded),
              label: const Text('Collect payment'),
              onPressed: () async {
                final paid = await showModalBottomSheet<FeePayment>(
                  context: context,
                  isScrollControlled: true,
                  showDragHandle: true,
                  builder: (_) => CollectSheet(invoice: inv),
                );
                if (paid != null && context.mounted) {
                  ref.invalidate(invoiceProvider(id));
                  showSnack(context, '${inr(paid.amount)} received · ${paid.receiptNo}');
                }
              },
            ),
          ],
        ]),
      ),
    );
  }
}

class CollectSheet extends ConsumerStatefulWidget {
  const CollectSheet({super.key, required this.invoice});
  final Invoice invoice;
  @override
  ConsumerState<CollectSheet> createState() => _CollectSheetState();
}

class _CollectSheetState extends ConsumerState<CollectSheet> {
  late final _amount = TextEditingController(text: widget.invoice.balance.toStringAsFixed(0));
  final _reference = TextEditingController();
  String method = 'cash';
  String? error;
  bool busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { busy = true; error = null; });
    try {
      final res = await ref.read(apiClientProvider).post<FeePayment>('/fees/invoices/${widget.invoice.id}/payments', body: {
        'amount': double.tryParse(_amount.text) ?? 0,
        'method': method,
        'reference': _reference.text.trim().isEmpty ? null : _reference.text.trim(),
      }, parse: (d) => FeePayment.fromJson((d as Map).cast()));
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.pop(context, res.data);
    } on ApiException catch (e) {
      setState(() => error = e.fieldErrors.values.firstOrNull ?? e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final needsRef = method == 'cheque' || method == 'bank_transfer';
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Collect payment', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          Text('${widget.invoice.studentName} · ${inr(widget.invoice.balance)} due', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            decoration: InputDecoration(labelText: 'Amount (₹)', errorText: error),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in ['cash', 'upi', 'cheque', 'card', 'bank_transfer'])
              ChoiceChip(
                avatar: Icon(methodLabels[m]!.$2, size: 18),
                label: Text(methodLabels[m]!.$1),
                selected: method == m,
                onSelected: (_) => setState(() => method = m),
              ),
          ]),
          if (method != 'cash') ...[
            const SizedBox(height: 12),
            TextField(controller: _reference, decoration: InputDecoration(labelText: method == 'cheque' ? 'Cheque number' : method == 'upi' ? 'UPI reference' : 'Reference${needsRef ? '' : ' (optional)'}')),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : _submit,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: Text(busy ? 'Recording…' : 'Record payment'),
          ),
        ]),
      ),
    );
  }
}

class ReceiptScreen extends ConsumerWidget {
  const ReceiptScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(receiptProvider(id));
    final s = statusColors(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Receipt'), actions: [
        IconButton(
          tooltip: 'Open PDF',
          icon: const Icon(Icons.picture_as_pdf_outlined),
          onPressed: () => openApiFile(context, ref, '/fees/payments/$id/receipt.pdf'),
        ),
      ]),
      body: AsyncView(
        value: async,
        onRetry: () => ref.invalidate(receiptProvider(id)),
        builder: (r) => ListView(padding: const EdgeInsets.all(16), children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(r.schoolName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                if (r.schoolAddress != null) Text(r.schoolAddress!, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                const Divider(height: 28),
                Center(
                  child: Column(children: [
                    Icon(Icons.verified_rounded, size: 48, color: s.success),
                    const SizedBox(height: 6),
                    Text(inr(r.payment.amount), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
                    Text('received · ${methodLabels[r.payment.method]?.$1 ?? r.payment.method}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  ]),
                ),
                const Divider(height: 28),
                _Line('Receipt no.', r.payment.receiptNo, bold: true),
                _Line('Date', _dateTime.format(r.payment.paidAt)),
                _Line('Student', r.invoice.studentName),
                _Line('Class', r.invoice.classSection),
                _Line('For', r.invoice.term),
                if (r.payment.reference != null) _Line('Reference', r.payment.reference!),
                if (r.payment.collectedBy != null) _Line('Received by', r.payment.collectedBy!),
                const Divider(height: 24),
                _Line('Balance after this payment', inr(r.balanceAfter), bold: true),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
