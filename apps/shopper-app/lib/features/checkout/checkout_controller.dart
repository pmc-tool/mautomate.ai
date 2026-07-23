import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/api_error.dart";
import "../../core/api/tenant_config.dart";
import "../auth/auth_controller.dart";
import "../auth/auth_store.dart";
import "../cart/cart_controller.dart";
import "../cart/cart_models.dart";
import "../cart/cart_store.dart";
import "checkout_models.dart";
import "checkout_repository.dart";

/// The three ordered steps of the checkout flow.
enum CheckoutStep { information, delivery, payment }

/// The complete, immutable checkout state the screen renders.
///
/// One object holds everything: which [step] we're on, the buyer [email] and
/// [shipping]/[billing] addresses, the loaded [countries]/[shippingOptions]/
/// [providers] and the current selections, the latest [cart] (for live
/// totals), transient [busy]/[error] for the in-flight action, and — once the
/// order is placed — the resulting [order]. Every field is copy-on-write so the
/// Notifier never mutates in place.
class CheckoutState {
  const CheckoutState({
    this.step = CheckoutStep.information,
    this.cartId,
    this.regionId,
    this.currencyCode,
    this.email = "",
    this.shipping = const AddressInput(),
    this.billing = const AddressInput(),
    this.billingSameAsShipping = true,
    this.countries = const [],
    this.loadingCountries = false,
    this.shippingOptions = const [],
    this.loadingShippingOptions = false,
    this.selectedShippingOptionId,
    this.providers = const [],
    this.loadingProviders = false,
    this.selectedProviderId,
    this.cart,
    this.busy = false,
    this.error,
    this.order,
  });

  final CheckoutStep step;
  final String? cartId;
  final String? regionId;
  final String? currencyCode;

  final String email;
  final AddressInput shipping;
  final AddressInput billing;
  final bool billingSameAsShipping;

  final List<Country> countries;
  final bool loadingCountries;

  final List<ShippingOption> shippingOptions;
  final bool loadingShippingOptions;
  final String? selectedShippingOptionId;

  final List<PaymentProvider> providers;
  final bool loadingProviders;
  final String? selectedProviderId;

  /// The latest cart snapshot (updated as addresses/shipping recalculate it).
  final Cart? cart;

  /// True while a step's network action is in flight.
  final bool busy;

  /// The last action's error, surfaced inline on the current step.
  final String? error;

  /// Set once the order is placed — the screen then shows the confirmation.
  final CheckoutOrder? order;

  bool get hasCart => (cartId ?? "").isNotEmpty;

  PaymentProvider? get selectedProvider {
    for (final p in providers) {
      if (p.id == selectedProviderId) return p;
    }
    return null;
  }

  ShippingOption? get selectedShippingOption {
    for (final o in shippingOptions) {
      if (o.id == selectedShippingOptionId) return o;
    }
    return null;
  }

  /// Information step is valid once we have an email + a complete address.
  bool get informationValid {
    final emailOk = RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").hasMatch(email.trim());
    final billingOk = billingSameAsShipping || billing.isComplete;
    return emailOk && shipping.isComplete && billingOk;
  }

  bool get deliveryValid => selectedShippingOptionId != null;
  bool get paymentValid => selectedProviderId != null;

  CheckoutState copyWith({
    CheckoutStep? step,
    String? cartId,
    String? regionId,
    String? currencyCode,
    String? email,
    AddressInput? shipping,
    AddressInput? billing,
    bool? billingSameAsShipping,
    List<Country>? countries,
    bool? loadingCountries,
    List<ShippingOption>? shippingOptions,
    bool? loadingShippingOptions,
    Object? selectedShippingOptionId = _sentinel,
    List<PaymentProvider>? providers,
    bool? loadingProviders,
    Object? selectedProviderId = _sentinel,
    Cart? cart,
    bool? busy,
    Object? error = _sentinel,
    CheckoutOrder? order,
  }) {
    return CheckoutState(
      step: step ?? this.step,
      cartId: cartId ?? this.cartId,
      regionId: regionId ?? this.regionId,
      currencyCode: currencyCode ?? this.currencyCode,
      email: email ?? this.email,
      shipping: shipping ?? this.shipping,
      billing: billing ?? this.billing,
      billingSameAsShipping:
          billingSameAsShipping ?? this.billingSameAsShipping,
      countries: countries ?? this.countries,
      loadingCountries: loadingCountries ?? this.loadingCountries,
      shippingOptions: shippingOptions ?? this.shippingOptions,
      loadingShippingOptions:
          loadingShippingOptions ?? this.loadingShippingOptions,
      selectedShippingOptionId: selectedShippingOptionId == _sentinel
          ? this.selectedShippingOptionId
          : selectedShippingOptionId as String?,
      providers: providers ?? this.providers,
      loadingProviders: loadingProviders ?? this.loadingProviders,
      selectedProviderId: selectedProviderId == _sentinel
          ? this.selectedProviderId
          : selectedProviderId as String?,
      cart: cart ?? this.cart,
      busy: busy ?? this.busy,
      error: error == _sentinel ? this.error : error as String?,
      order: order ?? this.order,
    );
  }

  static const Object _sentinel = Object();
}

/// Drives the multi-step checkout. Reads the live cart (id + totals) and the
/// signed-in customer (to prefill + associate the order), loads the region's
/// countries and payment providers, and walks the shopper through
/// information -> delivery -> payment -> placed.
///
/// Robust by contract: every network call is wrapped so a failure lands in
/// [CheckoutState.error] (and clears [busy]); it never throws out to the widget
/// tree. On a successful completion it forgets the persisted cart id and
/// invalidates the cart controller, so a fresh empty cart starts next time.
class CheckoutController extends AutoDisposeNotifier<CheckoutState> {
  CheckoutRepository get _repo => ref.read(checkoutRepositoryProvider);

  @override
  CheckoutState build() {
    final cart = ref.read(cartControllerProvider).valueOrNull;
    final customer = ref.read(authControllerProvider).valueOrNull;

    var shipping = const AddressInput();
    if (customer != null) {
      shipping = shipping.copyWith(
        firstName: customer.firstName ?? "",
        lastName: customer.lastName ?? "",
      );
    }

    final initial = CheckoutState(
      cartId: cart?.id,
      currencyCode: cart?.currencyCode,
      email: customer?.email ?? "",
      shipping: shipping,
      cart: cart,
    );

    // Kick off async bootstrapping (region, countries, providers) without
    // blocking the first frame.
    Future.microtask(_bootstrap);
    return initial;
  }

  Future<String?> _token() async {
    try {
      return await ref.read(authStoreProvider).readToken();
    } catch (_) {
      return null;
    }
  }

  Future<void> _bootstrap() async {
    String? regionId;
    try {
      final cfg = await ref.read(tenantConfigProvider.future);
      regionId = cfg.regionId;
      state = state.copyWith(
        regionId: regionId,
        currencyCode: state.currencyCode ?? cfg.currencyCode,
      );
    } catch (_) {
      // Region stays null; countries/providers loads below will no-op safely.
    }
    await Future.wait([loadCountries(), loadProviders()]);
  }

  /// Load the region's shipping countries for the address picker.
  Future<void> loadCountries() async {
    final regionId = state.regionId;
    if (regionId == null || regionId.isEmpty) return;
    state = state.copyWith(loadingCountries: true);
    try {
      final countries = await _repo.listCountries(regionId);
      // Default the country to the region's first when the shopper has none.
      final selected = state.shipping.countryCode.isEmpty && countries.isNotEmpty
          ? countries.first.iso2
          : state.shipping.countryCode;
      state = state.copyWith(
        countries: countries,
        loadingCountries: false,
        shipping: state.shipping.copyWith(countryCode: selected),
      );
    } catch (_) {
      state = state.copyWith(loadingCountries: false);
    }
  }

  /// Load the region's payment providers.
  Future<void> loadProviders() async {
    final regionId = state.regionId;
    if (regionId == null || regionId.isEmpty) return;
    state = state.copyWith(loadingProviders: true);
    try {
      final providers = await _repo.listPaymentProviders(regionId);
      // Prefer a manual/COD provider by default so the order can be placed
      // without card entry.
      String? selected = state.selectedProviderId;
      if (selected == null && providers.isNotEmpty) {
        final manual = providers.where((p) => p.canCompleteWithoutCard);
        selected = manual.isNotEmpty ? manual.first.id : providers.first.id;
      }
      state = state.copyWith(
        providers: providers,
        loadingProviders: false,
        selectedProviderId: selected,
      );
    } catch (_) {
      state = state.copyWith(loadingProviders: false);
    }
  }

  // --- Form mutations (information step) --------------------------------

  void setEmail(String value) =>
      state = state.copyWith(email: value, error: null);

  void updateShipping(AddressInput address) =>
      state = state.copyWith(shipping: address, error: null);

  void updateBilling(AddressInput address) =>
      state = state.copyWith(billing: address, error: null);

  void setBillingSameAsShipping(bool value) =>
      state = state.copyWith(billingSameAsShipping: value, error: null);

  void selectShippingOption(String optionId) =>
      state = state.copyWith(selectedShippingOptionId: optionId, error: null);

  void selectProvider(String providerId) =>
      state = state.copyWith(selectedProviderId: providerId, error: null);

  /// Step back to the previous step (clears any inline error).
  void back() {
    switch (state.step) {
      case CheckoutStep.delivery:
        state = state.copyWith(step: CheckoutStep.information, error: null);
      case CheckoutStep.payment:
        state = state.copyWith(step: CheckoutStep.delivery, error: null);
      case CheckoutStep.information:
        break;
    }
  }

  /// Submit the information step: persist email + addresses, then load the
  /// delivery options and advance. Guards on a resolvable cart.
  Future<void> submitInformation() async {
    if (!state.hasCart) {
      state = state.copyWith(error: "Your cart is no longer available.");
      return;
    }
    if (!state.informationValid) {
      state = state.copyWith(
        error: "Please complete your email and shipping address.",
      );
      return;
    }
    final cartId = state.cartId!;
    final billing =
        state.billingSameAsShipping ? state.shipping : state.billing;

    state = state.copyWith(busy: true, error: null);
    try {
      final token = await _token();
      await _repo.setEmail(cartId, state.email, token: token);
      final cart = await _repo.setAddresses(
        cartId,
        shipping: state.shipping,
        billing: billing,
        email: state.email,
        token: token,
      );
      final options = await _repo.listShippingOptions(cartId);
      // Keep a valid selection: preserve the current one if still offered,
      // else default to the first option.
      String? selected = state.selectedShippingOptionId;
      if (selected == null || !options.any((o) => o.id == selected)) {
        selected = options.isNotEmpty ? options.first.id : null;
      }
      state = state.copyWith(
        cart: cart,
        shippingOptions: options,
        selectedShippingOptionId: selected,
        step: CheckoutStep.delivery,
        busy: false,
      );
    } catch (e) {
      state = state.copyWith(busy: false, error: ApiError.from(e).message);
    }
  }

  /// Confirm the chosen delivery option: attach it (recalculating the cart),
  /// ensure payment providers are loaded, and advance to payment.
  Future<void> confirmDelivery() async {
    final optionId = state.selectedShippingOptionId;
    if (optionId == null) {
      state = state.copyWith(error: "Choose a delivery option to continue.");
      return;
    }
    state = state.copyWith(busy: true, error: null);
    try {
      final cart = await _repo.setShippingMethod(state.cartId!, optionId);
      state = state.copyWith(cart: cart, busy: false, step: CheckoutStep.payment);
      if (state.providers.isEmpty && !state.loadingProviders) {
        await loadProviders();
      }
    } catch (e) {
      state = state.copyWith(busy: false, error: ApiError.from(e).message);
    }
  }

  /// Place the order: create a payment collection, initialise the session with
  /// the chosen provider, then complete the cart. On success the persisted cart
  /// is cleared so a fresh cart starts, and [CheckoutState.order] is set.
  Future<void> placeOrder() async {
    if (!state.paymentValid) {
      state = state.copyWith(error: "Choose a payment method to continue.");
      return;
    }
    final cartId = state.cartId!;
    final providerId = state.selectedProviderId!;

    state = state.copyWith(busy: true, error: null);
    try {
      final pcId = await _repo.createPaymentCollection(cartId);
      await _repo.initPaymentSession(pcId, providerId);
      final order = await _repo.complete(cartId);

      // Forget the completed cart and reset the cart controller to empty.
      try {
        await ref.read(cartStoreProvider).clear();
        ref.invalidate(cartControllerProvider);
      } catch (_) {
        // A reset hiccup must not fail a placed order.
      }

      state = state.copyWith(busy: false, order: order);
    } catch (e) {
      state = state.copyWith(busy: false, error: ApiError.from(e).message);
    }
  }
}

/// The checkout controller — auto-disposed so each checkout starts fresh when
/// the screen is opened (and is torn down when it is popped).
final checkoutControllerProvider =
    AutoDisposeNotifierProvider<CheckoutController, CheckoutState>(
  CheckoutController.new,
);
