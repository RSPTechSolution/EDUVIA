import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import 'offline.dart';

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
    return {for (final e in d.whereType<Map>()) '${e['field']}': '${e['message']}'.replaceFirst('Value error, ', '')};
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
  ApiResult(this.data, this.meta, {this.savedAt});
  final T data;
  final Map<String, dynamic>? meta;

  /// Set when the server couldn't be reached and this is the answer saved on the phone at that time.
  final DateTime? savedAt;
}

/// Dio wrapper that adds the bearer token, refreshes it once when it expires,
/// and turns every failure into an [ApiException].
class ApiClient {
  ApiClient({required String baseUrl, required this.tokens, this.onSessionExpired, HttpClientAdapter? adapter, OfflineStore? store})
    : _dio = Dio(),
      _plain = Dio(),
      store = store ?? MemoryStore() {
    queue = OfflineQueue(this.store);
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

  /// The last answer to each GET, kept so screens still show something without a connection.
  final OfflineStore store;

  /// Changes made without a connection, sent when it comes back.
  late final OfflineQueue queue;
  static const _cacheIndex = 'cache-index';
  static const _cacheMax = 120;

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
    query?.removeWhere((_, v) => v == null);
    final key = 'get:$path?${(query ?? const {}).entries.map((e) => '${e.key}=${e.value}').join('&')}';
    ApiResult<T> result(Map<String, dynamic> json, [DateTime? savedAt]) =>
        ApiResult(parse != null ? parse(json['data']) : json['data'] as T, json['meta'] as Map<String, dynamic>?, savedAt: savedAt);
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, extra: {'auth': auth}),
      );
      final json = res.data ?? const <String, dynamic>{};
      if (offlineSince.value != null) offlineSince.value = null;
      if (method == 'GET' && auth) unawaited(_remember(key, json));
      if (pendingChanges.value > 0 && !_flushing) unawaited(flushPending());
      return result(json);
    } on DioException catch (e) {
      final err = ApiException.fromDio(e);
      // No connection: show the last answer saved on this phone, if there is one.
      if (err.isNetwork && method == 'GET' && auth) {
        final saved = await _recall(key);
        if (saved != null) {
          offlineSince.value ??= saved.$1;
          return result(saved.$2, saved.$1);
        }
      }
      throw err;
    }
  }

  Future<void> _remember(String key, Map<String, dynamic> json) async {
    try {
      await store.write(key, jsonEncode({'at': DateTime.now().toIso8601String(), 'json': json}));
      final index = [...?(jsonDecode(await store.read(_cacheIndex) ?? '[]') as List?)?.cast<String>()]
        ..remove(key)
        ..add(key);
      while (index.length > _cacheMax) {
        await store.remove(index.removeAt(0));
      }
      await store.write(_cacheIndex, jsonEncode(index));
    } catch (_) {
      // Saving for later is best effort; the answer itself already arrived.
    }
  }

  Future<(DateTime, Map<String, dynamic>)?> _recall(String key) async {
    try {
      final raw = await store.read(key);
      if (raw == null) return null;
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return (DateTime.parse(j['at'] as String), (j['json'] as Map).cast<String, dynamic>());
    } catch (_) {
      return null;
    }
  }

  /// Forgets every saved answer (on sign-out, so the next person on this phone never sees them).
  Future<void> clearSaved() async {
    final index = (jsonDecode(await store.read(_cacheIndex) ?? '[]') as List).cast<String>();
    for (final k in index) {
      await store.remove(k);
    }
    await store.remove(_cacheIndex);
    offlineSince.value = null;
  }

  /// Keeps a change on the phone to send when the connection is back.
  Future<void> sendLater(String method, String path, Object? body, String label) =>
      queue.add(PendingChange(method: method, path: path, body: body, label: label));

  bool _flushing = false;

  /// Sends the changes waiting on this phone. Returns how many went through.
  Future<int> flushPending() async {
    if (_flushing) return 0;
    _flushing = true;
    try {
      return await queue.flush((c) async {
        try {
          await request<Object?>(c.method, c.path, body: c.body);
        } on ApiException catch (e) {
          if (e.isNetwork) throw OfflineError();
          rethrow;
        }
      });
    } finally {
      _flushing = false;
    }
  }

  Future<ApiResult<T>> get<T>(String path, {Map<String, dynamic>? query, T Function(Object?)? parse}) => request('GET', path, query: query, parse: parse);

  Future<ApiResult<T>> post<T>(String path, {Object? body, bool auth = true, T Function(Object?)? parse}) =>
      request('POST', path, body: body, auth: auth, parse: parse);

  Future<ApiResult<T>> put<T>(String path, {Object? body, T Function(Object?)? parse}) => request('PUT', path, body: body, parse: parse);

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
