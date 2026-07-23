import "package:flutter/foundation.dart";

/// A minimal storefront product, parsed from Medusa `/store/products`.
///
/// Hand-written (no codegen) and intentionally lean — enough to back a
/// [ProductCard]. Wave 2b expands this (options, variants, inventory, full
/// gallery) as the product/cart screens land; consider a freezed model then.
@immutable
class StoreProduct {
  const StoreProduct({
    required this.id,
    required this.title,
    this.handle,
    this.thumbnail,
    this.description,
    this.priceAmount,
    this.originalAmount,
    this.currencyCode,
  });

  final String id;
  final String title;
  final String? handle;
  final String? thumbnail;
  final String? description;

  /// Cheapest variant's calculated amount (major units), when the store returns
  /// a `region_id`/pricing context. Null when no price is available.
  final num? priceAmount;

  /// The cheapest variant's ORIGINAL (compare-at) amount, when the variant is
  /// on sale (`original_amount` > `calculated_amount`). Null otherwise, so a
  /// [ProductCard] only strikes through a genuine discount.
  final num? originalAmount;

  final String? currencyCode;

  /// True when [originalAmount] is present and strictly above [priceAmount].
  bool get isOnSale =>
      priceAmount != null &&
      originalAmount != null &&
      originalAmount! > priceAmount!;

  factory StoreProduct.fromJson(Map<String, dynamic> json) {
    num? price;
    num? original;
    String? currency;
    final variants = json["variants"];
    if (variants is List) {
      for (final v in variants) {
        if (v is! Map) continue;
        final calc = v["calculated_price"];
        if (calc is Map) {
          final amt = calc["calculated_amount"];
          if (amt is num) {
            if (price == null || amt < price) {
              price = amt;
              final orig = calc["original_amount"];
              original = orig is num ? orig : null;
              final cc = calc["currency_code"];
              currency = cc is String ? cc : currency;
            }
          }
        }
      }
    }
    return StoreProduct(
      id: json["id"] as String? ?? "",
      title: json["title"] as String? ?? "",
      handle: json["handle"] as String?,
      thumbnail: json["thumbnail"] as String?,
      description: json["description"] as String?,
      priceAmount: price,
      originalAmount: original,
      currencyCode: currency,
    );
  }
}
