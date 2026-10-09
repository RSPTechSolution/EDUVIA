import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// The Vidyanexa palette (brand/README.md): Ink Navy, Antique Gold and Ivory. Same as the web app.
class Brand {
  static const primary = Color(0xFF15233F); // Ink Navy
  static const primaryDark = Color(0xFFD9AE62); // gold leads in dark mode
  static const navy = Color(0xFF15233F);
  static const gold = Color(0xFFB8893C);
  static const ivory = Color(0xFFF7F2E8);
  static const success = Color(0xFF067D4D);
  static const successDark = Color(0xFF54CC8E);
  static const warning = Color(0xFFA65D00);
  static const warningDark = Color(0xFFEEB154);
  static const info = Color(0xFF057688);
  static const danger = Color(0xFFC51D24);
  static const dangerDark = Color(0xFFF66D67);
  static const teal = Color(0xFFB8893C); // illustrations now use the gold family
  static const green = Color(0xFFE2BE74);
  static const sun = Color(0xFFC9963F);

  static const bgLight = Color(0xFFFBF8F2);
  static const fg = Color(0xFF16213A);
  static const muted = Color(0xFF5B6478);
  static const border = Color(0xFFE6DECD);
  static const bgDark = Color(0xFF0E1729);
  static const cardDark = Color(0xFF15233F);
  static const fgDark = Color(0xFFF2ECDF);
  static const mutedDark = Color(0xFFA9B0C0);
}

/// Status colours that adapt to the theme.
@immutable
class StatusColors extends ThemeExtension<StatusColors> {
  const StatusColors({required this.success, required this.warning, required this.info, required this.danger});

  final Color success;
  final Color warning;
  final Color info;
  final Color danger;

  static const light = StatusColors(success: Brand.success, warning: Brand.warning, info: Brand.info, danger: Brand.danger);
  static const dark = StatusColors(success: Brand.successDark, warning: Brand.warningDark, info: Color(0xFF5CC3D6), danger: Brand.dangerDark);

  @override
  StatusColors copyWith({Color? success, Color? warning, Color? info, Color? danger}) => StatusColors(
        success: success ?? this.success,
        warning: warning ?? this.warning,
        info: info ?? this.info,
        danger: danger ?? this.danger,
      );

  @override
  StatusColors lerp(StatusColors? other, double t) {
    if (other == null) return this;
    return StatusColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
    );
  }
}

class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: Brand.primary,
      brightness: brightness,
      primary: isDark ? Brand.primaryDark : Brand.primary,
      onPrimary: isDark ? Brand.navy : Brand.ivory,
      secondary: Brand.gold,
      onSecondary: Brand.navy,
      error: isDark ? Brand.dangerDark : Brand.danger,
      surface: isDark ? Brand.cardDark : Colors.white,
      onSurface: isDark ? Brand.fgDark : Brand.fg,
      onSurfaceVariant: isDark ? Brand.mutedDark : Brand.muted,
      outline: isDark ? const Color(0x33FFFFFF) : Brand.border,
      outlineVariant: isDark ? const Color(0x1FFFFFFF) : Brand.border,
    );

    final body = GoogleFonts.interTextTheme(ThemeData(brightness: brightness).textTheme);
    final heading = GoogleFonts.plusJakartaSansTextTheme(body);
    final textTheme = body.copyWith(
      displaySmall: heading.displaySmall?.copyWith(fontWeight: FontWeight.w700),
      headlineLarge: heading.headlineLarge?.copyWith(fontWeight: FontWeight.w700),
      headlineMedium: heading.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
      headlineSmall: heading.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
      titleLarge: heading.titleLarge?.copyWith(fontWeight: FontWeight.w700),
    ).apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);

    final radius = BorderRadius.circular(12);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      scaffoldBackgroundColor: isDark ? Brand.bgDark : Brand.bgLight,
      textTheme: textTheme,
      extensions: [isDark ? StatusColors.dark : StatusColors.light],
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? Brand.bgDark : Brand.bgLight,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(fontSize: 20),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: radius, side: BorderSide(color: scheme.outlineVariant)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? Brand.bgDark : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: scheme.outline)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: scheme.outline)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: scheme.primary, width: 2)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        indicatorColor: (isDark ? Brand.gold : Brand.gold).withValues(alpha: isDark ? 0.22 : 0.18),
        labelTextStyle: WidgetStatePropertyAll(textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600)),
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}
