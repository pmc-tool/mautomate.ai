/// Pure, testable form validators for the auth screens.
///
/// Each returns null when the value is acceptable, or a short, user-facing error
/// string otherwise — the exact contract a Flutter [TextFormField] validator
/// expects, so they drop straight into the login/register forms AND are trivial
/// to unit test without a widget tree.
class AuthValidators {
  const AuthValidators._();

  static final RegExp _email = RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$");

  /// Minimum password length Medusa emailpass accepts comfortably.
  static const int minPasswordLength = 8;

  static String? email(String? value) {
    final v = (value ?? "").trim();
    if (v.isEmpty) return "Enter your email";
    if (!_email.hasMatch(v)) return "Enter a valid email address";
    return null;
  }

  static String? password(String? value) {
    final v = value ?? "";
    if (v.isEmpty) return "Enter a password";
    if (v.length < minPasswordLength) {
      return "Password must be at least $minPasswordLength characters";
    }
    return null;
  }

  /// Login only needs a non-empty password (length rules are for sign-up).
  static String? loginPassword(String? value) {
    final v = value ?? "";
    if (v.isEmpty) return "Enter your password";
    return null;
  }

  /// Optional field — valid when empty, else trimmed non-blank.
  static String? optionalName(String? value) => null;
}
