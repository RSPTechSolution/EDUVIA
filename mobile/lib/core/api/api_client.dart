import 'package:flutter_riverpod/flutter_riverpod.dart';

class ApiClient {
  Future<Map<String, dynamic>> get(String path) async { return {}; }
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? data}) async { return {}; }
}

final apiClientProvider = Provider((ref) => ApiClient());
