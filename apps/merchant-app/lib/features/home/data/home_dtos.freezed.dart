// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'home_dtos.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

HomeOrder _$HomeOrderFromJson(Map<String, dynamic> json) {
  return _HomeOrder.fromJson(json);
}

/// @nodoc
mixin _$HomeOrder {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "display_id")
  int get displayId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "payment_status")
  String? get paymentStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "fulfillment_status")
  String? get fulfillmentStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  num get total => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String get currencyCode => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  @JsonKey(name: "customer_name")
  String? get customerName => throw _privateConstructorUsedError;
  @JsonKey(name: "item_count")
  int? get itemCount => throw _privateConstructorUsedError;

  /// Serializes this HomeOrder to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of HomeOrder
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $HomeOrderCopyWith<HomeOrder> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $HomeOrderCopyWith<$Res> {
  factory $HomeOrderCopyWith(HomeOrder value, $Res Function(HomeOrder) then) =
      _$HomeOrderCopyWithImpl<$Res, HomeOrder>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_id") int displayId,
      String status,
      @JsonKey(name: "payment_status") String? paymentStatus,
      @JsonKey(name: "fulfillment_status") String? fulfillmentStatus,
      @JsonKey(name: "created_at") String? createdAt,
      num total,
      @JsonKey(name: "currency_code") String currencyCode,
      String? email,
      @JsonKey(name: "customer_name") String? customerName,
      @JsonKey(name: "item_count") int? itemCount});
}

/// @nodoc
class _$HomeOrderCopyWithImpl<$Res, $Val extends HomeOrder>
    implements $HomeOrderCopyWith<$Res> {
  _$HomeOrderCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of HomeOrder
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
    Object? status = null,
    Object? paymentStatus = freezed,
    Object? fulfillmentStatus = freezed,
    Object? createdAt = freezed,
    Object? total = null,
    Object? currencyCode = null,
    Object? email = freezed,
    Object? customerName = freezed,
    Object? itemCount = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      displayId: null == displayId
          ? _value.displayId
          : displayId // ignore: cast_nullable_to_non_nullable
              as int,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      paymentStatus: freezed == paymentStatus
          ? _value.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      fulfillmentStatus: freezed == fulfillmentStatus
          ? _value.fulfillmentStatus
          : fulfillmentStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      customerName: freezed == customerName
          ? _value.customerName
          : customerName // ignore: cast_nullable_to_non_nullable
              as String?,
      itemCount: freezed == itemCount
          ? _value.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$HomeOrderImplCopyWith<$Res>
    implements $HomeOrderCopyWith<$Res> {
  factory _$$HomeOrderImplCopyWith(
          _$HomeOrderImpl value, $Res Function(_$HomeOrderImpl) then) =
      __$$HomeOrderImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_id") int displayId,
      String status,
      @JsonKey(name: "payment_status") String? paymentStatus,
      @JsonKey(name: "fulfillment_status") String? fulfillmentStatus,
      @JsonKey(name: "created_at") String? createdAt,
      num total,
      @JsonKey(name: "currency_code") String currencyCode,
      String? email,
      @JsonKey(name: "customer_name") String? customerName,
      @JsonKey(name: "item_count") int? itemCount});
}

/// @nodoc
class __$$HomeOrderImplCopyWithImpl<$Res>
    extends _$HomeOrderCopyWithImpl<$Res, _$HomeOrderImpl>
    implements _$$HomeOrderImplCopyWith<$Res> {
  __$$HomeOrderImplCopyWithImpl(
      _$HomeOrderImpl _value, $Res Function(_$HomeOrderImpl) _then)
      : super(_value, _then);

  /// Create a copy of HomeOrder
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
    Object? status = null,
    Object? paymentStatus = freezed,
    Object? fulfillmentStatus = freezed,
    Object? createdAt = freezed,
    Object? total = null,
    Object? currencyCode = null,
    Object? email = freezed,
    Object? customerName = freezed,
    Object? itemCount = freezed,
  }) {
    return _then(_$HomeOrderImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      displayId: null == displayId
          ? _value.displayId
          : displayId // ignore: cast_nullable_to_non_nullable
              as int,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      paymentStatus: freezed == paymentStatus
          ? _value.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      fulfillmentStatus: freezed == fulfillmentStatus
          ? _value.fulfillmentStatus
          : fulfillmentStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      customerName: freezed == customerName
          ? _value.customerName
          : customerName // ignore: cast_nullable_to_non_nullable
              as String?,
      itemCount: freezed == itemCount
          ? _value.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$HomeOrderImpl implements _HomeOrder {
  const _$HomeOrderImpl(
      {this.id = "",
      @JsonKey(name: "display_id") this.displayId = 0,
      this.status = "",
      @JsonKey(name: "payment_status") this.paymentStatus,
      @JsonKey(name: "fulfillment_status") this.fulfillmentStatus,
      @JsonKey(name: "created_at") this.createdAt,
      this.total = 0,
      @JsonKey(name: "currency_code") this.currencyCode = "USD",
      this.email,
      @JsonKey(name: "customer_name") this.customerName,
      @JsonKey(name: "item_count") this.itemCount});

  factory _$HomeOrderImpl.fromJson(Map<String, dynamic> json) =>
      _$$HomeOrderImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "display_id")
  final int displayId;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "payment_status")
  final String? paymentStatus;
  @override
  @JsonKey(name: "fulfillment_status")
  final String? fulfillmentStatus;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  @JsonKey()
  final num total;
  @override
  @JsonKey(name: "currency_code")
  final String currencyCode;
  @override
  final String? email;
  @override
  @JsonKey(name: "customer_name")
  final String? customerName;
  @override
  @JsonKey(name: "item_count")
  final int? itemCount;

  @override
  String toString() {
    return 'HomeOrder(id: $id, displayId: $displayId, status: $status, paymentStatus: $paymentStatus, fulfillmentStatus: $fulfillmentStatus, createdAt: $createdAt, total: $total, currencyCode: $currencyCode, email: $email, customerName: $customerName, itemCount: $itemCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$HomeOrderImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.displayId, displayId) ||
                other.displayId == displayId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.paymentStatus, paymentStatus) ||
                other.paymentStatus == paymentStatus) &&
            (identical(other.fulfillmentStatus, fulfillmentStatus) ||
                other.fulfillmentStatus == fulfillmentStatus) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.customerName, customerName) ||
                other.customerName == customerName) &&
            (identical(other.itemCount, itemCount) ||
                other.itemCount == itemCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      displayId,
      status,
      paymentStatus,
      fulfillmentStatus,
      createdAt,
      total,
      currencyCode,
      email,
      customerName,
      itemCount);

  /// Create a copy of HomeOrder
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$HomeOrderImplCopyWith<_$HomeOrderImpl> get copyWith =>
      __$$HomeOrderImplCopyWithImpl<_$HomeOrderImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$HomeOrderImplToJson(
      this,
    );
  }
}

abstract class _HomeOrder implements HomeOrder {
  const factory _HomeOrder(
      {final String id,
      @JsonKey(name: "display_id") final int displayId,
      final String status,
      @JsonKey(name: "payment_status") final String? paymentStatus,
      @JsonKey(name: "fulfillment_status") final String? fulfillmentStatus,
      @JsonKey(name: "created_at") final String? createdAt,
      final num total,
      @JsonKey(name: "currency_code") final String currencyCode,
      final String? email,
      @JsonKey(name: "customer_name") final String? customerName,
      @JsonKey(name: "item_count") final int? itemCount}) = _$HomeOrderImpl;

  factory _HomeOrder.fromJson(Map<String, dynamic> json) =
      _$HomeOrderImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "display_id")
  int get displayId;
  @override
  String get status;
  @override
  @JsonKey(name: "payment_status")
  String? get paymentStatus;
  @override
  @JsonKey(name: "fulfillment_status")
  String? get fulfillmentStatus;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  num get total;
  @override
  @JsonKey(name: "currency_code")
  String get currencyCode;
  @override
  String? get email;
  @override
  @JsonKey(name: "customer_name")
  String? get customerName;
  @override
  @JsonKey(name: "item_count")
  int? get itemCount;

  /// Create a copy of HomeOrder
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$HomeOrderImplCopyWith<_$HomeOrderImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

HomeProduct _$HomeProductFromJson(Map<String, dynamic> json) {
  return _HomeProduct.fromJson(json);
}

/// @nodoc
mixin _$HomeProduct {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get thumbnail => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String? get currencyCode => throw _privateConstructorUsedError;
  num? get price => throw _privateConstructorUsedError;
  num? get stock => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;

  /// Serializes this HomeProduct to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of HomeProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $HomeProductCopyWith<HomeProduct> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $HomeProductCopyWith<$Res> {
  factory $HomeProductCopyWith(
          HomeProduct value, $Res Function(HomeProduct) then) =
      _$HomeProductCopyWithImpl<$Res, HomeProduct>;
  @useResult
  $Res call(
      {String id,
      String title,
      String status,
      String? thumbnail,
      @JsonKey(name: "currency_code") String? currencyCode,
      num? price,
      num? stock,
      Map<String, dynamic>? metadata});
}

/// @nodoc
class _$HomeProductCopyWithImpl<$Res, $Val extends HomeProduct>
    implements $HomeProductCopyWith<$Res> {
  _$HomeProductCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of HomeProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? status = null,
    Object? thumbnail = freezed,
    Object? currencyCode = freezed,
    Object? price = freezed,
    Object? stock = freezed,
    Object? metadata = freezed,
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
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      currencyCode: freezed == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String?,
      price: freezed == price
          ? _value.price
          : price // ignore: cast_nullable_to_non_nullable
              as num?,
      stock: freezed == stock
          ? _value.stock
          : stock // ignore: cast_nullable_to_non_nullable
              as num?,
      metadata: freezed == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$HomeProductImplCopyWith<$Res>
    implements $HomeProductCopyWith<$Res> {
  factory _$$HomeProductImplCopyWith(
          _$HomeProductImpl value, $Res Function(_$HomeProductImpl) then) =
      __$$HomeProductImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String status,
      String? thumbnail,
      @JsonKey(name: "currency_code") String? currencyCode,
      num? price,
      num? stock,
      Map<String, dynamic>? metadata});
}

/// @nodoc
class __$$HomeProductImplCopyWithImpl<$Res>
    extends _$HomeProductCopyWithImpl<$Res, _$HomeProductImpl>
    implements _$$HomeProductImplCopyWith<$Res> {
  __$$HomeProductImplCopyWithImpl(
      _$HomeProductImpl _value, $Res Function(_$HomeProductImpl) _then)
      : super(_value, _then);

  /// Create a copy of HomeProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? status = null,
    Object? thumbnail = freezed,
    Object? currencyCode = freezed,
    Object? price = freezed,
    Object? stock = freezed,
    Object? metadata = freezed,
  }) {
    return _then(_$HomeProductImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      currencyCode: freezed == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String?,
      price: freezed == price
          ? _value.price
          : price // ignore: cast_nullable_to_non_nullable
              as num?,
      stock: freezed == stock
          ? _value.stock
          : stock // ignore: cast_nullable_to_non_nullable
              as num?,
      metadata: freezed == metadata
          ? _value._metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$HomeProductImpl implements _HomeProduct {
  const _$HomeProductImpl(
      {this.id = "",
      this.title = "",
      this.status = "",
      this.thumbnail,
      @JsonKey(name: "currency_code") this.currencyCode,
      this.price,
      this.stock,
      final Map<String, dynamic>? metadata})
      : _metadata = metadata;

  factory _$HomeProductImpl.fromJson(Map<String, dynamic> json) =>
      _$$HomeProductImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String title;
  @override
  @JsonKey()
  final String status;
  @override
  final String? thumbnail;
  @override
  @JsonKey(name: "currency_code")
  final String? currencyCode;
  @override
  final num? price;
  @override
  final num? stock;
  final Map<String, dynamic>? _metadata;
  @override
  Map<String, dynamic>? get metadata {
    final value = _metadata;
    if (value == null) return null;
    if (_metadata is EqualUnmodifiableMapView) return _metadata;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  String toString() {
    return 'HomeProduct(id: $id, title: $title, status: $status, thumbnail: $thumbnail, currencyCode: $currencyCode, price: $price, stock: $stock, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$HomeProductImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.stock, stock) || other.stock == stock) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      status,
      thumbnail,
      currencyCode,
      price,
      stock,
      const DeepCollectionEquality().hash(_metadata));

  /// Create a copy of HomeProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$HomeProductImplCopyWith<_$HomeProductImpl> get copyWith =>
      __$$HomeProductImplCopyWithImpl<_$HomeProductImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$HomeProductImplToJson(
      this,
    );
  }
}

abstract class _HomeProduct implements HomeProduct {
  const factory _HomeProduct(
      {final String id,
      final String title,
      final String status,
      final String? thumbnail,
      @JsonKey(name: "currency_code") final String? currencyCode,
      final num? price,
      final num? stock,
      final Map<String, dynamic>? metadata}) = _$HomeProductImpl;

  factory _HomeProduct.fromJson(Map<String, dynamic> json) =
      _$HomeProductImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get status;
  @override
  String? get thumbnail;
  @override
  @JsonKey(name: "currency_code")
  String? get currencyCode;
  @override
  num? get price;
  @override
  num? get stock;
  @override
  Map<String, dynamic>? get metadata;

  /// Create a copy of HomeProduct
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$HomeProductImplCopyWith<_$HomeProductImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SetupTaskDto _$SetupTaskDtoFromJson(Map<String, dynamic> json) {
  return _SetupTaskDto.fromJson(json);
}

/// @nodoc
mixin _$SetupTaskDto {
  String get key => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  String get why => throw _privateConstructorUsedError;
  @JsonKey(name: "required")
  bool get isRequired => throw _privateConstructorUsedError;
  bool get done => throw _privateConstructorUsedError;
  @JsonKey(name: "blocker_detail")
  String? get blockerDetail => throw _privateConstructorUsedError;

  /// Serializes this SetupTaskDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupTaskDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupTaskDtoCopyWith<SetupTaskDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupTaskDtoCopyWith<$Res> {
  factory $SetupTaskDtoCopyWith(
          SetupTaskDto value, $Res Function(SetupTaskDto) then) =
      _$SetupTaskDtoCopyWithImpl<$Res, SetupTaskDto>;
  @useResult
  $Res call(
      {String key,
      String label,
      String why,
      @JsonKey(name: "required") bool isRequired,
      bool done,
      @JsonKey(name: "blocker_detail") String? blockerDetail});
}

/// @nodoc
class _$SetupTaskDtoCopyWithImpl<$Res, $Val extends SetupTaskDto>
    implements $SetupTaskDtoCopyWith<$Res> {
  _$SetupTaskDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupTaskDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? label = null,
    Object? why = null,
    Object? isRequired = null,
    Object? done = null,
    Object? blockerDetail = freezed,
  }) {
    return _then(_value.copyWith(
      key: null == key
          ? _value.key
          : key // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      why: null == why
          ? _value.why
          : why // ignore: cast_nullable_to_non_nullable
              as String,
      isRequired: null == isRequired
          ? _value.isRequired
          : isRequired // ignore: cast_nullable_to_non_nullable
              as bool,
      done: null == done
          ? _value.done
          : done // ignore: cast_nullable_to_non_nullable
              as bool,
      blockerDetail: freezed == blockerDetail
          ? _value.blockerDetail
          : blockerDetail // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupTaskDtoImplCopyWith<$Res>
    implements $SetupTaskDtoCopyWith<$Res> {
  factory _$$SetupTaskDtoImplCopyWith(
          _$SetupTaskDtoImpl value, $Res Function(_$SetupTaskDtoImpl) then) =
      __$$SetupTaskDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String key,
      String label,
      String why,
      @JsonKey(name: "required") bool isRequired,
      bool done,
      @JsonKey(name: "blocker_detail") String? blockerDetail});
}

/// @nodoc
class __$$SetupTaskDtoImplCopyWithImpl<$Res>
    extends _$SetupTaskDtoCopyWithImpl<$Res, _$SetupTaskDtoImpl>
    implements _$$SetupTaskDtoImplCopyWith<$Res> {
  __$$SetupTaskDtoImplCopyWithImpl(
      _$SetupTaskDtoImpl _value, $Res Function(_$SetupTaskDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupTaskDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? label = null,
    Object? why = null,
    Object? isRequired = null,
    Object? done = null,
    Object? blockerDetail = freezed,
  }) {
    return _then(_$SetupTaskDtoImpl(
      key: null == key
          ? _value.key
          : key // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      why: null == why
          ? _value.why
          : why // ignore: cast_nullable_to_non_nullable
              as String,
      isRequired: null == isRequired
          ? _value.isRequired
          : isRequired // ignore: cast_nullable_to_non_nullable
              as bool,
      done: null == done
          ? _value.done
          : done // ignore: cast_nullable_to_non_nullable
              as bool,
      blockerDetail: freezed == blockerDetail
          ? _value.blockerDetail
          : blockerDetail // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupTaskDtoImpl implements _SetupTaskDto {
  const _$SetupTaskDtoImpl(
      {this.key = "",
      this.label = "",
      this.why = "",
      @JsonKey(name: "required") this.isRequired = false,
      this.done = false,
      @JsonKey(name: "blocker_detail") this.blockerDetail});

  factory _$SetupTaskDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupTaskDtoImplFromJson(json);

  @override
  @JsonKey()
  final String key;
  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final String why;
  @override
  @JsonKey(name: "required")
  final bool isRequired;
  @override
  @JsonKey()
  final bool done;
  @override
  @JsonKey(name: "blocker_detail")
  final String? blockerDetail;

  @override
  String toString() {
    return 'SetupTaskDto(key: $key, label: $label, why: $why, isRequired: $isRequired, done: $done, blockerDetail: $blockerDetail)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupTaskDtoImpl &&
            (identical(other.key, key) || other.key == key) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.why, why) || other.why == why) &&
            (identical(other.isRequired, isRequired) ||
                other.isRequired == isRequired) &&
            (identical(other.done, done) || other.done == done) &&
            (identical(other.blockerDetail, blockerDetail) ||
                other.blockerDetail == blockerDetail));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, key, label, why, isRequired, done, blockerDetail);

  /// Create a copy of SetupTaskDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupTaskDtoImplCopyWith<_$SetupTaskDtoImpl> get copyWith =>
      __$$SetupTaskDtoImplCopyWithImpl<_$SetupTaskDtoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupTaskDtoImplToJson(
      this,
    );
  }
}

abstract class _SetupTaskDto implements SetupTaskDto {
  const factory _SetupTaskDto(
          {final String key,
          final String label,
          final String why,
          @JsonKey(name: "required") final bool isRequired,
          final bool done,
          @JsonKey(name: "blocker_detail") final String? blockerDetail}) =
      _$SetupTaskDtoImpl;

  factory _SetupTaskDto.fromJson(Map<String, dynamic> json) =
      _$SetupTaskDtoImpl.fromJson;

  @override
  String get key;
  @override
  String get label;
  @override
  String get why;
  @override
  @JsonKey(name: "required")
  bool get isRequired;
  @override
  bool get done;
  @override
  @JsonKey(name: "blocker_detail")
  String? get blockerDetail;

  /// Create a copy of SetupTaskDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupTaskDtoImplCopyWith<_$SetupTaskDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SetupStatusDto _$SetupStatusDtoFromJson(Map<String, dynamic> json) {
  return _SetupStatusDto.fromJson(json);
}

/// @nodoc
mixin _$SetupStatusDto {
  List<SetupTaskDto> get tasks => throw _privateConstructorUsedError;
  int get percent => throw _privateConstructorUsedError;
  @JsonKey(name: "ready_to_sell")
  bool get readyToSell => throw _privateConstructorUsedError;
  @JsonKey(name: "missing_required")
  List<String> get missingRequired => throw _privateConstructorUsedError;

  /// Serializes this SetupStatusDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupStatusDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupStatusDtoCopyWith<SetupStatusDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupStatusDtoCopyWith<$Res> {
  factory $SetupStatusDtoCopyWith(
          SetupStatusDto value, $Res Function(SetupStatusDto) then) =
      _$SetupStatusDtoCopyWithImpl<$Res, SetupStatusDto>;
  @useResult
  $Res call(
      {List<SetupTaskDto> tasks,
      int percent,
      @JsonKey(name: "ready_to_sell") bool readyToSell,
      @JsonKey(name: "missing_required") List<String> missingRequired});
}

/// @nodoc
class _$SetupStatusDtoCopyWithImpl<$Res, $Val extends SetupStatusDto>
    implements $SetupStatusDtoCopyWith<$Res> {
  _$SetupStatusDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupStatusDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tasks = null,
    Object? percent = null,
    Object? readyToSell = null,
    Object? missingRequired = null,
  }) {
    return _then(_value.copyWith(
      tasks: null == tasks
          ? _value.tasks
          : tasks // ignore: cast_nullable_to_non_nullable
              as List<SetupTaskDto>,
      percent: null == percent
          ? _value.percent
          : percent // ignore: cast_nullable_to_non_nullable
              as int,
      readyToSell: null == readyToSell
          ? _value.readyToSell
          : readyToSell // ignore: cast_nullable_to_non_nullable
              as bool,
      missingRequired: null == missingRequired
          ? _value.missingRequired
          : missingRequired // ignore: cast_nullable_to_non_nullable
              as List<String>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupStatusDtoImplCopyWith<$Res>
    implements $SetupStatusDtoCopyWith<$Res> {
  factory _$$SetupStatusDtoImplCopyWith(_$SetupStatusDtoImpl value,
          $Res Function(_$SetupStatusDtoImpl) then) =
      __$$SetupStatusDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<SetupTaskDto> tasks,
      int percent,
      @JsonKey(name: "ready_to_sell") bool readyToSell,
      @JsonKey(name: "missing_required") List<String> missingRequired});
}

/// @nodoc
class __$$SetupStatusDtoImplCopyWithImpl<$Res>
    extends _$SetupStatusDtoCopyWithImpl<$Res, _$SetupStatusDtoImpl>
    implements _$$SetupStatusDtoImplCopyWith<$Res> {
  __$$SetupStatusDtoImplCopyWithImpl(
      _$SetupStatusDtoImpl _value, $Res Function(_$SetupStatusDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupStatusDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tasks = null,
    Object? percent = null,
    Object? readyToSell = null,
    Object? missingRequired = null,
  }) {
    return _then(_$SetupStatusDtoImpl(
      tasks: null == tasks
          ? _value._tasks
          : tasks // ignore: cast_nullable_to_non_nullable
              as List<SetupTaskDto>,
      percent: null == percent
          ? _value.percent
          : percent // ignore: cast_nullable_to_non_nullable
              as int,
      readyToSell: null == readyToSell
          ? _value.readyToSell
          : readyToSell // ignore: cast_nullable_to_non_nullable
              as bool,
      missingRequired: null == missingRequired
          ? _value._missingRequired
          : missingRequired // ignore: cast_nullable_to_non_nullable
              as List<String>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupStatusDtoImpl implements _SetupStatusDto {
  const _$SetupStatusDtoImpl(
      {final List<SetupTaskDto> tasks = const <SetupTaskDto>[],
      this.percent = 0,
      @JsonKey(name: "ready_to_sell") this.readyToSell = true,
      @JsonKey(name: "missing_required")
      final List<String> missingRequired = const <String>[]})
      : _tasks = tasks,
        _missingRequired = missingRequired;

  factory _$SetupStatusDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupStatusDtoImplFromJson(json);

  final List<SetupTaskDto> _tasks;
  @override
  @JsonKey()
  List<SetupTaskDto> get tasks {
    if (_tasks is EqualUnmodifiableListView) return _tasks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tasks);
  }

  @override
  @JsonKey()
  final int percent;
  @override
  @JsonKey(name: "ready_to_sell")
  final bool readyToSell;
  final List<String> _missingRequired;
  @override
  @JsonKey(name: "missing_required")
  List<String> get missingRequired {
    if (_missingRequired is EqualUnmodifiableListView) return _missingRequired;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_missingRequired);
  }

  @override
  String toString() {
    return 'SetupStatusDto(tasks: $tasks, percent: $percent, readyToSell: $readyToSell, missingRequired: $missingRequired)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupStatusDtoImpl &&
            const DeepCollectionEquality().equals(other._tasks, _tasks) &&
            (identical(other.percent, percent) || other.percent == percent) &&
            (identical(other.readyToSell, readyToSell) ||
                other.readyToSell == readyToSell) &&
            const DeepCollectionEquality()
                .equals(other._missingRequired, _missingRequired));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_tasks),
      percent,
      readyToSell,
      const DeepCollectionEquality().hash(_missingRequired));

  /// Create a copy of SetupStatusDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupStatusDtoImplCopyWith<_$SetupStatusDtoImpl> get copyWith =>
      __$$SetupStatusDtoImplCopyWithImpl<_$SetupStatusDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupStatusDtoImplToJson(
      this,
    );
  }
}

abstract class _SetupStatusDto implements SetupStatusDto {
  const factory _SetupStatusDto(
      {final List<SetupTaskDto> tasks,
      final int percent,
      @JsonKey(name: "ready_to_sell") final bool readyToSell,
      @JsonKey(name: "missing_required")
      final List<String> missingRequired}) = _$SetupStatusDtoImpl;

  factory _SetupStatusDto.fromJson(Map<String, dynamic> json) =
      _$SetupStatusDtoImpl.fromJson;

  @override
  List<SetupTaskDto> get tasks;
  @override
  int get percent;
  @override
  @JsonKey(name: "ready_to_sell")
  bool get readyToSell;
  @override
  @JsonKey(name: "missing_required")
  List<String> get missingRequired;

  /// Create a copy of SetupStatusDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupStatusDtoImplCopyWith<_$SetupStatusDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InboxViewCounts _$InboxViewCountsFromJson(Map<String, dynamic> json) {
  return _InboxViewCounts.fromJson(json);
}

/// @nodoc
mixin _$InboxViewCounts {
  @JsonKey(name: "needs_you")
  int get needsYou => throw _privateConstructorUsedError;
  int get unread => throw _privateConstructorUsedError;
  int get open => throw _privateConstructorUsedError;

  /// Serializes this InboxViewCounts to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InboxViewCounts
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InboxViewCountsCopyWith<InboxViewCounts> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InboxViewCountsCopyWith<$Res> {
  factory $InboxViewCountsCopyWith(
          InboxViewCounts value, $Res Function(InboxViewCounts) then) =
      _$InboxViewCountsCopyWithImpl<$Res, InboxViewCounts>;
  @useResult
  $Res call({@JsonKey(name: "needs_you") int needsYou, int unread, int open});
}

/// @nodoc
class _$InboxViewCountsCopyWithImpl<$Res, $Val extends InboxViewCounts>
    implements $InboxViewCountsCopyWith<$Res> {
  _$InboxViewCountsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InboxViewCounts
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? needsYou = null,
    Object? unread = null,
    Object? open = null,
  }) {
    return _then(_value.copyWith(
      needsYou: null == needsYou
          ? _value.needsYou
          : needsYou // ignore: cast_nullable_to_non_nullable
              as int,
      unread: null == unread
          ? _value.unread
          : unread // ignore: cast_nullable_to_non_nullable
              as int,
      open: null == open
          ? _value.open
          : open // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$InboxViewCountsImplCopyWith<$Res>
    implements $InboxViewCountsCopyWith<$Res> {
  factory _$$InboxViewCountsImplCopyWith(_$InboxViewCountsImpl value,
          $Res Function(_$InboxViewCountsImpl) then) =
      __$$InboxViewCountsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({@JsonKey(name: "needs_you") int needsYou, int unread, int open});
}

/// @nodoc
class __$$InboxViewCountsImplCopyWithImpl<$Res>
    extends _$InboxViewCountsCopyWithImpl<$Res, _$InboxViewCountsImpl>
    implements _$$InboxViewCountsImplCopyWith<$Res> {
  __$$InboxViewCountsImplCopyWithImpl(
      _$InboxViewCountsImpl _value, $Res Function(_$InboxViewCountsImpl) _then)
      : super(_value, _then);

  /// Create a copy of InboxViewCounts
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? needsYou = null,
    Object? unread = null,
    Object? open = null,
  }) {
    return _then(_$InboxViewCountsImpl(
      needsYou: null == needsYou
          ? _value.needsYou
          : needsYou // ignore: cast_nullable_to_non_nullable
              as int,
      unread: null == unread
          ? _value.unread
          : unread // ignore: cast_nullable_to_non_nullable
              as int,
      open: null == open
          ? _value.open
          : open // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxViewCountsImpl implements _InboxViewCounts {
  const _$InboxViewCountsImpl(
      {@JsonKey(name: "needs_you") this.needsYou = 0,
      this.unread = 0,
      this.open = 0});

  factory _$InboxViewCountsImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxViewCountsImplFromJson(json);

  @override
  @JsonKey(name: "needs_you")
  final int needsYou;
  @override
  @JsonKey()
  final int unread;
  @override
  @JsonKey()
  final int open;

  @override
  String toString() {
    return 'InboxViewCounts(needsYou: $needsYou, unread: $unread, open: $open)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxViewCountsImpl &&
            (identical(other.needsYou, needsYou) ||
                other.needsYou == needsYou) &&
            (identical(other.unread, unread) || other.unread == unread) &&
            (identical(other.open, open) || other.open == open));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, needsYou, unread, open);

  /// Create a copy of InboxViewCounts
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InboxViewCountsImplCopyWith<_$InboxViewCountsImpl> get copyWith =>
      __$$InboxViewCountsImplCopyWithImpl<_$InboxViewCountsImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InboxViewCountsImplToJson(
      this,
    );
  }
}

abstract class _InboxViewCounts implements InboxViewCounts {
  const factory _InboxViewCounts(
      {@JsonKey(name: "needs_you") final int needsYou,
      final int unread,
      final int open}) = _$InboxViewCountsImpl;

  factory _InboxViewCounts.fromJson(Map<String, dynamic> json) =
      _$InboxViewCountsImpl.fromJson;

  @override
  @JsonKey(name: "needs_you")
  int get needsYou;
  @override
  int get unread;
  @override
  int get open;

  /// Create a copy of InboxViewCounts
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxViewCountsImplCopyWith<_$InboxViewCountsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InboxCountsDto _$InboxCountsDtoFromJson(Map<String, dynamic> json) {
  return _InboxCountsDto.fromJson(json);
}

/// @nodoc
mixin _$InboxCountsDto {
  InboxViewCounts get views => throw _privateConstructorUsedError;

  /// Serializes this InboxCountsDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InboxCountsDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InboxCountsDtoCopyWith<InboxCountsDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InboxCountsDtoCopyWith<$Res> {
  factory $InboxCountsDtoCopyWith(
          InboxCountsDto value, $Res Function(InboxCountsDto) then) =
      _$InboxCountsDtoCopyWithImpl<$Res, InboxCountsDto>;
  @useResult
  $Res call({InboxViewCounts views});

  $InboxViewCountsCopyWith<$Res> get views;
}

/// @nodoc
class _$InboxCountsDtoCopyWithImpl<$Res, $Val extends InboxCountsDto>
    implements $InboxCountsDtoCopyWith<$Res> {
  _$InboxCountsDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InboxCountsDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? views = null,
  }) {
    return _then(_value.copyWith(
      views: null == views
          ? _value.views
          : views // ignore: cast_nullable_to_non_nullable
              as InboxViewCounts,
    ) as $Val);
  }

  /// Create a copy of InboxCountsDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $InboxViewCountsCopyWith<$Res> get views {
    return $InboxViewCountsCopyWith<$Res>(_value.views, (value) {
      return _then(_value.copyWith(views: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$InboxCountsDtoImplCopyWith<$Res>
    implements $InboxCountsDtoCopyWith<$Res> {
  factory _$$InboxCountsDtoImplCopyWith(_$InboxCountsDtoImpl value,
          $Res Function(_$InboxCountsDtoImpl) then) =
      __$$InboxCountsDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({InboxViewCounts views});

  @override
  $InboxViewCountsCopyWith<$Res> get views;
}

/// @nodoc
class __$$InboxCountsDtoImplCopyWithImpl<$Res>
    extends _$InboxCountsDtoCopyWithImpl<$Res, _$InboxCountsDtoImpl>
    implements _$$InboxCountsDtoImplCopyWith<$Res> {
  __$$InboxCountsDtoImplCopyWithImpl(
      _$InboxCountsDtoImpl _value, $Res Function(_$InboxCountsDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of InboxCountsDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? views = null,
  }) {
    return _then(_$InboxCountsDtoImpl(
      views: null == views
          ? _value.views
          : views // ignore: cast_nullable_to_non_nullable
              as InboxViewCounts,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxCountsDtoImpl implements _InboxCountsDto {
  const _$InboxCountsDtoImpl({this.views = const InboxViewCounts()});

  factory _$InboxCountsDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxCountsDtoImplFromJson(json);

  @override
  @JsonKey()
  final InboxViewCounts views;

  @override
  String toString() {
    return 'InboxCountsDto(views: $views)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxCountsDtoImpl &&
            (identical(other.views, views) || other.views == views));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, views);

  /// Create a copy of InboxCountsDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InboxCountsDtoImplCopyWith<_$InboxCountsDtoImpl> get copyWith =>
      __$$InboxCountsDtoImplCopyWithImpl<_$InboxCountsDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InboxCountsDtoImplToJson(
      this,
    );
  }
}

abstract class _InboxCountsDto implements InboxCountsDto {
  const factory _InboxCountsDto({final InboxViewCounts views}) =
      _$InboxCountsDtoImpl;

  factory _InboxCountsDto.fromJson(Map<String, dynamic> json) =
      _$InboxCountsDtoImpl.fromJson;

  @override
  InboxViewCounts get views;

  /// Create a copy of InboxCountsDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxCountsDtoImplCopyWith<_$InboxCountsDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
