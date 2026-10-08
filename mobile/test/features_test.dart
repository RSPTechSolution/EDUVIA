import 'package:eduvia/core/api/api_client.dart';
import 'package:eduvia/core/auth/auth_controller.dart';
import 'package:eduvia/core/auth/token_store.dart';
import 'package:eduvia/core/config/app_config.dart';
import 'package:eduvia/features/attendance/attendance_screens.dart';
import 'package:eduvia/features/exams/exam_screens.dart';
import 'package:eduvia/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'support/fake_api.dart';

ProviderContainer container(FakeApi fake, {AppFlavor flavor = AppFlavor.parent}) {
  final tokens = MemoryTokenStore()..access = 'a'..refresh = 'r';
  return ProviderContainer(retry: apiRetry, overrides: [
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

  testWidgets('tabs follow the role: parents get attendance, homework and fees', (tester) async {
    final fake = FakeApi()..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson())));
    await pump(tester, container(fake));
    final bar = find.byType(NavigationBar);
    for (final label in ['Home', 'Attendance', 'Homework', 'Fees', 'More']) {
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

  testWidgets('parent ticks off homework and opens a notice from the notification centre', (tester) async {
    var done = false;
    Map<String, dynamic> hw() => {
          'id': 'h1', 'section_id': 'sec', 'section_label': 'Class 5 – A', 'subject_id': 'm', 'subject_name': 'Mathematics', 'subject_color': 'blue',
          'title': 'Exercise 3.1', 'details': null, 'assigned_on': '2026-10-01', 'due_date': '2099-10-06', 'teacher': 'Priya Verma',
          'students': 8, 'done': 0, 'checked': 0, 'can_edit': false, 'student_id': 's1', 'student_name': 'Aarav Patel',
          'status': done ? 'done' : 'pending', 'note': null, 'remark': null, 'overdue': false,
          'attachments': [{'id': 'f1', 'filename': 'worksheet.pdf', 'content_type': 'application/pdf', 'size': 2048, 'label': null, 'created_at': '2026-10-01T10:00:00Z'}],
        };
    var read = false;
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson()..['modules'] = ['attendance', 'fees', 'academics', 'communication', 'exams'])))
      ..on('GET /homework/my', (_) => (200, FakeApi.ok([hw()])))
      ..on('POST /homework/h1/done', (req) {
        expect(req.data['student_id'], 's1');
        done = true;
        return (200, FakeApi.ok({'message': 'ok'}));
      })
      ..on('GET /notifications/unread-count', (_) => (200, FakeApi.ok({'count': read ? 1 : 2})))
      ..on('GET /notifications', (_) => (200, FakeApi.ok([
            {'id': 'x1', 'kind': 'notice', 'title': 'Diwali vacation', 'body': 'School closed 20–25 Oct', 'link': '/notices', 'data': {},
             'read': read, 'created_at': '2026-10-02T10:00:00Z'},
            {'id': 'x2', 'kind': 'homework', 'title': 'New homework: Mathematics', 'body': 'Exercise 3.1', 'link': '/my-homework', 'data': {},
             'read': false, 'created_at': '2026-10-01T10:00:00Z'},
          ])))
      ..on('POST /notifications/x1/read', (_) {
        read = true;
        return (200, FakeApi.ok({'message': 'ok'}));
      })
      ..on('GET /notices/unread-count', (_) => (200, FakeApi.ok({'count': 1})))
      ..on('GET /notices', (_) => (200, FakeApi.ok([
            {'id': 'n1', 'title': 'Diwali vacation', 'body': 'School closed 20–25 Oct', 'audience': 'everyone', 'audience_label': 'Everyone', 'section_ids': [],
             'priority': 'important', 'pinned': true, 'created_at': '2026-10-02T10:00:00Z', 'author': 'Principal', 'read': false, 'can_edit': false},
          ])))
      ..on('POST /notices/n1/read', (_) => (200, FakeApi.ok({'message': 'ok'})));
    await pump(tester, container(fake));
    expect(find.text('Homework to do'), findsOneWidget);
    expect(find.byTooltip('Notifications, 2 unread'), findsOneWidget);

    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Homework')));
    await tester.pumpAndSettle();
    expect(find.text('worksheet.pdf'), findsOneWidget);
    await tester.tap(find.byTooltip('Mark as done'));
    await tester.pumpAndSettle();
    expect(done, isTrue);
    expect(find.textContaining('Marked done'), findsOneWidget);

    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Home')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Notifications, 2 unread'));
    await tester.pumpAndSettle();
    expect(find.text('New homework: Mathematics'), findsOneWidget);
    await tester.tap(find.text('Diwali vacation'));
    await tester.pumpAndSettle();
    expect(fake.calls, contains('POST /notifications/x1/read'));
    expect(find.widgetWithText(AppBar, 'Notices'), findsOneWidget);
    await tester.tap(find.text('Diwali vacation'));
    await tester.pumpAndSettle();
    expect(find.text('School closed 20–25 Oct'), findsWidgets);
    expect(fake.calls, contains('POST /notices/n1/read'));
  });

  testWidgets('results list opens the report card', (tester) async {
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson()..['modules'] = ['academics', 'exams'])))
      ..on('GET /exams/my', (_) => (200, FakeApi.ok([{
            'student_id': 's1', 'name': 'Aarav Patel', 'class_section': 'Class 5 – A',
            'exams': [{'exam_id': 'e1', 'exam_name': 'Half-Yearly', 'kind': 'term', 'published_at': '2026-10-01T10:00:00Z', 'percent': 83.9, 'grade': 'A2', 'rank': 2, 'class_size': 8, 'passed': true}],
            'upcoming': [],
          }])))
      ..on('GET /exams/e1/report/s1', (_) => (200, FakeApi.ok({
            'exam_id': 'e1', 'exam_name': 'Half-Yearly', 'academic_year': '2026-27', 'school_name': 'GVPS', 'school_address': null,
            'student_name': 'Aarav Patel', 'admission_no': 'GV1', 'class_section': 'Class 5 – A', 'roll_no': 1, 'date_of_birth': '2015-08-21',
            'class_teacher': 'Priya Verma', 'class_size': 8, 'attendance_percent': 90.8, 'published': true,
            'result': {'student_id': 's1', 'name': 'Aarav Patel', 'roll_no': 1, 'total': 402.5, 'max_total': 480, 'percent': 83.9, 'grade': 'A2',
              'passed': true, 'rank': 2, 'remark': 'Very good progress.',
              'subjects': [{'subject_name': 'Mathematics', 'max_marks': 80, 'pass_marks': 27, 'marks': 66.5, 'absent': false, 'grade': 'A2', 'passed': true}]},
          })));
    await pump(tester, container(fake));
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('More')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Results'));
    await tester.pumpAndSettle();
    expect(find.text('Rank 2 of 8'), findsOneWidget);
    await tester.tap(find.text('Half-Yearly'));
    await tester.pumpAndSettle();
    expect(find.text('66.5/80'), findsOneWidget);
    expect(find.text('Very good progress.'), findsOneWidget);
  });

  testWidgets('teacher enters marks and an absence', (tester) async {
    Map<String, dynamic>? sent;
    final me = meJson(role: 'teacher')..['permissions'] = ['school.view', 'exams.view', 'exams.marks'];
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(me)))
      ..on('GET /exams/papers/p1/sections/s1', (_) => (200, FakeApi.ok({
            'paper_id': 'p1', 'section_id': 's1', 'exam_name': 'Unit Test 2', 'section_label': 'Class 5 – A', 'subject_name': 'Mathematics',
            'max_marks': 25, 'pass_marks': 8, 'editable': true, 'locked_reason': null,
            'rows': [
              {'student_id': 'a', 'name': 'Aarav Patel', 'roll_no': 1, 'marks': null, 'absent': false},
              {'student_id': 'b', 'name': 'Diya Shah', 'roll_no': 2, 'marks': null, 'absent': false},
            ],
          })))
      ..on('PUT /exams/papers/p1/sections/s1', (req) {
        sent = (req.data as Map).cast();
        return (200, FakeApi.ok({}));
      });
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container(fake, flavor: AppFlavor.staff),
      child: const MaterialApp(home: MarksEntryScreen(paperId: 'p1', sectionId: 's1')),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '23');
    await tester.pump();
    expect(find.text('A1'), findsOneWidget); // 92%
    await tester.tap(find.byType(Checkbox).last);
    await tester.pump();
    await tester.tap(find.text('Save marks'));
    await tester.pumpAndSettle();
    final entries = {for (final e in (sent!['entries'] as List).cast<Map>()) e['student_id']: e};
    expect(entries['a']!['marks'], 23.0);
    expect(entries['b']!['absent'], isTrue);
  });

  testWidgets('parent opens syllabus progress from More', (tester) async {
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson()..['modules'] = ['academics'])))
      ..on('GET /syllabus/my', (_) => (200, FakeApi.ok([{
            'student_id': 's1', 'name': 'Aarav Patel', 'class_section': 'Class 5 – A',
            'subjects': [{'section_id': 'sec', 'section_label': 'Class 5 – A', 'class_id': 'c5', 'subject_id': 'm', 'subject_name': 'Mathematics',
                          'subject_color': 'blue', 'total': 8, 'done': 3, 'percent': 37.5, 'behind': 1, 'last_topic': 'Fractions'}],
          }])));
    await pump(tester, container(fake));
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('More')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Syllabus'));
    await tester.pumpAndSettle();
    expect(find.text('Mathematics'), findsOneWidget);
    expect(find.text('37.5%'), findsOneWidget);
    expect(find.text('3 of 8 topics · 1 behind plan'), findsOneWidget);
    expect(find.text('Latest: Fractions'), findsOneWidget);
  });

  testWidgets('teacher sees covers on the home screen', (tester) async {
    final me = meJson(role: 'teacher')..['permissions'] = ['school.view']..['modules'] = ['academics'];
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(me)))
      ..on('GET /substitutions/mine', (_) => (200, FakeApi.ok([{
            'id': 'x', 'date': '2026-10-13', 'period_id': 'p', 'period_name': 'P2', 'start_time': '08:40', 'end_time': '09:20',
            'section_id': 's', 'section_label': 'Class 7 – A', 'subject_name': 'Science', 'subject_color': 'green',
            'absent_teacher_id': 't', 'absent_teacher': 'Priya Verma', 'substitute_id': 'me', 'substitute': 'Me', 'note': null}])))
      ..on('GET /timetable/my', (_) => (200, FakeApi.ok([])));
    await pump(tester, container(fake, flavor: AppFlavor.staff));
    expect(find.text('Your covers'), findsOneWidget);
    expect(find.textContaining('Class 7 – A Science for Priya Verma'), findsOneWidget);
  });

  testWidgets('parent asks for leave and sees it pending', (tester) async {
    var sent = <String, dynamic>{};
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson()..['modules'] = ['attendance'])))
      ..on('GET /attendance/my', (_) => (200, FakeApi.ok([{
            'student_id': 's1', 'name': 'Aarav Patel', 'class_section': 'Class 5 – A', 'month': '2026-10', 'days': [],
            'month_counts': counts(), 'month_percent': null, 'year_counts': counts(), 'year_percent': null}])))
      ..on('GET /leave', (_) => (200, FakeApi.ok(sent.isEmpty ? [] : [{
            'id': 'l1', 'student_id': 's1', 'student_name': 'Aarav Patel', 'class_section': 'Class 5 – A', 'from_date': '2026-10-12',
            'to_date': '2026-10-13', 'days': 2, 'kind': 'sick', 'reason': sent['reason'], 'status': 'pending', 'requested_by': 'Suresh Patel',
            'requested_at': '2026-10-08T10:00:00Z', 'decided_by': null, 'decided_at': null, 'decision_note': null, 'can_decide': false, 'can_cancel': true}])))
      ..on('POST /leave', (req) {
        sent = Map<String, dynamic>.from(req.data as Map);
        return (201, FakeApi.ok({}));
      });
    await pump(tester, container(fake));
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('More')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Leave'));
    await tester.pumpAndSettle();
    expect(find.text('No leave requests'), findsOneWidget);
    await tester.tap(find.text('Ask for leave'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Fever since last night');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Send request'));
    await tester.pumpAndSettle();
    expect(sent['student_id'], 's1');
    expect(sent['kind'], 'sick');
    expect(find.text('Fever since last night'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
  });
}
