import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../core/api/api_client.dart';

sealed class AuthState {
  const AuthState();
  const factory AuthState.initial() = AuthStateInitial;
  const factory AuthState.loading() = AuthStateLoading;
  const factory AuthState.authenticated({required Map<String, dynamic> user}) = AuthStateAuthenticated;
  const factory AuthState.unauthenticated() = AuthStateUnauthenticated;
  const factory AuthState.error({required String message}) = AuthStateError;

  T? whenOrNull<T>({
    T Function()? initial,
    T Function()? loading,
    T Function(Map<String, dynamic> user)? authenticated,
    T Function()? unauthenticated,
    T Function(String message)? error,
  }) {
    final self = this;
    if (self is AuthStateInitial) return initial?.call();
    if (self is AuthStateLoading) return loading?.call();
    if (self is AuthStateAuthenticated) return authenticated?.call(self.user);
    if (self is AuthStateUnauthenticated) return unauthenticated?.call();
    if (self is AuthStateError) return error?.call(self.message);
    return null;
  }
}

class AuthStateInitial extends AuthState { const AuthStateInitial(); }
class AuthStateLoading extends AuthState { const AuthStateLoading(); }
class AuthStateAuthenticated extends AuthState { 
  final Map<String, dynamic> user;
  const AuthStateAuthenticated({required this.user}); 
}
class AuthStateUnauthenticated extends AuthState { const AuthStateUnauthenticated(); }
class AuthStateError extends AuthState { 
  final String message;
  const AuthStateError({required this.message}); 
}
class AuthNotifier extends AsyncNotifier<AuthState> {
  final _storage = const FlutterSecureStorage();

  @override
  Future<AuthState> build() async {
    return const AuthState.unauthenticated();
  }

  Future<void> login(String email, String password, String? schoolSlug) async {
    state = const AsyncValue.loading();
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/v1/auth/login', data: {
        'email': email,
        'password': password,
        if (schoolSlug != null) 'school_slug': schoolSlug,
      });
      state = AsyncValue.data(const AuthState.authenticated(user: {}));
    } catch (e) {
      state = AsyncValue.data(AuthState.error(message: e.toString()));
    }
  }

  Future<void> logout() async {
    state = const AsyncValue.data(AuthState.unauthenticated());
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
