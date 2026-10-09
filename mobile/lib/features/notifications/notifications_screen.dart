import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/common.dart';

class AppNotification {
  AppNotification.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        kind = j['kind'] as String,
        title = j['title'] as String,
        body = j['body'] as String?,
        link = j['link'] as String?,
        read = j['read'] as bool,
        createdAt = DateTime.parse(j['created_at'] as String).toLocal();
  final String id;
  final String kind;
  final String title;
  final String? body;
  final String? link;
  final bool read;
  final DateTime createdAt;

  IconData get icon => switch (kind) {
        'notice' => Icons.campaign_outlined,
        'homework' => Icons.menu_book_outlined,
        'absent' => Icons.event_busy_outlined,
        'fee_receipt' => Icons.receipt_long_outlined,
        'results' => Icons.emoji_events_outlined,
        'substitution' => Icons.swap_horiz_rounded,
        'leave' => Icons.event_busy_outlined,
        'online_test' => Icons.quiz_outlined,
        'chat' => Icons.forum_outlined,
        'transport' => Icons.directions_bus_outlined,
        'sos' => Icons.sos_outlined,
        'ptm' => Icons.handshake_outlined,
        'survey' => Icons.poll_outlined,
        'live_class' => Icons.videocam_outlined,
        'fee_reminder' => Icons.notifications_active_outlined,
        'calendar' => Icons.event_note_outlined,
        'enquiry' => Icons.person_add_alt_outlined,
        _ => Icons.notifications_outlined,
      };
}

/// The web paths the API puts in notifications, mapped to screens in this app.
String? appRouteFor(String? link) => link != null && link.startsWith('/messages') ? '/messages' : switch (link) {
      '/notices' => '/notices',
      '/my-homework' || '/homework' => '/homework',
      '/my-attendance' || '/attendance' => '/attendance',
      '/my-fees' || '/fees' => '/fees',
      '/my-results' => '/results',
      '/my-timetable' => '/timetable',
      '/leave' => '/leave',
      '/calendar' => '/calendar',
      '/my-tests' => '/tests',
      '/live-classes' => '/live',
      '/ptm' => '/ptm',
      '/my-transport' => '/bus',
      '/surveys' => '/surveys',
      _ => null,
    };

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final res = await ref.watch(apiClientProvider).get<List<AppNotification>>('/notifications', query: {'page_size': 50},
      parse: (d) => [for (final x in (d as List).cast<Map>()) AppNotification.fromJson(x.cast())]);
  return res.data;
});

final unreadNotificationsProvider = FutureProvider.autoDispose<int>((ref) async {
  final res = await ref.watch(apiClientProvider).get<int>('/notifications/unread-count',
      parse: (d) => ((d as Map)['count'] as num).toInt());
  return res.data;
});

/// A bell for app bars, with the unread count. Opens the notification centre.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final n = ref.watch(unreadNotificationsProvider).value ?? 0;
    return IconButton(
      tooltip: n > 0 ? 'Notifications, $n unread' : 'Notifications',
      onPressed: () async {
        await context.push('/notifications');
        ref.invalidate(unreadNotificationsProvider);
      },
      icon: Badge(isLabelVisible: n > 0, label: Text(n > 99 ? '99+' : '$n'), child: const Icon(Icons.notifications_outlined)),
    );
  }
}

String _when(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'Just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  if (d.inDays < 7) return '${d.inDays} d ago';
  return DateFormat('d MMM').format(t);
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  void _refresh(WidgetRef ref) {
    ref.invalidate(notificationsProvider);
    ref.invalidate(unreadNotificationsProvider);
  }

  Future<void> _open(BuildContext context, WidgetRef ref, AppNotification n) async {
    if (!n.read) {
      await ref.read(apiClientProvider).post<Object?>('/notifications/${n.id}/read').then((_) => _refresh(ref), onError: (_) {});
    }
    final route = appRouteFor(n.link);
    if (route != null && context.mounted) {
      // Tabs are switched with go; full-screen pages are pushed on top.
      if (const {'/homework', '/attendance', '/fees'}.contains(route)) {
        context.go(route);
      } else {
        context.push(route);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    final scheme = Theme.of(context).colorScheme;
    final s = statusColors(context);
    final unread = async.value?.where((n) => !n.read).length ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        if (unread > 0)
          TextButton(
            onPressed: () async {
              await ref.read(apiClientProvider).post<Object?>('/notifications/read-all');
              _refresh(ref);
            },
            child: const Text('Mark all read'),
          ),
      ]),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(notificationsProvider.future),
        child: AsyncView(
          value: async,
          onRetry: () => _refresh(ref),
          builder: (list) => list.isEmpty
              ? ListView(children: const [
                  EmptyPanel(
                    icon: Icons.notifications_none_rounded,
                    title: "You're all caught up",
                    message: 'Notices, homework, absences, fee receipts and results will show here.',
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 72),
                  itemBuilder: (context, i) {
                    final n = list[i];
                    final danger = n.kind == 'absent';
                    return ListTile(
                      tileColor: n.read ? null : scheme.primary.withValues(alpha: 0.05),
                      onTap: () => _open(context, ref, n),
                      leading: CircleAvatar(
                        backgroundColor: (danger ? s.danger : scheme.primary).withValues(alpha: 0.12),
                        foregroundColor: danger ? s.danger : scheme.primary,
                        child: Icon(n.icon, size: 20),
                      ),
                      title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w800)),
                      subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (n.body != null) Text(n.body!, maxLines: 2, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        Text(_when(n.createdAt), style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                      ]),
                      trailing: n.read ? null : Icon(Icons.circle, size: 10, color: scheme.primary, semanticLabel: 'Unread'),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
