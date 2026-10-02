import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show appFlavor;

/// The three apps built from this codebase.
///
/// Android/iOS builds select one with `--flavor parent|staff|driver`; web and
/// desktop builds use `--dart-define=FLAVOR=...`.
enum AppFlavor {
  parent(
    title: 'EDUVIA',
    tagline: 'For parents and students',
    allowedRoles: {'parent', 'student'},
    otherAppHint: 'Staff should use the EDUVIA Staff app.',
  ),
  staff(
    title: 'EDUVIA Staff',
    tagline: 'For teachers and school staff',
    allowedRoles: {
      'school_admin', 'principal', 'teacher', 'accountant', 'receptionist', 'librarian',
      'hr_manager', 'transport_manager', 'security_guard', 'staff',
    },
    otherAppHint: 'Parents and students should use the EDUVIA app.',
  ),
  driver(
    title: 'EDUVIA Driver',
    tagline: 'For school bus drivers',
    allowedRoles: {'driver'},
    otherAppHint: 'This app is only for school bus drivers.',
  );

  const AppFlavor({
    required this.title,
    required this.tagline,
    required this.allowedRoles,
    required this.otherAppHint,
  });

  final String title;
  final String tagline;
  final Set<String> allowedRoles;
  final String otherAppHint;

  /// Word shown after the wordmark ("Staff", "Driver"); none for the main app.
  String? get suffix => switch (this) { parent => null, staff => 'Staff', driver => 'Driver' };

  static AppFlavor fromName(String? name) =>
      AppFlavor.values.firstWhere((f) => f.name == name, orElse: () => AppFlavor.parent);
}

class AppConfig {
  const AppConfig({required this.flavor, required this.apiBaseUrl});

  final AppFlavor flavor;
  final String apiBaseUrl;

  static const _apiUrlOverride = String.fromEnvironment('API_URL');
  static const _flavorDefine = String.fromEnvironment('FLAVOR');

  factory AppConfig.fromEnvironment() {
    final flavor = AppFlavor.fromName(appFlavor ?? (_flavorDefine.isEmpty ? null : _flavorDefine));
    return AppConfig(flavor: flavor, apiBaseUrl: _apiUrlOverride.isNotEmpty ? _apiUrlOverride : _defaultApiUrl());
  }

  /// Local development defaults. The Android emulator reaches the host machine at 10.0.2.2.
  static String _defaultApiUrl() {
    if (kIsWeb) return 'http://localhost:8000';
    if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:8000';
    return 'http://localhost:8000';
  }
}
