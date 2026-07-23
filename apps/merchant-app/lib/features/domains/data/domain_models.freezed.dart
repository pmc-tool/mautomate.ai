// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'domain_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DnsInstruction _$DnsInstructionFromJson(Map<String, dynamic> json) {
  return _DnsInstruction.fromJson(json);
}

/// @nodoc
mixin _$DnsInstruction {
  String get kind => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get value => throw _privateConstructorUsedError;
  int? get ttl => throw _privateConstructorUsedError;

  /// Serializes this DnsInstruction to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DnsInstruction
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DnsInstructionCopyWith<DnsInstruction> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DnsInstructionCopyWith<$Res> {
  factory $DnsInstructionCopyWith(
          DnsInstruction value, $Res Function(DnsInstruction) then) =
      _$DnsInstructionCopyWithImpl<$Res, DnsInstruction>;
  @useResult
  $Res call({String kind, String name, String value, int? ttl});
}

/// @nodoc
class _$DnsInstructionCopyWithImpl<$Res, $Val extends DnsInstruction>
    implements $DnsInstructionCopyWith<$Res> {
  _$DnsInstructionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DnsInstruction
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? kind = null,
    Object? name = null,
    Object? value = null,
    Object? ttl = freezed,
  }) {
    return _then(_value.copyWith(
      kind: null == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
      ttl: freezed == ttl
          ? _value.ttl
          : ttl // ignore: cast_nullable_to_non_nullable
              as int?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DnsInstructionImplCopyWith<$Res>
    implements $DnsInstructionCopyWith<$Res> {
  factory _$$DnsInstructionImplCopyWith(_$DnsInstructionImpl value,
          $Res Function(_$DnsInstructionImpl) then) =
      __$$DnsInstructionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String kind, String name, String value, int? ttl});
}

/// @nodoc
class __$$DnsInstructionImplCopyWithImpl<$Res>
    extends _$DnsInstructionCopyWithImpl<$Res, _$DnsInstructionImpl>
    implements _$$DnsInstructionImplCopyWith<$Res> {
  __$$DnsInstructionImplCopyWithImpl(
      _$DnsInstructionImpl _value, $Res Function(_$DnsInstructionImpl) _then)
      : super(_value, _then);

  /// Create a copy of DnsInstruction
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? kind = null,
    Object? name = null,
    Object? value = null,
    Object? ttl = freezed,
  }) {
    return _then(_$DnsInstructionImpl(
      kind: null == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
      ttl: freezed == ttl
          ? _value.ttl
          : ttl // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DnsInstructionImpl implements _DnsInstruction {
  const _$DnsInstructionImpl(
      {this.kind = "note", this.name = "", this.value = "", this.ttl});

  factory _$DnsInstructionImpl.fromJson(Map<String, dynamic> json) =>
      _$$DnsInstructionImplFromJson(json);

  @override
  @JsonKey()
  final String kind;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey()
  final String value;
  @override
  final int? ttl;

  @override
  String toString() {
    return 'DnsInstruction(kind: $kind, name: $name, value: $value, ttl: $ttl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DnsInstructionImpl &&
            (identical(other.kind, kind) || other.kind == kind) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.value, value) || other.value == value) &&
            (identical(other.ttl, ttl) || other.ttl == ttl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, kind, name, value, ttl);

  /// Create a copy of DnsInstruction
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DnsInstructionImplCopyWith<_$DnsInstructionImpl> get copyWith =>
      __$$DnsInstructionImplCopyWithImpl<_$DnsInstructionImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DnsInstructionImplToJson(
      this,
    );
  }
}

abstract class _DnsInstruction implements DnsInstruction {
  const factory _DnsInstruction(
      {final String kind,
      final String name,
      final String value,
      final int? ttl}) = _$DnsInstructionImpl;

  factory _DnsInstruction.fromJson(Map<String, dynamic> json) =
      _$DnsInstructionImpl.fromJson;

  @override
  String get kind;
  @override
  String get name;
  @override
  String get value;
  @override
  int? get ttl;

  /// Create a copy of DnsInstruction
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DnsInstructionImplCopyWith<_$DnsInstructionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Domain _$DomainFromJson(Map<String, dynamic> json) {
  return _Domain.fromJson(json);
}

/// @nodoc
mixin _$Domain {
  String get id => throw _privateConstructorUsedError;
  String get domain => throw _privateConstructorUsedError; // "free" | "custom"
  String get type => throw _privateConstructorUsedError;
  @JsonKey(name: "is_primary")
  bool get isPrimary => throw _privateConstructorUsedError;
  @JsonKey(name: "ssl_status")
  String get sslStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "verification_status")
  String get verificationStatus => throw _privateConstructorUsedError;
  List<DnsInstruction> get instructions =>
      throw _privateConstructorUsedError; // true when purchased/transferred through the platform registrar (registrar
// tools apply); false for connected-only domains at the customer's provider.
  @JsonKey(name: "registrar_managed")
  bool get registrarManaged => throw _privateConstructorUsedError;

  /// Serializes this Domain to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Domain
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DomainCopyWith<Domain> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DomainCopyWith<$Res> {
  factory $DomainCopyWith(Domain value, $Res Function(Domain) then) =
      _$DomainCopyWithImpl<$Res, Domain>;
  @useResult
  $Res call(
      {String id,
      String domain,
      String type,
      @JsonKey(name: "is_primary") bool isPrimary,
      @JsonKey(name: "ssl_status") String sslStatus,
      @JsonKey(name: "verification_status") String verificationStatus,
      List<DnsInstruction> instructions,
      @JsonKey(name: "registrar_managed") bool registrarManaged});
}

/// @nodoc
class _$DomainCopyWithImpl<$Res, $Val extends Domain>
    implements $DomainCopyWith<$Res> {
  _$DomainCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Domain
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? domain = null,
    Object? type = null,
    Object? isPrimary = null,
    Object? sslStatus = null,
    Object? verificationStatus = null,
    Object? instructions = null,
    Object? registrarManaged = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      isPrimary: null == isPrimary
          ? _value.isPrimary
          : isPrimary // ignore: cast_nullable_to_non_nullable
              as bool,
      sslStatus: null == sslStatus
          ? _value.sslStatus
          : sslStatus // ignore: cast_nullable_to_non_nullable
              as String,
      verificationStatus: null == verificationStatus
          ? _value.verificationStatus
          : verificationStatus // ignore: cast_nullable_to_non_nullable
              as String,
      instructions: null == instructions
          ? _value.instructions
          : instructions // ignore: cast_nullable_to_non_nullable
              as List<DnsInstruction>,
      registrarManaged: null == registrarManaged
          ? _value.registrarManaged
          : registrarManaged // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DomainImplCopyWith<$Res> implements $DomainCopyWith<$Res> {
  factory _$$DomainImplCopyWith(
          _$DomainImpl value, $Res Function(_$DomainImpl) then) =
      __$$DomainImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String domain,
      String type,
      @JsonKey(name: "is_primary") bool isPrimary,
      @JsonKey(name: "ssl_status") String sslStatus,
      @JsonKey(name: "verification_status") String verificationStatus,
      List<DnsInstruction> instructions,
      @JsonKey(name: "registrar_managed") bool registrarManaged});
}

/// @nodoc
class __$$DomainImplCopyWithImpl<$Res>
    extends _$DomainCopyWithImpl<$Res, _$DomainImpl>
    implements _$$DomainImplCopyWith<$Res> {
  __$$DomainImplCopyWithImpl(
      _$DomainImpl _value, $Res Function(_$DomainImpl) _then)
      : super(_value, _then);

  /// Create a copy of Domain
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? domain = null,
    Object? type = null,
    Object? isPrimary = null,
    Object? sslStatus = null,
    Object? verificationStatus = null,
    Object? instructions = null,
    Object? registrarManaged = null,
  }) {
    return _then(_$DomainImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      isPrimary: null == isPrimary
          ? _value.isPrimary
          : isPrimary // ignore: cast_nullable_to_non_nullable
              as bool,
      sslStatus: null == sslStatus
          ? _value.sslStatus
          : sslStatus // ignore: cast_nullable_to_non_nullable
              as String,
      verificationStatus: null == verificationStatus
          ? _value.verificationStatus
          : verificationStatus // ignore: cast_nullable_to_non_nullable
              as String,
      instructions: null == instructions
          ? _value._instructions
          : instructions // ignore: cast_nullable_to_non_nullable
              as List<DnsInstruction>,
      registrarManaged: null == registrarManaged
          ? _value.registrarManaged
          : registrarManaged // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DomainImpl implements _Domain {
  const _$DomainImpl(
      {required this.id,
      this.domain = "",
      this.type = "custom",
      @JsonKey(name: "is_primary") this.isPrimary = false,
      @JsonKey(name: "ssl_status") this.sslStatus = "",
      @JsonKey(name: "verification_status") this.verificationStatus = "",
      final List<DnsInstruction> instructions = const <DnsInstruction>[],
      @JsonKey(name: "registrar_managed") this.registrarManaged = false})
      : _instructions = instructions;

  factory _$DomainImpl.fromJson(Map<String, dynamic> json) =>
      _$$DomainImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String domain;
// "free" | "custom"
  @override
  @JsonKey()
  final String type;
  @override
  @JsonKey(name: "is_primary")
  final bool isPrimary;
  @override
  @JsonKey(name: "ssl_status")
  final String sslStatus;
  @override
  @JsonKey(name: "verification_status")
  final String verificationStatus;
  final List<DnsInstruction> _instructions;
  @override
  @JsonKey()
  List<DnsInstruction> get instructions {
    if (_instructions is EqualUnmodifiableListView) return _instructions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_instructions);
  }

// true when purchased/transferred through the platform registrar (registrar
// tools apply); false for connected-only domains at the customer's provider.
  @override
  @JsonKey(name: "registrar_managed")
  final bool registrarManaged;

  @override
  String toString() {
    return 'Domain(id: $id, domain: $domain, type: $type, isPrimary: $isPrimary, sslStatus: $sslStatus, verificationStatus: $verificationStatus, instructions: $instructions, registrarManaged: $registrarManaged)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DomainImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.domain, domain) || other.domain == domain) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.isPrimary, isPrimary) ||
                other.isPrimary == isPrimary) &&
            (identical(other.sslStatus, sslStatus) ||
                other.sslStatus == sslStatus) &&
            (identical(other.verificationStatus, verificationStatus) ||
                other.verificationStatus == verificationStatus) &&
            const DeepCollectionEquality()
                .equals(other._instructions, _instructions) &&
            (identical(other.registrarManaged, registrarManaged) ||
                other.registrarManaged == registrarManaged));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      domain,
      type,
      isPrimary,
      sslStatus,
      verificationStatus,
      const DeepCollectionEquality().hash(_instructions),
      registrarManaged);

  /// Create a copy of Domain
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DomainImplCopyWith<_$DomainImpl> get copyWith =>
      __$$DomainImplCopyWithImpl<_$DomainImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DomainImplToJson(
      this,
    );
  }
}

abstract class _Domain implements Domain {
  const factory _Domain(
          {required final String id,
          final String domain,
          final String type,
          @JsonKey(name: "is_primary") final bool isPrimary,
          @JsonKey(name: "ssl_status") final String sslStatus,
          @JsonKey(name: "verification_status") final String verificationStatus,
          final List<DnsInstruction> instructions,
          @JsonKey(name: "registrar_managed") final bool registrarManaged}) =
      _$DomainImpl;

  factory _Domain.fromJson(Map<String, dynamic> json) = _$DomainImpl.fromJson;

  @override
  String get id;
  @override
  String get domain; // "free" | "custom"
  @override
  String get type;
  @override
  @JsonKey(name: "is_primary")
  bool get isPrimary;
  @override
  @JsonKey(name: "ssl_status")
  String get sslStatus;
  @override
  @JsonKey(name: "verification_status")
  String get verificationStatus;
  @override
  List<DnsInstruction>
      get instructions; // true when purchased/transferred through the platform registrar (registrar
// tools apply); false for connected-only domains at the customer's provider.
  @override
  @JsonKey(name: "registrar_managed")
  bool get registrarManaged;

  /// Create a copy of Domain
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DomainImplCopyWith<_$DomainImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DomainsResponse _$DomainsResponseFromJson(Map<String, dynamic> json) {
  return _DomainsResponse.fromJson(json);
}

/// @nodoc
mixin _$DomainsResponse {
  List<Domain> get domains => throw _privateConstructorUsedError;

  /// Serializes this DomainsResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DomainsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DomainsResponseCopyWith<DomainsResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DomainsResponseCopyWith<$Res> {
  factory $DomainsResponseCopyWith(
          DomainsResponse value, $Res Function(DomainsResponse) then) =
      _$DomainsResponseCopyWithImpl<$Res, DomainsResponse>;
  @useResult
  $Res call({List<Domain> domains});
}

/// @nodoc
class _$DomainsResponseCopyWithImpl<$Res, $Val extends DomainsResponse>
    implements $DomainsResponseCopyWith<$Res> {
  _$DomainsResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DomainsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domains = null,
  }) {
    return _then(_value.copyWith(
      domains: null == domains
          ? _value.domains
          : domains // ignore: cast_nullable_to_non_nullable
              as List<Domain>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DomainsResponseImplCopyWith<$Res>
    implements $DomainsResponseCopyWith<$Res> {
  factory _$$DomainsResponseImplCopyWith(_$DomainsResponseImpl value,
          $Res Function(_$DomainsResponseImpl) then) =
      __$$DomainsResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<Domain> domains});
}

/// @nodoc
class __$$DomainsResponseImplCopyWithImpl<$Res>
    extends _$DomainsResponseCopyWithImpl<$Res, _$DomainsResponseImpl>
    implements _$$DomainsResponseImplCopyWith<$Res> {
  __$$DomainsResponseImplCopyWithImpl(
      _$DomainsResponseImpl _value, $Res Function(_$DomainsResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DomainsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domains = null,
  }) {
    return _then(_$DomainsResponseImpl(
      domains: null == domains
          ? _value._domains
          : domains // ignore: cast_nullable_to_non_nullable
              as List<Domain>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DomainsResponseImpl implements _DomainsResponse {
  const _$DomainsResponseImpl({final List<Domain> domains = const <Domain>[]})
      : _domains = domains;

  factory _$DomainsResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DomainsResponseImplFromJson(json);

  final List<Domain> _domains;
  @override
  @JsonKey()
  List<Domain> get domains {
    if (_domains is EqualUnmodifiableListView) return _domains;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_domains);
  }

  @override
  String toString() {
    return 'DomainsResponse(domains: $domains)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DomainsResponseImpl &&
            const DeepCollectionEquality().equals(other._domains, _domains));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(_domains));

  /// Create a copy of DomainsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DomainsResponseImplCopyWith<_$DomainsResponseImpl> get copyWith =>
      __$$DomainsResponseImplCopyWithImpl<_$DomainsResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DomainsResponseImplToJson(
      this,
    );
  }
}

abstract class _DomainsResponse implements DomainsResponse {
  const factory _DomainsResponse({final List<Domain> domains}) =
      _$DomainsResponseImpl;

  factory _DomainsResponse.fromJson(Map<String, dynamic> json) =
      _$DomainsResponseImpl.fromJson;

  @override
  List<Domain> get domains;

  /// Create a copy of DomainsResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DomainsResponseImplCopyWith<_$DomainsResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ConnectDomainResponse _$ConnectDomainResponseFromJson(
    Map<String, dynamic> json) {
  return _ConnectDomainResponse.fromJson(json);
}

/// @nodoc
mixin _$ConnectDomainResponse {
  @JsonKey(name: "domain_id")
  String get domainId => throw _privateConstructorUsedError;
  String get domain => throw _privateConstructorUsedError;
  List<DnsInstruction> get instructions => throw _privateConstructorUsedError;
  String get message => throw _privateConstructorUsedError;

  /// Serializes this ConnectDomainResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConnectDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConnectDomainResponseCopyWith<ConnectDomainResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConnectDomainResponseCopyWith<$Res> {
  factory $ConnectDomainResponseCopyWith(ConnectDomainResponse value,
          $Res Function(ConnectDomainResponse) then) =
      _$ConnectDomainResponseCopyWithImpl<$Res, ConnectDomainResponse>;
  @useResult
  $Res call(
      {@JsonKey(name: "domain_id") String domainId,
      String domain,
      List<DnsInstruction> instructions,
      String message});
}

/// @nodoc
class _$ConnectDomainResponseCopyWithImpl<$Res,
        $Val extends ConnectDomainResponse>
    implements $ConnectDomainResponseCopyWith<$Res> {
  _$ConnectDomainResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConnectDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domainId = null,
    Object? domain = null,
    Object? instructions = null,
    Object? message = null,
  }) {
    return _then(_value.copyWith(
      domainId: null == domainId
          ? _value.domainId
          : domainId // ignore: cast_nullable_to_non_nullable
              as String,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      instructions: null == instructions
          ? _value.instructions
          : instructions // ignore: cast_nullable_to_non_nullable
              as List<DnsInstruction>,
      message: null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConnectDomainResponseImplCopyWith<$Res>
    implements $ConnectDomainResponseCopyWith<$Res> {
  factory _$$ConnectDomainResponseImplCopyWith(
          _$ConnectDomainResponseImpl value,
          $Res Function(_$ConnectDomainResponseImpl) then) =
      __$$ConnectDomainResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "domain_id") String domainId,
      String domain,
      List<DnsInstruction> instructions,
      String message});
}

/// @nodoc
class __$$ConnectDomainResponseImplCopyWithImpl<$Res>
    extends _$ConnectDomainResponseCopyWithImpl<$Res,
        _$ConnectDomainResponseImpl>
    implements _$$ConnectDomainResponseImplCopyWith<$Res> {
  __$$ConnectDomainResponseImplCopyWithImpl(_$ConnectDomainResponseImpl _value,
      $Res Function(_$ConnectDomainResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConnectDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domainId = null,
    Object? domain = null,
    Object? instructions = null,
    Object? message = null,
  }) {
    return _then(_$ConnectDomainResponseImpl(
      domainId: null == domainId
          ? _value.domainId
          : domainId // ignore: cast_nullable_to_non_nullable
              as String,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      instructions: null == instructions
          ? _value._instructions
          : instructions // ignore: cast_nullable_to_non_nullable
              as List<DnsInstruction>,
      message: null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConnectDomainResponseImpl implements _ConnectDomainResponse {
  const _$ConnectDomainResponseImpl(
      {@JsonKey(name: "domain_id") required this.domainId,
      this.domain = "",
      final List<DnsInstruction> instructions = const <DnsInstruction>[],
      this.message = ""})
      : _instructions = instructions;

  factory _$ConnectDomainResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConnectDomainResponseImplFromJson(json);

  @override
  @JsonKey(name: "domain_id")
  final String domainId;
  @override
  @JsonKey()
  final String domain;
  final List<DnsInstruction> _instructions;
  @override
  @JsonKey()
  List<DnsInstruction> get instructions {
    if (_instructions is EqualUnmodifiableListView) return _instructions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_instructions);
  }

  @override
  @JsonKey()
  final String message;

  @override
  String toString() {
    return 'ConnectDomainResponse(domainId: $domainId, domain: $domain, instructions: $instructions, message: $message)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConnectDomainResponseImpl &&
            (identical(other.domainId, domainId) ||
                other.domainId == domainId) &&
            (identical(other.domain, domain) || other.domain == domain) &&
            const DeepCollectionEquality()
                .equals(other._instructions, _instructions) &&
            (identical(other.message, message) || other.message == message));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, domainId, domain,
      const DeepCollectionEquality().hash(_instructions), message);

  /// Create a copy of ConnectDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConnectDomainResponseImplCopyWith<_$ConnectDomainResponseImpl>
      get copyWith => __$$ConnectDomainResponseImplCopyWithImpl<
          _$ConnectDomainResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConnectDomainResponseImplToJson(
      this,
    );
  }
}

abstract class _ConnectDomainResponse implements ConnectDomainResponse {
  const factory _ConnectDomainResponse(
      {@JsonKey(name: "domain_id") required final String domainId,
      final String domain,
      final List<DnsInstruction> instructions,
      final String message}) = _$ConnectDomainResponseImpl;

  factory _ConnectDomainResponse.fromJson(Map<String, dynamic> json) =
      _$ConnectDomainResponseImpl.fromJson;

  @override
  @JsonKey(name: "domain_id")
  String get domainId;
  @override
  String get domain;
  @override
  List<DnsInstruction> get instructions;
  @override
  String get message;

  /// Create a copy of ConnectDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConnectDomainResponseImplCopyWith<_$ConnectDomainResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

VerifyDomainResponse _$VerifyDomainResponseFromJson(Map<String, dynamic> json) {
  return _VerifyDomainResponse.fromJson(json);
}

/// @nodoc
mixin _$VerifyDomainResponse {
  @JsonKey(name: "domain_id")
  String get domainId => throw _privateConstructorUsedError;
  @JsonKey(name: "ssl_status")
  String get sslStatus => throw _privateConstructorUsedError;
  @JsonKey(name: "verification_status")
  String get verificationStatus => throw _privateConstructorUsedError;
  bool get pending => throw _privateConstructorUsedError;

  /// Serializes this VerifyDomainResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of VerifyDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $VerifyDomainResponseCopyWith<VerifyDomainResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $VerifyDomainResponseCopyWith<$Res> {
  factory $VerifyDomainResponseCopyWith(VerifyDomainResponse value,
          $Res Function(VerifyDomainResponse) then) =
      _$VerifyDomainResponseCopyWithImpl<$Res, VerifyDomainResponse>;
  @useResult
  $Res call(
      {@JsonKey(name: "domain_id") String domainId,
      @JsonKey(name: "ssl_status") String sslStatus,
      @JsonKey(name: "verification_status") String verificationStatus,
      bool pending});
}

/// @nodoc
class _$VerifyDomainResponseCopyWithImpl<$Res,
        $Val extends VerifyDomainResponse>
    implements $VerifyDomainResponseCopyWith<$Res> {
  _$VerifyDomainResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of VerifyDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domainId = null,
    Object? sslStatus = null,
    Object? verificationStatus = null,
    Object? pending = null,
  }) {
    return _then(_value.copyWith(
      domainId: null == domainId
          ? _value.domainId
          : domainId // ignore: cast_nullable_to_non_nullable
              as String,
      sslStatus: null == sslStatus
          ? _value.sslStatus
          : sslStatus // ignore: cast_nullable_to_non_nullable
              as String,
      verificationStatus: null == verificationStatus
          ? _value.verificationStatus
          : verificationStatus // ignore: cast_nullable_to_non_nullable
              as String,
      pending: null == pending
          ? _value.pending
          : pending // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$VerifyDomainResponseImplCopyWith<$Res>
    implements $VerifyDomainResponseCopyWith<$Res> {
  factory _$$VerifyDomainResponseImplCopyWith(_$VerifyDomainResponseImpl value,
          $Res Function(_$VerifyDomainResponseImpl) then) =
      __$$VerifyDomainResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: "domain_id") String domainId,
      @JsonKey(name: "ssl_status") String sslStatus,
      @JsonKey(name: "verification_status") String verificationStatus,
      bool pending});
}

/// @nodoc
class __$$VerifyDomainResponseImplCopyWithImpl<$Res>
    extends _$VerifyDomainResponseCopyWithImpl<$Res, _$VerifyDomainResponseImpl>
    implements _$$VerifyDomainResponseImplCopyWith<$Res> {
  __$$VerifyDomainResponseImplCopyWithImpl(_$VerifyDomainResponseImpl _value,
      $Res Function(_$VerifyDomainResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of VerifyDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domainId = null,
    Object? sslStatus = null,
    Object? verificationStatus = null,
    Object? pending = null,
  }) {
    return _then(_$VerifyDomainResponseImpl(
      domainId: null == domainId
          ? _value.domainId
          : domainId // ignore: cast_nullable_to_non_nullable
              as String,
      sslStatus: null == sslStatus
          ? _value.sslStatus
          : sslStatus // ignore: cast_nullable_to_non_nullable
              as String,
      verificationStatus: null == verificationStatus
          ? _value.verificationStatus
          : verificationStatus // ignore: cast_nullable_to_non_nullable
              as String,
      pending: null == pending
          ? _value.pending
          : pending // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$VerifyDomainResponseImpl implements _VerifyDomainResponse {
  const _$VerifyDomainResponseImpl(
      {@JsonKey(name: "domain_id") this.domainId = "",
      @JsonKey(name: "ssl_status") this.sslStatus = "",
      @JsonKey(name: "verification_status") this.verificationStatus = "",
      this.pending = true});

  factory _$VerifyDomainResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$VerifyDomainResponseImplFromJson(json);

  @override
  @JsonKey(name: "domain_id")
  final String domainId;
  @override
  @JsonKey(name: "ssl_status")
  final String sslStatus;
  @override
  @JsonKey(name: "verification_status")
  final String verificationStatus;
  @override
  @JsonKey()
  final bool pending;

  @override
  String toString() {
    return 'VerifyDomainResponse(domainId: $domainId, sslStatus: $sslStatus, verificationStatus: $verificationStatus, pending: $pending)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$VerifyDomainResponseImpl &&
            (identical(other.domainId, domainId) ||
                other.domainId == domainId) &&
            (identical(other.sslStatus, sslStatus) ||
                other.sslStatus == sslStatus) &&
            (identical(other.verificationStatus, verificationStatus) ||
                other.verificationStatus == verificationStatus) &&
            (identical(other.pending, pending) || other.pending == pending));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, domainId, sslStatus, verificationStatus, pending);

  /// Create a copy of VerifyDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$VerifyDomainResponseImplCopyWith<_$VerifyDomainResponseImpl>
      get copyWith =>
          __$$VerifyDomainResponseImplCopyWithImpl<_$VerifyDomainResponseImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$VerifyDomainResponseImplToJson(
      this,
    );
  }
}

abstract class _VerifyDomainResponse implements VerifyDomainResponse {
  const factory _VerifyDomainResponse(
      {@JsonKey(name: "domain_id") final String domainId,
      @JsonKey(name: "ssl_status") final String sslStatus,
      @JsonKey(name: "verification_status") final String verificationStatus,
      final bool pending}) = _$VerifyDomainResponseImpl;

  factory _VerifyDomainResponse.fromJson(Map<String, dynamic> json) =
      _$VerifyDomainResponseImpl.fromJson;

  @override
  @JsonKey(name: "domain_id")
  String get domainId;
  @override
  @JsonKey(name: "ssl_status")
  String get sslStatus;
  @override
  @JsonKey(name: "verification_status")
  String get verificationStatus;
  @override
  bool get pending;

  /// Create a copy of VerifyDomainResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$VerifyDomainResponseImplCopyWith<_$VerifyDomainResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

DomainPrice _$DomainPriceFromJson(Map<String, dynamic> json) {
  return _DomainPrice.fromJson(json);
}

/// @nodoc
mixin _$DomainPrice {
  num get register => throw _privateConstructorUsedError;
  num get renew => throw _privateConstructorUsedError;
  num get transfer => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;

  /// Serializes this DomainPrice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DomainPrice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DomainPriceCopyWith<DomainPrice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DomainPriceCopyWith<$Res> {
  factory $DomainPriceCopyWith(
          DomainPrice value, $Res Function(DomainPrice) then) =
      _$DomainPriceCopyWithImpl<$Res, DomainPrice>;
  @useResult
  $Res call({num register, num renew, num transfer, String currency});
}

/// @nodoc
class _$DomainPriceCopyWithImpl<$Res, $Val extends DomainPrice>
    implements $DomainPriceCopyWith<$Res> {
  _$DomainPriceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DomainPrice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? register = null,
    Object? renew = null,
    Object? transfer = null,
    Object? currency = null,
  }) {
    return _then(_value.copyWith(
      register: null == register
          ? _value.register
          : register // ignore: cast_nullable_to_non_nullable
              as num,
      renew: null == renew
          ? _value.renew
          : renew // ignore: cast_nullable_to_non_nullable
              as num,
      transfer: null == transfer
          ? _value.transfer
          : transfer // ignore: cast_nullable_to_non_nullable
              as num,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DomainPriceImplCopyWith<$Res>
    implements $DomainPriceCopyWith<$Res> {
  factory _$$DomainPriceImplCopyWith(
          _$DomainPriceImpl value, $Res Function(_$DomainPriceImpl) then) =
      __$$DomainPriceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num register, num renew, num transfer, String currency});
}

/// @nodoc
class __$$DomainPriceImplCopyWithImpl<$Res>
    extends _$DomainPriceCopyWithImpl<$Res, _$DomainPriceImpl>
    implements _$$DomainPriceImplCopyWith<$Res> {
  __$$DomainPriceImplCopyWithImpl(
      _$DomainPriceImpl _value, $Res Function(_$DomainPriceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DomainPrice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? register = null,
    Object? renew = null,
    Object? transfer = null,
    Object? currency = null,
  }) {
    return _then(_$DomainPriceImpl(
      register: null == register
          ? _value.register
          : register // ignore: cast_nullable_to_non_nullable
              as num,
      renew: null == renew
          ? _value.renew
          : renew // ignore: cast_nullable_to_non_nullable
              as num,
      transfer: null == transfer
          ? _value.transfer
          : transfer // ignore: cast_nullable_to_non_nullable
              as num,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DomainPriceImpl implements _DomainPrice {
  const _$DomainPriceImpl(
      {this.register = 0,
      this.renew = 0,
      this.transfer = 0,
      this.currency = "USD"});

  factory _$DomainPriceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DomainPriceImplFromJson(json);

  @override
  @JsonKey()
  final num register;
  @override
  @JsonKey()
  final num renew;
  @override
  @JsonKey()
  final num transfer;
  @override
  @JsonKey()
  final String currency;

  @override
  String toString() {
    return 'DomainPrice(register: $register, renew: $renew, transfer: $transfer, currency: $currency)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DomainPriceImpl &&
            (identical(other.register, register) ||
                other.register == register) &&
            (identical(other.renew, renew) || other.renew == renew) &&
            (identical(other.transfer, transfer) ||
                other.transfer == transfer) &&
            (identical(other.currency, currency) ||
                other.currency == currency));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, register, renew, transfer, currency);

  /// Create a copy of DomainPrice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DomainPriceImplCopyWith<_$DomainPriceImpl> get copyWith =>
      __$$DomainPriceImplCopyWithImpl<_$DomainPriceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DomainPriceImplToJson(
      this,
    );
  }
}

abstract class _DomainPrice implements DomainPrice {
  const factory _DomainPrice(
      {final num register,
      final num renew,
      final num transfer,
      final String currency}) = _$DomainPriceImpl;

  factory _DomainPrice.fromJson(Map<String, dynamic> json) =
      _$DomainPriceImpl.fromJson;

  @override
  num get register;
  @override
  num get renew;
  @override
  num get transfer;
  @override
  String get currency;

  /// Create a copy of DomainPrice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DomainPriceImplCopyWith<_$DomainPriceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DomainSearchResult _$DomainSearchResultFromJson(Map<String, dynamic> json) {
  return _DomainSearchResult.fromJson(json);
}

/// @nodoc
mixin _$DomainSearchResult {
  String get domain => throw _privateConstructorUsedError;
  String get tld => throw _privateConstructorUsedError;
  bool get available => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "isPremium")
  bool get isPremium => throw _privateConstructorUsedError;
  DomainPrice? get price => throw _privateConstructorUsedError;

  /// Serializes this DomainSearchResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DomainSearchResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DomainSearchResultCopyWith<DomainSearchResult> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DomainSearchResultCopyWith<$Res> {
  factory $DomainSearchResultCopyWith(
          DomainSearchResult value, $Res Function(DomainSearchResult) then) =
      _$DomainSearchResultCopyWithImpl<$Res, DomainSearchResult>;
  @useResult
  $Res call(
      {String domain,
      String tld,
      bool available,
      String status,
      @JsonKey(name: "isPremium") bool isPremium,
      DomainPrice? price});

  $DomainPriceCopyWith<$Res>? get price;
}

/// @nodoc
class _$DomainSearchResultCopyWithImpl<$Res, $Val extends DomainSearchResult>
    implements $DomainSearchResultCopyWith<$Res> {
  _$DomainSearchResultCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DomainSearchResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domain = null,
    Object? tld = null,
    Object? available = null,
    Object? status = null,
    Object? isPremium = null,
    Object? price = freezed,
  }) {
    return _then(_value.copyWith(
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      tld: null == tld
          ? _value.tld
          : tld // ignore: cast_nullable_to_non_nullable
              as String,
      available: null == available
          ? _value.available
          : available // ignore: cast_nullable_to_non_nullable
              as bool,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      isPremium: null == isPremium
          ? _value.isPremium
          : isPremium // ignore: cast_nullable_to_non_nullable
              as bool,
      price: freezed == price
          ? _value.price
          : price // ignore: cast_nullable_to_non_nullable
              as DomainPrice?,
    ) as $Val);
  }

  /// Create a copy of DomainSearchResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DomainPriceCopyWith<$Res>? get price {
    if (_value.price == null) {
      return null;
    }

    return $DomainPriceCopyWith<$Res>(_value.price!, (value) {
      return _then(_value.copyWith(price: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DomainSearchResultImplCopyWith<$Res>
    implements $DomainSearchResultCopyWith<$Res> {
  factory _$$DomainSearchResultImplCopyWith(_$DomainSearchResultImpl value,
          $Res Function(_$DomainSearchResultImpl) then) =
      __$$DomainSearchResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String domain,
      String tld,
      bool available,
      String status,
      @JsonKey(name: "isPremium") bool isPremium,
      DomainPrice? price});

  @override
  $DomainPriceCopyWith<$Res>? get price;
}

/// @nodoc
class __$$DomainSearchResultImplCopyWithImpl<$Res>
    extends _$DomainSearchResultCopyWithImpl<$Res, _$DomainSearchResultImpl>
    implements _$$DomainSearchResultImplCopyWith<$Res> {
  __$$DomainSearchResultImplCopyWithImpl(_$DomainSearchResultImpl _value,
      $Res Function(_$DomainSearchResultImpl) _then)
      : super(_value, _then);

  /// Create a copy of DomainSearchResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? domain = null,
    Object? tld = null,
    Object? available = null,
    Object? status = null,
    Object? isPremium = null,
    Object? price = freezed,
  }) {
    return _then(_$DomainSearchResultImpl(
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      tld: null == tld
          ? _value.tld
          : tld // ignore: cast_nullable_to_non_nullable
              as String,
      available: null == available
          ? _value.available
          : available // ignore: cast_nullable_to_non_nullable
              as bool,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      isPremium: null == isPremium
          ? _value.isPremium
          : isPremium // ignore: cast_nullable_to_non_nullable
              as bool,
      price: freezed == price
          ? _value.price
          : price // ignore: cast_nullable_to_non_nullable
              as DomainPrice?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DomainSearchResultImpl implements _DomainSearchResult {
  const _$DomainSearchResultImpl(
      {this.domain = "",
      this.tld = "",
      this.available = false,
      this.status = "",
      @JsonKey(name: "isPremium") this.isPremium = false,
      this.price});

  factory _$DomainSearchResultImpl.fromJson(Map<String, dynamic> json) =>
      _$$DomainSearchResultImplFromJson(json);

  @override
  @JsonKey()
  final String domain;
  @override
  @JsonKey()
  final String tld;
  @override
  @JsonKey()
  final bool available;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "isPremium")
  final bool isPremium;
  @override
  final DomainPrice? price;

  @override
  String toString() {
    return 'DomainSearchResult(domain: $domain, tld: $tld, available: $available, status: $status, isPremium: $isPremium, price: $price)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DomainSearchResultImpl &&
            (identical(other.domain, domain) || other.domain == domain) &&
            (identical(other.tld, tld) || other.tld == tld) &&
            (identical(other.available, available) ||
                other.available == available) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.isPremium, isPremium) ||
                other.isPremium == isPremium) &&
            (identical(other.price, price) || other.price == price));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, domain, tld, available, status, isPremium, price);

  /// Create a copy of DomainSearchResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DomainSearchResultImplCopyWith<_$DomainSearchResultImpl> get copyWith =>
      __$$DomainSearchResultImplCopyWithImpl<_$DomainSearchResultImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DomainSearchResultImplToJson(
      this,
    );
  }
}

abstract class _DomainSearchResult implements DomainSearchResult {
  const factory _DomainSearchResult(
      {final String domain,
      final String tld,
      final bool available,
      final String status,
      @JsonKey(name: "isPremium") final bool isPremium,
      final DomainPrice? price}) = _$DomainSearchResultImpl;

  factory _DomainSearchResult.fromJson(Map<String, dynamic> json) =
      _$DomainSearchResultImpl.fromJson;

  @override
  String get domain;
  @override
  String get tld;
  @override
  bool get available;
  @override
  String get status;
  @override
  @JsonKey(name: "isPremium")
  bool get isPremium;
  @override
  DomainPrice? get price;

  /// Create a copy of DomainSearchResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DomainSearchResultImplCopyWith<_$DomainSearchResultImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DomainSearchResponse _$DomainSearchResponseFromJson(Map<String, dynamic> json) {
  return _DomainSearchResponse.fromJson(json);
}

/// @nodoc
mixin _$DomainSearchResponse {
  String get query => throw _privateConstructorUsedError;
  bool get configured => throw _privateConstructorUsedError;
  List<DomainSearchResult> get results => throw _privateConstructorUsedError;
  String? get note => throw _privateConstructorUsedError;

  /// Serializes this DomainSearchResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DomainSearchResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DomainSearchResponseCopyWith<DomainSearchResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DomainSearchResponseCopyWith<$Res> {
  factory $DomainSearchResponseCopyWith(DomainSearchResponse value,
          $Res Function(DomainSearchResponse) then) =
      _$DomainSearchResponseCopyWithImpl<$Res, DomainSearchResponse>;
  @useResult
  $Res call(
      {String query,
      bool configured,
      List<DomainSearchResult> results,
      String? note});
}

/// @nodoc
class _$DomainSearchResponseCopyWithImpl<$Res,
        $Val extends DomainSearchResponse>
    implements $DomainSearchResponseCopyWith<$Res> {
  _$DomainSearchResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DomainSearchResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? query = null,
    Object? configured = null,
    Object? results = null,
    Object? note = freezed,
  }) {
    return _then(_value.copyWith(
      query: null == query
          ? _value.query
          : query // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      results: null == results
          ? _value.results
          : results // ignore: cast_nullable_to_non_nullable
              as List<DomainSearchResult>,
      note: freezed == note
          ? _value.note
          : note // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DomainSearchResponseImplCopyWith<$Res>
    implements $DomainSearchResponseCopyWith<$Res> {
  factory _$$DomainSearchResponseImplCopyWith(_$DomainSearchResponseImpl value,
          $Res Function(_$DomainSearchResponseImpl) then) =
      __$$DomainSearchResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String query,
      bool configured,
      List<DomainSearchResult> results,
      String? note});
}

/// @nodoc
class __$$DomainSearchResponseImplCopyWithImpl<$Res>
    extends _$DomainSearchResponseCopyWithImpl<$Res, _$DomainSearchResponseImpl>
    implements _$$DomainSearchResponseImplCopyWith<$Res> {
  __$$DomainSearchResponseImplCopyWithImpl(_$DomainSearchResponseImpl _value,
      $Res Function(_$DomainSearchResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DomainSearchResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? query = null,
    Object? configured = null,
    Object? results = null,
    Object? note = freezed,
  }) {
    return _then(_$DomainSearchResponseImpl(
      query: null == query
          ? _value.query
          : query // ignore: cast_nullable_to_non_nullable
              as String,
      configured: null == configured
          ? _value.configured
          : configured // ignore: cast_nullable_to_non_nullable
              as bool,
      results: null == results
          ? _value._results
          : results // ignore: cast_nullable_to_non_nullable
              as List<DomainSearchResult>,
      note: freezed == note
          ? _value.note
          : note // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DomainSearchResponseImpl implements _DomainSearchResponse {
  const _$DomainSearchResponseImpl(
      {this.query = "",
      this.configured = false,
      final List<DomainSearchResult> results = const <DomainSearchResult>[],
      this.note})
      : _results = results;

  factory _$DomainSearchResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DomainSearchResponseImplFromJson(json);

  @override
  @JsonKey()
  final String query;
  @override
  @JsonKey()
  final bool configured;
  final List<DomainSearchResult> _results;
  @override
  @JsonKey()
  List<DomainSearchResult> get results {
    if (_results is EqualUnmodifiableListView) return _results;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_results);
  }

  @override
  final String? note;

  @override
  String toString() {
    return 'DomainSearchResponse(query: $query, configured: $configured, results: $results, note: $note)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DomainSearchResponseImpl &&
            (identical(other.query, query) || other.query == query) &&
            (identical(other.configured, configured) ||
                other.configured == configured) &&
            const DeepCollectionEquality().equals(other._results, _results) &&
            (identical(other.note, note) || other.note == note));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, query, configured,
      const DeepCollectionEquality().hash(_results), note);

  /// Create a copy of DomainSearchResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DomainSearchResponseImplCopyWith<_$DomainSearchResponseImpl>
      get copyWith =>
          __$$DomainSearchResponseImplCopyWithImpl<_$DomainSearchResponseImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DomainSearchResponseImplToJson(
      this,
    );
  }
}

abstract class _DomainSearchResponse implements DomainSearchResponse {
  const factory _DomainSearchResponse(
      {final String query,
      final bool configured,
      final List<DomainSearchResult> results,
      final String? note}) = _$DomainSearchResponseImpl;

  factory _DomainSearchResponse.fromJson(Map<String, dynamic> json) =
      _$DomainSearchResponseImpl.fromJson;

  @override
  String get query;
  @override
  bool get configured;
  @override
  List<DomainSearchResult> get results;
  @override
  String? get note;

  /// Create a copy of DomainSearchResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DomainSearchResponseImplCopyWith<_$DomainSearchResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

DomainBuyResponse _$DomainBuyResponseFromJson(Map<String, dynamic> json) {
  return _DomainBuyResponse.fromJson(json);
}

/// @nodoc
mixin _$DomainBuyResponse {
  bool get ok => throw _privateConstructorUsedError;
  @JsonKey(name: "awaiting_payment")
  bool get awaitingPayment => throw _privateConstructorUsedError;
  @JsonKey(name: "order_id")
  String? get orderId => throw _privateConstructorUsedError;
  String get domain => throw _privateConstructorUsedError;
  @JsonKey(name: "price_usd")
  num? get priceUsd => throw _privateConstructorUsedError;
  int get years => throw _privateConstructorUsedError;
  @JsonKey(name: "checkout_url")
  String? get checkoutUrl => throw _privateConstructorUsedError;

  /// Serializes this DomainBuyResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DomainBuyResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DomainBuyResponseCopyWith<DomainBuyResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DomainBuyResponseCopyWith<$Res> {
  factory $DomainBuyResponseCopyWith(
          DomainBuyResponse value, $Res Function(DomainBuyResponse) then) =
      _$DomainBuyResponseCopyWithImpl<$Res, DomainBuyResponse>;
  @useResult
  $Res call(
      {bool ok,
      @JsonKey(name: "awaiting_payment") bool awaitingPayment,
      @JsonKey(name: "order_id") String? orderId,
      String domain,
      @JsonKey(name: "price_usd") num? priceUsd,
      int years,
      @JsonKey(name: "checkout_url") String? checkoutUrl});
}

/// @nodoc
class _$DomainBuyResponseCopyWithImpl<$Res, $Val extends DomainBuyResponse>
    implements $DomainBuyResponseCopyWith<$Res> {
  _$DomainBuyResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DomainBuyResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? ok = null,
    Object? awaitingPayment = null,
    Object? orderId = freezed,
    Object? domain = null,
    Object? priceUsd = freezed,
    Object? years = null,
    Object? checkoutUrl = freezed,
  }) {
    return _then(_value.copyWith(
      ok: null == ok
          ? _value.ok
          : ok // ignore: cast_nullable_to_non_nullable
              as bool,
      awaitingPayment: null == awaitingPayment
          ? _value.awaitingPayment
          : awaitingPayment // ignore: cast_nullable_to_non_nullable
              as bool,
      orderId: freezed == orderId
          ? _value.orderId
          : orderId // ignore: cast_nullable_to_non_nullable
              as String?,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      priceUsd: freezed == priceUsd
          ? _value.priceUsd
          : priceUsd // ignore: cast_nullable_to_non_nullable
              as num?,
      years: null == years
          ? _value.years
          : years // ignore: cast_nullable_to_non_nullable
              as int,
      checkoutUrl: freezed == checkoutUrl
          ? _value.checkoutUrl
          : checkoutUrl // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DomainBuyResponseImplCopyWith<$Res>
    implements $DomainBuyResponseCopyWith<$Res> {
  factory _$$DomainBuyResponseImplCopyWith(_$DomainBuyResponseImpl value,
          $Res Function(_$DomainBuyResponseImpl) then) =
      __$$DomainBuyResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {bool ok,
      @JsonKey(name: "awaiting_payment") bool awaitingPayment,
      @JsonKey(name: "order_id") String? orderId,
      String domain,
      @JsonKey(name: "price_usd") num? priceUsd,
      int years,
      @JsonKey(name: "checkout_url") String? checkoutUrl});
}

/// @nodoc
class __$$DomainBuyResponseImplCopyWithImpl<$Res>
    extends _$DomainBuyResponseCopyWithImpl<$Res, _$DomainBuyResponseImpl>
    implements _$$DomainBuyResponseImplCopyWith<$Res> {
  __$$DomainBuyResponseImplCopyWithImpl(_$DomainBuyResponseImpl _value,
      $Res Function(_$DomainBuyResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DomainBuyResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? ok = null,
    Object? awaitingPayment = null,
    Object? orderId = freezed,
    Object? domain = null,
    Object? priceUsd = freezed,
    Object? years = null,
    Object? checkoutUrl = freezed,
  }) {
    return _then(_$DomainBuyResponseImpl(
      ok: null == ok
          ? _value.ok
          : ok // ignore: cast_nullable_to_non_nullable
              as bool,
      awaitingPayment: null == awaitingPayment
          ? _value.awaitingPayment
          : awaitingPayment // ignore: cast_nullable_to_non_nullable
              as bool,
      orderId: freezed == orderId
          ? _value.orderId
          : orderId // ignore: cast_nullable_to_non_nullable
              as String?,
      domain: null == domain
          ? _value.domain
          : domain // ignore: cast_nullable_to_non_nullable
              as String,
      priceUsd: freezed == priceUsd
          ? _value.priceUsd
          : priceUsd // ignore: cast_nullable_to_non_nullable
              as num?,
      years: null == years
          ? _value.years
          : years // ignore: cast_nullable_to_non_nullable
              as int,
      checkoutUrl: freezed == checkoutUrl
          ? _value.checkoutUrl
          : checkoutUrl // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DomainBuyResponseImpl implements _DomainBuyResponse {
  const _$DomainBuyResponseImpl(
      {this.ok = false,
      @JsonKey(name: "awaiting_payment") this.awaitingPayment = false,
      @JsonKey(name: "order_id") this.orderId,
      this.domain = "",
      @JsonKey(name: "price_usd") this.priceUsd,
      this.years = 1,
      @JsonKey(name: "checkout_url") this.checkoutUrl});

  factory _$DomainBuyResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DomainBuyResponseImplFromJson(json);

  @override
  @JsonKey()
  final bool ok;
  @override
  @JsonKey(name: "awaiting_payment")
  final bool awaitingPayment;
  @override
  @JsonKey(name: "order_id")
  final String? orderId;
  @override
  @JsonKey()
  final String domain;
  @override
  @JsonKey(name: "price_usd")
  final num? priceUsd;
  @override
  @JsonKey()
  final int years;
  @override
  @JsonKey(name: "checkout_url")
  final String? checkoutUrl;

  @override
  String toString() {
    return 'DomainBuyResponse(ok: $ok, awaitingPayment: $awaitingPayment, orderId: $orderId, domain: $domain, priceUsd: $priceUsd, years: $years, checkoutUrl: $checkoutUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DomainBuyResponseImpl &&
            (identical(other.ok, ok) || other.ok == ok) &&
            (identical(other.awaitingPayment, awaitingPayment) ||
                other.awaitingPayment == awaitingPayment) &&
            (identical(other.orderId, orderId) || other.orderId == orderId) &&
            (identical(other.domain, domain) || other.domain == domain) &&
            (identical(other.priceUsd, priceUsd) ||
                other.priceUsd == priceUsd) &&
            (identical(other.years, years) || other.years == years) &&
            (identical(other.checkoutUrl, checkoutUrl) ||
                other.checkoutUrl == checkoutUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, ok, awaitingPayment, orderId,
      domain, priceUsd, years, checkoutUrl);

  /// Create a copy of DomainBuyResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DomainBuyResponseImplCopyWith<_$DomainBuyResponseImpl> get copyWith =>
      __$$DomainBuyResponseImplCopyWithImpl<_$DomainBuyResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DomainBuyResponseImplToJson(
      this,
    );
  }
}

abstract class _DomainBuyResponse implements DomainBuyResponse {
  const factory _DomainBuyResponse(
          {final bool ok,
          @JsonKey(name: "awaiting_payment") final bool awaitingPayment,
          @JsonKey(name: "order_id") final String? orderId,
          final String domain,
          @JsonKey(name: "price_usd") final num? priceUsd,
          final int years,
          @JsonKey(name: "checkout_url") final String? checkoutUrl}) =
      _$DomainBuyResponseImpl;

  factory _DomainBuyResponse.fromJson(Map<String, dynamic> json) =
      _$DomainBuyResponseImpl.fromJson;

  @override
  bool get ok;
  @override
  @JsonKey(name: "awaiting_payment")
  bool get awaitingPayment;
  @override
  @JsonKey(name: "order_id")
  String? get orderId;
  @override
  String get domain;
  @override
  @JsonKey(name: "price_usd")
  num? get priceUsd;
  @override
  int get years;
  @override
  @JsonKey(name: "checkout_url")
  String? get checkoutUrl;

  /// Create a copy of DomainBuyResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DomainBuyResponseImplCopyWith<_$DomainBuyResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DnsRecord _$DnsRecordFromJson(Map<String, dynamic> json) {
  return _DnsRecord.fromJson(json);
}

/// @nodoc
mixin _$DnsRecord {
  String? get id => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  String get host => throw _privateConstructorUsedError;
  String get value => throw _privateConstructorUsedError;
  int? get ttl => throw _privateConstructorUsedError;
  int? get priority => throw _privateConstructorUsedError;

  /// Serializes this DnsRecord to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DnsRecord
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DnsRecordCopyWith<DnsRecord> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DnsRecordCopyWith<$Res> {
  factory $DnsRecordCopyWith(DnsRecord value, $Res Function(DnsRecord) then) =
      _$DnsRecordCopyWithImpl<$Res, DnsRecord>;
  @useResult
  $Res call(
      {String? id,
      String type,
      String host,
      String value,
      int? ttl,
      int? priority});
}

/// @nodoc
class _$DnsRecordCopyWithImpl<$Res, $Val extends DnsRecord>
    implements $DnsRecordCopyWith<$Res> {
  _$DnsRecordCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DnsRecord
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = freezed,
    Object? type = null,
    Object? host = null,
    Object? value = null,
    Object? ttl = freezed,
    Object? priority = freezed,
  }) {
    return _then(_value.copyWith(
      id: freezed == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      host: null == host
          ? _value.host
          : host // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
      ttl: freezed == ttl
          ? _value.ttl
          : ttl // ignore: cast_nullable_to_non_nullable
              as int?,
      priority: freezed == priority
          ? _value.priority
          : priority // ignore: cast_nullable_to_non_nullable
              as int?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DnsRecordImplCopyWith<$Res>
    implements $DnsRecordCopyWith<$Res> {
  factory _$$DnsRecordImplCopyWith(
          _$DnsRecordImpl value, $Res Function(_$DnsRecordImpl) then) =
      __$$DnsRecordImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? id,
      String type,
      String host,
      String value,
      int? ttl,
      int? priority});
}

/// @nodoc
class __$$DnsRecordImplCopyWithImpl<$Res>
    extends _$DnsRecordCopyWithImpl<$Res, _$DnsRecordImpl>
    implements _$$DnsRecordImplCopyWith<$Res> {
  __$$DnsRecordImplCopyWithImpl(
      _$DnsRecordImpl _value, $Res Function(_$DnsRecordImpl) _then)
      : super(_value, _then);

  /// Create a copy of DnsRecord
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = freezed,
    Object? type = null,
    Object? host = null,
    Object? value = null,
    Object? ttl = freezed,
    Object? priority = freezed,
  }) {
    return _then(_$DnsRecordImpl(
      id: freezed == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      host: null == host
          ? _value.host
          : host // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as String,
      ttl: freezed == ttl
          ? _value.ttl
          : ttl // ignore: cast_nullable_to_non_nullable
              as int?,
      priority: freezed == priority
          ? _value.priority
          : priority // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DnsRecordImpl implements _DnsRecord {
  const _$DnsRecordImpl(
      {this.id,
      this.type = "",
      this.host = "",
      this.value = "",
      this.ttl,
      this.priority});

  factory _$DnsRecordImpl.fromJson(Map<String, dynamic> json) =>
      _$$DnsRecordImplFromJson(json);

  @override
  final String? id;
  @override
  @JsonKey()
  final String type;
  @override
  @JsonKey()
  final String host;
  @override
  @JsonKey()
  final String value;
  @override
  final int? ttl;
  @override
  final int? priority;

  @override
  String toString() {
    return 'DnsRecord(id: $id, type: $type, host: $host, value: $value, ttl: $ttl, priority: $priority)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DnsRecordImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.host, host) || other.host == host) &&
            (identical(other.value, value) || other.value == value) &&
            (identical(other.ttl, ttl) || other.ttl == ttl) &&
            (identical(other.priority, priority) ||
                other.priority == priority));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, host, value, ttl, priority);

  /// Create a copy of DnsRecord
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DnsRecordImplCopyWith<_$DnsRecordImpl> get copyWith =>
      __$$DnsRecordImplCopyWithImpl<_$DnsRecordImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DnsRecordImplToJson(
      this,
    );
  }
}

abstract class _DnsRecord implements DnsRecord {
  const factory _DnsRecord(
      {final String? id,
      final String type,
      final String host,
      final String value,
      final int? ttl,
      final int? priority}) = _$DnsRecordImpl;

  factory _DnsRecord.fromJson(Map<String, dynamic> json) =
      _$DnsRecordImpl.fromJson;

  @override
  String? get id;
  @override
  String get type;
  @override
  String get host;
  @override
  String get value;
  @override
  int? get ttl;
  @override
  int? get priority;

  /// Create a copy of DnsRecord
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DnsRecordImplCopyWith<_$DnsRecordImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DnsRecordsResponse _$DnsRecordsResponseFromJson(Map<String, dynamic> json) {
  return _DnsRecordsResponse.fromJson(json);
}

/// @nodoc
mixin _$DnsRecordsResponse {
  List<DnsRecord> get records => throw _privateConstructorUsedError;

  /// Serializes this DnsRecordsResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DnsRecordsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DnsRecordsResponseCopyWith<DnsRecordsResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DnsRecordsResponseCopyWith<$Res> {
  factory $DnsRecordsResponseCopyWith(
          DnsRecordsResponse value, $Res Function(DnsRecordsResponse) then) =
      _$DnsRecordsResponseCopyWithImpl<$Res, DnsRecordsResponse>;
  @useResult
  $Res call({List<DnsRecord> records});
}

/// @nodoc
class _$DnsRecordsResponseCopyWithImpl<$Res, $Val extends DnsRecordsResponse>
    implements $DnsRecordsResponseCopyWith<$Res> {
  _$DnsRecordsResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DnsRecordsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? records = null,
  }) {
    return _then(_value.copyWith(
      records: null == records
          ? _value.records
          : records // ignore: cast_nullable_to_non_nullable
              as List<DnsRecord>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DnsRecordsResponseImplCopyWith<$Res>
    implements $DnsRecordsResponseCopyWith<$Res> {
  factory _$$DnsRecordsResponseImplCopyWith(_$DnsRecordsResponseImpl value,
          $Res Function(_$DnsRecordsResponseImpl) then) =
      __$$DnsRecordsResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<DnsRecord> records});
}

/// @nodoc
class __$$DnsRecordsResponseImplCopyWithImpl<$Res>
    extends _$DnsRecordsResponseCopyWithImpl<$Res, _$DnsRecordsResponseImpl>
    implements _$$DnsRecordsResponseImplCopyWith<$Res> {
  __$$DnsRecordsResponseImplCopyWithImpl(_$DnsRecordsResponseImpl _value,
      $Res Function(_$DnsRecordsResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DnsRecordsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? records = null,
  }) {
    return _then(_$DnsRecordsResponseImpl(
      records: null == records
          ? _value._records
          : records // ignore: cast_nullable_to_non_nullable
              as List<DnsRecord>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DnsRecordsResponseImpl implements _DnsRecordsResponse {
  const _$DnsRecordsResponseImpl(
      {final List<DnsRecord> records = const <DnsRecord>[]})
      : _records = records;

  factory _$DnsRecordsResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DnsRecordsResponseImplFromJson(json);

  final List<DnsRecord> _records;
  @override
  @JsonKey()
  List<DnsRecord> get records {
    if (_records is EqualUnmodifiableListView) return _records;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_records);
  }

  @override
  String toString() {
    return 'DnsRecordsResponse(records: $records)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DnsRecordsResponseImpl &&
            const DeepCollectionEquality().equals(other._records, _records));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(_records));

  /// Create a copy of DnsRecordsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DnsRecordsResponseImplCopyWith<_$DnsRecordsResponseImpl> get copyWith =>
      __$$DnsRecordsResponseImplCopyWithImpl<_$DnsRecordsResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DnsRecordsResponseImplToJson(
      this,
    );
  }
}

abstract class _DnsRecordsResponse implements DnsRecordsResponse {
  const factory _DnsRecordsResponse({final List<DnsRecord> records}) =
      _$DnsRecordsResponseImpl;

  factory _DnsRecordsResponse.fromJson(Map<String, dynamic> json) =
      _$DnsRecordsResponseImpl.fromJson;

  @override
  List<DnsRecord> get records;

  /// Create a copy of DnsRecordsResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DnsRecordsResponseImplCopyWith<_$DnsRecordsResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
