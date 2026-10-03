import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/common.dart';

class Notice {
  Notice.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        title = j['title'] as String,
        body = j['body'] as String,
        audienceLabel = j['audience_label'] as String,
        priority = j['priority'] as String,
        pinned = j['pinned'] as bool,
        createdAt = DateTime.parse(j['created_at'] as String).toLocal(),
        author = j['author'] as String?,
        read = j['read'] as bool;
  final String id;
  final String title;
  final String body;
  final String audienceLabel;
  final String priority;
  final bool pinned;
  final DateTime createdAt;
  final String? author;
  final bool read;
}

final noticesProvider = FutureProvider.autoDispose<List<Notice>>((ref) async {
  final res = await ref.watch(apiClientProvider).get<List<Notice>>('/notices', query: {'page_size': 50},
      parse: (d) => [for (final x in (d as List).cast<Map>()) Notice.fromJson(x.cast())]);
  return res.data;
});

final unreadNoticesProvider = FutureProvider.autoDispose<int>((ref) async {
  final res = await ref.watch(apiClientProvider).get<int>('/notices/unread-count', parse: (d) => ((d as Map)['count'] as num).toInt());
  return res.data;
});

/// A bell for app bars, with the unread count.
class NoticeBell extends ConsumerWidget {
  const NoticeBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final n = ref.watch(unreadNoticesProvider).value ?? 0;
    return IconButton(
      tooltip: n > 0 ? 'Notices, $n unread' : 'Notices',
      onPressed: () async {
        await context.push('/notices');
        ref.invalidate(unreadNoticesProvider);
      },
      icon: Badge(isLabelVisible: n > 0, label: Text(n > 99 ? '99+' : '$n'), child: const Icon(Icons.notifications_outlined)),
    );
  }
}

class NoticesScreen extends ConsumerWidget {
  const NoticesScreen({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, Notice n) async {
    if (!n.read) {
      ref.read(apiClientProvider).post<Object?>('/notices/${n.id}/read').then((_) {
        ref.invalidate(noticesProvider);
        ref.invalidate(unreadNoticesProvider);
      }, onError: (_) {});
    }
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.92,
        builder: (c, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
          Text(n.title, style: Theme.of(c).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('${n.author ?? 'School office'} · ${DateFormat('d MMM yyyy, h:mm a').format(n.createdAt)} · ${n.audienceLabel}',
              style: TextStyle(color: Theme.of(c).colorScheme.onSurfaceVariant, fontSize: 13)),
          const Divider(height: 28),
          SelectableText(n.body, style: const TextStyle(fontSize: 16, height: 1.5)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(noticesProvider);
    final s = statusColors(context);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Notices')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(noticesProvider.future),
        child: AsyncView(
          value: async,
          onRetry: () => ref.invalidate(noticesProvider),
          builder: (list) => list.isEmpty
              ? ListView(children: const [EmptyPanel(icon: Icons.campaign_outlined, title: 'No notices yet')])
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final n = list[i];
                    final color = n.priority == 'urgent' ? s.danger : n.priority == 'important' ? s.warning : scheme.onSurfaceVariant;
                    return Card(
                      margin: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: n.read ? scheme.outline : scheme.primary.withValues(alpha: 0.5)),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => _open(context, ref, n),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            CircleAvatar(
                              backgroundColor: color.withValues(alpha: 0.12),
                              child: Icon(n.priority == 'normal' ? Icons.campaign_outlined : Icons.notification_important_outlined, color: color),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  if (!n.read) ...[
                                    Semantics(label: 'Unread', child: Container(width: 8, height: 8, decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle))),
                                    const SizedBox(width: 6),
                                  ],
                                  Expanded(child: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w700))),
                                  if (n.pinned) Icon(Icons.push_pin, size: 16, color: scheme.primary),
                                ]),
                                const SizedBox(height: 4),
                                Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                                const SizedBox(height: 6),
                                Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                                  if (n.priority != 'normal') Pill(n.priority == 'urgent' ? 'Urgent' : 'Important', color: color),
                                  Text('${n.author ?? 'School'} · ${_ago(n.createdAt)}', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                                ]),
                              ]),
                            ),
                          ]),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

String _ago(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 60) return '${d.inMinutes.clamp(1, 59)} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  if (d.inDays < 7) return '${d.inDays} d ago';
  return DateFormat('d MMM').format(t);
}
