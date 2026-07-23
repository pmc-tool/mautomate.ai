import "package:collection/collection.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "products_repository.dart";
import "store_product.dart";
import "tenant_config.dart";

const _listEq = ListEquality<String>();

/// A resolved catalog *binding* extracted from a data-bound block (a
/// `product_tabs` tab, or a `category_showcase` / `deal_of_day` ref).
///
/// It is the DESCRIPTOR of what to fetch — not the products themselves. It is a
/// value type (structural `==`/`hashCode`) so it can key
/// [catalogProductsProvider] (a `FutureProvider.family`): two identical
/// bindings share one in-flight request + cache entry, and switching tabs is
/// instant on a re-visit.
@immutable
class CatalogBinding {
  const CatalogBinding({
    required this.source,
    this.categoryId,
    this.collectionId,
    this.productIds = const [],
    this.sort,
    this.limit = 10,
  });

  /// `all` | `category` | `collection` | `manual`.
  final String source;
  final String? categoryId;
  final String? collectionId;

  /// Explicit, ordered product ids (source == `manual`). Order is preserved
  /// client-side after the fetch.
  final List<String> productIds;

  /// `created_at` | `price_asc` | `price_desc` (optional).
  final String? sort;
  final int limit;

  /// Build a binding from a `product_tabs` tab object (see the catalog).
  /// Defensive: unknown/missing fields fall back to a sane `all` latest fetch.
  factory CatalogBinding.fromTab(Map<String, dynamic> tab) {
    final rawLimit = tab["limit"];
    final lim = rawLimit is num
        ? rawLimit.toInt()
        : (rawLimit is String ? int.tryParse(rawLimit) ?? 10 : 10);
    final rawIds = tab["product_ids"];
    final ids = rawIds is List
        ? rawIds.whereType<String>().toList(growable: false)
        : const <String>[];
    final src = tab["source"];
    return CatalogBinding(
      source: src is String && src.isNotEmpty ? src : "all",
      categoryId: tab["category_id"] is String ? tab["category_id"] as String : null,
      collectionId:
          tab["collection_id"] is String ? tab["collection_id"] as String : null,
      productIds: ids,
      sort: tab["sort"] is String ? tab["sort"] as String : null,
      limit: lim.clamp(1, 50),
    );
  }

  /// The Medusa `order` query value for [sort] (or null to use the caller's
  /// default). Newest-first for `created_at`; calculated price asc/desc.
  String? get order => switch (sort) {
        "price_asc" => "variants.calculated_price",
        "price_desc" => "-variants.calculated_price",
        "created_at" => "-created_at",
        _ => null,
      };

  @override
  bool operator ==(Object other) =>
      other is CatalogBinding &&
      other.source == source &&
      other.categoryId == categoryId &&
      other.collectionId == collectionId &&
      other.sort == sort &&
      other.limit == limit &&
      _listEq.equals(other.productIds, productIds);

  @override
  int get hashCode => Object.hash(
        source,
        categoryId,
        collectionId,
        sort,
        limit,
        _listEq.hash(productIds),
      );
}

/// Resolves a [CatalogBinding] into live [StoreProduct]s via [ProductsRepository].
///
/// The one place the binding *sources* (`all`/`category`/`collection`/`manual`)
/// map to concrete `/store/products` queries. Every path degrades gracefully:
/// a missing ref returns an empty list (never throws), and `manual` preserves
/// the author's exact ordering (Medusa's `id[]` filter does not).
class CatalogBindingService {
  CatalogBindingService(this._products);

  final ProductsRepository _products;

  Future<List<StoreProduct>> resolve(
    CatalogBinding binding, {
    String? regionId,
  }) async {
    switch (binding.source) {
      case "manual":
        if (binding.productIds.isEmpty) return const [];
        final fetched = await _products.list(
          productIds: binding.productIds,
          limit: binding.productIds.length,
          regionId: regionId,
        );
        // Medusa ignores id[] order; restore the author's ordering.
        final byId = {for (final p in fetched) p.id: p};
        return [
          for (final id in binding.productIds)
            if (byId[id] != null) byId[id]!,
        ];
      case "category":
        if (binding.categoryId == null) return const [];
        return _products.list(
          categoryIds: [binding.categoryId!],
          limit: binding.limit,
          order: binding.order,
          regionId: regionId,
        );
      case "collection":
        if (binding.collectionId == null) return const [];
        return _products.list(
          collectionIds: [binding.collectionId!],
          limit: binding.limit,
          order: binding.order,
          regionId: regionId,
        );
      case "all":
      default:
        return _products.list(
          limit: binding.limit,
          order: binding.order ?? "-created_at",
          regionId: regionId,
        );
    }
  }
}

/// The binding service, wired to the products repository.
final catalogBindingServiceProvider = Provider<CatalogBindingService>(
  (ref) => CatalogBindingService(ref.watch(productsRepositoryProvider)),
);

/// Live products for a [CatalogBinding]. Reads the store's `region_id` from
/// [tenantConfigProvider] first (so prices resolve), then resolves the binding.
/// Keyed by the binding's value identity, so identical bindings dedupe/cache.
final catalogProductsProvider =
    FutureProvider.family<List<StoreProduct>, CatalogBinding>((ref, binding) async {
  final config = await ref.watch(tenantConfigProvider.future);
  return ref
      .watch(catalogBindingServiceProvider)
      .resolve(binding, regionId: config.regionId);
});

/// Live product count for a category (for `category_showcase` tiles). Best
/// effort — resolves to null on any failure so the tile shows no count.
final categoryProductCountProvider =
    FutureProvider.family<int?, String>((ref, categoryId) async {
  return ref.watch(productsRepositoryProvider).count(categoryIds: [categoryId]);
});
