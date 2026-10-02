import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Mock auth provider
final authProvider = StateProvider<bool>((ref) => false);

final appRouterProvider = Provider.family<GoRouter, String>((ref, flavor) {
  final isAuthenticated = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isLoggingIn = state.matchedLocation == '/login';
      if (!isAuthenticated && !isLoggingIn) return '/login';
      if (isAuthenticated && isLoggingIn) return '/dashboard';
      return null;
    },
    routes: _buildRoutes(flavor),
  );
});

List<RouteBase> _buildRoutes(String flavor) {
  final commonRoutes = [
    GoRoute(
      path: '/login',
      builder: (context, state) => Scaffold(
        appBar: AppBar(title: const Text('Login')),
        body: Center(
          child: ElevatedButton(
            onPressed: () {
              // Using context to read ProviderScope is tricky in go_router builder without ref, 
              // but we're mocking so we can skip actual read or pass ref if we made GoRouter a notifier
              context.go('/dashboard');
            },
            child: const Text('Sign In'),
          ),
        ),
      ),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => Scaffold(
        appBar: AppBar(title: Text('Dashboard ($flavor)')),
        body: Center(child: Text('Welcome to $flavor App!')),
      ),
    ),
  ];
  return commonRoutes;
}
