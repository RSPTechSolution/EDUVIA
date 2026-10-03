import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_controller.dart';

const statuses = ['present', 'absent', 'late', 'half_day', 'leave'];

class StatusMeta {
  const StatusMeta(this.label, this.short, this.icon);
  final String label;
  final String short;
  final IconData icon;
}

const statusMeta = {
  'present': StatusMeta('Present', 'P', Icons.check_rounded),
  'absent': StatusMeta('Absent', 'A', Icons.close_rounded),
  'late': StatusMeta('Late', 'L', Icons.schedule_rounded),
  'half_day': StatusMeta('Half day', '½', Icons.remove_rounded),
  'leave': StatusMeta('Leave', 'Lv', Icons.event_busy_rounded),
};

class Counts {
  const Counts(this.map);
  final Map<String, int> map;
  int operator [](String k) => map[k] ?? 0;
  factory Counts.fromJson(Map<String, dynamic> j) => Counts({for (final s in statuses) s: (j[s] as num?)?.toInt() ?? 0});
}

double? _d(Object? v) => (v as num?)?.toDouble();

class DayMark {
  const DayMark(this.date, this.status, this.remark);
  final DateTime date;
  final String status;
  final String? remark;
}

class StudentAttendance {
  StudentAttendance.fromJson(Map<String, dynamic> j)
      : studentId = j['student_id'] as String,
        name = j['name'] as String,
        classSection = j['class_section'] as String,
        month = j['month'] as String,
        days = [
          for (final d in (j['days'] as List).cast<Map>())
            DayMark(DateTime.parse(d['date'] as String), d['status'] as String, d['remark'] as String?)
        ],
        monthCounts = Counts.fromJson((j['month_counts'] as Map).cast()),
        monthPercent = _d(j['month_percent']),
        yearCounts = Counts.fromJson((j['year_counts'] as Map).cast()),
        yearPercent = _d(j['year_percent']);

  final String studentId;
  final String name;
  final String classSection;
  final String month;
  final List<DayMark> days;
  final Counts monthCounts;
  final double? monthPercent;
  final Counts yearCounts;
  final double? yearPercent;

  DayMark? on(DateTime d) {
    for (final m in days) {
      if (m.date.year == d.year && m.date.month == d.month && m.date.day == d.day) return m;
    }
    return null;
  }
}

class SectionCard {
  SectionCard.fromJson(Map<String, dynamic> j)
      : sectionId = j['section_id'] as String,
        label = j['label'] as String,
        classTeacher = j['class_teacher'] as String?,
        isClassTeacher = j['is_class_teacher'] as bool,
        students = j['students'] as int,
        marked = j['marked'] as int,
        present = j['present'] as int,
        absent = j['absent'] as int,
        markedBy = j['marked_by'] as String?;

  final String sectionId;
  final String label;
  final String? classTeacher;
  final bool isClassTeacher;
  final int students;
  final int marked;
  final int present;
  final int absent;
  final String? markedBy;
  bool get done => students > 0 && marked >= students;
}

class RosterEntry {
  RosterEntry.fromJson(Map<String, dynamic> j)
      : studentId = j['student_id'] as String,
        name = j['name'] as String,
        admissionNo = j['admission_no'] as String,
        rollNo = j['roll_no'] as int?,
        status = j['status'] as String?,
        remark = j['remark'] as String?,
        recentPercent = _d(j['recent_percent']);

  final String studentId;
  final String name;
  final String admissionNo;
  final int? rollNo;
  final String? status;
  final String? remark;
  final double? recentPercent;
}

class Roster {
  Roster.fromJson(Map<String, dynamic> j)
      : sectionId = j['section_id'] as String,
        label = j['label'] as String,
        date = DateTime.parse(j['date'] as String),
        editable = j['editable'] as bool,
        lockedReason = j['locked_reason'] as String?,
        markedBy = j['marked_by'] as String?,
        students = [for (final s in (j['students'] as List).cast<Map>()) RosterEntry.fromJson(s.cast())];

  final String sectionId;
  final String label;
  final DateTime date;
  final bool editable;
  final String? lockedReason;
  final String? markedBy;
  final List<RosterEntry> students;
}

final _day = DateFormat('yyyy-MM-dd');
final _month = DateFormat('yyyy-MM');
String isoDay(DateTime d) => _day.format(d);
String isoMonth(DateTime d) => _month.format(d);

/// Parent or student: one entry per child for a month ("yyyy-MM").
final myAttendanceProvider = FutureProvider.autoDispose.family<List<StudentAttendance>, String>((ref, month) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<List<StudentAttendance>>('/attendance/my', query: {'month': month},
      parse: (d) => [for (final x in (d as List).cast<Map>()) StudentAttendance.fromJson(x.cast())]);
  return res.data;
});

/// Staff: sections they can mark, with progress on a day.
final attendanceSectionsProvider = FutureProvider.autoDispose.family<List<SectionCard>, String>((ref, day) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<List<SectionCard>>('/attendance/sections', query: {'date': day},
      parse: (d) => [for (final x in (d as List).cast<Map>()) SectionCard.fromJson(x.cast())]);
  return res.data;
});

final rosterProvider = FutureProvider.autoDispose.family<Roster, (String, String)>((ref, args) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<Roster>('/attendance/sections/${args.$1}', query: {'date': args.$2},
      parse: (d) => Roster.fromJson((d as Map).cast()));
  return res.data;
});
