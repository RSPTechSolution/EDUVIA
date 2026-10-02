import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class PaginatedStudents {
  final List<dynamic> items;
  final int total;
  PaginatedStudents({required this.items, required this.total});
  factory PaginatedStudents.fromJson(Map<String, dynamic> json) => PaginatedStudents(items: json['items'], total: json['total']);
}

class StudentsNotifier extends AsyncNotifier<PaginatedStudents> {
  @override
  Future<PaginatedStudents> build() => _fetchStudents();

  Future<PaginatedStudents> _fetchStudents({int page = 1, String search = ''}) async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/v1/students?page=$page&search=$search');
    return PaginatedStudents.fromJson(res['data'] ?? {'items': [], 'total': 0});
  }

  Future<void> search(String query) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetchStudents(search: query));
  }
}

final studentsProvider = AsyncNotifierProvider<StudentsNotifier, PaginatedStudents>(StudentsNotifier.new);
