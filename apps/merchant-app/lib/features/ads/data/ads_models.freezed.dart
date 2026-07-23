// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ads_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AdsConnection _$AdsConnectionFromJson(Map<String, dynamic> json) {
  return _AdsConnection.fromJson(json);
}

/// @nodoc
mixin _$AdsConnection {
  String get id => throw _privateConstructorUsedError;
  String get platform => throw _privateConstructorUsedError;
  @JsonKey(name: "display_name")
  String? get displayName => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  List<String>? get scopes => throw _privateConstructorUsedError;
  @JsonKey(name: "expires_at")
  String? get expiresAt => throw _privateConstructorUsedError;
  @JsonKey(name: "connected_at")
  String? get connectedAt => throw _privateConstructorUsedError;

  /// Serializes this AdsConnection to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsConnection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsConnectionCopyWith<AdsConnection> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsConnectionCopyWith<$Res> {
  factory $AdsConnectionCopyWith(
          AdsConnection value, $Res Function(AdsConnection) then) =
      _$AdsConnectionCopyWithImpl<$Res, AdsConnection>;
  @useResult
  $Res call(
      {String id,
      String platform,
      @JsonKey(name: "display_name") String? displayName,
      String status,
      List<String>? scopes,
      @JsonKey(name: "expires_at") String? expiresAt,
      @JsonKey(name: "connected_at") String? connectedAt});
}

/// @nodoc
class _$AdsConnectionCopyWithImpl<$Res, $Val extends AdsConnection>
    implements $AdsConnectionCopyWith<$Res> {
  _$AdsConnectionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsConnection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? platform = null,
    Object? displayName = freezed,
    Object? status = null,
    Object? scopes = freezed,
    Object? expiresAt = freezed,
    Object? connectedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      displayName: freezed == displayName
          ? _value.displayName
          : displayName // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      scopes: freezed == scopes
          ? _value.scopes
          : scopes // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      expiresAt: freezed == expiresAt
          ? _value.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as String?,
      connectedAt: freezed == connectedAt
          ? _value.connectedAt
          : connectedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsConnectionImplCopyWith<$Res>
    implements $AdsConnectionCopyWith<$Res> {
  factory _$$AdsConnectionImplCopyWith(
          _$AdsConnectionImpl value, $Res Function(_$AdsConnectionImpl) then) =
      __$$AdsConnectionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String platform,
      @JsonKey(name: "display_name") String? displayName,
      String status,
      List<String>? scopes,
      @JsonKey(name: "expires_at") String? expiresAt,
      @JsonKey(name: "connected_at") String? connectedAt});
}

/// @nodoc
class __$$AdsConnectionImplCopyWithImpl<$Res>
    extends _$AdsConnectionCopyWithImpl<$Res, _$AdsConnectionImpl>
    implements _$$AdsConnectionImplCopyWith<$Res> {
  __$$AdsConnectionImplCopyWithImpl(
      _$AdsConnectionImpl _value, $Res Function(_$AdsConnectionImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsConnection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? platform = null,
    Object? displayName = freezed,
    Object? status = null,
    Object? scopes = freezed,
    Object? expiresAt = freezed,
    Object? connectedAt = freezed,
  }) {
    return _then(_$AdsConnectionImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      displayName: freezed == displayName
          ? _value.displayName
          : displayName // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      scopes: freezed == scopes
          ? _value._scopes
          : scopes // ignore: cast_nullable_to_non_nullable
              as List<String>?,
      expiresAt: freezed == expiresAt
          ? _value.expiresAt
          : expiresAt // ignore: cast_nullable_to_non_nullable
              as String?,
      connectedAt: freezed == connectedAt
          ? _value.connectedAt
          : connectedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsConnectionImpl implements _AdsConnection {
  const _$AdsConnectionImpl(
      {this.id = "",
      this.platform = "",
      @JsonKey(name: "display_name") this.displayName,
      this.status = "",
      final List<String>? scopes,
      @JsonKey(name: "expires_at") this.expiresAt,
      @JsonKey(name: "connected_at") this.connectedAt})
      : _scopes = scopes;

  factory _$AdsConnectionImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsConnectionImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey(name: "display_name")
  final String? displayName;
  @override
  @JsonKey()
  final String status;
  final List<String>? _scopes;
  @override
  List<String>? get scopes {
    final value = _scopes;
    if (value == null) return null;
    if (_scopes is EqualUnmodifiableListView) return _scopes;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  @JsonKey(name: "expires_at")
  final String? expiresAt;
  @override
  @JsonKey(name: "connected_at")
  final String? connectedAt;

  @override
  String toString() {
    return 'AdsConnection(id: $id, platform: $platform, displayName: $displayName, status: $status, scopes: $scopes, expiresAt: $expiresAt, connectedAt: $connectedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsConnectionImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.displayName, displayName) ||
                other.displayName == displayName) &&
            (identical(other.status, status) || other.status == status) &&
            const DeepCollectionEquality().equals(other._scopes, _scopes) &&
            (identical(other.expiresAt, expiresAt) ||
                other.expiresAt == expiresAt) &&
            (identical(other.connectedAt, connectedAt) ||
                other.connectedAt == connectedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      platform,
      displayName,
      status,
      const DeepCollectionEquality().hash(_scopes),
      expiresAt,
      connectedAt);

  /// Create a copy of AdsConnection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsConnectionImplCopyWith<_$AdsConnectionImpl> get copyWith =>
      __$$AdsConnectionImplCopyWithImpl<_$AdsConnectionImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsConnectionImplToJson(
      this,
    );
  }
}

abstract class _AdsConnection implements AdsConnection {
  const factory _AdsConnection(
          {final String id,
          final String platform,
          @JsonKey(name: "display_name") final String? displayName,
          final String status,
          final List<String>? scopes,
          @JsonKey(name: "expires_at") final String? expiresAt,
          @JsonKey(name: "connected_at") final String? connectedAt}) =
      _$AdsConnectionImpl;

  factory _AdsConnection.fromJson(Map<String, dynamic> json) =
      _$AdsConnectionImpl.fromJson;

  @override
  String get id;
  @override
  String get platform;
  @override
  @JsonKey(name: "display_name")
  String? get displayName;
  @override
  String get status;
  @override
  List<String>? get scopes;
  @override
  @JsonKey(name: "expires_at")
  String? get expiresAt;
  @override
  @JsonKey(name: "connected_at")
  String? get connectedAt;

  /// Create a copy of AdsConnection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsConnectionImplCopyWith<_$AdsConnectionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsAccount _$AdsAccountFromJson(Map<String, dynamic> json) {
  return _AdsAccount.fromJson(json);
}

/// @nodoc
mixin _$AdsAccount {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "connection_id")
  String get connectionId => throw _privateConstructorUsedError;
  String get platform => throw _privateConstructorUsedError;
  @JsonKey(name: "external_id")
  String get externalId => throw _privateConstructorUsedError;
  String? get name => throw _privateConstructorUsedError;
  String? get currency => throw _privateConstructorUsedError;
  String? get timezone => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  bool get selected => throw _privateConstructorUsedError;
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt => throw _privateConstructorUsedError;

  /// Serializes this AdsAccount to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsAccount
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsAccountCopyWith<AdsAccount> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsAccountCopyWith<$Res> {
  factory $AdsAccountCopyWith(
          AdsAccount value, $Res Function(AdsAccount) then) =
      _$AdsAccountCopyWithImpl<$Res, AdsAccount>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "connection_id") String connectionId,
      String platform,
      @JsonKey(name: "external_id") String externalId,
      String? name,
      String? currency,
      String? timezone,
      String status,
      bool selected,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt});
}

/// @nodoc
class _$AdsAccountCopyWithImpl<$Res, $Val extends AdsAccount>
    implements $AdsAccountCopyWith<$Res> {
  _$AdsAccountCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsAccount
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? connectionId = null,
    Object? platform = null,
    Object? externalId = null,
    Object? name = freezed,
    Object? currency = freezed,
    Object? timezone = freezed,
    Object? status = null,
    Object? selected = null,
    Object? lastSyncedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      connectionId: null == connectionId
          ? _value.connectionId
          : connectionId // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: null == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      timezone: freezed == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      selected: null == selected
          ? _value.selected
          : selected // ignore: cast_nullable_to_non_nullable
              as bool,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsAccountImplCopyWith<$Res>
    implements $AdsAccountCopyWith<$Res> {
  factory _$$AdsAccountImplCopyWith(
          _$AdsAccountImpl value, $Res Function(_$AdsAccountImpl) then) =
      __$$AdsAccountImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "connection_id") String connectionId,
      String platform,
      @JsonKey(name: "external_id") String externalId,
      String? name,
      String? currency,
      String? timezone,
      String status,
      bool selected,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt});
}

/// @nodoc
class __$$AdsAccountImplCopyWithImpl<$Res>
    extends _$AdsAccountCopyWithImpl<$Res, _$AdsAccountImpl>
    implements _$$AdsAccountImplCopyWith<$Res> {
  __$$AdsAccountImplCopyWithImpl(
      _$AdsAccountImpl _value, $Res Function(_$AdsAccountImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsAccount
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? connectionId = null,
    Object? platform = null,
    Object? externalId = null,
    Object? name = freezed,
    Object? currency = freezed,
    Object? timezone = freezed,
    Object? status = null,
    Object? selected = null,
    Object? lastSyncedAt = freezed,
  }) {
    return _then(_$AdsAccountImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      connectionId: null == connectionId
          ? _value.connectionId
          : connectionId // ignore: cast_nullable_to_non_nullable
              as String,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: null == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      timezone: freezed == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      selected: null == selected
          ? _value.selected
          : selected // ignore: cast_nullable_to_non_nullable
              as bool,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsAccountImpl implements _AdsAccount {
  const _$AdsAccountImpl(
      {this.id = "",
      @JsonKey(name: "connection_id") this.connectionId = "",
      this.platform = "",
      @JsonKey(name: "external_id") this.externalId = "",
      this.name,
      this.currency,
      this.timezone,
      this.status = "",
      this.selected = false,
      @JsonKey(name: "last_synced_at") this.lastSyncedAt});

  factory _$AdsAccountImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsAccountImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "connection_id")
  final String connectionId;
  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey(name: "external_id")
  final String externalId;
  @override
  final String? name;
  @override
  final String? currency;
  @override
  final String? timezone;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey()
  final bool selected;
  @override
  @JsonKey(name: "last_synced_at")
  final String? lastSyncedAt;

  @override
  String toString() {
    return 'AdsAccount(id: $id, connectionId: $connectionId, platform: $platform, externalId: $externalId, name: $name, currency: $currency, timezone: $timezone, status: $status, selected: $selected, lastSyncedAt: $lastSyncedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsAccountImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.connectionId, connectionId) ||
                other.connectionId == connectionId) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.externalId, externalId) ||
                other.externalId == externalId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.timezone, timezone) ||
                other.timezone == timezone) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.selected, selected) ||
                other.selected == selected) &&
            (identical(other.lastSyncedAt, lastSyncedAt) ||
                other.lastSyncedAt == lastSyncedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, connectionId, platform,
      externalId, name, currency, timezone, status, selected, lastSyncedAt);

  /// Create a copy of AdsAccount
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsAccountImplCopyWith<_$AdsAccountImpl> get copyWith =>
      __$$AdsAccountImplCopyWithImpl<_$AdsAccountImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsAccountImplToJson(
      this,
    );
  }
}

abstract class _AdsAccount implements AdsAccount {
  const factory _AdsAccount(
          {final String id,
          @JsonKey(name: "connection_id") final String connectionId,
          final String platform,
          @JsonKey(name: "external_id") final String externalId,
          final String? name,
          final String? currency,
          final String? timezone,
          final String status,
          final bool selected,
          @JsonKey(name: "last_synced_at") final String? lastSyncedAt}) =
      _$AdsAccountImpl;

  factory _AdsAccount.fromJson(Map<String, dynamic> json) =
      _$AdsAccountImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "connection_id")
  String get connectionId;
  @override
  String get platform;
  @override
  @JsonKey(name: "external_id")
  String get externalId;
  @override
  String? get name;
  @override
  String? get currency;
  @override
  String? get timezone;
  @override
  String get status;
  @override
  bool get selected;
  @override
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt;

  /// Create a copy of AdsAccount
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsAccountImplCopyWith<_$AdsAccountImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsPlatformInfo _$AdsPlatformInfoFromJson(Map<String, dynamic> json) {
  return _AdsPlatformInfo.fromJson(json);
}

/// @nodoc
mixin _$AdsPlatformInfo {
  String get platform => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  String get connect => throw _privateConstructorUsedError;
  bool get configured => throw _privateConstructorUsedError;

  /// Serializes this AdsPlatformInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsPlatformInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsPlatformInfoCopyWith<AdsPlatformInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsPlatformInfoCopyWith<$Res> {
  factory $AdsPlatformInfoCopyWith(
          AdsPlatformInfo value, $Res Function(AdsPlatformInfo) then) =
      _$AdsPlatformInfoCopyWithImpl<$Res, AdsPlatformInfo>;
  @useResult
  $Res call({String platform, String label, String connect, bool configured});
}

/// @nodoc
class _$AdsPlatformInfoCopyWithImpl<$Res, $Val extends AdsPlatformInfo>
    implements $AdsPlatformInfoCopyWith<$Res> {
  _$AdsPlatformInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsPlatformInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? label = null,
    Object? connect = null,
    Object? configured = null,
  }) {
    return _then(_value.copyWith(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      connect: null == connect
          ? _value.connect
          : connect // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsPlatformInfoImplCopyWith<$Res>
    implements $AdsPlatformInfoCopyWith<$Res> {
  factory _$$AdsPlatformInfoImplCopyWith(_$AdsPlatformInfoImpl value,
          $Res Function(_$AdsPlatformInfoImpl) then) =
      __$$AdsPlatformInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String platform, String label, String connect, bool configured});
}

/// @nodoc
class __$$AdsPlatformInfoImplCopyWithImpl<$Res>
    extends _$AdsPlatformInfoCopyWithImpl<$Res, _$AdsPlatformInfoImpl>
    implements _$$AdsPlatformInfoImplCopyWith<$Res> {
  __$$AdsPlatformInfoImplCopyWithImpl(
      _$AdsPlatformInfoImpl _value, $Res Function(_$AdsPlatformInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsPlatformInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? label = null,
    Object? connect = null,
    Object? configured = null,
  }) {
    return _then(_$AdsPlatformInfoImpl(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      connect: null == connect
          ? _value.connect
          : connect // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsPlatformInfoImpl implements _AdsPlatformInfo {
  const _$AdsPlatformInfoImpl(
      {this.platform = "",
      this.label = "",
      this.connect = "oauth",
      this.configured = false});

  factory _$AdsPlatformInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsPlatformInfoImplFromJson(json);

  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final String connect;
  @override
  @JsonKey()
  final bool configured;

  @override
  String toString() {
    return 'AdsPlatformInfo(platform: $platform, label: $label, connect: $connect, configured: $configured)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsPlatformInfoImpl &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.connect, connect) || other.connect == connect) &&
            (identical(other.configured, configured) ||
                other.configured == configured));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, platform, label, connect, configured);

  /// Create a copy of AdsPlatformInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsPlatformInfoImplCopyWith<_$AdsPlatformInfoImpl> get copyWith =>
      __$$AdsPlatformInfoImplCopyWithImpl<_$AdsPlatformInfoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsPlatformInfoImplToJson(
      this,
    );
  }
}

abstract class _AdsPlatformInfo implements AdsPlatformInfo {
  const factory _AdsPlatformInfo(
      {final String platform,
      final String label,
      final String connect,
      final bool configured}) = _$AdsPlatformInfoImpl;

  factory _AdsPlatformInfo.fromJson(Map<String, dynamic> json) =
      _$AdsPlatformInfoImpl.fromJson;

  @override
  String get platform;
  @override
  String get label;
  @override
  String get connect;
  @override
  bool get configured;

  /// Create a copy of AdsPlatformInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsPlatformInfoImplCopyWith<_$AdsPlatformInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsPage _$AdsPageFromJson(Map<String, dynamic> json) {
  return _AdsPage.fromJson(json);
}

/// @nodoc
mixin _$AdsPage {
  String get id => throw _privateConstructorUsedError;
  String? get name => throw _privateConstructorUsedError;

  /// Serializes this AdsPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsPageCopyWith<AdsPage> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsPageCopyWith<$Res> {
  factory $AdsPageCopyWith(AdsPage value, $Res Function(AdsPage) then) =
      _$AdsPageCopyWithImpl<$Res, AdsPage>;
  @useResult
  $Res call({String id, String? name});
}

/// @nodoc
class _$AdsPageCopyWithImpl<$Res, $Val extends AdsPage>
    implements $AdsPageCopyWith<$Res> {
  _$AdsPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsPageImplCopyWith<$Res> implements $AdsPageCopyWith<$Res> {
  factory _$$AdsPageImplCopyWith(
          _$AdsPageImpl value, $Res Function(_$AdsPageImpl) then) =
      __$$AdsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String? name});
}

/// @nodoc
class __$$AdsPageImplCopyWithImpl<$Res>
    extends _$AdsPageCopyWithImpl<$Res, _$AdsPageImpl>
    implements _$$AdsPageImplCopyWith<$Res> {
  __$$AdsPageImplCopyWithImpl(
      _$AdsPageImpl _value, $Res Function(_$AdsPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = freezed,
  }) {
    return _then(_$AdsPageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsPageImpl implements _AdsPage {
  const _$AdsPageImpl({this.id = "", this.name});

  factory _$AdsPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsPageImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  final String? name;

  @override
  String toString() {
    return 'AdsPage(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of AdsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsPageImplCopyWith<_$AdsPageImpl> get copyWith =>
      __$$AdsPageImplCopyWithImpl<_$AdsPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsPageImplToJson(
      this,
    );
  }
}

abstract class _AdsPage implements AdsPage {
  const factory _AdsPage({final String id, final String? name}) = _$AdsPageImpl;

  factory _AdsPage.fromJson(Map<String, dynamic> json) = _$AdsPageImpl.fromJson;

  @override
  String get id;
  @override
  String? get name;

  /// Create a copy of AdsPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsPageImplCopyWith<_$AdsPageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsCampaignRow _$AdsCampaignRowFromJson(Map<String, dynamic> json) {
  return _AdsCampaignRow.fromJson(json);
}

/// @nodoc
mixin _$AdsCampaignRow {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "external_id")
  String? get externalId => throw _privateConstructorUsedError;
  String get platform => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get objective => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "external_status")
  String? get externalStatus => throw _privateConstructorUsedError;
  String get source => throw _privateConstructorUsedError;
  @JsonKey(name: "daily_budget")
  num? get dailyBudget => throw _privateConstructorUsedError;
  @JsonKey(name: "lifetime_budget")
  num? get lifetimeBudget => throw _privateConstructorUsedError;
  String? get currency => throw _privateConstructorUsedError;
  num get spend => throw _privateConstructorUsedError;
  num get impressions => throw _privateConstructorUsedError;
  num get clicks => throw _privateConstructorUsedError;
  num get conversions => throw _privateConstructorUsedError;
  @JsonKey(name: "conversion_value")
  num get conversionValue => throw _privateConstructorUsedError;
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt => throw _privateConstructorUsedError;

  /// Serializes this AdsCampaignRow to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsCampaignRow
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsCampaignRowCopyWith<AdsCampaignRow> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsCampaignRowCopyWith<$Res> {
  factory $AdsCampaignRowCopyWith(
          AdsCampaignRow value, $Res Function(AdsCampaignRow) then) =
      _$AdsCampaignRowCopyWithImpl<$Res, AdsCampaignRow>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "external_id") String? externalId,
      String platform,
      String name,
      String? objective,
      String status,
      @JsonKey(name: "external_status") String? externalStatus,
      String source,
      @JsonKey(name: "daily_budget") num? dailyBudget,
      @JsonKey(name: "lifetime_budget") num? lifetimeBudget,
      String? currency,
      num spend,
      num impressions,
      num clicks,
      num conversions,
      @JsonKey(name: "conversion_value") num conversionValue,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt});
}

/// @nodoc
class _$AdsCampaignRowCopyWithImpl<$Res, $Val extends AdsCampaignRow>
    implements $AdsCampaignRowCopyWith<$Res> {
  _$AdsCampaignRowCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsCampaignRow
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? externalId = freezed,
    Object? platform = null,
    Object? name = null,
    Object? objective = freezed,
    Object? status = null,
    Object? externalStatus = freezed,
    Object? source = null,
    Object? dailyBudget = freezed,
    Object? lifetimeBudget = freezed,
    Object? currency = freezed,
    Object? spend = null,
    Object? impressions = null,
    Object? clicks = null,
    Object? conversions = null,
    Object? conversionValue = null,
    Object? lastSyncedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: freezed == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String?,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      objective: freezed == objective
          ? _value.objective
          : objective // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      externalStatus: freezed == externalStatus
          ? _value.externalStatus
          : externalStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      source: null == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String,
      dailyBudget: freezed == dailyBudget
          ? _value.dailyBudget
          : dailyBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      lifetimeBudget: freezed == lifetimeBudget
          ? _value.lifetimeBudget
          : lifetimeBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      impressions: null == impressions
          ? _value.impressions
          : impressions // ignore: cast_nullable_to_non_nullable
              as num,
      clicks: null == clicks
          ? _value.clicks
          : clicks // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
      conversionValue: null == conversionValue
          ? _value.conversionValue
          : conversionValue // ignore: cast_nullable_to_non_nullable
              as num,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsCampaignRowImplCopyWith<$Res>
    implements $AdsCampaignRowCopyWith<$Res> {
  factory _$$AdsCampaignRowImplCopyWith(_$AdsCampaignRowImpl value,
          $Res Function(_$AdsCampaignRowImpl) then) =
      __$$AdsCampaignRowImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "external_id") String? externalId,
      String platform,
      String name,
      String? objective,
      String status,
      @JsonKey(name: "external_status") String? externalStatus,
      String source,
      @JsonKey(name: "daily_budget") num? dailyBudget,
      @JsonKey(name: "lifetime_budget") num? lifetimeBudget,
      String? currency,
      num spend,
      num impressions,
      num clicks,
      num conversions,
      @JsonKey(name: "conversion_value") num conversionValue,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt});
}

/// @nodoc
class __$$AdsCampaignRowImplCopyWithImpl<$Res>
    extends _$AdsCampaignRowCopyWithImpl<$Res, _$AdsCampaignRowImpl>
    implements _$$AdsCampaignRowImplCopyWith<$Res> {
  __$$AdsCampaignRowImplCopyWithImpl(
      _$AdsCampaignRowImpl _value, $Res Function(_$AdsCampaignRowImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsCampaignRow
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? externalId = freezed,
    Object? platform = null,
    Object? name = null,
    Object? objective = freezed,
    Object? status = null,
    Object? externalStatus = freezed,
    Object? source = null,
    Object? dailyBudget = freezed,
    Object? lifetimeBudget = freezed,
    Object? currency = freezed,
    Object? spend = null,
    Object? impressions = null,
    Object? clicks = null,
    Object? conversions = null,
    Object? conversionValue = null,
    Object? lastSyncedAt = freezed,
  }) {
    return _then(_$AdsCampaignRowImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: freezed == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String?,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      objective: freezed == objective
          ? _value.objective
          : objective // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      externalStatus: freezed == externalStatus
          ? _value.externalStatus
          : externalStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      source: null == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String,
      dailyBudget: freezed == dailyBudget
          ? _value.dailyBudget
          : dailyBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      lifetimeBudget: freezed == lifetimeBudget
          ? _value.lifetimeBudget
          : lifetimeBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      impressions: null == impressions
          ? _value.impressions
          : impressions // ignore: cast_nullable_to_non_nullable
              as num,
      clicks: null == clicks
          ? _value.clicks
          : clicks // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
      conversionValue: null == conversionValue
          ? _value.conversionValue
          : conversionValue // ignore: cast_nullable_to_non_nullable
              as num,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsCampaignRowImpl implements _AdsCampaignRow {
  const _$AdsCampaignRowImpl(
      {this.id = "",
      @JsonKey(name: "external_id") this.externalId,
      this.platform = "",
      this.name = "",
      this.objective,
      this.status = "",
      @JsonKey(name: "external_status") this.externalStatus,
      this.source = "",
      @JsonKey(name: "daily_budget") this.dailyBudget,
      @JsonKey(name: "lifetime_budget") this.lifetimeBudget,
      this.currency,
      this.spend = 0,
      this.impressions = 0,
      this.clicks = 0,
      this.conversions = 0,
      @JsonKey(name: "conversion_value") this.conversionValue = 0,
      @JsonKey(name: "last_synced_at") this.lastSyncedAt});

  factory _$AdsCampaignRowImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsCampaignRowImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "external_id")
  final String? externalId;
  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey()
  final String name;
  @override
  final String? objective;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "external_status")
  final String? externalStatus;
  @override
  @JsonKey()
  final String source;
  @override
  @JsonKey(name: "daily_budget")
  final num? dailyBudget;
  @override
  @JsonKey(name: "lifetime_budget")
  final num? lifetimeBudget;
  @override
  final String? currency;
  @override
  @JsonKey()
  final num spend;
  @override
  @JsonKey()
  final num impressions;
  @override
  @JsonKey()
  final num clicks;
  @override
  @JsonKey()
  final num conversions;
  @override
  @JsonKey(name: "conversion_value")
  final num conversionValue;
  @override
  @JsonKey(name: "last_synced_at")
  final String? lastSyncedAt;

  @override
  String toString() {
    return 'AdsCampaignRow(id: $id, externalId: $externalId, platform: $platform, name: $name, objective: $objective, status: $status, externalStatus: $externalStatus, source: $source, dailyBudget: $dailyBudget, lifetimeBudget: $lifetimeBudget, currency: $currency, spend: $spend, impressions: $impressions, clicks: $clicks, conversions: $conversions, conversionValue: $conversionValue, lastSyncedAt: $lastSyncedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsCampaignRowImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.externalId, externalId) ||
                other.externalId == externalId) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.objective, objective) ||
                other.objective == objective) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.externalStatus, externalStatus) ||
                other.externalStatus == externalStatus) &&
            (identical(other.source, source) || other.source == source) &&
            (identical(other.dailyBudget, dailyBudget) ||
                other.dailyBudget == dailyBudget) &&
            (identical(other.lifetimeBudget, lifetimeBudget) ||
                other.lifetimeBudget == lifetimeBudget) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.spend, spend) || other.spend == spend) &&
            (identical(other.impressions, impressions) ||
                other.impressions == impressions) &&
            (identical(other.clicks, clicks) || other.clicks == clicks) &&
            (identical(other.conversions, conversions) ||
                other.conversions == conversions) &&
            (identical(other.conversionValue, conversionValue) ||
                other.conversionValue == conversionValue) &&
            (identical(other.lastSyncedAt, lastSyncedAt) ||
                other.lastSyncedAt == lastSyncedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      externalId,
      platform,
      name,
      objective,
      status,
      externalStatus,
      source,
      dailyBudget,
      lifetimeBudget,
      currency,
      spend,
      impressions,
      clicks,
      conversions,
      conversionValue,
      lastSyncedAt);

  /// Create a copy of AdsCampaignRow
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsCampaignRowImplCopyWith<_$AdsCampaignRowImpl> get copyWith =>
      __$$AdsCampaignRowImplCopyWithImpl<_$AdsCampaignRowImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsCampaignRowImplToJson(
      this,
    );
  }
}

abstract class _AdsCampaignRow implements AdsCampaignRow {
  const factory _AdsCampaignRow(
          {final String id,
          @JsonKey(name: "external_id") final String? externalId,
          final String platform,
          final String name,
          final String? objective,
          final String status,
          @JsonKey(name: "external_status") final String? externalStatus,
          final String source,
          @JsonKey(name: "daily_budget") final num? dailyBudget,
          @JsonKey(name: "lifetime_budget") final num? lifetimeBudget,
          final String? currency,
          final num spend,
          final num impressions,
          final num clicks,
          final num conversions,
          @JsonKey(name: "conversion_value") final num conversionValue,
          @JsonKey(name: "last_synced_at") final String? lastSyncedAt}) =
      _$AdsCampaignRowImpl;

  factory _AdsCampaignRow.fromJson(Map<String, dynamic> json) =
      _$AdsCampaignRowImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "external_id")
  String? get externalId;
  @override
  String get platform;
  @override
  String get name;
  @override
  String? get objective;
  @override
  String get status;
  @override
  @JsonKey(name: "external_status")
  String? get externalStatus;
  @override
  String get source;
  @override
  @JsonKey(name: "daily_budget")
  num? get dailyBudget;
  @override
  @JsonKey(name: "lifetime_budget")
  num? get lifetimeBudget;
  @override
  String? get currency;
  @override
  num get spend;
  @override
  num get impressions;
  @override
  num get clicks;
  @override
  num get conversions;
  @override
  @JsonKey(name: "conversion_value")
  num get conversionValue;
  @override
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt;

  /// Create a copy of AdsCampaignRow
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsCampaignRowImplCopyWith<_$AdsCampaignRowImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsTotals _$AdsTotalsFromJson(Map<String, dynamic> json) {
  return _AdsTotals.fromJson(json);
}

/// @nodoc
mixin _$AdsTotals {
  num get spend => throw _privateConstructorUsedError;
  num get impressions => throw _privateConstructorUsedError;
  num get clicks => throw _privateConstructorUsedError;
  num get conversions => throw _privateConstructorUsedError;
  @JsonKey(name: "conversion_value")
  num get conversionValue => throw _privateConstructorUsedError;
  num? get roas => throw _privateConstructorUsedError;
  String? get currency => throw _privateConstructorUsedError;

  /// Serializes this AdsTotals to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsTotals
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsTotalsCopyWith<AdsTotals> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsTotalsCopyWith<$Res> {
  factory $AdsTotalsCopyWith(AdsTotals value, $Res Function(AdsTotals) then) =
      _$AdsTotalsCopyWithImpl<$Res, AdsTotals>;
  @useResult
  $Res call(
      {num spend,
      num impressions,
      num clicks,
      num conversions,
      @JsonKey(name: "conversion_value") num conversionValue,
      num? roas,
      String? currency});
}

/// @nodoc
class _$AdsTotalsCopyWithImpl<$Res, $Val extends AdsTotals>
    implements $AdsTotalsCopyWith<$Res> {
  _$AdsTotalsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsTotals
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? spend = null,
    Object? impressions = null,
    Object? clicks = null,
    Object? conversions = null,
    Object? conversionValue = null,
    Object? roas = freezed,
    Object? currency = freezed,
  }) {
    return _then(_value.copyWith(
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      impressions: null == impressions
          ? _value.impressions
          : impressions // ignore: cast_nullable_to_non_nullable
              as num,
      clicks: null == clicks
          ? _value.clicks
          : clicks // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
      conversionValue: null == conversionValue
          ? _value.conversionValue
          : conversionValue // ignore: cast_nullable_to_non_nullable
              as num,
      roas: freezed == roas
          ? _value.roas
          : roas // ignore: cast_nullable_to_non_nullable
              as num?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsTotalsImplCopyWith<$Res>
    implements $AdsTotalsCopyWith<$Res> {
  factory _$$AdsTotalsImplCopyWith(
          _$AdsTotalsImpl value, $Res Function(_$AdsTotalsImpl) then) =
      __$$AdsTotalsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {num spend,
      num impressions,
      num clicks,
      num conversions,
      @JsonKey(name: "conversion_value") num conversionValue,
      num? roas,
      String? currency});
}

/// @nodoc
class __$$AdsTotalsImplCopyWithImpl<$Res>
    extends _$AdsTotalsCopyWithImpl<$Res, _$AdsTotalsImpl>
    implements _$$AdsTotalsImplCopyWith<$Res> {
  __$$AdsTotalsImplCopyWithImpl(
      _$AdsTotalsImpl _value, $Res Function(_$AdsTotalsImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsTotals
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? spend = null,
    Object? impressions = null,
    Object? clicks = null,
    Object? conversions = null,
    Object? conversionValue = null,
    Object? roas = freezed,
    Object? currency = freezed,
  }) {
    return _then(_$AdsTotalsImpl(
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      impressions: null == impressions
          ? _value.impressions
          : impressions // ignore: cast_nullable_to_non_nullable
              as num,
      clicks: null == clicks
          ? _value.clicks
          : clicks // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
      conversionValue: null == conversionValue
          ? _value.conversionValue
          : conversionValue // ignore: cast_nullable_to_non_nullable
              as num,
      roas: freezed == roas
          ? _value.roas
          : roas // ignore: cast_nullable_to_non_nullable
              as num?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsTotalsImpl implements _AdsTotals {
  const _$AdsTotalsImpl(
      {this.spend = 0,
      this.impressions = 0,
      this.clicks = 0,
      this.conversions = 0,
      @JsonKey(name: "conversion_value") this.conversionValue = 0,
      this.roas,
      this.currency});

  factory _$AdsTotalsImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsTotalsImplFromJson(json);

  @override
  @JsonKey()
  final num spend;
  @override
  @JsonKey()
  final num impressions;
  @override
  @JsonKey()
  final num clicks;
  @override
  @JsonKey()
  final num conversions;
  @override
  @JsonKey(name: "conversion_value")
  final num conversionValue;
  @override
  final num? roas;
  @override
  final String? currency;

  @override
  String toString() {
    return 'AdsTotals(spend: $spend, impressions: $impressions, clicks: $clicks, conversions: $conversions, conversionValue: $conversionValue, roas: $roas, currency: $currency)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsTotalsImpl &&
            (identical(other.spend, spend) || other.spend == spend) &&
            (identical(other.impressions, impressions) ||
                other.impressions == impressions) &&
            (identical(other.clicks, clicks) || other.clicks == clicks) &&
            (identical(other.conversions, conversions) ||
                other.conversions == conversions) &&
            (identical(other.conversionValue, conversionValue) ||
                other.conversionValue == conversionValue) &&
            (identical(other.roas, roas) || other.roas == roas) &&
            (identical(other.currency, currency) ||
                other.currency == currency));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, spend, impressions, clicks,
      conversions, conversionValue, roas, currency);

  /// Create a copy of AdsTotals
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsTotalsImplCopyWith<_$AdsTotalsImpl> get copyWith =>
      __$$AdsTotalsImplCopyWithImpl<_$AdsTotalsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsTotalsImplToJson(
      this,
    );
  }
}

abstract class _AdsTotals implements AdsTotals {
  const factory _AdsTotals(
      {final num spend,
      final num impressions,
      final num clicks,
      final num conversions,
      @JsonKey(name: "conversion_value") final num conversionValue,
      final num? roas,
      final String? currency}) = _$AdsTotalsImpl;

  factory _AdsTotals.fromJson(Map<String, dynamic> json) =
      _$AdsTotalsImpl.fromJson;

  @override
  num get spend;
  @override
  num get impressions;
  @override
  num get clicks;
  @override
  num get conversions;
  @override
  @JsonKey(name: "conversion_value")
  num get conversionValue;
  @override
  num? get roas;
  @override
  String? get currency;

  /// Create a copy of AdsTotals
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsTotalsImplCopyWith<_$AdsTotalsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsDailyPoint _$AdsDailyPointFromJson(Map<String, dynamic> json) {
  return _AdsDailyPoint.fromJson(json);
}

/// @nodoc
mixin _$AdsDailyPoint {
  String get date => throw _privateConstructorUsedError;
  num get spend => throw _privateConstructorUsedError;
  num get conversions => throw _privateConstructorUsedError;

  /// Serializes this AdsDailyPoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsDailyPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsDailyPointCopyWith<AdsDailyPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsDailyPointCopyWith<$Res> {
  factory $AdsDailyPointCopyWith(
          AdsDailyPoint value, $Res Function(AdsDailyPoint) then) =
      _$AdsDailyPointCopyWithImpl<$Res, AdsDailyPoint>;
  @useResult
  $Res call({String date, num spend, num conversions});
}

/// @nodoc
class _$AdsDailyPointCopyWithImpl<$Res, $Val extends AdsDailyPoint>
    implements $AdsDailyPointCopyWith<$Res> {
  _$AdsDailyPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsDailyPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? spend = null,
    Object? conversions = null,
  }) {
    return _then(_value.copyWith(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsDailyPointImplCopyWith<$Res>
    implements $AdsDailyPointCopyWith<$Res> {
  factory _$$AdsDailyPointImplCopyWith(
          _$AdsDailyPointImpl value, $Res Function(_$AdsDailyPointImpl) then) =
      __$$AdsDailyPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String date, num spend, num conversions});
}

/// @nodoc
class __$$AdsDailyPointImplCopyWithImpl<$Res>
    extends _$AdsDailyPointCopyWithImpl<$Res, _$AdsDailyPointImpl>
    implements _$$AdsDailyPointImplCopyWith<$Res> {
  __$$AdsDailyPointImplCopyWithImpl(
      _$AdsDailyPointImpl _value, $Res Function(_$AdsDailyPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsDailyPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? spend = null,
    Object? conversions = null,
  }) {
    return _then(_$AdsDailyPointImpl(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsDailyPointImpl implements _AdsDailyPoint {
  const _$AdsDailyPointImpl(
      {this.date = "", this.spend = 0, this.conversions = 0});

  factory _$AdsDailyPointImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsDailyPointImplFromJson(json);

  @override
  @JsonKey()
  final String date;
  @override
  @JsonKey()
  final num spend;
  @override
  @JsonKey()
  final num conversions;

  @override
  String toString() {
    return 'AdsDailyPoint(date: $date, spend: $spend, conversions: $conversions)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsDailyPointImpl &&
            (identical(other.date, date) || other.date == date) &&
            (identical(other.spend, spend) || other.spend == spend) &&
            (identical(other.conversions, conversions) ||
                other.conversions == conversions));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, date, spend, conversions);

  /// Create a copy of AdsDailyPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsDailyPointImplCopyWith<_$AdsDailyPointImpl> get copyWith =>
      __$$AdsDailyPointImplCopyWithImpl<_$AdsDailyPointImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsDailyPointImplToJson(
      this,
    );
  }
}

abstract class _AdsDailyPoint implements AdsDailyPoint {
  const factory _AdsDailyPoint(
      {final String date,
      final num spend,
      final num conversions}) = _$AdsDailyPointImpl;

  factory _AdsDailyPoint.fromJson(Map<String, dynamic> json) =
      _$AdsDailyPointImpl.fromJson;

  @override
  String get date;
  @override
  num get spend;
  @override
  num get conversions;

  /// Create a copy of AdsDailyPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsDailyPointImplCopyWith<_$AdsDailyPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsOverview _$AdsOverviewFromJson(Map<String, dynamic> json) {
  return _AdsOverview.fromJson(json);
}

/// @nodoc
mixin _$AdsOverview {
  int get days => throw _privateConstructorUsedError;
  List<AdsConnection> get connections => throw _privateConstructorUsedError;
  List<AdsAccount> get accounts => throw _privateConstructorUsedError;
  AdsTotals get totals => throw _privateConstructorUsedError;
  List<AdsCampaignRow> get campaigns => throw _privateConstructorUsedError;
  List<AdsDailyPoint> get daily => throw _privateConstructorUsedError;
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt => throw _privateConstructorUsedError;

  /// Serializes this AdsOverview to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsOverview
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsOverviewCopyWith<AdsOverview> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsOverviewCopyWith<$Res> {
  factory $AdsOverviewCopyWith(
          AdsOverview value, $Res Function(AdsOverview) then) =
      _$AdsOverviewCopyWithImpl<$Res, AdsOverview>;
  @useResult
  $Res call(
      {int days,
      List<AdsConnection> connections,
      List<AdsAccount> accounts,
      AdsTotals totals,
      List<AdsCampaignRow> campaigns,
      List<AdsDailyPoint> daily,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt});

  $AdsTotalsCopyWith<$Res> get totals;
}

/// @nodoc
class _$AdsOverviewCopyWithImpl<$Res, $Val extends AdsOverview>
    implements $AdsOverviewCopyWith<$Res> {
  _$AdsOverviewCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsOverview
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? days = null,
    Object? connections = null,
    Object? accounts = null,
    Object? totals = null,
    Object? campaigns = null,
    Object? daily = null,
    Object? lastSyncedAt = freezed,
  }) {
    return _then(_value.copyWith(
      days: null == days
          ? _value.days
          : days // ignore: cast_nullable_to_non_nullable
              as int,
      connections: null == connections
          ? _value.connections
          : connections // ignore: cast_nullable_to_non_nullable
              as List<AdsConnection>,
      accounts: null == accounts
          ? _value.accounts
          : accounts // ignore: cast_nullable_to_non_nullable
              as List<AdsAccount>,
      totals: null == totals
          ? _value.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as AdsTotals,
      campaigns: null == campaigns
          ? _value.campaigns
          : campaigns // ignore: cast_nullable_to_non_nullable
              as List<AdsCampaignRow>,
      daily: null == daily
          ? _value.daily
          : daily // ignore: cast_nullable_to_non_nullable
              as List<AdsDailyPoint>,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }

  /// Create a copy of AdsOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AdsTotalsCopyWith<$Res> get totals {
    return $AdsTotalsCopyWith<$Res>(_value.totals, (value) {
      return _then(_value.copyWith(totals: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AdsOverviewImplCopyWith<$Res>
    implements $AdsOverviewCopyWith<$Res> {
  factory _$$AdsOverviewImplCopyWith(
          _$AdsOverviewImpl value, $Res Function(_$AdsOverviewImpl) then) =
      __$$AdsOverviewImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int days,
      List<AdsConnection> connections,
      List<AdsAccount> accounts,
      AdsTotals totals,
      List<AdsCampaignRow> campaigns,
      List<AdsDailyPoint> daily,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt});

  @override
  $AdsTotalsCopyWith<$Res> get totals;
}

/// @nodoc
class __$$AdsOverviewImplCopyWithImpl<$Res>
    extends _$AdsOverviewCopyWithImpl<$Res, _$AdsOverviewImpl>
    implements _$$AdsOverviewImplCopyWith<$Res> {
  __$$AdsOverviewImplCopyWithImpl(
      _$AdsOverviewImpl _value, $Res Function(_$AdsOverviewImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsOverview
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? days = null,
    Object? connections = null,
    Object? accounts = null,
    Object? totals = null,
    Object? campaigns = null,
    Object? daily = null,
    Object? lastSyncedAt = freezed,
  }) {
    return _then(_$AdsOverviewImpl(
      days: null == days
          ? _value.days
          : days // ignore: cast_nullable_to_non_nullable
              as int,
      connections: null == connections
          ? _value._connections
          : connections // ignore: cast_nullable_to_non_nullable
              as List<AdsConnection>,
      accounts: null == accounts
          ? _value._accounts
          : accounts // ignore: cast_nullable_to_non_nullable
              as List<AdsAccount>,
      totals: null == totals
          ? _value.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as AdsTotals,
      campaigns: null == campaigns
          ? _value._campaigns
          : campaigns // ignore: cast_nullable_to_non_nullable
              as List<AdsCampaignRow>,
      daily: null == daily
          ? _value._daily
          : daily // ignore: cast_nullable_to_non_nullable
              as List<AdsDailyPoint>,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsOverviewImpl extends _AdsOverview {
  const _$AdsOverviewImpl(
      {this.days = 30,
      final List<AdsConnection> connections = const <AdsConnection>[],
      final List<AdsAccount> accounts = const <AdsAccount>[],
      this.totals = const AdsTotals(),
      final List<AdsCampaignRow> campaigns = const <AdsCampaignRow>[],
      final List<AdsDailyPoint> daily = const <AdsDailyPoint>[],
      @JsonKey(name: "last_synced_at") this.lastSyncedAt})
      : _connections = connections,
        _accounts = accounts,
        _campaigns = campaigns,
        _daily = daily,
        super._();

  factory _$AdsOverviewImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsOverviewImplFromJson(json);

  @override
  @JsonKey()
  final int days;
  final List<AdsConnection> _connections;
  @override
  @JsonKey()
  List<AdsConnection> get connections {
    if (_connections is EqualUnmodifiableListView) return _connections;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_connections);
  }

  final List<AdsAccount> _accounts;
  @override
  @JsonKey()
  List<AdsAccount> get accounts {
    if (_accounts is EqualUnmodifiableListView) return _accounts;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_accounts);
  }

  @override
  @JsonKey()
  final AdsTotals totals;
  final List<AdsCampaignRow> _campaigns;
  @override
  @JsonKey()
  List<AdsCampaignRow> get campaigns {
    if (_campaigns is EqualUnmodifiableListView) return _campaigns;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_campaigns);
  }

  final List<AdsDailyPoint> _daily;
  @override
  @JsonKey()
  List<AdsDailyPoint> get daily {
    if (_daily is EqualUnmodifiableListView) return _daily;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_daily);
  }

  @override
  @JsonKey(name: "last_synced_at")
  final String? lastSyncedAt;

  @override
  String toString() {
    return 'AdsOverview(days: $days, connections: $connections, accounts: $accounts, totals: $totals, campaigns: $campaigns, daily: $daily, lastSyncedAt: $lastSyncedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsOverviewImpl &&
            (identical(other.days, days) || other.days == days) &&
            const DeepCollectionEquality()
                .equals(other._connections, _connections) &&
            const DeepCollectionEquality().equals(other._accounts, _accounts) &&
            (identical(other.totals, totals) || other.totals == totals) &&
            const DeepCollectionEquality()
                .equals(other._campaigns, _campaigns) &&
            const DeepCollectionEquality().equals(other._daily, _daily) &&
            (identical(other.lastSyncedAt, lastSyncedAt) ||
                other.lastSyncedAt == lastSyncedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      days,
      const DeepCollectionEquality().hash(_connections),
      const DeepCollectionEquality().hash(_accounts),
      totals,
      const DeepCollectionEquality().hash(_campaigns),
      const DeepCollectionEquality().hash(_daily),
      lastSyncedAt);

  /// Create a copy of AdsOverview
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsOverviewImplCopyWith<_$AdsOverviewImpl> get copyWith =>
      __$$AdsOverviewImplCopyWithImpl<_$AdsOverviewImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsOverviewImplToJson(
      this,
    );
  }
}

abstract class _AdsOverview extends AdsOverview {
  const factory _AdsOverview(
          {final int days,
          final List<AdsConnection> connections,
          final List<AdsAccount> accounts,
          final AdsTotals totals,
          final List<AdsCampaignRow> campaigns,
          final List<AdsDailyPoint> daily,
          @JsonKey(name: "last_synced_at") final String? lastSyncedAt}) =
      _$AdsOverviewImpl;
  const _AdsOverview._() : super._();

  factory _AdsOverview.fromJson(Map<String, dynamic> json) =
      _$AdsOverviewImpl.fromJson;

  @override
  int get days;
  @override
  List<AdsConnection> get connections;
  @override
  List<AdsAccount> get accounts;
  @override
  AdsTotals get totals;
  @override
  List<AdsCampaignRow> get campaigns;
  @override
  List<AdsDailyPoint> get daily;
  @override
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt;

  /// Create a copy of AdsOverview
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsOverviewImplCopyWith<_$AdsOverviewImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsAccountsResponse _$AdsAccountsResponseFromJson(Map<String, dynamic> json) {
  return _AdsAccountsResponse.fromJson(json);
}

/// @nodoc
mixin _$AdsAccountsResponse {
  List<AdsConnection> get connections => throw _privateConstructorUsedError;
  List<AdsAccount> get accounts => throw _privateConstructorUsedError;
  List<AdsPlatformInfo> get platforms => throw _privateConstructorUsedError;

  /// Serializes this AdsAccountsResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsAccountsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsAccountsResponseCopyWith<AdsAccountsResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsAccountsResponseCopyWith<$Res> {
  factory $AdsAccountsResponseCopyWith(
          AdsAccountsResponse value, $Res Function(AdsAccountsResponse) then) =
      _$AdsAccountsResponseCopyWithImpl<$Res, AdsAccountsResponse>;
  @useResult
  $Res call(
      {List<AdsConnection> connections,
      List<AdsAccount> accounts,
      List<AdsPlatformInfo> platforms});
}

/// @nodoc
class _$AdsAccountsResponseCopyWithImpl<$Res, $Val extends AdsAccountsResponse>
    implements $AdsAccountsResponseCopyWith<$Res> {
  _$AdsAccountsResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsAccountsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? connections = null,
    Object? accounts = null,
    Object? platforms = null,
  }) {
    return _then(_value.copyWith(
      connections: null == connections
          ? _value.connections
          : connections // ignore: cast_nullable_to_non_nullable
              as List<AdsConnection>,
      accounts: null == accounts
          ? _value.accounts
          : accounts // ignore: cast_nullable_to_non_nullable
              as List<AdsAccount>,
      platforms: null == platforms
          ? _value.platforms
          : platforms // ignore: cast_nullable_to_non_nullable
              as List<AdsPlatformInfo>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsAccountsResponseImplCopyWith<$Res>
    implements $AdsAccountsResponseCopyWith<$Res> {
  factory _$$AdsAccountsResponseImplCopyWith(_$AdsAccountsResponseImpl value,
          $Res Function(_$AdsAccountsResponseImpl) then) =
      __$$AdsAccountsResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<AdsConnection> connections,
      List<AdsAccount> accounts,
      List<AdsPlatformInfo> platforms});
}

/// @nodoc
class __$$AdsAccountsResponseImplCopyWithImpl<$Res>
    extends _$AdsAccountsResponseCopyWithImpl<$Res, _$AdsAccountsResponseImpl>
    implements _$$AdsAccountsResponseImplCopyWith<$Res> {
  __$$AdsAccountsResponseImplCopyWithImpl(_$AdsAccountsResponseImpl _value,
      $Res Function(_$AdsAccountsResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsAccountsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? connections = null,
    Object? accounts = null,
    Object? platforms = null,
  }) {
    return _then(_$AdsAccountsResponseImpl(
      connections: null == connections
          ? _value._connections
          : connections // ignore: cast_nullable_to_non_nullable
              as List<AdsConnection>,
      accounts: null == accounts
          ? _value._accounts
          : accounts // ignore: cast_nullable_to_non_nullable
              as List<AdsAccount>,
      platforms: null == platforms
          ? _value._platforms
          : platforms // ignore: cast_nullable_to_non_nullable
              as List<AdsPlatformInfo>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsAccountsResponseImpl implements _AdsAccountsResponse {
  const _$AdsAccountsResponseImpl(
      {final List<AdsConnection> connections = const <AdsConnection>[],
      final List<AdsAccount> accounts = const <AdsAccount>[],
      final List<AdsPlatformInfo> platforms = const <AdsPlatformInfo>[]})
      : _connections = connections,
        _accounts = accounts,
        _platforms = platforms;

  factory _$AdsAccountsResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsAccountsResponseImplFromJson(json);

  final List<AdsConnection> _connections;
  @override
  @JsonKey()
  List<AdsConnection> get connections {
    if (_connections is EqualUnmodifiableListView) return _connections;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_connections);
  }

  final List<AdsAccount> _accounts;
  @override
  @JsonKey()
  List<AdsAccount> get accounts {
    if (_accounts is EqualUnmodifiableListView) return _accounts;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_accounts);
  }

  final List<AdsPlatformInfo> _platforms;
  @override
  @JsonKey()
  List<AdsPlatformInfo> get platforms {
    if (_platforms is EqualUnmodifiableListView) return _platforms;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_platforms);
  }

  @override
  String toString() {
    return 'AdsAccountsResponse(connections: $connections, accounts: $accounts, platforms: $platforms)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsAccountsResponseImpl &&
            const DeepCollectionEquality()
                .equals(other._connections, _connections) &&
            const DeepCollectionEquality().equals(other._accounts, _accounts) &&
            const DeepCollectionEquality()
                .equals(other._platforms, _platforms));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_connections),
      const DeepCollectionEquality().hash(_accounts),
      const DeepCollectionEquality().hash(_platforms));

  /// Create a copy of AdsAccountsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsAccountsResponseImplCopyWith<_$AdsAccountsResponseImpl> get copyWith =>
      __$$AdsAccountsResponseImplCopyWithImpl<_$AdsAccountsResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsAccountsResponseImplToJson(
      this,
    );
  }
}

abstract class _AdsAccountsResponse implements AdsAccountsResponse {
  const factory _AdsAccountsResponse(
      {final List<AdsConnection> connections,
      final List<AdsAccount> accounts,
      final List<AdsPlatformInfo> platforms}) = _$AdsAccountsResponseImpl;

  factory _AdsAccountsResponse.fromJson(Map<String, dynamic> json) =
      _$AdsAccountsResponseImpl.fromJson;

  @override
  List<AdsConnection> get connections;
  @override
  List<AdsAccount> get accounts;
  @override
  List<AdsPlatformInfo> get platforms;

  /// Create a copy of AdsAccountsResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsAccountsResponseImplCopyWith<_$AdsAccountsResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsSyncSummary _$AdsSyncSummaryFromJson(Map<String, dynamic> json) {
  return _AdsSyncSummary.fromJson(json);
}

/// @nodoc
mixin _$AdsSyncSummary {
  int get connections => throw _privateConstructorUsedError;
  int get accounts => throw _privateConstructorUsedError;
  int get campaigns => throw _privateConstructorUsedError;
  @JsonKey(name: "insight_rows")
  int get insightRows => throw _privateConstructorUsedError;
  List<String> get errors => throw _privateConstructorUsedError;

  /// Serializes this AdsSyncSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsSyncSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsSyncSummaryCopyWith<AdsSyncSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsSyncSummaryCopyWith<$Res> {
  factory $AdsSyncSummaryCopyWith(
          AdsSyncSummary value, $Res Function(AdsSyncSummary) then) =
      _$AdsSyncSummaryCopyWithImpl<$Res, AdsSyncSummary>;
  @useResult
  $Res call(
      {int connections,
      int accounts,
      int campaigns,
      @JsonKey(name: "insight_rows") int insightRows,
      List<String> errors});
}

/// @nodoc
class _$AdsSyncSummaryCopyWithImpl<$Res, $Val extends AdsSyncSummary>
    implements $AdsSyncSummaryCopyWith<$Res> {
  _$AdsSyncSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsSyncSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? connections = null,
    Object? accounts = null,
    Object? campaigns = null,
    Object? insightRows = null,
    Object? errors = null,
  }) {
    return _then(_value.copyWith(
      connections: null == connections
          ? _value.connections
          : connections // ignore: cast_nullable_to_non_nullable
              as int,
      accounts: null == accounts
          ? _value.accounts
          : accounts // ignore: cast_nullable_to_non_nullable
              as int,
      campaigns: null == campaigns
          ? _value.campaigns
          : campaigns // ignore: cast_nullable_to_non_nullable
              as int,
      insightRows: null == insightRows
          ? _value.insightRows
          : insightRows // ignore: cast_nullable_to_non_nullable
              as int,
      errors: null == errors
          ? _value.errors
          : errors // ignore: cast_nullable_to_non_nullable
              as List<String>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsSyncSummaryImplCopyWith<$Res>
    implements $AdsSyncSummaryCopyWith<$Res> {
  factory _$$AdsSyncSummaryImplCopyWith(_$AdsSyncSummaryImpl value,
          $Res Function(_$AdsSyncSummaryImpl) then) =
      __$$AdsSyncSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int connections,
      int accounts,
      int campaigns,
      @JsonKey(name: "insight_rows") int insightRows,
      List<String> errors});
}

/// @nodoc
class __$$AdsSyncSummaryImplCopyWithImpl<$Res>
    extends _$AdsSyncSummaryCopyWithImpl<$Res, _$AdsSyncSummaryImpl>
    implements _$$AdsSyncSummaryImplCopyWith<$Res> {
  __$$AdsSyncSummaryImplCopyWithImpl(
      _$AdsSyncSummaryImpl _value, $Res Function(_$AdsSyncSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsSyncSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? connections = null,
    Object? accounts = null,
    Object? campaigns = null,
    Object? insightRows = null,
    Object? errors = null,
  }) {
    return _then(_$AdsSyncSummaryImpl(
      connections: null == connections
          ? _value.connections
          : connections // ignore: cast_nullable_to_non_nullable
              as int,
      accounts: null == accounts
          ? _value.accounts
          : accounts // ignore: cast_nullable_to_non_nullable
              as int,
      campaigns: null == campaigns
          ? _value.campaigns
          : campaigns // ignore: cast_nullable_to_non_nullable
              as int,
      insightRows: null == insightRows
          ? _value.insightRows
          : insightRows // ignore: cast_nullable_to_non_nullable
              as int,
      errors: null == errors
          ? _value._errors
          : errors // ignore: cast_nullable_to_non_nullable
              as List<String>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsSyncSummaryImpl implements _AdsSyncSummary {
  const _$AdsSyncSummaryImpl(
      {this.connections = 0,
      this.accounts = 0,
      this.campaigns = 0,
      @JsonKey(name: "insight_rows") this.insightRows = 0,
      final List<String> errors = const <String>[]})
      : _errors = errors;

  factory _$AdsSyncSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsSyncSummaryImplFromJson(json);

  @override
  @JsonKey()
  final int connections;
  @override
  @JsonKey()
  final int accounts;
  @override
  @JsonKey()
  final int campaigns;
  @override
  @JsonKey(name: "insight_rows")
  final int insightRows;
  final List<String> _errors;
  @override
  @JsonKey()
  List<String> get errors {
    if (_errors is EqualUnmodifiableListView) return _errors;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_errors);
  }

  @override
  String toString() {
    return 'AdsSyncSummary(connections: $connections, accounts: $accounts, campaigns: $campaigns, insightRows: $insightRows, errors: $errors)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsSyncSummaryImpl &&
            (identical(other.connections, connections) ||
                other.connections == connections) &&
            (identical(other.accounts, accounts) ||
                other.accounts == accounts) &&
            (identical(other.campaigns, campaigns) ||
                other.campaigns == campaigns) &&
            (identical(other.insightRows, insightRows) ||
                other.insightRows == insightRows) &&
            const DeepCollectionEquality().equals(other._errors, _errors));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, connections, accounts, campaigns,
      insightRows, const DeepCollectionEquality().hash(_errors));

  /// Create a copy of AdsSyncSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsSyncSummaryImplCopyWith<_$AdsSyncSummaryImpl> get copyWith =>
      __$$AdsSyncSummaryImplCopyWithImpl<_$AdsSyncSummaryImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsSyncSummaryImplToJson(
      this,
    );
  }
}

abstract class _AdsSyncSummary implements AdsSyncSummary {
  const factory _AdsSyncSummary(
      {final int connections,
      final int accounts,
      final int campaigns,
      @JsonKey(name: "insight_rows") final int insightRows,
      final List<String> errors}) = _$AdsSyncSummaryImpl;

  factory _AdsSyncSummary.fromJson(Map<String, dynamic> json) =
      _$AdsSyncSummaryImpl.fromJson;

  @override
  int get connections;
  @override
  int get accounts;
  @override
  int get campaigns;
  @override
  @JsonKey(name: "insight_rows")
  int get insightRows;
  @override
  List<String> get errors;

  /// Create a copy of AdsSyncSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsSyncSummaryImplCopyWith<_$AdsSyncSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsCampaign _$AdsCampaignFromJson(Map<String, dynamic> json) {
  return _AdsCampaign.fromJson(json);
}

/// @nodoc
mixin _$AdsCampaign {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "external_id")
  String? get externalId => throw _privateConstructorUsedError;
  String get platform => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get objective => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "external_status")
  String? get externalStatus => throw _privateConstructorUsedError;
  String get source => throw _privateConstructorUsedError;
  @JsonKey(name: "daily_budget")
  num? get dailyBudget => throw _privateConstructorUsedError;
  @JsonKey(name: "lifetime_budget")
  num? get lifetimeBudget => throw _privateConstructorUsedError;
  String? get currency => throw _privateConstructorUsedError;
  Map<String, dynamic>? get spec => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt => throw _privateConstructorUsedError;
  String? get error => throw _privateConstructorUsedError;

  /// Serializes this AdsCampaign to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsCampaign
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsCampaignCopyWith<AdsCampaign> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsCampaignCopyWith<$Res> {
  factory $AdsCampaignCopyWith(
          AdsCampaign value, $Res Function(AdsCampaign) then) =
      _$AdsCampaignCopyWithImpl<$Res, AdsCampaign>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "external_id") String? externalId,
      String platform,
      String name,
      String? objective,
      String status,
      @JsonKey(name: "external_status") String? externalStatus,
      String source,
      @JsonKey(name: "daily_budget") num? dailyBudget,
      @JsonKey(name: "lifetime_budget") num? lifetimeBudget,
      String? currency,
      Map<String, dynamic>? spec,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt,
      String? error});
}

/// @nodoc
class _$AdsCampaignCopyWithImpl<$Res, $Val extends AdsCampaign>
    implements $AdsCampaignCopyWith<$Res> {
  _$AdsCampaignCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsCampaign
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? externalId = freezed,
    Object? platform = null,
    Object? name = null,
    Object? objective = freezed,
    Object? status = null,
    Object? externalStatus = freezed,
    Object? source = null,
    Object? dailyBudget = freezed,
    Object? lifetimeBudget = freezed,
    Object? currency = freezed,
    Object? spec = freezed,
    Object? createdAt = null,
    Object? lastSyncedAt = freezed,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: freezed == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String?,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      objective: freezed == objective
          ? _value.objective
          : objective // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      externalStatus: freezed == externalStatus
          ? _value.externalStatus
          : externalStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      source: null == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String,
      dailyBudget: freezed == dailyBudget
          ? _value.dailyBudget
          : dailyBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      lifetimeBudget: freezed == lifetimeBudget
          ? _value.lifetimeBudget
          : lifetimeBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      spec: freezed == spec
          ? _value.spec
          : spec // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsCampaignImplCopyWith<$Res>
    implements $AdsCampaignCopyWith<$Res> {
  factory _$$AdsCampaignImplCopyWith(
          _$AdsCampaignImpl value, $Res Function(_$AdsCampaignImpl) then) =
      __$$AdsCampaignImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "external_id") String? externalId,
      String platform,
      String name,
      String? objective,
      String status,
      @JsonKey(name: "external_status") String? externalStatus,
      String source,
      @JsonKey(name: "daily_budget") num? dailyBudget,
      @JsonKey(name: "lifetime_budget") num? lifetimeBudget,
      String? currency,
      Map<String, dynamic>? spec,
      @JsonKey(name: "created_at") String createdAt,
      @JsonKey(name: "last_synced_at") String? lastSyncedAt,
      String? error});
}

/// @nodoc
class __$$AdsCampaignImplCopyWithImpl<$Res>
    extends _$AdsCampaignCopyWithImpl<$Res, _$AdsCampaignImpl>
    implements _$$AdsCampaignImplCopyWith<$Res> {
  __$$AdsCampaignImplCopyWithImpl(
      _$AdsCampaignImpl _value, $Res Function(_$AdsCampaignImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsCampaign
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? externalId = freezed,
    Object? platform = null,
    Object? name = null,
    Object? objective = freezed,
    Object? status = null,
    Object? externalStatus = freezed,
    Object? source = null,
    Object? dailyBudget = freezed,
    Object? lifetimeBudget = freezed,
    Object? currency = freezed,
    Object? spec = freezed,
    Object? createdAt = null,
    Object? lastSyncedAt = freezed,
    Object? error = freezed,
  }) {
    return _then(_$AdsCampaignImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      externalId: freezed == externalId
          ? _value.externalId
          : externalId // ignore: cast_nullable_to_non_nullable
              as String?,
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      objective: freezed == objective
          ? _value.objective
          : objective // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      externalStatus: freezed == externalStatus
          ? _value.externalStatus
          : externalStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      source: null == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String,
      dailyBudget: freezed == dailyBudget
          ? _value.dailyBudget
          : dailyBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      lifetimeBudget: freezed == lifetimeBudget
          ? _value.lifetimeBudget
          : lifetimeBudget // ignore: cast_nullable_to_non_nullable
              as num?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      spec: freezed == spec
          ? _value._spec
          : spec // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      lastSyncedAt: freezed == lastSyncedAt
          ? _value.lastSyncedAt
          : lastSyncedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsCampaignImpl implements _AdsCampaign {
  const _$AdsCampaignImpl(
      {this.id = "",
      @JsonKey(name: "external_id") this.externalId,
      this.platform = "",
      this.name = "",
      this.objective,
      this.status = "",
      @JsonKey(name: "external_status") this.externalStatus,
      this.source = "",
      @JsonKey(name: "daily_budget") this.dailyBudget,
      @JsonKey(name: "lifetime_budget") this.lifetimeBudget,
      this.currency,
      final Map<String, dynamic>? spec,
      @JsonKey(name: "created_at") this.createdAt = "",
      @JsonKey(name: "last_synced_at") this.lastSyncedAt,
      this.error})
      : _spec = spec;

  factory _$AdsCampaignImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsCampaignImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "external_id")
  final String? externalId;
  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey()
  final String name;
  @override
  final String? objective;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "external_status")
  final String? externalStatus;
  @override
  @JsonKey()
  final String source;
  @override
  @JsonKey(name: "daily_budget")
  final num? dailyBudget;
  @override
  @JsonKey(name: "lifetime_budget")
  final num? lifetimeBudget;
  @override
  final String? currency;
  final Map<String, dynamic>? _spec;
  @override
  Map<String, dynamic>? get spec {
    final value = _spec;
    if (value == null) return null;
    if (_spec is EqualUnmodifiableMapView) return _spec;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  @JsonKey(name: "created_at")
  final String createdAt;
  @override
  @JsonKey(name: "last_synced_at")
  final String? lastSyncedAt;
  @override
  final String? error;

  @override
  String toString() {
    return 'AdsCampaign(id: $id, externalId: $externalId, platform: $platform, name: $name, objective: $objective, status: $status, externalStatus: $externalStatus, source: $source, dailyBudget: $dailyBudget, lifetimeBudget: $lifetimeBudget, currency: $currency, spec: $spec, createdAt: $createdAt, lastSyncedAt: $lastSyncedAt, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsCampaignImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.externalId, externalId) ||
                other.externalId == externalId) &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.objective, objective) ||
                other.objective == objective) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.externalStatus, externalStatus) ||
                other.externalStatus == externalStatus) &&
            (identical(other.source, source) || other.source == source) &&
            (identical(other.dailyBudget, dailyBudget) ||
                other.dailyBudget == dailyBudget) &&
            (identical(other.lifetimeBudget, lifetimeBudget) ||
                other.lifetimeBudget == lifetimeBudget) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            const DeepCollectionEquality().equals(other._spec, _spec) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.lastSyncedAt, lastSyncedAt) ||
                other.lastSyncedAt == lastSyncedAt) &&
            (identical(other.error, error) || other.error == error));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      externalId,
      platform,
      name,
      objective,
      status,
      externalStatus,
      source,
      dailyBudget,
      lifetimeBudget,
      currency,
      const DeepCollectionEquality().hash(_spec),
      createdAt,
      lastSyncedAt,
      error);

  /// Create a copy of AdsCampaign
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsCampaignImplCopyWith<_$AdsCampaignImpl> get copyWith =>
      __$$AdsCampaignImplCopyWithImpl<_$AdsCampaignImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsCampaignImplToJson(
      this,
    );
  }
}

abstract class _AdsCampaign implements AdsCampaign {
  const factory _AdsCampaign(
      {final String id,
      @JsonKey(name: "external_id") final String? externalId,
      final String platform,
      final String name,
      final String? objective,
      final String status,
      @JsonKey(name: "external_status") final String? externalStatus,
      final String source,
      @JsonKey(name: "daily_budget") final num? dailyBudget,
      @JsonKey(name: "lifetime_budget") final num? lifetimeBudget,
      final String? currency,
      final Map<String, dynamic>? spec,
      @JsonKey(name: "created_at") final String createdAt,
      @JsonKey(name: "last_synced_at") final String? lastSyncedAt,
      final String? error}) = _$AdsCampaignImpl;

  factory _AdsCampaign.fromJson(Map<String, dynamic> json) =
      _$AdsCampaignImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "external_id")
  String? get externalId;
  @override
  String get platform;
  @override
  String get name;
  @override
  String? get objective;
  @override
  String get status;
  @override
  @JsonKey(name: "external_status")
  String? get externalStatus;
  @override
  String get source;
  @override
  @JsonKey(name: "daily_budget")
  num? get dailyBudget;
  @override
  @JsonKey(name: "lifetime_budget")
  num? get lifetimeBudget;
  @override
  String? get currency;
  @override
  Map<String, dynamic>? get spec;
  @override
  @JsonKey(name: "created_at")
  String get createdAt;
  @override
  @JsonKey(name: "last_synced_at")
  String? get lastSyncedAt;
  @override
  String? get error;

  /// Create a copy of AdsCampaign
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsCampaignImplCopyWith<_$AdsCampaignImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsCreative _$AdsCreativeFromJson(Map<String, dynamic> json) {
  return _AdsCreative.fromJson(json);
}

/// @nodoc
mixin _$AdsCreative {
  String? get headline => throw _privateConstructorUsedError;
  @JsonKey(name: "primary_text")
  String? get primaryText => throw _privateConstructorUsedError;
  @JsonKey(name: "image_url")
  String? get imageUrl => throw _privateConstructorUsedError;
  @JsonKey(name: "link_url")
  String? get linkUrl => throw _privateConstructorUsedError;

  /// Serializes this AdsCreative to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsCreative
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsCreativeCopyWith<AdsCreative> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsCreativeCopyWith<$Res> {
  factory $AdsCreativeCopyWith(
          AdsCreative value, $Res Function(AdsCreative) then) =
      _$AdsCreativeCopyWithImpl<$Res, AdsCreative>;
  @useResult
  $Res call(
      {String? headline,
      @JsonKey(name: "primary_text") String? primaryText,
      @JsonKey(name: "image_url") String? imageUrl,
      @JsonKey(name: "link_url") String? linkUrl});
}

/// @nodoc
class _$AdsCreativeCopyWithImpl<$Res, $Val extends AdsCreative>
    implements $AdsCreativeCopyWith<$Res> {
  _$AdsCreativeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsCreative
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? headline = freezed,
    Object? primaryText = freezed,
    Object? imageUrl = freezed,
    Object? linkUrl = freezed,
  }) {
    return _then(_value.copyWith(
      headline: freezed == headline
          ? _value.headline
          : headline // ignore: cast_nullable_to_non_nullable
              as String?,
      primaryText: freezed == primaryText
          ? _value.primaryText
          : primaryText // ignore: cast_nullable_to_non_nullable
              as String?,
      imageUrl: freezed == imageUrl
          ? _value.imageUrl
          : imageUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      linkUrl: freezed == linkUrl
          ? _value.linkUrl
          : linkUrl // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsCreativeImplCopyWith<$Res>
    implements $AdsCreativeCopyWith<$Res> {
  factory _$$AdsCreativeImplCopyWith(
          _$AdsCreativeImpl value, $Res Function(_$AdsCreativeImpl) then) =
      __$$AdsCreativeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? headline,
      @JsonKey(name: "primary_text") String? primaryText,
      @JsonKey(name: "image_url") String? imageUrl,
      @JsonKey(name: "link_url") String? linkUrl});
}

/// @nodoc
class __$$AdsCreativeImplCopyWithImpl<$Res>
    extends _$AdsCreativeCopyWithImpl<$Res, _$AdsCreativeImpl>
    implements _$$AdsCreativeImplCopyWith<$Res> {
  __$$AdsCreativeImplCopyWithImpl(
      _$AdsCreativeImpl _value, $Res Function(_$AdsCreativeImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsCreative
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? headline = freezed,
    Object? primaryText = freezed,
    Object? imageUrl = freezed,
    Object? linkUrl = freezed,
  }) {
    return _then(_$AdsCreativeImpl(
      headline: freezed == headline
          ? _value.headline
          : headline // ignore: cast_nullable_to_non_nullable
              as String?,
      primaryText: freezed == primaryText
          ? _value.primaryText
          : primaryText // ignore: cast_nullable_to_non_nullable
              as String?,
      imageUrl: freezed == imageUrl
          ? _value.imageUrl
          : imageUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      linkUrl: freezed == linkUrl
          ? _value.linkUrl
          : linkUrl // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsCreativeImpl implements _AdsCreative {
  const _$AdsCreativeImpl(
      {this.headline,
      @JsonKey(name: "primary_text") this.primaryText,
      @JsonKey(name: "image_url") this.imageUrl,
      @JsonKey(name: "link_url") this.linkUrl});

  factory _$AdsCreativeImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsCreativeImplFromJson(json);

  @override
  final String? headline;
  @override
  @JsonKey(name: "primary_text")
  final String? primaryText;
  @override
  @JsonKey(name: "image_url")
  final String? imageUrl;
  @override
  @JsonKey(name: "link_url")
  final String? linkUrl;

  @override
  String toString() {
    return 'AdsCreative(headline: $headline, primaryText: $primaryText, imageUrl: $imageUrl, linkUrl: $linkUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsCreativeImpl &&
            (identical(other.headline, headline) ||
                other.headline == headline) &&
            (identical(other.primaryText, primaryText) ||
                other.primaryText == primaryText) &&
            (identical(other.imageUrl, imageUrl) ||
                other.imageUrl == imageUrl) &&
            (identical(other.linkUrl, linkUrl) || other.linkUrl == linkUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, headline, primaryText, imageUrl, linkUrl);

  /// Create a copy of AdsCreative
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsCreativeImplCopyWith<_$AdsCreativeImpl> get copyWith =>
      __$$AdsCreativeImplCopyWithImpl<_$AdsCreativeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsCreativeImplToJson(
      this,
    );
  }
}

abstract class _AdsCreative implements AdsCreative {
  const factory _AdsCreative(
      {final String? headline,
      @JsonKey(name: "primary_text") final String? primaryText,
      @JsonKey(name: "image_url") final String? imageUrl,
      @JsonKey(name: "link_url") final String? linkUrl}) = _$AdsCreativeImpl;

  factory _AdsCreative.fromJson(Map<String, dynamic> json) =
      _$AdsCreativeImpl.fromJson;

  @override
  String? get headline;
  @override
  @JsonKey(name: "primary_text")
  String? get primaryText;
  @override
  @JsonKey(name: "image_url")
  String? get imageUrl;
  @override
  @JsonKey(name: "link_url")
  String? get linkUrl;

  /// Create a copy of AdsCreative
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsCreativeImplCopyWith<_$AdsCreativeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsAd _$AdsAdFromJson(Map<String, dynamic> json) {
  return _AdsAd.fromJson(json);
}

/// @nodoc
mixin _$AdsAd {
  String get id => throw _privateConstructorUsedError;
  String? get name => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  AdsCreative? get creative => throw _privateConstructorUsedError;

  /// Serializes this AdsAd to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsAd
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsAdCopyWith<AdsAd> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsAdCopyWith<$Res> {
  factory $AdsAdCopyWith(AdsAd value, $Res Function(AdsAd) then) =
      _$AdsAdCopyWithImpl<$Res, AdsAd>;
  @useResult
  $Res call({String id, String? name, String status, AdsCreative? creative});

  $AdsCreativeCopyWith<$Res>? get creative;
}

/// @nodoc
class _$AdsAdCopyWithImpl<$Res, $Val extends AdsAd>
    implements $AdsAdCopyWith<$Res> {
  _$AdsAdCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsAd
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = freezed,
    Object? status = null,
    Object? creative = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      creative: freezed == creative
          ? _value.creative
          : creative // ignore: cast_nullable_to_non_nullable
              as AdsCreative?,
    ) as $Val);
  }

  /// Create a copy of AdsAd
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AdsCreativeCopyWith<$Res>? get creative {
    if (_value.creative == null) {
      return null;
    }

    return $AdsCreativeCopyWith<$Res>(_value.creative!, (value) {
      return _then(_value.copyWith(creative: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AdsAdImplCopyWith<$Res> implements $AdsAdCopyWith<$Res> {
  factory _$$AdsAdImplCopyWith(
          _$AdsAdImpl value, $Res Function(_$AdsAdImpl) then) =
      __$$AdsAdImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String? name, String status, AdsCreative? creative});

  @override
  $AdsCreativeCopyWith<$Res>? get creative;
}

/// @nodoc
class __$$AdsAdImplCopyWithImpl<$Res>
    extends _$AdsAdCopyWithImpl<$Res, _$AdsAdImpl>
    implements _$$AdsAdImplCopyWith<$Res> {
  __$$AdsAdImplCopyWithImpl(
      _$AdsAdImpl _value, $Res Function(_$AdsAdImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsAd
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = freezed,
    Object? status = null,
    Object? creative = freezed,
  }) {
    return _then(_$AdsAdImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      creative: freezed == creative
          ? _value.creative
          : creative // ignore: cast_nullable_to_non_nullable
              as AdsCreative?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsAdImpl implements _AdsAd {
  const _$AdsAdImpl({this.id = "", this.name, this.status = "", this.creative});

  factory _$AdsAdImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsAdImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  final String? name;
  @override
  @JsonKey()
  final String status;
  @override
  final AdsCreative? creative;

  @override
  String toString() {
    return 'AdsAd(id: $id, name: $name, status: $status, creative: $creative)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsAdImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.creative, creative) ||
                other.creative == creative));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name, status, creative);

  /// Create a copy of AdsAd
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsAdImplCopyWith<_$AdsAdImpl> get copyWith =>
      __$$AdsAdImplCopyWithImpl<_$AdsAdImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsAdImplToJson(
      this,
    );
  }
}

abstract class _AdsAd implements AdsAd {
  const factory _AdsAd(
      {final String id,
      final String? name,
      final String status,
      final AdsCreative? creative}) = _$AdsAdImpl;

  factory _AdsAd.fromJson(Map<String, dynamic> json) = _$AdsAdImpl.fromJson;

  @override
  String get id;
  @override
  String? get name;
  @override
  String get status;
  @override
  AdsCreative? get creative;

  /// Create a copy of AdsAd
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsAdImplCopyWith<_$AdsAdImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsCampaignDaily _$AdsCampaignDailyFromJson(Map<String, dynamic> json) {
  return _AdsCampaignDaily.fromJson(json);
}

/// @nodoc
mixin _$AdsCampaignDaily {
  String get date => throw _privateConstructorUsedError;
  num get spend => throw _privateConstructorUsedError;
  num get clicks => throw _privateConstructorUsedError;
  num get conversions => throw _privateConstructorUsedError;

  /// Serializes this AdsCampaignDaily to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsCampaignDaily
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsCampaignDailyCopyWith<AdsCampaignDaily> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsCampaignDailyCopyWith<$Res> {
  factory $AdsCampaignDailyCopyWith(
          AdsCampaignDaily value, $Res Function(AdsCampaignDaily) then) =
      _$AdsCampaignDailyCopyWithImpl<$Res, AdsCampaignDaily>;
  @useResult
  $Res call({String date, num spend, num clicks, num conversions});
}

/// @nodoc
class _$AdsCampaignDailyCopyWithImpl<$Res, $Val extends AdsCampaignDaily>
    implements $AdsCampaignDailyCopyWith<$Res> {
  _$AdsCampaignDailyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsCampaignDaily
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? spend = null,
    Object? clicks = null,
    Object? conversions = null,
  }) {
    return _then(_value.copyWith(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      clicks: null == clicks
          ? _value.clicks
          : clicks // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsCampaignDailyImplCopyWith<$Res>
    implements $AdsCampaignDailyCopyWith<$Res> {
  factory _$$AdsCampaignDailyImplCopyWith(_$AdsCampaignDailyImpl value,
          $Res Function(_$AdsCampaignDailyImpl) then) =
      __$$AdsCampaignDailyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String date, num spend, num clicks, num conversions});
}

/// @nodoc
class __$$AdsCampaignDailyImplCopyWithImpl<$Res>
    extends _$AdsCampaignDailyCopyWithImpl<$Res, _$AdsCampaignDailyImpl>
    implements _$$AdsCampaignDailyImplCopyWith<$Res> {
  __$$AdsCampaignDailyImplCopyWithImpl(_$AdsCampaignDailyImpl _value,
      $Res Function(_$AdsCampaignDailyImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsCampaignDaily
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? spend = null,
    Object? clicks = null,
    Object? conversions = null,
  }) {
    return _then(_$AdsCampaignDailyImpl(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      spend: null == spend
          ? _value.spend
          : spend // ignore: cast_nullable_to_non_nullable
              as num,
      clicks: null == clicks
          ? _value.clicks
          : clicks // ignore: cast_nullable_to_non_nullable
              as num,
      conversions: null == conversions
          ? _value.conversions
          : conversions // ignore: cast_nullable_to_non_nullable
              as num,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsCampaignDailyImpl implements _AdsCampaignDaily {
  const _$AdsCampaignDailyImpl(
      {this.date = "", this.spend = 0, this.clicks = 0, this.conversions = 0});

  factory _$AdsCampaignDailyImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsCampaignDailyImplFromJson(json);

  @override
  @JsonKey()
  final String date;
  @override
  @JsonKey()
  final num spend;
  @override
  @JsonKey()
  final num clicks;
  @override
  @JsonKey()
  final num conversions;

  @override
  String toString() {
    return 'AdsCampaignDaily(date: $date, spend: $spend, clicks: $clicks, conversions: $conversions)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsCampaignDailyImpl &&
            (identical(other.date, date) || other.date == date) &&
            (identical(other.spend, spend) || other.spend == spend) &&
            (identical(other.clicks, clicks) || other.clicks == clicks) &&
            (identical(other.conversions, conversions) ||
                other.conversions == conversions));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, date, spend, clicks, conversions);

  /// Create a copy of AdsCampaignDaily
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsCampaignDailyImplCopyWith<_$AdsCampaignDailyImpl> get copyWith =>
      __$$AdsCampaignDailyImplCopyWithImpl<_$AdsCampaignDailyImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsCampaignDailyImplToJson(
      this,
    );
  }
}

abstract class _AdsCampaignDaily implements AdsCampaignDaily {
  const factory _AdsCampaignDaily(
      {final String date,
      final num spend,
      final num clicks,
      final num conversions}) = _$AdsCampaignDailyImpl;

  factory _AdsCampaignDaily.fromJson(Map<String, dynamic> json) =
      _$AdsCampaignDailyImpl.fromJson;

  @override
  String get date;
  @override
  num get spend;
  @override
  num get clicks;
  @override
  num get conversions;

  /// Create a copy of AdsCampaignDaily
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsCampaignDailyImplCopyWith<_$AdsCampaignDailyImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsTimelineEntry _$AdsTimelineEntryFromJson(Map<String, dynamic> json) {
  return _AdsTimelineEntry.fromJson(json);
}

/// @nodoc
mixin _$AdsTimelineEntry {
  String get id => throw _privateConstructorUsedError;
  String get actor => throw _privateConstructorUsedError;
  String get action => throw _privateConstructorUsedError;
  String? get reason => throw _privateConstructorUsedError;
  Map<String, dynamic>? get before => throw _privateConstructorUsedError;
  Map<String, dynamic>? get after => throw _privateConstructorUsedError;
  String get at => throw _privateConstructorUsedError;

  /// Serializes this AdsTimelineEntry to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsTimelineEntry
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsTimelineEntryCopyWith<AdsTimelineEntry> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsTimelineEntryCopyWith<$Res> {
  factory $AdsTimelineEntryCopyWith(
          AdsTimelineEntry value, $Res Function(AdsTimelineEntry) then) =
      _$AdsTimelineEntryCopyWithImpl<$Res, AdsTimelineEntry>;
  @useResult
  $Res call(
      {String id,
      String actor,
      String action,
      String? reason,
      Map<String, dynamic>? before,
      Map<String, dynamic>? after,
      String at});
}

/// @nodoc
class _$AdsTimelineEntryCopyWithImpl<$Res, $Val extends AdsTimelineEntry>
    implements $AdsTimelineEntryCopyWith<$Res> {
  _$AdsTimelineEntryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsTimelineEntry
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? actor = null,
    Object? action = null,
    Object? reason = freezed,
    Object? before = freezed,
    Object? after = freezed,
    Object? at = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      actor: null == actor
          ? _value.actor
          : actor // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
      before: freezed == before
          ? _value.before
          : before // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      after: freezed == after
          ? _value.after
          : after // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      at: null == at
          ? _value.at
          : at // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdsTimelineEntryImplCopyWith<$Res>
    implements $AdsTimelineEntryCopyWith<$Res> {
  factory _$$AdsTimelineEntryImplCopyWith(_$AdsTimelineEntryImpl value,
          $Res Function(_$AdsTimelineEntryImpl) then) =
      __$$AdsTimelineEntryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String actor,
      String action,
      String? reason,
      Map<String, dynamic>? before,
      Map<String, dynamic>? after,
      String at});
}

/// @nodoc
class __$$AdsTimelineEntryImplCopyWithImpl<$Res>
    extends _$AdsTimelineEntryCopyWithImpl<$Res, _$AdsTimelineEntryImpl>
    implements _$$AdsTimelineEntryImplCopyWith<$Res> {
  __$$AdsTimelineEntryImplCopyWithImpl(_$AdsTimelineEntryImpl _value,
      $Res Function(_$AdsTimelineEntryImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsTimelineEntry
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? actor = null,
    Object? action = null,
    Object? reason = freezed,
    Object? before = freezed,
    Object? after = freezed,
    Object? at = null,
  }) {
    return _then(_$AdsTimelineEntryImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      actor: null == actor
          ? _value.actor
          : actor // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
      before: freezed == before
          ? _value._before
          : before // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      after: freezed == after
          ? _value._after
          : after // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      at: null == at
          ? _value.at
          : at // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsTimelineEntryImpl implements _AdsTimelineEntry {
  const _$AdsTimelineEntryImpl(
      {this.id = "",
      this.actor = "",
      this.action = "",
      this.reason,
      final Map<String, dynamic>? before,
      final Map<String, dynamic>? after,
      this.at = ""})
      : _before = before,
        _after = after;

  factory _$AdsTimelineEntryImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsTimelineEntryImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String actor;
  @override
  @JsonKey()
  final String action;
  @override
  final String? reason;
  final Map<String, dynamic>? _before;
  @override
  Map<String, dynamic>? get before {
    final value = _before;
    if (value == null) return null;
    if (_before is EqualUnmodifiableMapView) return _before;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  final Map<String, dynamic>? _after;
  @override
  Map<String, dynamic>? get after {
    final value = _after;
    if (value == null) return null;
    if (_after is EqualUnmodifiableMapView) return _after;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  @JsonKey()
  final String at;

  @override
  String toString() {
    return 'AdsTimelineEntry(id: $id, actor: $actor, action: $action, reason: $reason, before: $before, after: $after, at: $at)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsTimelineEntryImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.actor, actor) || other.actor == actor) &&
            (identical(other.action, action) || other.action == action) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            const DeepCollectionEquality().equals(other._before, _before) &&
            const DeepCollectionEquality().equals(other._after, _after) &&
            (identical(other.at, at) || other.at == at));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      actor,
      action,
      reason,
      const DeepCollectionEquality().hash(_before),
      const DeepCollectionEquality().hash(_after),
      at);

  /// Create a copy of AdsTimelineEntry
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsTimelineEntryImplCopyWith<_$AdsTimelineEntryImpl> get copyWith =>
      __$$AdsTimelineEntryImplCopyWithImpl<_$AdsTimelineEntryImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsTimelineEntryImplToJson(
      this,
    );
  }
}

abstract class _AdsTimelineEntry implements AdsTimelineEntry {
  const factory _AdsTimelineEntry(
      {final String id,
      final String actor,
      final String action,
      final String? reason,
      final Map<String, dynamic>? before,
      final Map<String, dynamic>? after,
      final String at}) = _$AdsTimelineEntryImpl;

  factory _AdsTimelineEntry.fromJson(Map<String, dynamic> json) =
      _$AdsTimelineEntryImpl.fromJson;

  @override
  String get id;
  @override
  String get actor;
  @override
  String get action;
  @override
  String? get reason;
  @override
  Map<String, dynamic>? get before;
  @override
  Map<String, dynamic>? get after;
  @override
  String get at;

  /// Create a copy of AdsTimelineEntry
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsTimelineEntryImplCopyWith<_$AdsTimelineEntryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AdsCampaignDetail _$AdsCampaignDetailFromJson(Map<String, dynamic> json) {
  return _AdsCampaignDetail.fromJson(json);
}

/// @nodoc
mixin _$AdsCampaignDetail {
  AdsCampaign get campaign => throw _privateConstructorUsedError;
  List<AdsAd> get ads => throw _privateConstructorUsedError;
  AdsTotals get totals => throw _privateConstructorUsedError;
  List<AdsCampaignDaily> get daily => throw _privateConstructorUsedError;
  List<AdsTimelineEntry> get timeline => throw _privateConstructorUsedError;

  /// Serializes this AdsCampaignDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdsCampaignDetailCopyWith<AdsCampaignDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdsCampaignDetailCopyWith<$Res> {
  factory $AdsCampaignDetailCopyWith(
          AdsCampaignDetail value, $Res Function(AdsCampaignDetail) then) =
      _$AdsCampaignDetailCopyWithImpl<$Res, AdsCampaignDetail>;
  @useResult
  $Res call(
      {AdsCampaign campaign,
      List<AdsAd> ads,
      AdsTotals totals,
      List<AdsCampaignDaily> daily,
      List<AdsTimelineEntry> timeline});

  $AdsCampaignCopyWith<$Res> get campaign;
  $AdsTotalsCopyWith<$Res> get totals;
}

/// @nodoc
class _$AdsCampaignDetailCopyWithImpl<$Res, $Val extends AdsCampaignDetail>
    implements $AdsCampaignDetailCopyWith<$Res> {
  _$AdsCampaignDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? campaign = null,
    Object? ads = null,
    Object? totals = null,
    Object? daily = null,
    Object? timeline = null,
  }) {
    return _then(_value.copyWith(
      campaign: null == campaign
          ? _value.campaign
          : campaign // ignore: cast_nullable_to_non_nullable
              as AdsCampaign,
      ads: null == ads
          ? _value.ads
          : ads // ignore: cast_nullable_to_non_nullable
              as List<AdsAd>,
      totals: null == totals
          ? _value.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as AdsTotals,
      daily: null == daily
          ? _value.daily
          : daily // ignore: cast_nullable_to_non_nullable
              as List<AdsCampaignDaily>,
      timeline: null == timeline
          ? _value.timeline
          : timeline // ignore: cast_nullable_to_non_nullable
              as List<AdsTimelineEntry>,
    ) as $Val);
  }

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AdsCampaignCopyWith<$Res> get campaign {
    return $AdsCampaignCopyWith<$Res>(_value.campaign, (value) {
      return _then(_value.copyWith(campaign: value) as $Val);
    });
  }

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AdsTotalsCopyWith<$Res> get totals {
    return $AdsTotalsCopyWith<$Res>(_value.totals, (value) {
      return _then(_value.copyWith(totals: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AdsCampaignDetailImplCopyWith<$Res>
    implements $AdsCampaignDetailCopyWith<$Res> {
  factory _$$AdsCampaignDetailImplCopyWith(_$AdsCampaignDetailImpl value,
          $Res Function(_$AdsCampaignDetailImpl) then) =
      __$$AdsCampaignDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {AdsCampaign campaign,
      List<AdsAd> ads,
      AdsTotals totals,
      List<AdsCampaignDaily> daily,
      List<AdsTimelineEntry> timeline});

  @override
  $AdsCampaignCopyWith<$Res> get campaign;
  @override
  $AdsTotalsCopyWith<$Res> get totals;
}

/// @nodoc
class __$$AdsCampaignDetailImplCopyWithImpl<$Res>
    extends _$AdsCampaignDetailCopyWithImpl<$Res, _$AdsCampaignDetailImpl>
    implements _$$AdsCampaignDetailImplCopyWith<$Res> {
  __$$AdsCampaignDetailImplCopyWithImpl(_$AdsCampaignDetailImpl _value,
      $Res Function(_$AdsCampaignDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? campaign = null,
    Object? ads = null,
    Object? totals = null,
    Object? daily = null,
    Object? timeline = null,
  }) {
    return _then(_$AdsCampaignDetailImpl(
      campaign: null == campaign
          ? _value.campaign
          : campaign // ignore: cast_nullable_to_non_nullable
              as AdsCampaign,
      ads: null == ads
          ? _value._ads
          : ads // ignore: cast_nullable_to_non_nullable
              as List<AdsAd>,
      totals: null == totals
          ? _value.totals
          : totals // ignore: cast_nullable_to_non_nullable
              as AdsTotals,
      daily: null == daily
          ? _value._daily
          : daily // ignore: cast_nullable_to_non_nullable
              as List<AdsCampaignDaily>,
      timeline: null == timeline
          ? _value._timeline
          : timeline // ignore: cast_nullable_to_non_nullable
              as List<AdsTimelineEntry>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdsCampaignDetailImpl implements _AdsCampaignDetail {
  const _$AdsCampaignDetailImpl(
      {required this.campaign,
      final List<AdsAd> ads = const <AdsAd>[],
      this.totals = const AdsTotals(),
      final List<AdsCampaignDaily> daily = const <AdsCampaignDaily>[],
      final List<AdsTimelineEntry> timeline = const <AdsTimelineEntry>[]})
      : _ads = ads,
        _daily = daily,
        _timeline = timeline;

  factory _$AdsCampaignDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdsCampaignDetailImplFromJson(json);

  @override
  final AdsCampaign campaign;
  final List<AdsAd> _ads;
  @override
  @JsonKey()
  List<AdsAd> get ads {
    if (_ads is EqualUnmodifiableListView) return _ads;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_ads);
  }

  @override
  @JsonKey()
  final AdsTotals totals;
  final List<AdsCampaignDaily> _daily;
  @override
  @JsonKey()
  List<AdsCampaignDaily> get daily {
    if (_daily is EqualUnmodifiableListView) return _daily;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_daily);
  }

  final List<AdsTimelineEntry> _timeline;
  @override
  @JsonKey()
  List<AdsTimelineEntry> get timeline {
    if (_timeline is EqualUnmodifiableListView) return _timeline;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_timeline);
  }

  @override
  String toString() {
    return 'AdsCampaignDetail(campaign: $campaign, ads: $ads, totals: $totals, daily: $daily, timeline: $timeline)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdsCampaignDetailImpl &&
            (identical(other.campaign, campaign) ||
                other.campaign == campaign) &&
            const DeepCollectionEquality().equals(other._ads, _ads) &&
            (identical(other.totals, totals) || other.totals == totals) &&
            const DeepCollectionEquality().equals(other._daily, _daily) &&
            const DeepCollectionEquality().equals(other._timeline, _timeline));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      campaign,
      const DeepCollectionEquality().hash(_ads),
      totals,
      const DeepCollectionEquality().hash(_daily),
      const DeepCollectionEquality().hash(_timeline));

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdsCampaignDetailImplCopyWith<_$AdsCampaignDetailImpl> get copyWith =>
      __$$AdsCampaignDetailImplCopyWithImpl<_$AdsCampaignDetailImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdsCampaignDetailImplToJson(
      this,
    );
  }
}

abstract class _AdsCampaignDetail implements AdsCampaignDetail {
  const factory _AdsCampaignDetail(
      {required final AdsCampaign campaign,
      final List<AdsAd> ads,
      final AdsTotals totals,
      final List<AdsCampaignDaily> daily,
      final List<AdsTimelineEntry> timeline}) = _$AdsCampaignDetailImpl;

  factory _AdsCampaignDetail.fromJson(Map<String, dynamic> json) =
      _$AdsCampaignDetailImpl.fromJson;

  @override
  AdsCampaign get campaign;
  @override
  List<AdsAd> get ads;
  @override
  AdsTotals get totals;
  @override
  List<AdsCampaignDaily> get daily;
  @override
  List<AdsTimelineEntry> get timeline;

  /// Create a copy of AdsCampaignDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdsCampaignDetailImplCopyWith<_$AdsCampaignDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateAdsCampaignInput _$CreateAdsCampaignInputFromJson(
    Map<String, dynamic> json) {
  return _CreateAdsCampaignInput.fromJson(json);
}

/// @nodoc
mixin _$CreateAdsCampaignInput {
  String get platform => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get goal => throw _privateConstructorUsedError;
  @JsonKey(name: "daily_budget")
  num get dailyBudget => throw _privateConstructorUsedError;
  List<String> get countries => throw _privateConstructorUsedError;
  @JsonKey(name: "product_handle")
  String? get productHandle => throw _privateConstructorUsedError;
  @JsonKey(name: "link_url")
  String? get linkUrl => throw _privateConstructorUsedError;
  String get headline => throw _privateConstructorUsedError;
  @JsonKey(name: "primary_text")
  String get primaryText => throw _privateConstructorUsedError;
  @JsonKey(name: "image_url")
  String? get imageUrl => throw _privateConstructorUsedError;
  @JsonKey(name: "page_id")
  String? get pageId => throw _privateConstructorUsedError;
  @JsonKey(name: "start_at")
  String? get startAt => throw _privateConstructorUsedError;

  /// Serializes this CreateAdsCampaignInput to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateAdsCampaignInput
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateAdsCampaignInputCopyWith<CreateAdsCampaignInput> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateAdsCampaignInputCopyWith<$Res> {
  factory $CreateAdsCampaignInputCopyWith(CreateAdsCampaignInput value,
          $Res Function(CreateAdsCampaignInput) then) =
      _$CreateAdsCampaignInputCopyWithImpl<$Res, CreateAdsCampaignInput>;
  @useResult
  $Res call(
      {String platform,
      String name,
      String goal,
      @JsonKey(name: "daily_budget") num dailyBudget,
      List<String> countries,
      @JsonKey(name: "product_handle") String? productHandle,
      @JsonKey(name: "link_url") String? linkUrl,
      String headline,
      @JsonKey(name: "primary_text") String primaryText,
      @JsonKey(name: "image_url") String? imageUrl,
      @JsonKey(name: "page_id") String? pageId,
      @JsonKey(name: "start_at") String? startAt});
}

/// @nodoc
class _$CreateAdsCampaignInputCopyWithImpl<$Res,
        $Val extends CreateAdsCampaignInput>
    implements $CreateAdsCampaignInputCopyWith<$Res> {
  _$CreateAdsCampaignInputCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateAdsCampaignInput
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? name = null,
    Object? goal = null,
    Object? dailyBudget = null,
    Object? countries = null,
    Object? productHandle = freezed,
    Object? linkUrl = freezed,
    Object? headline = null,
    Object? primaryText = null,
    Object? imageUrl = freezed,
    Object? pageId = freezed,
    Object? startAt = freezed,
  }) {
    return _then(_value.copyWith(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      goal: null == goal
          ? _value.goal
          : goal // ignore: cast_nullable_to_non_nullable
              as String,
      dailyBudget: null == dailyBudget
          ? _value.dailyBudget
          : dailyBudget // ignore: cast_nullable_to_non_nullable
              as num,
      countries: null == countries
          ? _value.countries
          : countries // ignore: cast_nullable_to_non_nullable
              as List<String>,
      productHandle: freezed == productHandle
          ? _value.productHandle
          : productHandle // ignore: cast_nullable_to_non_nullable
              as String?,
      linkUrl: freezed == linkUrl
          ? _value.linkUrl
          : linkUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      headline: null == headline
          ? _value.headline
          : headline // ignore: cast_nullable_to_non_nullable
              as String,
      primaryText: null == primaryText
          ? _value.primaryText
          : primaryText // ignore: cast_nullable_to_non_nullable
              as String,
      imageUrl: freezed == imageUrl
          ? _value.imageUrl
          : imageUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      pageId: freezed == pageId
          ? _value.pageId
          : pageId // ignore: cast_nullable_to_non_nullable
              as String?,
      startAt: freezed == startAt
          ? _value.startAt
          : startAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateAdsCampaignInputImplCopyWith<$Res>
    implements $CreateAdsCampaignInputCopyWith<$Res> {
  factory _$$CreateAdsCampaignInputImplCopyWith(
          _$CreateAdsCampaignInputImpl value,
          $Res Function(_$CreateAdsCampaignInputImpl) then) =
      __$$CreateAdsCampaignInputImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String platform,
      String name,
      String goal,
      @JsonKey(name: "daily_budget") num dailyBudget,
      List<String> countries,
      @JsonKey(name: "product_handle") String? productHandle,
      @JsonKey(name: "link_url") String? linkUrl,
      String headline,
      @JsonKey(name: "primary_text") String primaryText,
      @JsonKey(name: "image_url") String? imageUrl,
      @JsonKey(name: "page_id") String? pageId,
      @JsonKey(name: "start_at") String? startAt});
}

/// @nodoc
class __$$CreateAdsCampaignInputImplCopyWithImpl<$Res>
    extends _$CreateAdsCampaignInputCopyWithImpl<$Res,
        _$CreateAdsCampaignInputImpl>
    implements _$$CreateAdsCampaignInputImplCopyWith<$Res> {
  __$$CreateAdsCampaignInputImplCopyWithImpl(
      _$CreateAdsCampaignInputImpl _value,
      $Res Function(_$CreateAdsCampaignInputImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateAdsCampaignInput
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? name = null,
    Object? goal = null,
    Object? dailyBudget = null,
    Object? countries = null,
    Object? productHandle = freezed,
    Object? linkUrl = freezed,
    Object? headline = null,
    Object? primaryText = null,
    Object? imageUrl = freezed,
    Object? pageId = freezed,
    Object? startAt = freezed,
  }) {
    return _then(_$CreateAdsCampaignInputImpl(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      goal: null == goal
          ? _value.goal
          : goal // ignore: cast_nullable_to_non_nullable
              as String,
      dailyBudget: null == dailyBudget
          ? _value.dailyBudget
          : dailyBudget // ignore: cast_nullable_to_non_nullable
              as num,
      countries: null == countries
          ? _value._countries
          : countries // ignore: cast_nullable_to_non_nullable
              as List<String>,
      productHandle: freezed == productHandle
          ? _value.productHandle
          : productHandle // ignore: cast_nullable_to_non_nullable
              as String?,
      linkUrl: freezed == linkUrl
          ? _value.linkUrl
          : linkUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      headline: null == headline
          ? _value.headline
          : headline // ignore: cast_nullable_to_non_nullable
              as String,
      primaryText: null == primaryText
          ? _value.primaryText
          : primaryText // ignore: cast_nullable_to_non_nullable
              as String,
      imageUrl: freezed == imageUrl
          ? _value.imageUrl
          : imageUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      pageId: freezed == pageId
          ? _value.pageId
          : pageId // ignore: cast_nullable_to_non_nullable
              as String?,
      startAt: freezed == startAt
          ? _value.startAt
          : startAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateAdsCampaignInputImpl implements _CreateAdsCampaignInput {
  const _$CreateAdsCampaignInputImpl(
      {this.platform = "meta",
      this.name = "",
      this.goal = "sales",
      @JsonKey(name: "daily_budget") this.dailyBudget = 0,
      final List<String> countries = const <String>[],
      @JsonKey(name: "product_handle") this.productHandle,
      @JsonKey(name: "link_url") this.linkUrl,
      this.headline = "",
      @JsonKey(name: "primary_text") this.primaryText = "",
      @JsonKey(name: "image_url") this.imageUrl,
      @JsonKey(name: "page_id") this.pageId,
      @JsonKey(name: "start_at") this.startAt})
      : _countries = countries;

  factory _$CreateAdsCampaignInputImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateAdsCampaignInputImplFromJson(json);

  @override
  @JsonKey()
  final String platform;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey()
  final String goal;
  @override
  @JsonKey(name: "daily_budget")
  final num dailyBudget;
  final List<String> _countries;
  @override
  @JsonKey()
  List<String> get countries {
    if (_countries is EqualUnmodifiableListView) return _countries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_countries);
  }

  @override
  @JsonKey(name: "product_handle")
  final String? productHandle;
  @override
  @JsonKey(name: "link_url")
  final String? linkUrl;
  @override
  @JsonKey()
  final String headline;
  @override
  @JsonKey(name: "primary_text")
  final String primaryText;
  @override
  @JsonKey(name: "image_url")
  final String? imageUrl;
  @override
  @JsonKey(name: "page_id")
  final String? pageId;
  @override
  @JsonKey(name: "start_at")
  final String? startAt;

  @override
  String toString() {
    return 'CreateAdsCampaignInput(platform: $platform, name: $name, goal: $goal, dailyBudget: $dailyBudget, countries: $countries, productHandle: $productHandle, linkUrl: $linkUrl, headline: $headline, primaryText: $primaryText, imageUrl: $imageUrl, pageId: $pageId, startAt: $startAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateAdsCampaignInputImpl &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.goal, goal) || other.goal == goal) &&
            (identical(other.dailyBudget, dailyBudget) ||
                other.dailyBudget == dailyBudget) &&
            const DeepCollectionEquality()
                .equals(other._countries, _countries) &&
            (identical(other.productHandle, productHandle) ||
                other.productHandle == productHandle) &&
            (identical(other.linkUrl, linkUrl) || other.linkUrl == linkUrl) &&
            (identical(other.headline, headline) ||
                other.headline == headline) &&
            (identical(other.primaryText, primaryText) ||
                other.primaryText == primaryText) &&
            (identical(other.imageUrl, imageUrl) ||
                other.imageUrl == imageUrl) &&
            (identical(other.pageId, pageId) || other.pageId == pageId) &&
            (identical(other.startAt, startAt) || other.startAt == startAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      platform,
      name,
      goal,
      dailyBudget,
      const DeepCollectionEquality().hash(_countries),
      productHandle,
      linkUrl,
      headline,
      primaryText,
      imageUrl,
      pageId,
      startAt);

  /// Create a copy of CreateAdsCampaignInput
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateAdsCampaignInputImplCopyWith<_$CreateAdsCampaignInputImpl>
      get copyWith => __$$CreateAdsCampaignInputImplCopyWithImpl<
          _$CreateAdsCampaignInputImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateAdsCampaignInputImplToJson(
      this,
    );
  }
}

abstract class _CreateAdsCampaignInput implements CreateAdsCampaignInput {
  const factory _CreateAdsCampaignInput(
          {final String platform,
          final String name,
          final String goal,
          @JsonKey(name: "daily_budget") final num dailyBudget,
          final List<String> countries,
          @JsonKey(name: "product_handle") final String? productHandle,
          @JsonKey(name: "link_url") final String? linkUrl,
          final String headline,
          @JsonKey(name: "primary_text") final String primaryText,
          @JsonKey(name: "image_url") final String? imageUrl,
          @JsonKey(name: "page_id") final String? pageId,
          @JsonKey(name: "start_at") final String? startAt}) =
      _$CreateAdsCampaignInputImpl;

  factory _CreateAdsCampaignInput.fromJson(Map<String, dynamic> json) =
      _$CreateAdsCampaignInputImpl.fromJson;

  @override
  String get platform;
  @override
  String get name;
  @override
  String get goal;
  @override
  @JsonKey(name: "daily_budget")
  num get dailyBudget;
  @override
  List<String> get countries;
  @override
  @JsonKey(name: "product_handle")
  String? get productHandle;
  @override
  @JsonKey(name: "link_url")
  String? get linkUrl;
  @override
  String get headline;
  @override
  @JsonKey(name: "primary_text")
  String get primaryText;
  @override
  @JsonKey(name: "image_url")
  String? get imageUrl;
  @override
  @JsonKey(name: "page_id")
  String? get pageId;
  @override
  @JsonKey(name: "start_at")
  String? get startAt;

  /// Create a copy of CreateAdsCampaignInput
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateAdsCampaignInputImplCopyWith<_$CreateAdsCampaignInputImpl>
      get copyWith => throw _privateConstructorUsedError;
}
