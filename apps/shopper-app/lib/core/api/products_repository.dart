import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "dio_client.dart";
import "store_product.dart";

/// Read access to the store catalog via Medusa `/store/products`.
///
/// The data-bound blocks (`product_tabs`, `category_showcase`, `deal_of_day`)
/// resolve their id bindings through [list] (via `CatalogBindingService`). The
/// publishable-key + tenant headers are attached by [storeDioProvider], so
/// every call is already scoped to the bound store's sales channel. Pass
/// [regionId] (from `tenantConfigProvider`) so variant prices resolve.
class ProductsRepository {
  ProductsRepository(this._dio);

  final Dio _dio;

  static const String _cardFields =
      "id,title,handle,thumbnail,*variants.calculated_price";

  /// Fetch products with optional filters. Mirrors Medusa's query params:
  /// `limit`, `offset`, `q`, `region_id`, `order`, `category_id[]`,
  /// `collection_id[]`, `id[]`.
  Future<List<StoreProduct>> list({
    int limit = 12,
    int offset = 0,
    String? query,
    String? regionId,
    List<String>? categoryIds,
    List<String>? collectionIds,
    List<String>? productIds,
    String? order,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/products",
      queryParameters: {
        "limit": limit,
        "offset": offset,
        "fields": _cardFields,
        if (regionId != null && regionId.isNotEmpty) "region_id": regionId,
        if (query != null && query.isNotEmpty) "q": query,
        if (order != null && order.isNotEmpty) "order": order,
        if (categoryIds != null && categoryIds.isNotEmpty)
          "category_id[]": categoryIds,
        if (collectionIds != null && collectionIds.isNotEmpty)
          "collection_id[]": collectionIds,
        if (productIds != null && productIds.isNotEmpty) "id[]": productIds,
      },
    );

    final data = res.data ?? const {};
    final raw = data["products"];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((m) => StoreProduct.fromJson(m.cast<String, dynamic>()))
        .toList(growable: false);
  }

  /// The total product count for a filter (Medusa returns `count` on the list
  /// envelope). Used by `category_showcase` tiles to show a live "N items"
  /// label. Returns null on any failure so the tile degrades to no count.
  Future<int?> count({
    List<String>? categoryIds,
    List<String>? collectionIds,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        "/store/products",
        queryParameters: {
          "limit": 1,
          "fields": "id",
          if (categoryIds != null && categoryIds.isNotEmpty)
            "category_id[]": categoryIds,
          if (collectionIds != null && collectionIds.isNotEmpty)
            "collection_id[]": collectionIds,
        },
      );
      final c = res.data?["count"];
      return c is num ? c.toInt() : null;
    } catch (_) {
      return null;
    }
  }
}

/// The store products repository, wired to the store Dio client.
final productsRepositoryProvider = Provider<ProductsRepository>(
  (ref) => ProductsRepository(ref.watch(storeDioProvider)),
);
