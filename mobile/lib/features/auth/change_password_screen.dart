import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/form_widgets.dart';

/// Used both for the forced first-sign-in change and from the profile tab.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).changePassword(_current.text, _next.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed. Other devices have been signed out.')),
      );
      if (context.canPop()) context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider).value;
    final forced = auth is SignedIn && auth.me.mustChangePassword;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Change password'),
        automaticallyImplyLeading: !forced,
        actions: [
          if (forced)
            TextButton(onPressed: () => ref.read(authControllerProvider.notifier).signOut(), child: const Text('Sign out')),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (forced) ...[
                const FormBanner(
                  tone: BannerTone.warning,
                  message: 'You signed in with a temporary password. Choose your own to continue.',
                ),
                const SizedBox(height: 20),
              ],
              if (_error != null) ...[FormBanner(message: _error!), const SizedBox(height: 16)],
              PasswordField(
                controller: _current,
                label: 'Current password',
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.password],
                validator: (v) => (v == null || v.isEmpty) ? 'Enter your current password' : null,
              ),
              const SizedBox(height: 16),
              PasswordField(
                controller: _next,
                label: 'New password',
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
                validator: (v) => validateNewPassword(v) ?? (v == _current.text ? 'Choose a different password' : null),
              ),
              const SizedBox(height: 16),
              PasswordField(
                controller: _confirm,
                label: 'Confirm new password',
                onSubmitted: (_) => _submit(),
                validator: (v) => v != _next.text ? 'Passwords do not match' : null,
              ),
              const SizedBox(height: 8),
              Text('At least 8 characters, with letters and numbers.',
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13)),
              const SizedBox(height: 24),
              LoadingButton(label: 'Update password', loading: _busy, onPressed: _submit),
            ]),
          ),
        ),
      ),
    );
  }
}
