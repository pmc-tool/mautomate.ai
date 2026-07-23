import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:mautomate_shopper/core/api/api_error.dart";
import "package:mautomate_shopper/core/api/tenant_config.dart";
import "package:mautomate_shopper/features/cart/cart_providers.dart";
import "package:mautomate_shopper/features/cart/cart_repository.dart";
import "package:mautomate_shopper/features/cart/cart_store.dart";

/// In-memory cart repository — the controller under test talks only to this.
class FakeCartRepository implements CartRepository {
  int _seq = 0;
  final Map<String, List<CartLineItem>> _carts = {};
  bool failNextRetrieve = false;

  num _sum(String id) =>
      (_carts[id] ?? []).fold<num>(0, (s, i) => s + (i.total ?? 0));

  Cart _build(String id) => Cart(
        id: id,
        currencyCode: "usd",
        items: List.of(_carts[id] ?? const []),
        subtotal: _sum(id),
        total: _sum(id),
      );

  @override
  Future<Cart> create({String? regionId}) async {
    final id = "cart_${_seq++}";
    _carts[id] = [];
    return _build(id);
  }

  @override
  Future<Cart> retrieve(String id) async {
    if (failNextRetrieve || !_carts.containsKey(id)) {
      throw ApiError("Cart not found", 404);
    }
    return _build(id);
  }

  @override
  Future<Cart> addLineItem(
    String cartId, {
    required String variantId,
    required int quantity,
  }) async {
    final items = _carts[cartId]!;
    items.add(CartLineItem(
      id: "li_${_seq++}",
      title: "Product",
      variantId: variantId,
      quantity: quantity,
      unitPrice: 10,
      total: 10 * quantity,
      createdAt: "2026-01-0${items.length + 1}",
    ));
    return _build(cartId);
  }

  @override
  Future<Cart> updateLineItem(
    String cartId,
    String lineItemId,
    int quantity,
  ) async {
    final items = _carts[cartId]!;
    final idx = items.indexWhere((i) => i.id == lineItemId);
    final old = items[idx];
    items[idx] = CartLineItem(
      id: old.id,
      title: old.title,
      variantId: old.variantId,
      quantity: quantity,
      unitPrice: old.unitPrice,
      total: (old.unitPrice ?? 0) * quantity,
      createdAt: old.createdAt,
    );
    return _build(cartId);
  }

  @override
  Future<Cart> removeLineItem(String cartId, String lineItemId) async {
    _carts[cartId]!.removeWhere((i) => i.id == lineItemId);
    return _build(cartId);
  }
}

/// In-memory cart-id store.
class FakeCartStore implements CartStore {
  String? id;
  @override
  Future<String?> readCartId() async => id;
  @override
  Future<void> writeCartId(String value) async => id = value;
  @override
  Future<void> clear() async => id = null;
}

ProviderContainer _container(
  FakeCartRepository repo,
  FakeCartStore store,
) {
  final container = ProviderContainer(
    overrides: [
      cartRepositoryProvider.overrideWithValue(repo),
      cartStoreProvider.overrideWithValue(store),
      tenantConfigProvider
          .overrideWith((ref) => const TenantConfig(regionId: "reg_test")),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test("addVariant lazily creates a cart, then increments the same variant",
      () async {
    final repo = FakeCartRepository();
    final store = FakeCartStore();
    final container = _container(repo, store);
    await container.read(cartControllerProvider.future);

    final ctrl = container.read(cartControllerProvider.notifier);

    await ctrl.addVariant("var_1");
    expect(container.read(cartControllerProvider).value!.itemCount, 1);
    expect(container.read(cartItemCountProvider), 1);
    // Cart id persisted for restart-survival.
    expect(await store.readCartId(), isNotNull);

    await ctrl.addVariant("var_1");
    final cart = container.read(cartControllerProvider).value!;
    expect(cart.items.length, 1, reason: "same variant merges into one line");
    expect(cart.itemCount, 2);
    expect(container.read(cartItemCountProvider), 2);
  });

  test("updateItem sets quantity and removeItem empties the cart", () async {
    final repo = FakeCartRepository();
    final store = FakeCartStore();
    final container = _container(repo, store);
    await container.read(cartControllerProvider.future);
    final ctrl = container.read(cartControllerProvider.notifier);

    await ctrl.addVariant("var_1");
    final lineId = container.read(cartControllerProvider).value!.items.first.id;

    await ctrl.updateItem(lineId, 5);
    expect(container.read(cartItemCountProvider), 5);

    await ctrl.removeItem(lineId);
    expect(container.read(cartControllerProvider).value!.isEmpty, true);
    expect(container.read(cartItemCountProvider), 0);
  });

  test("updateItem to zero removes the line", () async {
    final repo = FakeCartRepository();
    final store = FakeCartStore();
    final container = _container(repo, store);
    await container.read(cartControllerProvider.future);
    final ctrl = container.read(cartControllerProvider.notifier);

    await ctrl.addVariant("var_1");
    final lineId = container.read(cartControllerProvider).value!.items.first.id;
    await ctrl.updateItem(lineId, 0);
    expect(container.read(cartControllerProvider).value!.isEmpty, true);
  });

  test("a stale persisted cart id is cleared and presents as an empty cart",
      () async {
    final repo = FakeCartRepository();
    final store = FakeCartStore()..id = "cart_gone";
    final container = _container(repo, store);

    final cart = await container.read(cartControllerProvider.future);
    expect(cart, isNull);
    expect(await store.readCartId(), isNull, reason: "stale id forgotten");
  });

  test("refresh re-reads the cart from the repository", () async {
    final repo = FakeCartRepository();
    final store = FakeCartStore();
    final container = _container(repo, store);
    await container.read(cartControllerProvider.future);
    final ctrl = container.read(cartControllerProvider.notifier);

    await ctrl.addVariant("var_1");
    await ctrl.refresh();
    expect(container.read(cartControllerProvider).value!.itemCount, 1);
  });
}
