import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/token_store.dart';

/// An error returned by the Vidyanexa API (or a network failure).
class ApiException implements Exception {
  ApiException(this.message, {this.code = 'HTTP_ERROR', this.status = 0, this.details});

  final String message;
  final String code;
  final int status;
  final Object? details;

  bool get isNetwork => status == 0;

  /// Field-level messages from a 422 response.
  Map<String, String> get fieldErrors {
    final d = details;
    if (d is! List) return const {};
    return {
      for (final e in d.whereType<Map>())
        '${e['field']}': '${e['message']}'.replaceFirst('Value error, ', ''),
    };
  }

  @override
  String toString() => message;

  factory ApiException.fromDio(DioException e) {
    final body = e.response?.data;
    if (body is Map && body['error'] is Map) {
      final err = body['error'] as Map;
      return ApiException(
        '${err['message'] ?? 'Request failed'}',
        code: '${err['code'] ?? 'HTTP_ERROR'}',
        status: e.response?.statusCode ?? 0,
        details: err['details'],
      );
    }
    if (e.response == null) {
      return ApiException("Can't reach the server. Check your internet connection and try again.");
    }
    return ApiException('Something went wrong (${e.response?.statusCode}).', status: e.response?.statusCode ?? 0);
  }
}

/// Riverpod retry policy: retry network failures a few times; never retry an answer
/// from the server (a 404 or 403 won't change by asking again).
Duration? apiRetry(int retryCount, Object error) {
  if (error is ApiException && !error.isNetwork) return null;
  if (retryCount >= 3) return null;
  return Duration(milliseconds: 400 * (1 << retryCount));
}

class ApiResult<T> {
  ApiResult(this.data, this.meta);
  final T data;
  final Map<String, dynamic>? meta;
}

/// Dio wrapper that adds the bearer token, refreshes it once when it expires,
/// and turns every failure into an [ApiException].
class ApiClient {
  ApiClient({required String baseUrl, required this.tokens, this.onSessionExpired, HttpClientAdapter? adapter})
      : _dio = Dio(),
        _plain = Dio() {
    for (final d in [_dio, _plain]) {
      if (adapter != null) d.httpClientAdapter = adapter;
      d.options
        ..baseUrl = '$baseUrl/api/v1'
        ..connectTimeout = const Duration(seconds: 15)
        ..receiveTimeout = const Duration(seconds: 30)
        ..contentType = Headers.jsonContentType;
    }
    _dio.interceptors.add(QueuedInterceptorsWrapper(onRequest: _onRequest, onError: _onError));
  }

  final Dio _dio;

  /// No interceptors: used for the refresh call and the single retry, so they
  /// can never wait on the queued error handler that is waiting on them.
  final Dio _plain;
  final TokenStore tokens;

  /// Called when refreshing fails, so the app can return to the sign-in screen.
  void Function()? onSessionExpired;

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['auth'] != false) {
      final access = await tokens.accessToken();
      if (access != null) options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  // Queued: while one request refreshes, the others wait, so the rotating
  // refresh token is only ever used once.
  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    final res = err.response;
    final code = res?.data is Map ? (res!.data['error']?['code']) : null;
    final retriable = res?.statusCode == 401 && err.requestOptions.extra['auth'] != false && err.requestOptions.extra['retried'] != true;
    if (!retriable || code == 'INVALID_CREDENTIALS') return handler.next(err);

    // Another queued request may already have refreshed while this one waited.
    final sentWith = err.requestOptions.headers['Authorization'];
    final current = await tokens.accessToken();
    if (current != null && sentWith != 'Bearer $current') {
      return _retry(err, current, handler);
    }

    final refresh = await tokens.refreshToken();
    if (refresh == null) return handler.next(err);
    try {
      final r = await _plain.post<Map<String, dynamic>>('/auth/refresh', data: {'refresh_token': refresh});
      final data = r.data!['data'] as Map<String, dynamic>;
      await tokens.save(access: data['access_token'] as String, refresh: data['refresh_token'] as String);
      await _retry(err, data['access_token'] as String, handler);
    } on DioException catch (e) {
      // Offline: keep the session and let the caller show a connection error.
      if (e.response == null) return handler.next(err);
      // The server rejected the refresh token: the session is over.
      await tokens.clear();
      onSessionExpired?.call();
      return handler.next(err);
    }
  }

  Future<void> _retry(DioException err, String access, ErrorInterceptorHandler handler) async {
    final opts = err.requestOptions
      ..headers['Authorization'] = 'Bearer $access'
      ..extra['retried'] = true;
    try {
      handler.resolve(await _plain.fetch(opts));
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  Future<ApiResult<T>> request<T>(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool auth = true,
    T Function(Object? json)? parse,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: body,
        queryParameters: query?..removeWhere((_, v) => v == null),
        options: Options(method: method, extra: {'auth': auth}),
      );
      final json = res.data ?? const {};
      final data = json['data'];
      return ApiResult(parse != null ? parse(data) : data as T, json['meta'] as Map<String, dynamic>?);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ApiResult<T>> get<T>(String path, {Map<String, dynamic>? query, T Function(Object?)? parse}) =>
      request('GET', path, query: query, parse: parse);

  Future<ApiResult<T>> post<T>(String path, {Object? body, bool auth = true, T Function(Object?)? parse}) =>
      request('POST', path, body: body, auth: auth, parse: parse);

  Future<ApiResult<T>> put<T>(String path, {Object? body, T Function(Object?)? parse}) =>
      request('PUT', path, body: body, parse: parse);

  /// A 10-minute link to [path] (e.g. `/fees/payments/<id>/receipt.pdf`) that works without the
  /// Authorization header, so the phone's browser or PDF viewer can open it.
  Future<Uri> signedUrl(String path) async {
    final base = Uri.parse(_dio.options.baseUrl);
    final full = '${base.path}$path';
    final res = await post<String>('/auth/download-link', body: {'path': full}, parse: (d) => (d as Map)['url'] as String);
    final token = Uri.parse(res.data).queryParameters['dl']!;
    return base.replace(path: full, queryParameters: {'dl': token});
  }
}
