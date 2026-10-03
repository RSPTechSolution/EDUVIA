import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';
import 'models.dart';

/// The signed-in user, or null while signed out.
final meProvider = Provider<Me?>((ref) {
  final auth = ref.watch(authControllerProvider).value;
  return auth is SignedIn ? auth.me : null;
});

extension MeAccess on Me {
  bool can(String permission) => permissions.contains(permission);
  bool hasModule(String module) => modules.contains(module);
  bool get isFamily => role == 'parent' || role == 'student';
  bool get teaches => role == 'teacher' || role == 'principal';
}
