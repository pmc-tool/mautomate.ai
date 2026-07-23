// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ProductListItem _$ProductListItemFromJson(Map<String, dynamic> json) {
  return _ProductListItem.fromJson(json);
}

/// @nodoc
mixin _$ProductListItem {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get handle => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get thumbnail =>
      throw _privateConstructorUsedError; // Legacy list enrichment (first variant only).
  num? get price => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String? get currencyCode => throw _privateConstructorUsedError;
  num? get stock => throw _privateConstructorUsedError;
  @JsonKey(name: "variant_count")
  int? get variantCount => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "updated_at")
  String? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this ProductListItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductListItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductListItemCopyWith<ProductListItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductListItemCopyWith<$Res> {
  factory $ProductListItemCopyWith(
          ProductListItem value, $Res Function(ProductListItem) then) =
      _$ProductListItemCopyWithImpl<$Res, ProductListItem>;
  @useResult
  $Res call(
      {String id,
      String title,
      String handle,
      String status,
      String? thumbnail,
      num? price,
      @JsonKey(name: "currency_code") String? currencyCode,
      num? stock,
      @JsonKey(name: "variant_count") int? variantCount,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "updated_at") String? updatedAt});
}

/// @nodoc
class _$ProductListItemCopyWithImpl<$Res, $Val extends ProductListItem>
    implements $ProductListItemCopyWith<$Res> {
  _$ProductListItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductListItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? handle = null,
    Object? status = null,
    Object? thumbnail = freezed,
    Object? price = freezed,
    Object? currencyCode = freezed,
    Object? stock = freezed,
    Object? variantCount = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      handle: null == handle
          ? _value.handle
          : handle // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      price: freezed == price
          ? _value.price
          : price // ignore: cast_nullable_to_non_nullable
              as num?,
      currencyCode: freezed == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String?,
      stock: freezed == stock
          ? _value.stock
          : stock // ignore: cast_nullable_to_non_nullable
              as num?,
      variantCount: freezed == variantCount
          ? _value.variantCount
          : variantCount // ignore: cast_nullable_to_non_nullable
              as int?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductListItemImplCopyWith<$Res>
    implements $ProductListItemCopyWith<$Res> {
  factory _$$ProductListItemImplCopyWith(_$ProductListItemImpl value,
          $Res Function(_$ProductListItemImpl) then) =
      __$$ProductListItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String handle,
      String status,
      String? thumbnail,
      num? price,
      @JsonKey(name: "currency_code") String? currencyCode,
      num? stock,
      @JsonKey(name: "variant_count") int? variantCount,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "updated_at") String? updatedAt});
}

/// @nodoc
class __$$ProductListItemImplCopyWithImpl<$Res>
    extends _$ProductListItemCopyWithImpl<$Res, _$ProductListItemImpl>
    implements _$$ProductListItemImplCopyWith<$Res> {
  __$$ProductListItemImplCopyWithImpl(
      _$ProductListItemImpl _value, $Res Function(_$ProductListItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductListItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? handle = null,
    Object? status = null,
    Object? thumbnail = freezed,
    Object? price = freezed,
    Object? currencyCode = freezed,
    Object? stock = freezed,
    Object? variantCount = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_$ProductListItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      handle: null == handle
          ? _value.handle
          : handle // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      price: freezed == price
          ? _value.price
          : price // ignore: cast_nullable_to_non_nullable
              as num?,
      currencyCode: freezed == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String?,
      stock: freezed == stock
          ? _value.stock
          : stock // ignore: cast_nullable_to_non_nullable
              as num?,
      variantCount: freezed == variantCount
          ? _value.variantCount
          : variantCount // ignore: cast_nullable_to_non_nullable
              as int?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductListItemImpl implements _ProductListItem {
  const _$ProductListItemImpl(
      {required this.id,
      required this.title,
      this.handle = "",
      this.status = "draft",
      this.thumbnail,
      this.price,
      @JsonKey(name: "currency_code") this.currencyCode,
      this.stock,
      @JsonKey(name: "variant_count") this.variantCount,
      @JsonKey(name: "created_at") this.createdAt,
      @JsonKey(name: "updated_at") this.updatedAt});

  factory _$ProductListItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductListItemImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  @JsonKey()
  final String handle;
  @override
  @JsonKey()
  final String status;
  @override
  final String? thumbnail;
// Legacy list enrichment (first variant only).
  @override
  final num? price;
  @override
  @JsonKey(name: "currency_code")
  final String? currencyCode;
  @override
  final num? stock;
  @override
  @JsonKey(name: "variant_count")
  final int? variantCount;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  @JsonKey(name: "updated_at")
  final String? updatedAt;

  @override
  String toString() {
    return 'ProductListItem(id: $id, title: $title, handle: $handle, status: $status, thumbnail: $thumbnail, price: $price, currencyCode: $currencyCode, stock: $stock, variantCount: $variantCount, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductListItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.handle, handle) || other.handle == handle) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode) &&
            (identical(other.stock, stock) || other.stock == stock) &&
            (identical(other.variantCount, variantCount) ||
                other.variantCount == variantCount) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      handle,
      status,
      thumbnail,
      price,
      currencyCode,
      stock,
      variantCount,
      createdAt,
      updatedAt);

  /// Create a copy of ProductListItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductListItemImplCopyWith<_$ProductListItemImpl> get copyWith =>
      __$$ProductListItemImplCopyWithImpl<_$ProductListItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductListItemImplToJson(
      this,
    );
  }
}

abstract class _ProductListItem implements ProductListItem {
  const factory _ProductListItem(
          {required final String id,
          required final String title,
          final String handle,
          final String status,
          final String? thumbnail,
          final num? price,
          @JsonKey(name: "currency_code") final String? currencyCode,
          final num? stock,
          @JsonKey(name: "variant_count") final int? variantCount,
          @JsonKey(name: "created_at") final String? createdAt,
          @JsonKey(name: "updated_at") final String? updatedAt}) =
      _$ProductListItemImpl;

  factory _ProductListItem.fromJson(Map<String, dynamic> json) =
      _$ProductListItemImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get handle;
  @override
  String get status;
  @override
  String? get thumbnail; // Legacy list enrichment (first variant only).
  @override
  num? get price;
  @override
  @JsonKey(name: "currency_code")
  String? get currencyCode;
  @override
  num? get stock;
  @override
  @JsonKey(name: "variant_count")
  int? get variantCount;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  @JsonKey(name: "updated_at")
  String? get updatedAt;

  /// Create a copy of ProductListItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductListItemImplCopyWith<_$ProductListItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductPage _$ProductPageFromJson(Map<String, dynamic> json) {
  return _ProductPage.fromJson(json);
}

/// @nodoc
mixin _$ProductPage {
  List<ProductListItem> get products => throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;

  /// Serializes this ProductPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductPageCopyWith<ProductPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductPageCopyWith<$Res> {
  factory $ProductPageCopyWith(
          ProductPage value, $Res Function(ProductPage) then) =
      _$ProductPageCopyWithImpl<$Res, ProductPage>;
  @useResult
  $Res call({List<ProductListItem> products, int count});
}

/// @nodoc
class _$ProductPageCopyWithImpl<$Res, $Val extends ProductPage>
    implements $ProductPageCopyWith<$Res> {
  _$ProductPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? products = null,
    Object? count = null,
  }) {
    return _then(_value.copyWith(
      products: null == products
          ? _value.products
          : products // ignore: cast_nullable_to_non_nullable
              as List<ProductListItem>,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductPageImplCopyWith<$Res>
    implements $ProductPageCopyWith<$Res> {
  factory _$$ProductPageImplCopyWith(
          _$ProductPageImpl value, $Res Function(_$ProductPageImpl) then) =
      __$$ProductPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<ProductListItem> products, int count});
}

/// @nodoc
class __$$ProductPageImplCopyWithImpl<$Res>
    extends _$ProductPageCopyWithImpl<$Res, _$ProductPageImpl>
    implements _$$ProductPageImplCopyWith<$Res> {
  __$$ProductPageImplCopyWithImpl(
      _$ProductPageImpl _value, $Res Function(_$ProductPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? products = null,
    Object? count = null,
  }) {
    return _then(_$ProductPageImpl(
      products: null == products
          ? _value._products
          : products // ignore: cast_nullable_to_non_nullable
              as List<ProductListItem>,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductPageImpl implements _ProductPage {
  const _$ProductPageImpl(
      {final List<ProductListItem> products = const <ProductListItem>[],
      this.count = 0})
      : _products = products;

  factory _$ProductPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductPageImplFromJson(json);

  final List<ProductListItem> _products;
  @override
  @JsonKey()
  List<ProductListItem> get products {
    if (_products is EqualUnmodifiableListView) return _products;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_products);
  }

  @override
  @JsonKey()
  final int count;

  @override
  String toString() {
    return 'ProductPage(products: $products, count: $count)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductPageImpl &&
            const DeepCollectionEquality().equals(other._products, _products) &&
            (identical(other.count, count) || other.count == count));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_products), count);

  /// Create a copy of ProductPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductPageImplCopyWith<_$ProductPageImpl> get copyWith =>
      __$$ProductPageImplCopyWithImpl<_$ProductPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductPageImplToJson(
      this,
    );
  }
}

abstract class _ProductPage implements ProductPage {
  const factory _ProductPage(
      {final List<ProductListItem> products,
      final int count}) = _$ProductPageImpl;

  factory _ProductPage.fromJson(Map<String, dynamic> json) =
      _$ProductPageImpl.fromJson;

  @override
  List<ProductListItem> get products;
  @override
  int get count;

  /// Create a copy of ProductPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductPageImplCopyWith<_$ProductPageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductPrice _$ProductPriceFromJson(Map<String, dynamic> json) {
  return _ProductPrice.fromJson(json);
}

/// @nodoc
mixin _$ProductPrice {
  num get amount => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String get currencyCode => throw _privateConstructorUsedError;

  /// Serializes this ProductPrice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductPrice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductPriceCopyWith<ProductPrice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductPriceCopyWith<$Res> {
  factory $ProductPriceCopyWith(
          ProductPrice value, $Res Function(ProductPrice) then) =
      _$ProductPriceCopyWithImpl<$Res, ProductPrice>;
  @useResult
  $Res call({num amount, @JsonKey(name: "currency_code") String currencyCode});
}

/// @nodoc
class _$ProductPriceCopyWithImpl<$Res, $Val extends ProductPrice>
    implements $ProductPriceCopyWith<$Res> {
  _$ProductPriceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductPrice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? amount = null,
    Object? currencyCode = null,
  }) {
    return _then(_value.copyWith(
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductPriceImplCopyWith<$Res>
    implements $ProductPriceCopyWith<$Res> {
  factory _$$ProductPriceImplCopyWith(
          _$ProductPriceImpl value, $Res Function(_$ProductPriceImpl) then) =
      __$$ProductPriceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num amount, @JsonKey(name: "currency_code") String currencyCode});
}

/// @nodoc
class __$$ProductPriceImplCopyWithImpl<$Res>
    extends _$ProductPriceCopyWithImpl<$Res, _$ProductPriceImpl>
    implements _$$ProductPriceImplCopyWith<$Res> {
  __$$ProductPriceImplCopyWithImpl(
      _$ProductPriceImpl _value, $Res Function(_$ProductPriceImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductPrice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? amount = null,
    Object? currencyCode = null,
  }) {
    return _then(_$ProductPriceImpl(
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductPriceImpl implements _ProductPrice {
  const _$ProductPriceImpl(
      {this.amount = 0,
      @JsonKey(name: "currency_code") this.currencyCode = "usd"});

  factory _$ProductPriceImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductPriceImplFromJson(json);

  @override
  @JsonKey()
  final num amount;
  @override
  @JsonKey(name: "currency_code")
  final String currencyCode;

  @override
  String toString() {
    return 'ProductPrice(amount: $amount, currencyCode: $currencyCode)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductPriceImpl &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, amount, currencyCode);

  /// Create a copy of ProductPrice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductPriceImplCopyWith<_$ProductPriceImpl> get copyWith =>
      __$$ProductPriceImplCopyWithImpl<_$ProductPriceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductPriceImplToJson(
      this,
    );
  }
}

abstract class _ProductPrice implements ProductPrice {
  const factory _ProductPrice(
          {final num amount,
          @JsonKey(name: "currency_code") final String currencyCode}) =
      _$ProductPriceImpl;

  factory _ProductPrice.fromJson(Map<String, dynamic> json) =
      _$ProductPriceImpl.fromJson;

  @override
  num get amount;
  @override
  @JsonKey(name: "currency_code")
  String get currencyCode;

  /// Create a copy of ProductPrice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductPriceImplCopyWith<_$ProductPriceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductImage _$ProductImageFromJson(Map<String, dynamic> json) {
  return _ProductImage.fromJson(json);
}

/// @nodoc
mixin _$ProductImage {
  String get id => throw _privateConstructorUsedError;
  String get url => throw _privateConstructorUsedError;

  /// Serializes this ProductImage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductImage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductImageCopyWith<ProductImage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductImageCopyWith<$Res> {
  factory $ProductImageCopyWith(
          ProductImage value, $Res Function(ProductImage) then) =
      _$ProductImageCopyWithImpl<$Res, ProductImage>;
  @useResult
  $Res call({String id, String url});
}

/// @nodoc
class _$ProductImageCopyWithImpl<$Res, $Val extends ProductImage>
    implements $ProductImageCopyWith<$Res> {
  _$ProductImageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductImage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? url = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      url: null == url
          ? _value.url
          : url // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductImageImplCopyWith<$Res>
    implements $ProductImageCopyWith<$Res> {
  factory _$$ProductImageImplCopyWith(
          _$ProductImageImpl value, $Res Function(_$ProductImageImpl) then) =
      __$$ProductImageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String url});
}

/// @nodoc
class __$$ProductImageImplCopyWithImpl<$Res>
    extends _$ProductImageCopyWithImpl<$Res, _$ProductImageImpl>
    implements _$$ProductImageImplCopyWith<$Res> {
  __$$ProductImageImplCopyWithImpl(
      _$ProductImageImpl _value, $Res Function(_$ProductImageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductImage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? url = null,
  }) {
    return _then(_$ProductImageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      url: null == url
          ? _value.url
          : url // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductImageImpl implements _ProductImage {
  const _$ProductImageImpl({required this.id, required this.url});

  factory _$ProductImageImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductImageImplFromJson(json);

  @override
  final String id;
  @override
  final String url;

  @override
  String toString() {
    return 'ProductImage(id: $id, url: $url)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductImageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.url, url) || other.url == url));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, url);

  /// Create a copy of ProductImage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductImageImplCopyWith<_$ProductImageImpl> get copyWith =>
      __$$ProductImageImplCopyWithImpl<_$ProductImageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductImageImplToJson(
      this,
    );
  }
}

abstract class _ProductImage implements ProductImage {
  const factory _ProductImage(
      {required final String id,
      required final String url}) = _$ProductImageImpl;

  factory _ProductImage.fromJson(Map<String, dynamic> json) =
      _$ProductImageImpl.fromJson;

  @override
  String get id;
  @override
  String get url;

  /// Create a copy of ProductImage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductImageImplCopyWith<_$ProductImageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductVariant _$ProductVariantFromJson(Map<String, dynamic> json) {
  return _ProductVariant.fromJson(json);
}

/// @nodoc
mixin _$ProductVariant {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;
  String? get thumbnail => throw _privateConstructorUsedError;
  List<ProductPrice> get prices => throw _privateConstructorUsedError;
  @JsonKey(name: "inventory_quantity")
  num? get inventoryQuantity => throw _privateConstructorUsedError;
  @JsonKey(name: "manage_inventory")
  bool? get manageInventory => throw _privateConstructorUsedError;
  @JsonKey(name: "allow_backorder")
  bool? get allowBackorder => throw _privateConstructorUsedError;

  /// Serializes this ProductVariant to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductVariantCopyWith<ProductVariant> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductVariantCopyWith<$Res> {
  factory $ProductVariantCopyWith(
          ProductVariant value, $Res Function(ProductVariant) then) =
      _$ProductVariantCopyWithImpl<$Res, ProductVariant>;
  @useResult
  $Res call(
      {String id,
      String title,
      String? sku,
      String? thumbnail,
      List<ProductPrice> prices,
      @JsonKey(name: "inventory_quantity") num? inventoryQuantity,
      @JsonKey(name: "manage_inventory") bool? manageInventory,
      @JsonKey(name: "allow_backorder") bool? allowBackorder});
}

/// @nodoc
class _$ProductVariantCopyWithImpl<$Res, $Val extends ProductVariant>
    implements $ProductVariantCopyWith<$Res> {
  _$ProductVariantCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? sku = freezed,
    Object? thumbnail = freezed,
    Object? prices = null,
    Object? inventoryQuantity = freezed,
    Object? manageInventory = freezed,
    Object? allowBackorder = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      prices: null == prices
          ? _value.prices
          : prices // ignore: cast_nullable_to_non_nullable
              as List<ProductPrice>,
      inventoryQuantity: freezed == inventoryQuantity
          ? _value.inventoryQuantity
          : inventoryQuantity // ignore: cast_nullable_to_non_nullable
              as num?,
      manageInventory: freezed == manageInventory
          ? _value.manageInventory
          : manageInventory // ignore: cast_nullable_to_non_nullable
              as bool?,
      allowBackorder: freezed == allowBackorder
          ? _value.allowBackorder
          : allowBackorder // ignore: cast_nullable_to_non_nullable
              as bool?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductVariantImplCopyWith<$Res>
    implements $ProductVariantCopyWith<$Res> {
  factory _$$ProductVariantImplCopyWith(_$ProductVariantImpl value,
          $Res Function(_$ProductVariantImpl) then) =
      __$$ProductVariantImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? sku,
      String? thumbnail,
      List<ProductPrice> prices,
      @JsonKey(name: "inventory_quantity") num? inventoryQuantity,
      @JsonKey(name: "manage_inventory") bool? manageInventory,
      @JsonKey(name: "allow_backorder") bool? allowBackorder});
}

/// @nodoc
class __$$ProductVariantImplCopyWithImpl<$Res>
    extends _$ProductVariantCopyWithImpl<$Res, _$ProductVariantImpl>
    implements _$$ProductVariantImplCopyWith<$Res> {
  __$$ProductVariantImplCopyWithImpl(
      _$ProductVariantImpl _value, $Res Function(_$ProductVariantImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? sku = freezed,
    Object? thumbnail = freezed,
    Object? prices = null,
    Object? inventoryQuantity = freezed,
    Object? manageInventory = freezed,
    Object? allowBackorder = freezed,
  }) {
    return _then(_$ProductVariantImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      prices: null == prices
          ? _value._prices
          : prices // ignore: cast_nullable_to_non_nullable
              as List<ProductPrice>,
      inventoryQuantity: freezed == inventoryQuantity
          ? _value.inventoryQuantity
          : inventoryQuantity // ignore: cast_nullable_to_non_nullable
              as num?,
      manageInventory: freezed == manageInventory
          ? _value.manageInventory
          : manageInventory // ignore: cast_nullable_to_non_nullable
              as bool?,
      allowBackorder: freezed == allowBackorder
          ? _value.allowBackorder
          : allowBackorder // ignore: cast_nullable_to_non_nullable
              as bool?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductVariantImpl implements _ProductVariant {
  const _$ProductVariantImpl(
      {required this.id,
      this.title = "",
      this.sku,
      this.thumbnail,
      final List<ProductPrice> prices = const <ProductPrice>[],
      @JsonKey(name: "inventory_quantity") this.inventoryQuantity,
      @JsonKey(name: "manage_inventory") this.manageInventory,
      @JsonKey(name: "allow_backorder") this.allowBackorder})
      : _prices = prices;

  factory _$ProductVariantImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductVariantImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String title;
  @override
  final String? sku;
  @override
  final String? thumbnail;
  final List<ProductPrice> _prices;
  @override
  @JsonKey()
  List<ProductPrice> get prices {
    if (_prices is EqualUnmodifiableListView) return _prices;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_prices);
  }

  @override
  @JsonKey(name: "inventory_quantity")
  final num? inventoryQuantity;
  @override
  @JsonKey(name: "manage_inventory")
  final bool? manageInventory;
  @override
  @JsonKey(name: "allow_backorder")
  final bool? allowBackorder;

  @override
  String toString() {
    return 'ProductVariant(id: $id, title: $title, sku: $sku, thumbnail: $thumbnail, prices: $prices, inventoryQuantity: $inventoryQuantity, manageInventory: $manageInventory, allowBackorder: $allowBackorder)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductVariantImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            const DeepCollectionEquality().equals(other._prices, _prices) &&
            (identical(other.inventoryQuantity, inventoryQuantity) ||
                other.inventoryQuantity == inventoryQuantity) &&
            (identical(other.manageInventory, manageInventory) ||
                other.manageInventory == manageInventory) &&
            (identical(other.allowBackorder, allowBackorder) ||
                other.allowBackorder == allowBackorder));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      sku,
      thumbnail,
      const DeepCollectionEquality().hash(_prices),
      inventoryQuantity,
      manageInventory,
      allowBackorder);

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductVariantImplCopyWith<_$ProductVariantImpl> get copyWith =>
      __$$ProductVariantImplCopyWithImpl<_$ProductVariantImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductVariantImplToJson(
      this,
    );
  }
}

abstract class _ProductVariant implements ProductVariant {
  const factory _ProductVariant(
          {required final String id,
          final String title,
          final String? sku,
          final String? thumbnail,
          final List<ProductPrice> prices,
          @JsonKey(name: "inventory_quantity") final num? inventoryQuantity,
          @JsonKey(name: "manage_inventory") final bool? manageInventory,
          @JsonKey(name: "allow_backorder") final bool? allowBackorder}) =
      _$ProductVariantImpl;

  factory _ProductVariant.fromJson(Map<String, dynamic> json) =
      _$ProductVariantImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String? get sku;
  @override
  String? get thumbnail;
  @override
  List<ProductPrice> get prices;
  @override
  @JsonKey(name: "inventory_quantity")
  num? get inventoryQuantity;
  @override
  @JsonKey(name: "manage_inventory")
  bool? get manageInventory;
  @override
  @JsonKey(name: "allow_backorder")
  bool? get allowBackorder;

  /// Create a copy of ProductVariant
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductVariantImplCopyWith<_$ProductVariantImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductCollection _$ProductCollectionFromJson(Map<String, dynamic> json) {
  return _ProductCollection.fromJson(json);
}

/// @nodoc
mixin _$ProductCollection {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;

  /// Serializes this ProductCollection to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductCollection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductCollectionCopyWith<ProductCollection> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductCollectionCopyWith<$Res> {
  factory $ProductCollectionCopyWith(
          ProductCollection value, $Res Function(ProductCollection) then) =
      _$ProductCollectionCopyWithImpl<$Res, ProductCollection>;
  @useResult
  $Res call({String id, String title});
}

/// @nodoc
class _$ProductCollectionCopyWithImpl<$Res, $Val extends ProductCollection>
    implements $ProductCollectionCopyWith<$Res> {
  _$ProductCollectionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductCollection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductCollectionImplCopyWith<$Res>
    implements $ProductCollectionCopyWith<$Res> {
  factory _$$ProductCollectionImplCopyWith(_$ProductCollectionImpl value,
          $Res Function(_$ProductCollectionImpl) then) =
      __$$ProductCollectionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String title});
}

/// @nodoc
class __$$ProductCollectionImplCopyWithImpl<$Res>
    extends _$ProductCollectionCopyWithImpl<$Res, _$ProductCollectionImpl>
    implements _$$ProductCollectionImplCopyWith<$Res> {
  __$$ProductCollectionImplCopyWithImpl(_$ProductCollectionImpl _value,
      $Res Function(_$ProductCollectionImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductCollection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
  }) {
    return _then(_$ProductCollectionImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductCollectionImpl implements _ProductCollection {
  const _$ProductCollectionImpl({required this.id, this.title = ""});

  factory _$ProductCollectionImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductCollectionImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String title;

  @override
  String toString() {
    return 'ProductCollection(id: $id, title: $title)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductCollectionImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, title);

  /// Create a copy of ProductCollection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductCollectionImplCopyWith<_$ProductCollectionImpl> get copyWith =>
      __$$ProductCollectionImplCopyWithImpl<_$ProductCollectionImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductCollectionImplToJson(
      this,
    );
  }
}

abstract class _ProductCollection implements ProductCollection {
  const factory _ProductCollection(
      {required final String id, final String title}) = _$ProductCollectionImpl;

  factory _ProductCollection.fromJson(Map<String, dynamic> json) =
      _$ProductCollectionImpl.fromJson;

  @override
  String get id;
  @override
  String get title;

  /// Create a copy of ProductCollection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductCollectionImplCopyWith<_$ProductCollectionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductType _$ProductTypeFromJson(Map<String, dynamic> json) {
  return _ProductType.fromJson(json);
}

/// @nodoc
mixin _$ProductType {
  String get id => throw _privateConstructorUsedError;
  String get value => throw _privateConstructorUsedError;

  /// Serializes this ProductType to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductType
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductTypeCopyWith<ProductType> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductTypeCopyWith<$Res> {
  factory $ProductTypeCopyWith(
          ProductType value, $Res Function(ProductType) then) =
      _$ProductTypeCopyWithImpl<$Res, ProductType>;
  @useResult
  $Res call({String id, String value});
}

/// @nodoc
class _$ProductTypeCopyWithImpl<$Res, $Val extends ProductType>
    implements $ProductTypeCopyWith<$Res> {
  _$ProductTypeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductType
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? value = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductTypeImplCopyWith<$Res>
    implements $ProductTypeCopyWith<$Res> {
  factory _$$ProductTypeImplCopyWith(
          _$ProductTypeImpl value, $Res Function(_$ProductTypeImpl) then) =
      __$$ProductTypeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String value});
}

/// @nodoc
class __$$ProductTypeImplCopyWithImpl<$Res>
    extends _$ProductTypeCopyWithImpl<$Res, _$ProductTypeImpl>
    implements _$$ProductTypeImplCopyWith<$Res> {
  __$$ProductTypeImplCopyWithImpl(
      _$ProductTypeImpl _value, $Res Function(_$ProductTypeImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductType
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? value = null,
  }) {
    return _then(_$ProductTypeImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductTypeImpl implements _ProductType {
  const _$ProductTypeImpl({required this.id, this.value = ""});

  factory _$ProductTypeImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductTypeImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String value;

  @override
  String toString() {
    return 'ProductType(id: $id, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductTypeImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.value, value) || other.value == value));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, value);

  /// Create a copy of ProductType
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductTypeImplCopyWith<_$ProductTypeImpl> get copyWith =>
      __$$ProductTypeImplCopyWithImpl<_$ProductTypeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductTypeImplToJson(
      this,
    );
  }
}

abstract class _ProductType implements ProductType {
  const factory _ProductType({required final String id, final String value}) =
      _$ProductTypeImpl;

  factory _ProductType.fromJson(Map<String, dynamic> json) =
      _$ProductTypeImpl.fromJson;

  @override
  String get id;
  @override
  String get value;

  /// Create a copy of ProductType
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductTypeImplCopyWith<_$ProductTypeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductTag _$ProductTagFromJson(Map<String, dynamic> json) {
  return _ProductTag.fromJson(json);
}

/// @nodoc
mixin _$ProductTag {
  String get id => throw _privateConstructorUsedError;
  String get value => throw _privateConstructorUsedError;

  /// Serializes this ProductTag to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductTag
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductTagCopyWith<ProductTag> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductTagCopyWith<$Res> {
  factory $ProductTagCopyWith(
          ProductTag value, $Res Function(ProductTag) then) =
      _$ProductTagCopyWithImpl<$Res, ProductTag>;
  @useResult
  $Res call({String id, String value});
}

/// @nodoc
class _$ProductTagCopyWithImpl<$Res, $Val extends ProductTag>
    implements $ProductTagCopyWith<$Res> {
  _$ProductTagCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductTag
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? value = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductTagImplCopyWith<$Res>
    implements $ProductTagCopyWith<$Res> {
  factory _$$ProductTagImplCopyWith(
          _$ProductTagImpl value, $Res Function(_$ProductTagImpl) then) =
      __$$ProductTagImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String value});
}

/// @nodoc
class __$$ProductTagImplCopyWithImpl<$Res>
    extends _$ProductTagCopyWithImpl<$Res, _$ProductTagImpl>
    implements _$$ProductTagImplCopyWith<$Res> {
  __$$ProductTagImplCopyWithImpl(
      _$ProductTagImpl _value, $Res Function(_$ProductTagImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductTag
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? value = null,
  }) {
    return _then(_$ProductTagImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductTagImpl implements _ProductTag {
  const _$ProductTagImpl({required this.id, this.value = ""});

  factory _$ProductTagImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductTagImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String value;

  @override
  String toString() {
    return 'ProductTag(id: $id, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductTagImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.value, value) || other.value == value));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, value);

  /// Create a copy of ProductTag
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductTagImplCopyWith<_$ProductTagImpl> get copyWith =>
      __$$ProductTagImplCopyWithImpl<_$ProductTagImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductTagImplToJson(
      this,
    );
  }
}

abstract class _ProductTag implements ProductTag {
  const factory _ProductTag({required final String id, final String value}) =
      _$ProductTagImpl;

  factory _ProductTag.fromJson(Map<String, dynamic> json) =
      _$ProductTagImpl.fromJson;

  @override
  String get id;
  @override
  String get value;

  /// Create a copy of ProductTag
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductTagImplCopyWith<_$ProductTagImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductDetail _$ProductDetailFromJson(Map<String, dynamic> json) {
  return _ProductDetail.fromJson(json);
}

/// @nodoc
mixin _$ProductDetail {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get handle => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get subtitle => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get thumbnail => throw _privateConstructorUsedError;
  List<ProductVariant> get variants => throw _privateConstructorUsedError;
  List<ProductImage> get images => throw _privateConstructorUsedError;
  List<ProductTag> get tags => throw _privateConstructorUsedError;
  ProductCollection? get collection => throw _privateConstructorUsedError;
  ProductType? get type => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "updated_at")
  String? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this ProductDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductDetailCopyWith<ProductDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductDetailCopyWith<$Res> {
  factory $ProductDetailCopyWith(
          ProductDetail value, $Res Function(ProductDetail) then) =
      _$ProductDetailCopyWithImpl<$Res, ProductDetail>;
  @useResult
  $Res call(
      {String id,
      String title,
      String handle,
      String status,
      String? subtitle,
      String? description,
      String? thumbnail,
      List<ProductVariant> variants,
      List<ProductImage> images,
      List<ProductTag> tags,
      ProductCollection? collection,
      ProductType? type,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "updated_at") String? updatedAt});

  $ProductCollectionCopyWith<$Res>? get collection;
  $ProductTypeCopyWith<$Res>? get type;
}

/// @nodoc
class _$ProductDetailCopyWithImpl<$Res, $Val extends ProductDetail>
    implements $ProductDetailCopyWith<$Res> {
  _$ProductDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? handle = null,
    Object? status = null,
    Object? subtitle = freezed,
    Object? description = freezed,
    Object? thumbnail = freezed,
    Object? variants = null,
    Object? images = null,
    Object? tags = null,
    Object? collection = freezed,
    Object? type = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      handle: null == handle
          ? _value.handle
          : handle // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      subtitle: freezed == subtitle
          ? _value.subtitle
          : subtitle // ignore: cast_nullable_to_non_nullable
              as String?,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      variants: null == variants
          ? _value.variants
          : variants // ignore: cast_nullable_to_non_nullable
              as List<ProductVariant>,
      images: null == images
          ? _value.images
          : images // ignore: cast_nullable_to_non_nullable
              as List<ProductImage>,
      tags: null == tags
          ? _value.tags
          : tags // ignore: cast_nullable_to_non_nullable
              as List<ProductTag>,
      collection: freezed == collection
          ? _value.collection
          : collection // ignore: cast_nullable_to_non_nullable
              as ProductCollection?,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ProductType?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductCollectionCopyWith<$Res>? get collection {
    if (_value.collection == null) {
      return null;
    }

    return $ProductCollectionCopyWith<$Res>(_value.collection!, (value) {
      return _then(_value.copyWith(collection: value) as $Val);
    });
  }

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductTypeCopyWith<$Res>? get type {
    if (_value.type == null) {
      return null;
    }

    return $ProductTypeCopyWith<$Res>(_value.type!, (value) {
      return _then(_value.copyWith(type: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ProductDetailImplCopyWith<$Res>
    implements $ProductDetailCopyWith<$Res> {
  factory _$$ProductDetailImplCopyWith(
          _$ProductDetailImpl value, $Res Function(_$ProductDetailImpl) then) =
      __$$ProductDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String handle,
      String status,
      String? subtitle,
      String? description,
      String? thumbnail,
      List<ProductVariant> variants,
      List<ProductImage> images,
      List<ProductTag> tags,
      ProductCollection? collection,
      ProductType? type,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "updated_at") String? updatedAt});

  @override
  $ProductCollectionCopyWith<$Res>? get collection;
  @override
  $ProductTypeCopyWith<$Res>? get type;
}

/// @nodoc
class __$$ProductDetailImplCopyWithImpl<$Res>
    extends _$ProductDetailCopyWithImpl<$Res, _$ProductDetailImpl>
    implements _$$ProductDetailImplCopyWith<$Res> {
  __$$ProductDetailImplCopyWithImpl(
      _$ProductDetailImpl _value, $Res Function(_$ProductDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? handle = null,
    Object? status = null,
    Object? subtitle = freezed,
    Object? description = freezed,
    Object? thumbnail = freezed,
    Object? variants = null,
    Object? images = null,
    Object? tags = null,
    Object? collection = freezed,
    Object? type = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_$ProductDetailImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      handle: null == handle
          ? _value.handle
          : handle // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      subtitle: freezed == subtitle
          ? _value.subtitle
          : subtitle // ignore: cast_nullable_to_non_nullable
              as String?,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      variants: null == variants
          ? _value._variants
          : variants // ignore: cast_nullable_to_non_nullable
              as List<ProductVariant>,
      images: null == images
          ? _value._images
          : images // ignore: cast_nullable_to_non_nullable
              as List<ProductImage>,
      tags: null == tags
          ? _value._tags
          : tags // ignore: cast_nullable_to_non_nullable
              as List<ProductTag>,
      collection: freezed == collection
          ? _value.collection
          : collection // ignore: cast_nullable_to_non_nullable
              as ProductCollection?,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ProductType?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductDetailImpl implements _ProductDetail {
  const _$ProductDetailImpl(
      {required this.id,
      required this.title,
      this.handle = "",
      this.status = "draft",
      this.subtitle,
      this.description,
      this.thumbnail,
      final List<ProductVariant> variants = const <ProductVariant>[],
      final List<ProductImage> images = const <ProductImage>[],
      final List<ProductTag> tags = const <ProductTag>[],
      this.collection,
      this.type,
      @JsonKey(name: "created_at") this.createdAt,
      @JsonKey(name: "updated_at") this.updatedAt})
      : _variants = variants,
        _images = images,
        _tags = tags;

  factory _$ProductDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductDetailImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  @JsonKey()
  final String handle;
  @override
  @JsonKey()
  final String status;
  @override
  final String? subtitle;
  @override
  final String? description;
  @override
  final String? thumbnail;
  final List<ProductVariant> _variants;
  @override
  @JsonKey()
  List<ProductVariant> get variants {
    if (_variants is EqualUnmodifiableListView) return _variants;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_variants);
  }

  final List<ProductImage> _images;
  @override
  @JsonKey()
  List<ProductImage> get images {
    if (_images is EqualUnmodifiableListView) return _images;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_images);
  }

  final List<ProductTag> _tags;
  @override
  @JsonKey()
  List<ProductTag> get tags {
    if (_tags is EqualUnmodifiableListView) return _tags;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tags);
  }

  @override
  final ProductCollection? collection;
  @override
  final ProductType? type;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  @JsonKey(name: "updated_at")
  final String? updatedAt;

  @override
  String toString() {
    return 'ProductDetail(id: $id, title: $title, handle: $handle, status: $status, subtitle: $subtitle, description: $description, thumbnail: $thumbnail, variants: $variants, images: $images, tags: $tags, collection: $collection, type: $type, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductDetailImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.handle, handle) || other.handle == handle) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.subtitle, subtitle) ||
                other.subtitle == subtitle) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            const DeepCollectionEquality().equals(other._variants, _variants) &&
            const DeepCollectionEquality().equals(other._images, _images) &&
            const DeepCollectionEquality().equals(other._tags, _tags) &&
            (identical(other.collection, collection) ||
                other.collection == collection) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      handle,
      status,
      subtitle,
      description,
      thumbnail,
      const DeepCollectionEquality().hash(_variants),
      const DeepCollectionEquality().hash(_images),
      const DeepCollectionEquality().hash(_tags),
      collection,
      type,
      createdAt,
      updatedAt);

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductDetailImplCopyWith<_$ProductDetailImpl> get copyWith =>
      __$$ProductDetailImplCopyWithImpl<_$ProductDetailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductDetailImplToJson(
      this,
    );
  }
}

abstract class _ProductDetail implements ProductDetail {
  const factory _ProductDetail(
          {required final String id,
          required final String title,
          final String handle,
          final String status,
          final String? subtitle,
          final String? description,
          final String? thumbnail,
          final List<ProductVariant> variants,
          final List<ProductImage> images,
          final List<ProductTag> tags,
          final ProductCollection? collection,
          final ProductType? type,
          @JsonKey(name: "created_at") final String? createdAt,
          @JsonKey(name: "updated_at") final String? updatedAt}) =
      _$ProductDetailImpl;

  factory _ProductDetail.fromJson(Map<String, dynamic> json) =
      _$ProductDetailImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get handle;
  @override
  String get status;
  @override
  String? get subtitle;
  @override
  String? get description;
  @override
  String? get thumbnail;
  @override
  List<ProductVariant> get variants;
  @override
  List<ProductImage> get images;
  @override
  List<ProductTag> get tags;
  @override
  ProductCollection? get collection;
  @override
  ProductType? get type;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  @JsonKey(name: "updated_at")
  String? get updatedAt;

  /// Create a copy of ProductDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductDetailImplCopyWith<_$ProductDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProductDetailResponse _$ProductDetailResponseFromJson(
    Map<String, dynamic> json) {
  return _ProductDetailResponse.fromJson(json);
}

/// @nodoc
mixin _$ProductDetailResponse {
  ProductDetail get product => throw _privateConstructorUsedError;

  /// Serializes this ProductDetailResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductDetailResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductDetailResponseCopyWith<ProductDetailResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductDetailResponseCopyWith<$Res> {
  factory $ProductDetailResponseCopyWith(ProductDetailResponse value,
          $Res Function(ProductDetailResponse) then) =
      _$ProductDetailResponseCopyWithImpl<$Res, ProductDetailResponse>;
  @useResult
  $Res call({ProductDetail product});

  $ProductDetailCopyWith<$Res> get product;
}

/// @nodoc
class _$ProductDetailResponseCopyWithImpl<$Res,
        $Val extends ProductDetailResponse>
    implements $ProductDetailResponseCopyWith<$Res> {
  _$ProductDetailResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductDetailResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? product = null,
  }) {
    return _then(_value.copyWith(
      product: null == product
          ? _value.product
          : product // ignore: cast_nullable_to_non_nullable
              as ProductDetail,
    ) as $Val);
  }

  /// Create a copy of ProductDetailResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProductDetailCopyWith<$Res> get product {
    return $ProductDetailCopyWith<$Res>(_value.product, (value) {
      return _then(_value.copyWith(product: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ProductDetailResponseImplCopyWith<$Res>
    implements $ProductDetailResponseCopyWith<$Res> {
  factory _$$ProductDetailResponseImplCopyWith(
          _$ProductDetailResponseImpl value,
          $Res Function(_$ProductDetailResponseImpl) then) =
      __$$ProductDetailResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({ProductDetail product});

  @override
  $ProductDetailCopyWith<$Res> get product;
}

/// @nodoc
class __$$ProductDetailResponseImplCopyWithImpl<$Res>
    extends _$ProductDetailResponseCopyWithImpl<$Res,
        _$ProductDetailResponseImpl>
    implements _$$ProductDetailResponseImplCopyWith<$Res> {
  __$$ProductDetailResponseImplCopyWithImpl(_$ProductDetailResponseImpl _value,
      $Res Function(_$ProductDetailResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductDetailResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? product = null,
  }) {
    return _then(_$ProductDetailResponseImpl(
      product: null == product
          ? _value.product
          : product // ignore: cast_nullable_to_non_nullable
              as ProductDetail,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductDetailResponseImpl implements _ProductDetailResponse {
  const _$ProductDetailResponseImpl({required this.product});

  factory _$ProductDetailResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductDetailResponseImplFromJson(json);

  @override
  final ProductDetail product;

  @override
  String toString() {
    return 'ProductDetailResponse(product: $product)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductDetailResponseImpl &&
            (identical(other.product, product) || other.product == product));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, product);

  /// Create a copy of ProductDetailResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductDetailResponseImplCopyWith<_$ProductDetailResponseImpl>
      get copyWith => __$$ProductDetailResponseImplCopyWithImpl<
          _$ProductDetailResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductDetailResponseImplToJson(
      this,
    );
  }
}

abstract class _ProductDetailResponse implements ProductDetailResponse {
  const factory _ProductDetailResponse({required final ProductDetail product}) =
      _$ProductDetailResponseImpl;

  factory _ProductDetailResponse.fromJson(Map<String, dynamic> json) =
      _$ProductDetailResponseImpl.fromJson;

  @override
  ProductDetail get product;

  /// Create a copy of ProductDetailResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductDetailResponseImplCopyWith<_$ProductDetailResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

StoreCurrencies _$StoreCurrenciesFromJson(Map<String, dynamic> json) {
  return _StoreCurrencies.fromJson(json);
}

/// @nodoc
mixin _$StoreCurrencies {
  List<String> get currencies => throw _privateConstructorUsedError;
  @JsonKey(name: "default_currency")
  String get defaultCurrency => throw _privateConstructorUsedError;

  /// Serializes this StoreCurrencies to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StoreCurrencies
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StoreCurrenciesCopyWith<StoreCurrencies> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StoreCurrenciesCopyWith<$Res> {
  factory $StoreCurrenciesCopyWith(
          StoreCurrencies value, $Res Function(StoreCurrencies) then) =
      _$StoreCurrenciesCopyWithImpl<$Res, StoreCurrencies>;
  @useResult
  $Res call(
      {List<String> currencies,
      @JsonKey(name: "default_currency") String defaultCurrency});
}

/// @nodoc
class _$StoreCurrenciesCopyWithImpl<$Res, $Val extends StoreCurrencies>
    implements $StoreCurrenciesCopyWith<$Res> {
  _$StoreCurrenciesCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StoreCurrencies
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currencies = null,
    Object? defaultCurrency = null,
  }) {
    return _then(_value.copyWith(
      currencies: null == currencies
          ? _value.currencies
          : currencies // ignore: cast_nullable_to_non_nullable
              as List<String>,
      defaultCurrency: null == defaultCurrency
          ? _value.defaultCurrency
          : defaultCurrency // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StoreCurrenciesImplCopyWith<$Res>
    implements $StoreCurrenciesCopyWith<$Res> {
  factory _$$StoreCurrenciesImplCopyWith(_$StoreCurrenciesImpl value,
          $Res Function(_$StoreCurrenciesImpl) then) =
      __$$StoreCurrenciesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<String> currencies,
      @JsonKey(name: "default_currency") String defaultCurrency});
}

/// @nodoc
class __$$StoreCurrenciesImplCopyWithImpl<$Res>
    extends _$StoreCurrenciesCopyWithImpl<$Res, _$StoreCurrenciesImpl>
    implements _$$StoreCurrenciesImplCopyWith<$Res> {
  __$$StoreCurrenciesImplCopyWithImpl(
      _$StoreCurrenciesImpl _value, $Res Function(_$StoreCurrenciesImpl) _then)
      : super(_value, _then);

  /// Create a copy of StoreCurrencies
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currencies = null,
    Object? defaultCurrency = null,
  }) {
    return _then(_$StoreCurrenciesImpl(
      currencies: null == currencies
          ? _value._currencies
          : currencies // ignore: cast_nullable_to_non_nullable
              as List<String>,
      defaultCurrency: null == defaultCurrency
          ? _value.defaultCurrency
          : defaultCurrency // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StoreCurrenciesImpl implements _StoreCurrencies {
  const _$StoreCurrenciesImpl(
      {final List<String> currencies = const <String>["usd"],
      @JsonKey(name: "default_currency") this.defaultCurrency = "usd"})
      : _currencies = currencies;

  factory _$StoreCurrenciesImpl.fromJson(Map<String, dynamic> json) =>
      _$$StoreCurrenciesImplFromJson(json);

  final List<String> _currencies;
  @override
  @JsonKey()
  List<String> get currencies {
    if (_currencies is EqualUnmodifiableListView) return _currencies;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_currencies);
  }

  @override
  @JsonKey(name: "default_currency")
  final String defaultCurrency;

  @override
  String toString() {
    return 'StoreCurrencies(currencies: $currencies, defaultCurrency: $defaultCurrency)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StoreCurrenciesImpl &&
            const DeepCollectionEquality()
                .equals(other._currencies, _currencies) &&
            (identical(other.defaultCurrency, defaultCurrency) ||
                other.defaultCurrency == defaultCurrency));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_currencies), defaultCurrency);

  /// Create a copy of StoreCurrencies
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StoreCurrenciesImplCopyWith<_$StoreCurrenciesImpl> get copyWith =>
      __$$StoreCurrenciesImplCopyWithImpl<_$StoreCurrenciesImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StoreCurrenciesImplToJson(
      this,
    );
  }
}

abstract class _StoreCurrencies implements StoreCurrencies {
  const factory _StoreCurrencies(
          {final List<String> currencies,
          @JsonKey(name: "default_currency") final String defaultCurrency}) =
      _$StoreCurrenciesImpl;

  factory _StoreCurrencies.fromJson(Map<String, dynamic> json) =
      _$StoreCurrenciesImpl.fromJson;

  @override
  List<String> get currencies;
  @override
  @JsonKey(name: "default_currency")
  String get defaultCurrency;

  /// Create a copy of StoreCurrencies
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StoreCurrenciesImplCopyWith<_$StoreCurrenciesImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StockLocation _$StockLocationFromJson(Map<String, dynamic> json) {
  return _StockLocation.fromJson(json);
}

/// @nodoc
mixin _$StockLocation {
  @JsonKey(name: "location_id")
  String get locationId => throw _privateConstructorUsedError;
  @JsonKey(name: "location_name")
  String get locationName => throw _privateConstructorUsedError;
  @JsonKey(name: "stocked_quantity")
  num get stockedQuantity => throw _privateConstructorUsedError;
  @JsonKey(name: "reserved_quantity")
  num get reservedQuantity => throw _privateConstructorUsedError;

  /// Serializes this StockLocation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StockLocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StockLocationCopyWith<StockLocation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StockLocationCopyWith<$Res> {
  factory $StockLocationCopyWith(
          StockLocation value, $Res Function(StockLocation) then) =
      _$StockLocationCopyWithImpl<$Res, StockLocation>;
  @useResult
  $Res call(
      {@JsonKey(name: "location_id") String locationId,
      @JsonKey(name: "location_name") String locationName,
      @JsonKey(name: "stocked_quantity") num stockedQuantity,
      @JsonKey(name: "reserved_quantity") num reservedQuantity});
}

/// @nodoc
class _$StockLocationCopyWithImpl<$Res, $Val extends StockLocation>
    implements $StockLocationCopyWith<$Res> {
  _$StockLocationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StockLocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? locationId = null,
    Object? locationName = null,
    Object? stockedQuantity = null,
    Object? reservedQuantity = null,
  }) {
    return _then(_value.copyWith(
      locationId: null == locationId
          ? _value.locationId
          : locationId // ignore: cast_nullable_to_non_nullable
              as String,
      locationName: null == locationName
          ? _value.locationName
          : locationName // ignore: cast_nullable_to_non_nullable
              as String,
      stockedQuantity: null == stockedQuantity
          ? _value.stockedQuantity
          : stockedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      reservedQuantity: null == reservedQuantity
          ? _value.reservedQuantity
          : reservedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StockLocationImplCopyWith<$Res>
    implements $StockLocationCopyWith<$Res> {
  factory _$$StockLocationImplCopyWith(
          _$StockLocationImpl value, $Res Function(_$StockLocationImpl) then) =
      __$$StockLocationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "location_id") String locationId,
      @JsonKey(name: "location_name") String locationName,
      @JsonKey(name: "stocked_quantity") num stockedQuantity,
      @JsonKey(name: "reserved_quantity") num reservedQuantity});
}

/// @nodoc
class __$$StockLocationImplCopyWithImpl<$Res>
    extends _$StockLocationCopyWithImpl<$Res, _$StockLocationImpl>
    implements _$$StockLocationImplCopyWith<$Res> {
  __$$StockLocationImplCopyWithImpl(
      _$StockLocationImpl _value, $Res Function(_$StockLocationImpl) _then)
      : super(_value, _then);

  /// Create a copy of StockLocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? locationId = null,
    Object? locationName = null,
    Object? stockedQuantity = null,
    Object? reservedQuantity = null,
  }) {
    return _then(_$StockLocationImpl(
      locationId: null == locationId
          ? _value.locationId
          : locationId // ignore: cast_nullable_to_non_nullable
              as String,
      locationName: null == locationName
          ? _value.locationName
          : locationName // ignore: cast_nullable_to_non_nullable
              as String,
      stockedQuantity: null == stockedQuantity
          ? _value.stockedQuantity
          : stockedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      reservedQuantity: null == reservedQuantity
          ? _value.reservedQuantity
          : reservedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StockLocationImpl implements _StockLocation {
  const _$StockLocationImpl(
      {@JsonKey(name: "location_id") required this.locationId,
      @JsonKey(name: "location_name") this.locationName = "",
      @JsonKey(name: "stocked_quantity") this.stockedQuantity = 0,
      @JsonKey(name: "reserved_quantity") this.reservedQuantity = 0});

  factory _$StockLocationImpl.fromJson(Map<String, dynamic> json) =>
      _$$StockLocationImplFromJson(json);

  @override
  @JsonKey(name: "location_id")
  final String locationId;
  @override
  @JsonKey(name: "location_name")
  final String locationName;
  @override
  @JsonKey(name: "stocked_quantity")
  final num stockedQuantity;
  @override
  @JsonKey(name: "reserved_quantity")
  final num reservedQuantity;

  @override
  String toString() {
    return 'StockLocation(locationId: $locationId, locationName: $locationName, stockedQuantity: $stockedQuantity, reservedQuantity: $reservedQuantity)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StockLocationImpl &&
            (identical(other.locationId, locationId) ||
                other.locationId == locationId) &&
            (identical(other.locationName, locationName) ||
                other.locationName == locationName) &&
            (identical(other.stockedQuantity, stockedQuantity) ||
                other.stockedQuantity == stockedQuantity) &&
            (identical(other.reservedQuantity, reservedQuantity) ||
                other.reservedQuantity == reservedQuantity));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, locationId, locationName, stockedQuantity, reservedQuantity);

  /// Create a copy of StockLocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StockLocationImplCopyWith<_$StockLocationImpl> get copyWith =>
      __$$StockLocationImplCopyWithImpl<_$StockLocationImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StockLocationImplToJson(
      this,
    );
  }
}

abstract class _StockLocation implements StockLocation {
  const factory _StockLocation(
          {@JsonKey(name: "location_id") required final String locationId,
          @JsonKey(name: "location_name") final String locationName,
          @JsonKey(name: "stocked_quantity") final num stockedQuantity,
          @JsonKey(name: "reserved_quantity") final num reservedQuantity}) =
      _$StockLocationImpl;

  factory _StockLocation.fromJson(Map<String, dynamic> json) =
      _$StockLocationImpl.fromJson;

  @override
  @JsonKey(name: "location_id")
  String get locationId;
  @override
  @JsonKey(name: "location_name")
  String get locationName;
  @override
  @JsonKey(name: "stocked_quantity")
  num get stockedQuantity;
  @override
  @JsonKey(name: "reserved_quantity")
  num get reservedQuantity;

  /// Create a copy of StockLocation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StockLocationImplCopyWith<_$StockLocationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StockVariant _$StockVariantFromJson(Map<String, dynamic> json) {
  return _StockVariant.fromJson(json);
}

/// @nodoc
mixin _$StockVariant {
  @JsonKey(name: "variant_id")
  String get variantId => throw _privateConstructorUsedError;
  @JsonKey(name: "variant_title")
  String get variantTitle => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;
  @JsonKey(name: "inventory_item_id")
  String? get inventoryItemId => throw _privateConstructorUsedError;
  List<StockLocation> get locations => throw _privateConstructorUsedError;

  /// Serializes this StockVariant to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StockVariant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StockVariantCopyWith<StockVariant> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StockVariantCopyWith<$Res> {
  factory $StockVariantCopyWith(
          StockVariant value, $Res Function(StockVariant) then) =
      _$StockVariantCopyWithImpl<$Res, StockVariant>;
  @useResult
  $Res call(
      {@JsonKey(name: "variant_id") String variantId,
      @JsonKey(name: "variant_title") String variantTitle,
      String? sku,
      @JsonKey(name: "inventory_item_id") String? inventoryItemId,
      List<StockLocation> locations});
}

/// @nodoc
class _$StockVariantCopyWithImpl<$Res, $Val extends StockVariant>
    implements $StockVariantCopyWith<$Res> {
  _$StockVariantCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StockVariant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? variantId = null,
    Object? variantTitle = null,
    Object? sku = freezed,
    Object? inventoryItemId = freezed,
    Object? locations = null,
  }) {
    return _then(_value.copyWith(
      variantId: null == variantId
          ? _value.variantId
          : variantId // ignore: cast_nullable_to_non_nullable
              as String,
      variantTitle: null == variantTitle
          ? _value.variantTitle
          : variantTitle // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      inventoryItemId: freezed == inventoryItemId
          ? _value.inventoryItemId
          : inventoryItemId // ignore: cast_nullable_to_non_nullable
              as String?,
      locations: null == locations
          ? _value.locations
          : locations // ignore: cast_nullable_to_non_nullable
              as List<StockLocation>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StockVariantImplCopyWith<$Res>
    implements $StockVariantCopyWith<$Res> {
  factory _$$StockVariantImplCopyWith(
          _$StockVariantImpl value, $Res Function(_$StockVariantImpl) then) =
      __$$StockVariantImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "variant_id") String variantId,
      @JsonKey(name: "variant_title") String variantTitle,
      String? sku,
      @JsonKey(name: "inventory_item_id") String? inventoryItemId,
      List<StockLocation> locations});
}

/// @nodoc
class __$$StockVariantImplCopyWithImpl<$Res>
    extends _$StockVariantCopyWithImpl<$Res, _$StockVariantImpl>
    implements _$$StockVariantImplCopyWith<$Res> {
  __$$StockVariantImplCopyWithImpl(
      _$StockVariantImpl _value, $Res Function(_$StockVariantImpl) _then)
      : super(_value, _then);

  /// Create a copy of StockVariant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? variantId = null,
    Object? variantTitle = null,
    Object? sku = freezed,
    Object? inventoryItemId = freezed,
    Object? locations = null,
  }) {
    return _then(_$StockVariantImpl(
      variantId: null == variantId
          ? _value.variantId
          : variantId // ignore: cast_nullable_to_non_nullable
              as String,
      variantTitle: null == variantTitle
          ? _value.variantTitle
          : variantTitle // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      inventoryItemId: freezed == inventoryItemId
          ? _value.inventoryItemId
          : inventoryItemId // ignore: cast_nullable_to_non_nullable
              as String?,
      locations: null == locations
          ? _value._locations
          : locations // ignore: cast_nullable_to_non_nullable
              as List<StockLocation>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StockVariantImpl implements _StockVariant {
  const _$StockVariantImpl(
      {@JsonKey(name: "variant_id") required this.variantId,
      @JsonKey(name: "variant_title") this.variantTitle = "",
      this.sku,
      @JsonKey(name: "inventory_item_id") this.inventoryItemId,
      final List<StockLocation> locations = const <StockLocation>[]})
      : _locations = locations;

  factory _$StockVariantImpl.fromJson(Map<String, dynamic> json) =>
      _$$StockVariantImplFromJson(json);

  @override
  @JsonKey(name: "variant_id")
  final String variantId;
  @override
  @JsonKey(name: "variant_title")
  final String variantTitle;
  @override
  final String? sku;
  @override
  @JsonKey(name: "inventory_item_id")
  final String? inventoryItemId;
  final List<StockLocation> _locations;
  @override
  @JsonKey()
  List<StockLocation> get locations {
    if (_locations is EqualUnmodifiableListView) return _locations;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_locations);
  }

  @override
  String toString() {
    return 'StockVariant(variantId: $variantId, variantTitle: $variantTitle, sku: $sku, inventoryItemId: $inventoryItemId, locations: $locations)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StockVariantImpl &&
            (identical(other.variantId, variantId) ||
                other.variantId == variantId) &&
            (identical(other.variantTitle, variantTitle) ||
                other.variantTitle == variantTitle) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.inventoryItemId, inventoryItemId) ||
                other.inventoryItemId == inventoryItemId) &&
            const DeepCollectionEquality()
                .equals(other._locations, _locations));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, variantId, variantTitle, sku,
      inventoryItemId, const DeepCollectionEquality().hash(_locations));

  /// Create a copy of StockVariant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StockVariantImplCopyWith<_$StockVariantImpl> get copyWith =>
      __$$StockVariantImplCopyWithImpl<_$StockVariantImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StockVariantImplToJson(
      this,
    );
  }
}

abstract class _StockVariant implements StockVariant {
  const factory _StockVariant(
      {@JsonKey(name: "variant_id") required final String variantId,
      @JsonKey(name: "variant_title") final String variantTitle,
      final String? sku,
      @JsonKey(name: "inventory_item_id") final String? inventoryItemId,
      final List<StockLocation> locations}) = _$StockVariantImpl;

  factory _StockVariant.fromJson(Map<String, dynamic> json) =
      _$StockVariantImpl.fromJson;

  @override
  @JsonKey(name: "variant_id")
  String get variantId;
  @override
  @JsonKey(name: "variant_title")
  String get variantTitle;
  @override
  String? get sku;
  @override
  @JsonKey(name: "inventory_item_id")
  String? get inventoryItemId;
  @override
  List<StockLocation> get locations;

  /// Create a copy of StockVariant
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StockVariantImplCopyWith<_$StockVariantImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StockMatrix _$StockMatrixFromJson(Map<String, dynamic> json) {
  return _StockMatrix.fromJson(json);
}

/// @nodoc
mixin _$StockMatrix {
  List<StockVariant> get variants => throw _privateConstructorUsedError;

  /// Serializes this StockMatrix to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StockMatrix
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StockMatrixCopyWith<StockMatrix> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StockMatrixCopyWith<$Res> {
  factory $StockMatrixCopyWith(
          StockMatrix value, $Res Function(StockMatrix) then) =
      _$StockMatrixCopyWithImpl<$Res, StockMatrix>;
  @useResult
  $Res call({List<StockVariant> variants});
}

/// @nodoc
class _$StockMatrixCopyWithImpl<$Res, $Val extends StockMatrix>
    implements $StockMatrixCopyWith<$Res> {
  _$StockMatrixCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StockMatrix
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? variants = null,
  }) {
    return _then(_value.copyWith(
      variants: null == variants
          ? _value.variants
          : variants // ignore: cast_nullable_to_non_nullable
              as List<StockVariant>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StockMatrixImplCopyWith<$Res>
    implements $StockMatrixCopyWith<$Res> {
  factory _$$StockMatrixImplCopyWith(
          _$StockMatrixImpl value, $Res Function(_$StockMatrixImpl) then) =
      __$$StockMatrixImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<StockVariant> variants});
}

/// @nodoc
class __$$StockMatrixImplCopyWithImpl<$Res>
    extends _$StockMatrixCopyWithImpl<$Res, _$StockMatrixImpl>
    implements _$$StockMatrixImplCopyWith<$Res> {
  __$$StockMatrixImplCopyWithImpl(
      _$StockMatrixImpl _value, $Res Function(_$StockMatrixImpl) _then)
      : super(_value, _then);

  /// Create a copy of StockMatrix
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? variants = null,
  }) {
    return _then(_$StockMatrixImpl(
      variants: null == variants
          ? _value._variants
          : variants // ignore: cast_nullable_to_non_nullable
              as List<StockVariant>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StockMatrixImpl implements _StockMatrix {
  const _$StockMatrixImpl(
      {final List<StockVariant> variants = const <StockVariant>[]})
      : _variants = variants;

  factory _$StockMatrixImpl.fromJson(Map<String, dynamic> json) =>
      _$$StockMatrixImplFromJson(json);

  final List<StockVariant> _variants;
  @override
  @JsonKey()
  List<StockVariant> get variants {
    if (_variants is EqualUnmodifiableListView) return _variants;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_variants);
  }

  @override
  String toString() {
    return 'StockMatrix(variants: $variants)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StockMatrixImpl &&
            const DeepCollectionEquality().equals(other._variants, _variants));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(_variants));

  /// Create a copy of StockMatrix
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StockMatrixImplCopyWith<_$StockMatrixImpl> get copyWith =>
      __$$StockMatrixImplCopyWithImpl<_$StockMatrixImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StockMatrixImplToJson(
      this,
    );
  }
}

abstract class _StockMatrix implements StockMatrix {
  const factory _StockMatrix({final List<StockVariant> variants}) =
      _$StockMatrixImpl;

  factory _StockMatrix.fromJson(Map<String, dynamic> json) =
      _$StockMatrixImpl.fromJson;

  @override
  List<StockVariant> get variants;

  /// Create a copy of StockMatrix
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StockMatrixImplCopyWith<_$StockMatrixImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
