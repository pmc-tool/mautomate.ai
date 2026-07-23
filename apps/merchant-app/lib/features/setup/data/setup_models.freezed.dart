// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'setup_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SetupTask _$SetupTaskFromJson(Map<String, dynamic> json) {
  return _SetupTask.fromJson(json);
}

/// @nodoc
mixin _$SetupTask {
  String get key => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  String get why => throw _privateConstructorUsedError;
  bool get required => throw _privateConstructorUsedError;
  bool get done => throw _privateConstructorUsedError;
  @JsonKey(name: "cta_href")
  String get ctaHref => throw _privateConstructorUsedError;
  @JsonKey(name: "blocker_detail")
  String? get blockerDetail => throw _privateConstructorUsedError;

  /// Serializes this SetupTask to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupTask
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupTaskCopyWith<SetupTask> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupTaskCopyWith<$Res> {
  factory $SetupTaskCopyWith(SetupTask value, $Res Function(SetupTask) then) =
      _$SetupTaskCopyWithImpl<$Res, SetupTask>;
  @useResult
  $Res call(
      {String key,
      String label,
      String why,
      bool required,
      bool done,
      @JsonKey(name: "cta_href") String ctaHref,
      @JsonKey(name: "blocker_detail") String? blockerDetail});
}

/// @nodoc
class _$SetupTaskCopyWithImpl<$Res, $Val extends SetupTask>
    implements $SetupTaskCopyWith<$Res> {
  _$SetupTaskCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupTask
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? label = null,
    Object? why = null,
    Object? required = null,
    Object? done = null,
    Object? ctaHref = null,
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
      required: null == required
          ? _value.required
          : required // ignore: cast_nullable_to_non_nullable
              as bool,
      done: null == done
          ? _value.done
          : done // ignore: cast_nullable_to_non_nullable
              as bool,
      ctaHref: null == ctaHref
          ? _value.ctaHref
          : ctaHref // ignore: cast_nullable_to_non_nullable
              as String,
      blockerDetail: freezed == blockerDetail
          ? _value.blockerDetail
          : blockerDetail // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupTaskImplCopyWith<$Res>
    implements $SetupTaskCopyWith<$Res> {
  factory _$$SetupTaskImplCopyWith(
          _$SetupTaskImpl value, $Res Function(_$SetupTaskImpl) then) =
      __$$SetupTaskImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String key,
      String label,
      String why,
      bool required,
      bool done,
      @JsonKey(name: "cta_href") String ctaHref,
      @JsonKey(name: "blocker_detail") String? blockerDetail});
}

/// @nodoc
class __$$SetupTaskImplCopyWithImpl<$Res>
    extends _$SetupTaskCopyWithImpl<$Res, _$SetupTaskImpl>
    implements _$$SetupTaskImplCopyWith<$Res> {
  __$$SetupTaskImplCopyWithImpl(
      _$SetupTaskImpl _value, $Res Function(_$SetupTaskImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupTask
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? key = null,
    Object? label = null,
    Object? why = null,
    Object? required = null,
    Object? done = null,
    Object? ctaHref = null,
    Object? blockerDetail = freezed,
  }) {
    return _then(_$SetupTaskImpl(
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
      required: null == required
          ? _value.required
          : required // ignore: cast_nullable_to_non_nullable
              as bool,
      done: null == done
          ? _value.done
          : done // ignore: cast_nullable_to_non_nullable
              as bool,
      ctaHref: null == ctaHref
          ? _value.ctaHref
          : ctaHref // ignore: cast_nullable_to_non_nullable
              as String,
      blockerDetail: freezed == blockerDetail
          ? _value.blockerDetail
          : blockerDetail // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupTaskImpl implements _SetupTask {
  const _$SetupTaskImpl(
      {this.key = "",
      this.label = "",
      this.why = "",
      this.required = false,
      this.done = false,
      @JsonKey(name: "cta_href") this.ctaHref = "",
      @JsonKey(name: "blocker_detail") this.blockerDetail});

  factory _$SetupTaskImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupTaskImplFromJson(json);

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
  @JsonKey()
  final bool required;
  @override
  @JsonKey()
  final bool done;
  @override
  @JsonKey(name: "cta_href")
  final String ctaHref;
  @override
  @JsonKey(name: "blocker_detail")
  final String? blockerDetail;

  @override
  String toString() {
    return 'SetupTask(key: $key, label: $label, why: $why, required: $required, done: $done, ctaHref: $ctaHref, blockerDetail: $blockerDetail)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupTaskImpl &&
            (identical(other.key, key) || other.key == key) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.why, why) || other.why == why) &&
            (identical(other.required, required) ||
                other.required == required) &&
            (identical(other.done, done) || other.done == done) &&
            (identical(other.ctaHref, ctaHref) || other.ctaHref == ctaHref) &&
            (identical(other.blockerDetail, blockerDetail) ||
                other.blockerDetail == blockerDetail));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, key, label, why, required, done, ctaHref, blockerDetail);

  /// Create a copy of SetupTask
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupTaskImplCopyWith<_$SetupTaskImpl> get copyWith =>
      __$$SetupTaskImplCopyWithImpl<_$SetupTaskImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupTaskImplToJson(
      this,
    );
  }
}

abstract class _SetupTask implements SetupTask {
  const factory _SetupTask(
          {final String key,
          final String label,
          final String why,
          final bool required,
          final bool done,
          @JsonKey(name: "cta_href") final String ctaHref,
          @JsonKey(name: "blocker_detail") final String? blockerDetail}) =
      _$SetupTaskImpl;

  factory _SetupTask.fromJson(Map<String, dynamic> json) =
      _$SetupTaskImpl.fromJson;

  @override
  String get key;
  @override
  String get label;
  @override
  String get why;
  @override
  bool get required;
  @override
  bool get done;
  @override
  @JsonKey(name: "cta_href")
  String get ctaHref;
  @override
  @JsonKey(name: "blocker_detail")
  String? get blockerDetail;

  /// Create a copy of SetupTask
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupTaskImplCopyWith<_$SetupTaskImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SetupStatus _$SetupStatusFromJson(Map<String, dynamic> json) {
  return _SetupStatus.fromJson(json);
}

/// @nodoc
mixin _$SetupStatus {
  List<SetupTask> get tasks => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get percent => throw _privateConstructorUsedError;
  @JsonKey(name: "required_percent", fromJson: _toInt)
  int get requiredPercent => throw _privateConstructorUsedError;
  @JsonKey(name: "ready_to_sell")
  bool get readyToSell => throw _privateConstructorUsedError;
  @JsonKey(name: "missing_required")
  List<String> get missingRequired => throw _privateConstructorUsedError;
  @JsonKey(name: "shipping_countries")
  List<String> get shippingCountries => throw _privateConstructorUsedError;
  @JsonKey(name: "store_country")
  String get storeCountry => throw _privateConstructorUsedError;
  @JsonKey(name: "pending_domain")
  String? get pendingDomain => throw _privateConstructorUsedError;
  bool get products => throw _privateConstructorUsedError;
  bool get shipping => throw _privateConstructorUsedError;
  bool get payment => throw _privateConstructorUsedError;
  bool get domain => throw _privateConstructorUsedError;

  /// Serializes this SetupStatus to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupStatus
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupStatusCopyWith<SetupStatus> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupStatusCopyWith<$Res> {
  factory $SetupStatusCopyWith(
          SetupStatus value, $Res Function(SetupStatus) then) =
      _$SetupStatusCopyWithImpl<$Res, SetupStatus>;
  @useResult
  $Res call(
      {List<SetupTask> tasks,
      @JsonKey(fromJson: _toInt) int percent,
      @JsonKey(name: "required_percent", fromJson: _toInt) int requiredPercent,
      @JsonKey(name: "ready_to_sell") bool readyToSell,
      @JsonKey(name: "missing_required") List<String> missingRequired,
      @JsonKey(name: "shipping_countries") List<String> shippingCountries,
      @JsonKey(name: "store_country") String storeCountry,
      @JsonKey(name: "pending_domain") String? pendingDomain,
      bool products,
      bool shipping,
      bool payment,
      bool domain});
}

/// @nodoc
class _$SetupStatusCopyWithImpl<$Res, $Val extends SetupStatus>
    implements $SetupStatusCopyWith<$Res> {
  _$SetupStatusCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupStatus
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tasks = null,
    Object? percent = null,
    Object? requiredPercent = null,
    Object? readyToSell = null,
    Object? missingRequired = null,
    Object? shippingCountries = null,
    Object? storeCountry = null,
    Object? pendingDomain = freezed,
    Object? products = null,
    Object? shipping = null,
    Object? payment = null,
    Object? domain = null,
  }) {
    return _then(_value.copyWith(
      tasks: null == tasks
          ? _value.tasks
          : tasks // ignore: cast_nullable_to_non_nullable
              as List<SetupTask>,
      percent: null == percent
          ? _value.percent
          : percent // ignore: cast_nullable_to_non_nullable
              as int,
      requiredPercent: null == requiredPercent
          ? _value.requiredPercent
          : requiredPercent // ignore: cast_nullable_to_non_nullable
              as int,
      readyToSell: null == readyToSell
          ? _value.readyToSell
          : readyToSell // ignore: cast_nullable_to_non_nullable
              as bool,
      missingRequired: null == missingRequired
          ? _value.missingRequired
          : missingRequired // ignore: cast_nullable_to_non_nullable
              as List<String>,
      shippingCountries: null == shippingCountries
          ? _value.shippingCountries
          : shippingCountries // ignore: cast_nullable_to_non_nullable
              as List<String>,
      storeCountry: null == storeCountry
          ? _value.storeCountry
          : storeCountry // ignore: cast_nullable_to_non_nullable
              as String,
      pendingDomain: freezed == pendingDomain
          ? _value.pendingDomain
          : pendingDomain // ignore: cast_nullable_to_non_nullable
              as String?,
      products: null == products
          ? _value.products
          : products // ignore: cast_nullable_to_non_nullable
              as bool,
      shipping: null == shipping
          ? _value.shipping
          : shipping // ignore: cast_nullable_to_non_nullable
              as bool,
      payment: null == payment
          ? _value.payment
          : payment // ignore: cast_nullable_to_non_nullable
              as bool,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupStatusImplCopyWith<$Res>
    implements $SetupStatusCopyWith<$Res> {
  factory _$$SetupStatusImplCopyWith(
          _$SetupStatusImpl value, $Res Function(_$SetupStatusImpl) then) =
      __$$SetupStatusImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<SetupTask> tasks,
      @JsonKey(fromJson: _toInt) int percent,
      @JsonKey(name: "required_percent", fromJson: _toInt) int requiredPercent,
      @JsonKey(name: "ready_to_sell") bool readyToSell,
      @JsonKey(name: "missing_required") List<String> missingRequired,
      @JsonKey(name: "shipping_countries") List<String> shippingCountries,
      @JsonKey(name: "store_country") String storeCountry,
      @JsonKey(name: "pending_domain") String? pendingDomain,
      bool products,
      bool shipping,
      bool payment,
      bool domain});
}

/// @nodoc
class __$$SetupStatusImplCopyWithImpl<$Res>
    extends _$SetupStatusCopyWithImpl<$Res, _$SetupStatusImpl>
    implements _$$SetupStatusImplCopyWith<$Res> {
  __$$SetupStatusImplCopyWithImpl(
      _$SetupStatusImpl _value, $Res Function(_$SetupStatusImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupStatus
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tasks = null,
    Object? percent = null,
    Object? requiredPercent = null,
    Object? readyToSell = null,
    Object? missingRequired = null,
    Object? shippingCountries = null,
    Object? storeCountry = null,
    Object? pendingDomain = freezed,
    Object? products = null,
    Object? shipping = null,
    Object? payment = null,
    Object? domain = null,
  }) {
    return _then(_$SetupStatusImpl(
      tasks: null == tasks
          ? _value._tasks
          : tasks // ignore: cast_nullable_to_non_nullable
              as List<SetupTask>,
      percent: null == percent
          ? _value.percent
          : percent // ignore: cast_nullable_to_non_nullable
              as int,
      requiredPercent: null == requiredPercent
          ? _value.requiredPercent
          : requiredPercent // ignore: cast_nullable_to_non_nullable
              as int,
      readyToSell: null == readyToSell
          ? _value.readyToSell
          : readyToSell // ignore: cast_nullable_to_non_nullable
              as bool,
      missingRequired: null == missingRequired
          ? _value._missingRequired
          : missingRequired // ignore: cast_nullable_to_non_nullable
              as List<String>,
      shippingCountries: null == shippingCountries
          ? _value._shippingCountries
          : shippingCountries // ignore: cast_nullable_to_non_nullable
              as List<String>,
      storeCountry: null == storeCountry
          ? _value.storeCountry
          : storeCountry // ignore: cast_nullable_to_non_nullable
              as String,
      pendingDomain: freezed == pendingDomain
          ? _value.pendingDomain
          : pendingDomain // ignore: cast_nullable_to_non_nullable
              as String?,
      products: null == products
          ? _value.products
          : products // ignore: cast_nullable_to_non_nullable
              as bool,
      shipping: null == shipping
          ? _value.shipping
          : shipping // ignore: cast_nullable_to_non_nullable
              as bool,
      payment: null == payment
          ? _value.payment
          : payment // ignore: cast_nullable_to_non_nullable
              as bool,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupStatusImpl implements _SetupStatus {
  const _$SetupStatusImpl(
      {final List<SetupTask> tasks = const <SetupTask>[],
      @JsonKey(fromJson: _toInt) this.percent = 0,
      @JsonKey(name: "required_percent", fromJson: _toInt)
      this.requiredPercent = 0,
      @JsonKey(name: "ready_to_sell") this.readyToSell = false,
      @JsonKey(name: "missing_required")
      final List<String> missingRequired = const <String>[],
      @JsonKey(name: "shipping_countries")
      final List<String> shippingCountries = const <String>[],
      @JsonKey(name: "store_country") this.storeCountry = "us",
      @JsonKey(name: "pending_domain") this.pendingDomain,
      this.products = false,
      this.shipping = false,
      this.payment = false,
      this.domain = false})
      : _tasks = tasks,
        _missingRequired = missingRequired,
        _shippingCountries = shippingCountries;

  factory _$SetupStatusImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupStatusImplFromJson(json);

  final List<SetupTask> _tasks;
  @override
  @JsonKey()
  List<SetupTask> get tasks {
    if (_tasks is EqualUnmodifiableListView) return _tasks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tasks);
  }

  @override
  @JsonKey(fromJson: _toInt)
  final int percent;
  @override
  @JsonKey(name: "required_percent", fromJson: _toInt)
  final int requiredPercent;
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

  final List<String> _shippingCountries;
  @override
  @JsonKey(name: "shipping_countries")
  List<String> get shippingCountries {
    if (_shippingCountries is EqualUnmodifiableListView)
      return _shippingCountries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_shippingCountries);
  }

  @override
  @JsonKey(name: "store_country")
  final String storeCountry;
  @override
  @JsonKey(name: "pending_domain")
  final String? pendingDomain;
  @override
  @JsonKey()
  final bool products;
  @override
  @JsonKey()
  final bool shipping;
  @override
  @JsonKey()
  final bool payment;
  @override
  @JsonKey()
  final bool domain;

  @override
  String toString() {
    return 'SetupStatus(tasks: $tasks, percent: $percent, requiredPercent: $requiredPercent, readyToSell: $readyToSell, missingRequired: $missingRequired, shippingCountries: $shippingCountries, storeCountry: $storeCountry, pendingDomain: $pendingDomain, products: $products, shipping: $shipping, payment: $payment, domain: $domain)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupStatusImpl &&
            const DeepCollectionEquality().equals(other._tasks, _tasks) &&
            (identical(other.percent, percent) || other.percent == percent) &&
            (identical(other.requiredPercent, requiredPercent) ||
                other.requiredPercent == requiredPercent) &&
            (identical(other.readyToSell, readyToSell) ||
                other.readyToSell == readyToSell) &&
            const DeepCollectionEquality()
                .equals(other._missingRequired, _missingRequired) &&
            const DeepCollectionEquality()
                .equals(other._shippingCountries, _shippingCountries) &&
            (identical(other.storeCountry, storeCountry) ||
                other.storeCountry == storeCountry) &&
            (identical(other.pendingDomain, pendingDomain) ||
                other.pendingDomain == pendingDomain) &&
            (identical(other.products, products) ||
                other.products == products) &&
            (identical(other.shipping, shipping) ||
                other.shipping == shipping) &&
            (identical(other.payment, payment) || other.payment == payment) &&
            (identical(other.domain, domain) || other.domain == domain));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_tasks),
      percent,
      requiredPercent,
      readyToSell,
      const DeepCollectionEquality().hash(_missingRequired),
      const DeepCollectionEquality().hash(_shippingCountries),
      storeCountry,
      pendingDomain,
      products,
      shipping,
      payment,
      domain);

  /// Create a copy of SetupStatus
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupStatusImplCopyWith<_$SetupStatusImpl> get copyWith =>
      __$$SetupStatusImplCopyWithImpl<_$SetupStatusImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupStatusImplToJson(
      this,
    );
  }
}

abstract class _SetupStatus implements SetupStatus {
  const factory _SetupStatus(
      {final List<SetupTask> tasks,
      @JsonKey(fromJson: _toInt) final int percent,
      @JsonKey(name: "required_percent", fromJson: _toInt)
      final int requiredPercent,
      @JsonKey(name: "ready_to_sell") final bool readyToSell,
      @JsonKey(name: "missing_required") final List<String> missingRequired,
      @JsonKey(name: "shipping_countries") final List<String> shippingCountries,
      @JsonKey(name: "store_country") final String storeCountry,
      @JsonKey(name: "pending_domain") final String? pendingDomain,
      final bool products,
      final bool shipping,
      final bool payment,
      final bool domain}) = _$SetupStatusImpl;

  factory _SetupStatus.fromJson(Map<String, dynamic> json) =
      _$SetupStatusImpl.fromJson;

  @override
  List<SetupTask> get tasks;
  @override
  @JsonKey(fromJson: _toInt)
  int get percent;
  @override
  @JsonKey(name: "required_percent", fromJson: _toInt)
  int get requiredPercent;
  @override
  @JsonKey(name: "ready_to_sell")
  bool get readyToSell;
  @override
  @JsonKey(name: "missing_required")
  List<String> get missingRequired;
  @override
  @JsonKey(name: "shipping_countries")
  List<String> get shippingCountries;
  @override
  @JsonKey(name: "store_country")
  String get storeCountry;
  @override
  @JsonKey(name: "pending_domain")
  String? get pendingDomain;
  @override
  bool get products;
  @override
  bool get shipping;
  @override
  bool get payment;
  @override
  bool get domain;

  /// Create a copy of SetupStatus
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupStatusImplCopyWith<_$SetupStatusImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SetupDraft _$SetupDraftFromJson(Map<String, dynamic> json) {
  return _SetupDraft.fromJson(json);
}

/// @nodoc
mixin _$SetupDraft {
  @JsonKey(name: "current_step", includeIfNull: false)
  String? get currentStep => throw _privateConstructorUsedError;
  List<String> get completed => throw _privateConstructorUsedError;
  List<String> get skipped => throw _privateConstructorUsedError;
  Map<String, dynamic> get answers => throw _privateConstructorUsedError;
  @JsonKey(includeIfNull: false)
  bool? get dismissed => throw _privateConstructorUsedError;
  @JsonKey(name: "started_at", includeIfNull: false)
  String? get startedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "completed_at", includeIfNull: false)
  String? get completedAt => throw _privateConstructorUsedError;

  /// Serializes this SetupDraft to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupDraft
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupDraftCopyWith<SetupDraft> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupDraftCopyWith<$Res> {
  factory $SetupDraftCopyWith(
          SetupDraft value, $Res Function(SetupDraft) then) =
      _$SetupDraftCopyWithImpl<$Res, SetupDraft>;
  @useResult
  $Res call(
      {@JsonKey(name: "current_step", includeIfNull: false) String? currentStep,
      List<String> completed,
      List<String> skipped,
      Map<String, dynamic> answers,
      @JsonKey(includeIfNull: false) bool? dismissed,
      @JsonKey(name: "started_at", includeIfNull: false) String? startedAt,
      @JsonKey(name: "completed_at", includeIfNull: false)
      String? completedAt});
}

/// @nodoc
class _$SetupDraftCopyWithImpl<$Res, $Val extends SetupDraft>
    implements $SetupDraftCopyWith<$Res> {
  _$SetupDraftCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupDraft
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStep = freezed,
    Object? completed = null,
    Object? skipped = null,
    Object? answers = null,
    Object? dismissed = freezed,
    Object? startedAt = freezed,
    Object? completedAt = freezed,
  }) {
    return _then(_value.copyWith(
      currentStep: freezed == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as String?,
      completed: null == completed
          ? _value.completed
          : completed // ignore: cast_nullable_to_non_nullable
              as List<String>,
      skipped: null == skipped
          ? _value.skipped
          : skipped // ignore: cast_nullable_to_non_nullable
              as List<String>,
      answers: null == answers
          ? _value.answers
          : answers // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>,
      dismissed: freezed == dismissed
          ? _value.dismissed
          : dismissed // ignore: cast_nullable_to_non_nullable
              as bool?,
      startedAt: freezed == startedAt
          ? _value.startedAt
          : startedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      completedAt: freezed == completedAt
          ? _value.completedAt
          : completedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupDraftImplCopyWith<$Res>
    implements $SetupDraftCopyWith<$Res> {
  factory _$$SetupDraftImplCopyWith(
          _$SetupDraftImpl value, $Res Function(_$SetupDraftImpl) then) =
      __$$SetupDraftImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "current_step", includeIfNull: false) String? currentStep,
      List<String> completed,
      List<String> skipped,
      Map<String, dynamic> answers,
      @JsonKey(includeIfNull: false) bool? dismissed,
      @JsonKey(name: "started_at", includeIfNull: false) String? startedAt,
      @JsonKey(name: "completed_at", includeIfNull: false)
      String? completedAt});
}

/// @nodoc
class __$$SetupDraftImplCopyWithImpl<$Res>
    extends _$SetupDraftCopyWithImpl<$Res, _$SetupDraftImpl>
    implements _$$SetupDraftImplCopyWith<$Res> {
  __$$SetupDraftImplCopyWithImpl(
      _$SetupDraftImpl _value, $Res Function(_$SetupDraftImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupDraft
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStep = freezed,
    Object? completed = null,
    Object? skipped = null,
    Object? answers = null,
    Object? dismissed = freezed,
    Object? startedAt = freezed,
    Object? completedAt = freezed,
  }) {
    return _then(_$SetupDraftImpl(
      currentStep: freezed == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as String?,
      completed: null == completed
          ? _value._completed
          : completed // ignore: cast_nullable_to_non_nullable
              as List<String>,
      skipped: null == skipped
          ? _value._skipped
          : skipped // ignore: cast_nullable_to_non_nullable
              as List<String>,
      answers: null == answers
          ? _value._answers
          : answers // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>,
      dismissed: freezed == dismissed
          ? _value.dismissed
          : dismissed // ignore: cast_nullable_to_non_nullable
              as bool?,
      startedAt: freezed == startedAt
          ? _value.startedAt
          : startedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      completedAt: freezed == completedAt
          ? _value.completedAt
          : completedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupDraftImpl implements _SetupDraft {
  const _$SetupDraftImpl(
      {@JsonKey(name: "current_step", includeIfNull: false) this.currentStep,
      final List<String> completed = const <String>[],
      final List<String> skipped = const <String>[],
      final Map<String, dynamic> answers = const <String, dynamic>{},
      @JsonKey(includeIfNull: false) this.dismissed,
      @JsonKey(name: "started_at", includeIfNull: false) this.startedAt,
      @JsonKey(name: "completed_at", includeIfNull: false) this.completedAt})
      : _completed = completed,
        _skipped = skipped,
        _answers = answers;

  factory _$SetupDraftImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupDraftImplFromJson(json);

  @override
  @JsonKey(name: "current_step", includeIfNull: false)
  final String? currentStep;
  final List<String> _completed;
  @override
  @JsonKey()
  List<String> get completed {
    if (_completed is EqualUnmodifiableListView) return _completed;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_completed);
  }

  final List<String> _skipped;
  @override
  @JsonKey()
  List<String> get skipped {
    if (_skipped is EqualUnmodifiableListView) return _skipped;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_skipped);
  }

  final Map<String, dynamic> _answers;
  @override
  @JsonKey()
  Map<String, dynamic> get answers {
    if (_answers is EqualUnmodifiableMapView) return _answers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_answers);
  }

  @override
  @JsonKey(includeIfNull: false)
  final bool? dismissed;
  @override
  @JsonKey(name: "started_at", includeIfNull: false)
  final String? startedAt;
  @override
  @JsonKey(name: "completed_at", includeIfNull: false)
  final String? completedAt;

  @override
  String toString() {
    return 'SetupDraft(currentStep: $currentStep, completed: $completed, skipped: $skipped, answers: $answers, dismissed: $dismissed, startedAt: $startedAt, completedAt: $completedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupDraftImpl &&
            (identical(other.currentStep, currentStep) ||
                other.currentStep == currentStep) &&
            const DeepCollectionEquality()
                .equals(other._completed, _completed) &&
            const DeepCollectionEquality().equals(other._skipped, _skipped) &&
            const DeepCollectionEquality().equals(other._answers, _answers) &&
            (identical(other.dismissed, dismissed) ||
                other.dismissed == dismissed) &&
            (identical(other.startedAt, startedAt) ||
                other.startedAt == startedAt) &&
            (identical(other.completedAt, completedAt) ||
                other.completedAt == completedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      currentStep,
      const DeepCollectionEquality().hash(_completed),
      const DeepCollectionEquality().hash(_skipped),
      const DeepCollectionEquality().hash(_answers),
      dismissed,
      startedAt,
      completedAt);

  /// Create a copy of SetupDraft
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupDraftImplCopyWith<_$SetupDraftImpl> get copyWith =>
      __$$SetupDraftImplCopyWithImpl<_$SetupDraftImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupDraftImplToJson(
      this,
    );
  }
}

abstract class _SetupDraft implements SetupDraft {
  const factory _SetupDraft(
      {@JsonKey(name: "current_step", includeIfNull: false)
      final String? currentStep,
      final List<String> completed,
      final List<String> skipped,
      final Map<String, dynamic> answers,
      @JsonKey(includeIfNull: false) final bool? dismissed,
      @JsonKey(name: "started_at", includeIfNull: false)
      final String? startedAt,
      @JsonKey(name: "completed_at", includeIfNull: false)
      final String? completedAt}) = _$SetupDraftImpl;

  factory _SetupDraft.fromJson(Map<String, dynamic> json) =
      _$SetupDraftImpl.fromJson;

  @override
  @JsonKey(name: "current_step", includeIfNull: false)
  String? get currentStep;
  @override
  List<String> get completed;
  @override
  List<String> get skipped;
  @override
  Map<String, dynamic> get answers;
  @override
  @JsonKey(includeIfNull: false)
  bool? get dismissed;
  @override
  @JsonKey(name: "started_at", includeIfNull: false)
  String? get startedAt;
  @override
  @JsonKey(name: "completed_at", includeIfNull: false)
  String? get completedAt;

  /// Create a copy of SetupDraft
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupDraftImplCopyWith<_$SetupDraftImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SetupBusiness _$SetupBusinessFromJson(Map<String, dynamic> json) {
  return _SetupBusiness.fromJson(json);
}

/// @nodoc
mixin _$SetupBusiness {
  @JsonKey(includeIfNull: false)
  String? get type => throw _privateConstructorUsedError;
  @JsonKey(includeIfNull: false)
  String? get category => throw _privateConstructorUsedError;
  @JsonKey(includeIfNull: false)
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this SetupBusiness to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupBusiness
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupBusinessCopyWith<SetupBusiness> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupBusinessCopyWith<$Res> {
  factory $SetupBusinessCopyWith(
          SetupBusiness value, $Res Function(SetupBusiness) then) =
      _$SetupBusinessCopyWithImpl<$Res, SetupBusiness>;
  @useResult
  $Res call(
      {@JsonKey(includeIfNull: false) String? type,
      @JsonKey(includeIfNull: false) String? category,
      @JsonKey(includeIfNull: false) String? description});
}

/// @nodoc
class _$SetupBusinessCopyWithImpl<$Res, $Val extends SetupBusiness>
    implements $SetupBusinessCopyWith<$Res> {
  _$SetupBusinessCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupBusiness
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = freezed,
    Object? category = freezed,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
      category: freezed == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String?,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SetupBusinessImplCopyWith<$Res>
    implements $SetupBusinessCopyWith<$Res> {
  factory _$$SetupBusinessImplCopyWith(
          _$SetupBusinessImpl value, $Res Function(_$SetupBusinessImpl) then) =
      __$$SetupBusinessImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(includeIfNull: false) String? type,
      @JsonKey(includeIfNull: false) String? category,
      @JsonKey(includeIfNull: false) String? description});
}

/// @nodoc
class __$$SetupBusinessImplCopyWithImpl<$Res>
    extends _$SetupBusinessCopyWithImpl<$Res, _$SetupBusinessImpl>
    implements _$$SetupBusinessImplCopyWith<$Res> {
  __$$SetupBusinessImplCopyWithImpl(
      _$SetupBusinessImpl _value, $Res Function(_$SetupBusinessImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupBusiness
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = freezed,
    Object? category = freezed,
    Object? description = freezed,
  }) {
    return _then(_$SetupBusinessImpl(
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
      category: freezed == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String?,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupBusinessImpl implements _SetupBusiness {
  const _$SetupBusinessImpl(
      {@JsonKey(includeIfNull: false) this.type,
      @JsonKey(includeIfNull: false) this.category,
      @JsonKey(includeIfNull: false) this.description});

  factory _$SetupBusinessImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupBusinessImplFromJson(json);

  @override
  @JsonKey(includeIfNull: false)
  final String? type;
  @override
  @JsonKey(includeIfNull: false)
  final String? category;
  @override
  @JsonKey(includeIfNull: false)
  final String? description;

  @override
  String toString() {
    return 'SetupBusiness(type: $type, category: $category, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupBusinessImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, category, description);

  /// Create a copy of SetupBusiness
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupBusinessImplCopyWith<_$SetupBusinessImpl> get copyWith =>
      __$$SetupBusinessImplCopyWithImpl<_$SetupBusinessImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupBusinessImplToJson(
      this,
    );
  }
}

abstract class _SetupBusiness implements SetupBusiness {
  const factory _SetupBusiness(
          {@JsonKey(includeIfNull: false) final String? type,
          @JsonKey(includeIfNull: false) final String? category,
          @JsonKey(includeIfNull: false) final String? description}) =
      _$SetupBusinessImpl;

  factory _SetupBusiness.fromJson(Map<String, dynamic> json) =
      _$SetupBusinessImpl.fromJson;

  @override
  @JsonKey(includeIfNull: false)
  String? get type;
  @override
  @JsonKey(includeIfNull: false)
  String? get category;
  @override
  @JsonKey(includeIfNull: false)
  String? get description;

  /// Create a copy of SetupBusiness
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupBusinessImplCopyWith<_$SetupBusinessImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SetupSnapshot _$SetupSnapshotFromJson(Map<String, dynamic> json) {
  return _SetupSnapshot.fromJson(json);
}

/// @nodoc
mixin _$SetupSnapshot {
  String get name => throw _privateConstructorUsedError;
  @JsonKey(name: "default_country")
  String? get defaultCountry => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String get currencyCode => throw _privateConstructorUsedError;
  @JsonKey(name: "supported_currencies")
  List<String> get supportedCurrencies => throw _privateConstructorUsedError;
  SetupBusiness get business => throw _privateConstructorUsedError;
  @JsonKey(name: "logo_url")
  String? get logoUrl => throw _privateConstructorUsedError;
  SetupDraft get setup => throw _privateConstructorUsedError;
  SetupStatus? get status => throw _privateConstructorUsedError;

  /// Serializes this SetupSnapshot to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SetupSnapshotCopyWith<SetupSnapshot> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SetupSnapshotCopyWith<$Res> {
  factory $SetupSnapshotCopyWith(
          SetupSnapshot value, $Res Function(SetupSnapshot) then) =
      _$SetupSnapshotCopyWithImpl<$Res, SetupSnapshot>;
  @useResult
  $Res call(
      {String name,
      @JsonKey(name: "default_country") String? defaultCountry,
      @JsonKey(name: "currency_code") String currencyCode,
      @JsonKey(name: "supported_currencies") List<String> supportedCurrencies,
      SetupBusiness business,
      @JsonKey(name: "logo_url") String? logoUrl,
      SetupDraft setup,
      SetupStatus? status});

  $SetupBusinessCopyWith<$Res> get business;
  $SetupDraftCopyWith<$Res> get setup;
  $SetupStatusCopyWith<$Res>? get status;
}

/// @nodoc
class _$SetupSnapshotCopyWithImpl<$Res, $Val extends SetupSnapshot>
    implements $SetupSnapshotCopyWith<$Res> {
  _$SetupSnapshotCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? defaultCountry = freezed,
    Object? currencyCode = null,
    Object? supportedCurrencies = null,
    Object? business = null,
    Object? logoUrl = freezed,
    Object? setup = null,
    Object? status = freezed,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      defaultCountry: freezed == defaultCountry
          ? _value.defaultCountry
          : defaultCountry // ignore: cast_nullable_to_non_nullable
              as String?,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
      supportedCurrencies: null == supportedCurrencies
          ? _value.supportedCurrencies
          : supportedCurrencies // ignore: cast_nullable_to_non_nullable
              as List<String>,
      business: null == business
          ? _value.business
          : business // ignore: cast_nullable_to_non_nullable
              as SetupBusiness,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      setup: null == setup
          ? _value.setup
          : setup // ignore: cast_nullable_to_non_nullable
              as SetupDraft,
      status: freezed == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as SetupStatus?,
    ) as $Val);
  }

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SetupBusinessCopyWith<$Res> get business {
    return $SetupBusinessCopyWith<$Res>(_value.business, (value) {
      return _then(_value.copyWith(business: value) as $Val);
    });
  }

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SetupDraftCopyWith<$Res> get setup {
    return $SetupDraftCopyWith<$Res>(_value.setup, (value) {
      return _then(_value.copyWith(setup: value) as $Val);
    });
  }

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SetupStatusCopyWith<$Res>? get status {
    if (_value.status == null) {
      return null;
    }

    return $SetupStatusCopyWith<$Res>(_value.status!, (value) {
      return _then(_value.copyWith(status: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SetupSnapshotImplCopyWith<$Res>
    implements $SetupSnapshotCopyWith<$Res> {
  factory _$$SetupSnapshotImplCopyWith(
          _$SetupSnapshotImpl value, $Res Function(_$SetupSnapshotImpl) then) =
      __$$SetupSnapshotImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String name,
      @JsonKey(name: "default_country") String? defaultCountry,
      @JsonKey(name: "currency_code") String currencyCode,
      @JsonKey(name: "supported_currencies") List<String> supportedCurrencies,
      SetupBusiness business,
      @JsonKey(name: "logo_url") String? logoUrl,
      SetupDraft setup,
      SetupStatus? status});

  @override
  $SetupBusinessCopyWith<$Res> get business;
  @override
  $SetupDraftCopyWith<$Res> get setup;
  @override
  $SetupStatusCopyWith<$Res>? get status;
}

/// @nodoc
class __$$SetupSnapshotImplCopyWithImpl<$Res>
    extends _$SetupSnapshotCopyWithImpl<$Res, _$SetupSnapshotImpl>
    implements _$$SetupSnapshotImplCopyWith<$Res> {
  __$$SetupSnapshotImplCopyWithImpl(
      _$SetupSnapshotImpl _value, $Res Function(_$SetupSnapshotImpl) _then)
      : super(_value, _then);

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? defaultCountry = freezed,
    Object? currencyCode = null,
    Object? supportedCurrencies = null,
    Object? business = null,
    Object? logoUrl = freezed,
    Object? setup = null,
    Object? status = freezed,
  }) {
    return _then(_$SetupSnapshotImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      defaultCountry: freezed == defaultCountry
          ? _value.defaultCountry
          : defaultCountry // ignore: cast_nullable_to_non_nullable
              as String?,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
      supportedCurrencies: null == supportedCurrencies
          ? _value._supportedCurrencies
          : supportedCurrencies // ignore: cast_nullable_to_non_nullable
              as List<String>,
      business: null == business
          ? _value.business
          : business // ignore: cast_nullable_to_non_nullable
              as SetupBusiness,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      setup: null == setup
          ? _value.setup
          : setup // ignore: cast_nullable_to_non_nullable
              as SetupDraft,
      status: freezed == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as SetupStatus?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SetupSnapshotImpl implements _SetupSnapshot {
  const _$SetupSnapshotImpl(
      {this.name = "",
      @JsonKey(name: "default_country") this.defaultCountry,
      @JsonKey(name: "currency_code") this.currencyCode = "usd",
      @JsonKey(name: "supported_currencies")
      final List<String> supportedCurrencies = const <String>[],
      this.business = const SetupBusiness(),
      @JsonKey(name: "logo_url") this.logoUrl,
      this.setup = const SetupDraft(),
      this.status})
      : _supportedCurrencies = supportedCurrencies;

  factory _$SetupSnapshotImpl.fromJson(Map<String, dynamic> json) =>
      _$$SetupSnapshotImplFromJson(json);

  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey(name: "default_country")
  final String? defaultCountry;
  @override
  @JsonKey(name: "currency_code")
  final String currencyCode;
  final List<String> _supportedCurrencies;
  @override
  @JsonKey(name: "supported_currencies")
  List<String> get supportedCurrencies {
    if (_supportedCurrencies is EqualUnmodifiableListView)
      return _supportedCurrencies;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_supportedCurrencies);
  }

  @override
  @JsonKey()
  final SetupBusiness business;
  @override
  @JsonKey(name: "logo_url")
  final String? logoUrl;
  @override
  @JsonKey()
  final SetupDraft setup;
  @override
  final SetupStatus? status;

  @override
  String toString() {
    return 'SetupSnapshot(name: $name, defaultCountry: $defaultCountry, currencyCode: $currencyCode, supportedCurrencies: $supportedCurrencies, business: $business, logoUrl: $logoUrl, setup: $setup, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SetupSnapshotImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.defaultCountry, defaultCountry) ||
                other.defaultCountry == defaultCountry) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode) &&
            const DeepCollectionEquality()
                .equals(other._supportedCurrencies, _supportedCurrencies) &&
            (identical(other.business, business) ||
                other.business == business) &&
            (identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl) &&
            (identical(other.setup, setup) || other.setup == setup) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      name,
      defaultCountry,
      currencyCode,
      const DeepCollectionEquality().hash(_supportedCurrencies),
      business,
      logoUrl,
      setup,
      status);

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SetupSnapshotImplCopyWith<_$SetupSnapshotImpl> get copyWith =>
      __$$SetupSnapshotImplCopyWithImpl<_$SetupSnapshotImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SetupSnapshotImplToJson(
      this,
    );
  }
}

abstract class _SetupSnapshot implements SetupSnapshot {
  const factory _SetupSnapshot(
      {final String name,
      @JsonKey(name: "default_country") final String? defaultCountry,
      @JsonKey(name: "currency_code") final String currencyCode,
      @JsonKey(name: "supported_currencies")
      final List<String> supportedCurrencies,
      final SetupBusiness business,
      @JsonKey(name: "logo_url") final String? logoUrl,
      final SetupDraft setup,
      final SetupStatus? status}) = _$SetupSnapshotImpl;

  factory _SetupSnapshot.fromJson(Map<String, dynamic> json) =
      _$SetupSnapshotImpl.fromJson;

  @override
  String get name;
  @override
  @JsonKey(name: "default_country")
  String? get defaultCountry;
  @override
  @JsonKey(name: "currency_code")
  String get currencyCode;
  @override
  @JsonKey(name: "supported_currencies")
  List<String> get supportedCurrencies;
  @override
  SetupBusiness get business;
  @override
  @JsonKey(name: "logo_url")
  String? get logoUrl;
  @override
  SetupDraft get setup;
  @override
  SetupStatus? get status;

  /// Create a copy of SetupSnapshot
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SetupSnapshotImplCopyWith<_$SetupSnapshotImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
