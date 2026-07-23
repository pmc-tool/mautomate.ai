import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/dio_client.dart";
import "../../core/api/tenant_config.dart";
import "../chrome/categories_repository.dart";
import "product_detail.dart";

/// Fetches a single product's full detail by handle, and single categories.
///
/// Uses the store Dio directly (publishable-key + tenant headers already
/// attached) so it stays isolated from the shared [ProductsRepository] list
/// paths. Prices need the store's `region_id`, resolved from
/// [tenantConfigProvider].
class ProductDetailRepository {
  ProductDetailRepository(this._dio);

  final Dio _dio;

  static const String _fields =
      "*variants.calculated_price,*variants.options,*images,*options,"
      "+variants.inventory_quantity,+variants.manage_inventory,"
      "+variants.allow_backorder";

  /// Fetch by handle. Returns null when no product matches.
  Future<ProductDetail?> fetchByHandle(
    String handle, {
    String? regionId,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/store/products",
      queryParameters: {
        "handle": handle,
        "limit": 1,
        "fields": _fields,
        if (regionId != null && regionId.isNotEmpty) "region_id": regionId,
      },
    );
    final list = res.data?["products"];
    if (list is! List || list.isEmpty) return null;
    final first = list.first;
    if (first is! Map) return null;
    return ProductDetail.fromJson(first.cast<String, dynamic>());
  }

  /// Fetch a single category (for the category screen title). Null on failure.
  Future<StoreCategory?> fetchCategory(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        "/store/product-categories/$id",
        queryParameters: {"fields": "id,name,handle"},
      );
      final cat = res.data?["product_category"];
      if (cat is! Map) return null;
      return StoreCategory.fromJson(cat.cast<String, dynamic>());
    } catch (_) {
      return null;
    }
  }
}

final productDetailRepositoryProvider = Provider<ProductDetailRepository>(
  (ref) => ProductDetailRepository(ref.watch(storeDioProvider)),
);

/// The full detail for a product handle, priced in the store's region.
final productDetailProvider =
    FutureProvider.autoDispose.family<ProductDetail?, String>((ref, handle) async {
  final config = await ref.watch(tenantConfigProvider.future);
  return ref
      .watch(productDetailRepositoryProvider)
      .fetchByHandle(handle, regionId: config.regionId);
});

/// A single category by id (for the category screen title). Null when missing.
final singleCategoryProvider =
    FutureProvider.autoDispose.family<StoreCategory?, String>((ref, id) async {
  return ref.watch(productDetailRepositoryProvider).fetchCategory(id);
});
