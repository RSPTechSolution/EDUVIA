import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _slugCtrl = TextEditingController();
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (_, next) {
      next.whenData((state) {
        state.whenOrNull(
          authenticated: (_) => print('nav to dashboard'),
          error: (msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg))),
        );
      });
    });

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              TextFormField(controller: _slugCtrl, decoration: const InputDecoration(labelText: 'School ID (slug)')),
              TextFormField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
              TextFormField(controller: _passCtrl, obscureText: _obscure, decoration: const InputDecoration(labelText: 'Password')),
              ElevatedButton(
                onPressed: authState.isLoading
                  ? null
                  : () => ref.read(authProvider.notifier).login(_emailCtrl.text, _passCtrl.text, _slugCtrl.text),
                child: const Text('Sign In'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
