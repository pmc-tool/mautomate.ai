import "package:flutter/foundation.dart";

/// A selectable product option (e.g. "Size" with values S/M/L).
@immutable
class ProductOption {
  const ProductOption({
    required this.id,
    required this.title,
    required this.values,
  });

  final String id;
  final String title;

  /// The distinct option values, in the order the store defined them.
  final List<String> values;

  factory ProductOption.fromJson(Map<String, dynamic> json) {
    final rawValues = json["values"];
    final seen = <String>{};
    final values = <String>[];
    if (rawValues is List) {
      for (final v in rawValues) {
        final value = v is Map ? v["value"] : v;
        if (value is String && value.trim().isNotEmpty && seen.add(value)) {
          values.add(value);
        }
      }
    }
    return ProductOption(
      id: json["id"] as String? ?? "",
      title: (json["title"] as String? ?? "").trim(),
      values: values,
    );
  }
}

/// A concrete purchasable variant with its option coordinates, price and stock.
@immutable
class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.title,
    required this.optionValueByOptionId,
    this.priceAmount,
    this.originalAmount,
    this.currencyCode,
    this.inventoryQuantity,
    this.manageInventory = false,
    this.allowBackorder = false,
  });

  final String id;
  final String title;

  /// Maps `option_id` -> the value this variant carries for that option. Used to
  /// resolve the selected variant from the option pickers.
  final Map<String, String> optionValueByOptionId;

  final num? priceAmount;
  final num? originalAmount;
  final String? currencyCode;

  final int? inventoryQuantity;
  final bool manageInventory;
  final bool allowBackorder;

  bool get isOnSale =>
      priceAmount != null &&
      originalAmount != null &&
      originalAmount! > priceAmount!;

  /// Whether this variant can be added to the cart. Unmanaged inventory and
  /// backorder-enabled variants are always purchasable; otherwise it needs
  /// positive stock (a null quantity is treated as available).
  bool get inStock {
    if (!manageInventory || allowBackorder) return true;
    final qty = inventoryQuantity;
    return qty == null || qty > 0;
  }

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    final optionMap = <String, String>{};
    final opts = json["options"];
    if (opts is List) {
      for (final o in opts) {
        if (o is! Map) continue;
        final optionId = o["option_id"] as String?;
        final value = o["value"] as String?;
        if (optionId != null && value != null) optionMap[optionId] = value;
      }
    }

    num? price;
    num? original;
    String? currency;
    final calc = json["calculated_price"];
    if (calc is Map) {
      final amt = calc["calculated_amount"];
      if (amt is num) price = amt;
      final orig = calc["original_amount"];
      if (orig is num) original = orig;
      final cc = calc["currency_code"];
      if (cc is String) currency = cc;
    }

    final qty = json["inventory_quantity"];

    return ProductVariant(
      id: json["id"] as String? ?? "",
      title: (json["title"] as String? ?? "").trim(),
      optionValueByOptionId: optionMap,
      priceAmount: price,
      originalAmount: original,
      currencyCode: currency,
      inventoryQuantity: qty is num ? qty.toInt() : null,
      manageInventory: json["manage_inventory"] == true,
      allowBackorder: json["allow_backorder"] == true,
    );
  }
}

/// A fully-detailed storefront product for the PDP: gallery, option matrix and
/// variants. Parsed from `GET /store/products?handle=…` with variant/option/
/// image fields expanded.
@immutable
class ProductDetail {
  const ProductDetail({
    required this.id,
    required this.title,
    required this.options,
    required this.variants,
    required this.images,
    this.handle,
    this.subtitle,
    this.description,
    this.thumbnail,
  });

  final String id;
  final String title;
  final String? handle;
  final String? subtitle;
  final String? description;
  final String? thumbnail;

  /// Gallery image URLs (falls back to [thumbnail] when empty).
  final List<String> images;
  final List<ProductOption> options;
  final List<ProductVariant> variants;

  /// True when the product has a real option matrix to choose from (more than a
  /// single default variant).
  bool get hasOptions => options.isNotEmpty && variants.length > 1;

  /// The default variant to show before/without a selection — the first, so a
  /// single-variant product is immediately purchasable.
  ProductVariant? get defaultVariant =>
      variants.isEmpty ? null : variants.first;

  /// Resolve the variant matching a full option selection (`option_id` ->
  /// value). Returns null until every option is chosen and a variant matches.
  ProductVariant? variantForSelection(Map<String, String> selected) {
    if (selected.length < options.length) return null;
    for (final variant in variants) {
      var matches = true;
      for (final option in options) {
        if (variant.optionValueByOptionId[option.id] != selected[option.id]) {
          matches = false;
          break;
        }
      }
      if (matches) return variant;
    }
    return null;
  }

  /// Whether [value] for [optionId] is available given the OTHER current
  /// selections — used to disable option chips that lead nowhere.
  bool isValueAvailable(
    String optionId,
    String value,
    Map<String, String> selected,
  ) {
    for (final variant in variants) {
      if (variant.optionValueByOptionId[optionId] != value) continue;
      var ok = true;
      for (final entry in selected.entries) {
        if (entry.key == optionId) continue;
        if (variant.optionValueByOptionId[entry.key] != entry.value) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  factory ProductDetail.fromJson(Map<String, dynamic> json) {
    final rawImages = json["images"];
    final images = <String>[];
    if (rawImages is List) {
      for (final img in rawImages) {
        final url = img is Map ? img["url"] : img;
        if (url is String && url.trim().isNotEmpty) images.add(url);
      }
    }

    final rawOptions = json["options"];
    final options = <ProductOption>[];
    if (rawOptions is List) {
      for (final o in rawOptions) {
        if (o is Map) {
          options.add(ProductOption.fromJson(o.cast<String, dynamic>()));
        }
      }
    }

    final rawVariants = json["variants"];
    final variants = <ProductVariant>[];
    if (rawVariants is List) {
      for (final v in rawVariants) {
        if (v is Map) {
          variants.add(ProductVariant.fromJson(v.cast<String, dynamic>()));
        }
      }
    }

    return ProductDetail(
      id: json["id"] as String? ?? "",
      title: json["title"] as String? ?? "",
      handle: json["handle"] as String?,
      subtitle: json["subtitle"] as String?,
      description: json["description"] as String?,
      thumbnail: json["thumbnail"] as String?,
      images: images,
      options: options.where((o) => o.id.isNotEmpty).toList(),
      variants: variants.where((v) => v.id.isNotEmpty).toList(),
    );
  }
}
