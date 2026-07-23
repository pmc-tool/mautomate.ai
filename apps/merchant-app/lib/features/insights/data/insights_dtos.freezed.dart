// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'insights_dtos.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

MetricPoint _$MetricPointFromJson(Map<String, dynamic> json) {
  return _MetricPoint.fromJson(json);
}

/// @nodoc
mixin _$MetricPoint {
  @JsonKey(fromJson: _asString)
  String get x => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get y => throw _privateConstructorUsedError;

  /// Serializes this MetricPoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MetricPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MetricPointCopyWith<MetricPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MetricPointCopyWith<$Res> {
  factory $MetricPointCopyWith(
          MetricPoint value, $Res Function(MetricPoint) then) =
      _$MetricPointCopyWithImpl<$Res, MetricPoint>;
  @useResult
  $Res call(
      {@JsonKey(fromJson: _asString) String x,
      @JsonKey(fromJson: _asNum) num y});
}

/// @nodoc
class _$MetricPointCopyWithImpl<$Res, $Val extends MetricPoint>
    implements $MetricPointCopyWith<$Res> {
  _$MetricPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MetricPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? x = null,
    Object? y = null,
  }) {
    return _then(_value.copyWith(
      x: null == x
          ? _value.x
          : x // ignore: cast_nullable_to_non_nullable
              as String,
      y: null == y
          ? _value.y
          : y // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MetricPointImplCopyWith<$Res>
    implements $MetricPointCopyWith<$Res> {
  factory _$$MetricPointImplCopyWith(
          _$MetricPointImpl value, $Res Function(_$MetricPointImpl) then) =
      __$$MetricPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(fromJson: _asString) String x,
      @JsonKey(fromJson: _asNum) num y});
}

/// @nodoc
class __$$MetricPointImplCopyWithImpl<$Res>
    extends _$MetricPointCopyWithImpl<$Res, _$MetricPointImpl>
    implements _$$MetricPointImplCopyWith<$Res> {
  __$$MetricPointImplCopyWithImpl(
      _$MetricPointImpl _value, $Res Function(_$MetricPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of MetricPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? x = null,
    Object? y = null,
  }) {
    return _then(_$MetricPointImpl(
      x: null == x
          ? _value.x
          : x // ignore: cast_nullable_to_non_nullable
              as String,
      y: null == y
          ? _value.y
          : y // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MetricPointImpl implements _MetricPoint {
  const _$MetricPointImpl(
      {@JsonKey(fromJson: _asString) this.x = "",
      @JsonKey(fromJson: _asNum) this.y = 0});

  factory _$MetricPointImpl.fromJson(Map<String, dynamic> json) =>
      _$$MetricPointImplFromJson(json);

  @override
  @JsonKey(fromJson: _asString)
  final String x;
  @override
  @JsonKey(fromJson: _asNum)
  final num y;

  @override
  String toString() {
    return 'MetricPoint(x: $x, y: $y)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MetricPointImpl &&
            (identical(other.x, x) || other.x == x) &&
            (identical(other.y, y) || other.y == y));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, x, y);

  /// Create a copy of MetricPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MetricPointImplCopyWith<_$MetricPointImpl> get copyWith =>
      __$$MetricPointImplCopyWithImpl<_$MetricPointImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MetricPointImplToJson(
      this,
    );
  }
}

abstract class _MetricPoint implements MetricPoint {
  const factory _MetricPoint(
      {@JsonKey(fromJson: _asString) final String x,
      @JsonKey(fromJson: _asNum) final num y}) = _$MetricPointImpl;

  factory _MetricPoint.fromJson(Map<String, dynamic> json) =
      _$MetricPointImpl.fromJson;

  @override
  @JsonKey(fromJson: _asString)
  String get x;
  @override
  @JsonKey(fromJson: _asNum)
  num get y;

  /// Create a copy of MetricPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MetricPointImplCopyWith<_$MetricPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AnalyticsStatsDto _$AnalyticsStatsDtoFromJson(Map<String, dynamic> json) {
  return _AnalyticsStatsDto.fromJson(json);
}

/// @nodoc
mixin _$AnalyticsStatsDto {
  @JsonKey(fromJson: _asNum)
  num get pageviews => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get visitors => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get visits => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get bounces => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get totaltime => throw _privateConstructorUsedError;

  /// Serializes this AnalyticsStatsDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AnalyticsStatsDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AnalyticsStatsDtoCopyWith<AnalyticsStatsDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AnalyticsStatsDtoCopyWith<$Res> {
  factory $AnalyticsStatsDtoCopyWith(
          AnalyticsStatsDto value, $Res Function(AnalyticsStatsDto) then) =
      _$AnalyticsStatsDtoCopyWithImpl<$Res, AnalyticsStatsDto>;
  @useResult
  $Res call(
      {@JsonKey(fromJson: _asNum) num pageviews,
      @JsonKey(fromJson: _asNum) num visitors,
      @JsonKey(fromJson: _asNum) num visits,
      @JsonKey(fromJson: _asNum) num bounces,
      @JsonKey(fromJson: _asNum) num totaltime});
}

/// @nodoc
class _$AnalyticsStatsDtoCopyWithImpl<$Res, $Val extends AnalyticsStatsDto>
    implements $AnalyticsStatsDtoCopyWith<$Res> {
  _$AnalyticsStatsDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AnalyticsStatsDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? pageviews = null,
    Object? visitors = null,
    Object? visits = null,
    Object? bounces = null,
    Object? totaltime = null,
  }) {
    return _then(_value.copyWith(
      pageviews: null == pageviews
          ? _value.pageviews
          : pageviews // ignore: cast_nullable_to_non_nullable
              as num,
      visitors: null == visitors
          ? _value.visitors
          : visitors // ignore: cast_nullable_to_non_nullable
              as num,
      visits: null == visits
          ? _value.visits
          : visits // ignore: cast_nullable_to_non_nullable
              as num,
      bounces: null == bounces
          ? _value.bounces
          : bounces // ignore: cast_nullable_to_non_nullable
              as num,
      totaltime: null == totaltime
          ? _value.totaltime
          : totaltime // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AnalyticsStatsDtoImplCopyWith<$Res>
    implements $AnalyticsStatsDtoCopyWith<$Res> {
  factory _$$AnalyticsStatsDtoImplCopyWith(_$AnalyticsStatsDtoImpl value,
          $Res Function(_$AnalyticsStatsDtoImpl) then) =
      __$$AnalyticsStatsDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(fromJson: _asNum) num pageviews,
      @JsonKey(fromJson: _asNum) num visitors,
      @JsonKey(fromJson: _asNum) num visits,
      @JsonKey(fromJson: _asNum) num bounces,
      @JsonKey(fromJson: _asNum) num totaltime});
}

/// @nodoc
class __$$AnalyticsStatsDtoImplCopyWithImpl<$Res>
    extends _$AnalyticsStatsDtoCopyWithImpl<$Res, _$AnalyticsStatsDtoImpl>
    implements _$$AnalyticsStatsDtoImplCopyWith<$Res> {
  __$$AnalyticsStatsDtoImplCopyWithImpl(_$AnalyticsStatsDtoImpl _value,
      $Res Function(_$AnalyticsStatsDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of AnalyticsStatsDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? pageviews = null,
    Object? visitors = null,
    Object? visits = null,
    Object? bounces = null,
    Object? totaltime = null,
  }) {
    return _then(_$AnalyticsStatsDtoImpl(
      pageviews: null == pageviews
          ? _value.pageviews
          : pageviews // ignore: cast_nullable_to_non_nullable
              as num,
      visitors: null == visitors
          ? _value.visitors
          : visitors // ignore: cast_nullable_to_non_nullable
              as num,
      visits: null == visits
          ? _value.visits
          : visits // ignore: cast_nullable_to_non_nullable
              as num,
      bounces: null == bounces
          ? _value.bounces
          : bounces // ignore: cast_nullable_to_non_nullable
              as num,
      totaltime: null == totaltime
          ? _value.totaltime
          : totaltime // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AnalyticsStatsDtoImpl implements _AnalyticsStatsDto {
  const _$AnalyticsStatsDtoImpl(
      {@JsonKey(fromJson: _asNum) this.pageviews = 0,
      @JsonKey(fromJson: _asNum) this.visitors = 0,
      @JsonKey(fromJson: _asNum) this.visits = 0,
      @JsonKey(fromJson: _asNum) this.bounces = 0,
      @JsonKey(fromJson: _asNum) this.totaltime = 0});

  factory _$AnalyticsStatsDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$AnalyticsStatsDtoImplFromJson(json);

  @override
  @JsonKey(fromJson: _asNum)
  final num pageviews;
  @override
  @JsonKey(fromJson: _asNum)
  final num visitors;
  @override
  @JsonKey(fromJson: _asNum)
  final num visits;
  @override
  @JsonKey(fromJson: _asNum)
  final num bounces;
  @override
  @JsonKey(fromJson: _asNum)
  final num totaltime;

  @override
  String toString() {
    return 'AnalyticsStatsDto(pageviews: $pageviews, visitors: $visitors, visits: $visits, bounces: $bounces, totaltime: $totaltime)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AnalyticsStatsDtoImpl &&
            (identical(other.pageviews, pageviews) ||
                other.pageviews == pageviews) &&
            (identical(other.visitors, visitors) ||
                other.visitors == visitors) &&
            (identical(other.visits, visits) || other.visits == visits) &&
            (identical(other.bounces, bounces) || other.bounces == bounces) &&
            (identical(other.totaltime, totaltime) ||
                other.totaltime == totaltime));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, pageviews, visitors, visits, bounces, totaltime);

  /// Create a copy of AnalyticsStatsDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AnalyticsStatsDtoImplCopyWith<_$AnalyticsStatsDtoImpl> get copyWith =>
      __$$AnalyticsStatsDtoImplCopyWithImpl<_$AnalyticsStatsDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AnalyticsStatsDtoImplToJson(
      this,
    );
  }
}

abstract class _AnalyticsStatsDto implements AnalyticsStatsDto {
  const factory _AnalyticsStatsDto(
          {@JsonKey(fromJson: _asNum) final num pageviews,
          @JsonKey(fromJson: _asNum) final num visitors,
          @JsonKey(fromJson: _asNum) final num visits,
          @JsonKey(fromJson: _asNum) final num bounces,
          @JsonKey(fromJson: _asNum) final num totaltime}) =
      _$AnalyticsStatsDtoImpl;

  factory _AnalyticsStatsDto.fromJson(Map<String, dynamic> json) =
      _$AnalyticsStatsDtoImpl.fromJson;

  @override
  @JsonKey(fromJson: _asNum)
  num get pageviews;
  @override
  @JsonKey(fromJson: _asNum)
  num get visitors;
  @override
  @JsonKey(fromJson: _asNum)
  num get visits;
  @override
  @JsonKey(fromJson: _asNum)
  num get bounces;
  @override
  @JsonKey(fromJson: _asNum)
  num get totaltime;

  /// Create a copy of AnalyticsStatsDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AnalyticsStatsDtoImplCopyWith<_$AnalyticsStatsDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AnalyticsTopDto _$AnalyticsTopDtoFromJson(Map<String, dynamic> json) {
  return _AnalyticsTopDto.fromJson(json);
}

/// @nodoc
mixin _$AnalyticsTopDto {
  List<MetricPoint> get pages => throw _privateConstructorUsedError;
  List<MetricPoint> get referrers => throw _privateConstructorUsedError;
  List<MetricPoint> get countries => throw _privateConstructorUsedError;
  List<MetricPoint> get devices => throw _privateConstructorUsedError;

  /// Serializes this AnalyticsTopDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AnalyticsTopDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AnalyticsTopDtoCopyWith<AnalyticsTopDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AnalyticsTopDtoCopyWith<$Res> {
  factory $AnalyticsTopDtoCopyWith(
          AnalyticsTopDto value, $Res Function(AnalyticsTopDto) then) =
      _$AnalyticsTopDtoCopyWithImpl<$Res, AnalyticsTopDto>;
  @useResult
  $Res call(
      {List<MetricPoint> pages,
      List<MetricPoint> referrers,
      List<MetricPoint> countries,
      List<MetricPoint> devices});
}

/// @nodoc
class _$AnalyticsTopDtoCopyWithImpl<$Res, $Val extends AnalyticsTopDto>
    implements $AnalyticsTopDtoCopyWith<$Res> {
  _$AnalyticsTopDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AnalyticsTopDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? pages = null,
    Object? referrers = null,
    Object? countries = null,
    Object? devices = null,
  }) {
    return _then(_value.copyWith(
      pages: null == pages
          ? _value.pages
          : pages // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
      referrers: null == referrers
          ? _value.referrers
          : referrers // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
      countries: null == countries
          ? _value.countries
          : countries // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
      devices: null == devices
          ? _value.devices
          : devices // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AnalyticsTopDtoImplCopyWith<$Res>
    implements $AnalyticsTopDtoCopyWith<$Res> {
  factory _$$AnalyticsTopDtoImplCopyWith(_$AnalyticsTopDtoImpl value,
          $Res Function(_$AnalyticsTopDtoImpl) then) =
      __$$AnalyticsTopDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<MetricPoint> pages,
      List<MetricPoint> referrers,
      List<MetricPoint> countries,
      List<MetricPoint> devices});
}

/// @nodoc
class __$$AnalyticsTopDtoImplCopyWithImpl<$Res>
    extends _$AnalyticsTopDtoCopyWithImpl<$Res, _$AnalyticsTopDtoImpl>
    implements _$$AnalyticsTopDtoImplCopyWith<$Res> {
  __$$AnalyticsTopDtoImplCopyWithImpl(
      _$AnalyticsTopDtoImpl _value, $Res Function(_$AnalyticsTopDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of AnalyticsTopDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? pages = null,
    Object? referrers = null,
    Object? countries = null,
    Object? devices = null,
  }) {
    return _then(_$AnalyticsTopDtoImpl(
      pages: null == pages
          ? _value._pages
          : pages // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
      referrers: null == referrers
          ? _value._referrers
          : referrers // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
      countries: null == countries
          ? _value._countries
          : countries // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
      devices: null == devices
          ? _value._devices
          : devices // ignore: cast_nullable_to_non_nullable
              as List<MetricPoint>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AnalyticsTopDtoImpl implements _AnalyticsTopDto {
  const _$AnalyticsTopDtoImpl(
      {final List<MetricPoint> pages = const <MetricPoint>[],
      final List<MetricPoint> referrers = const <MetricPoint>[],
      final List<MetricPoint> countries = const <MetricPoint>[],
      final List<MetricPoint> devices = const <MetricPoint>[]})
      : _pages = pages,
        _referrers = referrers,
        _countries = countries,
        _devices = devices;

  factory _$AnalyticsTopDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$AnalyticsTopDtoImplFromJson(json);

  final List<MetricPoint> _pages;
  @override
  @JsonKey()
  List<MetricPoint> get pages {
    if (_pages is EqualUnmodifiableListView) return _pages;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_pages);
  }

  final List<MetricPoint> _referrers;
  @override
  @JsonKey()
  List<MetricPoint> get referrers {
    if (_referrers is EqualUnmodifiableListView) return _referrers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_referrers);
  }

  final List<MetricPoint> _countries;
  @override
  @JsonKey()
  List<MetricPoint> get countries {
    if (_countries is EqualUnmodifiableListView) return _countries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_countries);
  }

  final List<MetricPoint> _devices;
  @override
  @JsonKey()
  List<MetricPoint> get devices {
    if (_devices is EqualUnmodifiableListView) return _devices;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_devices);
  }

  @override
  String toString() {
    return 'AnalyticsTopDto(pages: $pages, referrers: $referrers, countries: $countries, devices: $devices)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AnalyticsTopDtoImpl &&
            const DeepCollectionEquality().equals(other._pages, _pages) &&
            const DeepCollectionEquality()
                .equals(other._referrers, _referrers) &&
            const DeepCollectionEquality()
                .equals(other._countries, _countries) &&
            const DeepCollectionEquality().equals(other._devices, _devices));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_pages),
      const DeepCollectionEquality().hash(_referrers),
      const DeepCollectionEquality().hash(_countries),
      const DeepCollectionEquality().hash(_devices));

  /// Create a copy of AnalyticsTopDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AnalyticsTopDtoImplCopyWith<_$AnalyticsTopDtoImpl> get copyWith =>
      __$$AnalyticsTopDtoImplCopyWithImpl<_$AnalyticsTopDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AnalyticsTopDtoImplToJson(
      this,
    );
  }
}

abstract class _AnalyticsTopDto implements AnalyticsTopDto {
  const factory _AnalyticsTopDto(
      {final List<MetricPoint> pages,
      final List<MetricPoint> referrers,
      final List<MetricPoint> countries,
      final List<MetricPoint> devices}) = _$AnalyticsTopDtoImpl;

  factory _AnalyticsTopDto.fromJson(Map<String, dynamic> json) =
      _$AnalyticsTopDtoImpl.fromJson;

  @override
  List<MetricPoint> get pages;
  @override
  List<MetricPoint> get referrers;
  @override
  List<MetricPoint> get countries;
  @override
  List<MetricPoint> get devices;

  /// Create a copy of AnalyticsTopDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AnalyticsTopDtoImplCopyWith<_$AnalyticsTopDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MerchantAnalyticsDto _$MerchantAnalyticsDtoFromJson(Map<String, dynamic> json) {
  return _MerchantAnalyticsDto.fromJson(json);
}

/// @nodoc
mixin _$MerchantAnalyticsDto {
  bool get enabled => throw _privateConstructorUsedError;
  String? get range => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get realtime => throw _privateConstructorUsedError;
  AnalyticsStatsDto? get stats => throw _privateConstructorUsedError;
  AnalyticsTopDto? get top => throw _privateConstructorUsedError;

  /// Serializes this MerchantAnalyticsDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MerchantAnalyticsDtoCopyWith<MerchantAnalyticsDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MerchantAnalyticsDtoCopyWith<$Res> {
  factory $MerchantAnalyticsDtoCopyWith(MerchantAnalyticsDto value,
          $Res Function(MerchantAnalyticsDto) then) =
      _$MerchantAnalyticsDtoCopyWithImpl<$Res, MerchantAnalyticsDto>;
  @useResult
  $Res call(
      {bool enabled,
      String? range,
      @JsonKey(fromJson: _asNum) num realtime,
      AnalyticsStatsDto? stats,
      AnalyticsTopDto? top});

  $AnalyticsStatsDtoCopyWith<$Res>? get stats;
  $AnalyticsTopDtoCopyWith<$Res>? get top;
}

/// @nodoc
class _$MerchantAnalyticsDtoCopyWithImpl<$Res,
        $Val extends MerchantAnalyticsDto>
    implements $MerchantAnalyticsDtoCopyWith<$Res> {
  _$MerchantAnalyticsDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? enabled = null,
    Object? range = freezed,
    Object? realtime = null,
    Object? stats = freezed,
    Object? top = freezed,
  }) {
    return _then(_value.copyWith(
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      range: freezed == range
          ? _value.range
          : range // ignore: cast_nullable_to_non_nullable
              as String?,
      realtime: null == realtime
          ? _value.realtime
          : realtime // ignore: cast_nullable_to_non_nullable
              as num,
      stats: freezed == stats
          ? _value.stats
          : stats // ignore: cast_nullable_to_non_nullable
              as AnalyticsStatsDto?,
      top: freezed == top
          ? _value.top
          : top // ignore: cast_nullable_to_non_nullable
              as AnalyticsTopDto?,
    ) as $Val);
  }

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AnalyticsStatsDtoCopyWith<$Res>? get stats {
    if (_value.stats == null) {
      return null;
    }

    return $AnalyticsStatsDtoCopyWith<$Res>(_value.stats!, (value) {
      return _then(_value.copyWith(stats: value) as $Val);
    });
  }

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AnalyticsTopDtoCopyWith<$Res>? get top {
    if (_value.top == null) {
      return null;
    }

    return $AnalyticsTopDtoCopyWith<$Res>(_value.top!, (value) {
      return _then(_value.copyWith(top: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$MerchantAnalyticsDtoImplCopyWith<$Res>
    implements $MerchantAnalyticsDtoCopyWith<$Res> {
  factory _$$MerchantAnalyticsDtoImplCopyWith(_$MerchantAnalyticsDtoImpl value,
          $Res Function(_$MerchantAnalyticsDtoImpl) then) =
      __$$MerchantAnalyticsDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {bool enabled,
      String? range,
      @JsonKey(fromJson: _asNum) num realtime,
      AnalyticsStatsDto? stats,
      AnalyticsTopDto? top});

  @override
  $AnalyticsStatsDtoCopyWith<$Res>? get stats;
  @override
  $AnalyticsTopDtoCopyWith<$Res>? get top;
}

/// @nodoc
class __$$MerchantAnalyticsDtoImplCopyWithImpl<$Res>
    extends _$MerchantAnalyticsDtoCopyWithImpl<$Res, _$MerchantAnalyticsDtoImpl>
    implements _$$MerchantAnalyticsDtoImplCopyWith<$Res> {
  __$$MerchantAnalyticsDtoImplCopyWithImpl(_$MerchantAnalyticsDtoImpl _value,
      $Res Function(_$MerchantAnalyticsDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? enabled = null,
    Object? range = freezed,
    Object? realtime = null,
    Object? stats = freezed,
    Object? top = freezed,
  }) {
    return _then(_$MerchantAnalyticsDtoImpl(
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      range: freezed == range
          ? _value.range
          : range // ignore: cast_nullable_to_non_nullable
              as String?,
      realtime: null == realtime
          ? _value.realtime
          : realtime // ignore: cast_nullable_to_non_nullable
              as num,
      stats: freezed == stats
          ? _value.stats
          : stats // ignore: cast_nullable_to_non_nullable
              as AnalyticsStatsDto?,
      top: freezed == top
          ? _value.top
          : top // ignore: cast_nullable_to_non_nullable
              as AnalyticsTopDto?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MerchantAnalyticsDtoImpl implements _MerchantAnalyticsDto {
  const _$MerchantAnalyticsDtoImpl(
      {this.enabled = false,
      this.range,
      @JsonKey(fromJson: _asNum) this.realtime = 0,
      this.stats,
      this.top});

  factory _$MerchantAnalyticsDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$MerchantAnalyticsDtoImplFromJson(json);

  @override
  @JsonKey()
  final bool enabled;
  @override
  final String? range;
  @override
  @JsonKey(fromJson: _asNum)
  final num realtime;
  @override
  final AnalyticsStatsDto? stats;
  @override
  final AnalyticsTopDto? top;

  @override
  String toString() {
    return 'MerchantAnalyticsDto(enabled: $enabled, range: $range, realtime: $realtime, stats: $stats, top: $top)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MerchantAnalyticsDtoImpl &&
            (identical(other.enabled, enabled) || other.enabled == enabled) &&
            (identical(other.range, range) || other.range == range) &&
            (identical(other.realtime, realtime) ||
                other.realtime == realtime) &&
            (identical(other.stats, stats) || other.stats == stats) &&
            (identical(other.top, top) || other.top == top));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, enabled, range, realtime, stats, top);

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MerchantAnalyticsDtoImplCopyWith<_$MerchantAnalyticsDtoImpl>
      get copyWith =>
          __$$MerchantAnalyticsDtoImplCopyWithImpl<_$MerchantAnalyticsDtoImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MerchantAnalyticsDtoImplToJson(
      this,
    );
  }
}

abstract class _MerchantAnalyticsDto implements MerchantAnalyticsDto {
  const factory _MerchantAnalyticsDto(
      {final bool enabled,
      final String? range,
      @JsonKey(fromJson: _asNum) final num realtime,
      final AnalyticsStatsDto? stats,
      final AnalyticsTopDto? top}) = _$MerchantAnalyticsDtoImpl;

  factory _MerchantAnalyticsDto.fromJson(Map<String, dynamic> json) =
      _$MerchantAnalyticsDtoImpl.fromJson;

  @override
  bool get enabled;
  @override
  String? get range;
  @override
  @JsonKey(fromJson: _asNum)
  num get realtime;
  @override
  AnalyticsStatsDto? get stats;
  @override
  AnalyticsTopDto? get top;

  /// Create a copy of MerchantAnalyticsDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MerchantAnalyticsDtoImplCopyWith<_$MerchantAnalyticsDtoImpl>
      get copyWith => throw _privateConstructorUsedError;
}

InsightsOrderDto _$InsightsOrderDtoFromJson(Map<String, dynamic> json) {
  return _InsightsOrderDto.fromJson(json);
}

/// @nodoc
mixin _$InsightsOrderDto {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _asNum)
  num get total => throw _privateConstructorUsedError;
  @JsonKey(name: "currency_code")
  String get currencyCode => throw _privateConstructorUsedError;

  /// Serializes this InsightsOrderDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InsightsOrderDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InsightsOrderDtoCopyWith<InsightsOrderDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InsightsOrderDtoCopyWith<$Res> {
  factory $InsightsOrderDtoCopyWith(
          InsightsOrderDto value, $Res Function(InsightsOrderDto) then) =
      _$InsightsOrderDtoCopyWithImpl<$Res, InsightsOrderDto>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(fromJson: _asNum) num total,
      @JsonKey(name: "currency_code") String currencyCode});
}

/// @nodoc
class _$InsightsOrderDtoCopyWithImpl<$Res, $Val extends InsightsOrderDto>
    implements $InsightsOrderDtoCopyWith<$Res> {
  _$InsightsOrderDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InsightsOrderDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? createdAt = freezed,
    Object? total = null,
    Object? currencyCode = null,
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
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as num,
      currencyCode: null == currencyCode
          ? _value.currencyCode
          : currencyCode // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$InsightsOrderDtoImplCopyWith<$Res>
    implements $InsightsOrderDtoCopyWith<$Res> {
  factory _$$InsightsOrderDtoImplCopyWith(_$InsightsOrderDtoImpl value,
          $Res Function(_$InsightsOrderDtoImpl) then) =
      __$$InsightsOrderDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "created_at") String? createdAt,
      @JsonKey(fromJson: _asNum) num total,
      @JsonKey(name: "currency_code") String currencyCode});
}

/// @nodoc
class __$$InsightsOrderDtoImplCopyWithImpl<$Res>
    extends _$InsightsOrderDtoCopyWithImpl<$Res, _$InsightsOrderDtoImpl>
    implements _$$InsightsOrderDtoImplCopyWith<$Res> {
  __$$InsightsOrderDtoImplCopyWithImpl(_$InsightsOrderDtoImpl _value,
      $Res Function(_$InsightsOrderDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of InsightsOrderDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? createdAt = freezed,
    Object? total = null,
    Object? currencyCode = null,
  }) {
    return _then(_$InsightsOrderDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InsightsOrderDtoImpl implements _InsightsOrderDto {
  const _$InsightsOrderDtoImpl(
      {this.id = "",
      @JsonKey(name: "created_at") this.createdAt,
      @JsonKey(fromJson: _asNum) this.total = 0,
      @JsonKey(name: "currency_code") this.currencyCode = "usd"});

  factory _$InsightsOrderDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$InsightsOrderDtoImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;
  @override
  @JsonKey(fromJson: _asNum)
  final num total;
  @override
  @JsonKey(name: "currency_code")
  final String currencyCode;

  @override
  String toString() {
    return 'InsightsOrderDto(id: $id, createdAt: $createdAt, total: $total, currencyCode: $currencyCode)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InsightsOrderDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.currencyCode, currencyCode) ||
                other.currencyCode == currencyCode));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, createdAt, total, currencyCode);

  /// Create a copy of InsightsOrderDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InsightsOrderDtoImplCopyWith<_$InsightsOrderDtoImpl> get copyWith =>
      __$$InsightsOrderDtoImplCopyWithImpl<_$InsightsOrderDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InsightsOrderDtoImplToJson(
      this,
    );
  }
}

abstract class _InsightsOrderDto implements InsightsOrderDto {
  const factory _InsightsOrderDto(
          {final String id,
          @JsonKey(name: "created_at") final String? createdAt,
          @JsonKey(fromJson: _asNum) final num total,
          @JsonKey(name: "currency_code") final String currencyCode}) =
      _$InsightsOrderDtoImpl;

  factory _InsightsOrderDto.fromJson(Map<String, dynamic> json) =
      _$InsightsOrderDtoImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;
  @override
  @JsonKey(fromJson: _asNum)
  num get total;
  @override
  @JsonKey(name: "currency_code")
  String get currencyCode;

  /// Create a copy of InsightsOrderDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InsightsOrderDtoImplCopyWith<_$InsightsOrderDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InsightsProductDto _$InsightsProductDtoFromJson(Map<String, dynamic> json) {
  return _InsightsProductDto.fromJson(json);
}

/// @nodoc
mixin _$InsightsProductDto {
  String get id => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;

  /// Serializes this InsightsProductDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InsightsProductDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InsightsProductDtoCopyWith<InsightsProductDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InsightsProductDtoCopyWith<$Res> {
  factory $InsightsProductDtoCopyWith(
          InsightsProductDto value, $Res Function(InsightsProductDto) then) =
      _$InsightsProductDtoCopyWithImpl<$Res, InsightsProductDto>;
  @useResult
  $Res call({String id, String status, Map<String, dynamic>? metadata});
}

/// @nodoc
class _$InsightsProductDtoCopyWithImpl<$Res, $Val extends InsightsProductDto>
    implements $InsightsProductDtoCopyWith<$Res> {
  _$InsightsProductDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InsightsProductDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? metadata = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      metadata: freezed == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$InsightsProductDtoImplCopyWith<$Res>
    implements $InsightsProductDtoCopyWith<$Res> {
  factory _$$InsightsProductDtoImplCopyWith(_$InsightsProductDtoImpl value,
          $Res Function(_$InsightsProductDtoImpl) then) =
      __$$InsightsProductDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String status, Map<String, dynamic>? metadata});
}

/// @nodoc
class __$$InsightsProductDtoImplCopyWithImpl<$Res>
    extends _$InsightsProductDtoCopyWithImpl<$Res, _$InsightsProductDtoImpl>
    implements _$$InsightsProductDtoImplCopyWith<$Res> {
  __$$InsightsProductDtoImplCopyWithImpl(_$InsightsProductDtoImpl _value,
      $Res Function(_$InsightsProductDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of InsightsProductDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? metadata = freezed,
  }) {
    return _then(_$InsightsProductDtoImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      metadata: freezed == metadata
          ? _value._metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InsightsProductDtoImpl implements _InsightsProductDto {
  const _$InsightsProductDtoImpl(
      {this.id = "", this.status = "", final Map<String, dynamic>? metadata})
      : _metadata = metadata;

  factory _$InsightsProductDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$InsightsProductDtoImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String status;
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
    return 'InsightsProductDto(id: $id, status: $status, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InsightsProductDtoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.status, status) || other.status == status) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, status, const DeepCollectionEquality().hash(_metadata));

  /// Create a copy of InsightsProductDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InsightsProductDtoImplCopyWith<_$InsightsProductDtoImpl> get copyWith =>
      __$$InsightsProductDtoImplCopyWithImpl<_$InsightsProductDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InsightsProductDtoImplToJson(
      this,
    );
  }
}

abstract class _InsightsProductDto implements InsightsProductDto {
  const factory _InsightsProductDto(
      {final String id,
      final String status,
      final Map<String, dynamic>? metadata}) = _$InsightsProductDtoImpl;

  factory _InsightsProductDto.fromJson(Map<String, dynamic> json) =
      _$InsightsProductDtoImpl.fromJson;

  @override
  String get id;
  @override
  String get status;
  @override
  Map<String, dynamic>? get metadata;

  /// Create a copy of InsightsProductDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InsightsProductDtoImplCopyWith<_$InsightsProductDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
