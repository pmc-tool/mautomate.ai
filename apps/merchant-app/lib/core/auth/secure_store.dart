import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

/// Persists the merchant session token in the platform Keychain/Keystore.
///
/// The key mirrors the web client's localStorage key (`merchant_admin_token`)
/// so the concept is identical across surfaces.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  static const String tokenKey = "merchant_admin_token";

  final FlutterSecureStorage _storage;

  Future<String?> readToken() => _storage.read(key: tokenKey);
  Future<void> writeToken(String token) =>
      _storage.write(key: tokenKey, value: token);
  Future<void> deleteToken() => _storage.delete(key: tokenKey);
}

final secureStoreProvider = Provider<SecureStore>((ref) => SecureStore());
