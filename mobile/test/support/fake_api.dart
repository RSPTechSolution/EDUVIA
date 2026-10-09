import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

typedef Handler = FutureOr<(int, Map<String, dynamic>)> Function(RequestOptions req);

/// A scripted Vidyanexa API for tests. Routes are matched on "METHOD /path".
class FakeApi implements HttpClientAdapter {
  final Map<String, Handler> routes = {};
  final List<String> calls = [];
  bool offline = false;

  void on(String route, Handler handler) => routes[route] = handler;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final key = '${options.method} ${options.path}';
    calls.add(key);
    if (offline) {
      throw DioException.connectionError(requestOptions: options, reason: 'offline');
    }
    final handler = routes[key];
    final (status, body) = handler == null ? (404, err('NOT_FOUND', 'No route $key')) : await handler(options);
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}

  static Map<String, dynamic> ok(Object? data) => {'success': true, 'data': data, 'meta': null};
  static Map<String, dynamic> err(String code, String message) => {
        'success': false,
        'error': {'code': code, 'message': message},
      };
}

Map<String, dynamic> meJson({String role = 'parent', bool mustChange = false}) => {
      'id': 'u1',
      'email': 'parent@demo.com',
      'full_name': 'Suresh Patel',
      'phone': null,
      'role': role,
      'school_id': 's1',
      'must_change_password': mustChange,
      'last_login_at': '2026-10-02T10:00:00Z',
      'school': {'id': 's1', 'name': 'Green Valley Public School', 'slug': 'demo', 'logo_url': null, 'timezone': 'Asia/Kolkata', 'currency': 'INR'},
      'modules': ['attendance', 'fees', 'academics'],
      'permissions': ['school.view'],
    };

Map<String, dynamic> tokensJson(String suffix) => {
      'access_token': 'access-$suffix',
      'refresh_token': 'refresh-$suffix',
      'token_type': 'bearer',
      'expires_in': 1800,
    };
