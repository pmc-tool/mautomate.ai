import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:mautomate_shopper/core/api/api_error.dart";
import "package:mautomate_shopper/core/api/tenant_config.dart";
import "package:mautomate_shopper/features/auth/auth_controller.dart";
import "package:mautomate_shopper/features/auth/auth_store.dart";
import "package:mautomate_shopper/features/cart/cart_controller.dart";
import "package:mautomate_shopper/features/cart/cart_models.dart";
import "package:mautomate_shopper/features/cart/cart_store.dart";
import "package:mautomate_shopper/features/checkout/checkout_controller.dart";
import "package:mautomate_shopper/features/checkout/checkout_models.dart";
import "package:mautomate_shopper/features/checkout/checkout_repository.dart";

/// A canned cart with a single $10 line, echoed by the fake repo's writes.
Cart _cart(String id, {num total = 1000}) => Cart(
      id: id,
      currencyCode: "usd",
      items: [
        const CartLineItem(
          id: "li_1",
          title: "Watch",
          variantId: "var_1",
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
          createdAt: "2026-01-01",
        ),
      ],
      subtotal: 1000,
      total: total,
    );

/// In-memory checkout repository — records the sequence and can be told to fail
/// at completion to exercise the error path.
class FakeCheckoutRepository implements CheckoutRepository {
  final List<String> calls = [];
  bool failComplete = false;

  @override
  Future<Cart> setEmail(String cartId, String email, {String? token}) async {
    calls.add("setEmail");
    return _cart(cartId);
  }

  @override
  Future<Cart> setAddresses(
    String cartId, {
    required AddressInput shipping,
    required AddressInput billing,
    String? email,
    String? token,
  }) async {
    calls.add("setAddresses");
    return _cart(cartId);
  }

  @override
  Future<List<ShippingOption>> listShippingOptions(String cartId) async {
    calls.add("listShippingOptions");
    return const [
      ShippingOption(id: "so_1", name: "Free Delivery", amount: 0),
      ShippingOption(id: "so_2", name: "Express", amount: 500),
    ];
  }

  @override
  Future<Cart> setShippingMethod(String cartId, String optionId) async {
    calls.add("setShippingMethod:$optionId");
    // Express adds 500 to the total.
    return _cart(cartId, total: optionId == "so_2" ? 1500 : 1000);
  }

  @override
  Future<List<PaymentProvider>> listPaymentProviders(String regionId) async {
    calls.add("listPaymentProviders");
    return const [PaymentProvider(id: "pp_system_default")];
  }

  @override
  Future<String> createPaymentCollection(String cartId) async {
    calls.add("createPaymentCollection");
    return "pay_col_1";
  }

  @override
  Future<void> initPaymentSession(
    String paymentCollectionId,
    String providerId,
  ) async {
    calls.add("initPaymentSession:$providerId");
  }

  @override
  Future<CheckoutOrder> complete(String cartId) async {
    calls.add("complete");
    if (failComplete) {
      throw ApiError("Cannot complete a cart with no items", 400, "invalid_data");
    }
    return const CheckoutOrder(
      id: "order_1",
      displayId: 15,
      email: "buyer@example.com",
      total: 1000,
      currencyCode: "usd",
      itemCount: 1,
    );
  }

  @override
  Future<List<Country>> listCountries(String regionId) async {
    calls.add("listCountries");
    return const [
      Country(iso2: "bd", displayName: "Bangladesh"),
      Country(iso2: "us", displayName: "United States"),
    ];
  }
}

/// A cart controller that yields a fixed cart without any network.
class FakeCartController extends CartController {
  @override
  Future<Cart?> build() async => _cart("cart_1");
}

/// Records whether the persisted cart id was cleared after a placed order.
class FakeCartStore implements CartStore {
  String? id = "cart_1";
  bool cleared = false;
  @override
  Future<String?> readCartId() async => id;
  @override
  Future<void> writeCartId(String value) async => id = value;
  @override
  Future<void> clear() async {
    cleared = true;
    id = null;
  }
}

/// A guest auth store (no token) so checkout runs the guest path.
class FakeAuthStore implements AuthStore {
  @override
  Future<String?> readToken() async => null;
  @override
  Future<void> writeToken(String token) async {}
  @override
  Future<void> deleteToken() async {}
}

Future<void> _settle() async {
  for (var i = 0; i < 6; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

ProviderContainer _container(FakeCheckoutRepository repo, FakeCartStore store) {
  final container = ProviderContainer(
    overrides: [
      checkoutRepositoryProvider.overrideWithValue(repo),
      cartControllerProvider.overrideWith(FakeCartController.new),
      cartStoreProvider.overrideWithValue(store),
      authStoreProvider.overrideWithValue(FakeAuthStore()),
      tenantConfigProvider
          .overrideWith((ref) => const TenantConfig(regionId: "reg_test")),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

const _address = AddressInput(
  firstName: "Test",
  lastName: "Buyer",
  address1: "1 Main St",
  city: "Dhaka",
  postalCode: "1000",
  countryCode: "bd",
);

void main() {
  test("happy path: information -> delivery -> payment -> order placed",
      () async {
    final repo = FakeCheckoutRepository();
    final store = FakeCartStore();
    final container = _container(repo, store);

    // Resolve the (fake) cart, then keep the checkout controller alive.
    await container.read(cartControllerProvider.future);
    await container.read(authControllerProvider.future);
    final sub = container.listen(checkoutControllerProvider, (_, __) {});
    addTearDown(sub.close);
    final ctrl = container.read(checkoutControllerProvider.notifier);
    await _settle();

    // Bootstrap loaded region-scoped data + a sensible default provider.
    var state = container.read(checkoutControllerProvider);
    expect(state.regionId, "reg_test");
    expect(state.countries, isNotEmpty);
    expect(state.providers, isNotEmpty);
    expect(state.selectedProviderId, "pp_system_default",
        reason: "a manual provider is chosen by default");
    expect(state.cartId, "cart_1");

    // Step 1 — information.
    ctrl.setEmail("buyer@example.com");
    ctrl.updateShipping(_address.copyWith(countryCode: "bd"));
    expect(container.read(checkoutControllerProvider).informationValid, true);

    await ctrl.submitInformation();
    state = container.read(checkoutControllerProvider);
    expect(state.step, CheckoutStep.delivery);
    expect(state.shippingOptions.length, 2);
    expect(state.selectedShippingOptionId, "so_1",
        reason: "first option is selected by default");
    expect(state.error, isNull);

    // Step 2 — delivery (choose express).
    ctrl.selectShippingOption("so_2");
    await ctrl.confirmDelivery();
    state = container.read(checkoutControllerProvider);
    expect(state.step, CheckoutStep.payment);
    expect(state.cart?.total, 1500, reason: "express recalculated the total");

    // Step 3 — payment -> place order.
    await ctrl.placeOrder();
    state = container.read(checkoutControllerProvider);
    expect(state.order, isNotNull);
    expect(state.order!.reference, "#15");
    expect(state.busy, false);
    expect(store.cleared, true, reason: "persisted cart id is forgotten");

    // The full endpoint sequence ran in order.
    expect(
      repo.calls,
      containsAllInOrder(<String>[
        "setEmail",
        "setAddresses",
        "listShippingOptions",
        "setShippingMethod:so_2",
        "createPaymentCollection",
        "initPaymentSession:pp_system_default",
        "complete",
      ]),
    );
  });

  test("complete failure surfaces an error and does not place an order",
      () async {
    final repo = FakeCheckoutRepository()..failComplete = true;
    final store = FakeCartStore();
    final container = _container(repo, store);

    await container.read(cartControllerProvider.future);
    await container.read(authControllerProvider.future);
    final sub = container.listen(checkoutControllerProvider, (_, __) {});
    addTearDown(sub.close);
    final ctrl = container.read(checkoutControllerProvider.notifier);
    await _settle();

    ctrl.setEmail("buyer@example.com");
    ctrl.updateShipping(_address.copyWith(countryCode: "bd"));
    await ctrl.submitInformation();
    await ctrl.confirmDelivery();
    await ctrl.placeOrder();

    final state = container.read(checkoutControllerProvider);
    expect(state.order, isNull);
    expect(state.busy, false);
    expect(state.error, "Cannot complete a cart with no items");
    expect(store.cleared, false, reason: "a failed order keeps the cart");
  });

  test("information is invalid until email + complete address are present",
      () async {
    final repo = FakeCheckoutRepository();
    final store = FakeCartStore();
    final container = _container(repo, store);

    await container.read(cartControllerProvider.future);
    await container.read(authControllerProvider.future);
    final sub = container.listen(checkoutControllerProvider, (_, __) {});
    addTearDown(sub.close);
    final ctrl = container.read(checkoutControllerProvider.notifier);
    await _settle();

    expect(container.read(checkoutControllerProvider).informationValid, false);
    ctrl.setEmail("not-an-email");
    ctrl.updateShipping(_address);
    expect(container.read(checkoutControllerProvider).informationValid, false,
        reason: "email is malformed");
    ctrl.setEmail("ok@example.com");
    expect(container.read(checkoutControllerProvider).informationValid, true);
  });
}
