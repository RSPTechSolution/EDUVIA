import 'package:eduvia/core/api/api_client.dart';
import 'package:eduvia/core/auth/auth_controller.dart';
import 'package:eduvia/core/auth/token_store.dart';
import 'package:eduvia/core/config/app_config.dart';
import 'package:eduvia/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'support/fake_api.dart';

ProviderContainer makeContainer(FakeApi fake, MemoryTokenStore tokens, {AppFlavor flavor = AppFlavor.parent}) {
  return ProviderContainer(retry: apiRetry, overrides: [
    appConfigProvider.overrideWithValue(AppConfig(flavor: flavor, apiBaseUrl: 'http://test')),
    tokenStoreProvider.overrideWithValue(tokens),
    apiClientProvider.overrideWith((ref) {
      final c = ApiClient(baseUrl: 'http://test', tokens: tokens, adapter: fake);
      c.onSessionExpired = () => ref.read(authControllerProvider.notifier).sessionExpired();
      return c;
    }),
  ]);
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('AuthController', () {
    test('starts signed out with no saved session', () async {
      final c = makeContainer(FakeApi(), MemoryTokenStore());
      expect(await c.read(authControllerProvider.future), isA<SignedOut>());
    });

    test('restores a saved session', () async {
      final fake = FakeApi()..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson())));
      final c = makeContainer(fake, MemoryTokenStore()..access = 'a'..refresh = 'r');
      final state = await c.read(authControllerProvider.future);
      expect((state as SignedIn).me.firstName, 'Suresh');
    });

    test('signs in and stores tokens', () async {
      final fake = FakeApi()
        ..on('POST /auth/login', (req) {
          expect(req.data['school_slug'], 'demo');
          return (200, FakeApi.ok({'tokens': tokensJson('1'), 'user': meJson()}));
        });
      final tokens = MemoryTokenStore();
      final c = makeContainer(fake, tokens);
      await c.read(authControllerProvider.future);
      await c.read(authControllerProvider.notifier).signIn(email: 'parent@demo.com', password: 'x', schoolSlug: ' demo ');
      expect(c.read(authControllerProvider).value, isA<SignedIn>());
      expect(tokens.refresh, 'refresh-1');
    });

    test('a teacher cannot use the parent app', () async {
      final fake = FakeApi()
        ..on('POST /auth/login', (_) => (200, FakeApi.ok({'tokens': tokensJson('1'), 'user': meJson(role: 'teacher')})))
        ..on('POST /auth/logout', (_) => (200, FakeApi.ok({'message': 'Logged out'})));
      final tokens = MemoryTokenStore();
      final c = makeContainer(fake, tokens);
      await c.read(authControllerProvider.future);
      await expectLater(
        c.read(authControllerProvider.notifier).signIn(email: 't@demo.com', password: 'x', schoolSlug: 'demo'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'WRONG_APP')),
      );
      expect(tokens.refresh, isNull);
      expect(fake.calls, contains('POST /auth/logout'));
      expect((c.read(authControllerProvider).value as SignedOut).notice, contains('EDUVIA Staff'));
    });
  });

  group('Screens', () {
    Future<void> pumpApp(WidgetTester tester, FakeApi fake, MemoryTokenStore tokens) async {
      await tester.pumpWidget(UncontrolledProviderScope(container: makeContainer(fake, tokens), child: const EduviaApp()));
      await tester.pumpAndSettle();
    }

    testWidgets('login validates required fields', (tester) async {
      await pumpApp(tester, FakeApi(), MemoryTokenStore());
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pump();
      expect(find.text('Enter your school ID'), findsOneWidget);
      expect(find.text('Enter your email'), findsOneWidget);
      expect(find.text('Enter your password'), findsOneWidget);
    });

    testWidgets('wrong password shows the server message', (tester) async {
      final fake = FakeApi()..on('POST /auth/login', (_) => (401, FakeApi.err('INVALID_CREDENTIALS', 'Invalid email, password or school')));
      await pumpApp(tester, fake, MemoryTokenStore());
      await tester.enterText(find.widgetWithText(TextFormField, 'School ID'), 'demo');
      await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'parent@demo.com');
      await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'wrong');
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('Invalid email, password or school'), findsOneWidget);
    });

    testWidgets('successful sign-in lands on the home screen', (tester) async {
      final fake = FakeApi()..on('POST /auth/login', (_) => (200, FakeApi.ok({'tokens': tokensJson('1'), 'user': meJson()})));
      await pumpApp(tester, fake, MemoryTokenStore());
      await tester.enterText(find.widgetWithText(TextFormField, 'School ID'), 'demo');
      await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'parent@demo.com');
      await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'Demo@1234');
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Suresh'), findsOneWidget);
      expect(find.text('Green Valley Public School'), findsOneWidget);
      // Only modules the school enabled are listed.
      expect(find.text('Fees'), findsOneWidget);
      expect(find.text('Bus tracking'), findsNothing);
    });

    testWidgets('temporary password forces the change-password screen', (tester) async {
      final fake = FakeApi()..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson(mustChange: true))));
      await pumpApp(tester, fake, MemoryTokenStore()..access = 'a'..refresh = 'r');
      expect(find.text('You signed in with a temporary password. Choose your own to continue.'), findsOneWidget);
    });
  });
}
