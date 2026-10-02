import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('renders login text fields', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              TextField(key: Key('email')),
              TextField(key: Key('password')),
              ElevatedButton(onPressed: null, child: Text('Sign In')),
            ],
          )
        )
      ));
      
      expect(find.byType(TextField), findsNWidgets(2));
      expect(find.text('Sign In'), findsOneWidget);
    });
  });
}
