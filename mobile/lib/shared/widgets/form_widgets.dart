import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Inline error/notice banner used at the top of forms.
class FormBanner extends StatelessWidget {
  const FormBanner({super.key, required this.message, this.tone = BannerTone.error});
  final String message;
  final BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final status = Theme.of(context).extension<StatusColors>()!;
    final color = switch (tone) {
      BannerTone.error => status.danger,
      BannerTone.warning => status.warning,
      BannerTone.info => status.info,
      BannerTone.success => status.success,
    };
    final icon = switch (tone) {
      BannerTone.error => Icons.error_outline,
      BannerTone.warning => Icons.warning_amber_rounded,
      BannerTone.info => Icons.info_outline,
      BannerTone.success => Icons.check_circle_outline,
    };
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: TextStyle(color: color, fontWeight: FontWeight.w500))),
        ]),
      ),
    );
  }
}

enum BannerTone { error, warning, info, success }

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
      );
}

class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.validator,
    this.autofillHints,
    this.textInputAction = TextInputAction.done,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: widget.controller,
        obscureText: _obscure,
        validator: widget.validator,
        autofillHints: widget.autofillHints,
        textInputAction: widget.textInputAction,
        onFieldSubmitted: widget.onSubmitted,
        decoration: InputDecoration(
          labelText: widget.label,
          suffixIcon: IconButton(
            tooltip: _obscure ? 'Show password' : 'Hide password',
            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      );
}

/// Mirrors the API's password rules.
String? validateNewPassword(String? v) {
  final value = v ?? '';
  if (value.length < 8) return 'Use at least 8 characters';
  if (!RegExp(r'[A-Za-z]').hasMatch(value) || !RegExp(r'\d').hasMatch(value)) return 'Include both letters and numbers';
  if (utf8.encode(value).length > 72) return 'Password is too long';
  return null;
}

class LoadingButton extends StatelessWidget {
  const LoadingButton({super.key, required this.label, required this.loading, required this.onPressed});
  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
        onPressed: loading ? null : onPressed,
        child: loading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
            : Text(label),
      );
}
