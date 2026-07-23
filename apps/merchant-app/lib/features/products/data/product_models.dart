// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern — the
// annotation is forwarded to the generated field, so the warning is a false
// positive (same convention as the Home + Jarvis DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "product_models.freezed.dart";
part "product_models.g.dart";

/// A row in the paginated product list.
///
/// Mirrors the JSON returned by `GET /merchant/products` (the tenant-scoped
/// merchant catalogue endpoint). The list route carries legacy convenience
/// fields — first-variant `price`/`currency_code`/`stock` and `variant_count` —
/// which the mobile list uses for the price + stock summary on each row.
@freezed
class ProductListItem with _$ProductListItem {
  const factory ProductListItem({
    required String id,
    required String title,
    @Default("") String handle,
    @Default("draft") String status,
    String? thumbnail,
    // Legacy list enrichment (first variant only).
    num? price,
    @JsonKey(name: "currency_code") String? currencyCode,
    num? stock,
    @JsonKey(name: "variant_count") int? variantCount,
    @JsonKey(name: "created_at") String? createdAt,
    @JsonKey(name: "updated_at") String? updatedAt,
  }) = _ProductListItem;

  factory ProductListItem.fromJson(Map<String, dynamic> json) =>
      _$ProductListItemFromJson(json);
}

/// A single response page: the rows plus the total [count] for pagination.
@freezed
class ProductPage with _$ProductPage {
  const factory ProductPage({
    @Default(<ProductListItem>[]) List<ProductListItem> products,
    @Default(0) int count,
  }) = _ProductPage;

  factory ProductPage.fromJson(Map<String, dynamic> json) =>
      _$ProductPageFromJson(json);
}

/// A price row on a variant — an amount in a store currency (major units).
@freezed
class ProductPrice with _$ProductPrice {
  const factory ProductPrice({
    @Default(0) num amount,
    @JsonKey(name: "currency_code") @Default("usd") String currencyCode,
  }) = _ProductPrice;

  factory ProductPrice.fromJson(Map<String, dynamic> json) =>
      _$ProductPriceFromJson(json);
}

/// A product image (from the product gallery).
@freezed
class ProductImage with _$ProductImage {
  const factory ProductImage({
    required String id,
    required String url,
  }) = _ProductImage;

  factory ProductImage.fromJson(Map<String, dynamic> json) =>
      _$ProductImageFromJson(json);
}

/// A purchasable variant of a product, with its prices + available stock.
@freezed
class ProductVariant with _$ProductVariant {
  const factory ProductVariant({
    required String id,
    @Default("") String title,
    String? sku,
    String? thumbnail,
    @Default(<ProductPrice>[]) List<ProductPrice> prices,
    @JsonKey(name: "inventory_quantity") num? inventoryQuantity,
    @JsonKey(name: "manage_inventory") bool? manageInventory,
    @JsonKey(name: "allow_backorder") bool? allowBackorder,
  }) = _ProductVariant;

  factory ProductVariant.fromJson(Map<String, dynamic> json) =>
      _$ProductVariantFromJson(json);
}

/// A collection a product belongs to.
@freezed
class ProductCollection with _$ProductCollection {
  const factory ProductCollection({
    required String id,
    @Default("") String title,
  }) = _ProductCollection;

  factory ProductCollection.fromJson(Map<String, dynamic> json) =>
      _$ProductCollectionFromJson(json);
}

/// A product type.
@freezed
class ProductType with _$ProductType {
  const factory ProductType({
    required String id,
    @Default("") String value,
  }) = _ProductType;

  factory ProductType.fromJson(Map<String, dynamic> json) =>
      _$ProductTypeFromJson(json);
}

/// A product tag.
@freezed
class ProductTag with _$ProductTag {
  const factory ProductTag({
    required String id,
    @Default("") String value,
  }) = _ProductTag;

  factory ProductTag.fromJson(Map<String, dynamic> json) =>
      _$ProductTagFromJson(json);
}

/// The full product detail from `GET /merchant/products/{id}`.
///
/// Variants carry their `prices` and available `inventory_quantity`, which the
/// detail screen's quick-edits (price / stock) read and write back through
/// `PUT /merchant/products/{id}`.
@freezed
class ProductDetail with _$ProductDetail {
  const factory ProductDetail({
    required String id,
    required String title,
    @Default("") String handle,
    @Default("draft") String status,
    String? subtitle,
    String? description,
    String? thumbnail,
    @Default(<ProductVariant>[]) List<ProductVariant> variants,
    @Default(<ProductImage>[]) List<ProductImage> images,
    @Default(<ProductTag>[]) List<ProductTag> tags,
    ProductCollection? collection,
    ProductType? type,
    @JsonKey(name: "created_at") String? createdAt,
    @JsonKey(name: "updated_at") String? updatedAt,
  }) = _ProductDetail;

  factory ProductDetail.fromJson(Map<String, dynamic> json) =>
      _$ProductDetailFromJson(json);
}

/// Response envelope for the single-product endpoints: `{ product }`.
@freezed
class ProductDetailResponse with _$ProductDetailResponse {
  const factory ProductDetailResponse({
    required ProductDetail product,
  }) = _ProductDetailResponse;

  factory ProductDetailResponse.fromJson(Map<String, dynamic> json) =>
      _$ProductDetailResponseFromJson(json);
}

/// The store's priceable currencies from `GET /merchant/store/currencies`:
/// the supported codes (default first) plus the [defaultCurrency]. The
/// create-product pricing section prices in one of these.
@freezed
class StoreCurrencies with _$StoreCurrencies {
  const factory StoreCurrencies({
    @Default(<String>["usd"]) List<String> currencies,
    @JsonKey(name: "default_currency") @Default("usd") String defaultCurrency,
  }) = _StoreCurrencies;

  factory StoreCurrencies.fromJson(Map<String, dynamic> json) =>
      _$StoreCurrenciesFromJson(json);
}

/// One stock location row for a variant in the stock matrix: the tenant
/// location plus the on-hand [stockedQuantity] and [reservedQuantity] there.
@freezed
class StockLocation with _$StockLocation {
  const factory StockLocation({
    @JsonKey(name: "location_id") required String locationId,
    @JsonKey(name: "location_name") @Default("") String locationName,
    @JsonKey(name: "stocked_quantity") @Default(0) num stockedQuantity,
    @JsonKey(name: "reserved_quantity") @Default(0) num reservedQuantity,
  }) = _StockLocation;

  factory StockLocation.fromJson(Map<String, dynamic> json) =>
      _$StockLocationFromJson(json);
}

/// A variant's stock across the tenant's locations, from
/// `GET /merchant/products/{id}/stock`. [inventoryItemId] is null when the
/// variant does not manage inventory (nothing to restock).
@freezed
class StockVariant with _$StockVariant {
  const factory StockVariant({
    @JsonKey(name: "variant_id") required String variantId,
    @JsonKey(name: "variant_title") @Default("") String variantTitle,
    String? sku,
    @JsonKey(name: "inventory_item_id") String? inventoryItemId,
    @Default(<StockLocation>[]) List<StockLocation> locations,
  }) = _StockVariant;

  factory StockVariant.fromJson(Map<String, dynamic> json) =>
      _$StockVariantFromJson(json);
}

/// The full per-variant stock matrix response: `{ variants: [...] }`.
@freezed
class StockMatrix with _$StockMatrix {
  const factory StockMatrix({
    @Default(<StockVariant>[]) List<StockVariant> variants,
  }) = _StockMatrix;

  factory StockMatrix.fromJson(Map<String, dynamic> json) =>
      _$StockMatrixFromJson(json);
}
