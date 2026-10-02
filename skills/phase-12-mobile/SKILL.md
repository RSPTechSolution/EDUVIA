---
name: schoolerp-phase-12-mobile
description: >
  Phase 12 of SchoolERP — Flutter 3.x mobile apps using app flavors: Parent &
  Student app (13 modules), Staff & Admin app (16 modules), Driver GPS app.
  go_router navigation, Riverpod 2 state management, Dio API client, Firebase
  push, offline SQLite queues, razorpay_flutter, mobile_scanner, fl_chart.
  Use when building any Flutter screen, widget, provider, or mobile feature.
---
# Phase 12 — Flutter Mobile Apps (Complete)
## Flutter 3.x · Riverpod 2 · go_router · Dio

## App Flavor Architecture

```dart
// lib/main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  const flavor = String.fromEnvironment('FLAVOR', defaultValue: 'parent');
  runApp(ProviderScope(child: SchoolERPApp(flavor: flavor)));
}

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Handle background notification
}

class SchoolERPApp extends ConsumerWidget {
  final String flavor;
  const SchoolERPApp({super.key, required this.flavor});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider(flavor));
    return MaterialApp.router(
      title: _appTitle(flavor),
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }

  String _appTitle(String flavor) => switch (flavor) {
    'parent' => 'SchoolERP Parent',
    'staff'  => 'SchoolERP Staff',
    'driver' => 'SchoolERP Driver',
    _        => 'SchoolERP',
  };
}
```

## go_router Configuration

```dart
// lib/core/router/app_router.dart
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appRouterProvider = Provider.family<GoRouter, String>((ref, flavor) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull is _Authenticated;
      final isLoggingIn = state.matchedLocation == '/login';
      if (!isLoggedIn && !isLoggingIn) return '/login';
      if (isLoggedIn && isLoggingIn) return '/dashboard';
      return null;
    },
    routes: _buildRoutes(flavor),
  );
});

List<RouteBase> _buildRoutes(String flavor) {
  final commonRoutes = [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
  ];

  return switch (flavor) {
    'parent' => [...commonRoutes, ..._parentRoutes],
    'staff'  => [...commonRoutes, ..._staffRoutes],
    'driver' => [...commonRoutes, ..._driverRoutes],
    _        => commonRoutes,
  };
}

final _parentRoutes = [
  ShellRoute(
    builder: (_, __, child) => ParentShell(child: child),
    routes: [
      GoRoute(path: '/dashboard', builder: (_, __) => const ParentDashboardScreen()),
      GoRoute(path: '/attendance', builder: (_, __) => const AttendanceScreen()),
      GoRoute(path: '/homework', builder: (_, __) => const HomeworkListScreen()),
      GoRoute(path: '/homework/:id', builder: (_, s) => HomeworkDetailScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/fees', builder: (_, __) => const FeeInvoicesScreen()),
      GoRoute(path: '/fees/:id/pay', builder: (_, s) => FeePaymentScreen(invoiceId: s.pathParameters['id']!)),
      GoRoute(path: '/exams', builder: (_, __) => const ExamsScreen()),
      GoRoute(path: '/exams/:id/attempt', builder: (_, s) => ExamAttemptScreen(examId: s.pathParameters['id']!)),
      GoRoute(path: '/timetable', builder: (_, __) => const TimetableScreen()),
      GoRoute(path: '/results', builder: (_, __) => const ResultsScreen()),
      GoRoute(path: '/chat', builder: (_, __) => const ChatThreadsScreen()),
      GoRoute(path: '/chat/:threadId', builder: (_, s) => ChatThreadScreen(threadId: s.pathParameters['threadId']!)),
      GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
    ],
  ),
];
```

## Theme System

```dart
// lib/core/theme/app_theme.dart
import 'package:flutter/material.dart';

class AppTheme {
  static const _primaryColor = Color(0xFF1A3C5E);
  static const _accentColor = Color(0xFF2E7D9E);

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primaryColor,
      primary: _primaryColor,
      secondary: _accentColor,
      brightness: Brightness.light,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: _primaryColor,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      filled: true,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: _primaryColor,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
      ),
    ),
    chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
  );

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primaryColor,
      primary: const Color(0xFF4A8FBE),
      secondary: _accentColor,
      brightness: Brightness.dark,
    ),
    appBarTheme: const AppBarTheme(backgroundColor: Color(0xFF0F2030), foregroundColor: Colors.white),
  );
}
```

## Firebase Push Notifications Setup

```dart
// lib/core/services/notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> init(ApiClient api) async {
    // Request permission
    await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);

    // Get FCM token and register with backend
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await api.post('/api/v1/notifications/register', data: {
        'token': token,
        'platform': Platform.isAndroid ? 'android' : 'ios',
      });
    }

    // Token refresh handler
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      await api.post('/api/v1/notifications/register', data: {'token': newToken});
    });

    // Foreground message handler
    FirebaseMessaging.onMessage.listen((message) {
      _showLocalNotification(message);
    });

    // Setup local notifications
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails('schoolerp_channel', 'SchoolERP',
            importance: Importance.high, priority: Priority.high),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
```

## Shared Widget Library

```dart
// lib/shared/widgets/stat_card.dart
class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final String? subtitle;

  const StatCard({super.key, required this.title, required this.value,
                  required this.icon, required this.color, this.subtitle});

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 20)),
          const Spacer(),
        ]),
        const SizedBox(height: 12),
        Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
        Text(title, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey.shade600)),
        if (subtitle != null) Text(subtitle!, style: const TextStyle(color: Colors.green, fontSize: 12)),
      ]),
    ),
  );
}

// lib/shared/widgets/shimmer_list.dart
import 'package:shimmer/shimmer.dart';

class ShimmerList extends StatelessWidget {
  final int itemCount;
  const ShimmerList({super.key, this.itemCount = 5});

  @override
  Widget build(BuildContext context) => ListView.builder(
    itemCount: itemCount,
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: Colors.grey.shade300,
      highlightColor: Colors.grey.shade100,
      child: Card(child: ListTile(
        leading: const CircleAvatar(backgroundColor: Colors.white),
        title: Container(height: 14, color: Colors.white),
        subtitle: Container(height: 10, color: Colors.white),
      )),
    ),
  );
}

// lib/shared/widgets/empty_state.dart
class EmptyState extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;
  final VoidCallback? onAction;
  final String? actionLabel;

  const EmptyState({super.key, required this.title, required this.message,
                    required this.icon, this.onAction, this.actionLabel});

  @override
  Widget build(BuildContext context) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(icon, size: 80, color: Colors.grey.shade400),
      const SizedBox(height: 16),
      Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.grey.shade700)),
      const SizedBox(height: 8),
      Text(message, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade500)),
      if (onAction != null && actionLabel != null) ...[
        const SizedBox(height: 24),
        ElevatedButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    ]),
  ));
}
```

## Parent Dashboard — Server-Driven Widgets

```dart
// lib/features/dashboard/screens/parent_dashboard_screen.dart
@riverpod
Future<List<DashboardWidget>> dashboardWidgets(DashboardWidgetsRef ref) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/dashboard/widgets');
  return (res['data']['widgets'] as List)
      .map((w) => DashboardWidget.fromJson(w as Map<String, dynamic>))
      .toList();
}

class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final widgets = ref.watch(dashboardWidgetsProvider);
    return Scaffold(
      appBar: AppBar(
        title: ref.watch(currentSchoolProvider).when(
          data: (s) => Text(s?.name ?? 'SchoolERP'),
          loading: () => const Text('SchoolERP'),
          error: (_, __) => const Text('SchoolERP'),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined),
              onPressed: () => context.push('/notifications')),
          const SizedBox(width: 8),
        ],
      ),
      body: widgets.when(
        loading: () => const ShimmerList(),
        error: (e, _) => EmptyState(title: 'Failed to load', message: e.toString(), icon: Icons.error_outline),
        data: (ws) => RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardWidgetsProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: ws.length,
            itemBuilder: (_, i) => DashboardWidgetRenderer(widget: ws[i]),
          ),
        ),
      ),
    );
  }
}
```

## Build Commands

```bash
# Run in development
flutter run --dart-define=FLAVOR=parent   # Parent app
flutter run --dart-define=FLAVOR=staff    # Staff app
flutter run --dart-define=FLAVOR=driver   # Driver app

# Build release APK (Android)
flutter build apk --dart-define=FLAVOR=parent --release
flutter build apk --dart-define=FLAVOR=staff --release
flutter build apk --dart-define=FLAVOR=driver --release

# Build App Bundle (Play Store)
flutter build appbundle --dart-define=FLAVOR=parent --release

# Build IPA (iOS)
flutter build ipa --dart-define=FLAVOR=parent --release

# Run all Flutter tests
flutter test

# Run integration tests (on emulator/device)
flutter test integration_test/ --dart-define=FLAVOR=parent
```

## Testing — Phase 12

```dart
// test/features/auth/login_screen_test.dart
void main() {
  group('LoginScreen', () {
    testWidgets('renders email, password, school slug fields', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const LoginScreen()));
      expect(find.byType(TextFormField), findsNWidgets(3));
      expect(find.text('Sign In'), findsOneWidget);
    });

    testWidgets('shows loading indicator while logging in', (tester) async {
      final container = createContainer(overrides: [
        authProvider.overrideWith(() => LoadingAuthNotifier()),
      ]);
      await tester.pumpWidget(UncontrolledProviderScope(container: container,
          child: const MaterialApp(home: LoginScreen())));
      await tester.tap(find.text('Sign In'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });
}

// test/features/fees/fee_payment_test.dart
void main() {
  test('FeeInvoice.fromJson parses status correctly', () {
    final json = {'id': 'uuid', 'invoice_no': 'INV-001', 'total_amount': '5000.00',
                  'paid_amount': '2000.00', 'status': 'partial', 'due_date': '2024-12-31T00:00:00Z'};
    final invoice = FeeInvoice.fromJson(json);
    expect(invoice.status, 'partial');
    expect(invoice.totalAmount, 5000.0);
  });
}

// integration_test/parent_app_test.dart
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Parent login flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();
    expect(find.text('Sign In'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('email_field')), 'parent@demo.com');
    await tester.enterText(find.byKey(const Key('password_field')), 'Parent@123');
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle(const Duration(seconds: 3));
    expect(find.text('Dashboard'), findsOneWidget);
  });
}
```

## Antigravity Prompt for Phase 12

```
@file skills/master-plan/SKILL.md
@file skills/phase-12-mobile/SKILL.md

Build Phase 12 — Flutter Mobile Apps (complete polish pass):
1. Confirm flavor system works: --dart-define=FLAVOR=parent|staff|driver
2. go_router: all routes for all 3 flavors, auth redirect guard
3. AppTheme: light + dark, Material 3, brand colors
4. Shared widgets: StatCard, ShimmerList, EmptyState, ErrorState
5. Firebase FCM: permission request, token registration with backend, foreground handler
6. Parent App: complete all screens — dashboard (server-driven), attendance, homework,
   fee payment (razorpay_flutter), CBT exam, timetable, chat (socket_io_client),
   results, CCTV consent flow
7. Staff App: complete all screens — QR scanner (mobile_scanner), gradebook, leave,
   gate pass approval, survey builder
8. Driver App: complete — GPS service (background_fetch + sqflite queue), SOS hold button,
   boarding register, trip lifecycle
9. flutter_local_notifications for foreground FCM messages
10. Write flutter_test unit + widget tests for all screens
11. Write integration_test for login flow for all 3 flavors
12. Run: flutter test && flutter test integration_test/
```
