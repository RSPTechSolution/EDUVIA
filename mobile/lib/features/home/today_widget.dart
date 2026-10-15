import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';
import 'package:intl/intl.dart';

import '../../shared/widgets/common.dart' show inr;
import '../attendance/attendance_data.dart';
import '../fees/fees_data.dart';

/// What the widget shows now, so it's only redrawn when something changed.
String? _last;

/// Updates the parent app's home-screen widget ("Today at school") with the first child's attendance today and the
/// next fee due. Called whenever Home has fresh data. Only on Android, where the widget exists; nothing happens
/// elsewhere (web, tests), and a widget that isn't on the home screen simply isn't drawn.
Future<void> updateTodayWidget({required List<StudentAttendance> attendance, required List<ChildFees> fees}) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  final now = DateTime.now();
  final a = attendance.firstOrNull;
  final f = a == null ? fees.firstOrNull : fees.where((x) => x.studentId == a.studentId).firstOrNull ?? fees.firstOrNull;
  final name = a?.name ?? f?.name;
  if (name == null) return;
  final mark = a?.on(now);
  final attendanceLine = a == null
      ? ''
      : mark == null
      ? (now.weekday == DateTime.sunday ? 'Today: holiday' : 'Today: not marked yet')
      : 'Today: ${statusMeta[mark.status]?.label ?? mark.status}';
  String feeLine = '';
  if (f != null) {
    final next = f.invoices.where((i) => i.balance > 0).toList()..sort((x, y) => x.dueDate.compareTo(y.dueDate));
    feeLine = next.isEmpty
        ? 'Fees: paid up'
        : f.overdue > 0
        ? 'Fees: ${inr(f.overdue)} overdue'
        : 'Next fee: ${inr(next.first.balance)} by ${DateFormat('d MMM').format(next.first.dueDate)}';
  }
  final signature = '$name|$attendanceLine|$feeLine';
  if (signature == _last) return; // nothing new to show
  _last = signature;
  try {
    await Future.wait([
      HomeWidget.saveWidgetData<String>('child', name.split(' ').first),
      HomeWidget.saveWidgetData<String>('attendance', attendanceLine),
      HomeWidget.saveWidgetData<String>('fee', feeLine),
      HomeWidget.saveWidgetData<String>('updated', 'Updated ${DateFormat('h:mm a').format(now)}'),
    ]);
    await HomeWidget.updateWidget(androidName: 'TodayWidgetProvider', qualifiedAndroidName: 'com.eduvia.eduvia.TodayWidgetProvider');
  } catch (e) {
    debugPrint('home widget not updated: $e'); // e.g. the staff or driver app, which has no widget
  }
}
