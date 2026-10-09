import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/widgets/brand.dart';

/// Shown while the saved session is checked, or when the server can't be reached at launch.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const BrandMark(size: 72),
            const SizedBox(height: 16),
            const Wordmark(),
            const SizedBox(height: 32),
            if (auth.hasError) ...[
              Icon(Icons.cloud_off_rounded, size: 40, color: Theme.of(context).colorScheme.onSurfaceVariant),
              const SizedBox(height: 12),
              Text("Can't reach Vidyanexa", style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text('Check your internet connection and try again.',
                  textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
              const SizedBox(height: 20),
              SizedBox(
                width: 200,
                child: FilledButton(onPressed: () => ref.invalidate(authControllerProvider), child: const Text('Try again')),
              ),
            ] else
              const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
          ]),
        ),
      ),
    );
  }
}
