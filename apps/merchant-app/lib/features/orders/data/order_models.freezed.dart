// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'order_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

OrderSummary _$OrderSummaryFromJson(Map<String, dynamic> json) {
  return _OrderSummary.fromJson(json);
}

/// @nodoc
mixin _$OrderSummary {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "display_id", fromJson: _toInt)
  int get displayId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "payment_status")
  String? get paymentStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "fulfillment_status")
  String? get fulfillmentStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;
  num get total => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String get currencyCode => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  @JsonKey(name: "customer_name")
  String? get customerName => throw _privateConstructorUsedError;
  @JsonKey(name: "country_code")
  String? get countryCode => throw _privateConstructorUsedError;
  @JsonKey(name: "item_count")
  int? get itemCount => throw _privateConstructorUsedError;

  /// Serializes this OrderSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderSummaryCopyWith<OrderSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderSummaryCopyWith<$Res> {
  factory $OrderSummaryCopyWith(
          OrderSummary value, $Res Function(OrderSummary) then) =
      _$OrderSummaryCopyWithImpl<$Res, OrderSummary>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_id", fromJson: _toInt) int displayId,
      String status,
      @JsonKey(name: "payment_status") String? paymentStatus,
      @JsonKey(name: "fulfillment_status") String? fulfillmentStatus,
      @JsonKey(name: "created_at") String createdAt,
      num total,
      @JsonKey(name: "currency_code") String currencyCode,
      String? email,
      @JsonKey(name: "customer_name") String? customerName,
      @JsonKey(name: "country_code") String? countryCode,
      @JsonKey(name: "item_count") int? itemCount});
}

/// @nodoc
class _$OrderSummaryCopyWithImpl<$Res, $Val extends OrderSummary>
    implements $OrderSummaryCopyWith<$Res> {
  _$OrderSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
    Object? status = null,
    Object? paymentStatus = freezed,
    Object? fulfillmentStatus = freezed,
    Object? createdAt = null,
    Object? total = null,
    Object? currencyCode = null,
    Object? email = freezed,
    Object? customerName = freezed,
    Object? countryCode = freezed,
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
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
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
      countryCode: freezed == countryCode
          ? _value.countryCode
          : countryCode // ignore: cast_nullable_to_non_nullable
              as String?,
      itemCount: freezed == itemCount
          ? _value.itemCount
          : itemCount // ignore: cast_nullable_to_non_nullable
              as int?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderSummaryImplCopyWith<$Res>
    implements $OrderSummaryCopyWith<$Res> {
  factory _$$OrderSummaryImplCopyWith(
          _$OrderSummaryImpl value, $Res Function(_$OrderSummaryImpl) then) =
      __$$OrderSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_id", fromJson: _toInt) int displayId,
      String status,
      @JsonKey(name: "payment_status") String? paymentStatus,
      @JsonKey(name: "fulfillment_status") String? fulfillmentStatus,
      @JsonKey(name: "created_at") String createdAt,
      num total,
      @JsonKey(name: "currency_code") String currencyCode,
      String? email,
      @JsonKey(name: "customer_name") String? customerName,
      @JsonKey(name: "country_code") String? countryCode,
      @JsonKey(name: "item_count") int? itemCount});
}

/// @nodoc
class __$$OrderSummaryImplCopyWithImpl<$Res>
    extends _$OrderSummaryCopyWithImpl<$Res, _$OrderSummaryImpl>
    implements _$$OrderSummaryImplCopyWith<$Res> {
  __$$OrderSummaryImplCopyWithImpl(
      _$OrderSummaryImpl _value, $Res Function(_$OrderSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
    Object? status = null,
    Object? paymentStatus = freezed,
    Object? fulfillmentStatus = freezed,
    Object? createdAt = null,
    Object? total = null,
    Object? currencyCode = null,
    Object? email = freezed,
    Object? customerName = freezed,
    Object? countryCode = freezed,
    Object? itemCount = freezed,
  }) {
    return _then(_$OrderSummaryImpl(
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
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
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
      countryCode: freezed == countryCode
          ? _value.countryCode
          : countryCode // ignore: cast_nullable_to_non_nullable
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
class _$OrderSummaryImpl implements _OrderSummary {
  const _$OrderSummaryImpl(
      {this.id = "",
      @JsonKey(name: "display_id", fromJson: _toInt) this.displayId = 0,
      this.status = "",
      @JsonKey(name: "payment_status") this.paymentStatus,
      @JsonKey(name: "fulfillment_status") this.fulfillmentStatus,
      @JsonKey(name: "created_at") this.createdAt = "",
      this.total = 0,
      @JsonKey(name: "currency_code") this.currencyCode = "usd",
      this.email,
      @JsonKey(name: "customer_name") this.customerName,
      @JsonKey(name: "country_code") this.countryCode,
      @JsonKey(name: "item_count") this.itemCount});

  factory _$OrderSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderSummaryImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "display_id", fromJson: _toInt)
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
  final String createdAt;
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
  @JsonKey(name: "country_code")
  final String? countryCode;
  @override
  @JsonKey(name: "item_count")
  final int? itemCount;

  @override
  String toString() {
    return 'OrderSummary(id: $id, displayId: $displayId, status: $status, paymentStatus: $paymentStatus, fulfillmentStatus: $fulfillmentStatus, createdAt: $createdAt, total: $total, currencyCode: $currencyCode, email: $email, customerName: $customerName, countryCode: $countryCode, itemCount: $itemCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderSummaryImpl &&
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
            (identical(other.countryCode, countryCode) ||
                other.countryCode == countryCode) &&
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
      countryCode,
      itemCount);

  /// Create a copy of OrderSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderSummaryImplCopyWith<_$OrderSummaryImpl> get copyWith =>
      __$$OrderSummaryImplCopyWithImpl<_$OrderSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderSummaryImplToJson(
      this,
    );
  }
}

abstract class _OrderSummary implements OrderSummary {
  const factory _OrderSummary(
      {final String id,
      @JsonKey(name: "display_id", fromJson: _toInt) final int displayId,
      final String status,
      @JsonKey(name: "payment_status") final String? paymentStatus,
      @JsonKey(name: "fulfillment_status") final String? fulfillmentStatus,
      @JsonKey(name: "created_at") final String createdAt,
      final num total,
      @JsonKey(name: "currency_code") final String currencyCode,
      final String? email,
      @JsonKey(name: "customer_name") final String? customerName,
      @JsonKey(name: "country_code") final String? countryCode,
      @JsonKey(name: "item_count") final int? itemCount}) = _$OrderSummaryImpl;

  factory _OrderSummary.fromJson(Map<String, dynamic> json) =
      _$OrderSummaryImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "display_id", fromJson: _toInt)
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
  String get createdAt;
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
  @JsonKey(name: "country_code")
  String? get countryCode;
  @override
  @JsonKey(name: "item_count")
  int? get itemCount;

  /// Create a copy of OrderSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderSummaryImplCopyWith<_$OrderSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrdersListResponse _$OrdersListResponseFromJson(Map<String, dynamic> json) {
  return _OrdersListResponse.fromJson(json);
}

/// @nodoc
mixin _$OrdersListResponse {
  List<OrderSummary> get orders => throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;

  /// Serializes this OrdersListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrdersListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrdersListResponseCopyWith<OrdersListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrdersListResponseCopyWith<$Res> {
  factory $OrdersListResponseCopyWith(
          OrdersListResponse value, $Res Function(OrdersListResponse) then) =
      _$OrdersListResponseCopyWithImpl<$Res, OrdersListResponse>;
  @useResult
  $Res call({List<OrderSummary> orders, int count});
}

/// @nodoc
class _$OrdersListResponseCopyWithImpl<$Res, $Val extends OrdersListResponse>
    implements $OrdersListResponseCopyWith<$Res> {
  _$OrdersListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrdersListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? orders = null,
    Object? count = null,
  }) {
    return _then(_value.copyWith(
      orders: null == orders
          ? _value.orders
          : orders // ignore: cast_nullable_to_non_nullable
              as List<OrderSummary>,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrdersListResponseImplCopyWith<$Res>
    implements $OrdersListResponseCopyWith<$Res> {
  factory _$$OrdersListResponseImplCopyWith(_$OrdersListResponseImpl value,
          $Res Function(_$OrdersListResponseImpl) then) =
      __$$OrdersListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<OrderSummary> orders, int count});
}

/// @nodoc
class __$$OrdersListResponseImplCopyWithImpl<$Res>
    extends _$OrdersListResponseCopyWithImpl<$Res, _$OrdersListResponseImpl>
    implements _$$OrdersListResponseImplCopyWith<$Res> {
  __$$OrdersListResponseImplCopyWithImpl(_$OrdersListResponseImpl _value,
      $Res Function(_$OrdersListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrdersListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? orders = null,
    Object? count = null,
  }) {
    return _then(_$OrdersListResponseImpl(
      orders: null == orders
          ? _value._orders
          : orders // ignore: cast_nullable_to_non_nullable
              as List<OrderSummary>,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrdersListResponseImpl implements _OrdersListResponse {
  const _$OrdersListResponseImpl(
      {final List<OrderSummary> orders = const <OrderSummary>[],
      this.count = 0})
      : _orders = orders;

  factory _$OrdersListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrdersListResponseImplFromJson(json);

  final List<OrderSummary> _orders;
  @override
  @JsonKey()
  List<OrderSummary> get orders {
    if (_orders is EqualUnmodifiableListView) return _orders;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_orders);
  }

  @override
  @JsonKey()
  final int count;

  @override
  String toString() {
    return 'OrdersListResponse(orders: $orders, count: $count)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrdersListResponseImpl &&
            const DeepCollectionEquality().equals(other._orders, _orders) &&
            (identical(other.count, count) || other.count == count));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_orders), count);

  /// Create a copy of OrdersListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrdersListResponseImplCopyWith<_$OrdersListResponseImpl> get copyWith =>
      __$$OrdersListResponseImplCopyWithImpl<_$OrdersListResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrdersListResponseImplToJson(
      this,
    );
  }
}

abstract class _OrdersListResponse implements OrdersListResponse {
  const factory _OrdersListResponse(
      {final List<OrderSummary> orders,
      final int count}) = _$OrdersListResponseImpl;

  factory _OrdersListResponse.fromJson(Map<String, dynamic> json) =
      _$OrdersListResponseImpl.fromJson;

  @override
  List<OrderSummary> get orders;
  @override
  int get count;

  /// Create a copy of OrdersListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrdersListResponseImplCopyWith<_$OrdersListResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderItemDetail _$OrderItemDetailFromJson(Map<String, dynamic> json) {
  return _OrderItemDetail.fromJson(json);
}

/// @nodoc
mixin _$OrderItemDetail {
  num get quantity => throw _privateConstructorUsedError;
  @JsonKey(name: "fulfilled_quantity")
  num get fulfilledQuantity => throw _privateConstructorUsedError;
  @JsonKey(name: "shipped_quantity")
  num get shippedQuantity => throw _privateConstructorUsedError;
  @JsonKey(name: "delivered_quantity")
  num get deliveredQuantity => throw _privateConstructorUsedError;
  @JsonKey(name: "return_requested_quantity")
  num get returnRequestedQuantity => throw _privateConstructorUsedError;
  @JsonKey(name: "return_received_quantity")
  num get returnReceivedQuantity => throw _privateConstructorUsedError;

  /// Serializes this OrderItemDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderItemDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderItemDetailCopyWith<OrderItemDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderItemDetailCopyWith<$Res> {
  factory $OrderItemDetailCopyWith(
          OrderItemDetail value, $Res Function(OrderItemDetail) then) =
      _$OrderItemDetailCopyWithImpl<$Res, OrderItemDetail>;
  @useResult
  $Res call(
      {num quantity,
      @JsonKey(name: "fulfilled_quantity") num fulfilledQuantity,
      @JsonKey(name: "shipped_quantity") num shippedQuantity,
      @JsonKey(name: "delivered_quantity") num deliveredQuantity,
      @JsonKey(name: "return_requested_quantity") num returnRequestedQuantity,
      @JsonKey(name: "return_received_quantity") num returnReceivedQuantity});
}

/// @nodoc
class _$OrderItemDetailCopyWithImpl<$Res, $Val extends OrderItemDetail>
    implements $OrderItemDetailCopyWith<$Res> {
  _$OrderItemDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderItemDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? quantity = null,
    Object? fulfilledQuantity = null,
    Object? shippedQuantity = null,
    Object? deliveredQuantity = null,
    Object? returnRequestedQuantity = null,
    Object? returnReceivedQuantity = null,
  }) {
    return _then(_value.copyWith(
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as num,
      fulfilledQuantity: null == fulfilledQuantity
          ? _value.fulfilledQuantity
          : fulfilledQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      shippedQuantity: null == shippedQuantity
          ? _value.shippedQuantity
          : shippedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      deliveredQuantity: null == deliveredQuantity
          ? _value.deliveredQuantity
          : deliveredQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      returnRequestedQuantity: null == returnRequestedQuantity
          ? _value.returnRequestedQuantity
          : returnRequestedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      returnReceivedQuantity: null == returnReceivedQuantity
          ? _value.returnReceivedQuantity
          : returnReceivedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderItemDetailImplCopyWith<$Res>
    implements $OrderItemDetailCopyWith<$Res> {
  factory _$$OrderItemDetailImplCopyWith(_$OrderItemDetailImpl value,
          $Res Function(_$OrderItemDetailImpl) then) =
      __$$OrderItemDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num quantity,
      @JsonKey(name: "fulfilled_quantity") num fulfilledQuantity,
      @JsonKey(name: "shipped_quantity") num shippedQuantity,
      @JsonKey(name: "delivered_quantity") num deliveredQuantity,
      @JsonKey(name: "return_requested_quantity") num returnRequestedQuantity,
      @JsonKey(name: "return_received_quantity") num returnReceivedQuantity});
}

/// @nodoc
class __$$OrderItemDetailImplCopyWithImpl<$Res>
    extends _$OrderItemDetailCopyWithImpl<$Res, _$OrderItemDetailImpl>
    implements _$$OrderItemDetailImplCopyWith<$Res> {
  __$$OrderItemDetailImplCopyWithImpl(
      _$OrderItemDetailImpl _value, $Res Function(_$OrderItemDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderItemDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? quantity = null,
    Object? fulfilledQuantity = null,
    Object? shippedQuantity = null,
    Object? deliveredQuantity = null,
    Object? returnRequestedQuantity = null,
    Object? returnReceivedQuantity = null,
  }) {
    return _then(_$OrderItemDetailImpl(
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as num,
      fulfilledQuantity: null == fulfilledQuantity
          ? _value.fulfilledQuantity
          : fulfilledQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      shippedQuantity: null == shippedQuantity
          ? _value.shippedQuantity
          : shippedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      deliveredQuantity: null == deliveredQuantity
          ? _value.deliveredQuantity
          : deliveredQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      returnRequestedQuantity: null == returnRequestedQuantity
          ? _value.returnRequestedQuantity
          : returnRequestedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
      returnReceivedQuantity: null == returnReceivedQuantity
          ? _value.returnReceivedQuantity
          : returnReceivedQuantity // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderItemDetailImpl implements _OrderItemDetail {
  const _$OrderItemDetailImpl(
      {this.quantity = 0,
      @JsonKey(name: "fulfilled_quantity") this.fulfilledQuantity = 0,
      @JsonKey(name: "shipped_quantity") this.shippedQuantity = 0,
      @JsonKey(name: "delivered_quantity") this.deliveredQuantity = 0,
      @JsonKey(name: "return_requested_quantity")
      this.returnRequestedQuantity = 0,
      @JsonKey(name: "return_received_quantity")
      this.returnReceivedQuantity = 0});

  factory _$OrderItemDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderItemDetailImplFromJson(json);

  @override
  @JsonKey()
  final num quantity;
  @override
  @JsonKey(name: "fulfilled_quantity")
  final num fulfilledQuantity;
  @override
  @JsonKey(name: "shipped_quantity")
  final num shippedQuantity;
  @override
  @JsonKey(name: "delivered_quantity")
  final num deliveredQuantity;
  @override
  @JsonKey(name: "return_requested_quantity")
  final num returnRequestedQuantity;
  @override
  @JsonKey(name: "return_received_quantity")
  final num returnReceivedQuantity;

  @override
  String toString() {
    return 'OrderItemDetail(quantity: $quantity, fulfilledQuantity: $fulfilledQuantity, shippedQuantity: $shippedQuantity, deliveredQuantity: $deliveredQuantity, returnRequestedQuantity: $returnRequestedQuantity, returnReceivedQuantity: $returnReceivedQuantity)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderItemDetailImpl &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.fulfilledQuantity, fulfilledQuantity) ||
                other.fulfilledQuantity == fulfilledQuantity) &&
            (identical(other.shippedQuantity, shippedQuantity) ||
                other.shippedQuantity == shippedQuantity) &&
            (identical(other.deliveredQuantity, deliveredQuantity) ||
                other.deliveredQuantity == deliveredQuantity) &&
            (identical(
                    other.returnRequestedQuantity, returnRequestedQuantity) ||
                other.returnRequestedQuantity == returnRequestedQuantity) &&
            (identical(other.returnReceivedQuantity, returnReceivedQuantity) ||
                other.returnReceivedQuantity == returnReceivedQuantity));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      quantity,
      fulfilledQuantity,
      shippedQuantity,
      deliveredQuantity,
      returnRequestedQuantity,
      returnReceivedQuantity);

  /// Create a copy of OrderItemDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderItemDetailImplCopyWith<_$OrderItemDetailImpl> get copyWith =>
      __$$OrderItemDetailImplCopyWithImpl<_$OrderItemDetailImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderItemDetailImplToJson(
      this,
    );
  }
}

abstract class _OrderItemDetail implements OrderItemDetail {
  const factory _OrderItemDetail(
      {final num quantity,
      @JsonKey(name: "fulfilled_quantity") final num fulfilledQuantity,
      @JsonKey(name: "shipped_quantity") final num shippedQuantity,
      @JsonKey(name: "delivered_quantity") final num deliveredQuantity,
      @JsonKey(name: "return_requested_quantity")
      final num returnRequestedQuantity,
      @JsonKey(name: "return_received_quantity")
      final num returnReceivedQuantity}) = _$OrderItemDetailImpl;

  factory _OrderItemDetail.fromJson(Map<String, dynamic> json) =
      _$OrderItemDetailImpl.fromJson;

  @override
  num get quantity;
  @override
  @JsonKey(name: "fulfilled_quantity")
  num get fulfilledQuantity;
  @override
  @JsonKey(name: "shipped_quantity")
  num get shippedQuantity;
  @override
  @JsonKey(name: "delivered_quantity")
  num get deliveredQuantity;
  @override
  @JsonKey(name: "return_requested_quantity")
  num get returnRequestedQuantity;
  @override
  @JsonKey(name: "return_received_quantity")
  num get returnReceivedQuantity;

  /// Create a copy of OrderItemDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderItemDetailImplCopyWith<_$OrderItemDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderItem _$OrderItemFromJson(Map<String, dynamic> json) {
  return _OrderItem.fromJson(json);
}

/// @nodoc
mixin _$OrderItem {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get subtitle => throw _privateConstructorUsedError;
  @JsonKey(name: "product_title")
  String? get productTitle => throw _privateConstructorUsedError;
  @JsonKey(name: "variant_title")
  String? get variantTitle => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;
  @JsonKey(name: "product_id")
  String? get productId => throw _privateConstructorUsedError;
  num get quantity => throw _privateConstructorUsedError;
  @JsonKey(name: "unit_price")
  num get unitPrice => throw _privateConstructorUsedError;
  num get subtotal => throw _privateConstructorUsedError;
  num get total => throw _privateConstructorUsedError;
  @JsonKey(name: "tax_total")
  num get taxTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "discount_total")
  num get discountTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "original_total")
  num get originalTotal => throw _privateConstructorUsedError;
  String? get thumbnail => throw _privateConstructorUsedError;
  OrderItemDetail? get detail => throw _privateConstructorUsedError;

  /// Serializes this OrderItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderItemCopyWith<OrderItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderItemCopyWith<$Res> {
  factory $OrderItemCopyWith(OrderItem value, $Res Function(OrderItem) then) =
      _$OrderItemCopyWithImpl<$Res, OrderItem>;
  @useResult
  $Res call(
      {String id,
      String title,
      String? subtitle,
      @JsonKey(name: "product_title") String? productTitle,
      @JsonKey(name: "variant_title") String? variantTitle,
      String? sku,
      @JsonKey(name: "product_id") String? productId,
      num quantity,
      @JsonKey(name: "unit_price") num unitPrice,
      num subtotal,
      num total,
      @JsonKey(name: "tax_total") num taxTotal,
      @JsonKey(name: "discount_total") num discountTotal,
      @JsonKey(name: "original_total") num originalTotal,
      String? thumbnail,
      OrderItemDetail? detail});

  $OrderItemDetailCopyWith<$Res>? get detail;
}

/// @nodoc
class _$OrderItemCopyWithImpl<$Res, $Val extends OrderItem>
    implements $OrderItemCopyWith<$Res> {
  _$OrderItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? subtitle = freezed,
    Object? productTitle = freezed,
    Object? variantTitle = freezed,
    Object? sku = freezed,
    Object? productId = freezed,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? subtotal = null,
    Object? total = null,
    Object? taxTotal = null,
    Object? discountTotal = null,
    Object? originalTotal = null,
    Object? thumbnail = freezed,
    Object? detail = freezed,
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
      subtitle: freezed == subtitle
          ? _value.subtitle
          : subtitle // ignore: cast_nullable_to_non_nullable
              as String?,
      productTitle: freezed == productTitle
          ? _value.productTitle
          : productTitle // ignore: cast_nullable_to_non_nullable
              as String?,
      variantTitle: freezed == variantTitle
          ? _value.variantTitle
          : variantTitle // ignore: cast_nullable_to_non_nullable
              as String?,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      productId: freezed == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String?,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as num,
      unitPrice: null == unitPrice
          ? _value.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as num,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as num,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      taxTotal: null == taxTotal
          ? _value.taxTotal
          : taxTotal // ignore: cast_nullable_to_non_nullable
              as num,
      discountTotal: null == discountTotal
          ? _value.discountTotal
          : discountTotal // ignore: cast_nullable_to_non_nullable
              as num,
      originalTotal: null == originalTotal
          ? _value.originalTotal
          : originalTotal // ignore: cast_nullable_to_non_nullable
              as num,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      detail: freezed == detail
          ? _value.detail
          : detail // ignore: cast_nullable_to_non_nullable
              as OrderItemDetail?,
    ) as $Val);
  }

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderItemDetailCopyWith<$Res>? get detail {
    if (_value.detail == null) {
      return null;
    }

    return $OrderItemDetailCopyWith<$Res>(_value.detail!, (value) {
      return _then(_value.copyWith(detail: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$OrderItemImplCopyWith<$Res>
    implements $OrderItemCopyWith<$Res> {
  factory _$$OrderItemImplCopyWith(
          _$OrderItemImpl value, $Res Function(_$OrderItemImpl) then) =
      __$$OrderItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? subtitle,
      @JsonKey(name: "product_title") String? productTitle,
      @JsonKey(name: "variant_title") String? variantTitle,
      String? sku,
      @JsonKey(name: "product_id") String? productId,
      num quantity,
      @JsonKey(name: "unit_price") num unitPrice,
      num subtotal,
      num total,
      @JsonKey(name: "tax_total") num taxTotal,
      @JsonKey(name: "discount_total") num discountTotal,
      @JsonKey(name: "original_total") num originalTotal,
      String? thumbnail,
      OrderItemDetail? detail});

  @override
  $OrderItemDetailCopyWith<$Res>? get detail;
}

/// @nodoc
class __$$OrderItemImplCopyWithImpl<$Res>
    extends _$OrderItemCopyWithImpl<$Res, _$OrderItemImpl>
    implements _$$OrderItemImplCopyWith<$Res> {
  __$$OrderItemImplCopyWithImpl(
      _$OrderItemImpl _value, $Res Function(_$OrderItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? subtitle = freezed,
    Object? productTitle = freezed,
    Object? variantTitle = freezed,
    Object? sku = freezed,
    Object? productId = freezed,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? subtotal = null,
    Object? total = null,
    Object? taxTotal = null,
    Object? discountTotal = null,
    Object? originalTotal = null,
    Object? thumbnail = freezed,
    Object? detail = freezed,
  }) {
    return _then(_$OrderItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      subtitle: freezed == subtitle
          ? _value.subtitle
          : subtitle // ignore: cast_nullable_to_non_nullable
              as String?,
      productTitle: freezed == productTitle
          ? _value.productTitle
          : productTitle // ignore: cast_nullable_to_non_nullable
              as String?,
      variantTitle: freezed == variantTitle
          ? _value.variantTitle
          : variantTitle // ignore: cast_nullable_to_non_nullable
              as String?,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      productId: freezed == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String?,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as num,
      unitPrice: null == unitPrice
          ? _value.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as num,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as num,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      taxTotal: null == taxTotal
          ? _value.taxTotal
          : taxTotal // ignore: cast_nullable_to_non_nullable
              as num,
      discountTotal: null == discountTotal
          ? _value.discountTotal
          : discountTotal // ignore: cast_nullable_to_non_nullable
              as num,
      originalTotal: null == originalTotal
          ? _value.originalTotal
          : originalTotal // ignore: cast_nullable_to_non_nullable
              as num,
      thumbnail: freezed == thumbnail
          ? _value.thumbnail
          : thumbnail // ignore: cast_nullable_to_non_nullable
              as String?,
      detail: freezed == detail
          ? _value.detail
          : detail // ignore: cast_nullable_to_non_nullable
              as OrderItemDetail?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderItemImpl implements _OrderItem {
  const _$OrderItemImpl(
      {this.id = "",
      this.title = "",
      this.subtitle,
      @JsonKey(name: "product_title") this.productTitle,
      @JsonKey(name: "variant_title") this.variantTitle,
      this.sku,
      @JsonKey(name: "product_id") this.productId,
      this.quantity = 0,
      @JsonKey(name: "unit_price") this.unitPrice = 0,
      this.subtotal = 0,
      this.total = 0,
      @JsonKey(name: "tax_total") this.taxTotal = 0,
      @JsonKey(name: "discount_total") this.discountTotal = 0,
      @JsonKey(name: "original_total") this.originalTotal = 0,
      this.thumbnail,
      this.detail});

  factory _$OrderItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderItemImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String title;
  @override
  final String? subtitle;
  @override
  @JsonKey(name: "product_title")
  final String? productTitle;
  @override
  @JsonKey(name: "variant_title")
  final String? variantTitle;
  @override
  final String? sku;
  @override
  @JsonKey(name: "product_id")
  final String? productId;
  @override
  @JsonKey()
  final num quantity;
  @override
  @JsonKey(name: "unit_price")
  final num unitPrice;
  @override
  @JsonKey()
  final num subtotal;
  @override
  @JsonKey()
  final num total;
  @override
  @JsonKey(name: "tax_total")
  final num taxTotal;
  @override
  @JsonKey(name: "discount_total")
  final num discountTotal;
  @override
  @JsonKey(name: "original_total")
  final num originalTotal;
  @override
  final String? thumbnail;
  @override
  final OrderItemDetail? detail;

  @override
  String toString() {
    return 'OrderItem(id: $id, title: $title, subtitle: $subtitle, productTitle: $productTitle, variantTitle: $variantTitle, sku: $sku, productId: $productId, quantity: $quantity, unitPrice: $unitPrice, subtotal: $subtotal, total: $total, taxTotal: $taxTotal, discountTotal: $discountTotal, originalTotal: $originalTotal, thumbnail: $thumbnail, detail: $detail)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.subtitle, subtitle) ||
                other.subtitle == subtitle) &&
            (identical(other.productTitle, productTitle) ||
                other.productTitle == productTitle) &&
            (identical(other.variantTitle, variantTitle) ||
                other.variantTitle == variantTitle) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.taxTotal, taxTotal) ||
                other.taxTotal == taxTotal) &&
            (identical(other.discountTotal, discountTotal) ||
                other.discountTotal == discountTotal) &&
            (identical(other.originalTotal, originalTotal) ||
                other.originalTotal == originalTotal) &&
            (identical(other.thumbnail, thumbnail) ||
                other.thumbnail == thumbnail) &&
            (identical(other.detail, detail) || other.detail == detail));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      subtitle,
      productTitle,
      variantTitle,
      sku,
      productId,
      quantity,
      unitPrice,
      subtotal,
      total,
      taxTotal,
      discountTotal,
      originalTotal,
      thumbnail,
      detail);

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderItemImplCopyWith<_$OrderItemImpl> get copyWith =>
      __$$OrderItemImplCopyWithImpl<_$OrderItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderItemImplToJson(
      this,
    );
  }
}

abstract class _OrderItem implements OrderItem {
  const factory _OrderItem(
      {final String id,
      final String title,
      final String? subtitle,
      @JsonKey(name: "product_title") final String? productTitle,
      @JsonKey(name: "variant_title") final String? variantTitle,
      final String? sku,
      @JsonKey(name: "product_id") final String? productId,
      final num quantity,
      @JsonKey(name: "unit_price") final num unitPrice,
      final num subtotal,
      final num total,
      @JsonKey(name: "tax_total") final num taxTotal,
      @JsonKey(name: "discount_total") final num discountTotal,
      @JsonKey(name: "original_total") final num originalTotal,
      final String? thumbnail,
      final OrderItemDetail? detail}) = _$OrderItemImpl;

  factory _OrderItem.fromJson(Map<String, dynamic> json) =
      _$OrderItemImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String? get subtitle;
  @override
  @JsonKey(name: "product_title")
  String? get productTitle;
  @override
  @JsonKey(name: "variant_title")
  String? get variantTitle;
  @override
  String? get sku;
  @override
  @JsonKey(name: "product_id")
  String? get productId;
  @override
  num get quantity;
  @override
  @JsonKey(name: "unit_price")
  num get unitPrice;
  @override
  num get subtotal;
  @override
  num get total;
  @override
  @JsonKey(name: "tax_total")
  num get taxTotal;
  @override
  @JsonKey(name: "discount_total")
  num get discountTotal;
  @override
  @JsonKey(name: "original_total")
  num get originalTotal;
  @override
  String? get thumbnail;
  @override
  OrderItemDetail? get detail;

  /// Create a copy of OrderItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderItemImplCopyWith<_$OrderItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderCustomer _$OrderCustomerFromJson(Map<String, dynamic> json) {
  return _OrderCustomer.fromJson(json);
}

/// @nodoc
mixin _$OrderCustomer {
  String get id => throw _privateConstructorUsedError;
  String get email => throw _privateConstructorUsedError;
  @JsonKey(name: "first_name")
  String? get firstName => throw _privateConstructorUsedError;
  @JsonKey(name: "last_name")
  String? get lastName => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  @JsonKey(name: "company_name")
  String? get companyName => throw _privateConstructorUsedError;
  @JsonKey(name: "has_account")
  bool? get hasAccount => throw _privateConstructorUsedError;
  @JsonKey(name: "order_count")
  num? get orderCount => throw _privateConstructorUsedError;

  /// Serializes this OrderCustomer to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderCustomer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderCustomerCopyWith<OrderCustomer> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderCustomerCopyWith<$Res> {
  factory $OrderCustomerCopyWith(
          OrderCustomer value, $Res Function(OrderCustomer) then) =
      _$OrderCustomerCopyWithImpl<$Res, OrderCustomer>;
  @useResult
  $Res call(
      {String id,
      String email,
      @JsonKey(name: "first_name") String? firstName,
      @JsonKey(name: "last_name") String? lastName,
      String? phone,
      @JsonKey(name: "company_name") String? companyName,
      @JsonKey(name: "has_account") bool? hasAccount,
      @JsonKey(name: "order_count") num? orderCount});
}

/// @nodoc
class _$OrderCustomerCopyWithImpl<$Res, $Val extends OrderCustomer>
    implements $OrderCustomerCopyWith<$Res> {
  _$OrderCustomerCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderCustomer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? companyName = freezed,
    Object? hasAccount = freezed,
    Object? orderCount = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      companyName: freezed == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String?,
      hasAccount: freezed == hasAccount
          ? _value.hasAccount
          : hasAccount // ignore: cast_nullable_to_non_nullable
              as bool?,
      orderCount: freezed == orderCount
          ? _value.orderCount
          : orderCount // ignore: cast_nullable_to_non_nullable
              as num?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderCustomerImplCopyWith<$Res>
    implements $OrderCustomerCopyWith<$Res> {
  factory _$$OrderCustomerImplCopyWith(
          _$OrderCustomerImpl value, $Res Function(_$OrderCustomerImpl) then) =
      __$$OrderCustomerImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String email,
      @JsonKey(name: "first_name") String? firstName,
      @JsonKey(name: "last_name") String? lastName,
      String? phone,
      @JsonKey(name: "company_name") String? companyName,
      @JsonKey(name: "has_account") bool? hasAccount,
      @JsonKey(name: "order_count") num? orderCount});
}

/// @nodoc
class __$$OrderCustomerImplCopyWithImpl<$Res>
    extends _$OrderCustomerCopyWithImpl<$Res, _$OrderCustomerImpl>
    implements _$$OrderCustomerImplCopyWith<$Res> {
  __$$OrderCustomerImplCopyWithImpl(
      _$OrderCustomerImpl _value, $Res Function(_$OrderCustomerImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderCustomer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? companyName = freezed,
    Object? hasAccount = freezed,
    Object? orderCount = freezed,
  }) {
    return _then(_$OrderCustomerImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      companyName: freezed == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String?,
      hasAccount: freezed == hasAccount
          ? _value.hasAccount
          : hasAccount // ignore: cast_nullable_to_non_nullable
              as bool?,
      orderCount: freezed == orderCount
          ? _value.orderCount
          : orderCount // ignore: cast_nullable_to_non_nullable
              as num?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderCustomerImpl implements _OrderCustomer {
  const _$OrderCustomerImpl(
      {this.id = "",
      this.email = "",
      @JsonKey(name: "first_name") this.firstName,
      @JsonKey(name: "last_name") this.lastName,
      this.phone,
      @JsonKey(name: "company_name") this.companyName,
      @JsonKey(name: "has_account") this.hasAccount,
      @JsonKey(name: "order_count") this.orderCount});

  factory _$OrderCustomerImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderCustomerImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String email;
  @override
  @JsonKey(name: "first_name")
  final String? firstName;
  @override
  @JsonKey(name: "last_name")
  final String? lastName;
  @override
  final String? phone;
  @override
  @JsonKey(name: "company_name")
  final String? companyName;
  @override
  @JsonKey(name: "has_account")
  final bool? hasAccount;
  @override
  @JsonKey(name: "order_count")
  final num? orderCount;

  @override
  String toString() {
    return 'OrderCustomer(id: $id, email: $email, firstName: $firstName, lastName: $lastName, phone: $phone, companyName: $companyName, hasAccount: $hasAccount, orderCount: $orderCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderCustomerImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.companyName, companyName) ||
                other.companyName == companyName) &&
            (identical(other.hasAccount, hasAccount) ||
                other.hasAccount == hasAccount) &&
            (identical(other.orderCount, orderCount) ||
                other.orderCount == orderCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, email, firstName, lastName,
      phone, companyName, hasAccount, orderCount);

  /// Create a copy of OrderCustomer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderCustomerImplCopyWith<_$OrderCustomerImpl> get copyWith =>
      __$$OrderCustomerImplCopyWithImpl<_$OrderCustomerImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderCustomerImplToJson(
      this,
    );
  }
}

abstract class _OrderCustomer implements OrderCustomer {
  const factory _OrderCustomer(
          {final String id,
          final String email,
          @JsonKey(name: "first_name") final String? firstName,
          @JsonKey(name: "last_name") final String? lastName,
          final String? phone,
          @JsonKey(name: "company_name") final String? companyName,
          @JsonKey(name: "has_account") final bool? hasAccount,
          @JsonKey(name: "order_count") final num? orderCount}) =
      _$OrderCustomerImpl;

  factory _OrderCustomer.fromJson(Map<String, dynamic> json) =
      _$OrderCustomerImpl.fromJson;

  @override
  String get id;
  @override
  String get email;
  @override
  @JsonKey(name: "first_name")
  String? get firstName;
  @override
  @JsonKey(name: "last_name")
  String? get lastName;
  @override
  String? get phone;
  @override
  @JsonKey(name: "company_name")
  String? get companyName;
  @override
  @JsonKey(name: "has_account")
  bool? get hasAccount;
  @override
  @JsonKey(name: "order_count")
  num? get orderCount;

  /// Create a copy of OrderCustomer
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderCustomerImplCopyWith<_$OrderCustomerImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderAddress _$OrderAddressFromJson(Map<String, dynamic> json) {
  return _OrderAddress.fromJson(json);
}

/// @nodoc
mixin _$OrderAddress {
  @JsonKey(name: "first_name")
  String? get firstName => throw _privateConstructorUsedError;
  @JsonKey(name: "last_name")
  String? get lastName => throw _privateConstructorUsedError;
  @JsonKey(name: "address_1")
  String? get address1 => throw _privateConstructorUsedError;
  @JsonKey(name: "address_2")
  String? get address2 => throw _privateConstructorUsedError;
  String? get city => throw _privateConstructorUsedError;
  String? get province => throw _privateConstructorUsedError;
  @JsonKey(name: "postal_code")
  String? get postalCode => throw _privateConstructorUsedError;
  @JsonKey(name: "country_code")
  String? get countryCode => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;

  /// Serializes this OrderAddress to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderAddress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderAddressCopyWith<OrderAddress> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderAddressCopyWith<$Res> {
  factory $OrderAddressCopyWith(
          OrderAddress value, $Res Function(OrderAddress) then) =
      _$OrderAddressCopyWithImpl<$Res, OrderAddress>;
  @useResult
  $Res call(
      {@JsonKey(name: "first_name") String? firstName,
      @JsonKey(name: "last_name") String? lastName,
      @JsonKey(name: "address_1") String? address1,
      @JsonKey(name: "address_2") String? address2,
      String? city,
      String? province,
      @JsonKey(name: "postal_code") String? postalCode,
      @JsonKey(name: "country_code") String? countryCode,
      String? phone});
}

/// @nodoc
class _$OrderAddressCopyWithImpl<$Res, $Val extends OrderAddress>
    implements $OrderAddressCopyWith<$Res> {
  _$OrderAddressCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderAddress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? address1 = freezed,
    Object? address2 = freezed,
    Object? city = freezed,
    Object? province = freezed,
    Object? postalCode = freezed,
    Object? countryCode = freezed,
    Object? phone = freezed,
  }) {
    return _then(_value.copyWith(
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      address1: freezed == address1
          ? _value.address1
          : address1 // ignore: cast_nullable_to_non_nullable
              as String?,
      address2: freezed == address2
          ? _value.address2
          : address2 // ignore: cast_nullable_to_non_nullable
              as String?,
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      province: freezed == province
          ? _value.province
          : province // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      countryCode: freezed == countryCode
          ? _value.countryCode
          : countryCode // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderAddressImplCopyWith<$Res>
    implements $OrderAddressCopyWith<$Res> {
  factory _$$OrderAddressImplCopyWith(
          _$OrderAddressImpl value, $Res Function(_$OrderAddressImpl) then) =
      __$$OrderAddressImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "first_name") String? firstName,
      @JsonKey(name: "last_name") String? lastName,
      @JsonKey(name: "address_1") String? address1,
      @JsonKey(name: "address_2") String? address2,
      String? city,
      String? province,
      @JsonKey(name: "postal_code") String? postalCode,
      @JsonKey(name: "country_code") String? countryCode,
      String? phone});
}

/// @nodoc
class __$$OrderAddressImplCopyWithImpl<$Res>
    extends _$OrderAddressCopyWithImpl<$Res, _$OrderAddressImpl>
    implements _$$OrderAddressImplCopyWith<$Res> {
  __$$OrderAddressImplCopyWithImpl(
      _$OrderAddressImpl _value, $Res Function(_$OrderAddressImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderAddress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? address1 = freezed,
    Object? address2 = freezed,
    Object? city = freezed,
    Object? province = freezed,
    Object? postalCode = freezed,
    Object? countryCode = freezed,
    Object? phone = freezed,
  }) {
    return _then(_$OrderAddressImpl(
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      address1: freezed == address1
          ? _value.address1
          : address1 // ignore: cast_nullable_to_non_nullable
              as String?,
      address2: freezed == address2
          ? _value.address2
          : address2 // ignore: cast_nullable_to_non_nullable
              as String?,
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      province: freezed == province
          ? _value.province
          : province // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      countryCode: freezed == countryCode
          ? _value.countryCode
          : countryCode // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderAddressImpl implements _OrderAddress {
  const _$OrderAddressImpl(
      {@JsonKey(name: "first_name") this.firstName,
      @JsonKey(name: "last_name") this.lastName,
      @JsonKey(name: "address_1") this.address1,
      @JsonKey(name: "address_2") this.address2,
      this.city,
      this.province,
      @JsonKey(name: "postal_code") this.postalCode,
      @JsonKey(name: "country_code") this.countryCode,
      this.phone});

  factory _$OrderAddressImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderAddressImplFromJson(json);

  @override
  @JsonKey(name: "first_name")
  final String? firstName;
  @override
  @JsonKey(name: "last_name")
  final String? lastName;
  @override
  @JsonKey(name: "address_1")
  final String? address1;
  @override
  @JsonKey(name: "address_2")
  final String? address2;
  @override
  final String? city;
  @override
  final String? province;
  @override
  @JsonKey(name: "postal_code")
  final String? postalCode;
  @override
  @JsonKey(name: "country_code")
  final String? countryCode;
  @override
  final String? phone;

  @override
  String toString() {
    return 'OrderAddress(firstName: $firstName, lastName: $lastName, address1: $address1, address2: $address2, city: $city, province: $province, postalCode: $postalCode, countryCode: $countryCode, phone: $phone)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderAddressImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.address1, address1) ||
                other.address1 == address1) &&
            (identical(other.address2, address2) ||
                other.address2 == address2) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.province, province) ||
                other.province == province) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode) &&
            (identical(other.countryCode, countryCode) ||
                other.countryCode == countryCode) &&
            (identical(other.phone, phone) || other.phone == phone));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, firstName, lastName, address1,
      address2, city, province, postalCode, countryCode, phone);

  /// Create a copy of OrderAddress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderAddressImplCopyWith<_$OrderAddressImpl> get copyWith =>
      __$$OrderAddressImplCopyWithImpl<_$OrderAddressImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderAddressImplToJson(
      this,
    );
  }
}

abstract class _OrderAddress implements OrderAddress {
  const factory _OrderAddress(
      {@JsonKey(name: "first_name") final String? firstName,
      @JsonKey(name: "last_name") final String? lastName,
      @JsonKey(name: "address_1") final String? address1,
      @JsonKey(name: "address_2") final String? address2,
      final String? city,
      final String? province,
      @JsonKey(name: "postal_code") final String? postalCode,
      @JsonKey(name: "country_code") final String? countryCode,
      final String? phone}) = _$OrderAddressImpl;

  factory _OrderAddress.fromJson(Map<String, dynamic> json) =
      _$OrderAddressImpl.fromJson;

  @override
  @JsonKey(name: "first_name")
  String? get firstName;
  @override
  @JsonKey(name: "last_name")
  String? get lastName;
  @override
  @JsonKey(name: "address_1")
  String? get address1;
  @override
  @JsonKey(name: "address_2")
  String? get address2;
  @override
  String? get city;
  @override
  String? get province;
  @override
  @JsonKey(name: "postal_code")
  String? get postalCode;
  @override
  @JsonKey(name: "country_code")
  String? get countryCode;
  @override
  String? get phone;

  /// Create a copy of OrderAddress
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderAddressImplCopyWith<_$OrderAddressImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PaymentCapture _$PaymentCaptureFromJson(Map<String, dynamic> json) {
  return _PaymentCapture.fromJson(json);
}

/// @nodoc
mixin _$PaymentCapture {
  String get id => throw _privateConstructorUsedError;
  num get amount => throw _privateConstructorUsedError;

  /// Serializes this PaymentCapture to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PaymentCapture
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentCaptureCopyWith<PaymentCapture> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentCaptureCopyWith<$Res> {
  factory $PaymentCaptureCopyWith(
          PaymentCapture value, $Res Function(PaymentCapture) then) =
      _$PaymentCaptureCopyWithImpl<$Res, PaymentCapture>;
  @useResult
  $Res call({String id, num amount});
}

/// @nodoc
class _$PaymentCaptureCopyWithImpl<$Res, $Val extends PaymentCapture>
    implements $PaymentCaptureCopyWith<$Res> {
  _$PaymentCaptureCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PaymentCapture
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? amount = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PaymentCaptureImplCopyWith<$Res>
    implements $PaymentCaptureCopyWith<$Res> {
  factory _$$PaymentCaptureImplCopyWith(_$PaymentCaptureImpl value,
          $Res Function(_$PaymentCaptureImpl) then) =
      __$$PaymentCaptureImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, num amount});
}

/// @nodoc
class __$$PaymentCaptureImplCopyWithImpl<$Res>
    extends _$PaymentCaptureCopyWithImpl<$Res, _$PaymentCaptureImpl>
    implements _$$PaymentCaptureImplCopyWith<$Res> {
  __$$PaymentCaptureImplCopyWithImpl(
      _$PaymentCaptureImpl _value, $Res Function(_$PaymentCaptureImpl) _then)
      : super(_value, _then);

  /// Create a copy of PaymentCapture
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? amount = null,
  }) {
    return _then(_$PaymentCaptureImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentCaptureImpl implements _PaymentCapture {
  const _$PaymentCaptureImpl({this.id = "", this.amount = 0});

  factory _$PaymentCaptureImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentCaptureImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final num amount;

  @override
  String toString() {
    return 'PaymentCapture(id: $id, amount: $amount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentCaptureImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.amount, amount) || other.amount == amount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, amount);

  /// Create a copy of PaymentCapture
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentCaptureImplCopyWith<_$PaymentCaptureImpl> get copyWith =>
      __$$PaymentCaptureImplCopyWithImpl<_$PaymentCaptureImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentCaptureImplToJson(
      this,
    );
  }
}

abstract class _PaymentCapture implements PaymentCapture {
  const factory _PaymentCapture({final String id, final num amount}) =
      _$PaymentCaptureImpl;

  factory _PaymentCapture.fromJson(Map<String, dynamic> json) =
      _$PaymentCaptureImpl.fromJson;

  @override
  String get id;
  @override
  num get amount;

  /// Create a copy of PaymentCapture
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentCaptureImplCopyWith<_$PaymentCaptureImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderRefund _$OrderRefundFromJson(Map<String, dynamic> json) {
  return _OrderRefund.fromJson(json);
}

/// @nodoc
mixin _$OrderRefund {
  String get id => throw _privateConstructorUsedError;
  num get amount => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  String? get note => throw _privateConstructorUsedError;
  String? get reason => throw _privateConstructorUsedError;

  /// Serializes this OrderRefund to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderRefund
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderRefundCopyWith<OrderRefund> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderRefundCopyWith<$Res> {
  factory $OrderRefundCopyWith(
          OrderRefund value, $Res Function(OrderRefund) then) =
      _$OrderRefundCopyWithImpl<$Res, OrderRefund>;
  @useResult
  $Res call(
      {String id,
      num amount,
      @JsonKey(name: "created_at") String? createdAt,
      String? note,
      String? reason});
}

/// @nodoc
class _$OrderRefundCopyWithImpl<$Res, $Val extends OrderRefund>
    implements $OrderRefundCopyWith<$Res> {
  _$OrderRefundCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderRefund
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? amount = null,
    Object? createdAt = freezed,
    Object? note = freezed,
    Object? reason = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      note: freezed == note
          ? _value.note
          : note // ignore: cast_nullable_to_non_nullable
              as String?,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderRefundImplCopyWith<$Res>
    implements $OrderRefundCopyWith<$Res> {
  factory _$$OrderRefundImplCopyWith(
          _$OrderRefundImpl value, $Res Function(_$OrderRefundImpl) then) =
      __$$OrderRefundImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      num amount,
      @JsonKey(name: "created_at") String? createdAt,
      String? note,
      String? reason});
}

/// @nodoc
class __$$OrderRefundImplCopyWithImpl<$Res>
    extends _$OrderRefundCopyWithImpl<$Res, _$OrderRefundImpl>
    implements _$$OrderRefundImplCopyWith<$Res> {
  __$$OrderRefundImplCopyWithImpl(
      _$OrderRefundImpl _value, $Res Function(_$OrderRefundImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderRefund
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? amount = null,
    Object? createdAt = freezed,
    Object? note = freezed,
    Object? reason = freezed,
  }) {
    return _then(_$OrderRefundImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      note: freezed == note
          ? _value.note
          : note // ignore: cast_nullable_to_non_nullable
              as String?,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderRefundImpl implements _OrderRefund {
  const _$OrderRefundImpl(
      {this.id = "",
      this.amount = 0,
      @JsonKey(name: "created_at") this.createdAt,
      this.note,
      this.reason});

  factory _$OrderRefundImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderRefundImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final num amount;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  final String? note;
  @override
  final String? reason;

  @override
  String toString() {
    return 'OrderRefund(id: $id, amount: $amount, createdAt: $createdAt, note: $note, reason: $reason)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderRefundImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.note, note) || other.note == note) &&
            (identical(other.reason, reason) || other.reason == reason));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, amount, createdAt, note, reason);

  /// Create a copy of OrderRefund
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderRefundImplCopyWith<_$OrderRefundImpl> get copyWith =>
      __$$OrderRefundImplCopyWithImpl<_$OrderRefundImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderRefundImplToJson(
      this,
    );
  }
}

abstract class _OrderRefund implements OrderRefund {
  const factory _OrderRefund(
      {final String id,
      final num amount,
      @JsonKey(name: "created_at") final String? createdAt,
      final String? note,
      final String? reason}) = _$OrderRefundImpl;

  factory _OrderRefund.fromJson(Map<String, dynamic> json) =
      _$OrderRefundImpl.fromJson;

  @override
  String get id;
  @override
  num get amount;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  String? get note;
  @override
  String? get reason;

  /// Create a copy of OrderRefund
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderRefundImplCopyWith<_$OrderRefundImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderPayment _$OrderPaymentFromJson(Map<String, dynamic> json) {
  return _OrderPayment.fromJson(json);
}

/// @nodoc
mixin _$OrderPayment {
  String get id => throw _privateConstructorUsedError;
  num get amount => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String? get currencyCode => throw _privateConstructorUsedError;
  @JsonKey(name: "provider_id")
  String? get providerId => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "captured_at")
  String? get capturedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "canceled_at")
  String? get canceledAt => throw _privateConstructorUsedError;
  @JsonKey(name: "captured_amount")
  num get capturedAmount => throw _privateConstructorUsedError;
  @JsonKey(name: "refunded_amount")
  num get refundedAmount => throw _privateConstructorUsedError;
  List<PaymentCapture> get captures => throw _privateConstructorUsedError;
  List<OrderRefund> get refunds => throw _privateConstructorUsedError;

  /// Serializes this OrderPayment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderPayment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderPaymentCopyWith<OrderPayment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderPaymentCopyWith<$Res> {
  factory $OrderPaymentCopyWith(
          OrderPayment value, $Res Function(OrderPayment) then) =
      _$OrderPaymentCopyWithImpl<$Res, OrderPayment>;
  @useResult
  $Res call(
      {String id,
      num amount,
      @JsonKey(name: "currency_code") String? currencyCode,
      @JsonKey(name: "provider_id") String? providerId,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "captured_at") String? capturedAt,
      @JsonKey(name: "canceled_at") String? canceledAt,
      @JsonKey(name: "captured_amount") num capturedAmount,
      @JsonKey(name: "refunded_amount") num refundedAmount,
      List<PaymentCapture> captures,
      List<OrderRefund> refunds});
}

/// @nodoc
class _$OrderPaymentCopyWithImpl<$Res, $Val extends OrderPayment>
    implements $OrderPaymentCopyWith<$Res> {
  _$OrderPaymentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderPayment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? amount = null,
    Object? currencyCode = freezed,
    Object? providerId = freezed,
    Object? createdAt = freezed,
    Object? capturedAt = freezed,
    Object? canceledAt = freezed,
    Object? capturedAmount = null,
    Object? refundedAmount = null,
    Object? captures = null,
    Object? refunds = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: freezed == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String?,
      providerId: freezed == providerId
          ? _value.providerId
          : providerId // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      capturedAt: freezed == capturedAt
          ? _value.capturedAt
          : capturedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      canceledAt: freezed == canceledAt
          ? _value.canceledAt
          : canceledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      capturedAmount: null == capturedAmount
          ? _value.capturedAmount
          : capturedAmount // ignore: cast_nullable_to_non_nullable
              as num,
      refundedAmount: null == refundedAmount
          ? _value.refundedAmount
          : refundedAmount // ignore: cast_nullable_to_non_nullable
              as num,
      captures: null == captures
          ? _value.captures
          : captures // ignore: cast_nullable_to_non_nullable
              as List<PaymentCapture>,
      refunds: null == refunds
          ? _value.refunds
          : refunds // ignore: cast_nullable_to_non_nullable
              as List<OrderRefund>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderPaymentImplCopyWith<$Res>
    implements $OrderPaymentCopyWith<$Res> {
  factory _$$OrderPaymentImplCopyWith(
          _$OrderPaymentImpl value, $Res Function(_$OrderPaymentImpl) then) =
      __$$OrderPaymentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      num amount,
      @JsonKey(name: "currency_code") String? currencyCode,
      @JsonKey(name: "provider_id") String? providerId,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "captured_at") String? capturedAt,
      @JsonKey(name: "canceled_at") String? canceledAt,
      @JsonKey(name: "captured_amount") num capturedAmount,
      @JsonKey(name: "refunded_amount") num refundedAmount,
      List<PaymentCapture> captures,
      List<OrderRefund> refunds});
}

/// @nodoc
class __$$OrderPaymentImplCopyWithImpl<$Res>
    extends _$OrderPaymentCopyWithImpl<$Res, _$OrderPaymentImpl>
    implements _$$OrderPaymentImplCopyWith<$Res> {
  __$$OrderPaymentImplCopyWithImpl(
      _$OrderPaymentImpl _value, $Res Function(_$OrderPaymentImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderPayment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? amount = null,
    Object? currencyCode = freezed,
    Object? providerId = freezed,
    Object? createdAt = freezed,
    Object? capturedAt = freezed,
    Object? canceledAt = freezed,
    Object? capturedAmount = null,
    Object? refundedAmount = null,
    Object? captures = null,
    Object? refunds = null,
  }) {
    return _then(_$OrderPaymentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: freezed == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String?,
      providerId: freezed == providerId
          ? _value.providerId
          : providerId // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      capturedAt: freezed == capturedAt
          ? _value.capturedAt
          : capturedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      canceledAt: freezed == canceledAt
          ? _value.canceledAt
          : canceledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      capturedAmount: null == capturedAmount
          ? _value.capturedAmount
          : capturedAmount // ignore: cast_nullable_to_non_nullable
              as num,
      refundedAmount: null == refundedAmount
          ? _value.refundedAmount
          : refundedAmount // ignore: cast_nullable_to_non_nullable
              as num,
      captures: null == captures
          ? _value._captures
          : captures // ignore: cast_nullable_to_non_nullable
              as List<PaymentCapture>,
      refunds: null == refunds
          ? _value._refunds
          : refunds // ignore: cast_nullable_to_non_nullable
              as List<OrderRefund>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderPaymentImpl implements _OrderPayment {
  const _$OrderPaymentImpl(
      {this.id = "",
      this.amount = 0,
      @JsonKey(name: "currency_code") this.currencyCode,
      @JsonKey(name: "provider_id") this.providerId,
      @JsonKey(name: "created_at") this.createdAt,
      @JsonKey(name: "captured_at") this.capturedAt,
      @JsonKey(name: "canceled_at") this.canceledAt,
      @JsonKey(name: "captured_amount") this.capturedAmount = 0,
      @JsonKey(name: "refunded_amount") this.refundedAmount = 0,
      final List<PaymentCapture> captures = const <PaymentCapture>[],
      final List<OrderRefund> refunds = const <OrderRefund>[]})
      : _captures = captures,
        _refunds = refunds;

  factory _$OrderPaymentImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderPaymentImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final num amount;
  @override
  @JsonKey(name: "currency_code")
  final String? currencyCode;
  @override
  @JsonKey(name: "provider_id")
  final String? providerId;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  @JsonKey(name: "captured_at")
  final String? capturedAt;
  @override
  @JsonKey(name: "canceled_at")
  final String? canceledAt;
  @override
  @JsonKey(name: "captured_amount")
  final num capturedAmount;
  @override
  @JsonKey(name: "refunded_amount")
  final num refundedAmount;
  final List<PaymentCapture> _captures;
  @override
  @JsonKey()
  List<PaymentCapture> get captures {
    if (_captures is EqualUnmodifiableListView) return _captures;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_captures);
  }

  final List<OrderRefund> _refunds;
  @override
  @JsonKey()
  List<OrderRefund> get refunds {
    if (_refunds is EqualUnmodifiableListView) return _refunds;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_refunds);
  }

  @override
  String toString() {
    return 'OrderPayment(id: $id, amount: $amount, currencyCode: $currencyCode, providerId: $providerId, createdAt: $createdAt, capturedAt: $capturedAt, canceledAt: $canceledAt, capturedAmount: $capturedAmount, refundedAmount: $refundedAmount, captures: $captures, refunds: $refunds)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderPaymentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode) &&
            (identical(other.providerId, providerId) ||
                other.providerId == providerId) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.capturedAt, capturedAt) ||
                other.capturedAt == capturedAt) &&
            (identical(other.canceledAt, canceledAt) ||
                other.canceledAt == canceledAt) &&
            (identical(other.capturedAmount, capturedAmount) ||
                other.capturedAmount == capturedAmount) &&
            (identical(other.refundedAmount, refundedAmount) ||
                other.refundedAmount == refundedAmount) &&
            const DeepCollectionEquality().equals(other._captures, _captures) &&
            const DeepCollectionEquality().equals(other._refunds, _refunds));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      amount,
      currencyCode,
      providerId,
      createdAt,
      capturedAt,
      canceledAt,
      capturedAmount,
      refundedAmount,
      const DeepCollectionEquality().hash(_captures),
      const DeepCollectionEquality().hash(_refunds));

  /// Create a copy of OrderPayment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderPaymentImplCopyWith<_$OrderPaymentImpl> get copyWith =>
      __$$OrderPaymentImplCopyWithImpl<_$OrderPaymentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderPaymentImplToJson(
      this,
    );
  }
}

abstract class _OrderPayment implements OrderPayment {
  const factory _OrderPayment(
      {final String id,
      final num amount,
      @JsonKey(name: "currency_code") final String? currencyCode,
      @JsonKey(name: "provider_id") final String? providerId,
      @JsonKey(name: "created_at") final String? createdAt,
      @JsonKey(name: "captured_at") final String? capturedAt,
      @JsonKey(name: "canceled_at") final String? canceledAt,
      @JsonKey(name: "captured_amount") final num capturedAmount,
      @JsonKey(name: "refunded_amount") final num refundedAmount,
      final List<PaymentCapture> captures,
      final List<OrderRefund> refunds}) = _$OrderPaymentImpl;

  factory _OrderPayment.fromJson(Map<String, dynamic> json) =
      _$OrderPaymentImpl.fromJson;

  @override
  String get id;
  @override
  num get amount;
  @override
  @JsonKey(name: "currency_code")
  String? get currencyCode;
  @override
  @JsonKey(name: "provider_id")
  String? get providerId;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  @JsonKey(name: "captured_at")
  String? get capturedAt;
  @override
  @JsonKey(name: "canceled_at")
  String? get canceledAt;
  @override
  @JsonKey(name: "captured_amount")
  num get capturedAmount;
  @override
  @JsonKey(name: "refunded_amount")
  num get refundedAmount;
  @override
  List<PaymentCapture> get captures;
  @override
  List<OrderRefund> get refunds;

  /// Create a copy of OrderPayment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderPaymentImplCopyWith<_$OrderPaymentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

FulfillmentItem _$FulfillmentItemFromJson(Map<String, dynamic> json) {
  return _FulfillmentItem.fromJson(json);
}

/// @nodoc
mixin _$FulfillmentItem {
  String get title => throw _privateConstructorUsedError;
  num get quantity => throw _privateConstructorUsedError;
  @JsonKey(name: "line_item_id")
  String get lineItemId => throw _privateConstructorUsedError;

  /// Serializes this FulfillmentItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FulfillmentItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FulfillmentItemCopyWith<FulfillmentItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FulfillmentItemCopyWith<$Res> {
  factory $FulfillmentItemCopyWith(
          FulfillmentItem value, $Res Function(FulfillmentItem) then) =
      _$FulfillmentItemCopyWithImpl<$Res, FulfillmentItem>;
  @useResult
  $Res call(
      {String title,
      num quantity,
      @JsonKey(name: "line_item_id") String lineItemId});
}

/// @nodoc
class _$FulfillmentItemCopyWithImpl<$Res, $Val extends FulfillmentItem>
    implements $FulfillmentItemCopyWith<$Res> {
  _$FulfillmentItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FulfillmentItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? quantity = null,
    Object? lineItemId = null,
  }) {
    return _then(_value.copyWith(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as num,
      lineItemId: null == lineItemId
          ? _value.lineItemId
          : lineItemId // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$FulfillmentItemImplCopyWith<$Res>
    implements $FulfillmentItemCopyWith<$Res> {
  factory _$$FulfillmentItemImplCopyWith(_$FulfillmentItemImpl value,
          $Res Function(_$FulfillmentItemImpl) then) =
      __$$FulfillmentItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String title,
      num quantity,
      @JsonKey(name: "line_item_id") String lineItemId});
}

/// @nodoc
class __$$FulfillmentItemImplCopyWithImpl<$Res>
    extends _$FulfillmentItemCopyWithImpl<$Res, _$FulfillmentItemImpl>
    implements _$$FulfillmentItemImplCopyWith<$Res> {
  __$$FulfillmentItemImplCopyWithImpl(
      _$FulfillmentItemImpl _value, $Res Function(_$FulfillmentItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of FulfillmentItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? quantity = null,
    Object? lineItemId = null,
  }) {
    return _then(_$FulfillmentItemImpl(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as num,
      lineItemId: null == lineItemId
          ? _value.lineItemId
          : lineItemId // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$FulfillmentItemImpl implements _FulfillmentItem {
  const _$FulfillmentItemImpl(
      {this.title = "",
      this.quantity = 0,
      @JsonKey(name: "line_item_id") this.lineItemId = ""});

  factory _$FulfillmentItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$FulfillmentItemImplFromJson(json);

  @override
  @JsonKey()
  final String title;
  @override
  @JsonKey()
  final num quantity;
  @override
  @JsonKey(name: "line_item_id")
  final String lineItemId;

  @override
  String toString() {
    return 'FulfillmentItem(title: $title, quantity: $quantity, lineItemId: $lineItemId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FulfillmentItemImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.lineItemId, lineItemId) ||
                other.lineItemId == lineItemId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, quantity, lineItemId);

  /// Create a copy of FulfillmentItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FulfillmentItemImplCopyWith<_$FulfillmentItemImpl> get copyWith =>
      __$$FulfillmentItemImplCopyWithImpl<_$FulfillmentItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FulfillmentItemImplToJson(
      this,
    );
  }
}

abstract class _FulfillmentItem implements FulfillmentItem {
  const factory _FulfillmentItem(
          {final String title,
          final num quantity,
          @JsonKey(name: "line_item_id") final String lineItemId}) =
      _$FulfillmentItemImpl;

  factory _FulfillmentItem.fromJson(Map<String, dynamic> json) =
      _$FulfillmentItemImpl.fromJson;

  @override
  String get title;
  @override
  num get quantity;
  @override
  @JsonKey(name: "line_item_id")
  String get lineItemId;

  /// Create a copy of FulfillmentItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FulfillmentItemImplCopyWith<_$FulfillmentItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

FulfillmentLabel _$FulfillmentLabelFromJson(Map<String, dynamic> json) {
  return _FulfillmentLabel.fromJson(json);
}

/// @nodoc
mixin _$FulfillmentLabel {
  @JsonKey(name: "tracking_number")
  String? get trackingNumber => throw _privateConstructorUsedError;
  @JsonKey(name: "tracking_url")
  String? get trackingUrl => throw _privateConstructorUsedError;

  /// Serializes this FulfillmentLabel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FulfillmentLabel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FulfillmentLabelCopyWith<FulfillmentLabel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FulfillmentLabelCopyWith<$Res> {
  factory $FulfillmentLabelCopyWith(
          FulfillmentLabel value, $Res Function(FulfillmentLabel) then) =
      _$FulfillmentLabelCopyWithImpl<$Res, FulfillmentLabel>;
  @useResult
  $Res call(
      {@JsonKey(name: "tracking_number") String? trackingNumber,
      @JsonKey(name: "tracking_url") String? trackingUrl});
}

/// @nodoc
class _$FulfillmentLabelCopyWithImpl<$Res, $Val extends FulfillmentLabel>
    implements $FulfillmentLabelCopyWith<$Res> {
  _$FulfillmentLabelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FulfillmentLabel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? trackingNumber = freezed,
    Object? trackingUrl = freezed,
  }) {
    return _then(_value.copyWith(
      trackingNumber: freezed == trackingNumber
          ? _value.trackingNumber
          : trackingNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      trackingUrl: freezed == trackingUrl
          ? _value.trackingUrl
          : trackingUrl // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$FulfillmentLabelImplCopyWith<$Res>
    implements $FulfillmentLabelCopyWith<$Res> {
  factory _$$FulfillmentLabelImplCopyWith(_$FulfillmentLabelImpl value,
          $Res Function(_$FulfillmentLabelImpl) then) =
      __$$FulfillmentLabelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "tracking_number") String? trackingNumber,
      @JsonKey(name: "tracking_url") String? trackingUrl});
}

/// @nodoc
class __$$FulfillmentLabelImplCopyWithImpl<$Res>
    extends _$FulfillmentLabelCopyWithImpl<$Res, _$FulfillmentLabelImpl>
    implements _$$FulfillmentLabelImplCopyWith<$Res> {
  __$$FulfillmentLabelImplCopyWithImpl(_$FulfillmentLabelImpl _value,
      $Res Function(_$FulfillmentLabelImpl) _then)
      : super(_value, _then);

  /// Create a copy of FulfillmentLabel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? trackingNumber = freezed,
    Object? trackingUrl = freezed,
  }) {
    return _then(_$FulfillmentLabelImpl(
      trackingNumber: freezed == trackingNumber
          ? _value.trackingNumber
          : trackingNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      trackingUrl: freezed == trackingUrl
          ? _value.trackingUrl
          : trackingUrl // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$FulfillmentLabelImpl implements _FulfillmentLabel {
  const _$FulfillmentLabelImpl(
      {@JsonKey(name: "tracking_number") this.trackingNumber,
      @JsonKey(name: "tracking_url") this.trackingUrl});

  factory _$FulfillmentLabelImpl.fromJson(Map<String, dynamic> json) =>
      _$$FulfillmentLabelImplFromJson(json);

  @override
  @JsonKey(name: "tracking_number")
  final String? trackingNumber;
  @override
  @JsonKey(name: "tracking_url")
  final String? trackingUrl;

  @override
  String toString() {
    return 'FulfillmentLabel(trackingNumber: $trackingNumber, trackingUrl: $trackingUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FulfillmentLabelImpl &&
            (identical(other.trackingNumber, trackingNumber) ||
                other.trackingNumber == trackingNumber) &&
            (identical(other.trackingUrl, trackingUrl) ||
                other.trackingUrl == trackingUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, trackingNumber, trackingUrl);

  /// Create a copy of FulfillmentLabel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FulfillmentLabelImplCopyWith<_$FulfillmentLabelImpl> get copyWith =>
      __$$FulfillmentLabelImplCopyWithImpl<_$FulfillmentLabelImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FulfillmentLabelImplToJson(
      this,
    );
  }
}

abstract class _FulfillmentLabel implements FulfillmentLabel {
  const factory _FulfillmentLabel(
          {@JsonKey(name: "tracking_number") final String? trackingNumber,
          @JsonKey(name: "tracking_url") final String? trackingUrl}) =
      _$FulfillmentLabelImpl;

  factory _FulfillmentLabel.fromJson(Map<String, dynamic> json) =
      _$FulfillmentLabelImpl.fromJson;

  @override
  @JsonKey(name: "tracking_number")
  String? get trackingNumber;
  @override
  @JsonKey(name: "tracking_url")
  String? get trackingUrl;

  /// Create a copy of FulfillmentLabel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FulfillmentLabelImplCopyWith<_$FulfillmentLabelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderFulfillment _$OrderFulfillmentFromJson(Map<String, dynamic> json) {
  return _OrderFulfillment.fromJson(json);
}

/// @nodoc
mixin _$OrderFulfillment {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "packed_at")
  String? get packedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "shipped_at")
  String? get shippedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "delivered_at")
  String? get deliveredAt => throw _privateConstructorUsedError;
  @JsonKey(name: "canceled_at")
  String? get canceledAt => throw _privateConstructorUsedError;
  @JsonKey(name: "provider_id")
  String? get providerId => throw _privateConstructorUsedError;
  @JsonKey(name: "location_id")
  String? get locationId => throw _privateConstructorUsedError;
  @JsonKey(name: "shipping_option_name")
  String? get shippingOptionName => throw _privateConstructorUsedError;
  List<FulfillmentItem> get items => throw _privateConstructorUsedError;
  List<FulfillmentLabel> get labels => throw _privateConstructorUsedError;

  /// Serializes this OrderFulfillment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderFulfillment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderFulfillmentCopyWith<OrderFulfillment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderFulfillmentCopyWith<$Res> {
  factory $OrderFulfillmentCopyWith(
          OrderFulfillment value, $Res Function(OrderFulfillment) then) =
      _$OrderFulfillmentCopyWithImpl<$Res, OrderFulfillment>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "packed_at") String? packedAt,
      @JsonKey(name: "shipped_at") String? shippedAt,
      @JsonKey(name: "delivered_at") String? deliveredAt,
      @JsonKey(name: "canceled_at") String? canceledAt,
      @JsonKey(name: "provider_id") String? providerId,
      @JsonKey(name: "location_id") String? locationId,
      @JsonKey(name: "shipping_option_name") String? shippingOptionName,
      List<FulfillmentItem> items,
      List<FulfillmentLabel> labels});
}

/// @nodoc
class _$OrderFulfillmentCopyWithImpl<$Res, $Val extends OrderFulfillment>
    implements $OrderFulfillmentCopyWith<$Res> {
  _$OrderFulfillmentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderFulfillment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? createdAt = freezed,
    Object? packedAt = freezed,
    Object? shippedAt = freezed,
    Object? deliveredAt = freezed,
    Object? canceledAt = freezed,
    Object? providerId = freezed,
    Object? locationId = freezed,
    Object? shippingOptionName = freezed,
    Object? items = null,
    Object? labels = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      packedAt: freezed == packedAt
          ? _value.packedAt
          : packedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      shippedAt: freezed == shippedAt
          ? _value.shippedAt
          : shippedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      deliveredAt: freezed == deliveredAt
          ? _value.deliveredAt
          : deliveredAt // ignore: cast_nullable_to_non_nullable
              as String?,
      canceledAt: freezed == canceledAt
          ? _value.canceledAt
          : canceledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      providerId: freezed == providerId
          ? _value.providerId
          : providerId // ignore: cast_nullable_to_non_nullable
              as String?,
      locationId: freezed == locationId
          ? _value.locationId
          : locationId // ignore: cast_nullable_to_non_nullable
              as String?,
      shippingOptionName: freezed == shippingOptionName
          ? _value.shippingOptionName
          : shippingOptionName // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<FulfillmentItem>,
      labels: null == labels
          ? _value.labels
          : labels // ignore: cast_nullable_to_non_nullable
              as List<FulfillmentLabel>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderFulfillmentImplCopyWith<$Res>
    implements $OrderFulfillmentCopyWith<$Res> {
  factory _$$OrderFulfillmentImplCopyWith(_$OrderFulfillmentImpl value,
          $Res Function(_$OrderFulfillmentImpl) then) =
      __$$OrderFulfillmentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(name: "packed_at") String? packedAt,
      @JsonKey(name: "shipped_at") String? shippedAt,
      @JsonKey(name: "delivered_at") String? deliveredAt,
      @JsonKey(name: "canceled_at") String? canceledAt,
      @JsonKey(name: "provider_id") String? providerId,
      @JsonKey(name: "location_id") String? locationId,
      @JsonKey(name: "shipping_option_name") String? shippingOptionName,
      List<FulfillmentItem> items,
      List<FulfillmentLabel> labels});
}

/// @nodoc
class __$$OrderFulfillmentImplCopyWithImpl<$Res>
    extends _$OrderFulfillmentCopyWithImpl<$Res, _$OrderFulfillmentImpl>
    implements _$$OrderFulfillmentImplCopyWith<$Res> {
  __$$OrderFulfillmentImplCopyWithImpl(_$OrderFulfillmentImpl _value,
      $Res Function(_$OrderFulfillmentImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderFulfillment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? createdAt = freezed,
    Object? packedAt = freezed,
    Object? shippedAt = freezed,
    Object? deliveredAt = freezed,
    Object? canceledAt = freezed,
    Object? providerId = freezed,
    Object? locationId = freezed,
    Object? shippingOptionName = freezed,
    Object? items = null,
    Object? labels = null,
  }) {
    return _then(_$OrderFulfillmentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
      packedAt: freezed == packedAt
          ? _value.packedAt
          : packedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      shippedAt: freezed == shippedAt
          ? _value.shippedAt
          : shippedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      deliveredAt: freezed == deliveredAt
          ? _value.deliveredAt
          : deliveredAt // ignore: cast_nullable_to_non_nullable
              as String?,
      canceledAt: freezed == canceledAt
          ? _value.canceledAt
          : canceledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      providerId: freezed == providerId
          ? _value.providerId
          : providerId // ignore: cast_nullable_to_non_nullable
              as String?,
      locationId: freezed == locationId
          ? _value.locationId
          : locationId // ignore: cast_nullable_to_non_nullable
              as String?,
      shippingOptionName: freezed == shippingOptionName
          ? _value.shippingOptionName
          : shippingOptionName // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<FulfillmentItem>,
      labels: null == labels
          ? _value._labels
          : labels // ignore: cast_nullable_to_non_nullable
              as List<FulfillmentLabel>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderFulfillmentImpl implements _OrderFulfillment {
  const _$OrderFulfillmentImpl(
      {this.id = "",
      @JsonKey(name: "created_at") this.createdAt,
      @JsonKey(name: "packed_at") this.packedAt,
      @JsonKey(name: "shipped_at") this.shippedAt,
      @JsonKey(name: "delivered_at") this.deliveredAt,
      @JsonKey(name: "canceled_at") this.canceledAt,
      @JsonKey(name: "provider_id") this.providerId,
      @JsonKey(name: "location_id") this.locationId,
      @JsonKey(name: "shipping_option_name") this.shippingOptionName,
      final List<FulfillmentItem> items = const <FulfillmentItem>[],
      final List<FulfillmentLabel> labels = const <FulfillmentLabel>[]})
      : _items = items,
        _labels = labels;

  factory _$OrderFulfillmentImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderFulfillmentImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  @JsonKey(name: "packed_at")
  final String? packedAt;
  @override
  @JsonKey(name: "shipped_at")
  final String? shippedAt;
  @override
  @JsonKey(name: "delivered_at")
  final String? deliveredAt;
  @override
  @JsonKey(name: "canceled_at")
  final String? canceledAt;
  @override
  @JsonKey(name: "provider_id")
  final String? providerId;
  @override
  @JsonKey(name: "location_id")
  final String? locationId;
  @override
  @JsonKey(name: "shipping_option_name")
  final String? shippingOptionName;
  final List<FulfillmentItem> _items;
  @override
  @JsonKey()
  List<FulfillmentItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  final List<FulfillmentLabel> _labels;
  @override
  @JsonKey()
  List<FulfillmentLabel> get labels {
    if (_labels is EqualUnmodifiableListView) return _labels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_labels);
  }

  @override
  String toString() {
    return 'OrderFulfillment(id: $id, createdAt: $createdAt, packedAt: $packedAt, shippedAt: $shippedAt, deliveredAt: $deliveredAt, canceledAt: $canceledAt, providerId: $providerId, locationId: $locationId, shippingOptionName: $shippingOptionName, items: $items, labels: $labels)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderFulfillmentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.packedAt, packedAt) ||
                other.packedAt == packedAt) &&
            (identical(other.shippedAt, shippedAt) ||
                other.shippedAt == shippedAt) &&
            (identical(other.deliveredAt, deliveredAt) ||
                other.deliveredAt == deliveredAt) &&
            (identical(other.canceledAt, canceledAt) ||
                other.canceledAt == canceledAt) &&
            (identical(other.providerId, providerId) ||
                other.providerId == providerId) &&
            (identical(other.locationId, locationId) ||
                other.locationId == locationId) &&
            (identical(other.shippingOptionName, shippingOptionName) ||
                other.shippingOptionName == shippingOptionName) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            const DeepCollectionEquality().equals(other._labels, _labels));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      createdAt,
      packedAt,
      shippedAt,
      deliveredAt,
      canceledAt,
      providerId,
      locationId,
      shippingOptionName,
      const DeepCollectionEquality().hash(_items),
      const DeepCollectionEquality().hash(_labels));

  /// Create a copy of OrderFulfillment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderFulfillmentImplCopyWith<_$OrderFulfillmentImpl> get copyWith =>
      __$$OrderFulfillmentImplCopyWithImpl<_$OrderFulfillmentImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderFulfillmentImplToJson(
      this,
    );
  }
}

abstract class _OrderFulfillment implements OrderFulfillment {
  const factory _OrderFulfillment(
      {final String id,
      @JsonKey(name: "created_at") final String? createdAt,
      @JsonKey(name: "packed_at") final String? packedAt,
      @JsonKey(name: "shipped_at") final String? shippedAt,
      @JsonKey(name: "delivered_at") final String? deliveredAt,
      @JsonKey(name: "canceled_at") final String? canceledAt,
      @JsonKey(name: "provider_id") final String? providerId,
      @JsonKey(name: "location_id") final String? locationId,
      @JsonKey(name: "shipping_option_name") final String? shippingOptionName,
      final List<FulfillmentItem> items,
      final List<FulfillmentLabel> labels}) = _$OrderFulfillmentImpl;

  factory _OrderFulfillment.fromJson(Map<String, dynamic> json) =
      _$OrderFulfillmentImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  @JsonKey(name: "packed_at")
  String? get packedAt;
  @override
  @JsonKey(name: "shipped_at")
  String? get shippedAt;
  @override
  @JsonKey(name: "delivered_at")
  String? get deliveredAt;
  @override
  @JsonKey(name: "canceled_at")
  String? get canceledAt;
  @override
  @JsonKey(name: "provider_id")
  String? get providerId;
  @override
  @JsonKey(name: "location_id")
  String? get locationId;
  @override
  @JsonKey(name: "shipping_option_name")
  String? get shippingOptionName;
  @override
  List<FulfillmentItem> get items;
  @override
  List<FulfillmentLabel> get labels;

  /// Create a copy of OrderFulfillment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderFulfillmentImplCopyWith<_$OrderFulfillmentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderShippingMethod _$OrderShippingMethodFromJson(Map<String, dynamic> json) {
  return _OrderShippingMethod.fromJson(json);
}

/// @nodoc
mixin _$OrderShippingMethod {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  num get amount => throw _privateConstructorUsedError;
  num get total => throw _privateConstructorUsedError;
  num get subtotal => throw _privateConstructorUsedError;
  @JsonKey(name: "tax_total")
  num get taxTotal => throw _privateConstructorUsedError;

  /// Serializes this OrderShippingMethod to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderShippingMethod
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderShippingMethodCopyWith<OrderShippingMethod> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderShippingMethodCopyWith<$Res> {
  factory $OrderShippingMethodCopyWith(
          OrderShippingMethod value, $Res Function(OrderShippingMethod) then) =
      _$OrderShippingMethodCopyWithImpl<$Res, OrderShippingMethod>;
  @useResult
  $Res call(
      {String id,
      String name,
      num amount,
      num total,
      num subtotal,
      @JsonKey(name: "tax_total") num taxTotal});
}

/// @nodoc
class _$OrderShippingMethodCopyWithImpl<$Res, $Val extends OrderShippingMethod>
    implements $OrderShippingMethodCopyWith<$Res> {
  _$OrderShippingMethodCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderShippingMethod
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? amount = null,
    Object? total = null,
    Object? subtotal = null,
    Object? taxTotal = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as num,
      taxTotal: null == taxTotal
          ? _value.taxTotal
          : taxTotal // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderShippingMethodImplCopyWith<$Res>
    implements $OrderShippingMethodCopyWith<$Res> {
  factory _$$OrderShippingMethodImplCopyWith(_$OrderShippingMethodImpl value,
          $Res Function(_$OrderShippingMethodImpl) then) =
      __$$OrderShippingMethodImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      num amount,
      num total,
      num subtotal,
      @JsonKey(name: "tax_total") num taxTotal});
}

/// @nodoc
class __$$OrderShippingMethodImplCopyWithImpl<$Res>
    extends _$OrderShippingMethodCopyWithImpl<$Res, _$OrderShippingMethodImpl>
    implements _$$OrderShippingMethodImplCopyWith<$Res> {
  __$$OrderShippingMethodImplCopyWithImpl(_$OrderShippingMethodImpl _value,
      $Res Function(_$OrderShippingMethodImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderShippingMethod
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? amount = null,
    Object? total = null,
    Object? subtotal = null,
    Object? taxTotal = null,
  }) {
    return _then(_$OrderShippingMethodImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as num,
      taxTotal: null == taxTotal
          ? _value.taxTotal
          : taxTotal // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderShippingMethodImpl implements _OrderShippingMethod {
  const _$OrderShippingMethodImpl(
      {this.id = "",
      this.name = "",
      this.amount = 0,
      this.total = 0,
      this.subtotal = 0,
      @JsonKey(name: "tax_total") this.taxTotal = 0});

  factory _$OrderShippingMethodImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderShippingMethodImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey()
  final num amount;
  @override
  @JsonKey()
  final num total;
  @override
  @JsonKey()
  final num subtotal;
  @override
  @JsonKey(name: "tax_total")
  final num taxTotal;

  @override
  String toString() {
    return 'OrderShippingMethod(id: $id, name: $name, amount: $amount, total: $total, subtotal: $subtotal, taxTotal: $taxTotal)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderShippingMethodImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.taxTotal, taxTotal) ||
                other.taxTotal == taxTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, amount, total, subtotal, taxTotal);

  /// Create a copy of OrderShippingMethod
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderShippingMethodImplCopyWith<_$OrderShippingMethodImpl> get copyWith =>
      __$$OrderShippingMethodImplCopyWithImpl<_$OrderShippingMethodImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderShippingMethodImplToJson(
      this,
    );
  }
}

abstract class _OrderShippingMethod implements OrderShippingMethod {
  const factory _OrderShippingMethod(
          {final String id,
          final String name,
          final num amount,
          final num total,
          final num subtotal,
          @JsonKey(name: "tax_total") final num taxTotal}) =
      _$OrderShippingMethodImpl;

  factory _OrderShippingMethod.fromJson(Map<String, dynamic> json) =
      _$OrderShippingMethodImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  num get amount;
  @override
  num get total;
  @override
  num get subtotal;
  @override
  @JsonKey(name: "tax_total")
  num get taxTotal;

  /// Create a copy of OrderShippingMethod
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderShippingMethodImplCopyWith<_$OrderShippingMethodImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderSalesChannel _$OrderSalesChannelFromJson(Map<String, dynamic> json) {
  return _OrderSalesChannel.fromJson(json);
}

/// @nodoc
mixin _$OrderSalesChannel {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;

  /// Serializes this OrderSalesChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderSalesChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderSalesChannelCopyWith<OrderSalesChannel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderSalesChannelCopyWith<$Res> {
  factory $OrderSalesChannelCopyWith(
          OrderSalesChannel value, $Res Function(OrderSalesChannel) then) =
      _$OrderSalesChannelCopyWithImpl<$Res, OrderSalesChannel>;
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class _$OrderSalesChannelCopyWithImpl<$Res, $Val extends OrderSalesChannel>
    implements $OrderSalesChannelCopyWith<$Res> {
  _$OrderSalesChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderSalesChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OrderSalesChannelImplCopyWith<$Res>
    implements $OrderSalesChannelCopyWith<$Res> {
  factory _$$OrderSalesChannelImplCopyWith(_$OrderSalesChannelImpl value,
          $Res Function(_$OrderSalesChannelImpl) then) =
      __$$OrderSalesChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class __$$OrderSalesChannelImplCopyWithImpl<$Res>
    extends _$OrderSalesChannelCopyWithImpl<$Res, _$OrderSalesChannelImpl>
    implements _$$OrderSalesChannelImplCopyWith<$Res> {
  __$$OrderSalesChannelImplCopyWithImpl(_$OrderSalesChannelImpl _value,
      $Res Function(_$OrderSalesChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderSalesChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_$OrderSalesChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderSalesChannelImpl implements _OrderSalesChannel {
  const _$OrderSalesChannelImpl({this.id = "", this.name = ""});

  factory _$OrderSalesChannelImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderSalesChannelImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String name;

  @override
  String toString() {
    return 'OrderSalesChannel(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderSalesChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of OrderSalesChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderSalesChannelImplCopyWith<_$OrderSalesChannelImpl> get copyWith =>
      __$$OrderSalesChannelImplCopyWithImpl<_$OrderSalesChannelImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderSalesChannelImplToJson(
      this,
    );
  }
}

abstract class _OrderSalesChannel implements OrderSalesChannel {
  const factory _OrderSalesChannel({final String id, final String name}) =
      _$OrderSalesChannelImpl;

  factory _OrderSalesChannel.fromJson(Map<String, dynamic> json) =
      _$OrderSalesChannelImpl.fromJson;

  @override
  String get id;
  @override
  String get name;

  /// Create a copy of OrderSalesChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderSalesChannelImplCopyWith<_$OrderSalesChannelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OrderDetail _$OrderDetailFromJson(Map<String, dynamic> json) {
  return _OrderDetail.fromJson(json);
}

/// @nodoc
mixin _$OrderDetail {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "display_id", fromJson: _toInt)
  int get displayId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "payment_status")
  String get paymentStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "fulfillment_status")
  String get fulfillmentStatus => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String get currencyCode => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "canceled_at")
  String? get canceledAt => throw _privateConstructorUsedError;
  num get total => throw _privateConstructorUsedError;
  num get subtotal => throw _privateConstructorUsedError;
  @JsonKey(name: "item_subtotal")
  num get itemSubtotal => throw _privateConstructorUsedError;
  @JsonKey(name: "item_total")
  num get itemTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "shipping_total")
  num get shippingTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "tax_total")
  num get taxTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "discount_total")
  num get discountTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "paid_total")
  num get paidTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "refunded_total")
  num get refundedTotal => throw _privateConstructorUsedError;
  num get outstanding => throw _privateConstructorUsedError;
  @JsonKey(name: "original_total")
  num get originalTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "sales_channel")
  OrderSalesChannel? get salesChannel => throw _privateConstructorUsedError;
  OrderCustomer? get customer => throw _privateConstructorUsedError;
  @JsonKey(name: "shipping_address")
  OrderAddress? get shippingAddress => throw _privateConstructorUsedError;
  @JsonKey(name: "billing_address")
  OrderAddress? get billingAddress => throw _privateConstructorUsedError;
  @JsonKey(name: "shipping_methods")
  List<OrderShippingMethod> get shippingMethods =>
      throw _privateConstructorUsedError;
  List<OrderItem> get items => throw _privateConstructorUsedError;
  List<OrderPayment> get payments => throw _privateConstructorUsedError;
  List<OrderFulfillment> get fulfillments => throw _privateConstructorUsedError;

  /// Serializes this OrderDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OrderDetailCopyWith<OrderDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OrderDetailCopyWith<$Res> {
  factory $OrderDetailCopyWith(
          OrderDetail value, $Res Function(OrderDetail) then) =
      _$OrderDetailCopyWithImpl<$Res, OrderDetail>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_id", fromJson: _toInt) int displayId,
      String status,
      @JsonKey(name: "payment_status") String paymentStatus,
      @JsonKey(name: "fulfillment_status") String fulfillmentStatus,
      String? email,
      @JsonKey(name: "currency_code") String currencyCode,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "canceled_at") String? canceledAt,
      num total,
      num subtotal,
      @JsonKey(name: "item_subtotal") num itemSubtotal,
      @JsonKey(name: "item_total") num itemTotal,
      @JsonKey(name: "shipping_total") num shippingTotal,
      @JsonKey(name: "tax_total") num taxTotal,
      @JsonKey(name: "discount_total") num discountTotal,
      @JsonKey(name: "paid_total") num paidTotal,
      @JsonKey(name: "refunded_total") num refundedTotal,
      num outstanding,
      @JsonKey(name: "original_total") num originalTotal,
      @JsonKey(name: "sales_channel") OrderSalesChannel? salesChannel,
      OrderCustomer? customer,
      @JsonKey(name: "shipping_address") OrderAddress? shippingAddress,
      @JsonKey(name: "billing_address") OrderAddress? billingAddress,
      @JsonKey(name: "shipping_methods")
      List<OrderShippingMethod> shippingMethods,
      List<OrderItem> items,
      List<OrderPayment> payments,
      List<OrderFulfillment> fulfillments});

  $OrderSalesChannelCopyWith<$Res>? get salesChannel;
  $OrderCustomerCopyWith<$Res>? get customer;
  $OrderAddressCopyWith<$Res>? get shippingAddress;
  $OrderAddressCopyWith<$Res>? get billingAddress;
}

/// @nodoc
class _$OrderDetailCopyWithImpl<$Res, $Val extends OrderDetail>
    implements $OrderDetailCopyWith<$Res> {
  _$OrderDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
    Object? status = null,
    Object? paymentStatus = null,
    Object? fulfillmentStatus = null,
    Object? email = freezed,
    Object? currencyCode = null,
    Object? createdAt = null,
    Object? canceledAt = freezed,
    Object? total = null,
    Object? subtotal = null,
    Object? itemSubtotal = null,
    Object? itemTotal = null,
    Object? shippingTotal = null,
    Object? taxTotal = null,
    Object? discountTotal = null,
    Object? paidTotal = null,
    Object? refundedTotal = null,
    Object? outstanding = null,
    Object? originalTotal = null,
    Object? salesChannel = freezed,
    Object? customer = freezed,
    Object? shippingAddress = freezed,
    Object? billingAddress = freezed,
    Object? shippingMethods = null,
    Object? items = null,
    Object? payments = null,
    Object? fulfillments = null,
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
      paymentStatus: null == paymentStatus
          ? _value.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as String,
      fulfillmentStatus: null == fulfillmentStatus
          ? _value.fulfillmentStatus
          : fulfillmentStatus // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      canceledAt: freezed == canceledAt
          ? _value.canceledAt
          : canceledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as num,
      itemSubtotal: null == itemSubtotal
          ? _value.itemSubtotal
          : itemSubtotal // ignore: cast_nullable_to_non_nullable
              as num,
      itemTotal: null == itemTotal
          ? _value.itemTotal
          : itemTotal // ignore: cast_nullable_to_non_nullable
              as num,
      shippingTotal: null == shippingTotal
          ? _value.shippingTotal
          : shippingTotal // ignore: cast_nullable_to_non_nullable
              as num,
      taxTotal: null == taxTotal
          ? _value.taxTotal
          : taxTotal // ignore: cast_nullable_to_non_nullable
              as num,
      discountTotal: null == discountTotal
          ? _value.discountTotal
          : discountTotal // ignore: cast_nullable_to_non_nullable
              as num,
      paidTotal: null == paidTotal
          ? _value.paidTotal
          : paidTotal // ignore: cast_nullable_to_non_nullable
              as num,
      refundedTotal: null == refundedTotal
          ? _value.refundedTotal
          : refundedTotal // ignore: cast_nullable_to_non_nullable
              as num,
      outstanding: null == outstanding
          ? _value.outstanding
          : outstanding // ignore: cast_nullable_to_non_nullable
              as num,
      originalTotal: null == originalTotal
          ? _value.originalTotal
          : originalTotal // ignore: cast_nullable_to_non_nullable
              as num,
      salesChannel: freezed == salesChannel
          ? _value.salesChannel
          : salesChannel // ignore: cast_nullable_to_non_nullable
              as OrderSalesChannel?,
      customer: freezed == customer
          ? _value.customer
          : customer // ignore: cast_nullable_to_non_nullable
              as OrderCustomer?,
      shippingAddress: freezed == shippingAddress
          ? _value.shippingAddress
          : shippingAddress // ignore: cast_nullable_to_non_nullable
              as OrderAddress?,
      billingAddress: freezed == billingAddress
          ? _value.billingAddress
          : billingAddress // ignore: cast_nullable_to_non_nullable
              as OrderAddress?,
      shippingMethods: null == shippingMethods
          ? _value.shippingMethods
          : shippingMethods // ignore: cast_nullable_to_non_nullable
              as List<OrderShippingMethod>,
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<OrderItem>,
      payments: null == payments
          ? _value.payments
          : payments // ignore: cast_nullable_to_non_nullable
              as List<OrderPayment>,
      fulfillments: null == fulfillments
          ? _value.fulfillments
          : fulfillments // ignore: cast_nullable_to_non_nullable
              as List<OrderFulfillment>,
    ) as $Val);
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderSalesChannelCopyWith<$Res>? get salesChannel {
    if (_value.salesChannel == null) {
      return null;
    }

    return $OrderSalesChannelCopyWith<$Res>(_value.salesChannel!, (value) {
      return _then(_value.copyWith(salesChannel: value) as $Val);
    });
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderCustomerCopyWith<$Res>? get customer {
    if (_value.customer == null) {
      return null;
    }

    return $OrderCustomerCopyWith<$Res>(_value.customer!, (value) {
      return _then(_value.copyWith(customer: value) as $Val);
    });
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderAddressCopyWith<$Res>? get shippingAddress {
    if (_value.shippingAddress == null) {
      return null;
    }

    return $OrderAddressCopyWith<$Res>(_value.shippingAddress!, (value) {
      return _then(_value.copyWith(shippingAddress: value) as $Val);
    });
  }

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OrderAddressCopyWith<$Res>? get billingAddress {
    if (_value.billingAddress == null) {
      return null;
    }

    return $OrderAddressCopyWith<$Res>(_value.billingAddress!, (value) {
      return _then(_value.copyWith(billingAddress: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$OrderDetailImplCopyWith<$Res>
    implements $OrderDetailCopyWith<$Res> {
  factory _$$OrderDetailImplCopyWith(
          _$OrderDetailImpl value, $Res Function(_$OrderDetailImpl) then) =
      __$$OrderDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_id", fromJson: _toInt) int displayId,
      String status,
      @JsonKey(name: "payment_status") String paymentStatus,
      @JsonKey(name: "fulfillment_status") String fulfillmentStatus,
      String? email,
      @JsonKey(name: "currency_code") String currencyCode,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "canceled_at") String? canceledAt,
      num total,
      num subtotal,
      @JsonKey(name: "item_subtotal") num itemSubtotal,
      @JsonKey(name: "item_total") num itemTotal,
      @JsonKey(name: "shipping_total") num shippingTotal,
      @JsonKey(name: "tax_total") num taxTotal,
      @JsonKey(name: "discount_total") num discountTotal,
      @JsonKey(name: "paid_total") num paidTotal,
      @JsonKey(name: "refunded_total") num refundedTotal,
      num outstanding,
      @JsonKey(name: "original_total") num originalTotal,
      @JsonKey(name: "sales_channel") OrderSalesChannel? salesChannel,
      OrderCustomer? customer,
      @JsonKey(name: "shipping_address") OrderAddress? shippingAddress,
      @JsonKey(name: "billing_address") OrderAddress? billingAddress,
      @JsonKey(name: "shipping_methods")
      List<OrderShippingMethod> shippingMethods,
      List<OrderItem> items,
      List<OrderPayment> payments,
      List<OrderFulfillment> fulfillments});

  @override
  $OrderSalesChannelCopyWith<$Res>? get salesChannel;
  @override
  $OrderCustomerCopyWith<$Res>? get customer;
  @override
  $OrderAddressCopyWith<$Res>? get shippingAddress;
  @override
  $OrderAddressCopyWith<$Res>? get billingAddress;
}

/// @nodoc
class __$$OrderDetailImplCopyWithImpl<$Res>
    extends _$OrderDetailCopyWithImpl<$Res, _$OrderDetailImpl>
    implements _$$OrderDetailImplCopyWith<$Res> {
  __$$OrderDetailImplCopyWithImpl(
      _$OrderDetailImpl _value, $Res Function(_$OrderDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
    Object? status = null,
    Object? paymentStatus = null,
    Object? fulfillmentStatus = null,
    Object? email = freezed,
    Object? currencyCode = null,
    Object? createdAt = null,
    Object? canceledAt = freezed,
    Object? total = null,
    Object? subtotal = null,
    Object? itemSubtotal = null,
    Object? itemTotal = null,
    Object? shippingTotal = null,
    Object? taxTotal = null,
    Object? discountTotal = null,
    Object? paidTotal = null,
    Object? refundedTotal = null,
    Object? outstanding = null,
    Object? originalTotal = null,
    Object? salesChannel = freezed,
    Object? customer = freezed,
    Object? shippingAddress = freezed,
    Object? billingAddress = freezed,
    Object? shippingMethods = null,
    Object? items = null,
    Object? payments = null,
    Object? fulfillments = null,
  }) {
    return _then(_$OrderDetailImpl(
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
      paymentStatus: null == paymentStatus
          ? _value.paymentStatus
          : paymentStatus // ignore: cast_nullable_to_non_nullable
              as String,
      fulfillmentStatus: null == fulfillmentStatus
          ? _value.fulfillmentStatus
          : fulfillmentStatus // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      canceledAt: freezed == canceledAt
          ? _value.canceledAt
          : canceledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as num,
      itemSubtotal: null == itemSubtotal
          ? _value.itemSubtotal
          : itemSubtotal // ignore: cast_nullable_to_non_nullable
              as num,
      itemTotal: null == itemTotal
          ? _value.itemTotal
          : itemTotal // ignore: cast_nullable_to_non_nullable
              as num,
      shippingTotal: null == shippingTotal
          ? _value.shippingTotal
          : shippingTotal // ignore: cast_nullable_to_non_nullable
              as num,
      taxTotal: null == taxTotal
          ? _value.taxTotal
          : taxTotal // ignore: cast_nullable_to_non_nullable
              as num,
      discountTotal: null == discountTotal
          ? _value.discountTotal
          : discountTotal // ignore: cast_nullable_to_non_nullable
              as num,
      paidTotal: null == paidTotal
          ? _value.paidTotal
          : paidTotal // ignore: cast_nullable_to_non_nullable
              as num,
      refundedTotal: null == refundedTotal
          ? _value.refundedTotal
          : refundedTotal // ignore: cast_nullable_to_non_nullable
              as num,
      outstanding: null == outstanding
          ? _value.outstanding
          : outstanding // ignore: cast_nullable_to_non_nullable
              as num,
      originalTotal: null == originalTotal
          ? _value.originalTotal
          : originalTotal // ignore: cast_nullable_to_non_nullable
              as num,
      salesChannel: freezed == salesChannel
          ? _value.salesChannel
          : salesChannel // ignore: cast_nullable_to_non_nullable
              as OrderSalesChannel?,
      customer: freezed == customer
          ? _value.customer
          : customer // ignore: cast_nullable_to_non_nullable
              as OrderCustomer?,
      shippingAddress: freezed == shippingAddress
          ? _value.shippingAddress
          : shippingAddress // ignore: cast_nullable_to_non_nullable
              as OrderAddress?,
      billingAddress: freezed == billingAddress
          ? _value.billingAddress
          : billingAddress // ignore: cast_nullable_to_non_nullable
              as OrderAddress?,
      shippingMethods: null == shippingMethods
          ? _value._shippingMethods
          : shippingMethods // ignore: cast_nullable_to_non_nullable
              as List<OrderShippingMethod>,
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<OrderItem>,
      payments: null == payments
          ? _value._payments
          : payments // ignore: cast_nullable_to_non_nullable
              as List<OrderPayment>,
      fulfillments: null == fulfillments
          ? _value._fulfillments
          : fulfillments // ignore: cast_nullable_to_non_nullable
              as List<OrderFulfillment>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OrderDetailImpl implements _OrderDetail {
  const _$OrderDetailImpl(
      {this.id = "",
      @JsonKey(name: "display_id", fromJson: _toInt) this.displayId = 0,
      this.status = "",
      @JsonKey(name: "payment_status") this.paymentStatus = "",
      @JsonKey(name: "fulfillment_status") this.fulfillmentStatus = "",
      this.email,
      @JsonKey(name: "currency_code") this.currencyCode = "usd",
      @JsonKey(name: "created_at") this.createdAt = "",
      @JsonKey(name: "canceled_at") this.canceledAt,
      this.total = 0,
      this.subtotal = 0,
      @JsonKey(name: "item_subtotal") this.itemSubtotal = 0,
      @JsonKey(name: "item_total") this.itemTotal = 0,
      @JsonKey(name: "shipping_total") this.shippingTotal = 0,
      @JsonKey(name: "tax_total") this.taxTotal = 0,
      @JsonKey(name: "discount_total") this.discountTotal = 0,
      @JsonKey(name: "paid_total") this.paidTotal = 0,
      @JsonKey(name: "refunded_total") this.refundedTotal = 0,
      this.outstanding = 0,
      @JsonKey(name: "original_total") this.originalTotal = 0,
      @JsonKey(name: "sales_channel") this.salesChannel,
      this.customer,
      @JsonKey(name: "shipping_address") this.shippingAddress,
      @JsonKey(name: "billing_address") this.billingAddress,
      @JsonKey(name: "shipping_methods")
      final List<OrderShippingMethod> shippingMethods =
          const <OrderShippingMethod>[],
      final List<OrderItem> items = const <OrderItem>[],
      final List<OrderPayment> payments = const <OrderPayment>[],
      final List<OrderFulfillment> fulfillments = const <OrderFulfillment>[]})
      : _shippingMethods = shippingMethods,
        _items = items,
        _payments = payments,
        _fulfillments = fulfillments;

  factory _$OrderDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$OrderDetailImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "display_id", fromJson: _toInt)
  final int displayId;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "payment_status")
  final String paymentStatus;
  @override
  @JsonKey(name: "fulfillment_status")
  final String fulfillmentStatus;
  @override
  final String? email;
  @override
  @JsonKey(name: "currency_code")
  final String currencyCode;
  @override
  @JsonKey(name: "created_at")
  final String createdAt;
  @override
  @JsonKey(name: "canceled_at")
  final String? canceledAt;
  @override
  @JsonKey()
  final num total;
  @override
  @JsonKey()
  final num subtotal;
  @override
  @JsonKey(name: "item_subtotal")
  final num itemSubtotal;
  @override
  @JsonKey(name: "item_total")
  final num itemTotal;
  @override
  @JsonKey(name: "shipping_total")
  final num shippingTotal;
  @override
  @JsonKey(name: "tax_total")
  final num taxTotal;
  @override
  @JsonKey(name: "discount_total")
  final num discountTotal;
  @override
  @JsonKey(name: "paid_total")
  final num paidTotal;
  @override
  @JsonKey(name: "refunded_total")
  final num refundedTotal;
  @override
  @JsonKey()
  final num outstanding;
  @override
  @JsonKey(name: "original_total")
  final num originalTotal;
  @override
  @JsonKey(name: "sales_channel")
  final OrderSalesChannel? salesChannel;
  @override
  final OrderCustomer? customer;
  @override
  @JsonKey(name: "shipping_address")
  final OrderAddress? shippingAddress;
  @override
  @JsonKey(name: "billing_address")
  final OrderAddress? billingAddress;
  final List<OrderShippingMethod> _shippingMethods;
  @override
  @JsonKey(name: "shipping_methods")
  List<OrderShippingMethod> get shippingMethods {
    if (_shippingMethods is EqualUnmodifiableListView) return _shippingMethods;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_shippingMethods);
  }

  final List<OrderItem> _items;
  @override
  @JsonKey()
  List<OrderItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  final List<OrderPayment> _payments;
  @override
  @JsonKey()
  List<OrderPayment> get payments {
    if (_payments is EqualUnmodifiableListView) return _payments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_payments);
  }

  final List<OrderFulfillment> _fulfillments;
  @override
  @JsonKey()
  List<OrderFulfillment> get fulfillments {
    if (_fulfillments is EqualUnmodifiableListView) return _fulfillments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_fulfillments);
  }

  @override
  String toString() {
    return 'OrderDetail(id: $id, displayId: $displayId, status: $status, paymentStatus: $paymentStatus, fulfillmentStatus: $fulfillmentStatus, email: $email, currencyCode: $currencyCode, createdAt: $createdAt, canceledAt: $canceledAt, total: $total, subtotal: $subtotal, itemSubtotal: $itemSubtotal, itemTotal: $itemTotal, shippingTotal: $shippingTotal, taxTotal: $taxTotal, discountTotal: $discountTotal, paidTotal: $paidTotal, refundedTotal: $refundedTotal, outstanding: $outstanding, originalTotal: $originalTotal, salesChannel: $salesChannel, customer: $customer, shippingAddress: $shippingAddress, billingAddress: $billingAddress, shippingMethods: $shippingMethods, items: $items, payments: $payments, fulfillments: $fulfillments)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OrderDetailImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.displayId, displayId) ||
                other.displayId == displayId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.paymentStatus, paymentStatus) ||
                other.paymentStatus == paymentStatus) &&
            (identical(other.fulfillmentStatus, fulfillmentStatus) ||
                other.fulfillmentStatus == fulfillmentStatus) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.canceledAt, canceledAt) ||
                other.canceledAt == canceledAt) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.itemSubtotal, itemSubtotal) ||
                other.itemSubtotal == itemSubtotal) &&
            (identical(other.itemTotal, itemTotal) ||
                other.itemTotal == itemTotal) &&
            (identical(other.shippingTotal, shippingTotal) ||
                other.shippingTotal == shippingTotal) &&
            (identical(other.taxTotal, taxTotal) ||
                other.taxTotal == taxTotal) &&
            (identical(other.discountTotal, discountTotal) ||
                other.discountTotal == discountTotal) &&
            (identical(other.paidTotal, paidTotal) ||
                other.paidTotal == paidTotal) &&
            (identical(other.refundedTotal, refundedTotal) ||
                other.refundedTotal == refundedTotal) &&
            (identical(other.outstanding, outstanding) ||
                other.outstanding == outstanding) &&
            (identical(other.originalTotal, originalTotal) ||
                other.originalTotal == originalTotal) &&
            (identical(other.salesChannel, salesChannel) ||
                other.salesChannel == salesChannel) &&
            (identical(other.customer, customer) ||
                other.customer == customer) &&
            (identical(other.shippingAddress, shippingAddress) ||
                other.shippingAddress == shippingAddress) &&
            (identical(other.billingAddress, billingAddress) ||
                other.billingAddress == billingAddress) &&
            const DeepCollectionEquality()
                .equals(other._shippingMethods, _shippingMethods) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            const DeepCollectionEquality().equals(other._payments, _payments) &&
            const DeepCollectionEquality()
                .equals(other._fulfillments, _fulfillments));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        displayId,
        status,
        paymentStatus,
        fulfillmentStatus,
        email,
        currencyCode,
        createdAt,
        canceledAt,
        total,
        subtotal,
        itemSubtotal,
        itemTotal,
        shippingTotal,
        taxTotal,
        discountTotal,
        paidTotal,
        refundedTotal,
        outstanding,
        originalTotal,
        salesChannel,
        customer,
        shippingAddress,
        billingAddress,
        const DeepCollectionEquality().hash(_shippingMethods),
        const DeepCollectionEquality().hash(_items),
        const DeepCollectionEquality().hash(_payments),
        const DeepCollectionEquality().hash(_fulfillments)
      ]);

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OrderDetailImplCopyWith<_$OrderDetailImpl> get copyWith =>
      __$$OrderDetailImplCopyWithImpl<_$OrderDetailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OrderDetailImplToJson(
      this,
    );
  }
}

abstract class _OrderDetail implements OrderDetail {
  const factory _OrderDetail(
      {final String id,
      @JsonKey(name: "display_id", fromJson: _toInt) final int displayId,
      final String status,
      @JsonKey(name: "payment_status") final String paymentStatus,
      @JsonKey(name: "fulfillment_status") final String fulfillmentStatus,
      final String? email,
      @JsonKey(name: "currency_code") final String currencyCode,
      @JsonKey(name: "created_at") final String createdAt,
      @JsonKey(name: "canceled_at") final String? canceledAt,
      final num total,
      final num subtotal,
      @JsonKey(name: "item_subtotal") final num itemSubtotal,
      @JsonKey(name: "item_total") final num itemTotal,
      @JsonKey(name: "shipping_total") final num shippingTotal,
      @JsonKey(name: "tax_total") final num taxTotal,
      @JsonKey(name: "discount_total") final num discountTotal,
      @JsonKey(name: "paid_total") final num paidTotal,
      @JsonKey(name: "refunded_total") final num refundedTotal,
      final num outstanding,
      @JsonKey(name: "original_total") final num originalTotal,
      @JsonKey(name: "sales_channel") final OrderSalesChannel? salesChannel,
      final OrderCustomer? customer,
      @JsonKey(name: "shipping_address") final OrderAddress? shippingAddress,
      @JsonKey(name: "billing_address") final OrderAddress? billingAddress,
      @JsonKey(name: "shipping_methods")
      final List<OrderShippingMethod> shippingMethods,
      final List<OrderItem> items,
      final List<OrderPayment> payments,
      final List<OrderFulfillment> fulfillments}) = _$OrderDetailImpl;

  factory _OrderDetail.fromJson(Map<String, dynamic> json) =
      _$OrderDetailImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "display_id", fromJson: _toInt)
  int get displayId;
  @override
  String get status;
  @override
  @JsonKey(name: "payment_status")
  String get paymentStatus;
  @override
  @JsonKey(name: "fulfillment_status")
  String get fulfillmentStatus;
  @override
  String? get email;
  @override
  @JsonKey(name: "currency_code")
  String get currencyCode;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;
  @override
  @JsonKey(name: "canceled_at")
  String? get canceledAt;
  @override
  num get total;
  @override
  num get subtotal;
  @override
  @JsonKey(name: "item_subtotal")
  num get itemSubtotal;
  @override
  @JsonKey(name: "item_total")
  num get itemTotal;
  @override
  @JsonKey(name: "shipping_total")
  num get shippingTotal;
  @override
  @JsonKey(name: "tax_total")
  num get taxTotal;
  @override
  @JsonKey(name: "discount_total")
  num get discountTotal;
  @override
  @JsonKey(name: "paid_total")
  num get paidTotal;
  @override
  @JsonKey(name: "refunded_total")
  num get refundedTotal;
  @override
  num get outstanding;
  @override
  @JsonKey(name: "original_total")
  num get originalTotal;
  @override
  @JsonKey(name: "sales_channel")
  OrderSalesChannel? get salesChannel;
  @override
  OrderCustomer? get customer;
  @override
  @JsonKey(name: "shipping_address")
  OrderAddress? get shippingAddress;
  @override
  @JsonKey(name: "billing_address")
  OrderAddress? get billingAddress;
  @override
  @JsonKey(name: "shipping_methods")
  List<OrderShippingMethod> get shippingMethods;
  @override
  List<OrderItem> get items;
  @override
  List<OrderPayment> get payments;
  @override
  List<OrderFulfillment> get fulfillments;

  /// Create a copy of OrderDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OrderDetailImplCopyWith<_$OrderDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
