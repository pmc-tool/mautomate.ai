import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:shared_preferences/shared_preferences.dart";

/// Persists the active cart id so the cart survives app restarts.
///
/// The cart id is not sensitive (it is scoped to the store sales channel and
/// carries no auth), so plain shared_preferences is the right store — the auth
/// token lives in the platform keychain instead (see AuthStore).
///
/// Kept behind an interface-friendly plain class so tests can supply an
/// in-memory fake via implements CartStore and override [cartStoreProvider].
class CartStore {
  static const String _key = "shopper_cart_id";

  Future<String?> readCartId() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_key);
    return (id != null && id.isNotEmpty) ? id : null;
  }

  Future<void> writeCartId(String id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, id);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

/// The cart-id persistence store.
final cartStoreProvider = Provider<CartStore>((ref) => CartStore());
