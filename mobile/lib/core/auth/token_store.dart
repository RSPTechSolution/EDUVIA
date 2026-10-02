import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Where tokens live between launches: Keychain on iOS, Keystore-backed
/// encrypted storage on Android.
abstract class TokenStore {
  Future<String?> accessToken();
  Future<String?> refreshToken();
  Future<void> save({required String access, required String refresh});
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;
  static const _access = 'eduvia.access';
  static const _refresh = 'eduvia.refresh';

  // In-memory copy avoids a platform-channel read on every request.
  String? _accessCache;

  @override
  Future<String?> accessToken() async => _accessCache ??= await _s.read(key: _access);

  @override
  Future<String?> refreshToken() => _s.read(key: _refresh);

  @override
  Future<void> save({required String access, required String refresh}) async {
    _accessCache = access;
    await _s.write(key: _access, value: access);
    await _s.write(key: _refresh, value: refresh);
  }

  @override
  Future<void> clear() async {
    _accessCache = null;
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
  }
}

/// Used in tests.
class MemoryTokenStore implements TokenStore {
  String? access;
  String? refresh;

  @override
  Future<String?> accessToken() async => access;
  @override
  Future<String?> refreshToken() async => refresh;
  @override
  Future<void> save({required String access, required String refresh}) async {
    this.access = access;
    this.refresh = refresh;
  }

  @override
  Future<void> clear() async => access = refresh = null;
}
