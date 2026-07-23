import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/api_error.dart";
import "../../core/api/dio_client.dart";
import "cart_models.dart";

/// Read/write access to the shopper cart via Medusa /store/carts.
///
/// The publishable-key header (attached by [storeDioProvider]) scopes the cart
/// to the store sales channel, so the app never sends a sales-channel id — it
/// only pins the region_id (from tenantConfigProvider) so prices resolve.
///
/// Kept a plain class (non-final methods) so tests can supply a fake via
/// implements CartRepository and override [cartRepositoryProvider].
class CartRepository {
  CartRepository(this._dio);

  final Dio _dio;

  /// Fields worth pulling so line items carry titles/thumbnail/prices and the
  /// cart carries totals in one round-trip.
  static const String _fields =
      "id,currency_code,region_id,item_subtotal,subtotal,total,item_total,"
      "*items,items.id,items.title,items.quantity,items.unit_price,items.total,"
      "items.subtotal,items.thumbnail,items.product_title,items.variant_title,"
      "items.variant_id,items.product_id,items.created_at";

  Map<String, dynamic> get _fieldsQuery => {"fields": _fields};

  /// Unwrap the cart from a Medusa response. Create/get/update return a cart
  /// envelope; deleting a line item returns a parent envelope (updated cart).
  Cart _parse(Map<String, dynamic>? body) {
    final raw = body?["cart"] ?? body?["parent"];
    if (raw is Map) return Cart.fromJson(raw.cast<String, dynamic>());
    throw ApiError("The cart response was malformed.", 0, "bad_shape");
  }

  /// Create a new cart scoped to the store (region pins the currency).
  Future<Cart> create({String? regionId}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts",
      queryParameters: _fieldsQuery,
      data: {
        if (regionId != null && regionId.isNotEmpty) "region_id": regionId,
      },
    );
    return _parse(res.data);
  }

  /// Fetch an existing cart by id. Throws an [ApiError] (404) when the id is
  /// stale/expired — the controller catches that and starts a fresh cart.
  Future<Cart> retrieve(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/carts/$id",
      queryParameters: _fieldsQuery,
    );
    return _parse(res.data);
  }

  /// Add a variant to the cart (Medusa returns the whole updated cart).
  Future<Cart> addLineItem(
    String cartId, {
    required String variantId,
    required int quantity,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts/$cartId/line-items",
      queryParameters: _fieldsQuery,
      data: {"variant_id": variantId, "quantity": quantity},
    );
    return _parse(res.data);
  }

  /// Set a line item quantity.
  Future<Cart> updateLineItem(
    String cartId,
    String lineItemId,
    int quantity,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/store/carts/$cartId/line-items/$lineItemId",
      queryParameters: _fieldsQuery,
      data: {"quantity": quantity},
    );
    return _parse(res.data);
  }

  /// Remove a line item (delete returns a parent envelope, the updated cart).
  Future<Cart> removeLineItem(String cartId, String lineItemId) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      "/store/carts/$cartId/line-items/$lineItemId",
      queryParameters: _fieldsQuery,
    );
    return _parse(res.data);
  }
}

/// The store cart repository, wired to the store Dio client.
final cartRepositoryProvider = Provider<CartRepository>(
  (ref) => CartRepository(ref.watch(storeDioProvider)),
);
