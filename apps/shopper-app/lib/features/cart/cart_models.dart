import "package:flutter/foundation.dart";

/// A single line in the cart, parsed from a Medusa cart `items[]` entry.
///
/// Hand-written (no codegen) and defensive: every field is probed for its type
/// and falls back gracefully, so a shape we do not recognise never throws.
/// Amounts are Medusa v2 MAJOR units (decimals), ready for [formatMoney].
@immutable
class CartLineItem {
  const CartLineItem({
    required this.id,
    required this.title,
    required this.variantId,
    required this.quantity,
    this.subtitle,
    this.thumbnail,
    this.unitPrice,
    this.total,
    this.createdAt,
  });

  /// The line item id (NOT the variant id) — the handle for update/remove.
  final String id;

  /// Product title (falls back to the line title).
  final String title;

  /// Variant title (e.g. "Large / Blue"), when the product has options.
  final String? subtitle;

  final String? thumbnail;

  /// The variant this line represents — used to increment an existing line.
  final String variantId;

  final int quantity;

  /// Per-unit price in major units, or null when the cart came back unpriced.
  final num? unitPrice;

  /// Line total (unit price x quantity), in major units.
  final num? total;

  /// Sort key so the list order stays stable across mutations.
  final String? createdAt;

  factory CartLineItem.fromJson(Map<String, dynamic> json) {
    String? s(String key) {
      final v = json[key];
      return v is String && v.trim().isNotEmpty ? v.trim() : null;
    }

    num? n(String key) {
      final v = json[key];
      return v is num ? v : null;
    }

    return CartLineItem(
      id: (json["id"] as String?) ?? "",
      title: s("product_title") ?? s("title") ?? "Item",
      subtitle: s("variant_title"),
      thumbnail: s("thumbnail"),
      variantId: (json["variant_id"] as String?) ?? "",
      quantity: (n("quantity") ?? 1).toInt(),
      unitPrice: n("unit_price"),
      total: n("total") ?? n("subtotal"),
      createdAt: s("created_at"),
    );
  }
}

/// The shopper cart, parsed from a Medusa `/store/carts` response `cart`.
@immutable
class Cart {
  const Cart({
    required this.id,
    required this.items,
    this.currencyCode,
    this.subtotal,
    this.total,
  });

  final String id;
  final String? currencyCode;
  final List<CartLineItem> items;

  /// Items subtotal (before shipping/tax), major units.
  final num? subtotal;

  /// Grand total, major units.
  final num? total;

  /// Summed quantity across all lines — what the nav/header badge shows.
  int get itemCount => items.fold(0, (sum, i) => sum + i.quantity);

  bool get isEmpty => items.isEmpty;

  /// The existing line for [variantId], or null — used to increment on re-add.
  CartLineItem? lineForVariant(String variantId) {
    for (final i in items) {
      if (i.variantId == variantId) return i;
    }
    return null;
  }

  factory Cart.fromJson(Map<String, dynamic> json) {
    num? n(String key) {
      final v = json[key];
      return v is num ? v : null;
    }

    final rawItems = json["items"];
    final items = <CartLineItem>[];
    if (rawItems is List) {
      for (final it in rawItems) {
        if (it is Map) {
          items.add(CartLineItem.fromJson(it.cast<String, dynamic>()));
        }
      }
    }
    // Stable display order: Medusa can reorder items[] after a mutation.
    items.sort((a, b) => (a.createdAt ?? "").compareTo(b.createdAt ?? ""));

    return Cart(
      id: (json["id"] as String?) ?? "",
      currencyCode: json["currency_code"] as String?,
      items: List.unmodifiable(items),
      subtotal: n("item_subtotal") ?? n("subtotal"),
      total: n("total") ?? n("item_total"),
    );
  }
}
