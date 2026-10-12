import 'dart:async';

import 'package:eduvia/core/api/api_client.dart';
import 'package:eduvia/core/auth/auth_controller.dart';
import 'package:eduvia/core/auth/token_store.dart';
import 'package:eduvia/core/config/app_config.dart';
import 'package:eduvia/core/theme/app_theme.dart';
import 'package:eduvia/main.dart';
import 'package:eduvia/shared/widgets/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'support/fake_api.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('home shows one skeleton until all its cards can appear together', (tester) async {
    final fees = Completer<(int, Map<String, dynamic>)>();
    final fake = FakeApi()
      ..on('GET /auth/me', (_) => (200, FakeApi.ok(meJson())))
      ..on('GET /fees/my', (_) => fees.future);
    final tokens = MemoryTokenStore()
      ..access = 'a'
      ..refresh = 'r';
    final c = ProviderContainer(retry: apiRetry, overrides: [
      appConfigProvider.overrideWithValue(const AppConfig(flavor: AppFlavor.parent, apiBaseUrl: 'http://test')),
      tokenStoreProvider.overrideWithValue(tokens),
      apiClientProvider.overrideWith((ref) => ApiClient(baseUrl: 'http://test', tokens: tokens, adapter: fake)),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(container: c, child: const VidyanexaApp()));
    // The shimmer never settles, so step time forward instead of waiting for the app to go idle.
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.textContaining('Suresh'), findsOneWidget); // the greeting is there straight away
    expect(find.byType(Shimmer), findsOneWidget);
    expect(find.text('Aarav Patel'), findsNothing);

    fees.complete((200, FakeApi.ok({
      'children': [{'student_id': 's1', 'name': 'Aarav Patel', 'class_section': 'Class 5 – A', 'due': 0, 'overdue': 0, 'next_due_date': null, 'invoices': []}],
      'total_due': 0,
    })));
    await tester.pumpAndSettle();
    expect(find.byType(Shimmer), findsNothing);
    expect(find.text('Aarav Patel'), findsOneWidget);
  });

  for (final dark in [false, true]) {
    testWidgets('every skeleton lays out in ${dark ? 'dark' : 'light'} mode', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      for (final skeleton in const <Widget>[SkeletonList(), SkeletonSummary(), SkeletonDetail(), SkeletonGrid()]) {
        await tester.pumpWidget(MaterialApp(
          theme: dark ? AppTheme.dark() : AppTheme.light(),
          home: Scaffold(body: skeleton),
        ));
        await tester.pump(const Duration(milliseconds: 700));
        expect(tester.takeException(), isNull);
        expect(find.byType(Bone), findsWidgets);
        expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      }
    });
  }

  testWidgets('the shimmer holds still when the system asks for less motion', (tester) async {
    await tester.pumpWidget(const MediaQuery(
      data: MediaQueryData(disableAnimations: true),
      child: MaterialApp(home: Scaffold(body: SkeletonList(count: 2))),
    ));
    await tester.pumpAndSettle(); // settles only if nothing is animating
    expect(find.byType(Bone), findsWidgets);
  });
}
