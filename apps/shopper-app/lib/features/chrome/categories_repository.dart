import "package:dio/dio.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/dio_client.dart";

/// A lean top-level store category, used to expand the header
/// `__dynamic_categories__` menu sentinel into live links.
///
/// WAVE 2b uses [id] to route into a category listing
/// (`context.pushCategory(id)`); [handle] is kept for future
/// handle-based routes.
@immutable
class StoreCategory {
  const StoreCategory({
    required this.id,
    required this.name,
    this.handle,
  });

  final String id;
  final String name;
  final String? handle;

  factory StoreCategory.fromJson(Map<String, dynamic> json) => StoreCategory(
        id: json["id"] as String? ?? "",
        name: (json["name"] as String? ?? "").trim(),
        handle: json["handle"] as String?,
      );
}

/// Fetches store product categories from `GET /store/product-categories`.
class CategoriesRepository {
  CategoriesRepository(this._dio);

  final Dio _dio;

  /// Top-level categories (no parent), name-ordered, capped by [limit].
  ///
  /// Degrades gracefully: any failure returns an empty list so the menu simply
  /// shows nothing extra rather than erroring.
  Future<List<StoreCategory>> fetchTopLevel({int limit = 12}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        "/store/product-categories",
        queryParameters: {
          "parent_category_id": "null",
          "limit": limit,
          "fields": "id,name,handle",
          "order": "name",
        },
      );
      final data = res.data?["product_categories"];
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((m) => StoreCategory.fromJson(m.cast<String, dynamic>()))
          .where((c) => c.id.isNotEmpty && c.name.isNotEmpty)
          .toList();
    } catch (e) {
      debugPrint("[chrome] categories fetch failed: $e");
      return const [];
    }
  }
}

final categoriesRepositoryProvider = Provider<CategoriesRepository>(
  (ref) => CategoriesRepository(ref.watch(storeDioProvider)),
);

/// Live top-level categories for the dynamic header menu / drawer. Cached for
/// the session; refetch by invalidating this provider. Never throws — the
/// repository already returns an empty list on error.
final topCategoriesProvider = FutureProvider<List<StoreCategory>>(
  (ref) => ref.watch(categoriesRepositoryProvider).fetchTopLevel(),
);
