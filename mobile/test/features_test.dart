import 'package:eduvia/core/api/api_client.dart';
import 'package:eduvia/core/auth/auth_controller.dart';
import 'package:eduvia/core/auth/token_store.dart';
import 'package:eduvia/core/config/app_config.dart';
import 'package:eduvia/features/attendance/attendance_screens.dart';
import 'package:eduvia/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'support/fake_api.dart';

ProviderContainer container(FakeApi fake, {AppFlavor flavor = AppFlavor.parent}) {
  final tokens = MemoryTokenStore()..access = 'a'..refresh = 'r';
  return ProviderContainer(overrides: [
    appConfigProvider.overrideWithValue(AppConfig(flavor: flavor, apiBaseUrl: 'http://test')),
    tokenStoreProvider.overrideWithValue(tokens),
    apiClientProvider.overrideWith((ref) => ApiClient(baseUrl: 'http://test', tokens: tokens, adapter: fake)),
  ]);
}

Map<String, dynamic> invoice({double balance = 3000, bool overdue = true, String status = 'partial'}) => {
      'id': 'i1', 'invoice_no': 'INV-2627-00001', 'student_id': 's1', 'student_name': 'Aarav Patel', 'admission_no': 'GV1',
      'class_section': 'Class 5 – A', 'term': 'Quarter 2', 'due_date': '2026-07-15', 'total': 13000, 'discount': 0,
      'paid': 13000 - balance, 'balance': balance, 'status': status, 'overdue': overdue, 'academic_year': '2026-27',
      'issue_date': '2026-07-01', 'discount_reason': null, 'items': [{'name': 'Tuition', 'amount': 9000}, {'name': 'Development', 'amount': 4000}],
      'payments': [], 'guardian_phone': null,
    };

Map<String, dynamic> counts([Map<String, int> c = const {}]) => {'present': 0, 'absent': 0, 'late': 0, 'half_day': 0, 'leave': 0, ...c};

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(WidgetTester tester, ProviderContainer c) async {
    await tester.pumpWidget(UncontrolledProviderScope(container: c, child: const EduviaApp()));
    await tester.pumpAndSettle();
  }

  testWidgets('tabs follow the role: parents get attendance, fees and timetable', (tester) async {
    final fake = FakeApi()..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson())));
    await pump(tester, container(fake));
    final bar = find.byType(NavigationBar);
    for (final label in ['Home', 'Attendance', 'Fees', 'Timetable', 'Profile']) {
      expect(find.descendant(of: bar, matching: find.text(label)), findsOneWidget);
    }
  });

  testWidgets('a teacher without fee access has no Fees tab', (tester) async {
    final me = meJson(role: 'teacher')..['permissions'] = ['school.view', 'attendance.view', 'attendance.mark'];
    final fake = FakeApi()..on('GET /auth/me', (_) => (200, FakeApi.ok(me)));
    await pump(tester, container(fake, flavor: AppFlavor.staff));
    final bar = find.byType(NavigationBar);
    expect(find.descendant(of: bar, matching: find.text('Attendance')), findsOneWidget);
    expect(find.descendant(of: bar, matching: find.text('Fees')), findsNothing);
  });

  testWidgets('parent sees what is due and pays in test mode', (tester) async {
    var paid = false;
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson())))
      ..on('GET /fees/my', (_) => (200, FakeApi.ok({
            'children': [{'student_id': 's1', 'name': 'Aarav Patel', 'class_section': 'Class 5 – A', 'due': paid ? 0 : 3000, 'overdue': paid ? 0 : 3000,
              'next_due_date': '2026-07-15', 'invoices': [invoice(balance: paid ? 0 : 3000, overdue: !paid, status: paid ? 'paid' : 'partial')]}],
            'total_due': paid ? 0 : 3000, 'online_payments': true, 'test_mode': true,
          })))
      ..on('POST /fees/invoices/i1/pay', (_) => (201, FakeApi.ok({'order_id': 'o1', 'amount': 3000, 'gateway': 'test', 'test_mode': true, 'invoice_no': 'INV-2627-00001', 'description': 'Quarter 2'})))
      ..on('POST /fees/orders/o1/confirm', (req) {
        expect(req.data['outcome'], 'success');
        paid = true;
        return (200, FakeApi.ok({'status': 'paid', 'message': 'Payment received. Thank you!', 'payment': {
          'id': 'p1', 'receipt_no': 'RCT-2627-00009', 'amount': 3000, 'method': 'online', 'reference': 'pay_test', 'note': null,
          'paid_at': '2026-10-03T10:00:00Z', 'collected_by': 'Paid online by Suresh Patel'}}));
      });
    await pump(tester, container(fake));
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Fees')));
    await tester.pumpAndSettle();
    expect(find.text('₹3,000 is overdue · Test payments'), findsOneWidget);
    expect(find.text('Overdue'), findsWidgets);

    await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹3,000'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Test mode'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹3,000').last);
    await tester.pumpAndSettle();
    expect(find.text('₹3,000 paid'), findsOneWidget);
    await tester.tap(find.widgetWithText(OutlinedButton, 'Done'));
    await tester.pumpAndSettle();
    expect(find.textContaining('All paid up. Thank you!'), findsOneWidget);
  });

  testWidgets('teacher marks the rest present, one absent, and saves', (tester) async {
    Map<String, dynamic>? sent;
    final me = meJson(role: 'teacher')..['permissions'] = ['school.view', 'attendance.view', 'attendance.mark'];
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(me)))
      ..on('GET /attendance/sections/sec1', (_) => (200, FakeApi.ok({
            'section_id': 'sec1', 'label': 'Class 5 – A', 'date': '2026-10-03', 'editable': true, 'locked_reason': null,
            'marked_by': null, 'marked_at': null, 'counts': counts(),
            'students': [
              for (final (i, n) in ['Aarav Patel', 'Diya Shah', 'Kabir Singh'].indexed)
                {'student_id': 'st$i', 'name': n, 'admission_no': 'GV$i', 'roll_no': i + 1, 'gender': 'male', 'status': null, 'remark': null, 'recent_percent': 92.5},
            ],
          })))
      ..on('PUT /attendance/sections/sec1', (req) {
        sent = (req.data as Map).cast();
        return (200, FakeApi.ok({}));
      });
    final c = container(fake, flavor: AppFlavor.staff);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const MaterialApp(home: MarkAttendanceScreen(sectionId: 'sec1', date: '2026-10-03', label: 'Class 5 – A')),
    ));
    await tester.pumpAndSettle();
    expect(find.text('3 left'), findsOneWidget);

    await tester.tap(find.text('A').at(1));
    await tester.pump();
    await tester.tap(find.text('Rest present'));
    await tester.pump();
    expect(find.text('Present 2'), findsOneWidget);
    expect(find.text('Absent 1'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    final records = (sent!['records'] as List).cast<Map>();
    expect(sent!['date'], '2026-10-03');
    expect({for (final r in records) r['student_id']: r['status']}, {'st0': 'present', 'st1': 'absent', 'st2': 'present'});
  });

  testWidgets('parent attendance shows the year ring and days away', (tester) async {
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson())))
      ..on('GET /attendance/my', (_) => (200, FakeApi.ok([{
            'student_id': 's1', 'name': 'Aarav Patel', 'class_section': 'Class 5 – A', 'month': '2026-10',
            'days': [{'date': '2026-10-01', 'status': 'present', 'remark': null}, {'date': '2026-10-02', 'status': 'absent', 'remark': 'Fever'}],
            'month_counts': counts({'present': 1, 'absent': 1}), 'month_percent': 50.0,
            'year_counts': counts({'present': 60, 'absent': 6}), 'year_percent': 90.9,
          }])));
    await pump(tester, container(fake));
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Attendance')));
    await tester.pumpAndSettle();
    expect(find.text('Aarav Patel'), findsWidgets);
    expect(find.textContaining('50% · low'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Friday, 2 Oct'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Friday, 2 Oct'), findsOneWidget);
    expect(find.text('Absent · Fever'), findsOneWidget);
  });
}
