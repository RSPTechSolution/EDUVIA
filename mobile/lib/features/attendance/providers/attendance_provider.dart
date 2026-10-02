import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class AttendanceNotifier extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<Map<String, dynamic>> processQrScan(String studentId, String mode) async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/api/v1/attendance/qr-scan', data: {
      'student_id': studentId,
      'mode': mode,
    });
    return res['data'];
  }

  Future<void> bulkMark(String sectionId, String date, List<Map<String, dynamic>> records) async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/v1/attendance/$sectionId', data: {
      'date': date,
      'records': records,
    });
  }
}

final attendanceNotifierProvider = AsyncNotifierProvider<AttendanceNotifier, void>(AttendanceNotifier.new);
