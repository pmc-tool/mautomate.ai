// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'settings_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

StoreProfile _$StoreProfileFromJson(Map<String, dynamic> json) {
  return _StoreProfile.fromJson(json);
}

/// @nodoc
mixin _$StoreProfile {
  String get name => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  String? get domain => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;

  /// Serializes this StoreProfile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StoreProfile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StoreProfileCopyWith<StoreProfile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StoreProfileCopyWith<$Res> {
  factory $StoreProfileCopyWith(
          StoreProfile value, $Res Function(StoreProfile) then) =
      _$StoreProfileCopyWithImpl<$Res, StoreProfile>;
  @useResult
  $Res call({String name, String slug, String? domain, String status});
}

/// @nodoc
class _$StoreProfileCopyWithImpl<$Res, $Val extends StoreProfile>
    implements $StoreProfileCopyWith<$Res> {
  _$StoreProfileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StoreProfile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? slug = null,
    Object? domain = freezed,
    Object? status = null,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _value.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      domain: freezed == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StoreProfileImplCopyWith<$Res>
    implements $StoreProfileCopyWith<$Res> {
  factory _$$StoreProfileImplCopyWith(
          _$StoreProfileImpl value, $Res Function(_$StoreProfileImpl) then) =
      __$$StoreProfileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String name, String slug, String? domain, String status});
}

/// @nodoc
class __$$StoreProfileImplCopyWithImpl<$Res>
    extends _$StoreProfileCopyWithImpl<$Res, _$StoreProfileImpl>
    implements _$$StoreProfileImplCopyWith<$Res> {
  __$$StoreProfileImplCopyWithImpl(
      _$StoreProfileImpl _value, $Res Function(_$StoreProfileImpl) _then)
      : super(_value, _then);

  /// Create a copy of StoreProfile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? slug = null,
    Object? domain = freezed,
    Object? status = null,
  }) {
    return _then(_$StoreProfileImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _value.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      domain: freezed == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StoreProfileImpl implements _StoreProfile {
  const _$StoreProfileImpl(
      {this.name = "", this.slug = "", this.domain, this.status = ""});

  factory _$StoreProfileImpl.fromJson(Map<String, dynamic> json) =>
      _$$StoreProfileImplFromJson(json);

  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey()
  final String slug;
  @override
  final String? domain;
  @override
  @JsonKey()
  final String status;

  @override
  String toString() {
    return 'StoreProfile(name: $name, slug: $slug, domain: $domain, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StoreProfileImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.domain, domain) || other.domain == domain) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, slug, domain, status);

  /// Create a copy of StoreProfile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StoreProfileImplCopyWith<_$StoreProfileImpl> get copyWith =>
      __$$StoreProfileImplCopyWithImpl<_$StoreProfileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StoreProfileImplToJson(
      this,
    );
  }
}

abstract class _StoreProfile implements StoreProfile {
  const factory _StoreProfile(
      {final String name,
      final String slug,
      final String? domain,
      final String status}) = _$StoreProfileImpl;

  factory _StoreProfile.fromJson(Map<String, dynamic> json) =
      _$StoreProfileImpl.fromJson;

  @override
  String get name;
  @override
  String get slug;
  @override
  String? get domain;
  @override
  String get status;

  /// Create a copy of StoreProfile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StoreProfileImplCopyWith<_$StoreProfileImpl> get copyWith =>
      throw _privateConstructorUsedError;
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
      {final List<String> currencies = const <String>[],
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

GatewayCredential _$GatewayCredentialFromJson(Map<String, dynamic> json) {
  return _GatewayCredential.fromJson(json);
}

/// @nodoc
mixin _$GatewayCredential {
  String get key => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  bool get secret => throw _privateConstructorUsedError;
  bool get optional => throw _privateConstructorUsedError;
  @JsonKey(name: "is_set")
  bool? get isSet => throw _privateConstructorUsedError;

  /// Serializes this GatewayCredential to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GatewayCredential
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GatewayCredentialCopyWith<GatewayCredential> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GatewayCredentialCopyWith<$Res> {
  factory $GatewayCredentialCopyWith(
          GatewayCredential value, $Res Function(GatewayCredential) then) =
      _$GatewayCredentialCopyWithImpl<$Res, GatewayCredential>;
  @useResult
  $Res call(
      {String key,
      String label,
      bool secret,
      bool optional,
      @JsonKey(name: "is_set") bool? isSet});
}

/// @nodoc
class _$GatewayCredentialCopyWithImpl<$Res, $Val extends GatewayCredential>
    implements $GatewayCredentialCopyWith<$Res> {
  _$GatewayCredentialCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GatewayCredential
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? label = null,
    Object? secret = null,
    Object? optional = null,
    Object? isSet = freezed,
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
      secret: null == secret
          ? _value.secret
          : secret // ignore: cast_nullable_to_non_nullable
              as bool,
      optional: null == optional
          ? _value.optional
          : optional // ignore: cast_nullable_to_non_nullable
              as bool,
      isSet: freezed == isSet
          ? _value.isSet
          : isSet // ignore: cast_nullable_to_non_nullable
              as bool?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$GatewayCredentialImplCopyWith<$Res>
    implements $GatewayCredentialCopyWith<$Res> {
  factory _$$GatewayCredentialImplCopyWith(_$GatewayCredentialImpl value,
          $Res Function(_$GatewayCredentialImpl) then) =
      __$$GatewayCredentialImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String key,
      String label,
      bool secret,
      bool optional,
      @JsonKey(name: "is_set") bool? isSet});
}

/// @nodoc
class __$$GatewayCredentialImplCopyWithImpl<$Res>
    extends _$GatewayCredentialCopyWithImpl<$Res, _$GatewayCredentialImpl>
    implements _$$GatewayCredentialImplCopyWith<$Res> {
  __$$GatewayCredentialImplCopyWithImpl(_$GatewayCredentialImpl _value,
      $Res Function(_$GatewayCredentialImpl) _then)
      : super(_value, _then);

  /// Create a copy of GatewayCredential
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? label = null,
    Object? secret = null,
    Object? optional = null,
    Object? isSet = freezed,
  }) {
    return _then(_$GatewayCredentialImpl(
      key: null == key
          ? _value.key
          : key // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      secret: null == secret
          ? _value.secret
          : secret // ignore: cast_nullable_to_non_nullable
              as bool,
      optional: null == optional
          ? _value.optional
          : optional // ignore: cast_nullable_to_non_nullable
              as bool,
      isSet: freezed == isSet
          ? _value.isSet
          : isSet // ignore: cast_nullable_to_non_nullable
              as bool?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$GatewayCredentialImpl implements _GatewayCredential {
  const _$GatewayCredentialImpl(
      {this.key = "",
      this.label = "",
      this.secret = false,
      this.optional = false,
      @JsonKey(name: "is_set") this.isSet});

  factory _$GatewayCredentialImpl.fromJson(Map<String, dynamic> json) =>
      _$$GatewayCredentialImplFromJson(json);

  @override
  @JsonKey()
  final String key;
  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final bool secret;
  @override
  @JsonKey()
  final bool optional;
  @override
  @JsonKey(name: "is_set")
  final bool? isSet;

  @override
  String toString() {
    return 'GatewayCredential(key: $key, label: $label, secret: $secret, optional: $optional, isSet: $isSet)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GatewayCredentialImpl &&
            (identical(other.key, key) || other.key == key) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.secret, secret) || other.secret == secret) &&
            (identical(other.optional, optional) ||
                other.optional == optional) &&
            (identical(other.isSet, isSet) || other.isSet == isSet));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, key, label, secret, optional, isSet);

  /// Create a copy of GatewayCredential
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GatewayCredentialImplCopyWith<_$GatewayCredentialImpl> get copyWith =>
      __$$GatewayCredentialImplCopyWithImpl<_$GatewayCredentialImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GatewayCredentialImplToJson(
      this,
    );
  }
}

abstract class _GatewayCredential implements GatewayCredential {
  const factory _GatewayCredential(
      {final String key,
      final String label,
      final bool secret,
      final bool optional,
      @JsonKey(name: "is_set") final bool? isSet}) = _$GatewayCredentialImpl;

  factory _GatewayCredential.fromJson(Map<String, dynamic> json) =
      _$GatewayCredentialImpl.fromJson;

  @override
  String get key;
  @override
  String get label;
  @override
  bool get secret;
  @override
  bool get optional;
  @override
  @JsonKey(name: "is_set")
  bool? get isSet;

  /// Create a copy of GatewayCredential
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GatewayCredentialImplCopyWith<_$GatewayCredentialImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PaymentGateway _$PaymentGatewayFromJson(Map<String, dynamic> json) {
  return _PaymentGateway.fromJson(json);
}

/// @nodoc
mixin _$PaymentGateway {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "provider_id")
  String get providerId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get blurb => throw _privateConstructorUsedError;
  List<String> get countries => throw _privateConstructorUsedError;
  String get mode => throw _privateConstructorUsedError;
  bool get configured => throw _privateConstructorUsedError;
  bool get enabled => throw _privateConstructorUsedError;
  @JsonKey(name: "enabled_regions")
  List<String> get enabledRegions => throw _privateConstructorUsedError;
  List<GatewayCredential> get credentials => throw _privateConstructorUsedError;

  /// Serializes this PaymentGateway to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PaymentGateway
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentGatewayCopyWith<PaymentGateway> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentGatewayCopyWith<$Res> {
  factory $PaymentGatewayCopyWith(
          PaymentGateway value, $Res Function(PaymentGateway) then) =
      _$PaymentGatewayCopyWithImpl<$Res, PaymentGateway>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "provider_id") String providerId,
      String name,
      String blurb,
      List<String> countries,
      String mode,
      bool configured,
      bool enabled,
      @JsonKey(name: "enabled_regions") List<String> enabledRegions,
      List<GatewayCredential> credentials});
}

/// @nodoc
class _$PaymentGatewayCopyWithImpl<$Res, $Val extends PaymentGateway>
    implements $PaymentGatewayCopyWith<$Res> {
  _$PaymentGatewayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PaymentGateway
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? providerId = null,
    Object? name = null,
    Object? blurb = null,
    Object? countries = null,
    Object? mode = null,
    Object? configured = null,
    Object? enabled = null,
    Object? enabledRegions = null,
    Object? credentials = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      providerId: null == providerId
          ? _value.providerId
          : providerId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      blurb: null == blurb
          ? _value.blurb
          : blurb // ignore: cast_nullable_to_non_nullable
              as String,
      countries: null == countries
          ? _value.countries
          : countries // ignore: cast_nullable_to_non_nullable
              as List<String>,
      mode: null == mode
          ? _value.mode
          : mode // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      enabledRegions: null == enabledRegions
          ? _value.enabledRegions
          : enabledRegions // ignore: cast_nullable_to_non_nullable
              as List<String>,
      credentials: null == credentials
          ? _value.credentials
          : credentials // ignore: cast_nullable_to_non_nullable
              as List<GatewayCredential>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PaymentGatewayImplCopyWith<$Res>
    implements $PaymentGatewayCopyWith<$Res> {
  factory _$$PaymentGatewayImplCopyWith(_$PaymentGatewayImpl value,
          $Res Function(_$PaymentGatewayImpl) then) =
      __$$PaymentGatewayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "provider_id") String providerId,
      String name,
      String blurb,
      List<String> countries,
      String mode,
      bool configured,
      bool enabled,
      @JsonKey(name: "enabled_regions") List<String> enabledRegions,
      List<GatewayCredential> credentials});
}

/// @nodoc
class __$$PaymentGatewayImplCopyWithImpl<$Res>
    extends _$PaymentGatewayCopyWithImpl<$Res, _$PaymentGatewayImpl>
    implements _$$PaymentGatewayImplCopyWith<$Res> {
  __$$PaymentGatewayImplCopyWithImpl(
      _$PaymentGatewayImpl _value, $Res Function(_$PaymentGatewayImpl) _then)
      : super(_value, _then);

  /// Create a copy of PaymentGateway
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? providerId = null,
    Object? name = null,
    Object? blurb = null,
    Object? countries = null,
    Object? mode = null,
    Object? configured = null,
    Object? enabled = null,
    Object? enabledRegions = null,
    Object? credentials = null,
  }) {
    return _then(_$PaymentGatewayImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      providerId: null == providerId
          ? _value.providerId
          : providerId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      blurb: null == blurb
          ? _value.blurb
          : blurb // ignore: cast_nullable_to_non_nullable
              as String,
      countries: null == countries
          ? _value._countries
          : countries // ignore: cast_nullable_to_non_nullable
              as List<String>,
      mode: null == mode
          ? _value.mode
          : mode // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      enabledRegions: null == enabledRegions
          ? _value._enabledRegions
          : enabledRegions // ignore: cast_nullable_to_non_nullable
              as List<String>,
      credentials: null == credentials
          ? _value._credentials
          : credentials // ignore: cast_nullable_to_non_nullable
              as List<GatewayCredential>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentGatewayImpl implements _PaymentGateway {
  const _$PaymentGatewayImpl(
      {this.id = "",
      @JsonKey(name: "provider_id") this.providerId = "",
      this.name = "",
      this.blurb = "",
      final List<String> countries = const <String>[],
      this.mode = "direct",
      this.configured = false,
      this.enabled = false,
      @JsonKey(name: "enabled_regions")
      final List<String> enabledRegions = const <String>[],
      final List<GatewayCredential> credentials = const <GatewayCredential>[]})
      : _countries = countries,
        _enabledRegions = enabledRegions,
        _credentials = credentials;

  factory _$PaymentGatewayImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentGatewayImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "provider_id")
  final String providerId;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey()
  final String blurb;
  final List<String> _countries;
  @override
  @JsonKey()
  List<String> get countries {
    if (_countries is EqualUnmodifiableListView) return _countries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_countries);
  }

  @override
  @JsonKey()
  final String mode;
  @override
  @JsonKey()
  final bool configured;
  @override
  @JsonKey()
  final bool enabled;
  final List<String> _enabledRegions;
  @override
  @JsonKey(name: "enabled_regions")
  List<String> get enabledRegions {
    if (_enabledRegions is EqualUnmodifiableListView) return _enabledRegions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_enabledRegions);
  }

  final List<GatewayCredential> _credentials;
  @override
  @JsonKey()
  List<GatewayCredential> get credentials {
    if (_credentials is EqualUnmodifiableListView) return _credentials;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_credentials);
  }

  @override
  String toString() {
    return 'PaymentGateway(id: $id, providerId: $providerId, name: $name, blurb: $blurb, countries: $countries, mode: $mode, configured: $configured, enabled: $enabled, enabledRegions: $enabledRegions, credentials: $credentials)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentGatewayImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.providerId, providerId) ||
                other.providerId == providerId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.blurb, blurb) || other.blurb == blurb) &&
            const DeepCollectionEquality()
                .equals(other._countries, _countries) &&
            (identical(other.mode, mode) || other.mode == mode) &&
            (identical(other.configured, configured) ||
                other.configured == configured) &&
            (identical(other.enabled, enabled) || other.enabled == enabled) &&
            const DeepCollectionEquality()
                .equals(other._enabledRegions, _enabledRegions) &&
            const DeepCollectionEquality()
                .equals(other._credentials, _credentials));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      providerId,
      name,
      blurb,
      const DeepCollectionEquality().hash(_countries),
      mode,
      configured,
      enabled,
      const DeepCollectionEquality().hash(_enabledRegions),
      const DeepCollectionEquality().hash(_credentials));

  /// Create a copy of PaymentGateway
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentGatewayImplCopyWith<_$PaymentGatewayImpl> get copyWith =>
      __$$PaymentGatewayImplCopyWithImpl<_$PaymentGatewayImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentGatewayImplToJson(
      this,
    );
  }
}

abstract class _PaymentGateway implements PaymentGateway {
  const factory _PaymentGateway(
      {final String id,
      @JsonKey(name: "provider_id") final String providerId,
      final String name,
      final String blurb,
      final List<String> countries,
      final String mode,
      final bool configured,
      final bool enabled,
      @JsonKey(name: "enabled_regions") final List<String> enabledRegions,
      final List<GatewayCredential> credentials}) = _$PaymentGatewayImpl;

  factory _PaymentGateway.fromJson(Map<String, dynamic> json) =
      _$PaymentGatewayImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "provider_id")
  String get providerId;
  @override
  String get name;
  @override
  String get blurb;
  @override
  List<String> get countries;
  @override
  String get mode;
  @override
  bool get configured;
  @override
  bool get enabled;
  @override
  @JsonKey(name: "enabled_regions")
  List<String> get enabledRegions;
  @override
  List<GatewayCredential> get credentials;

  /// Create a copy of PaymentGateway
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentGatewayImplCopyWith<_$PaymentGatewayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

GatewaysResponse _$GatewaysResponseFromJson(Map<String, dynamic> json) {
  return _GatewaysResponse.fromJson(json);
}

/// @nodoc
mixin _$GatewaysResponse {
  @JsonKey(name: "tenant_country")
  String? get tenantCountry => throw _privateConstructorUsedError;
  List<PaymentGateway> get gateways => throw _privateConstructorUsedError;

  /// Serializes this GatewaysResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GatewaysResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GatewaysResponseCopyWith<GatewaysResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GatewaysResponseCopyWith<$Res> {
  factory $GatewaysResponseCopyWith(
          GatewaysResponse value, $Res Function(GatewaysResponse) then) =
      _$GatewaysResponseCopyWithImpl<$Res, GatewaysResponse>;
  @useResult
  $Res call(
      {@JsonKey(name: "tenant_country") String? tenantCountry,
      List<PaymentGateway> gateways});
}

/// @nodoc
class _$GatewaysResponseCopyWithImpl<$Res, $Val extends GatewaysResponse>
    implements $GatewaysResponseCopyWith<$Res> {
  _$GatewaysResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GatewaysResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tenantCountry = freezed,
    Object? gateways = null,
  }) {
    return _then(_value.copyWith(
      tenantCountry: freezed == tenantCountry
          ? _value.tenantCountry
          : tenantCountry // ignore: cast_nullable_to_non_nullable
              as String?,
      gateways: null == gateways
          ? _value.gateways
          : gateways // ignore: cast_nullable_to_non_nullable
              as List<PaymentGateway>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$GatewaysResponseImplCopyWith<$Res>
    implements $GatewaysResponseCopyWith<$Res> {
  factory _$$GatewaysResponseImplCopyWith(_$GatewaysResponseImpl value,
          $Res Function(_$GatewaysResponseImpl) then) =
      __$$GatewaysResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "tenant_country") String? tenantCountry,
      List<PaymentGateway> gateways});
}

/// @nodoc
class __$$GatewaysResponseImplCopyWithImpl<$Res>
    extends _$GatewaysResponseCopyWithImpl<$Res, _$GatewaysResponseImpl>
    implements _$$GatewaysResponseImplCopyWith<$Res> {
  __$$GatewaysResponseImplCopyWithImpl(_$GatewaysResponseImpl _value,
      $Res Function(_$GatewaysResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of GatewaysResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tenantCountry = freezed,
    Object? gateways = null,
  }) {
    return _then(_$GatewaysResponseImpl(
      tenantCountry: freezed == tenantCountry
          ? _value.tenantCountry
          : tenantCountry // ignore: cast_nullable_to_non_nullable
              as String?,
      gateways: null == gateways
          ? _value._gateways
          : gateways // ignore: cast_nullable_to_non_nullable
              as List<PaymentGateway>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$GatewaysResponseImpl implements _GatewaysResponse {
  const _$GatewaysResponseImpl(
      {@JsonKey(name: "tenant_country") this.tenantCountry,
      final List<PaymentGateway> gateways = const <PaymentGateway>[]})
      : _gateways = gateways;

  factory _$GatewaysResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$GatewaysResponseImplFromJson(json);

  @override
  @JsonKey(name: "tenant_country")
  final String? tenantCountry;
  final List<PaymentGateway> _gateways;
  @override
  @JsonKey()
  List<PaymentGateway> get gateways {
    if (_gateways is EqualUnmodifiableListView) return _gateways;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_gateways);
  }

  @override
  String toString() {
    return 'GatewaysResponse(tenantCountry: $tenantCountry, gateways: $gateways)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GatewaysResponseImpl &&
            (identical(other.tenantCountry, tenantCountry) ||
                other.tenantCountry == tenantCountry) &&
            const DeepCollectionEquality().equals(other._gateways, _gateways));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, tenantCountry,
      const DeepCollectionEquality().hash(_gateways));

  /// Create a copy of GatewaysResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GatewaysResponseImplCopyWith<_$GatewaysResponseImpl> get copyWith =>
      __$$GatewaysResponseImplCopyWithImpl<_$GatewaysResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GatewaysResponseImplToJson(
      this,
    );
  }
}

abstract class _GatewaysResponse implements GatewaysResponse {
  const factory _GatewaysResponse(
      {@JsonKey(name: "tenant_country") final String? tenantCountry,
      final List<PaymentGateway> gateways}) = _$GatewaysResponseImpl;

  factory _GatewaysResponse.fromJson(Map<String, dynamic> json) =
      _$GatewaysResponseImpl.fromJson;

  @override
  @JsonKey(name: "tenant_country")
  String? get tenantCountry;
  @override
  List<PaymentGateway> get gateways;

  /// Create a copy of GatewaysResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GatewaysResponseImplCopyWith<_$GatewaysResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
