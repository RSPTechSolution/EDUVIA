import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Mocking Firebase Init for now
  // await Firebase.initializeApp();

  const flavor = String.fromEnvironment('FLAVOR', defaultValue: 'parent');
  runApp(ProviderScope(child: SchoolERPApp(flavor: flavor)));
}

class SchoolERPApp extends ConsumerWidget {
  final String flavor;
  const SchoolERPApp({super.key, required this.flavor});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider(flavor));
    return MaterialApp.router(
      title: _appTitle(flavor),
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }

  String _appTitle(String flavor) {
    switch (flavor) {
      case 'parent': return 'SchoolERP Parent';
      case 'staff': return 'SchoolERP Staff';
      case 'driver': return 'SchoolERP Driver';
      default: return 'SchoolERP';
    }
  }
}
