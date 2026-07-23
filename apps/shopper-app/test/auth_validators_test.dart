import "package:flutter_test/flutter_test.dart";

import "package:mautomate_shopper/features/auth/auth_validators.dart";

void main() {
  group("email", () {
    test("rejects empty and malformed addresses", () {
      expect(AuthValidators.email(null), isNotNull);
      expect(AuthValidators.email(""), isNotNull);
      expect(AuthValidators.email("not-an-email"), isNotNull);
      expect(AuthValidators.email("a@b"), isNotNull);
      expect(AuthValidators.email("a@b."), isNotNull);
    });

    test("accepts a valid address (trimmed)", () {
      expect(AuthValidators.email("shopper@example.com"), isNull);
      expect(AuthValidators.email("  shopper@example.com  "), isNull);
    });
  });

  group("password", () {
    test("requires the minimum length on sign-up", () {
      expect(AuthValidators.password(null), isNotNull);
      expect(AuthValidators.password("short"), isNotNull);
      expect(AuthValidators.password("12345678"), isNull);
    });

    test("login only requires a non-empty password", () {
      expect(AuthValidators.loginPassword(""), isNotNull);
      expect(AuthValidators.loginPassword("x"), isNull);
    });
  });
}
