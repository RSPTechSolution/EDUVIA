import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/academics/syllabus_screens.dart';
import '../../features/attendance/attendance_data.dart';
import '../../features/attendance/attendance_screens.dart';
import '../../features/attendance/leave_calendar_screens.dart';
import '../../features/auth/change_password_screen.dart';
import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/home/home_shell.dart';
import '../../features/exams/exam_screens.dart';
import '../../features/exams/online_screens.dart';
import '../../features/fees/fees_screens.dart';
import '../../features/home/more_screen.dart';
import '../../features/homework/homework_screens.dart';
import '../../features/notices/community_screens.dart';
import '../../features/notices/notices_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/timetable/timetable_screen.dart';
import '../../features/transport/transport_screens.dart';
import '../auth/auth_controller.dart';

const _publicRoutes = {'/login', '/forgot-password'};

/// Bridges Riverpod auth state to go_router's refreshListenable, so the
/// router instance is created once and only re-runs `redirect`.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable(ref);
  ref.onDispose(listenable.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      if (auth.isLoading || auth.hasError) return loc == '/splash' ? null : '/splash';

      final value = auth.value;
      if (value is SignedIn) {
        if (value.me.mustChangePassword) return loc == '/change-password' ? null : '/change-password';
        if (loc == '/splash' || _publicRoutes.contains(loc)) return '/home';
        return null;
      }
      // Signed out.
      return _publicRoutes.contains(loc) ? null : '/login';
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/change-password', builder: (_, _) => const ChangePasswordScreen()),
      // Full-screen pages opened from the tabs.
      GoRoute(
        path: '/attendance/mark/:id',
        builder: (_, st) => MarkAttendanceScreen(
          sectionId: st.pathParameters['id']!,
          date: st.uri.queryParameters['date'] ?? isoDay(DateTime.now()),
          label: st.uri.queryParameters['label'] ?? 'Attendance',
        ),
      ),
      GoRoute(path: '/fees/invoice/:id', builder: (_, st) => InvoiceScreen(id: st.pathParameters['id']!)),
      GoRoute(path: '/fees/receipt/:id', builder: (_, st) => ReceiptScreen(id: st.pathParameters['id']!)),
      GoRoute(path: '/timetable', builder: (_, _) => const TimetableScreen()),
      GoRoute(path: '/notices', builder: (_, _) => const NoticesScreen()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/syllabus', builder: (_, _) => const MySyllabusScreen()),
      GoRoute(path: '/leave', builder: (_, _) => const LeaveScreen()),
      GoRoute(path: '/tests', builder: (_, _) => const MyTestsScreen()),
      GoRoute(path: '/messages', builder: (_, _) => const MessagesScreen()),
      GoRoute(path: '/driver', builder: (_, _) => const DriverScreen()),
      GoRoute(path: '/bus', builder: (_, _) => const MyBusScreen()),
      GoRoute(path: '/ptm', builder: (_, _) => const PtmScreen()),
      GoRoute(path: '/surveys', builder: (_, _) => const SurveysScreen()),
      GoRoute(path: '/live', builder: (_, _) => const LiveClassesScreen()),
      GoRoute(path: '/calendar', builder: (_, _) => const CalendarScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/results', builder: (_, _) => const ResultsScreen()),
      GoRoute(path: '/results/:exam/:student', builder: (_, st) => ReportCardScreen(examId: st.pathParameters['exam']!, studentId: st.pathParameters['student']!)),
      GoRoute(path: '/marks', builder: (_, _) => const MarksHomeScreen()),
      GoRoute(path: '/marks/:paper/:section', builder: (_, st) => MarksEntryScreen(paperId: st.pathParameters['paper']!, sectionId: st.pathParameters['section']!)),
      GoRoute(path: '/homework/:id', builder: (_, st) => HomeworkCheckScreen(id: st.pathParameters['id']!)),
      // Branch order matches the Tab enum in home_shell.dart.
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/attendance', builder: (_, _) => const AttendanceScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/homework', builder: (_, _) => const HomeworkScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/fees', builder: (_, _) => const FeesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/more', builder: (_, _) => const MoreScreen())]),
        ],
      ),
    ],
  );
});
