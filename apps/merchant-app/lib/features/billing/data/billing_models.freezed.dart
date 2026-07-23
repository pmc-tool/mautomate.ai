// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'billing_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

BillingPlan _$BillingPlanFromJson(Map<String, dynamic> json) {
  return _BillingPlan.fromJson(json);
}

/// @nodoc
mixin _$BillingPlan {
  String get key => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  @JsonKey(name: "price_usd")
  num get priceUsd => throw _privateConstructorUsedError;
  @JsonKey(name: "included_credits")
  num get includedCredits => throw _privateConstructorUsedError;
  @JsonKey(name: "products_limit")
  num? get productsLimit => throw _privateConstructorUsedError;
  @JsonKey(name: "seats_limit")
  num? get seatsLimit => throw _privateConstructorUsedError;
  @JsonKey(name: "domains_limit")
  num? get domainsLimit => throw _privateConstructorUsedError;

  /// Serializes this BillingPlan to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BillingPlan
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BillingPlanCopyWith<BillingPlan> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BillingPlanCopyWith<$Res> {
  factory $BillingPlanCopyWith(
          BillingPlan value, $Res Function(BillingPlan) then) =
      _$BillingPlanCopyWithImpl<$Res, BillingPlan>;
  @useResult
  $Res call(
      {String key,
      String name,
      @JsonKey(name: "price_usd") num priceUsd,
      @JsonKey(name: "included_credits") num includedCredits,
      @JsonKey(name: "products_limit") num? productsLimit,
      @JsonKey(name: "seats_limit") num? seatsLimit,
      @JsonKey(name: "domains_limit") num? domainsLimit});
}

/// @nodoc
class _$BillingPlanCopyWithImpl<$Res, $Val extends BillingPlan>
    implements $BillingPlanCopyWith<$Res> {
  _$BillingPlanCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BillingPlan
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? name = null,
    Object? priceUsd = null,
    Object? includedCredits = null,
    Object? productsLimit = freezed,
    Object? seatsLimit = freezed,
    Object? domainsLimit = freezed,
  }) {
    return _then(_value.copyWith(
      key: null == key
          ? _value.key
          : key // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      priceUsd: null == priceUsd
          ? _value.priceUsd
          : priceUsd // ignore: cast_nullable_to_non_nullable
              as num,
      includedCredits: null == includedCredits
          ? _value.includedCredits
          : includedCredits // ignore: cast_nullable_to_non_nullable
              as num,
      productsLimit: freezed == productsLimit
          ? _value.productsLimit
          : productsLimit // ignore: cast_nullable_to_non_nullable
              as num?,
      seatsLimit: freezed == seatsLimit
          ? _value.seatsLimit
          : seatsLimit // ignore: cast_nullable_to_non_nullable
              as num?,
      domainsLimit: freezed == domainsLimit
          ? _value.domainsLimit
          : domainsLimit // ignore: cast_nullable_to_non_nullable
              as num?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BillingPlanImplCopyWith<$Res>
    implements $BillingPlanCopyWith<$Res> {
  factory _$$BillingPlanImplCopyWith(
          _$BillingPlanImpl value, $Res Function(_$BillingPlanImpl) then) =
      __$$BillingPlanImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String key,
      String name,
      @JsonKey(name: "price_usd") num priceUsd,
      @JsonKey(name: "included_credits") num includedCredits,
      @JsonKey(name: "products_limit") num? productsLimit,
      @JsonKey(name: "seats_limit") num? seatsLimit,
      @JsonKey(name: "domains_limit") num? domainsLimit});
}

/// @nodoc
class __$$BillingPlanImplCopyWithImpl<$Res>
    extends _$BillingPlanCopyWithImpl<$Res, _$BillingPlanImpl>
    implements _$$BillingPlanImplCopyWith<$Res> {
  __$$BillingPlanImplCopyWithImpl(
      _$BillingPlanImpl _value, $Res Function(_$BillingPlanImpl) _then)
      : super(_value, _then);

  /// Create a copy of BillingPlan
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? name = null,
    Object? priceUsd = null,
    Object? includedCredits = null,
    Object? productsLimit = freezed,
    Object? seatsLimit = freezed,
    Object? domainsLimit = freezed,
  }) {
    return _then(_$BillingPlanImpl(
      key: null == key
          ? _value.key
          : key // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      priceUsd: null == priceUsd
          ? _value.priceUsd
          : priceUsd // ignore: cast_nullable_to_non_nullable
              as num,
      includedCredits: null == includedCredits
          ? _value.includedCredits
          : includedCredits // ignore: cast_nullable_to_non_nullable
              as num,
      productsLimit: freezed == productsLimit
          ? _value.productsLimit
          : productsLimit // ignore: cast_nullable_to_non_nullable
              as num?,
      seatsLimit: freezed == seatsLimit
          ? _value.seatsLimit
          : seatsLimit // ignore: cast_nullable_to_non_nullable
              as num?,
      domainsLimit: freezed == domainsLimit
          ? _value.domainsLimit
          : domainsLimit // ignore: cast_nullable_to_non_nullable
              as num?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$BillingPlanImpl implements _BillingPlan {
  const _$BillingPlanImpl(
      {this.key = "",
      this.name = "",
      @JsonKey(name: "price_usd") this.priceUsd = 0,
      @JsonKey(name: "included_credits") this.includedCredits = 0,
      @JsonKey(name: "products_limit") this.productsLimit,
      @JsonKey(name: "seats_limit") this.seatsLimit,
      @JsonKey(name: "domains_limit") this.domainsLimit});

  factory _$BillingPlanImpl.fromJson(Map<String, dynamic> json) =>
      _$$BillingPlanImplFromJson(json);

  @override
  @JsonKey()
  final String key;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey(name: "price_usd")
  final num priceUsd;
  @override
  @JsonKey(name: "included_credits")
  final num includedCredits;
  @override
  @JsonKey(name: "products_limit")
  final num? productsLimit;
  @override
  @JsonKey(name: "seats_limit")
  final num? seatsLimit;
  @override
  @JsonKey(name: "domains_limit")
  final num? domainsLimit;

  @override
  String toString() {
    return 'BillingPlan(key: $key, name: $name, priceUsd: $priceUsd, includedCredits: $includedCredits, productsLimit: $productsLimit, seatsLimit: $seatsLimit, domainsLimit: $domainsLimit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BillingPlanImpl &&
            (identical(other.key, key) || other.key == key) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.priceUsd, priceUsd) ||
                other.priceUsd == priceUsd) &&
            (identical(other.includedCredits, includedCredits) ||
                other.includedCredits == includedCredits) &&
            (identical(other.productsLimit, productsLimit) ||
                other.productsLimit == productsLimit) &&
            (identical(other.seatsLimit, seatsLimit) ||
                other.seatsLimit == seatsLimit) &&
            (identical(other.domainsLimit, domainsLimit) ||
                other.domainsLimit == domainsLimit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, key, name, priceUsd,
      includedCredits, productsLimit, seatsLimit, domainsLimit);

  /// Create a copy of BillingPlan
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BillingPlanImplCopyWith<_$BillingPlanImpl> get copyWith =>
      __$$BillingPlanImplCopyWithImpl<_$BillingPlanImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BillingPlanImplToJson(
      this,
    );
  }
}

abstract class _BillingPlan implements BillingPlan {
  const factory _BillingPlan(
          {final String key,
          final String name,
          @JsonKey(name: "price_usd") final num priceUsd,
          @JsonKey(name: "included_credits") final num includedCredits,
          @JsonKey(name: "products_limit") final num? productsLimit,
          @JsonKey(name: "seats_limit") final num? seatsLimit,
          @JsonKey(name: "domains_limit") final num? domainsLimit}) =
      _$BillingPlanImpl;

  factory _BillingPlan.fromJson(Map<String, dynamic> json) =
      _$BillingPlanImpl.fromJson;

  @override
  String get key;
  @override
  String get name;
  @override
  @JsonKey(name: "price_usd")
  num get priceUsd;
  @override
  @JsonKey(name: "included_credits")
  num get includedCredits;
  @override
  @JsonKey(name: "products_limit")
  num? get productsLimit;
  @override
  @JsonKey(name: "seats_limit")
  num? get seatsLimit;
  @override
  @JsonKey(name: "domains_limit")
  num? get domainsLimit;

  /// Create a copy of BillingPlan
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BillingPlanImplCopyWith<_$BillingPlanImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BillingUsageRow _$BillingUsageRowFromJson(Map<String, dynamic> json) {
  return _BillingUsageRow.fromJson(json);
}

/// @nodoc
mixin _$BillingUsageRow {
  String get action => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  num get units => throw _privateConstructorUsedError;
  num get credits => throw _privateConstructorUsedError;

  /// Serializes this BillingUsageRow to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BillingUsageRow
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BillingUsageRowCopyWith<BillingUsageRow> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BillingUsageRowCopyWith<$Res> {
  factory $BillingUsageRowCopyWith(
          BillingUsageRow value, $Res Function(BillingUsageRow) then) =
      _$BillingUsageRowCopyWithImpl<$Res, BillingUsageRow>;
  @useResult
  $Res call({String action, String label, num units, num credits});
}

/// @nodoc
class _$BillingUsageRowCopyWithImpl<$Res, $Val extends BillingUsageRow>
    implements $BillingUsageRowCopyWith<$Res> {
  _$BillingUsageRowCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BillingUsageRow
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? action = null,
    Object? label = null,
    Object? units = null,
    Object? credits = null,
  }) {
    return _then(_value.copyWith(
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      units: null == units
          ? _value.units
          : units // ignore: cast_nullable_to_non_nullable
              as num,
      credits: null == credits
          ? _value.credits
          : credits // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BillingUsageRowImplCopyWith<$Res>
    implements $BillingUsageRowCopyWith<$Res> {
  factory _$$BillingUsageRowImplCopyWith(_$BillingUsageRowImpl value,
          $Res Function(_$BillingUsageRowImpl) then) =
      __$$BillingUsageRowImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String action, String label, num units, num credits});
}

/// @nodoc
class __$$BillingUsageRowImplCopyWithImpl<$Res>
    extends _$BillingUsageRowCopyWithImpl<$Res, _$BillingUsageRowImpl>
    implements _$$BillingUsageRowImplCopyWith<$Res> {
  __$$BillingUsageRowImplCopyWithImpl(
      _$BillingUsageRowImpl _value, $Res Function(_$BillingUsageRowImpl) _then)
      : super(_value, _then);

  /// Create a copy of BillingUsageRow
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? action = null,
    Object? label = null,
    Object? units = null,
    Object? credits = null,
  }) {
    return _then(_$BillingUsageRowImpl(
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      units: null == units
          ? _value.units
          : units // ignore: cast_nullable_to_non_nullable
              as num,
      credits: null == credits
          ? _value.credits
          : credits // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$BillingUsageRowImpl implements _BillingUsageRow {
  const _$BillingUsageRowImpl(
      {this.action = "", this.label = "", this.units = 0, this.credits = 0});

  factory _$BillingUsageRowImpl.fromJson(Map<String, dynamic> json) =>
      _$$BillingUsageRowImplFromJson(json);

  @override
  @JsonKey()
  final String action;
  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final num units;
  @override
  @JsonKey()
  final num credits;

  @override
  String toString() {
    return 'BillingUsageRow(action: $action, label: $label, units: $units, credits: $credits)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BillingUsageRowImpl &&
            (identical(other.action, action) || other.action == action) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.units, units) || other.units == units) &&
            (identical(other.credits, credits) || other.credits == credits));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, action, label, units, credits);

  /// Create a copy of BillingUsageRow
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BillingUsageRowImplCopyWith<_$BillingUsageRowImpl> get copyWith =>
      __$$BillingUsageRowImplCopyWithImpl<_$BillingUsageRowImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BillingUsageRowImplToJson(
      this,
    );
  }
}

abstract class _BillingUsageRow implements BillingUsageRow {
  const factory _BillingUsageRow(
      {final String action,
      final String label,
      final num units,
      final num credits}) = _$BillingUsageRowImpl;

  factory _BillingUsageRow.fromJson(Map<String, dynamic> json) =
      _$BillingUsageRowImpl.fromJson;

  @override
  String get action;
  @override
  String get label;
  @override
  num get units;
  @override
  num get credits;

  /// Create a copy of BillingUsageRow
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BillingUsageRowImplCopyWith<_$BillingUsageRowImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BillingPack _$BillingPackFromJson(Map<String, dynamic> json) {
  return _BillingPack.fromJson(json);
}

/// @nodoc
mixin _$BillingPack {
  int get credits => throw _privateConstructorUsedError;
  @JsonKey(name: "amount_usd")
  num get amountUsd => throw _privateConstructorUsedError;
  @JsonKey(name: "bonus_pct")
  num get bonusPct => throw _privateConstructorUsedError;

  /// Serializes this BillingPack to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BillingPack
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BillingPackCopyWith<BillingPack> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BillingPackCopyWith<$Res> {
  factory $BillingPackCopyWith(
          BillingPack value, $Res Function(BillingPack) then) =
      _$BillingPackCopyWithImpl<$Res, BillingPack>;
  @useResult
  $Res call(
      {int credits,
      @JsonKey(name: "amount_usd") num amountUsd,
      @JsonKey(name: "bonus_pct") num bonusPct});
}

/// @nodoc
class _$BillingPackCopyWithImpl<$Res, $Val extends BillingPack>
    implements $BillingPackCopyWith<$Res> {
  _$BillingPackCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BillingPack
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? credits = null,
    Object? amountUsd = null,
    Object? bonusPct = null,
  }) {
    return _then(_value.copyWith(
      credits: null == credits
          ? _value.credits
          : credits // ignore: cast_nullable_to_non_nullable
              as int,
      amountUsd: null == amountUsd
          ? _value.amountUsd
          : amountUsd // ignore: cast_nullable_to_non_nullable
              as num,
      bonusPct: null == bonusPct
          ? _value.bonusPct
          : bonusPct // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BillingPackImplCopyWith<$Res>
    implements $BillingPackCopyWith<$Res> {
  factory _$$BillingPackImplCopyWith(
          _$BillingPackImpl value, $Res Function(_$BillingPackImpl) then) =
      __$$BillingPackImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int credits,
      @JsonKey(name: "amount_usd") num amountUsd,
      @JsonKey(name: "bonus_pct") num bonusPct});
}

/// @nodoc
class __$$BillingPackImplCopyWithImpl<$Res>
    extends _$BillingPackCopyWithImpl<$Res, _$BillingPackImpl>
    implements _$$BillingPackImplCopyWith<$Res> {
  __$$BillingPackImplCopyWithImpl(
      _$BillingPackImpl _value, $Res Function(_$BillingPackImpl) _then)
      : super(_value, _then);

  /// Create a copy of BillingPack
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? credits = null,
    Object? amountUsd = null,
    Object? bonusPct = null,
  }) {
    return _then(_$BillingPackImpl(
      credits: null == credits
          ? _value.credits
          : credits // ignore: cast_nullable_to_non_nullable
              as int,
      amountUsd: null == amountUsd
          ? _value.amountUsd
          : amountUsd // ignore: cast_nullable_to_non_nullable
              as num,
      bonusPct: null == bonusPct
          ? _value.bonusPct
          : bonusPct // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$BillingPackImpl implements _BillingPack {
  const _$BillingPackImpl(
      {this.credits = 0,
      @JsonKey(name: "amount_usd") this.amountUsd = 0,
      @JsonKey(name: "bonus_pct") this.bonusPct = 0});

  factory _$BillingPackImpl.fromJson(Map<String, dynamic> json) =>
      _$$BillingPackImplFromJson(json);

  @override
  @JsonKey()
  final int credits;
  @override
  @JsonKey(name: "amount_usd")
  final num amountUsd;
  @override
  @JsonKey(name: "bonus_pct")
  final num bonusPct;

  @override
  String toString() {
    return 'BillingPack(credits: $credits, amountUsd: $amountUsd, bonusPct: $bonusPct)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BillingPackImpl &&
            (identical(other.credits, credits) || other.credits == credits) &&
            (identical(other.amountUsd, amountUsd) ||
                other.amountUsd == amountUsd) &&
            (identical(other.bonusPct, bonusPct) ||
                other.bonusPct == bonusPct));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, credits, amountUsd, bonusPct);

  /// Create a copy of BillingPack
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BillingPackImplCopyWith<_$BillingPackImpl> get copyWith =>
      __$$BillingPackImplCopyWithImpl<_$BillingPackImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BillingPackImplToJson(
      this,
    );
  }
}

abstract class _BillingPack implements BillingPack {
  const factory _BillingPack(
      {final int credits,
      @JsonKey(name: "amount_usd") final num amountUsd,
      @JsonKey(name: "bonus_pct") final num bonusPct}) = _$BillingPackImpl;

  factory _BillingPack.fromJson(Map<String, dynamic> json) =
      _$BillingPackImpl.fromJson;

  @override
  int get credits;
  @override
  @JsonKey(name: "amount_usd")
  num get amountUsd;
  @override
  @JsonKey(name: "bonus_pct")
  num get bonusPct;

  /// Create a copy of BillingPack
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BillingPackImplCopyWith<_$BillingPackImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreditBuckets _$CreditBucketsFromJson(Map<String, dynamic> json) {
  return _CreditBuckets.fromJson(json);
}

/// @nodoc
mixin _$CreditBuckets {
  num get total => throw _privateConstructorUsedError;
  num get expiring => throw _privateConstructorUsedError;
  num get purchased => throw _privateConstructorUsedError;
  @JsonKey(name: "next_expiry")
  String? get nextExpiry => throw _privateConstructorUsedError;

  /// Serializes this CreditBuckets to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreditBuckets
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreditBucketsCopyWith<CreditBuckets> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreditBucketsCopyWith<$Res> {
  factory $CreditBucketsCopyWith(
          CreditBuckets value, $Res Function(CreditBuckets) then) =
      _$CreditBucketsCopyWithImpl<$Res, CreditBuckets>;
  @useResult
  $Res call(
      {num total,
      num expiring,
      num purchased,
      @JsonKey(name: "next_expiry") String? nextExpiry});
}

/// @nodoc
class _$CreditBucketsCopyWithImpl<$Res, $Val extends CreditBuckets>
    implements $CreditBucketsCopyWith<$Res> {
  _$CreditBucketsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreditBuckets
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? expiring = null,
    Object? purchased = null,
    Object? nextExpiry = freezed,
  }) {
    return _then(_value.copyWith(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      expiring: null == expiring
          ? _value.expiring
          : expiring // ignore: cast_nullable_to_non_nullable
              as num,
      purchased: null == purchased
          ? _value.purchased
          : purchased // ignore: cast_nullable_to_non_nullable
              as num,
      nextExpiry: freezed == nextExpiry
          ? _value.nextExpiry
          : nextExpiry // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreditBucketsImplCopyWith<$Res>
    implements $CreditBucketsCopyWith<$Res> {
  factory _$$CreditBucketsImplCopyWith(
          _$CreditBucketsImpl value, $Res Function(_$CreditBucketsImpl) then) =
      __$$CreditBucketsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num total,
      num expiring,
      num purchased,
      @JsonKey(name: "next_expiry") String? nextExpiry});
}

/// @nodoc
class __$$CreditBucketsImplCopyWithImpl<$Res>
    extends _$CreditBucketsCopyWithImpl<$Res, _$CreditBucketsImpl>
    implements _$$CreditBucketsImplCopyWith<$Res> {
  __$$CreditBucketsImplCopyWithImpl(
      _$CreditBucketsImpl _value, $Res Function(_$CreditBucketsImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreditBuckets
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? expiring = null,
    Object? purchased = null,
    Object? nextExpiry = freezed,
  }) {
    return _then(_$CreditBucketsImpl(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      expiring: null == expiring
          ? _value.expiring
          : expiring // ignore: cast_nullable_to_non_nullable
              as num,
      purchased: null == purchased
          ? _value.purchased
          : purchased // ignore: cast_nullable_to_non_nullable
              as num,
      nextExpiry: freezed == nextExpiry
          ? _value.nextExpiry
          : nextExpiry // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreditBucketsImpl implements _CreditBuckets {
  const _$CreditBucketsImpl(
      {this.total = 0,
      this.expiring = 0,
      this.purchased = 0,
      @JsonKey(name: "next_expiry") this.nextExpiry});

  factory _$CreditBucketsImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreditBucketsImplFromJson(json);

  @override
  @JsonKey()
  final num total;
  @override
  @JsonKey()
  final num expiring;
  @override
  @JsonKey()
  final num purchased;
  @override
  @JsonKey(name: "next_expiry")
  final String? nextExpiry;

  @override
  String toString() {
    return 'CreditBuckets(total: $total, expiring: $expiring, purchased: $purchased, nextExpiry: $nextExpiry)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreditBucketsImpl &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.expiring, expiring) ||
                other.expiring == expiring) &&
            (identical(other.purchased, purchased) ||
                other.purchased == purchased) &&
            (identical(other.nextExpiry, nextExpiry) ||
                other.nextExpiry == nextExpiry));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, total, expiring, purchased, nextExpiry);

  /// Create a copy of CreditBuckets
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreditBucketsImplCopyWith<_$CreditBucketsImpl> get copyWith =>
      __$$CreditBucketsImplCopyWithImpl<_$CreditBucketsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreditBucketsImplToJson(
      this,
    );
  }
}

abstract class _CreditBuckets implements CreditBuckets {
  const factory _CreditBuckets(
          {final num total,
          final num expiring,
          final num purchased,
          @JsonKey(name: "next_expiry") final String? nextExpiry}) =
      _$CreditBucketsImpl;

  factory _CreditBuckets.fromJson(Map<String, dynamic> json) =
      _$CreditBucketsImpl.fromJson;

  @override
  num get total;
  @override
  num get expiring;
  @override
  num get purchased;
  @override
  @JsonKey(name: "next_expiry")
  String? get nextExpiry;

  /// Create a copy of CreditBuckets
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreditBucketsImplCopyWith<_$CreditBucketsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Wallet _$WalletFromJson(Map<String, dynamic> json) {
  return _Wallet.fromJson(json);
}

/// @nodoc
mixin _$Wallet {
  num get balance => throw _privateConstructorUsedError;
  num get reserved => throw _privateConstructorUsedError;

  /// Serializes this Wallet to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Wallet
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WalletCopyWith<Wallet> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WalletCopyWith<$Res> {
  factory $WalletCopyWith(Wallet value, $Res Function(Wallet) then) =
      _$WalletCopyWithImpl<$Res, Wallet>;
  @useResult
  $Res call({num balance, num reserved});
}

/// @nodoc
class _$WalletCopyWithImpl<$Res, $Val extends Wallet>
    implements $WalletCopyWith<$Res> {
  _$WalletCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Wallet
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? balance = null,
    Object? reserved = null,
  }) {
    return _then(_value.copyWith(
      balance: null == balance
          ? _value.balance
          : balance // ignore: cast_nullable_to_non_nullable
              as num,
      reserved: null == reserved
          ? _value.reserved
          : reserved // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WalletImplCopyWith<$Res> implements $WalletCopyWith<$Res> {
  factory _$$WalletImplCopyWith(
          _$WalletImpl value, $Res Function(_$WalletImpl) then) =
      __$$WalletImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num balance, num reserved});
}

/// @nodoc
class __$$WalletImplCopyWithImpl<$Res>
    extends _$WalletCopyWithImpl<$Res, _$WalletImpl>
    implements _$$WalletImplCopyWith<$Res> {
  __$$WalletImplCopyWithImpl(
      _$WalletImpl _value, $Res Function(_$WalletImpl) _then)
      : super(_value, _then);

  /// Create a copy of Wallet
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? balance = null,
    Object? reserved = null,
  }) {
    return _then(_$WalletImpl(
      balance: null == balance
          ? _value.balance
          : balance // ignore: cast_nullable_to_non_nullable
              as num,
      reserved: null == reserved
          ? _value.reserved
          : reserved // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WalletImpl implements _Wallet {
  const _$WalletImpl({this.balance = 0, this.reserved = 0});

  factory _$WalletImpl.fromJson(Map<String, dynamic> json) =>
      _$$WalletImplFromJson(json);

  @override
  @JsonKey()
  final num balance;
  @override
  @JsonKey()
  final num reserved;

  @override
  String toString() {
    return 'Wallet(balance: $balance, reserved: $reserved)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WalletImpl &&
            (identical(other.balance, balance) || other.balance == balance) &&
            (identical(other.reserved, reserved) ||
                other.reserved == reserved));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, balance, reserved);

  /// Create a copy of Wallet
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WalletImplCopyWith<_$WalletImpl> get copyWith =>
      __$$WalletImplCopyWithImpl<_$WalletImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WalletImplToJson(
      this,
    );
  }
}

abstract class _Wallet implements Wallet {
  const factory _Wallet({final num balance, final num reserved}) = _$WalletImpl;

  factory _Wallet.fromJson(Map<String, dynamic> json) = _$WalletImpl.fromJson;

  @override
  num get balance;
  @override
  num get reserved;

  /// Create a copy of Wallet
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WalletImplCopyWith<_$WalletImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Allowance _$AllowanceFromJson(Map<String, dynamic> json) {
  return _Allowance.fromJson(json);
}

/// @nodoc
mixin _$Allowance {
  num get included => throw _privateConstructorUsedError;
  @JsonKey(name: "used_this_cycle")
  num get usedThisCycle => throw _privateConstructorUsedError;
  @JsonKey(name: "cycle_start")
  String? get cycleStart => throw _privateConstructorUsedError;

  /// Serializes this Allowance to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Allowance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AllowanceCopyWith<Allowance> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AllowanceCopyWith<$Res> {
  factory $AllowanceCopyWith(Allowance value, $Res Function(Allowance) then) =
      _$AllowanceCopyWithImpl<$Res, Allowance>;
  @useResult
  $Res call(
      {num included,
      @JsonKey(name: "used_this_cycle") num usedThisCycle,
      @JsonKey(name: "cycle_start") String? cycleStart});
}

/// @nodoc
class _$AllowanceCopyWithImpl<$Res, $Val extends Allowance>
    implements $AllowanceCopyWith<$Res> {
  _$AllowanceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Allowance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? included = null,
    Object? usedThisCycle = null,
    Object? cycleStart = freezed,
  }) {
    return _then(_value.copyWith(
      included: null == included
          ? _value.included
          : included // ignore: cast_nullable_to_non_nullable
              as num,
      usedThisCycle: null == usedThisCycle
          ? _value.usedThisCycle
          : usedThisCycle // ignore: cast_nullable_to_non_nullable
              as num,
      cycleStart: freezed == cycleStart
          ? _value.cycleStart
          : cycleStart // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AllowanceImplCopyWith<$Res>
    implements $AllowanceCopyWith<$Res> {
  factory _$$AllowanceImplCopyWith(
          _$AllowanceImpl value, $Res Function(_$AllowanceImpl) then) =
      __$$AllowanceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num included,
      @JsonKey(name: "used_this_cycle") num usedThisCycle,
      @JsonKey(name: "cycle_start") String? cycleStart});
}

/// @nodoc
class __$$AllowanceImplCopyWithImpl<$Res>
    extends _$AllowanceCopyWithImpl<$Res, _$AllowanceImpl>
    implements _$$AllowanceImplCopyWith<$Res> {
  __$$AllowanceImplCopyWithImpl(
      _$AllowanceImpl _value, $Res Function(_$AllowanceImpl) _then)
      : super(_value, _then);

  /// Create a copy of Allowance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? included = null,
    Object? usedThisCycle = null,
    Object? cycleStart = freezed,
  }) {
    return _then(_$AllowanceImpl(
      included: null == included
          ? _value.included
          : included // ignore: cast_nullable_to_non_nullable
              as num,
      usedThisCycle: null == usedThisCycle
          ? _value.usedThisCycle
          : usedThisCycle // ignore: cast_nullable_to_non_nullable
              as num,
      cycleStart: freezed == cycleStart
          ? _value.cycleStart
          : cycleStart // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AllowanceImpl implements _Allowance {
  const _$AllowanceImpl(
      {this.included = 0,
      @JsonKey(name: "used_this_cycle") this.usedThisCycle = 0,
      @JsonKey(name: "cycle_start") this.cycleStart});

  factory _$AllowanceImpl.fromJson(Map<String, dynamic> json) =>
      _$$AllowanceImplFromJson(json);

  @override
  @JsonKey()
  final num included;
  @override
  @JsonKey(name: "used_this_cycle")
  final num usedThisCycle;
  @override
  @JsonKey(name: "cycle_start")
  final String? cycleStart;

  @override
  String toString() {
    return 'Allowance(included: $included, usedThisCycle: $usedThisCycle, cycleStart: $cycleStart)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AllowanceImpl &&
            (identical(other.included, included) ||
                other.included == included) &&
            (identical(other.usedThisCycle, usedThisCycle) ||
                other.usedThisCycle == usedThisCycle) &&
            (identical(other.cycleStart, cycleStart) ||
                other.cycleStart == cycleStart));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, included, usedThisCycle, cycleStart);

  /// Create a copy of Allowance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AllowanceImplCopyWith<_$AllowanceImpl> get copyWith =>
      __$$AllowanceImplCopyWithImpl<_$AllowanceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AllowanceImplToJson(
      this,
    );
  }
}

abstract class _Allowance implements Allowance {
  const factory _Allowance(
          {final num included,
          @JsonKey(name: "used_this_cycle") final num usedThisCycle,
          @JsonKey(name: "cycle_start") final String? cycleStart}) =
      _$AllowanceImpl;

  factory _Allowance.fromJson(Map<String, dynamic> json) =
      _$AllowanceImpl.fromJson;

  @override
  num get included;
  @override
  @JsonKey(name: "used_this_cycle")
  num get usedThisCycle;
  @override
  @JsonKey(name: "cycle_start")
  String? get cycleStart;

  /// Create a copy of Allowance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AllowanceImplCopyWith<_$AllowanceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

GatewayInfo _$GatewayInfoFromJson(Map<String, dynamic> json) {
  return _GatewayInfo.fromJson(json);
}

/// @nodoc
mixin _$GatewayInfo {
  bool get configured => throw _privateConstructorUsedError;
  String? get name => throw _privateConstructorUsedError;

  /// Serializes this GatewayInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GatewayInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GatewayInfoCopyWith<GatewayInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GatewayInfoCopyWith<$Res> {
  factory $GatewayInfoCopyWith(
          GatewayInfo value, $Res Function(GatewayInfo) then) =
      _$GatewayInfoCopyWithImpl<$Res, GatewayInfo>;
  @useResult
  $Res call({bool configured, String? name});
}

/// @nodoc
class _$GatewayInfoCopyWithImpl<$Res, $Val extends GatewayInfo>
    implements $GatewayInfoCopyWith<$Res> {
  _$GatewayInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GatewayInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? configured = null,
    Object? name = freezed,
  }) {
    return _then(_value.copyWith(
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$GatewayInfoImplCopyWith<$Res>
    implements $GatewayInfoCopyWith<$Res> {
  factory _$$GatewayInfoImplCopyWith(
          _$GatewayInfoImpl value, $Res Function(_$GatewayInfoImpl) then) =
      __$$GatewayInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool configured, String? name});
}

/// @nodoc
class __$$GatewayInfoImplCopyWithImpl<$Res>
    extends _$GatewayInfoCopyWithImpl<$Res, _$GatewayInfoImpl>
    implements _$$GatewayInfoImplCopyWith<$Res> {
  __$$GatewayInfoImplCopyWithImpl(
      _$GatewayInfoImpl _value, $Res Function(_$GatewayInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of GatewayInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? configured = null,
    Object? name = freezed,
  }) {
    return _then(_$GatewayInfoImpl(
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$GatewayInfoImpl implements _GatewayInfo {
  const _$GatewayInfoImpl({this.configured = false, this.name});

  factory _$GatewayInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$GatewayInfoImplFromJson(json);

  @override
  @JsonKey()
  final bool configured;
  @override
  final String? name;

  @override
  String toString() {
    return 'GatewayInfo(configured: $configured, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GatewayInfoImpl &&
            (identical(other.configured, configured) ||
                other.configured == configured) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, configured, name);

  /// Create a copy of GatewayInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GatewayInfoImplCopyWith<_$GatewayInfoImpl> get copyWith =>
      __$$GatewayInfoImplCopyWithImpl<_$GatewayInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GatewayInfoImplToJson(
      this,
    );
  }
}

abstract class _GatewayInfo implements GatewayInfo {
  const factory _GatewayInfo({final bool configured, final String? name}) =
      _$GatewayInfoImpl;

  factory _GatewayInfo.fromJson(Map<String, dynamic> json) =
      _$GatewayInfoImpl.fromJson;

  @override
  bool get configured;
  @override
  String? get name;

  /// Create a copy of GatewayInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GatewayInfoImplCopyWith<_$GatewayInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BillingOverview _$BillingOverviewFromJson(Map<String, dynamic> json) {
  return _BillingOverview.fromJson(json);
}

/// @nodoc
mixin _$BillingOverview {
  @JsonKey(name: "credit_usd")
  num get creditUsd => throw _privateConstructorUsedError;
  @JsonKey(name: "plan_status")
  String get planStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "trial_ends_at")
  String? get trialEndsAt => throw _privateConstructorUsedError;
  CreditBuckets? get credits => throw _privateConstructorUsedError;
  Wallet get wallet => throw _privateConstructorUsedError;
  @JsonKey(name: "current_plan")
  BillingPlan? get currentPlan => throw _privateConstructorUsedError;
  List<BillingPlan> get plans => throw _privateConstructorUsedError;
  Allowance get allowance => throw _privateConstructorUsedError;
  List<BillingUsageRow> get usage => throw _privateConstructorUsedError;
  List<BillingPack> get packs => throw _privateConstructorUsedError;
  GatewayInfo get gateway => throw _privateConstructorUsedError;

  /// Serializes this BillingOverview to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BillingOverviewCopyWith<BillingOverview> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BillingOverviewCopyWith<$Res> {
  factory $BillingOverviewCopyWith(
          BillingOverview value, $Res Function(BillingOverview) then) =
      _$BillingOverviewCopyWithImpl<$Res, BillingOverview>;
  @useResult
  $Res call(
      {@JsonKey(name: "credit_usd") num creditUsd,
      @JsonKey(name: "plan_status") String planStatus,
      @JsonKey(name: "trial_ends_at") String? trialEndsAt,
      CreditBuckets? credits,
      Wallet wallet,
      @JsonKey(name: "current_plan") BillingPlan? currentPlan,
      List<BillingPlan> plans,
      Allowance allowance,
      List<BillingUsageRow> usage,
      List<BillingPack> packs,
      GatewayInfo gateway});

  $CreditBucketsCopyWith<$Res>? get credits;
  $WalletCopyWith<$Res> get wallet;
  $BillingPlanCopyWith<$Res>? get currentPlan;
  $AllowanceCopyWith<$Res> get allowance;
  $GatewayInfoCopyWith<$Res> get gateway;
}

/// @nodoc
class _$BillingOverviewCopyWithImpl<$Res, $Val extends BillingOverview>
    implements $BillingOverviewCopyWith<$Res> {
  _$BillingOverviewCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? creditUsd = null,
    Object? planStatus = null,
    Object? trialEndsAt = freezed,
    Object? credits = freezed,
    Object? wallet = null,
    Object? currentPlan = freezed,
    Object? plans = null,
    Object? allowance = null,
    Object? usage = null,
    Object? packs = null,
    Object? gateway = null,
  }) {
    return _then(_value.copyWith(
      creditUsd: null == creditUsd
          ? _value.creditUsd
          : creditUsd // ignore: cast_nullable_to_non_nullable
              as num,
      planStatus: null == planStatus
          ? _value.planStatus
          : planStatus // ignore: cast_nullable_to_non_nullable
              as String,
      trialEndsAt: freezed == trialEndsAt
          ? _value.trialEndsAt
          : trialEndsAt // ignore: cast_nullable_to_non_nullable
              as String?,
      credits: freezed == credits
          ? _value.credits
          : credits // ignore: cast_nullable_to_non_nullable
              as CreditBuckets?,
      wallet: null == wallet
          ? _value.wallet
          : wallet // ignore: cast_nullable_to_non_nullable
              as Wallet,
      currentPlan: freezed == currentPlan
          ? _value.currentPlan
          : currentPlan // ignore: cast_nullable_to_non_nullable
              as BillingPlan?,
      plans: null == plans
          ? _value.plans
          : plans // ignore: cast_nullable_to_non_nullable
              as List<BillingPlan>,
      allowance: null == allowance
          ? _value.allowance
          : allowance // ignore: cast_nullable_to_non_nullable
              as Allowance,
      usage: null == usage
          ? _value.usage
          : usage // ignore: cast_nullable_to_non_nullable
              as List<BillingUsageRow>,
      packs: null == packs
          ? _value.packs
          : packs // ignore: cast_nullable_to_non_nullable
              as List<BillingPack>,
      gateway: null == gateway
          ? _value.gateway
          : gateway // ignore: cast_nullable_to_non_nullable
              as GatewayInfo,
    ) as $Val);
  }

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CreditBucketsCopyWith<$Res>? get credits {
    if (_value.credits == null) {
      return null;
    }

    return $CreditBucketsCopyWith<$Res>(_value.credits!, (value) {
      return _then(_value.copyWith(credits: value) as $Val);
    });
  }

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WalletCopyWith<$Res> get wallet {
    return $WalletCopyWith<$Res>(_value.wallet, (value) {
      return _then(_value.copyWith(wallet: value) as $Val);
    });
  }

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $BillingPlanCopyWith<$Res>? get currentPlan {
    if (_value.currentPlan == null) {
      return null;
    }

    return $BillingPlanCopyWith<$Res>(_value.currentPlan!, (value) {
      return _then(_value.copyWith(currentPlan: value) as $Val);
    });
  }

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AllowanceCopyWith<$Res> get allowance {
    return $AllowanceCopyWith<$Res>(_value.allowance, (value) {
      return _then(_value.copyWith(allowance: value) as $Val);
    });
  }

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GatewayInfoCopyWith<$Res> get gateway {
    return $GatewayInfoCopyWith<$Res>(_value.gateway, (value) {
      return _then(_value.copyWith(gateway: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$BillingOverviewImplCopyWith<$Res>
    implements $BillingOverviewCopyWith<$Res> {
  factory _$$BillingOverviewImplCopyWith(_$BillingOverviewImpl value,
          $Res Function(_$BillingOverviewImpl) then) =
      __$$BillingOverviewImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "credit_usd") num creditUsd,
      @JsonKey(name: "plan_status") String planStatus,
      @JsonKey(name: "trial_ends_at") String? trialEndsAt,
      CreditBuckets? credits,
      Wallet wallet,
      @JsonKey(name: "current_plan") BillingPlan? currentPlan,
      List<BillingPlan> plans,
      Allowance allowance,
      List<BillingUsageRow> usage,
      List<BillingPack> packs,
      GatewayInfo gateway});

  @override
  $CreditBucketsCopyWith<$Res>? get credits;
  @override
  $WalletCopyWith<$Res> get wallet;
  @override
  $BillingPlanCopyWith<$Res>? get currentPlan;
  @override
  $AllowanceCopyWith<$Res> get allowance;
  @override
  $GatewayInfoCopyWith<$Res> get gateway;
}

/// @nodoc
class __$$BillingOverviewImplCopyWithImpl<$Res>
    extends _$BillingOverviewCopyWithImpl<$Res, _$BillingOverviewImpl>
    implements _$$BillingOverviewImplCopyWith<$Res> {
  __$$BillingOverviewImplCopyWithImpl(
      _$BillingOverviewImpl _value, $Res Function(_$BillingOverviewImpl) _then)
      : super(_value, _then);

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? creditUsd = null,
    Object? planStatus = null,
    Object? trialEndsAt = freezed,
    Object? credits = freezed,
    Object? wallet = null,
    Object? currentPlan = freezed,
    Object? plans = null,
    Object? allowance = null,
    Object? usage = null,
    Object? packs = null,
    Object? gateway = null,
  }) {
    return _then(_$BillingOverviewImpl(
      creditUsd: null == creditUsd
          ? _value.creditUsd
          : creditUsd // ignore: cast_nullable_to_non_nullable
              as num,
      planStatus: null == planStatus
          ? _value.planStatus
          : planStatus // ignore: cast_nullable_to_non_nullable
              as String,
      trialEndsAt: freezed == trialEndsAt
          ? _value.trialEndsAt
          : trialEndsAt // ignore: cast_nullable_to_non_nullable
              as String?,
      credits: freezed == credits
          ? _value.credits
          : credits // ignore: cast_nullable_to_non_nullable
              as CreditBuckets?,
      wallet: null == wallet
          ? _value.wallet
          : wallet // ignore: cast_nullable_to_non_nullable
              as Wallet,
      currentPlan: freezed == currentPlan
          ? _value.currentPlan
          : currentPlan // ignore: cast_nullable_to_non_nullable
              as BillingPlan?,
      plans: null == plans
          ? _value._plans
          : plans // ignore: cast_nullable_to_non_nullable
              as List<BillingPlan>,
      allowance: null == allowance
          ? _value.allowance
          : allowance // ignore: cast_nullable_to_non_nullable
              as Allowance,
      usage: null == usage
          ? _value._usage
          : usage // ignore: cast_nullable_to_non_nullable
              as List<BillingUsageRow>,
      packs: null == packs
          ? _value._packs
          : packs // ignore: cast_nullable_to_non_nullable
              as List<BillingPack>,
      gateway: null == gateway
          ? _value.gateway
          : gateway // ignore: cast_nullable_to_non_nullable
              as GatewayInfo,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$BillingOverviewImpl implements _BillingOverview {
  const _$BillingOverviewImpl(
      {@JsonKey(name: "credit_usd") this.creditUsd = 0.01,
      @JsonKey(name: "plan_status") this.planStatus = "",
      @JsonKey(name: "trial_ends_at") this.trialEndsAt,
      this.credits,
      this.wallet = const Wallet(),
      @JsonKey(name: "current_plan") this.currentPlan,
      final List<BillingPlan> plans = const <BillingPlan>[],
      this.allowance = const Allowance(),
      final List<BillingUsageRow> usage = const <BillingUsageRow>[],
      final List<BillingPack> packs = const <BillingPack>[],
      this.gateway = const GatewayInfo()})
      : _plans = plans,
        _usage = usage,
        _packs = packs;

  factory _$BillingOverviewImpl.fromJson(Map<String, dynamic> json) =>
      _$$BillingOverviewImplFromJson(json);

  @override
  @JsonKey(name: "credit_usd")
  final num creditUsd;
  @override
  @JsonKey(name: "plan_status")
  final String planStatus;
  @override
  @JsonKey(name: "trial_ends_at")
  final String? trialEndsAt;
  @override
  final CreditBuckets? credits;
  @override
  @JsonKey()
  final Wallet wallet;
  @override
  @JsonKey(name: "current_plan")
  final BillingPlan? currentPlan;
  final List<BillingPlan> _plans;
  @override
  @JsonKey()
  List<BillingPlan> get plans {
    if (_plans is EqualUnmodifiableListView) return _plans;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_plans);
  }

  @override
  @JsonKey()
  final Allowance allowance;
  final List<BillingUsageRow> _usage;
  @override
  @JsonKey()
  List<BillingUsageRow> get usage {
    if (_usage is EqualUnmodifiableListView) return _usage;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_usage);
  }

  final List<BillingPack> _packs;
  @override
  @JsonKey()
  List<BillingPack> get packs {
    if (_packs is EqualUnmodifiableListView) return _packs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_packs);
  }

  @override
  @JsonKey()
  final GatewayInfo gateway;

  @override
  String toString() {
    return 'BillingOverview(creditUsd: $creditUsd, planStatus: $planStatus, trialEndsAt: $trialEndsAt, credits: $credits, wallet: $wallet, currentPlan: $currentPlan, plans: $plans, allowance: $allowance, usage: $usage, packs: $packs, gateway: $gateway)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BillingOverviewImpl &&
            (identical(other.creditUsd, creditUsd) ||
                other.creditUsd == creditUsd) &&
            (identical(other.planStatus, planStatus) ||
                other.planStatus == planStatus) &&
            (identical(other.trialEndsAt, trialEndsAt) ||
                other.trialEndsAt == trialEndsAt) &&
            (identical(other.credits, credits) || other.credits == credits) &&
            (identical(other.wallet, wallet) || other.wallet == wallet) &&
            (identical(other.currentPlan, currentPlan) ||
                other.currentPlan == currentPlan) &&
            const DeepCollectionEquality().equals(other._plans, _plans) &&
            (identical(other.allowance, allowance) ||
                other.allowance == allowance) &&
            const DeepCollectionEquality().equals(other._usage, _usage) &&
            const DeepCollectionEquality().equals(other._packs, _packs) &&
            (identical(other.gateway, gateway) || other.gateway == gateway));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      creditUsd,
      planStatus,
      trialEndsAt,
      credits,
      wallet,
      currentPlan,
      const DeepCollectionEquality().hash(_plans),
      allowance,
      const DeepCollectionEquality().hash(_usage),
      const DeepCollectionEquality().hash(_packs),
      gateway);

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BillingOverviewImplCopyWith<_$BillingOverviewImpl> get copyWith =>
      __$$BillingOverviewImplCopyWithImpl<_$BillingOverviewImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BillingOverviewImplToJson(
      this,
    );
  }
}

abstract class _BillingOverview implements BillingOverview {
  const factory _BillingOverview(
      {@JsonKey(name: "credit_usd") final num creditUsd,
      @JsonKey(name: "plan_status") final String planStatus,
      @JsonKey(name: "trial_ends_at") final String? trialEndsAt,
      final CreditBuckets? credits,
      final Wallet wallet,
      @JsonKey(name: "current_plan") final BillingPlan? currentPlan,
      final List<BillingPlan> plans,
      final Allowance allowance,
      final List<BillingUsageRow> usage,
      final List<BillingPack> packs,
      final GatewayInfo gateway}) = _$BillingOverviewImpl;

  factory _BillingOverview.fromJson(Map<String, dynamic> json) =
      _$BillingOverviewImpl.fromJson;

  @override
  @JsonKey(name: "credit_usd")
  num get creditUsd;
  @override
  @JsonKey(name: "plan_status")
  String get planStatus;
  @override
  @JsonKey(name: "trial_ends_at")
  String? get trialEndsAt;
  @override
  CreditBuckets? get credits;
  @override
  Wallet get wallet;
  @override
  @JsonKey(name: "current_plan")
  BillingPlan? get currentPlan;
  @override
  List<BillingPlan> get plans;
  @override
  Allowance get allowance;
  @override
  List<BillingUsageRow> get usage;
  @override
  List<BillingPack> get packs;
  @override
  GatewayInfo get gateway;

  /// Create a copy of BillingOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BillingOverviewImplCopyWith<_$BillingOverviewImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreditTransaction _$CreditTransactionFromJson(Map<String, dynamic> json) {
  return _CreditTransaction.fromJson(json);
}

/// @nodoc
mixin _$CreditTransaction {
  String get id => throw _privateConstructorUsedError;
  String? get kind => throw _privateConstructorUsedError;
  String? get label => throw _privateConstructorUsedError;
  String? get type => throw _privateConstructorUsedError;
  num get amount => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;

  /// Serializes this CreditTransaction to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreditTransaction
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreditTransactionCopyWith<CreditTransaction> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreditTransactionCopyWith<$Res> {
  factory $CreditTransactionCopyWith(
          CreditTransaction value, $Res Function(CreditTransaction) then) =
      _$CreditTransactionCopyWithImpl<$Res, CreditTransaction>;
  @useResult
  $Res call(
      {String id,
      String? kind,
      String? label,
      String? type,
      num amount,
      @JsonKey(name: "created_at") String createdAt});
}

/// @nodoc
class _$CreditTransactionCopyWithImpl<$Res, $Val extends CreditTransaction>
    implements $CreditTransactionCopyWith<$Res> {
  _$CreditTransactionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreditTransaction
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? kind = freezed,
    Object? label = freezed,
    Object? type = freezed,
    Object? amount = null,
    Object? createdAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      kind: freezed == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String?,
      label: freezed == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String?,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreditTransactionImplCopyWith<$Res>
    implements $CreditTransactionCopyWith<$Res> {
  factory _$$CreditTransactionImplCopyWith(_$CreditTransactionImpl value,
          $Res Function(_$CreditTransactionImpl) then) =
      __$$CreditTransactionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String? kind,
      String? label,
      String? type,
      num amount,
      @JsonKey(name: "created_at") String createdAt});
}

/// @nodoc
class __$$CreditTransactionImplCopyWithImpl<$Res>
    extends _$CreditTransactionCopyWithImpl<$Res, _$CreditTransactionImpl>
    implements _$$CreditTransactionImplCopyWith<$Res> {
  __$$CreditTransactionImplCopyWithImpl(_$CreditTransactionImpl _value,
      $Res Function(_$CreditTransactionImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreditTransaction
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? kind = freezed,
    Object? label = freezed,
    Object? type = freezed,
    Object? amount = null,
    Object? createdAt = null,
  }) {
    return _then(_$CreditTransactionImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      kind: freezed == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String?,
      label: freezed == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String?,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as num,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreditTransactionImpl implements _CreditTransaction {
  const _$CreditTransactionImpl(
      {this.id = "",
      this.kind,
      this.label,
      this.type,
      this.amount = 0,
      @JsonKey(name: "created_at") this.createdAt = ""});

  factory _$CreditTransactionImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreditTransactionImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  final String? kind;
  @override
  final String? label;
  @override
  final String? type;
  @override
  @JsonKey()
  final num amount;
  @override
  @JsonKey(name: "created_at")
  final String createdAt;

  @override
  String toString() {
    return 'CreditTransaction(id: $id, kind: $kind, label: $label, type: $type, amount: $amount, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreditTransactionImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.kind, kind) || other.kind == kind) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, kind, label, type, amount, createdAt);

  /// Create a copy of CreditTransaction
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreditTransactionImplCopyWith<_$CreditTransactionImpl> get copyWith =>
      __$$CreditTransactionImplCopyWithImpl<_$CreditTransactionImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreditTransactionImplToJson(
      this,
    );
  }
}

abstract class _CreditTransaction implements CreditTransaction {
  const factory _CreditTransaction(
          {final String id,
          final String? kind,
          final String? label,
          final String? type,
          final num amount,
          @JsonKey(name: "created_at") final String createdAt}) =
      _$CreditTransactionImpl;

  factory _CreditTransaction.fromJson(Map<String, dynamic> json) =
      _$CreditTransactionImpl.fromJson;

  @override
  String get id;
  @override
  String? get kind;
  @override
  String? get label;
  @override
  String? get type;
  @override
  num get amount;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;

  /// Create a copy of CreditTransaction
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreditTransactionImplCopyWith<_$CreditTransactionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreditsHistory _$CreditsHistoryFromJson(Map<String, dynamic> json) {
  return _CreditsHistory.fromJson(json);
}

/// @nodoc
mixin _$CreditsHistory {
  num get balance => throw _privateConstructorUsedError;
  List<CreditTransaction> get transactions =>
      throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;
  @JsonKey(name: "has_more")
  bool get hasMore => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;
  int get offset => throw _privateConstructorUsedError;

  /// Serializes this CreditsHistory to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreditsHistory
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreditsHistoryCopyWith<CreditsHistory> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreditsHistoryCopyWith<$Res> {
  factory $CreditsHistoryCopyWith(
          CreditsHistory value, $Res Function(CreditsHistory) then) =
      _$CreditsHistoryCopyWithImpl<$Res, CreditsHistory>;
  @useResult
  $Res call(
      {num balance,
      List<CreditTransaction> transactions,
      int count,
      @JsonKey(name: "has_more") bool hasMore,
      int limit,
      int offset});
}

/// @nodoc
class _$CreditsHistoryCopyWithImpl<$Res, $Val extends CreditsHistory>
    implements $CreditsHistoryCopyWith<$Res> {
  _$CreditsHistoryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreditsHistory
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? balance = null,
    Object? transactions = null,
    Object? count = null,
    Object? hasMore = null,
    Object? limit = null,
    Object? offset = null,
  }) {
    return _then(_value.copyWith(
      balance: null == balance
          ? _value.balance
          : balance // ignore: cast_nullable_to_non_nullable
              as num,
      transactions: null == transactions
          ? _value.transactions
          : transactions // ignore: cast_nullable_to_non_nullable
              as List<CreditTransaction>,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      hasMore: null == hasMore
          ? _value.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
      limit: null == limit
          ? _value.limit
          : limit // ignore: cast_nullable_to_non_nullable
              as int,
      offset: null == offset
          ? _value.offset
          : offset // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreditsHistoryImplCopyWith<$Res>
    implements $CreditsHistoryCopyWith<$Res> {
  factory _$$CreditsHistoryImplCopyWith(_$CreditsHistoryImpl value,
          $Res Function(_$CreditsHistoryImpl) then) =
      __$$CreditsHistoryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num balance,
      List<CreditTransaction> transactions,
      int count,
      @JsonKey(name: "has_more") bool hasMore,
      int limit,
      int offset});
}

/// @nodoc
class __$$CreditsHistoryImplCopyWithImpl<$Res>
    extends _$CreditsHistoryCopyWithImpl<$Res, _$CreditsHistoryImpl>
    implements _$$CreditsHistoryImplCopyWith<$Res> {
  __$$CreditsHistoryImplCopyWithImpl(
      _$CreditsHistoryImpl _value, $Res Function(_$CreditsHistoryImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreditsHistory
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? balance = null,
    Object? transactions = null,
    Object? count = null,
    Object? hasMore = null,
    Object? limit = null,
    Object? offset = null,
  }) {
    return _then(_$CreditsHistoryImpl(
      balance: null == balance
          ? _value.balance
          : balance // ignore: cast_nullable_to_non_nullable
              as num,
      transactions: null == transactions
          ? _value._transactions
          : transactions // ignore: cast_nullable_to_non_nullable
              as List<CreditTransaction>,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      hasMore: null == hasMore
          ? _value.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
      limit: null == limit
          ? _value.limit
          : limit // ignore: cast_nullable_to_non_nullable
              as int,
      offset: null == offset
          ? _value.offset
          : offset // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreditsHistoryImpl implements _CreditsHistory {
  const _$CreditsHistoryImpl(
      {this.balance = 0,
      final List<CreditTransaction> transactions = const <CreditTransaction>[],
      this.count = 0,
      @JsonKey(name: "has_more") this.hasMore = false,
      this.limit = 0,
      this.offset = 0})
      : _transactions = transactions;

  factory _$CreditsHistoryImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreditsHistoryImplFromJson(json);

  @override
  @JsonKey()
  final num balance;
  final List<CreditTransaction> _transactions;
  @override
  @JsonKey()
  List<CreditTransaction> get transactions {
    if (_transactions is EqualUnmodifiableListView) return _transactions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_transactions);
  }

  @override
  @JsonKey()
  final int count;
  @override
  @JsonKey(name: "has_more")
  final bool hasMore;
  @override
  @JsonKey()
  final int limit;
  @override
  @JsonKey()
  final int offset;

  @override
  String toString() {
    return 'CreditsHistory(balance: $balance, transactions: $transactions, count: $count, hasMore: $hasMore, limit: $limit, offset: $offset)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreditsHistoryImpl &&
            (identical(other.balance, balance) || other.balance == balance) &&
            const DeepCollectionEquality()
                .equals(other._transactions, _transactions) &&
            (identical(other.count, count) || other.count == count) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore) &&
            (identical(other.limit, limit) || other.limit == limit) &&
            (identical(other.offset, offset) || other.offset == offset));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      balance,
      const DeepCollectionEquality().hash(_transactions),
      count,
      hasMore,
      limit,
      offset);

  /// Create a copy of CreditsHistory
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreditsHistoryImplCopyWith<_$CreditsHistoryImpl> get copyWith =>
      __$$CreditsHistoryImplCopyWithImpl<_$CreditsHistoryImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreditsHistoryImplToJson(
      this,
    );
  }
}

abstract class _CreditsHistory implements CreditsHistory {
  const factory _CreditsHistory(
      {final num balance,
      final List<CreditTransaction> transactions,
      final int count,
      @JsonKey(name: "has_more") final bool hasMore,
      final int limit,
      final int offset}) = _$CreditsHistoryImpl;

  factory _CreditsHistory.fromJson(Map<String, dynamic> json) =
      _$CreditsHistoryImpl.fromJson;

  @override
  num get balance;
  @override
  List<CreditTransaction> get transactions;
  @override
  int get count;
  @override
  @JsonKey(name: "has_more")
  bool get hasMore;
  @override
  int get limit;
  @override
  int get offset;

  /// Create a copy of CreditsHistory
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreditsHistoryImplCopyWith<_$CreditsHistoryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
