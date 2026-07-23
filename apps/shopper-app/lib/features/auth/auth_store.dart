import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

/// Persists the customer session (JWT) in the platform Keychain/Keystore.
///
/// Mirrors the merchant app SecureStore: the token is sensitive (it authorises
/// /store/customers and /store/orders), so it lives in secure storage rather
/// than shared_preferences (which holds only the non-sensitive cart id).
///
/// Kept a plain class so tests can supply an in-memory fake via
/// implements AuthStore and override [authStoreProvider].
class AuthStore {
  AuthStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  static const String tokenKey = "shopper_customer_token";

  final FlutterSecureStorage _storage;

  Future<String?> readToken() => _storage.read(key: tokenKey);
  Future<void> writeToken(String token) =>
      _storage.write(key: tokenKey, value: token);
  Future<void> deleteToken() => _storage.delete(key: tokenKey);
}

final authStoreProvider = Provider<AuthStore>((ref) => AuthStore());
