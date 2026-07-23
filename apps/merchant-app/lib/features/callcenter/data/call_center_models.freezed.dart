// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'call_center_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

CallsToday _$CallsTodayFromJson(Map<String, dynamic> json) {
  return _CallsToday.fromJson(json);
}

/// @nodoc
mixin _$CallsToday {
  int get total => throw _privateConstructorUsedError;
  @JsonKey(name: "by_status")
  Map<String, num> get byStatus => throw _privateConstructorUsedError;

  /// Serializes this CallsToday to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallsToday
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallsTodayCopyWith<CallsToday> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallsTodayCopyWith<$Res> {
  factory $CallsTodayCopyWith(
          CallsToday value, $Res Function(CallsToday) then) =
      _$CallsTodayCopyWithImpl<$Res, CallsToday>;
  @useResult
  $Res call({int total, @JsonKey(name: "by_status") Map<String, num> byStatus});
}

/// @nodoc
class _$CallsTodayCopyWithImpl<$Res, $Val extends CallsToday>
    implements $CallsTodayCopyWith<$Res> {
  _$CallsTodayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallsToday
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? byStatus = null,
  }) {
    return _then(_value.copyWith(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      byStatus: null == byStatus
          ? _value.byStatus
          : byStatus // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallsTodayImplCopyWith<$Res>
    implements $CallsTodayCopyWith<$Res> {
  factory _$$CallsTodayImplCopyWith(
          _$CallsTodayImpl value, $Res Function(_$CallsTodayImpl) then) =
      __$$CallsTodayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int total, @JsonKey(name: "by_status") Map<String, num> byStatus});
}

/// @nodoc
class __$$CallsTodayImplCopyWithImpl<$Res>
    extends _$CallsTodayCopyWithImpl<$Res, _$CallsTodayImpl>
    implements _$$CallsTodayImplCopyWith<$Res> {
  __$$CallsTodayImplCopyWithImpl(
      _$CallsTodayImpl _value, $Res Function(_$CallsTodayImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallsToday
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? byStatus = null,
  }) {
    return _then(_$CallsTodayImpl(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      byStatus: null == byStatus
          ? _value._byStatus
          : byStatus // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallsTodayImpl implements _CallsToday {
  const _$CallsTodayImpl(
      {this.total = 0,
      @JsonKey(name: "by_status")
      final Map<String, num> byStatus = const <String, num>{}})
      : _byStatus = byStatus;

  factory _$CallsTodayImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallsTodayImplFromJson(json);

  @override
  @JsonKey()
  final int total;
  final Map<String, num> _byStatus;
  @override
  @JsonKey(name: "by_status")
  Map<String, num> get byStatus {
    if (_byStatus is EqualUnmodifiableMapView) return _byStatus;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_byStatus);
  }

  @override
  String toString() {
    return 'CallsToday(total: $total, byStatus: $byStatus)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallsTodayImpl &&
            (identical(other.total, total) || other.total == total) &&
            const DeepCollectionEquality().equals(other._byStatus, _byStatus));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, total, const DeepCollectionEquality().hash(_byStatus));

  /// Create a copy of CallsToday
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallsTodayImplCopyWith<_$CallsTodayImpl> get copyWith =>
      __$$CallsTodayImplCopyWithImpl<_$CallsTodayImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallsTodayImplToJson(
      this,
    );
  }
}

abstract class _CallsToday implements CallsToday {
  const factory _CallsToday(
          {final int total,
          @JsonKey(name: "by_status") final Map<String, num> byStatus}) =
      _$CallsTodayImpl;

  factory _CallsToday.fromJson(Map<String, dynamic> json) =
      _$CallsTodayImpl.fromJson;

  @override
  int get total;
  @override
  @JsonKey(name: "by_status")
  Map<String, num> get byStatus;

  /// Create a copy of CallsToday
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallsTodayImplCopyWith<_$CallsTodayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallCenterDashboard _$CallCenterDashboardFromJson(Map<String, dynamic> json) {
  return _CallCenterDashboard.fromJson(json);
}

/// @nodoc
mixin _$CallCenterDashboard {
  @JsonKey(name: "tenant_id")
  String get tenantId => throw _privateConstructorUsedError;
  @JsonKey(name: "calls_today")
  CallsToday get callsToday => throw _privateConstructorUsedError;
  @JsonKey(name: "total_minutes")
  num get totalMinutes => throw _privateConstructorUsedError;
  @JsonKey(name: "total_cost")
  num get totalCost => throw _privateConstructorUsedError;
  @JsonKey(name: "tasks_scheduled")
  int get tasksScheduled => throw _privateConstructorUsedError;
  @JsonKey(name: "campaigns_running")
  int get campaignsRunning => throw _privateConstructorUsedError;

  /// Serializes this CallCenterDashboard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallCenterDashboard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallCenterDashboardCopyWith<CallCenterDashboard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallCenterDashboardCopyWith<$Res> {
  factory $CallCenterDashboardCopyWith(
          CallCenterDashboard value, $Res Function(CallCenterDashboard) then) =
      _$CallCenterDashboardCopyWithImpl<$Res, CallCenterDashboard>;
  @useResult
  $Res call(
      {@JsonKey(name: "tenant_id") String tenantId,
      @JsonKey(name: "calls_today") CallsToday callsToday,
      @JsonKey(name: "total_minutes") num totalMinutes,
      @JsonKey(name: "total_cost") num totalCost,
      @JsonKey(name: "tasks_scheduled") int tasksScheduled,
      @JsonKey(name: "campaigns_running") int campaignsRunning});

  $CallsTodayCopyWith<$Res> get callsToday;
}

/// @nodoc
class _$CallCenterDashboardCopyWithImpl<$Res, $Val extends CallCenterDashboard>
    implements $CallCenterDashboardCopyWith<$Res> {
  _$CallCenterDashboardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallCenterDashboard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tenantId = null,
    Object? callsToday = null,
    Object? totalMinutes = null,
    Object? totalCost = null,
    Object? tasksScheduled = null,
    Object? campaignsRunning = null,
  }) {
    return _then(_value.copyWith(
      tenantId: null == tenantId
          ? _value.tenantId
          : tenantId // ignore: cast_nullable_to_non_nullable
              as String,
      callsToday: null == callsToday
          ? _value.callsToday
          : callsToday // ignore: cast_nullable_to_non_nullable
              as CallsToday,
      totalMinutes: null == totalMinutes
          ? _value.totalMinutes
          : totalMinutes // ignore: cast_nullable_to_non_nullable
              as num,
      totalCost: null == totalCost
          ? _value.totalCost
          : totalCost // ignore: cast_nullable_to_non_nullable
              as num,
      tasksScheduled: null == tasksScheduled
          ? _value.tasksScheduled
          : tasksScheduled // ignore: cast_nullable_to_non_nullable
              as int,
      campaignsRunning: null == campaignsRunning
          ? _value.campaignsRunning
          : campaignsRunning // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }

  /// Create a copy of CallCenterDashboard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CallsTodayCopyWith<$Res> get callsToday {
    return $CallsTodayCopyWith<$Res>(_value.callsToday, (value) {
      return _then(_value.copyWith(callsToday: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CallCenterDashboardImplCopyWith<$Res>
    implements $CallCenterDashboardCopyWith<$Res> {
  factory _$$CallCenterDashboardImplCopyWith(_$CallCenterDashboardImpl value,
          $Res Function(_$CallCenterDashboardImpl) then) =
      __$$CallCenterDashboardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "tenant_id") String tenantId,
      @JsonKey(name: "calls_today") CallsToday callsToday,
      @JsonKey(name: "total_minutes") num totalMinutes,
      @JsonKey(name: "total_cost") num totalCost,
      @JsonKey(name: "tasks_scheduled") int tasksScheduled,
      @JsonKey(name: "campaigns_running") int campaignsRunning});

  @override
  $CallsTodayCopyWith<$Res> get callsToday;
}

/// @nodoc
class __$$CallCenterDashboardImplCopyWithImpl<$Res>
    extends _$CallCenterDashboardCopyWithImpl<$Res, _$CallCenterDashboardImpl>
    implements _$$CallCenterDashboardImplCopyWith<$Res> {
  __$$CallCenterDashboardImplCopyWithImpl(_$CallCenterDashboardImpl _value,
      $Res Function(_$CallCenterDashboardImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallCenterDashboard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tenantId = null,
    Object? callsToday = null,
    Object? totalMinutes = null,
    Object? totalCost = null,
    Object? tasksScheduled = null,
    Object? campaignsRunning = null,
  }) {
    return _then(_$CallCenterDashboardImpl(
      tenantId: null == tenantId
          ? _value.tenantId
          : tenantId // ignore: cast_nullable_to_non_nullable
              as String,
      callsToday: null == callsToday
          ? _value.callsToday
          : callsToday // ignore: cast_nullable_to_non_nullable
              as CallsToday,
      totalMinutes: null == totalMinutes
          ? _value.totalMinutes
          : totalMinutes // ignore: cast_nullable_to_non_nullable
              as num,
      totalCost: null == totalCost
          ? _value.totalCost
          : totalCost // ignore: cast_nullable_to_non_nullable
              as num,
      tasksScheduled: null == tasksScheduled
          ? _value.tasksScheduled
          : tasksScheduled // ignore: cast_nullable_to_non_nullable
              as int,
      campaignsRunning: null == campaignsRunning
          ? _value.campaignsRunning
          : campaignsRunning // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallCenterDashboardImpl implements _CallCenterDashboard {
  const _$CallCenterDashboardImpl(
      {@JsonKey(name: "tenant_id") this.tenantId = "",
      @JsonKey(name: "calls_today") this.callsToday = const CallsToday(),
      @JsonKey(name: "total_minutes") this.totalMinutes = 0,
      @JsonKey(name: "total_cost") this.totalCost = 0,
      @JsonKey(name: "tasks_scheduled") this.tasksScheduled = 0,
      @JsonKey(name: "campaigns_running") this.campaignsRunning = 0});

  factory _$CallCenterDashboardImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallCenterDashboardImplFromJson(json);

  @override
  @JsonKey(name: "tenant_id")
  final String tenantId;
  @override
  @JsonKey(name: "calls_today")
  final CallsToday callsToday;
  @override
  @JsonKey(name: "total_minutes")
  final num totalMinutes;
  @override
  @JsonKey(name: "total_cost")
  final num totalCost;
  @override
  @JsonKey(name: "tasks_scheduled")
  final int tasksScheduled;
  @override
  @JsonKey(name: "campaigns_running")
  final int campaignsRunning;

  @override
  String toString() {
    return 'CallCenterDashboard(tenantId: $tenantId, callsToday: $callsToday, totalMinutes: $totalMinutes, totalCost: $totalCost, tasksScheduled: $tasksScheduled, campaignsRunning: $campaignsRunning)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallCenterDashboardImpl &&
            (identical(other.tenantId, tenantId) ||
                other.tenantId == tenantId) &&
            (identical(other.callsToday, callsToday) ||
                other.callsToday == callsToday) &&
            (identical(other.totalMinutes, totalMinutes) ||
                other.totalMinutes == totalMinutes) &&
            (identical(other.totalCost, totalCost) ||
                other.totalCost == totalCost) &&
            (identical(other.tasksScheduled, tasksScheduled) ||
                other.tasksScheduled == tasksScheduled) &&
            (identical(other.campaignsRunning, campaignsRunning) ||
                other.campaignsRunning == campaignsRunning));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, tenantId, callsToday,
      totalMinutes, totalCost, tasksScheduled, campaignsRunning);

  /// Create a copy of CallCenterDashboard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallCenterDashboardImplCopyWith<_$CallCenterDashboardImpl> get copyWith =>
      __$$CallCenterDashboardImplCopyWithImpl<_$CallCenterDashboardImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallCenterDashboardImplToJson(
      this,
    );
  }
}

abstract class _CallCenterDashboard implements CallCenterDashboard {
  const factory _CallCenterDashboard(
          {@JsonKey(name: "tenant_id") final String tenantId,
          @JsonKey(name: "calls_today") final CallsToday callsToday,
          @JsonKey(name: "total_minutes") final num totalMinutes,
          @JsonKey(name: "total_cost") final num totalCost,
          @JsonKey(name: "tasks_scheduled") final int tasksScheduled,
          @JsonKey(name: "campaigns_running") final int campaignsRunning}) =
      _$CallCenterDashboardImpl;

  factory _CallCenterDashboard.fromJson(Map<String, dynamic> json) =
      _$CallCenterDashboardImpl.fromJson;

  @override
  @JsonKey(name: "tenant_id")
  String get tenantId;
  @override
  @JsonKey(name: "calls_today")
  CallsToday get callsToday;
  @override
  @JsonKey(name: "total_minutes")
  num get totalMinutes;
  @override
  @JsonKey(name: "total_cost")
  num get totalCost;
  @override
  @JsonKey(name: "tasks_scheduled")
  int get tasksScheduled;
  @override
  @JsonKey(name: "campaigns_running")
  int get campaignsRunning;

  /// Create a copy of CallCenterDashboard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallCenterDashboardImplCopyWith<_$CallCenterDashboardImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallAgent _$CallAgentFromJson(Map<String, dynamic> json) {
  return _CallAgent.fromJson(json);
}

/// @nodoc
mixin _$CallAgent {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  @JsonKey(name: "use_case")
  String get useCase => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "current_version_id")
  String? get currentVersionId => throw _privateConstructorUsedError;

  /// Serializes this CallAgent to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallAgent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallAgentCopyWith<CallAgent> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallAgentCopyWith<$Res> {
  factory $CallAgentCopyWith(CallAgent value, $Res Function(CallAgent) then) =
      _$CallAgentCopyWithImpl<$Res, CallAgent>;
  @useResult
  $Res call(
      {String id,
      String name,
      @JsonKey(name: "use_case") String useCase,
      String status,
      @JsonKey(name: "current_version_id") String? currentVersionId});
}

/// @nodoc
class _$CallAgentCopyWithImpl<$Res, $Val extends CallAgent>
    implements $CallAgentCopyWith<$Res> {
  _$CallAgentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallAgent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? useCase = null,
    Object? status = null,
    Object? currentVersionId = freezed,
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
      useCase: null == useCase
          ? _value.useCase
          : useCase // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      currentVersionId: freezed == currentVersionId
          ? _value.currentVersionId
          : currentVersionId // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallAgentImplCopyWith<$Res>
    implements $CallAgentCopyWith<$Res> {
  factory _$$CallAgentImplCopyWith(
          _$CallAgentImpl value, $Res Function(_$CallAgentImpl) then) =
      __$$CallAgentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      @JsonKey(name: "use_case") String useCase,
      String status,
      @JsonKey(name: "current_version_id") String? currentVersionId});
}

/// @nodoc
class __$$CallAgentImplCopyWithImpl<$Res>
    extends _$CallAgentCopyWithImpl<$Res, _$CallAgentImpl>
    implements _$$CallAgentImplCopyWith<$Res> {
  __$$CallAgentImplCopyWithImpl(
      _$CallAgentImpl _value, $Res Function(_$CallAgentImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallAgent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? useCase = null,
    Object? status = null,
    Object? currentVersionId = freezed,
  }) {
    return _then(_$CallAgentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      useCase: null == useCase
          ? _value.useCase
          : useCase // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      currentVersionId: freezed == currentVersionId
          ? _value.currentVersionId
          : currentVersionId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallAgentImpl implements _CallAgent {
  const _$CallAgentImpl(
      {this.id = "",
      this.name = "",
      @JsonKey(name: "use_case") this.useCase = "",
      this.status = "",
      @JsonKey(name: "current_version_id") this.currentVersionId});

  factory _$CallAgentImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallAgentImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey(name: "use_case")
  final String useCase;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "current_version_id")
  final String? currentVersionId;

  @override
  String toString() {
    return 'CallAgent(id: $id, name: $name, useCase: $useCase, status: $status, currentVersionId: $currentVersionId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallAgentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.useCase, useCase) || other.useCase == useCase) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.currentVersionId, currentVersionId) ||
                other.currentVersionId == currentVersionId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, useCase, status, currentVersionId);

  /// Create a copy of CallAgent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallAgentImplCopyWith<_$CallAgentImpl> get copyWith =>
      __$$CallAgentImplCopyWithImpl<_$CallAgentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallAgentImplToJson(
      this,
    );
  }
}

abstract class _CallAgent implements CallAgent {
  const factory _CallAgent(
      {final String id,
      final String name,
      @JsonKey(name: "use_case") final String useCase,
      final String status,
      @JsonKey(name: "current_version_id")
      final String? currentVersionId}) = _$CallAgentImpl;

  factory _CallAgent.fromJson(Map<String, dynamic> json) =
      _$CallAgentImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  @JsonKey(name: "use_case")
  String get useCase;
  @override
  String get status;
  @override
  @JsonKey(name: "current_version_id")
  String? get currentVersionId;

  /// Create a copy of CallAgent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallAgentImplCopyWith<_$CallAgentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallPhoneNumber _$CallPhoneNumberFromJson(Map<String, dynamic> json) {
  return _CallPhoneNumber.fromJson(json);
}

/// @nodoc
mixin _$CallPhoneNumber {
  String get id => throw _privateConstructorUsedError;
  String get e164 => throw _privateConstructorUsedError;
  String get provider => throw _privateConstructorUsedError;
  @JsonKey(name: "provider_number_id")
  String? get providerNumberId => throw _privateConstructorUsedError;
  String? get country => throw _privateConstructorUsedError;
  @JsonKey(name: "agent_id")
  String? get agentId => throw _privateConstructorUsedError;
  String? get label => throw _privateConstructorUsedError;
  bool get active => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this CallPhoneNumber to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallPhoneNumber
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallPhoneNumberCopyWith<CallPhoneNumber> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallPhoneNumberCopyWith<$Res> {
  factory $CallPhoneNumberCopyWith(
          CallPhoneNumber value, $Res Function(CallPhoneNumber) then) =
      _$CallPhoneNumberCopyWithImpl<$Res, CallPhoneNumber>;
  @useResult
  $Res call(
      {String id,
      String e164,
      String provider,
      @JsonKey(name: "provider_number_id") String? providerNumberId,
      String? country,
      @JsonKey(name: "agent_id") String? agentId,
      String? label,
      bool active,
      @JsonKey(name: "created_at") String? createdAt});
}

/// @nodoc
class _$CallPhoneNumberCopyWithImpl<$Res, $Val extends CallPhoneNumber>
    implements $CallPhoneNumberCopyWith<$Res> {
  _$CallPhoneNumberCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallPhoneNumber
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? e164 = null,
    Object? provider = null,
    Object? providerNumberId = freezed,
    Object? country = freezed,
    Object? agentId = freezed,
    Object? label = freezed,
    Object? active = null,
    Object? createdAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      e164: null == e164
          ? _value.e164
          : e164 // ignore: cast_nullable_to_non_nullable
              as String,
      provider: null == provider
          ? _value.provider
          : provider // ignore: cast_nullable_to_non_nullable
              as String,
      providerNumberId: freezed == providerNumberId
          ? _value.providerNumberId
          : providerNumberId // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      agentId: freezed == agentId
          ? _value.agentId
          : agentId // ignore: cast_nullable_to_non_nullable
              as String?,
      label: freezed == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String?,
      active: null == active
          ? _value.active
          : active // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallPhoneNumberImplCopyWith<$Res>
    implements $CallPhoneNumberCopyWith<$Res> {
  factory _$$CallPhoneNumberImplCopyWith(_$CallPhoneNumberImpl value,
          $Res Function(_$CallPhoneNumberImpl) then) =
      __$$CallPhoneNumberImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String e164,
      String provider,
      @JsonKey(name: "provider_number_id") String? providerNumberId,
      String? country,
      @JsonKey(name: "agent_id") String? agentId,
      String? label,
      bool active,
      @JsonKey(name: "created_at") String? createdAt});
}

/// @nodoc
class __$$CallPhoneNumberImplCopyWithImpl<$Res>
    extends _$CallPhoneNumberCopyWithImpl<$Res, _$CallPhoneNumberImpl>
    implements _$$CallPhoneNumberImplCopyWith<$Res> {
  __$$CallPhoneNumberImplCopyWithImpl(
      _$CallPhoneNumberImpl _value, $Res Function(_$CallPhoneNumberImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallPhoneNumber
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? e164 = null,
    Object? provider = null,
    Object? providerNumberId = freezed,
    Object? country = freezed,
    Object? agentId = freezed,
    Object? label = freezed,
    Object? active = null,
    Object? createdAt = freezed,
  }) {
    return _then(_$CallPhoneNumberImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      e164: null == e164
          ? _value.e164
          : e164 // ignore: cast_nullable_to_non_nullable
              as String,
      provider: null == provider
          ? _value.provider
          : provider // ignore: cast_nullable_to_non_nullable
              as String,
      providerNumberId: freezed == providerNumberId
          ? _value.providerNumberId
          : providerNumberId // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      agentId: freezed == agentId
          ? _value.agentId
          : agentId // ignore: cast_nullable_to_non_nullable
              as String?,
      label: freezed == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String?,
      active: null == active
          ? _value.active
          : active // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallPhoneNumberImpl implements _CallPhoneNumber {
  const _$CallPhoneNumberImpl(
      {this.id = "",
      this.e164 = "",
      this.provider = "",
      @JsonKey(name: "provider_number_id") this.providerNumberId,
      this.country,
      @JsonKey(name: "agent_id") this.agentId,
      this.label,
      this.active = true,
      @JsonKey(name: "created_at") this.createdAt});

  factory _$CallPhoneNumberImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallPhoneNumberImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String e164;
  @override
  @JsonKey()
  final String provider;
  @override
  @JsonKey(name: "provider_number_id")
  final String? providerNumberId;
  @override
  final String? country;
  @override
  @JsonKey(name: "agent_id")
  final String? agentId;
  @override
  final String? label;
  @override
  @JsonKey()
  final bool active;
  @override
  @JsonKey(name: "created_at")
  final String? createdAt;

  @override
  String toString() {
    return 'CallPhoneNumber(id: $id, e164: $e164, provider: $provider, providerNumberId: $providerNumberId, country: $country, agentId: $agentId, label: $label, active: $active, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallPhoneNumberImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.e164, e164) || other.e164 == e164) &&
            (identical(other.provider, provider) ||
                other.provider == provider) &&
            (identical(other.providerNumberId, providerNumberId) ||
                other.providerNumberId == providerNumberId) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.agentId, agentId) || other.agentId == agentId) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.active, active) || other.active == active) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, e164, provider,
      providerNumberId, country, agentId, label, active, createdAt);

  /// Create a copy of CallPhoneNumber
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallPhoneNumberImplCopyWith<_$CallPhoneNumberImpl> get copyWith =>
      __$$CallPhoneNumberImplCopyWithImpl<_$CallPhoneNumberImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallPhoneNumberImplToJson(
      this,
    );
  }
}

abstract class _CallPhoneNumber implements CallPhoneNumber {
  const factory _CallPhoneNumber(
          {final String id,
          final String e164,
          final String provider,
          @JsonKey(name: "provider_number_id") final String? providerNumberId,
          final String? country,
          @JsonKey(name: "agent_id") final String? agentId,
          final String? label,
          final bool active,
          @JsonKey(name: "created_at") final String? createdAt}) =
      _$CallPhoneNumberImpl;

  factory _CallPhoneNumber.fromJson(Map<String, dynamic> json) =
      _$CallPhoneNumberImpl.fromJson;

  @override
  String get id;
  @override
  String get e164;
  @override
  String get provider;
  @override
  @JsonKey(name: "provider_number_id")
  String? get providerNumberId;
  @override
  String? get country;
  @override
  @JsonKey(name: "agent_id")
  String? get agentId;
  @override
  String? get label;
  @override
  bool get active;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;

  /// Create a copy of CallPhoneNumber
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallPhoneNumberImplCopyWith<_$CallPhoneNumberImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallTranscriptTurn _$CallTranscriptTurnFromJson(Map<String, dynamic> json) {
  return _CallTranscriptTurn.fromJson(json);
}

/// @nodoc
mixin _$CallTranscriptTurn {
  String get role => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;

  /// Serializes this CallTranscriptTurn to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallTranscriptTurn
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallTranscriptTurnCopyWith<CallTranscriptTurn> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallTranscriptTurnCopyWith<$Res> {
  factory $CallTranscriptTurnCopyWith(
          CallTranscriptTurn value, $Res Function(CallTranscriptTurn) then) =
      _$CallTranscriptTurnCopyWithImpl<$Res, CallTranscriptTurn>;
  @useResult
  $Res call({String role, String content});
}

/// @nodoc
class _$CallTranscriptTurnCopyWithImpl<$Res, $Val extends CallTranscriptTurn>
    implements $CallTranscriptTurnCopyWith<$Res> {
  _$CallTranscriptTurnCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallTranscriptTurn
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? role = null,
    Object? content = null,
  }) {
    return _then(_value.copyWith(
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String,
      content: null == content
          ? _value.content
          : content // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallTranscriptTurnImplCopyWith<$Res>
    implements $CallTranscriptTurnCopyWith<$Res> {
  factory _$$CallTranscriptTurnImplCopyWith(_$CallTranscriptTurnImpl value,
          $Res Function(_$CallTranscriptTurnImpl) then) =
      __$$CallTranscriptTurnImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String role, String content});
}

/// @nodoc
class __$$CallTranscriptTurnImplCopyWithImpl<$Res>
    extends _$CallTranscriptTurnCopyWithImpl<$Res, _$CallTranscriptTurnImpl>
    implements _$$CallTranscriptTurnImplCopyWith<$Res> {
  __$$CallTranscriptTurnImplCopyWithImpl(_$CallTranscriptTurnImpl _value,
      $Res Function(_$CallTranscriptTurnImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallTranscriptTurn
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? role = null,
    Object? content = null,
  }) {
    return _then(_$CallTranscriptTurnImpl(
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String,
      content: null == content
          ? _value.content
          : content // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallTranscriptTurnImpl implements _CallTranscriptTurn {
  const _$CallTranscriptTurnImpl({this.role = "", this.content = ""});

  factory _$CallTranscriptTurnImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallTranscriptTurnImplFromJson(json);

  @override
  @JsonKey()
  final String role;
  @override
  @JsonKey()
  final String content;

  @override
  String toString() {
    return 'CallTranscriptTurn(role: $role, content: $content)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallTranscriptTurnImpl &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.content, content) || other.content == content));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, role, content);

  /// Create a copy of CallTranscriptTurn
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallTranscriptTurnImplCopyWith<_$CallTranscriptTurnImpl> get copyWith =>
      __$$CallTranscriptTurnImplCopyWithImpl<_$CallTranscriptTurnImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallTranscriptTurnImplToJson(
      this,
    );
  }
}

abstract class _CallTranscriptTurn implements CallTranscriptTurn {
  const factory _CallTranscriptTurn({final String role, final String content}) =
      _$CallTranscriptTurnImpl;

  factory _CallTranscriptTurn.fromJson(Map<String, dynamic> json) =
      _$CallTranscriptTurnImpl.fromJson;

  @override
  String get role;
  @override
  String get content;

  /// Create a copy of CallTranscriptTurn
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallTranscriptTurnImplCopyWith<_$CallTranscriptTurnImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallCenterCall _$CallCenterCallFromJson(Map<String, dynamic> json) {
  return _CallCenterCall.fromJson(json);
}

/// @nodoc
mixin _$CallCenterCall {
  String get id => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get direction => throw _privateConstructorUsedError;
  @JsonKey(name: "from_number")
  String? get fromNumber => throw _privateConstructorUsedError;
  @JsonKey(name: "to_number")
  String? get toNumber => throw _privateConstructorUsedError;
  @JsonKey(name: "order_id")
  String? get orderId => throw _privateConstructorUsedError;
  @JsonKey(name: "campaign_id")
  String? get campaignId => throw _privateConstructorUsedError;
  String? get disposition => throw _privateConstructorUsedError;
  String? get sentiment => throw _privateConstructorUsedError;
  @JsonKey(name: "cost_total")
  num? get costTotal => throw _privateConstructorUsedError;
  @JsonKey(name: "started_at")
  String? get startedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "ended_at")
  String? get endedAt => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;
  String? get summary => throw _privateConstructorUsedError;
  List<CallTranscriptTurn>? get transcript =>
      throw _privateConstructorUsedError;
  @JsonKey(name: "recording_url")
  String? get recordingUrl => throw _privateConstructorUsedError;
  String? get locale => throw _privateConstructorUsedError;

  /// Serializes this CallCenterCall to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallCenterCall
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallCenterCallCopyWith<CallCenterCall> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallCenterCallCopyWith<$Res> {
  factory $CallCenterCallCopyWith(
          CallCenterCall value, $Res Function(CallCenterCall) then) =
      _$CallCenterCallCopyWithImpl<$Res, CallCenterCall>;
  @useResult
  $Res call(
      {String id,
      String status,
      String direction,
      @JsonKey(name: "from_number") String? fromNumber,
      @JsonKey(name: "to_number") String? toNumber,
      @JsonKey(name: "order_id") String? orderId,
      @JsonKey(name: "campaign_id") String? campaignId,
      String? disposition,
      String? sentiment,
      @JsonKey(name: "cost_total") num? costTotal,
      @JsonKey(name: "started_at") String? startedAt,
      @JsonKey(name: "ended_at") String? endedAt,
      @JsonKey(name: "created_at") String createdAt,
      String? summary,
      List<CallTranscriptTurn>? transcript,
      @JsonKey(name: "recording_url") String? recordingUrl,
      String? locale});
}

/// @nodoc
class _$CallCenterCallCopyWithImpl<$Res, $Val extends CallCenterCall>
    implements $CallCenterCallCopyWith<$Res> {
  _$CallCenterCallCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallCenterCall
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? direction = null,
    Object? fromNumber = freezed,
    Object? toNumber = freezed,
    Object? orderId = freezed,
    Object? campaignId = freezed,
    Object? disposition = freezed,
    Object? sentiment = freezed,
    Object? costTotal = freezed,
    Object? startedAt = freezed,
    Object? endedAt = freezed,
    Object? createdAt = null,
    Object? summary = freezed,
    Object? transcript = freezed,
    Object? recordingUrl = freezed,
    Object? locale = freezed,
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
      direction: null == direction
          ? _value.direction
          : direction // ignore: cast_nullable_to_non_nullable
              as String,
      fromNumber: freezed == fromNumber
          ? _value.fromNumber
          : fromNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      toNumber: freezed == toNumber
          ? _value.toNumber
          : toNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      orderId: freezed == orderId
          ? _value.orderId
          : orderId // ignore: cast_nullable_to_non_nullable
              as String?,
      campaignId: freezed == campaignId
          ? _value.campaignId
          : campaignId // ignore: cast_nullable_to_non_nullable
              as String?,
      disposition: freezed == disposition
          ? _value.disposition
          : disposition // ignore: cast_nullable_to_non_nullable
              as String?,
      sentiment: freezed == sentiment
          ? _value.sentiment
          : sentiment // ignore: cast_nullable_to_non_nullable
              as String?,
      costTotal: freezed == costTotal
          ? _value.costTotal
          : costTotal // ignore: cast_nullable_to_non_nullable
              as num?,
      startedAt: freezed == startedAt
          ? _value.startedAt
          : startedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      endedAt: freezed == endedAt
          ? _value.endedAt
          : endedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      summary: freezed == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as String?,
      transcript: freezed == transcript
          ? _value.transcript
          : transcript // ignore: cast_nullable_to_non_nullable
              as List<CallTranscriptTurn>?,
      recordingUrl: freezed == recordingUrl
          ? _value.recordingUrl
          : recordingUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      locale: freezed == locale
          ? _value.locale
          : locale // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallCenterCallImplCopyWith<$Res>
    implements $CallCenterCallCopyWith<$Res> {
  factory _$$CallCenterCallImplCopyWith(_$CallCenterCallImpl value,
          $Res Function(_$CallCenterCallImpl) then) =
      __$$CallCenterCallImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String status,
      String direction,
      @JsonKey(name: "from_number") String? fromNumber,
      @JsonKey(name: "to_number") String? toNumber,
      @JsonKey(name: "order_id") String? orderId,
      @JsonKey(name: "campaign_id") String? campaignId,
      String? disposition,
      String? sentiment,
      @JsonKey(name: "cost_total") num? costTotal,
      @JsonKey(name: "started_at") String? startedAt,
      @JsonKey(name: "ended_at") String? endedAt,
      @JsonKey(name: "created_at") String createdAt,
      String? summary,
      List<CallTranscriptTurn>? transcript,
      @JsonKey(name: "recording_url") String? recordingUrl,
      String? locale});
}

/// @nodoc
class __$$CallCenterCallImplCopyWithImpl<$Res>
    extends _$CallCenterCallCopyWithImpl<$Res, _$CallCenterCallImpl>
    implements _$$CallCenterCallImplCopyWith<$Res> {
  __$$CallCenterCallImplCopyWithImpl(
      _$CallCenterCallImpl _value, $Res Function(_$CallCenterCallImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallCenterCall
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? direction = null,
    Object? fromNumber = freezed,
    Object? toNumber = freezed,
    Object? orderId = freezed,
    Object? campaignId = freezed,
    Object? disposition = freezed,
    Object? sentiment = freezed,
    Object? costTotal = freezed,
    Object? startedAt = freezed,
    Object? endedAt = freezed,
    Object? createdAt = null,
    Object? summary = freezed,
    Object? transcript = freezed,
    Object? recordingUrl = freezed,
    Object? locale = freezed,
  }) {
    return _then(_$CallCenterCallImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      direction: null == direction
          ? _value.direction
          : direction // ignore: cast_nullable_to_non_nullable
              as String,
      fromNumber: freezed == fromNumber
          ? _value.fromNumber
          : fromNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      toNumber: freezed == toNumber
          ? _value.toNumber
          : toNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      orderId: freezed == orderId
          ? _value.orderId
          : orderId // ignore: cast_nullable_to_non_nullable
              as String?,
      campaignId: freezed == campaignId
          ? _value.campaignId
          : campaignId // ignore: cast_nullable_to_non_nullable
              as String?,
      disposition: freezed == disposition
          ? _value.disposition
          : disposition // ignore: cast_nullable_to_non_nullable
              as String?,
      sentiment: freezed == sentiment
          ? _value.sentiment
          : sentiment // ignore: cast_nullable_to_non_nullable
              as String?,
      costTotal: freezed == costTotal
          ? _value.costTotal
          : costTotal // ignore: cast_nullable_to_non_nullable
              as num?,
      startedAt: freezed == startedAt
          ? _value.startedAt
          : startedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      endedAt: freezed == endedAt
          ? _value.endedAt
          : endedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      summary: freezed == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as String?,
      transcript: freezed == transcript
          ? _value._transcript
          : transcript // ignore: cast_nullable_to_non_nullable
              as List<CallTranscriptTurn>?,
      recordingUrl: freezed == recordingUrl
          ? _value.recordingUrl
          : recordingUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      locale: freezed == locale
          ? _value.locale
          : locale // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallCenterCallImpl implements _CallCenterCall {
  const _$CallCenterCallImpl(
      {this.id = "",
      this.status = "",
      this.direction = "outbound",
      @JsonKey(name: "from_number") this.fromNumber,
      @JsonKey(name: "to_number") this.toNumber,
      @JsonKey(name: "order_id") this.orderId,
      @JsonKey(name: "campaign_id") this.campaignId,
      this.disposition,
      this.sentiment,
      @JsonKey(name: "cost_total") this.costTotal,
      @JsonKey(name: "started_at") this.startedAt,
      @JsonKey(name: "ended_at") this.endedAt,
      @JsonKey(name: "created_at") this.createdAt = "",
      this.summary,
      final List<CallTranscriptTurn>? transcript,
      @JsonKey(name: "recording_url") this.recordingUrl,
      this.locale})
      : _transcript = transcript;

  factory _$CallCenterCallImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallCenterCallImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey()
  final String direction;
  @override
  @JsonKey(name: "from_number")
  final String? fromNumber;
  @override
  @JsonKey(name: "to_number")
  final String? toNumber;
  @override
  @JsonKey(name: "order_id")
  final String? orderId;
  @override
  @JsonKey(name: "campaign_id")
  final String? campaignId;
  @override
  final String? disposition;
  @override
  final String? sentiment;
  @override
  @JsonKey(name: "cost_total")
  final num? costTotal;
  @override
  @JsonKey(name: "started_at")
  final String? startedAt;
  @override
  @JsonKey(name: "ended_at")
  final String? endedAt;
  @override
  @JsonKey(name: "created_at")
  final String createdAt;
  @override
  final String? summary;
  final List<CallTranscriptTurn>? _transcript;
  @override
  List<CallTranscriptTurn>? get transcript {
    final value = _transcript;
    if (value == null) return null;
    if (_transcript is EqualUnmodifiableListView) return _transcript;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: "recording_url")
  final String? recordingUrl;
  @override
  final String? locale;

  @override
  String toString() {
    return 'CallCenterCall(id: $id, status: $status, direction: $direction, fromNumber: $fromNumber, toNumber: $toNumber, orderId: $orderId, campaignId: $campaignId, disposition: $disposition, sentiment: $sentiment, costTotal: $costTotal, startedAt: $startedAt, endedAt: $endedAt, createdAt: $createdAt, summary: $summary, transcript: $transcript, recordingUrl: $recordingUrl, locale: $locale)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallCenterCallImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.direction, direction) ||
                other.direction == direction) &&
            (identical(other.fromNumber, fromNumber) ||
                other.fromNumber == fromNumber) &&
            (identical(other.toNumber, toNumber) ||
                other.toNumber == toNumber) &&
            (identical(other.orderId, orderId) || other.orderId == orderId) &&
            (identical(other.campaignId, campaignId) ||
                other.campaignId == campaignId) &&
            (identical(other.disposition, disposition) ||
                other.disposition == disposition) &&
            (identical(other.sentiment, sentiment) ||
                other.sentiment == sentiment) &&
            (identical(other.costTotal, costTotal) ||
                other.costTotal == costTotal) &&
            (identical(other.startedAt, startedAt) ||
                other.startedAt == startedAt) &&
            (identical(other.endedAt, endedAt) || other.endedAt == endedAt) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.summary, summary) || other.summary == summary) &&
            const DeepCollectionEquality()
                .equals(other._transcript, _transcript) &&
            (identical(other.recordingUrl, recordingUrl) ||
                other.recordingUrl == recordingUrl) &&
            (identical(other.locale, locale) || other.locale == locale));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      status,
      direction,
      fromNumber,
      toNumber,
      orderId,
      campaignId,
      disposition,
      sentiment,
      costTotal,
      startedAt,
      endedAt,
      createdAt,
      summary,
      const DeepCollectionEquality().hash(_transcript),
      recordingUrl,
      locale);

  /// Create a copy of CallCenterCall
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallCenterCallImplCopyWith<_$CallCenterCallImpl> get copyWith =>
      __$$CallCenterCallImplCopyWithImpl<_$CallCenterCallImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallCenterCallImplToJson(
      this,
    );
  }
}

abstract class _CallCenterCall implements CallCenterCall {
  const factory _CallCenterCall(
      {final String id,
      final String status,
      final String direction,
      @JsonKey(name: "from_number") final String? fromNumber,
      @JsonKey(name: "to_number") final String? toNumber,
      @JsonKey(name: "order_id") final String? orderId,
      @JsonKey(name: "campaign_id") final String? campaignId,
      final String? disposition,
      final String? sentiment,
      @JsonKey(name: "cost_total") final num? costTotal,
      @JsonKey(name: "started_at") final String? startedAt,
      @JsonKey(name: "ended_at") final String? endedAt,
      @JsonKey(name: "created_at") final String createdAt,
      final String? summary,
      final List<CallTranscriptTurn>? transcript,
      @JsonKey(name: "recording_url") final String? recordingUrl,
      final String? locale}) = _$CallCenterCallImpl;

  factory _CallCenterCall.fromJson(Map<String, dynamic> json) =
      _$CallCenterCallImpl.fromJson;

  @override
  String get id;
  @override
  String get status;
  @override
  String get direction;
  @override
  @JsonKey(name: "from_number")
  String? get fromNumber;
  @override
  @JsonKey(name: "to_number")
  String? get toNumber;
  @override
  @JsonKey(name: "order_id")
  String? get orderId;
  @override
  @JsonKey(name: "campaign_id")
  String? get campaignId;
  @override
  String? get disposition;
  @override
  String? get sentiment;
  @override
  @JsonKey(name: "cost_total")
  num? get costTotal;
  @override
  @JsonKey(name: "started_at")
  String? get startedAt;
  @override
  @JsonKey(name: "ended_at")
  String? get endedAt;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;
  @override
  String? get summary;
  @override
  List<CallTranscriptTurn>? get transcript;
  @override
  @JsonKey(name: "recording_url")
  String? get recordingUrl;
  @override
  String? get locale;

  /// Create a copy of CallCenterCall
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallCenterCallImplCopyWith<_$CallCenterCallImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallDisposition _$CallDispositionFromJson(Map<String, dynamic> json) {
  return _CallDisposition.fromJson(json);
}

/// @nodoc
mixin _$CallDisposition {
  String get id => throw _privateConstructorUsedError;
  String get outcome => throw _privateConstructorUsedError;
  String? get reason => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  @JsonKey(name: "set_by")
  String? get setBy => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;

  /// Serializes this CallDisposition to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallDisposition
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallDispositionCopyWith<CallDisposition> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallDispositionCopyWith<$Res> {
  factory $CallDispositionCopyWith(
          CallDisposition value, $Res Function(CallDisposition) then) =
      _$CallDispositionCopyWithImpl<$Res, CallDisposition>;
  @useResult
  $Res call(
      {String id,
      String outcome,
      String? reason,
      String? notes,
      @JsonKey(name: "set_by") String? setBy,
      @JsonKey(name: "created_at") String createdAt});
}

/// @nodoc
class _$CallDispositionCopyWithImpl<$Res, $Val extends CallDisposition>
    implements $CallDispositionCopyWith<$Res> {
  _$CallDispositionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallDisposition
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? outcome = null,
    Object? reason = freezed,
    Object? notes = freezed,
    Object? setBy = freezed,
    Object? createdAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      outcome: null == outcome
          ? _value.outcome
          : outcome // ignore: cast_nullable_to_non_nullable
              as String,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      setBy: freezed == setBy
          ? _value.setBy
          : setBy // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallDispositionImplCopyWith<$Res>
    implements $CallDispositionCopyWith<$Res> {
  factory _$$CallDispositionImplCopyWith(_$CallDispositionImpl value,
          $Res Function(_$CallDispositionImpl) then) =
      __$$CallDispositionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String outcome,
      String? reason,
      String? notes,
      @JsonKey(name: "set_by") String? setBy,
      @JsonKey(name: "created_at") String createdAt});
}

/// @nodoc
class __$$CallDispositionImplCopyWithImpl<$Res>
    extends _$CallDispositionCopyWithImpl<$Res, _$CallDispositionImpl>
    implements _$$CallDispositionImplCopyWith<$Res> {
  __$$CallDispositionImplCopyWithImpl(
      _$CallDispositionImpl _value, $Res Function(_$CallDispositionImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallDisposition
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? outcome = null,
    Object? reason = freezed,
    Object? notes = freezed,
    Object? setBy = freezed,
    Object? createdAt = null,
  }) {
    return _then(_$CallDispositionImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      outcome: null == outcome
          ? _value.outcome
          : outcome // ignore: cast_nullable_to_non_nullable
              as String,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      setBy: freezed == setBy
          ? _value.setBy
          : setBy // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallDispositionImpl implements _CallDisposition {
  const _$CallDispositionImpl(
      {this.id = "",
      this.outcome = "",
      this.reason,
      this.notes,
      @JsonKey(name: "set_by") this.setBy,
      @JsonKey(name: "created_at") this.createdAt = ""});

  factory _$CallDispositionImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallDispositionImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String outcome;
  @override
  final String? reason;
  @override
  final String? notes;
  @override
  @JsonKey(name: "set_by")
  final String? setBy;
  @override
  @JsonKey(name: "created_at")
  final String createdAt;

  @override
  String toString() {
    return 'CallDisposition(id: $id, outcome: $outcome, reason: $reason, notes: $notes, setBy: $setBy, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallDispositionImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.outcome, outcome) || other.outcome == outcome) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.setBy, setBy) || other.setBy == setBy) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, outcome, reason, notes, setBy, createdAt);

  /// Create a copy of CallDisposition
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallDispositionImplCopyWith<_$CallDispositionImpl> get copyWith =>
      __$$CallDispositionImplCopyWithImpl<_$CallDispositionImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallDispositionImplToJson(
      this,
    );
  }
}

abstract class _CallDisposition implements CallDisposition {
  const factory _CallDisposition(
          {final String id,
          final String outcome,
          final String? reason,
          final String? notes,
          @JsonKey(name: "set_by") final String? setBy,
          @JsonKey(name: "created_at") final String createdAt}) =
      _$CallDispositionImpl;

  factory _CallDisposition.fromJson(Map<String, dynamic> json) =
      _$CallDispositionImpl.fromJson;

  @override
  String get id;
  @override
  String get outcome;
  @override
  String? get reason;
  @override
  String? get notes;
  @override
  @JsonKey(name: "set_by")
  String? get setBy;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;

  /// Create a copy of CallDisposition
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallDispositionImplCopyWith<_$CallDispositionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallAgentRef _$CallAgentRefFromJson(Map<String, dynamic> json) {
  return _CallAgentRef.fromJson(json);
}

/// @nodoc
mixin _$CallAgentRef {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;

  /// Serializes this CallAgentRef to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallAgentRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallAgentRefCopyWith<CallAgentRef> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallAgentRefCopyWith<$Res> {
  factory $CallAgentRefCopyWith(
          CallAgentRef value, $Res Function(CallAgentRef) then) =
      _$CallAgentRefCopyWithImpl<$Res, CallAgentRef>;
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class _$CallAgentRefCopyWithImpl<$Res, $Val extends CallAgentRef>
    implements $CallAgentRefCopyWith<$Res> {
  _$CallAgentRefCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallAgentRef
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
abstract class _$$CallAgentRefImplCopyWith<$Res>
    implements $CallAgentRefCopyWith<$Res> {
  factory _$$CallAgentRefImplCopyWith(
          _$CallAgentRefImpl value, $Res Function(_$CallAgentRefImpl) then) =
      __$$CallAgentRefImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class __$$CallAgentRefImplCopyWithImpl<$Res>
    extends _$CallAgentRefCopyWithImpl<$Res, _$CallAgentRefImpl>
    implements _$$CallAgentRefImplCopyWith<$Res> {
  __$$CallAgentRefImplCopyWithImpl(
      _$CallAgentRefImpl _value, $Res Function(_$CallAgentRefImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallAgentRef
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_$CallAgentRefImpl(
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
class _$CallAgentRefImpl implements _CallAgentRef {
  const _$CallAgentRefImpl({this.id = "", this.name = ""});

  factory _$CallAgentRefImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallAgentRefImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String name;

  @override
  String toString() {
    return 'CallAgentRef(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallAgentRefImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of CallAgentRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallAgentRefImplCopyWith<_$CallAgentRefImpl> get copyWith =>
      __$$CallAgentRefImplCopyWithImpl<_$CallAgentRefImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallAgentRefImplToJson(
      this,
    );
  }
}

abstract class _CallAgentRef implements CallAgentRef {
  const factory _CallAgentRef({final String id, final String name}) =
      _$CallAgentRefImpl;

  factory _CallAgentRef.fromJson(Map<String, dynamic> json) =
      _$CallAgentRefImpl.fromJson;

  @override
  String get id;
  @override
  String get name;

  /// Create a copy of CallAgentRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallAgentRefImplCopyWith<_$CallAgentRefImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallOrderRef _$CallOrderRefFromJson(Map<String, dynamic> json) {
  return _CallOrderRef.fromJson(json);
}

/// @nodoc
mixin _$CallOrderRef {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "display_id")
  int get displayId => throw _privateConstructorUsedError;

  /// Serializes this CallOrderRef to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallOrderRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallOrderRefCopyWith<CallOrderRef> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallOrderRefCopyWith<$Res> {
  factory $CallOrderRefCopyWith(
          CallOrderRef value, $Res Function(CallOrderRef) then) =
      _$CallOrderRefCopyWithImpl<$Res, CallOrderRef>;
  @useResult
  $Res call({String id, @JsonKey(name: "display_id") int displayId});
}

/// @nodoc
class _$CallOrderRefCopyWithImpl<$Res, $Val extends CallOrderRef>
    implements $CallOrderRefCopyWith<$Res> {
  _$CallOrderRefCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallOrderRef
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallOrderRefImplCopyWith<$Res>
    implements $CallOrderRefCopyWith<$Res> {
  factory _$$CallOrderRefImplCopyWith(
          _$CallOrderRefImpl value, $Res Function(_$CallOrderRefImpl) then) =
      __$$CallOrderRefImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, @JsonKey(name: "display_id") int displayId});
}

/// @nodoc
class __$$CallOrderRefImplCopyWithImpl<$Res>
    extends _$CallOrderRefCopyWithImpl<$Res, _$CallOrderRefImpl>
    implements _$$CallOrderRefImplCopyWith<$Res> {
  __$$CallOrderRefImplCopyWithImpl(
      _$CallOrderRefImpl _value, $Res Function(_$CallOrderRefImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallOrderRef
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayId = null,
  }) {
    return _then(_$CallOrderRefImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      displayId: null == displayId
          ? _value.displayId
          : displayId // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallOrderRefImpl implements _CallOrderRef {
  const _$CallOrderRefImpl(
      {this.id = "", @JsonKey(name: "display_id") this.displayId = 0});

  factory _$CallOrderRefImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallOrderRefImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "display_id")
  final int displayId;

  @override
  String toString() {
    return 'CallOrderRef(id: $id, displayId: $displayId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallOrderRefImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.displayId, displayId) ||
                other.displayId == displayId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, displayId);

  /// Create a copy of CallOrderRef
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallOrderRefImplCopyWith<_$CallOrderRefImpl> get copyWith =>
      __$$CallOrderRefImplCopyWithImpl<_$CallOrderRefImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallOrderRefImplToJson(
      this,
    );
  }
}

abstract class _CallOrderRef implements CallOrderRef {
  const factory _CallOrderRef(
      {final String id,
      @JsonKey(name: "display_id") final int displayId}) = _$CallOrderRefImpl;

  factory _CallOrderRef.fromJson(Map<String, dynamic> json) =
      _$CallOrderRefImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "display_id")
  int get displayId;

  /// Create a copy of CallOrderRef
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallOrderRefImplCopyWith<_$CallOrderRefImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallDetail _$CallDetailFromJson(Map<String, dynamic> json) {
  return _CallDetail.fromJson(json);
}

/// @nodoc
mixin _$CallDetail {
  @JsonKey(name: "call")
  CallCenterCall get callData => throw _privateConstructorUsedError;
  List<CallDisposition> get dispositions => throw _privateConstructorUsedError;
  CallAgentRef? get agent => throw _privateConstructorUsedError;
  CallOrderRef? get order => throw _privateConstructorUsedError;
  @JsonKey(name: "has_recording")
  bool get hasRecording => throw _privateConstructorUsedError;

  /// Serializes this CallDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallDetailCopyWith<CallDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallDetailCopyWith<$Res> {
  factory $CallDetailCopyWith(
          CallDetail value, $Res Function(CallDetail) then) =
      _$CallDetailCopyWithImpl<$Res, CallDetail>;
  @useResult
  $Res call(
      {@JsonKey(name: "call") CallCenterCall callData,
      List<CallDisposition> dispositions,
      CallAgentRef? agent,
      CallOrderRef? order,
      @JsonKey(name: "has_recording") bool hasRecording});

  $CallCenterCallCopyWith<$Res> get callData;
  $CallAgentRefCopyWith<$Res>? get agent;
  $CallOrderRefCopyWith<$Res>? get order;
}

/// @nodoc
class _$CallDetailCopyWithImpl<$Res, $Val extends CallDetail>
    implements $CallDetailCopyWith<$Res> {
  _$CallDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? callData = null,
    Object? dispositions = null,
    Object? agent = freezed,
    Object? order = freezed,
    Object? hasRecording = null,
  }) {
    return _then(_value.copyWith(
      callData: null == callData
          ? _value.callData
          : callData // ignore: cast_nullable_to_non_nullable
              as CallCenterCall,
      dispositions: null == dispositions
          ? _value.dispositions
          : dispositions // ignore: cast_nullable_to_non_nullable
              as List<CallDisposition>,
      agent: freezed == agent
          ? _value.agent
          : agent // ignore: cast_nullable_to_non_nullable
              as CallAgentRef?,
      order: freezed == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as CallOrderRef?,
      hasRecording: null == hasRecording
          ? _value.hasRecording
          : hasRecording // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CallCenterCallCopyWith<$Res> get callData {
    return $CallCenterCallCopyWith<$Res>(_value.callData, (value) {
      return _then(_value.copyWith(callData: value) as $Val);
    });
  }

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CallAgentRefCopyWith<$Res>? get agent {
    if (_value.agent == null) {
      return null;
    }

    return $CallAgentRefCopyWith<$Res>(_value.agent!, (value) {
      return _then(_value.copyWith(agent: value) as $Val);
    });
  }

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CallOrderRefCopyWith<$Res>? get order {
    if (_value.order == null) {
      return null;
    }

    return $CallOrderRefCopyWith<$Res>(_value.order!, (value) {
      return _then(_value.copyWith(order: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CallDetailImplCopyWith<$Res>
    implements $CallDetailCopyWith<$Res> {
  factory _$$CallDetailImplCopyWith(
          _$CallDetailImpl value, $Res Function(_$CallDetailImpl) then) =
      __$$CallDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "call") CallCenterCall callData,
      List<CallDisposition> dispositions,
      CallAgentRef? agent,
      CallOrderRef? order,
      @JsonKey(name: "has_recording") bool hasRecording});

  @override
  $CallCenterCallCopyWith<$Res> get callData;
  @override
  $CallAgentRefCopyWith<$Res>? get agent;
  @override
  $CallOrderRefCopyWith<$Res>? get order;
}

/// @nodoc
class __$$CallDetailImplCopyWithImpl<$Res>
    extends _$CallDetailCopyWithImpl<$Res, _$CallDetailImpl>
    implements _$$CallDetailImplCopyWith<$Res> {
  __$$CallDetailImplCopyWithImpl(
      _$CallDetailImpl _value, $Res Function(_$CallDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? callData = null,
    Object? dispositions = null,
    Object? agent = freezed,
    Object? order = freezed,
    Object? hasRecording = null,
  }) {
    return _then(_$CallDetailImpl(
      callData: null == callData
          ? _value.callData
          : callData // ignore: cast_nullable_to_non_nullable
              as CallCenterCall,
      dispositions: null == dispositions
          ? _value._dispositions
          : dispositions // ignore: cast_nullable_to_non_nullable
              as List<CallDisposition>,
      agent: freezed == agent
          ? _value.agent
          : agent // ignore: cast_nullable_to_non_nullable
              as CallAgentRef?,
      order: freezed == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as CallOrderRef?,
      hasRecording: null == hasRecording
          ? _value.hasRecording
          : hasRecording // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallDetailImpl implements _CallDetail {
  const _$CallDetailImpl(
      {@JsonKey(name: "call") required this.callData,
      final List<CallDisposition> dispositions = const <CallDisposition>[],
      this.agent,
      this.order,
      @JsonKey(name: "has_recording") this.hasRecording = false})
      : _dispositions = dispositions;

  factory _$CallDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallDetailImplFromJson(json);

  @override
  @JsonKey(name: "call")
  final CallCenterCall callData;
  final List<CallDisposition> _dispositions;
  @override
  @JsonKey()
  List<CallDisposition> get dispositions {
    if (_dispositions is EqualUnmodifiableListView) return _dispositions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dispositions);
  }

  @override
  final CallAgentRef? agent;
  @override
  final CallOrderRef? order;
  @override
  @JsonKey(name: "has_recording")
  final bool hasRecording;

  @override
  String toString() {
    return 'CallDetail(callData: $callData, dispositions: $dispositions, agent: $agent, order: $order, hasRecording: $hasRecording)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallDetailImpl &&
            (identical(other.callData, callData) ||
                other.callData == callData) &&
            const DeepCollectionEquality()
                .equals(other._dispositions, _dispositions) &&
            (identical(other.agent, agent) || other.agent == agent) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.hasRecording, hasRecording) ||
                other.hasRecording == hasRecording));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      callData,
      const DeepCollectionEquality().hash(_dispositions),
      agent,
      order,
      hasRecording);

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallDetailImplCopyWith<_$CallDetailImpl> get copyWith =>
      __$$CallDetailImplCopyWithImpl<_$CallDetailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallDetailImplToJson(
      this,
    );
  }
}

abstract class _CallDetail implements CallDetail {
  const factory _CallDetail(
          {@JsonKey(name: "call") required final CallCenterCall callData,
          final List<CallDisposition> dispositions,
          final CallAgentRef? agent,
          final CallOrderRef? order,
          @JsonKey(name: "has_recording") final bool hasRecording}) =
      _$CallDetailImpl;

  factory _CallDetail.fromJson(Map<String, dynamic> json) =
      _$CallDetailImpl.fromJson;

  @override
  @JsonKey(name: "call")
  CallCenterCall get callData;
  @override
  List<CallDisposition> get dispositions;
  @override
  CallAgentRef? get agent;
  @override
  CallOrderRef? get order;
  @override
  @JsonKey(name: "has_recording")
  bool get hasRecording;

  /// Create a copy of CallDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallDetailImplCopyWith<_$CallDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallAnalyticsSummary _$CallAnalyticsSummaryFromJson(Map<String, dynamic> json) {
  return _CallAnalyticsSummary.fromJson(json);
}

/// @nodoc
mixin _$CallAnalyticsSummary {
  int get total => throw _privateConstructorUsedError;
  @JsonKey(name: "connect_rate")
  num get connectRate => throw _privateConstructorUsedError;
  @JsonKey(name: "containment_rate")
  num get containmentRate => throw _privateConstructorUsedError;
  @JsonKey(name: "avg_handle_time")
  num get avgHandleTime => throw _privateConstructorUsedError;
  @JsonKey(name: "total_cost")
  num get totalCost => throw _privateConstructorUsedError;

  /// Serializes this CallAnalyticsSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallAnalyticsSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallAnalyticsSummaryCopyWith<CallAnalyticsSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallAnalyticsSummaryCopyWith<$Res> {
  factory $CallAnalyticsSummaryCopyWith(CallAnalyticsSummary value,
          $Res Function(CallAnalyticsSummary) then) =
      _$CallAnalyticsSummaryCopyWithImpl<$Res, CallAnalyticsSummary>;
  @useResult
  $Res call(
      {int total,
      @JsonKey(name: "connect_rate") num connectRate,
      @JsonKey(name: "containment_rate") num containmentRate,
      @JsonKey(name: "avg_handle_time") num avgHandleTime,
      @JsonKey(name: "total_cost") num totalCost});
}

/// @nodoc
class _$CallAnalyticsSummaryCopyWithImpl<$Res,
        $Val extends CallAnalyticsSummary>
    implements $CallAnalyticsSummaryCopyWith<$Res> {
  _$CallAnalyticsSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallAnalyticsSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? connectRate = null,
    Object? containmentRate = null,
    Object? avgHandleTime = null,
    Object? totalCost = null,
  }) {
    return _then(_value.copyWith(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      connectRate: null == connectRate
          ? _value.connectRate
          : connectRate // ignore: cast_nullable_to_non_nullable
              as num,
      containmentRate: null == containmentRate
          ? _value.containmentRate
          : containmentRate // ignore: cast_nullable_to_non_nullable
              as num,
      avgHandleTime: null == avgHandleTime
          ? _value.avgHandleTime
          : avgHandleTime // ignore: cast_nullable_to_non_nullable
              as num,
      totalCost: null == totalCost
          ? _value.totalCost
          : totalCost // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallAnalyticsSummaryImplCopyWith<$Res>
    implements $CallAnalyticsSummaryCopyWith<$Res> {
  factory _$$CallAnalyticsSummaryImplCopyWith(_$CallAnalyticsSummaryImpl value,
          $Res Function(_$CallAnalyticsSummaryImpl) then) =
      __$$CallAnalyticsSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int total,
      @JsonKey(name: "connect_rate") num connectRate,
      @JsonKey(name: "containment_rate") num containmentRate,
      @JsonKey(name: "avg_handle_time") num avgHandleTime,
      @JsonKey(name: "total_cost") num totalCost});
}

/// @nodoc
class __$$CallAnalyticsSummaryImplCopyWithImpl<$Res>
    extends _$CallAnalyticsSummaryCopyWithImpl<$Res, _$CallAnalyticsSummaryImpl>
    implements _$$CallAnalyticsSummaryImplCopyWith<$Res> {
  __$$CallAnalyticsSummaryImplCopyWithImpl(_$CallAnalyticsSummaryImpl _value,
      $Res Function(_$CallAnalyticsSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallAnalyticsSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? connectRate = null,
    Object? containmentRate = null,
    Object? avgHandleTime = null,
    Object? totalCost = null,
  }) {
    return _then(_$CallAnalyticsSummaryImpl(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      connectRate: null == connectRate
          ? _value.connectRate
          : connectRate // ignore: cast_nullable_to_non_nullable
              as num,
      containmentRate: null == containmentRate
          ? _value.containmentRate
          : containmentRate // ignore: cast_nullable_to_non_nullable
              as num,
      avgHandleTime: null == avgHandleTime
          ? _value.avgHandleTime
          : avgHandleTime // ignore: cast_nullable_to_non_nullable
              as num,
      totalCost: null == totalCost
          ? _value.totalCost
          : totalCost // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallAnalyticsSummaryImpl implements _CallAnalyticsSummary {
  const _$CallAnalyticsSummaryImpl(
      {this.total = 0,
      @JsonKey(name: "connect_rate") this.connectRate = 0,
      @JsonKey(name: "containment_rate") this.containmentRate = 0,
      @JsonKey(name: "avg_handle_time") this.avgHandleTime = 0,
      @JsonKey(name: "total_cost") this.totalCost = 0});

  factory _$CallAnalyticsSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallAnalyticsSummaryImplFromJson(json);

  @override
  @JsonKey()
  final int total;
  @override
  @JsonKey(name: "connect_rate")
  final num connectRate;
  @override
  @JsonKey(name: "containment_rate")
  final num containmentRate;
  @override
  @JsonKey(name: "avg_handle_time")
  final num avgHandleTime;
  @override
  @JsonKey(name: "total_cost")
  final num totalCost;

  @override
  String toString() {
    return 'CallAnalyticsSummary(total: $total, connectRate: $connectRate, containmentRate: $containmentRate, avgHandleTime: $avgHandleTime, totalCost: $totalCost)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallAnalyticsSummaryImpl &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.connectRate, connectRate) ||
                other.connectRate == connectRate) &&
            (identical(other.containmentRate, containmentRate) ||
                other.containmentRate == containmentRate) &&
            (identical(other.avgHandleTime, avgHandleTime) ||
                other.avgHandleTime == avgHandleTime) &&
            (identical(other.totalCost, totalCost) ||
                other.totalCost == totalCost));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, total, connectRate,
      containmentRate, avgHandleTime, totalCost);

  /// Create a copy of CallAnalyticsSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallAnalyticsSummaryImplCopyWith<_$CallAnalyticsSummaryImpl>
      get copyWith =>
          __$$CallAnalyticsSummaryImplCopyWithImpl<_$CallAnalyticsSummaryImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallAnalyticsSummaryImplToJson(
      this,
    );
  }
}

abstract class _CallAnalyticsSummary implements CallAnalyticsSummary {
  const factory _CallAnalyticsSummary(
          {final int total,
          @JsonKey(name: "connect_rate") final num connectRate,
          @JsonKey(name: "containment_rate") final num containmentRate,
          @JsonKey(name: "avg_handle_time") final num avgHandleTime,
          @JsonKey(name: "total_cost") final num totalCost}) =
      _$CallAnalyticsSummaryImpl;

  factory _CallAnalyticsSummary.fromJson(Map<String, dynamic> json) =
      _$CallAnalyticsSummaryImpl.fromJson;

  @override
  int get total;
  @override
  @JsonKey(name: "connect_rate")
  num get connectRate;
  @override
  @JsonKey(name: "containment_rate")
  num get containmentRate;
  @override
  @JsonKey(name: "avg_handle_time")
  num get avgHandleTime;
  @override
  @JsonKey(name: "total_cost")
  num get totalCost;

  /// Create a copy of CallAnalyticsSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallAnalyticsSummaryImplCopyWith<_$CallAnalyticsSummaryImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CallDayPoint _$CallDayPointFromJson(Map<String, dynamic> json) {
  return _CallDayPoint.fromJson(json);
}

/// @nodoc
mixin _$CallDayPoint {
  String get date => throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;
  num get cost => throw _privateConstructorUsedError;

  /// Serializes this CallDayPoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallDayPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallDayPointCopyWith<CallDayPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallDayPointCopyWith<$Res> {
  factory $CallDayPointCopyWith(
          CallDayPoint value, $Res Function(CallDayPoint) then) =
      _$CallDayPointCopyWithImpl<$Res, CallDayPoint>;
  @useResult
  $Res call({String date, int count, num cost});
}

/// @nodoc
class _$CallDayPointCopyWithImpl<$Res, $Val extends CallDayPoint>
    implements $CallDayPointCopyWith<$Res> {
  _$CallDayPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallDayPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? count = null,
    Object? cost = null,
  }) {
    return _then(_value.copyWith(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CallDayPointImplCopyWith<$Res>
    implements $CallDayPointCopyWith<$Res> {
  factory _$$CallDayPointImplCopyWith(
          _$CallDayPointImpl value, $Res Function(_$CallDayPointImpl) then) =
      __$$CallDayPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String date, int count, num cost});
}

/// @nodoc
class __$$CallDayPointImplCopyWithImpl<$Res>
    extends _$CallDayPointCopyWithImpl<$Res, _$CallDayPointImpl>
    implements _$$CallDayPointImplCopyWith<$Res> {
  __$$CallDayPointImplCopyWithImpl(
      _$CallDayPointImpl _value, $Res Function(_$CallDayPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallDayPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? count = null,
    Object? cost = null,
  }) {
    return _then(_$CallDayPointImpl(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallDayPointImpl implements _CallDayPoint {
  const _$CallDayPointImpl({this.date = "", this.count = 0, this.cost = 0});

  factory _$CallDayPointImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallDayPointImplFromJson(json);

  @override
  @JsonKey()
  final String date;
  @override
  @JsonKey()
  final int count;
  @override
  @JsonKey()
  final num cost;

  @override
  String toString() {
    return 'CallDayPoint(date: $date, count: $count, cost: $cost)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallDayPointImpl &&
            (identical(other.date, date) || other.date == date) &&
            (identical(other.count, count) || other.count == count) &&
            (identical(other.cost, cost) || other.cost == cost));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, date, count, cost);

  /// Create a copy of CallDayPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallDayPointImplCopyWith<_$CallDayPointImpl> get copyWith =>
      __$$CallDayPointImplCopyWithImpl<_$CallDayPointImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallDayPointImplToJson(
      this,
    );
  }
}

abstract class _CallDayPoint implements CallDayPoint {
  const factory _CallDayPoint(
      {final String date,
      final int count,
      final num cost}) = _$CallDayPointImpl;

  factory _CallDayPoint.fromJson(Map<String, dynamic> json) =
      _$CallDayPointImpl.fromJson;

  @override
  String get date;
  @override
  int get count;
  @override
  num get cost;

  /// Create a copy of CallDayPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallDayPointImplCopyWith<_$CallDayPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CallCenterAnalytics _$CallCenterAnalyticsFromJson(Map<String, dynamic> json) {
  return _CallCenterAnalytics.fromJson(json);
}

/// @nodoc
mixin _$CallCenterAnalytics {
  CallAnalyticsSummary get summary => throw _privateConstructorUsedError;
  Map<String, num> get outcomes => throw _privateConstructorUsedError;
  @JsonKey(name: "by_status")
  Map<String, num> get byStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "by_day")
  List<CallDayPoint> get byDay => throw _privateConstructorUsedError;
  Map<String, num> get sentiment => throw _privateConstructorUsedError;
  @JsonKey(name: "kpis_note")
  String get kpisNote => throw _privateConstructorUsedError;

  /// Serializes this CallCenterAnalytics to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CallCenterAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CallCenterAnalyticsCopyWith<CallCenterAnalytics> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CallCenterAnalyticsCopyWith<$Res> {
  factory $CallCenterAnalyticsCopyWith(
          CallCenterAnalytics value, $Res Function(CallCenterAnalytics) then) =
      _$CallCenterAnalyticsCopyWithImpl<$Res, CallCenterAnalytics>;
  @useResult
  $Res call(
      {CallAnalyticsSummary summary,
      Map<String, num> outcomes,
      @JsonKey(name: "by_status") Map<String, num> byStatus,
      @JsonKey(name: "by_day") List<CallDayPoint> byDay,
      Map<String, num> sentiment,
      @JsonKey(name: "kpis_note") String kpisNote});

  $CallAnalyticsSummaryCopyWith<$Res> get summary;
}

/// @nodoc
class _$CallCenterAnalyticsCopyWithImpl<$Res, $Val extends CallCenterAnalytics>
    implements $CallCenterAnalyticsCopyWith<$Res> {
  _$CallCenterAnalyticsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CallCenterAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? summary = null,
    Object? outcomes = null,
    Object? byStatus = null,
    Object? byDay = null,
    Object? sentiment = null,
    Object? kpisNote = null,
  }) {
    return _then(_value.copyWith(
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as CallAnalyticsSummary,
      outcomes: null == outcomes
          ? _value.outcomes
          : outcomes // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
      byStatus: null == byStatus
          ? _value.byStatus
          : byStatus // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
      byDay: null == byDay
          ? _value.byDay
          : byDay // ignore: cast_nullable_to_non_nullable
              as List<CallDayPoint>,
      sentiment: null == sentiment
          ? _value.sentiment
          : sentiment // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
      kpisNote: null == kpisNote
          ? _value.kpisNote
          : kpisNote // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }

  /// Create a copy of CallCenterAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CallAnalyticsSummaryCopyWith<$Res> get summary {
    return $CallAnalyticsSummaryCopyWith<$Res>(_value.summary, (value) {
      return _then(_value.copyWith(summary: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CallCenterAnalyticsImplCopyWith<$Res>
    implements $CallCenterAnalyticsCopyWith<$Res> {
  factory _$$CallCenterAnalyticsImplCopyWith(_$CallCenterAnalyticsImpl value,
          $Res Function(_$CallCenterAnalyticsImpl) then) =
      __$$CallCenterAnalyticsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {CallAnalyticsSummary summary,
      Map<String, num> outcomes,
      @JsonKey(name: "by_status") Map<String, num> byStatus,
      @JsonKey(name: "by_day") List<CallDayPoint> byDay,
      Map<String, num> sentiment,
      @JsonKey(name: "kpis_note") String kpisNote});

  @override
  $CallAnalyticsSummaryCopyWith<$Res> get summary;
}

/// @nodoc
class __$$CallCenterAnalyticsImplCopyWithImpl<$Res>
    extends _$CallCenterAnalyticsCopyWithImpl<$Res, _$CallCenterAnalyticsImpl>
    implements _$$CallCenterAnalyticsImplCopyWith<$Res> {
  __$$CallCenterAnalyticsImplCopyWithImpl(_$CallCenterAnalyticsImpl _value,
      $Res Function(_$CallCenterAnalyticsImpl) _then)
      : super(_value, _then);

  /// Create a copy of CallCenterAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? summary = null,
    Object? outcomes = null,
    Object? byStatus = null,
    Object? byDay = null,
    Object? sentiment = null,
    Object? kpisNote = null,
  }) {
    return _then(_$CallCenterAnalyticsImpl(
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as CallAnalyticsSummary,
      outcomes: null == outcomes
          ? _value._outcomes
          : outcomes // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
      byStatus: null == byStatus
          ? _value._byStatus
          : byStatus // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
      byDay: null == byDay
          ? _value._byDay
          : byDay // ignore: cast_nullable_to_non_nullable
              as List<CallDayPoint>,
      sentiment: null == sentiment
          ? _value._sentiment
          : sentiment // ignore: cast_nullable_to_non_nullable
              as Map<String, num>,
      kpisNote: null == kpisNote
          ? _value.kpisNote
          : kpisNote // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CallCenterAnalyticsImpl implements _CallCenterAnalytics {
  const _$CallCenterAnalyticsImpl(
      {this.summary = const CallAnalyticsSummary(),
      final Map<String, num> outcomes = const <String, num>{},
      @JsonKey(name: "by_status")
      final Map<String, num> byStatus = const <String, num>{},
      @JsonKey(name: "by_day")
      final List<CallDayPoint> byDay = const <CallDayPoint>[],
      final Map<String, num> sentiment = const <String, num>{},
      @JsonKey(name: "kpis_note") this.kpisNote = ""})
      : _outcomes = outcomes,
        _byStatus = byStatus,
        _byDay = byDay,
        _sentiment = sentiment;

  factory _$CallCenterAnalyticsImpl.fromJson(Map<String, dynamic> json) =>
      _$$CallCenterAnalyticsImplFromJson(json);

  @override
  @JsonKey()
  final CallAnalyticsSummary summary;
  final Map<String, num> _outcomes;
  @override
  @JsonKey()
  Map<String, num> get outcomes {
    if (_outcomes is EqualUnmodifiableMapView) return _outcomes;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_outcomes);
  }

  final Map<String, num> _byStatus;
  @override
  @JsonKey(name: "by_status")
  Map<String, num> get byStatus {
    if (_byStatus is EqualUnmodifiableMapView) return _byStatus;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_byStatus);
  }

  final List<CallDayPoint> _byDay;
  @override
  @JsonKey(name: "by_day")
  List<CallDayPoint> get byDay {
    if (_byDay is EqualUnmodifiableListView) return _byDay;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_byDay);
  }

  final Map<String, num> _sentiment;
  @override
  @JsonKey()
  Map<String, num> get sentiment {
    if (_sentiment is EqualUnmodifiableMapView) return _sentiment;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_sentiment);
  }

  @override
  @JsonKey(name: "kpis_note")
  final String kpisNote;

  @override
  String toString() {
    return 'CallCenterAnalytics(summary: $summary, outcomes: $outcomes, byStatus: $byStatus, byDay: $byDay, sentiment: $sentiment, kpisNote: $kpisNote)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CallCenterAnalyticsImpl &&
            (identical(other.summary, summary) || other.summary == summary) &&
            const DeepCollectionEquality().equals(other._outcomes, _outcomes) &&
            const DeepCollectionEquality().equals(other._byStatus, _byStatus) &&
            const DeepCollectionEquality().equals(other._byDay, _byDay) &&
            const DeepCollectionEquality()
                .equals(other._sentiment, _sentiment) &&
            (identical(other.kpisNote, kpisNote) ||
                other.kpisNote == kpisNote));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      summary,
      const DeepCollectionEquality().hash(_outcomes),
      const DeepCollectionEquality().hash(_byStatus),
      const DeepCollectionEquality().hash(_byDay),
      const DeepCollectionEquality().hash(_sentiment),
      kpisNote);

  /// Create a copy of CallCenterAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CallCenterAnalyticsImplCopyWith<_$CallCenterAnalyticsImpl> get copyWith =>
      __$$CallCenterAnalyticsImplCopyWithImpl<_$CallCenterAnalyticsImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CallCenterAnalyticsImplToJson(
      this,
    );
  }
}

abstract class _CallCenterAnalytics implements CallCenterAnalytics {
  const factory _CallCenterAnalytics(
          {final CallAnalyticsSummary summary,
          final Map<String, num> outcomes,
          @JsonKey(name: "by_status") final Map<String, num> byStatus,
          @JsonKey(name: "by_day") final List<CallDayPoint> byDay,
          final Map<String, num> sentiment,
          @JsonKey(name: "kpis_note") final String kpisNote}) =
      _$CallCenterAnalyticsImpl;

  factory _CallCenterAnalytics.fromJson(Map<String, dynamic> json) =
      _$CallCenterAnalyticsImpl.fromJson;

  @override
  CallAnalyticsSummary get summary;
  @override
  Map<String, num> get outcomes;
  @override
  @JsonKey(name: "by_status")
  Map<String, num> get byStatus;
  @override
  @JsonKey(name: "by_day")
  List<CallDayPoint> get byDay;
  @override
  Map<String, num> get sentiment;
  @override
  @JsonKey(name: "kpis_note")
  String get kpisNote;

  /// Create a copy of CallCenterAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CallCenterAnalyticsImplCopyWith<_$CallCenterAnalyticsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PhoneNumbersResult _$PhoneNumbersResultFromJson(Map<String, dynamic> json) {
  return _PhoneNumbersResult.fromJson(json);
}

/// @nodoc
mixin _$PhoneNumbersResult {
  @JsonKey(name: "phone_numbers")
  List<CallPhoneNumber> get phoneNumbers => throw _privateConstructorUsedError;
  Map<String, bool> get providers => throw _privateConstructorUsedError;
  @JsonKey(name: "monthly_credits")
  num get monthlyCredits => throw _privateConstructorUsedError;

  /// Serializes this PhoneNumbersResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PhoneNumbersResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PhoneNumbersResultCopyWith<PhoneNumbersResult> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PhoneNumbersResultCopyWith<$Res> {
  factory $PhoneNumbersResultCopyWith(
          PhoneNumbersResult value, $Res Function(PhoneNumbersResult) then) =
      _$PhoneNumbersResultCopyWithImpl<$Res, PhoneNumbersResult>;
  @useResult
  $Res call(
      {@JsonKey(name: "phone_numbers") List<CallPhoneNumber> phoneNumbers,
      Map<String, bool> providers,
      @JsonKey(name: "monthly_credits") num monthlyCredits});
}

/// @nodoc
class _$PhoneNumbersResultCopyWithImpl<$Res, $Val extends PhoneNumbersResult>
    implements $PhoneNumbersResultCopyWith<$Res> {
  _$PhoneNumbersResultCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PhoneNumbersResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phoneNumbers = null,
    Object? providers = null,
    Object? monthlyCredits = null,
  }) {
    return _then(_value.copyWith(
      phoneNumbers: null == phoneNumbers
          ? _value.phoneNumbers
          : phoneNumbers // ignore: cast_nullable_to_non_nullable
              as List<CallPhoneNumber>,
      providers: null == providers
          ? _value.providers
          : providers // ignore: cast_nullable_to_non_nullable
              as Map<String, bool>,
      monthlyCredits: null == monthlyCredits
          ? _value.monthlyCredits
          : monthlyCredits // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PhoneNumbersResultImplCopyWith<$Res>
    implements $PhoneNumbersResultCopyWith<$Res> {
  factory _$$PhoneNumbersResultImplCopyWith(_$PhoneNumbersResultImpl value,
          $Res Function(_$PhoneNumbersResultImpl) then) =
      __$$PhoneNumbersResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "phone_numbers") List<CallPhoneNumber> phoneNumbers,
      Map<String, bool> providers,
      @JsonKey(name: "monthly_credits") num monthlyCredits});
}

/// @nodoc
class __$$PhoneNumbersResultImplCopyWithImpl<$Res>
    extends _$PhoneNumbersResultCopyWithImpl<$Res, _$PhoneNumbersResultImpl>
    implements _$$PhoneNumbersResultImplCopyWith<$Res> {
  __$$PhoneNumbersResultImplCopyWithImpl(_$PhoneNumbersResultImpl _value,
      $Res Function(_$PhoneNumbersResultImpl) _then)
      : super(_value, _then);

  /// Create a copy of PhoneNumbersResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phoneNumbers = null,
    Object? providers = null,
    Object? monthlyCredits = null,
  }) {
    return _then(_$PhoneNumbersResultImpl(
      phoneNumbers: null == phoneNumbers
          ? _value._phoneNumbers
          : phoneNumbers // ignore: cast_nullable_to_non_nullable
              as List<CallPhoneNumber>,
      providers: null == providers
          ? _value._providers
          : providers // ignore: cast_nullable_to_non_nullable
              as Map<String, bool>,
      monthlyCredits: null == monthlyCredits
          ? _value.monthlyCredits
          : monthlyCredits // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PhoneNumbersResultImpl implements _PhoneNumbersResult {
  const _$PhoneNumbersResultImpl(
      {@JsonKey(name: "phone_numbers")
      final List<CallPhoneNumber> phoneNumbers = const <CallPhoneNumber>[],
      final Map<String, bool> providers = const <String, bool>{},
      @JsonKey(name: "monthly_credits") this.monthlyCredits = 0})
      : _phoneNumbers = phoneNumbers,
        _providers = providers;

  factory _$PhoneNumbersResultImpl.fromJson(Map<String, dynamic> json) =>
      _$$PhoneNumbersResultImplFromJson(json);

  final List<CallPhoneNumber> _phoneNumbers;
  @override
  @JsonKey(name: "phone_numbers")
  List<CallPhoneNumber> get phoneNumbers {
    if (_phoneNumbers is EqualUnmodifiableListView) return _phoneNumbers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_phoneNumbers);
  }

  final Map<String, bool> _providers;
  @override
  @JsonKey()
  Map<String, bool> get providers {
    if (_providers is EqualUnmodifiableMapView) return _providers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_providers);
  }

  @override
  @JsonKey(name: "monthly_credits")
  final num monthlyCredits;

  @override
  String toString() {
    return 'PhoneNumbersResult(phoneNumbers: $phoneNumbers, providers: $providers, monthlyCredits: $monthlyCredits)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PhoneNumbersResultImpl &&
            const DeepCollectionEquality()
                .equals(other._phoneNumbers, _phoneNumbers) &&
            const DeepCollectionEquality()
                .equals(other._providers, _providers) &&
            (identical(other.monthlyCredits, monthlyCredits) ||
                other.monthlyCredits == monthlyCredits));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_phoneNumbers),
      const DeepCollectionEquality().hash(_providers),
      monthlyCredits);

  /// Create a copy of PhoneNumbersResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PhoneNumbersResultImplCopyWith<_$PhoneNumbersResultImpl> get copyWith =>
      __$$PhoneNumbersResultImplCopyWithImpl<_$PhoneNumbersResultImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PhoneNumbersResultImplToJson(
      this,
    );
  }
}

abstract class _PhoneNumbersResult implements PhoneNumbersResult {
  const factory _PhoneNumbersResult(
      {@JsonKey(name: "phone_numbers") final List<CallPhoneNumber> phoneNumbers,
      final Map<String, bool> providers,
      @JsonKey(name: "monthly_credits")
      final num monthlyCredits}) = _$PhoneNumbersResultImpl;

  factory _PhoneNumbersResult.fromJson(Map<String, dynamic> json) =
      _$PhoneNumbersResultImpl.fromJson;

  @override
  @JsonKey(name: "phone_numbers")
  List<CallPhoneNumber> get phoneNumbers;
  @override
  Map<String, bool> get providers;
  @override
  @JsonKey(name: "monthly_credits")
  num get monthlyCredits;

  /// Create a copy of PhoneNumbersResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PhoneNumbersResultImplCopyWith<_$PhoneNumbersResultImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
