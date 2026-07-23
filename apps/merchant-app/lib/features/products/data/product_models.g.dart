// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProductListItemImpl _$$ProductListItemImplFromJson(
        Map<String, dynamic> json) =>
    _$ProductListItemImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      handle: json['handle'] as String? ?? "",
      status: json['status'] as String? ?? "draft",
      thumbnail: json['thumbnail'] as String?,
      price: json['price'] as num?,
      currencyCode: json['currency_code'] as String?,
      stock: json['stock'] as num?,
      variantCount: (json['variant_count'] as num?)?.toInt(),
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );

Map<String, dynamic> _$$ProductListItemImplToJson(
        _$ProductListItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'handle': instance.handle,
      'status': instance.status,
      'thumbnail': instance.thumbnail,
      'price': instance.price,
      'currency_code': instance.currencyCode,
      'stock': instance.stock,
      'variant_count': instance.variantCount,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
    };

_$ProductPageImpl _$$ProductPageImplFromJson(Map<String, dynamic> json) =>
    _$ProductPageImpl(
      products: (json['products'] as List<dynamic>?)
              ?.map((e) => ProductListItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProductListItem>[],
      count: (json['count'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$ProductPageImplToJson(_$ProductPageImpl instance) =>
    <String, dynamic>{
      'products': instance.products,
      'count': instance.count,
    };

_$ProductPriceImpl _$$ProductPriceImplFromJson(Map<String, dynamic> json) =>
    _$ProductPriceImpl(
      amount: json['amount'] as num? ?? 0,
      currencyCode: json['currency_code'] as String? ?? "usd",
    );

Map<String, dynamic> _$$ProductPriceImplToJson(_$ProductPriceImpl instance) =>
    <String, dynamic>{
      'amount': instance.amount,
      'currency_code': instance.currencyCode,
    };

_$ProductImageImpl _$$ProductImageImplFromJson(Map<String, dynamic> json) =>
    _$ProductImageImpl(
      id: json['id'] as String,
      url: json['url'] as String,
    );

Map<String, dynamic> _$$ProductImageImplToJson(_$ProductImageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'url': instance.url,
    };

_$ProductVariantImpl _$$ProductVariantImplFromJson(Map<String, dynamic> json) =>
    _$ProductVariantImpl(
      id: json['id'] as String,
      title: json['title'] as String? ?? "",
      sku: json['sku'] as String?,
      thumbnail: json['thumbnail'] as String?,
      prices: (json['prices'] as List<dynamic>?)
              ?.map((e) => ProductPrice.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProductPrice>[],
      inventoryQuantity: json['inventory_quantity'] as num?,
      manageInventory: json['manage_inventory'] as bool?,
      allowBackorder: json['allow_backorder'] as bool?,
    );

Map<String, dynamic> _$$ProductVariantImplToJson(
        _$ProductVariantImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'sku': instance.sku,
      'thumbnail': instance.thumbnail,
      'prices': instance.prices,
      'inventory_quantity': instance.inventoryQuantity,
      'manage_inventory': instance.manageInventory,
      'allow_backorder': instance.allowBackorder,
    };

_$ProductCollectionImpl _$$ProductCollectionImplFromJson(
        Map<String, dynamic> json) =>
    _$ProductCollectionImpl(
      id: json['id'] as String,
      title: json['title'] as String? ?? "",
    );

Map<String, dynamic> _$$ProductCollectionImplToJson(
        _$ProductCollectionImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
    };

_$ProductTypeImpl _$$ProductTypeImplFromJson(Map<String, dynamic> json) =>
    _$ProductTypeImpl(
      id: json['id'] as String,
      value: json['value'] as String? ?? "",
    );

Map<String, dynamic> _$$ProductTypeImplToJson(_$ProductTypeImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'value': instance.value,
    };

_$ProductTagImpl _$$ProductTagImplFromJson(Map<String, dynamic> json) =>
    _$ProductTagImpl(
      id: json['id'] as String,
      value: json['value'] as String? ?? "",
    );

Map<String, dynamic> _$$ProductTagImplToJson(_$ProductTagImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'value': instance.value,
    };

_$ProductDetailImpl _$$ProductDetailImplFromJson(Map<String, dynamic> json) =>
    _$ProductDetailImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      handle: json['handle'] as String? ?? "",
      status: json['status'] as String? ?? "draft",
      subtitle: json['subtitle'] as String?,
      description: json['description'] as String?,
      thumbnail: json['thumbnail'] as String?,
      variants: (json['variants'] as List<dynamic>?)
              ?.map((e) => ProductVariant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProductVariant>[],
      images: (json['images'] as List<dynamic>?)
              ?.map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProductImage>[],
      tags: (json['tags'] as List<dynamic>?)
              ?.map((e) => ProductTag.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProductTag>[],
      collection: json['collection'] == null
          ? null
          : ProductCollection.fromJson(
              json['collection'] as Map<String, dynamic>),
      type: json['type'] == null
          ? null
          : ProductType.fromJson(json['type'] as Map<String, dynamic>),
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );

Map<String, dynamic> _$$ProductDetailImplToJson(_$ProductDetailImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'handle': instance.handle,
      'status': instance.status,
      'subtitle': instance.subtitle,
      'description': instance.description,
      'thumbnail': instance.thumbnail,
      'variants': instance.variants,
      'images': instance.images,
      'tags': instance.tags,
      'collection': instance.collection,
      'type': instance.type,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
    };

_$ProductDetailResponseImpl _$$ProductDetailResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$ProductDetailResponseImpl(
      product: ProductDetail.fromJson(json['product'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ProductDetailResponseImplToJson(
        _$ProductDetailResponseImpl instance) =>
    <String, dynamic>{
      'product': instance.product,
    };

_$StoreCurrenciesImpl _$$StoreCurrenciesImplFromJson(
        Map<String, dynamic> json) =>
    _$StoreCurrenciesImpl(
      currencies: (json['currencies'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>["usd"],
      defaultCurrency: json['default_currency'] as String? ?? "usd",
    );

Map<String, dynamic> _$$StoreCurrenciesImplToJson(
        _$StoreCurrenciesImpl instance) =>
    <String, dynamic>{
      'currencies': instance.currencies,
      'default_currency': instance.defaultCurrency,
    };

_$StockLocationImpl _$$StockLocationImplFromJson(Map<String, dynamic> json) =>
    _$StockLocationImpl(
      locationId: json['location_id'] as String,
      locationName: json['location_name'] as String? ?? "",
      stockedQuantity: json['stocked_quantity'] as num? ?? 0,
      reservedQuantity: json['reserved_quantity'] as num? ?? 0,
    );

Map<String, dynamic> _$$StockLocationImplToJson(_$StockLocationImpl instance) =>
    <String, dynamic>{
      'location_id': instance.locationId,
      'location_name': instance.locationName,
      'stocked_quantity': instance.stockedQuantity,
      'reserved_quantity': instance.reservedQuantity,
    };

_$StockVariantImpl _$$StockVariantImplFromJson(Map<String, dynamic> json) =>
    _$StockVariantImpl(
      variantId: json['variant_id'] as String,
      variantTitle: json['variant_title'] as String? ?? "",
      sku: json['sku'] as String?,
      inventoryItemId: json['inventory_item_id'] as String?,
      locations: (json['locations'] as List<dynamic>?)
              ?.map((e) => StockLocation.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <StockLocation>[],
    );

Map<String, dynamic> _$$StockVariantImplToJson(_$StockVariantImpl instance) =>
    <String, dynamic>{
      'variant_id': instance.variantId,
      'variant_title': instance.variantTitle,
      'sku': instance.sku,
      'inventory_item_id': instance.inventoryItemId,
      'locations': instance.locations,
    };

_$StockMatrixImpl _$$StockMatrixImplFromJson(Map<String, dynamic> json) =>
    _$StockMatrixImpl(
      variants: (json['variants'] as List<dynamic>?)
              ?.map((e) => StockVariant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <StockVariant>[],
    );

Map<String, dynamic> _$$StockMatrixImplToJson(_$StockMatrixImpl instance) =>
    <String, dynamic>{
      'variants': instance.variants,
    };
