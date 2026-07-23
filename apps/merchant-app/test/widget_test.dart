import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:mautomate_merchant/app.dart";
import "package:mautomate_merchant/core/auth/secure_store.dart";

/// In-memory [SecureStore] so the auth bootstrap runs without a platform plugin.
class _FakeSecureStore extends SecureStore {
  String? _token;

  @override
  Future<String?> readToken() async => _token;

  @override
  Future<void> writeToken(String token) async => _token = token;

  @override
  Future<void> deleteToken() async => _token = null;
}

Future<void> _pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        secureStoreProvider.overrideWithValue(_FakeSecureStore()),
      ],
      child: const MerchantApp(),
    ),
  );
  // Let the optimistic restore resolve (no token -> signed out -> /login).
  await tester.pumpAndSettle();
}

void main() {
  testWidgets("boots to sign-in when there is no stored session", (
    tester,
  ) async {
    await _pumpApp(tester);
    expect(find.text("Sign in to run your shop."), findsOneWidget);
  });

  testWidgets("login screen renders the email + password form and CTA", (
    tester,
  ) async {
    await _pumpApp(tester);

    // Two labelled inputs (email, password) and the primary CTA.
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text("Email"), findsOneWidget);
    expect(find.text("Password"), findsOneWidget);
    expect(find.text("Sign in"), findsOneWidget);
  });

  testWidgets("empty submit surfaces inline validation, not a crash", (
    tester,
  ) async {
    await _pumpApp(tester);

    await tester.tap(find.text("Sign in"));
    await tester.pumpAndSettle();

    // Form validators fire client-side before any network call.
    expect(find.text("Enter your email"), findsOneWidget);
    expect(find.text("Enter your password"), findsOneWidget);
  });
}
