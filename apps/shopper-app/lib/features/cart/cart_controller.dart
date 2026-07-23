import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/api_error.dart";
import "../../core/api/tenant_config.dart";
import "cart_models.dart";
import "cart_repository.dart";
import "cart_store.dart";

/// Owns the shopper cart state — the single source of truth the cart screen,
/// the header/nav badge (via cartItemCountProvider) and the PDP add-to-cart all
/// read and mutate.
///
/// State is an AsyncValue of a nullable Cart: null means no cart yet. Every
/// mutation keeps the PREVIOUS cart visible during the in-flight request
/// (copyWithPrevious) and lands network failures in the state (AsyncError) —
/// it never throws out to the widget tree, so the UI never crashes on a bad
/// network; it degrades to an error the screen can surface + retry.
class CartController extends AsyncNotifier<Cart?> {
  CartRepository get _repo => ref.read(cartRepositoryProvider);
  CartStore get _store => ref.read(cartStoreProvider);

  @override
  Future<Cart?> build() async {
    final id = await _store.readCartId();
    if (id == null) return null;
    try {
      return await _repo.retrieve(id);
    } catch (e) {
      if (_isStale(e)) {
        // The stored cart id no longer resolves — forget it and start fresh
        // on the next add. A transient error instead surfaces as AsyncError.
        await _store.clear();
        return null;
      }
      rethrow;
    }
  }

  /// A missing/expired cart id (Medusa answers 404/400), as opposed to a
  /// transient network/5xx failure we should NOT wipe the cart id for.
  bool _isStale(Object e) {
    final err = ApiError.from(e);
    return err.status == 404 || err.status == 400;
  }

  Future<String?> _regionId() async {
    try {
      final cfg = await ref.read(tenantConfigProvider.future);
      return cfg.regionId;
    } catch (_) {
      return null;
    }
  }

  /// Lazily ensure a cart exists, creating (and persisting) one on first use.
  Future<Cart> _ensureCart() async {
    final current = state.valueOrNull;
    if (current != null) return current;
    final cart = await _repo.create(regionId: await _regionId());
    await _store.writeCartId(cart.id);
    return cart;
  }

  /// Add [variantId] to the cart, creating the cart on first use and
  /// INCREMENTING when the variant is already present. [quantity] defaults 1.
  Future<void> addVariant(String variantId, {int quantity = 1}) async {
    if (quantity <= 0) return;
    state = const AsyncLoading<Cart?>().copyWithPrevious(state);
    try {
      final cart = await _ensureCart();
      final existing = cart.lineForVariant(variantId);
      final updated = existing != null
          ? await _repo.updateLineItem(
              cart.id,
              existing.id,
              existing.quantity + quantity,
            )
          : await _repo.addLineItem(
              cart.id,
              variantId: variantId,
              quantity: quantity,
            );
      state = AsyncData(updated);
    } catch (e, st) {
      state = AsyncError<Cart?>(e, st).copyWithPrevious(state);
    }
  }

  /// Set a line item quantity. A quantity <= 0 removes the line.
  Future<void> updateItem(String lineItemId, int quantity) async {
    final cart = state.valueOrNull;
    if (cart == null) return;
    if (quantity <= 0) {
      return removeItem(lineItemId);
    }
    state = const AsyncLoading<Cart?>().copyWithPrevious(state);
    try {
      state = AsyncData(await _repo.updateLineItem(cart.id, lineItemId, quantity));
    } catch (e, st) {
      state = AsyncError<Cart?>(e, st).copyWithPrevious(state);
    }
  }

  /// Remove a line item from the cart.
  Future<void> removeItem(String lineItemId) async {
    final cart = state.valueOrNull;
    if (cart == null) return;
    state = const AsyncLoading<Cart?>().copyWithPrevious(state);
    try {
      state = AsyncData(await _repo.removeLineItem(cart.id, lineItemId));
    } catch (e, st) {
      state = AsyncError<Cart?>(e, st).copyWithPrevious(state);
    }
  }

  /// Re-fetch the cart from the server. A stale cart id resets to an empty
  /// cart; a transient failure lands as AsyncError so the screen can retry.
  Future<void> refresh() async {
    final id = state.valueOrNull?.id ?? await _store.readCartId();
    if (id == null) {
      state = const AsyncData(null);
      return;
    }
    state = const AsyncLoading<Cart?>().copyWithPrevious(state);
    try {
      state = AsyncData(await _repo.retrieve(id));
    } catch (e, st) {
      if (_isStale(e)) {
        await _store.clear();
        state = const AsyncData(null);
      } else {
        state = AsyncError<Cart?>(e, st).copyWithPrevious(state);
      }
    }
  }
}

/// The cart controller — the exact surface the PDP add-to-cart and the cart
/// screen depend on: addVariant / updateItem / removeItem / refresh.
final cartControllerProvider =
    AsyncNotifierProvider<CartController, Cart?>(CartController.new);
