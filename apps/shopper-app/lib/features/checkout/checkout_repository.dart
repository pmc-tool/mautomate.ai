import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/api_error.dart";
import "../../core/api/dio_client.dart";
import "../cart/cart_models.dart";
import "checkout_models.dart";

/// Wraps the Medusa v2 store checkout sequence in one narrow, testable surface.
///
/// The order of operations (verified against a live store):
///  1. `POST /store/carts/:id`            → set `email`
///  2. `POST /store/carts/:id`            → set `shipping_address` + `billing_address`
///  3. `GET  /store/shipping-options?cart_id=:id`   → list, choose one
///  4. `POST /store/carts/:id/shipping-methods`     → `{ option_id }`
///  5. `GET  /store/payment-providers?region_id=`   → available providers
///  6. `POST /store/payment-collections`            → `{ cart_id }`
///  7. `POST /store/payment-collections/:id/payment-sessions` → `{ provider_id }`
///  8. `POST /store/carts/:id/complete`             → `{ type:"order", order }`
///
/// The publishable-key header (attached by [storeDioProvider]) scopes every
/// call to the store's sales channel. An optional customer bearer [token] is
/// forwarded on the cart writes so a signed-in shopper's order is associated
/// with their account; guests simply omit it.
///
/// Kept a plain class (non-final methods) so tests can supply a fake via
/// `implements CheckoutRepository` and override [checkoutRepositoryProvider].
class CheckoutRepository {
  CheckoutRepository(this._dio);

  final Dio _dio;

  /// Cart fields worth pulling so the order summary has live totals.
  static const String _cartFields =
      "id,currency_code,region_id,email,item_subtotal,subtotal,item_total,"
      "shipping_total,tax_total,total,"
      "*items,items.id,items.title,items.quantity,items.unit_price,items.total,"
      "items.thumbnail,items.product_title,items.variant_title,items.variant_id,"
      "items.created_at";

  Options? _bearer(String? token) => (token != null && token.isNotEmpty)
      ? Options(headers: {"Authorization": "Bearer $token"})
      : null;

  Cart _parseCart(Map<String, dynamic>? body) {
    final raw = body?["cart"] ?? body?["parent"];
    if (raw is Map) return Cart.fromJson(raw.cast<String, dynamic>());
    throw ApiError("The cart response was malformed.", 0, "bad_shape");
  }

  /// Step 1: set the buyer email on the cart (guest or signed-in).
  Future<Cart> setEmail(String cartId, String email, {String? token}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts/$cartId",
      queryParameters: {"fields": _cartFields},
      data: {"email": email.trim()},
      options: _bearer(token),
    );
    return _parseCart(res.data);
  }

  /// Step 2: set shipping + billing address (country within the region).
  Future<Cart> setAddresses(
    String cartId, {
    required AddressInput shipping,
    required AddressInput billing,
    String? email,
    String? token,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts/$cartId",
      queryParameters: {"fields": _cartFields},
      data: {
        if (email != null && email.trim().isNotEmpty) "email": email.trim(),
        "shipping_address": shipping.toJson(),
        "billing_address": billing.toJson(),
      },
      options: _bearer(token),
    );
    return _parseCart(res.data);
  }

  /// Step 3: list the delivery options available for the cart.
  Future<List<ShippingOption>> listShippingOptions(String cartId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/shipping-options",
      queryParameters: {"cart_id": cartId},
    );
    final raw = res.data?["shipping_options"];
    final out = <ShippingOption>[];
    if (raw is List) {
      for (final o in raw) {
        if (o is Map) out.add(ShippingOption.fromJson(o.cast<String, dynamic>()));
      }
    }
    return out;
  }

  /// Step 4: choose a delivery option; returns the recalculated cart.
  Future<Cart> setShippingMethod(String cartId, String optionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts/$cartId/shipping-methods",
      queryParameters: {"fields": _cartFields},
      data: {"option_id": optionId},
    );
    return _parseCart(res.data);
  }

  /// Step 5: the payment providers configured for the store's region.
  Future<List<PaymentProvider>> listPaymentProviders(String regionId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/payment-providers",
      queryParameters: {"region_id": regionId},
    );
    final raw = res.data?["payment_providers"];
    final out = <PaymentProvider>[];
    if (raw is List) {
      for (final p in raw) {
        if (p is Map) out.add(PaymentProvider.fromJson(p.cast<String, dynamic>()));
      }
    }
    return out;
  }

  /// Step 6: create (or reuse) a payment collection for the cart.
  Future<String> createPaymentCollection(String cartId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/payment-collections",
      data: {"cart_id": cartId},
    );
    final raw = res.data?["payment_collection"];
    if (raw is Map && raw["id"] is String) return raw["id"] as String;
    throw ApiError("Could not start payment.", 0, "bad_shape");
  }

  /// Step 7: initialise a payment session with the chosen provider.
  Future<void> initPaymentSession(
    String paymentCollectionId,
    String providerId,
  ) async {
    await _dio.post<Map<String, dynamic>>(
      "/store/payment-collections/$paymentCollectionId/payment-sessions",
      data: {"provider_id": providerId},
    );
  }

  /// Step 8: complete the cart. On success Medusa returns
  /// `{ type:"order", order }`; a business failure comes back as a non-order
  /// envelope (or a 4xx the Dio layer maps to an [ApiError]) — either way the
  /// caller gets a thrown [ApiError] it can surface without crashing.
  Future<CheckoutOrder> complete(String cartId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts/$cartId/complete",
      data: const <String, dynamic>{},
    );
    final body = res.data;
    if (body != null && body["type"] == "order" && body["order"] is Map) {
      return CheckoutOrder.fromJson(
        (body["order"] as Map).cast<String, dynamic>(),
      );
    }
    // A 200 that is NOT an order carries the reason on the cart error envelope.
    String message = "We couldn't place your order. Please review your details.";
    final err = body?["error"];
    if (err is Map && err["message"] is String) {
      message = err["message"] as String;
    } else if (body?["message"] is String) {
      message = body!["message"] as String;
    }
    throw ApiError(message, 0, "checkout_incomplete");
  }

  /// The region's allowed shipping countries, for the address country picker.
  Future<List<Country>> listCountries(String regionId) async {
    final res = await _dio.get<Map<String, dynamic>>("/store/regions/$regionId");
    final region = res.data?["region"];
    final out = <Country>[];
    if (region is Map && region["countries"] is List) {
      for (final c in (region["countries"] as List)) {
        if (c is Map) {
          final country = Country.fromJson(c.cast<String, dynamic>());
          if (country.iso2.isNotEmpty) out.add(country);
        }
      }
    }
    out.sort((a, b) => a.displayName.compareTo(b.displayName));
    return out;
  }
}

/// The checkout repository, wired to the store Dio client.
final checkoutRepositoryProvider = Provider<CheckoutRepository>(
  (ref) => CheckoutRepository(ref.watch(storeDioProvider)),
);
