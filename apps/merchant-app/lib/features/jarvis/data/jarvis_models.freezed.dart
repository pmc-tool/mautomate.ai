// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'jarvis_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$JarvisToolActivity {
  String get id => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  ToolState get state => throw _privateConstructorUsedError;

  /// "read" | "write", from the `tool_call` frame.
  String? get kind => throw _privateConstructorUsedError;

  /// The tool's (server-sanitized) call arguments, from the `tool_call` frame.
  Map<String, dynamic>? get args => throw _privateConstructorUsedError;

  /// Whether a read tool succeeded, from the `tool_result` frame.
  bool? get ok => throw _privateConstructorUsedError;

  /// A read tool's returned data (any JSON shape), from `tool_result`.
  Object? get resultData => throw _privateConstructorUsedError;

  /// A read tool's error message, from `tool_result`.
  String? get resultError => throw _privateConstructorUsedError;

  /// Create a copy of JarvisToolActivity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisToolActivityCopyWith<JarvisToolActivity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisToolActivityCopyWith<$Res> {
  factory $JarvisToolActivityCopyWith(
          JarvisToolActivity value, $Res Function(JarvisToolActivity) then) =
      _$JarvisToolActivityCopyWithImpl<$Res, JarvisToolActivity>;
  @useResult
  $Res call(
      {String id,
      String label,
      ToolState state,
      String? kind,
      Map<String, dynamic>? args,
      bool? ok,
      Object? resultData,
      String? resultError});
}

/// @nodoc
class _$JarvisToolActivityCopyWithImpl<$Res, $Val extends JarvisToolActivity>
    implements $JarvisToolActivityCopyWith<$Res> {
  _$JarvisToolActivityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisToolActivity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? state = null,
    Object? kind = freezed,
    Object? args = freezed,
    Object? ok = freezed,
    Object? resultData = freezed,
    Object? resultError = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      state: null == state
          ? _value.state
          : state // ignore: cast_nullable_to_non_nullable
              as ToolState,
      kind: freezed == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String?,
      args: freezed == args
          ? _value.args
          : args // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      ok: freezed == ok
          ? _value.ok
          : ok // ignore: cast_nullable_to_non_nullable
              as bool?,
      resultData: freezed == resultData ? _value.resultData : resultData,
      resultError: freezed == resultError
          ? _value.resultError
          : resultError // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$JarvisToolActivityImplCopyWith<$Res>
    implements $JarvisToolActivityCopyWith<$Res> {
  factory _$$JarvisToolActivityImplCopyWith(_$JarvisToolActivityImpl value,
          $Res Function(_$JarvisToolActivityImpl) then) =
      __$$JarvisToolActivityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String label,
      ToolState state,
      String? kind,
      Map<String, dynamic>? args,
      bool? ok,
      Object? resultData,
      String? resultError});
}

/// @nodoc
class __$$JarvisToolActivityImplCopyWithImpl<$Res>
    extends _$JarvisToolActivityCopyWithImpl<$Res, _$JarvisToolActivityImpl>
    implements _$$JarvisToolActivityImplCopyWith<$Res> {
  __$$JarvisToolActivityImplCopyWithImpl(_$JarvisToolActivityImpl _value,
      $Res Function(_$JarvisToolActivityImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisToolActivity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? state = null,
    Object? kind = freezed,
    Object? args = freezed,
    Object? ok = freezed,
    Object? resultData = freezed,
    Object? resultError = freezed,
  }) {
    return _then(_$JarvisToolActivityImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      state: null == state
          ? _value.state
          : state // ignore: cast_nullable_to_non_nullable
              as ToolState,
      kind: freezed == kind
          ? _value.kind
          : kind // ignore: cast_nullable_to_non_nullable
              as String?,
      args: freezed == args
          ? _value._args
          : args // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      ok: freezed == ok
          ? _value.ok
          : ok // ignore: cast_nullable_to_non_nullable
              as bool?,
      resultData: freezed == resultData ? _value.resultData : resultData,
      resultError: freezed == resultError
          ? _value.resultError
          : resultError // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$JarvisToolActivityImpl implements _JarvisToolActivity {
  const _$JarvisToolActivityImpl(
      {required this.id,
      required this.label,
      this.state = ToolState.running,
      this.kind,
      final Map<String, dynamic>? args,
      this.ok,
      this.resultData,
      this.resultError})
      : _args = args;

  @override
  final String id;
  @override
  final String label;
  @override
  @JsonKey()
  final ToolState state;

  /// "read" | "write", from the `tool_call` frame.
  @override
  final String? kind;

  /// The tool's (server-sanitized) call arguments, from the `tool_call` frame.
  final Map<String, dynamic>? _args;

  /// The tool's (server-sanitized) call arguments, from the `tool_call` frame.
  @override
  Map<String, dynamic>? get args {
    final value = _args;
    if (value == null) return null;
    if (_args is EqualUnmodifiableMapView) return _args;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  /// Whether a read tool succeeded, from the `tool_result` frame.
  @override
  final bool? ok;

  /// A read tool's returned data (any JSON shape), from `tool_result`.
  @override
  final Object? resultData;

  /// A read tool's error message, from `tool_result`.
  @override
  final String? resultError;

  @override
  String toString() {
    return 'JarvisToolActivity(id: $id, label: $label, state: $state, kind: $kind, args: $args, ok: $ok, resultData: $resultData, resultError: $resultError)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisToolActivityImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.state, state) || other.state == state) &&
            (identical(other.kind, kind) || other.kind == kind) &&
            const DeepCollectionEquality().equals(other._args, _args) &&
            (identical(other.ok, ok) || other.ok == ok) &&
            const DeepCollectionEquality()
                .equals(other.resultData, resultData) &&
            (identical(other.resultError, resultError) ||
                other.resultError == resultError));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      label,
      state,
      kind,
      const DeepCollectionEquality().hash(_args),
      ok,
      const DeepCollectionEquality().hash(resultData),
      resultError);

  /// Create a copy of JarvisToolActivity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisToolActivityImplCopyWith<_$JarvisToolActivityImpl> get copyWith =>
      __$$JarvisToolActivityImplCopyWithImpl<_$JarvisToolActivityImpl>(
          this, _$identity);
}

abstract class _JarvisToolActivity implements JarvisToolActivity {
  const factory _JarvisToolActivity(
      {required final String id,
      required final String label,
      final ToolState state,
      final String? kind,
      final Map<String, dynamic>? args,
      final bool? ok,
      final Object? resultData,
      final String? resultError}) = _$JarvisToolActivityImpl;

  @override
  String get id;
  @override
  String get label;
  @override
  ToolState get state;

  /// "read" | "write", from the `tool_call` frame.
  @override
  String? get kind;

  /// The tool's (server-sanitized) call arguments, from the `tool_call` frame.
  @override
  Map<String, dynamic>? get args;

  /// Whether a read tool succeeded, from the `tool_result` frame.
  @override
  bool? get ok;

  /// A read tool's returned data (any JSON shape), from `tool_result`.
  @override
  Object? get resultData;

  /// A read tool's error message, from `tool_result`.
  @override
  String? get resultError;

  /// Create a copy of JarvisToolActivity
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisToolActivityImplCopyWith<_$JarvisToolActivityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

JarvisUndo _$JarvisUndoFromJson(Map<String, dynamic> json) {
  return _JarvisUndo.fromJson(json);
}

/// @nodoc
mixin _$JarvisUndo {
  String get token => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;

  /// Serializes this JarvisUndo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of JarvisUndo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisUndoCopyWith<JarvisUndo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisUndoCopyWith<$Res> {
  factory $JarvisUndoCopyWith(
          JarvisUndo value, $Res Function(JarvisUndo) then) =
      _$JarvisUndoCopyWithImpl<$Res, JarvisUndo>;
  @useResult
  $Res call({String token, String label});
}

/// @nodoc
class _$JarvisUndoCopyWithImpl<$Res, $Val extends JarvisUndo>
    implements $JarvisUndoCopyWith<$Res> {
  _$JarvisUndoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisUndo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? token = null,
    Object? label = null,
  }) {
    return _then(_value.copyWith(
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$JarvisUndoImplCopyWith<$Res>
    implements $JarvisUndoCopyWith<$Res> {
  factory _$$JarvisUndoImplCopyWith(
          _$JarvisUndoImpl value, $Res Function(_$JarvisUndoImpl) then) =
      __$$JarvisUndoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String token, String label});
}

/// @nodoc
class __$$JarvisUndoImplCopyWithImpl<$Res>
    extends _$JarvisUndoCopyWithImpl<$Res, _$JarvisUndoImpl>
    implements _$$JarvisUndoImplCopyWith<$Res> {
  __$$JarvisUndoImplCopyWithImpl(
      _$JarvisUndoImpl _value, $Res Function(_$JarvisUndoImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisUndo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? token = null,
    Object? label = null,
  }) {
    return _then(_$JarvisUndoImpl(
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$JarvisUndoImpl implements _JarvisUndo {
  const _$JarvisUndoImpl({required this.token, this.label = "Undo"});

  factory _$JarvisUndoImpl.fromJson(Map<String, dynamic> json) =>
      _$$JarvisUndoImplFromJson(json);

  @override
  final String token;
  @override
  @JsonKey()
  final String label;

  @override
  String toString() {
    return 'JarvisUndo(token: $token, label: $label)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisUndoImpl &&
            (identical(other.token, token) || other.token == token) &&
            (identical(other.label, label) || other.label == label));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, token, label);

  /// Create a copy of JarvisUndo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisUndoImplCopyWith<_$JarvisUndoImpl> get copyWith =>
      __$$JarvisUndoImplCopyWithImpl<_$JarvisUndoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$JarvisUndoImplToJson(
      this,
    );
  }
}

abstract class _JarvisUndo implements JarvisUndo {
  const factory _JarvisUndo({required final String token, final String label}) =
      _$JarvisUndoImpl;

  factory _JarvisUndo.fromJson(Map<String, dynamic> json) =
      _$JarvisUndoImpl.fromJson;

  @override
  String get token;
  @override
  String get label;

  /// Create a copy of JarvisUndo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisUndoImplCopyWith<_$JarvisUndoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$JarvisConfirm {
  String get id => throw _privateConstructorUsedError;
  String get action => throw _privateConstructorUsedError;
  String get token => throw _privateConstructorUsedError;
  String get summary => throw _privateConstructorUsedError;
  ConfirmTier get tier => throw _privateConstructorUsedError;
  String? get requireText => throw _privateConstructorUsedError;
  Map<String, dynamic> get details => throw _privateConstructorUsedError;
  ConfirmStatus get status => throw _privateConstructorUsedError;
  String? get error => throw _privateConstructorUsedError;
  String? get resultMsg => throw _privateConstructorUsedError;
  JarvisUndo? get undo => throw _privateConstructorUsedError;
  bool get undoing => throw _privateConstructorUsedError;
  bool get undone => throw _privateConstructorUsedError;

  /// Create a copy of JarvisConfirm
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisConfirmCopyWith<JarvisConfirm> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisConfirmCopyWith<$Res> {
  factory $JarvisConfirmCopyWith(
          JarvisConfirm value, $Res Function(JarvisConfirm) then) =
      _$JarvisConfirmCopyWithImpl<$Res, JarvisConfirm>;
  @useResult
  $Res call(
      {String id,
      String action,
      String token,
      String summary,
      ConfirmTier tier,
      String? requireText,
      Map<String, dynamic> details,
      ConfirmStatus status,
      String? error,
      String? resultMsg,
      JarvisUndo? undo,
      bool undoing,
      bool undone});

  $JarvisUndoCopyWith<$Res>? get undo;
}

/// @nodoc
class _$JarvisConfirmCopyWithImpl<$Res, $Val extends JarvisConfirm>
    implements $JarvisConfirmCopyWith<$Res> {
  _$JarvisConfirmCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisConfirm
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? action = null,
    Object? token = null,
    Object? summary = null,
    Object? tier = null,
    Object? requireText = freezed,
    Object? details = null,
    Object? status = null,
    Object? error = freezed,
    Object? resultMsg = freezed,
    Object? undo = freezed,
    Object? undoing = null,
    Object? undone = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as String,
      tier: null == tier
          ? _value.tier
          : tier // ignore: cast_nullable_to_non_nullable
              as ConfirmTier,
      requireText: freezed == requireText
          ? _value.requireText
          : requireText // ignore: cast_nullable_to_non_nullable
              as String?,
      details: null == details
          ? _value.details
          : details // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as ConfirmStatus,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
      resultMsg: freezed == resultMsg
          ? _value.resultMsg
          : resultMsg // ignore: cast_nullable_to_non_nullable
              as String?,
      undo: freezed == undo
          ? _value.undo
          : undo // ignore: cast_nullable_to_non_nullable
              as JarvisUndo?,
      undoing: null == undoing
          ? _value.undoing
          : undoing // ignore: cast_nullable_to_non_nullable
              as bool,
      undone: null == undone
          ? _value.undone
          : undone // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }

  /// Create a copy of JarvisConfirm
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $JarvisUndoCopyWith<$Res>? get undo {
    if (_value.undo == null) {
      return null;
    }

    return $JarvisUndoCopyWith<$Res>(_value.undo!, (value) {
      return _then(_value.copyWith(undo: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$JarvisConfirmImplCopyWith<$Res>
    implements $JarvisConfirmCopyWith<$Res> {
  factory _$$JarvisConfirmImplCopyWith(
          _$JarvisConfirmImpl value, $Res Function(_$JarvisConfirmImpl) then) =
      __$$JarvisConfirmImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String action,
      String token,
      String summary,
      ConfirmTier tier,
      String? requireText,
      Map<String, dynamic> details,
      ConfirmStatus status,
      String? error,
      String? resultMsg,
      JarvisUndo? undo,
      bool undoing,
      bool undone});

  @override
  $JarvisUndoCopyWith<$Res>? get undo;
}

/// @nodoc
class __$$JarvisConfirmImplCopyWithImpl<$Res>
    extends _$JarvisConfirmCopyWithImpl<$Res, _$JarvisConfirmImpl>
    implements _$$JarvisConfirmImplCopyWith<$Res> {
  __$$JarvisConfirmImplCopyWithImpl(
      _$JarvisConfirmImpl _value, $Res Function(_$JarvisConfirmImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisConfirm
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? action = null,
    Object? token = null,
    Object? summary = null,
    Object? tier = null,
    Object? requireText = freezed,
    Object? details = null,
    Object? status = null,
    Object? error = freezed,
    Object? resultMsg = freezed,
    Object? undo = freezed,
    Object? undoing = null,
    Object? undone = null,
  }) {
    return _then(_$JarvisConfirmImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as String,
      tier: null == tier
          ? _value.tier
          : tier // ignore: cast_nullable_to_non_nullable
              as ConfirmTier,
      requireText: freezed == requireText
          ? _value.requireText
          : requireText // ignore: cast_nullable_to_non_nullable
              as String?,
      details: null == details
          ? _value._details
          : details // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as ConfirmStatus,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
      resultMsg: freezed == resultMsg
          ? _value.resultMsg
          : resultMsg // ignore: cast_nullable_to_non_nullable
              as String?,
      undo: freezed == undo
          ? _value.undo
          : undo // ignore: cast_nullable_to_non_nullable
              as JarvisUndo?,
      undoing: null == undoing
          ? _value.undoing
          : undoing // ignore: cast_nullable_to_non_nullable
              as bool,
      undone: null == undone
          ? _value.undone
          : undone // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$JarvisConfirmImpl implements _JarvisConfirm {
  const _$JarvisConfirmImpl(
      {required this.id,
      required this.action,
      required this.token,
      required this.summary,
      this.tier = ConfirmTier.soft,
      this.requireText,
      final Map<String, dynamic> details = const <String, dynamic>{},
      this.status = ConfirmStatus.pending,
      this.error,
      this.resultMsg,
      this.undo,
      this.undoing = false,
      this.undone = false})
      : _details = details;

  @override
  final String id;
  @override
  final String action;
  @override
  final String token;
  @override
  final String summary;
  @override
  @JsonKey()
  final ConfirmTier tier;
  @override
  final String? requireText;
  final Map<String, dynamic> _details;
  @override
  @JsonKey()
  Map<String, dynamic> get details {
    if (_details is EqualUnmodifiableMapView) return _details;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_details);
  }

  @override
  @JsonKey()
  final ConfirmStatus status;
  @override
  final String? error;
  @override
  final String? resultMsg;
  @override
  final JarvisUndo? undo;
  @override
  @JsonKey()
  final bool undoing;
  @override
  @JsonKey()
  final bool undone;

  @override
  String toString() {
    return 'JarvisConfirm(id: $id, action: $action, token: $token, summary: $summary, tier: $tier, requireText: $requireText, details: $details, status: $status, error: $error, resultMsg: $resultMsg, undo: $undo, undoing: $undoing, undone: $undone)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisConfirmImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.action, action) || other.action == action) &&
            (identical(other.token, token) || other.token == token) &&
            (identical(other.summary, summary) || other.summary == summary) &&
            (identical(other.tier, tier) || other.tier == tier) &&
            (identical(other.requireText, requireText) ||
                other.requireText == requireText) &&
            const DeepCollectionEquality().equals(other._details, _details) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.resultMsg, resultMsg) ||
                other.resultMsg == resultMsg) &&
            (identical(other.undo, undo) || other.undo == undo) &&
            (identical(other.undoing, undoing) || other.undoing == undoing) &&
            (identical(other.undone, undone) || other.undone == undone));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      action,
      token,
      summary,
      tier,
      requireText,
      const DeepCollectionEquality().hash(_details),
      status,
      error,
      resultMsg,
      undo,
      undoing,
      undone);

  /// Create a copy of JarvisConfirm
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisConfirmImplCopyWith<_$JarvisConfirmImpl> get copyWith =>
      __$$JarvisConfirmImplCopyWithImpl<_$JarvisConfirmImpl>(this, _$identity);
}

abstract class _JarvisConfirm implements JarvisConfirm {
  const factory _JarvisConfirm(
      {required final String id,
      required final String action,
      required final String token,
      required final String summary,
      final ConfirmTier tier,
      final String? requireText,
      final Map<String, dynamic> details,
      final ConfirmStatus status,
      final String? error,
      final String? resultMsg,
      final JarvisUndo? undo,
      final bool undoing,
      final bool undone}) = _$JarvisConfirmImpl;

  @override
  String get id;
  @override
  String get action;
  @override
  String get token;
  @override
  String get summary;
  @override
  ConfirmTier get tier;
  @override
  String? get requireText;
  @override
  Map<String, dynamic> get details;
  @override
  ConfirmStatus get status;
  @override
  String? get error;
  @override
  String? get resultMsg;
  @override
  JarvisUndo? get undo;
  @override
  bool get undoing;
  @override
  bool get undone;

  /// Create a copy of JarvisConfirm
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisConfirmImplCopyWith<_$JarvisConfirmImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$ChatMessage {
  ChatRole get role => throw _privateConstructorUsedError;
  String? get text => throw _privateConstructorUsedError;
  List<JarvisToolActivity> get tools => throw _privateConstructorUsedError;
  List<JarvisConfirm> get confirms => throw _privateConstructorUsedError;
  bool get thinking => throw _privateConstructorUsedError;
  String? get error => throw _privateConstructorUsedError;

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChatMessageCopyWith<ChatMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChatMessageCopyWith<$Res> {
  factory $ChatMessageCopyWith(
          ChatMessage value, $Res Function(ChatMessage) then) =
      _$ChatMessageCopyWithImpl<$Res, ChatMessage>;
  @useResult
  $Res call(
      {ChatRole role,
      String? text,
      List<JarvisToolActivity> tools,
      List<JarvisConfirm> confirms,
      bool thinking,
      String? error});
}

/// @nodoc
class _$ChatMessageCopyWithImpl<$Res, $Val extends ChatMessage>
    implements $ChatMessageCopyWith<$Res> {
  _$ChatMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? role = null,
    Object? text = freezed,
    Object? tools = null,
    Object? confirms = null,
    Object? thinking = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as ChatRole,
      text: freezed == text
          ? _value.text
          : text // ignore: cast_nullable_to_non_nullable
              as String?,
      tools: null == tools
          ? _value.tools
          : tools // ignore: cast_nullable_to_non_nullable
              as List<JarvisToolActivity>,
      confirms: null == confirms
          ? _value.confirms
          : confirms // ignore: cast_nullable_to_non_nullable
              as List<JarvisConfirm>,
      thinking: null == thinking
          ? _value.thinking
          : thinking // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChatMessageImplCopyWith<$Res>
    implements $ChatMessageCopyWith<$Res> {
  factory _$$ChatMessageImplCopyWith(
          _$ChatMessageImpl value, $Res Function(_$ChatMessageImpl) then) =
      __$$ChatMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ChatRole role,
      String? text,
      List<JarvisToolActivity> tools,
      List<JarvisConfirm> confirms,
      bool thinking,
      String? error});
}

/// @nodoc
class __$$ChatMessageImplCopyWithImpl<$Res>
    extends _$ChatMessageCopyWithImpl<$Res, _$ChatMessageImpl>
    implements _$$ChatMessageImplCopyWith<$Res> {
  __$$ChatMessageImplCopyWithImpl(
      _$ChatMessageImpl _value, $Res Function(_$ChatMessageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? role = null,
    Object? text = freezed,
    Object? tools = null,
    Object? confirms = null,
    Object? thinking = null,
    Object? error = freezed,
  }) {
    return _then(_$ChatMessageImpl(
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as ChatRole,
      text: freezed == text
          ? _value.text
          : text // ignore: cast_nullable_to_non_nullable
              as String?,
      tools: null == tools
          ? _value._tools
          : tools // ignore: cast_nullable_to_non_nullable
              as List<JarvisToolActivity>,
      confirms: null == confirms
          ? _value._confirms
          : confirms // ignore: cast_nullable_to_non_nullable
              as List<JarvisConfirm>,
      thinking: null == thinking
          ? _value.thinking
          : thinking // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$ChatMessageImpl implements _ChatMessage {
  const _$ChatMessageImpl(
      {required this.role,
      this.text,
      final List<JarvisToolActivity> tools = const <JarvisToolActivity>[],
      final List<JarvisConfirm> confirms = const <JarvisConfirm>[],
      this.thinking = false,
      this.error})
      : _tools = tools,
        _confirms = confirms;

  @override
  final ChatRole role;
  @override
  final String? text;
  final List<JarvisToolActivity> _tools;
  @override
  @JsonKey()
  List<JarvisToolActivity> get tools {
    if (_tools is EqualUnmodifiableListView) return _tools;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tools);
  }

  final List<JarvisConfirm> _confirms;
  @override
  @JsonKey()
  List<JarvisConfirm> get confirms {
    if (_confirms is EqualUnmodifiableListView) return _confirms;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_confirms);
  }

  @override
  @JsonKey()
  final bool thinking;
  @override
  final String? error;

  @override
  String toString() {
    return 'ChatMessage(role: $role, text: $text, tools: $tools, confirms: $confirms, thinking: $thinking, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChatMessageImpl &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.text, text) || other.text == text) &&
            const DeepCollectionEquality().equals(other._tools, _tools) &&
            const DeepCollectionEquality().equals(other._confirms, _confirms) &&
            (identical(other.thinking, thinking) ||
                other.thinking == thinking) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      role,
      text,
      const DeepCollectionEquality().hash(_tools),
      const DeepCollectionEquality().hash(_confirms),
      thinking,
      error);

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChatMessageImplCopyWith<_$ChatMessageImpl> get copyWith =>
      __$$ChatMessageImplCopyWithImpl<_$ChatMessageImpl>(this, _$identity);
}

abstract class _ChatMessage implements ChatMessage {
  const factory _ChatMessage(
      {required final ChatRole role,
      final String? text,
      final List<JarvisToolActivity> tools,
      final List<JarvisConfirm> confirms,
      final bool thinking,
      final String? error}) = _$ChatMessageImpl;

  @override
  ChatRole get role;
  @override
  String? get text;
  @override
  List<JarvisToolActivity> get tools;
  @override
  List<JarvisConfirm> get confirms;
  @override
  bool get thinking;
  @override
  String? get error;

  /// Create a copy of ChatMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChatMessageImplCopyWith<_$ChatMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

JarvisApplyResult _$JarvisApplyResultFromJson(Map<String, dynamic> json) {
  return _JarvisApplyResult.fromJson(json);
}

/// @nodoc
mixin _$JarvisApplyResult {
  bool get ok => throw _privateConstructorUsedError;
  String? get message => throw _privateConstructorUsedError;
  JarvisUndo? get undo => throw _privateConstructorUsedError;

  /// Serializes this JarvisApplyResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of JarvisApplyResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisApplyResultCopyWith<JarvisApplyResult> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisApplyResultCopyWith<$Res> {
  factory $JarvisApplyResultCopyWith(
          JarvisApplyResult value, $Res Function(JarvisApplyResult) then) =
      _$JarvisApplyResultCopyWithImpl<$Res, JarvisApplyResult>;
  @useResult
  $Res call({bool ok, String? message, JarvisUndo? undo});

  $JarvisUndoCopyWith<$Res>? get undo;
}

/// @nodoc
class _$JarvisApplyResultCopyWithImpl<$Res, $Val extends JarvisApplyResult>
    implements $JarvisApplyResultCopyWith<$Res> {
  _$JarvisApplyResultCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisApplyResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? ok = null,
    Object? message = freezed,
    Object? undo = freezed,
  }) {
    return _then(_value.copyWith(
      ok: null == ok
          ? _value.ok
          : ok // ignore: cast_nullable_to_non_nullable
              as bool,
      message: freezed == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String?,
      undo: freezed == undo
          ? _value.undo
          : undo // ignore: cast_nullable_to_non_nullable
              as JarvisUndo?,
    ) as $Val);
  }

  /// Create a copy of JarvisApplyResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $JarvisUndoCopyWith<$Res>? get undo {
    if (_value.undo == null) {
      return null;
    }

    return $JarvisUndoCopyWith<$Res>(_value.undo!, (value) {
      return _then(_value.copyWith(undo: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$JarvisApplyResultImplCopyWith<$Res>
    implements $JarvisApplyResultCopyWith<$Res> {
  factory _$$JarvisApplyResultImplCopyWith(_$JarvisApplyResultImpl value,
          $Res Function(_$JarvisApplyResultImpl) then) =
      __$$JarvisApplyResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool ok, String? message, JarvisUndo? undo});

  @override
  $JarvisUndoCopyWith<$Res>? get undo;
}

/// @nodoc
class __$$JarvisApplyResultImplCopyWithImpl<$Res>
    extends _$JarvisApplyResultCopyWithImpl<$Res, _$JarvisApplyResultImpl>
    implements _$$JarvisApplyResultImplCopyWith<$Res> {
  __$$JarvisApplyResultImplCopyWithImpl(_$JarvisApplyResultImpl _value,
      $Res Function(_$JarvisApplyResultImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisApplyResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? ok = null,
    Object? message = freezed,
    Object? undo = freezed,
  }) {
    return _then(_$JarvisApplyResultImpl(
      ok: null == ok
          ? _value.ok
          : ok // ignore: cast_nullable_to_non_nullable
              as bool,
      message: freezed == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String?,
      undo: freezed == undo
          ? _value.undo
          : undo // ignore: cast_nullable_to_non_nullable
              as JarvisUndo?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$JarvisApplyResultImpl implements _JarvisApplyResult {
  const _$JarvisApplyResultImpl({this.ok = false, this.message, this.undo});

  factory _$JarvisApplyResultImpl.fromJson(Map<String, dynamic> json) =>
      _$$JarvisApplyResultImplFromJson(json);

  @override
  @JsonKey()
  final bool ok;
  @override
  final String? message;
  @override
  final JarvisUndo? undo;

  @override
  String toString() {
    return 'JarvisApplyResult(ok: $ok, message: $message, undo: $undo)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisApplyResultImpl &&
            (identical(other.ok, ok) || other.ok == ok) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.undo, undo) || other.undo == undo));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, ok, message, undo);

  /// Create a copy of JarvisApplyResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisApplyResultImplCopyWith<_$JarvisApplyResultImpl> get copyWith =>
      __$$JarvisApplyResultImplCopyWithImpl<_$JarvisApplyResultImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$JarvisApplyResultImplToJson(
      this,
    );
  }
}

abstract class _JarvisApplyResult implements JarvisApplyResult {
  const factory _JarvisApplyResult(
      {final bool ok,
      final String? message,
      final JarvisUndo? undo}) = _$JarvisApplyResultImpl;

  factory _JarvisApplyResult.fromJson(Map<String, dynamic> json) =
      _$JarvisApplyResultImpl.fromJson;

  @override
  bool get ok;
  @override
  String? get message;
  @override
  JarvisUndo? get undo;

  /// Create a copy of JarvisApplyResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisApplyResultImplCopyWith<_$JarvisApplyResultImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

JarvisConversation _$JarvisConversationFromJson(Map<String, dynamic> json) {
  return _JarvisConversation.fromJson(json);
}

/// @nodoc
mixin _$JarvisConversation {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  @JsonKey(name: "updated_at")
  String? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this JarvisConversation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of JarvisConversation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisConversationCopyWith<JarvisConversation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisConversationCopyWith<$Res> {
  factory $JarvisConversationCopyWith(
          JarvisConversation value, $Res Function(JarvisConversation) then) =
      _$JarvisConversationCopyWithImpl<$Res, JarvisConversation>;
  @useResult
  $Res call(
      {String id,
      String title,
      @JsonKey(name: "updated_at") String? updatedAt});
}

/// @nodoc
class _$JarvisConversationCopyWithImpl<$Res, $Val extends JarvisConversation>
    implements $JarvisConversationCopyWith<$Res> {
  _$JarvisConversationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisConversation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
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
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$JarvisConversationImplCopyWith<$Res>
    implements $JarvisConversationCopyWith<$Res> {
  factory _$$JarvisConversationImplCopyWith(_$JarvisConversationImpl value,
          $Res Function(_$JarvisConversationImpl) then) =
      __$$JarvisConversationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      @JsonKey(name: "updated_at") String? updatedAt});
}

/// @nodoc
class __$$JarvisConversationImplCopyWithImpl<$Res>
    extends _$JarvisConversationCopyWithImpl<$Res, _$JarvisConversationImpl>
    implements _$$JarvisConversationImplCopyWith<$Res> {
  __$$JarvisConversationImplCopyWithImpl(_$JarvisConversationImpl _value,
      $Res Function(_$JarvisConversationImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisConversation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$JarvisConversationImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$JarvisConversationImpl implements _JarvisConversation {
  const _$JarvisConversationImpl(
      {required this.id,
      this.title = "New chat",
      @JsonKey(name: "updated_at") this.updatedAt});

  factory _$JarvisConversationImpl.fromJson(Map<String, dynamic> json) =>
      _$$JarvisConversationImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String title;
  @override
  @JsonKey(name: "updated_at")
  final String? updatedAt;

  @override
  String toString() {
    return 'JarvisConversation(id: $id, title: $title, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisConversationImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, title, updatedAt);

  /// Create a copy of JarvisConversation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisConversationImplCopyWith<_$JarvisConversationImpl> get copyWith =>
      __$$JarvisConversationImplCopyWithImpl<_$JarvisConversationImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$JarvisConversationImplToJson(
      this,
    );
  }
}

abstract class _JarvisConversation implements JarvisConversation {
  const factory _JarvisConversation(
          {required final String id,
          final String title,
          @JsonKey(name: "updated_at") final String? updatedAt}) =
      _$JarvisConversationImpl;

  factory _JarvisConversation.fromJson(Map<String, dynamic> json) =
      _$JarvisConversationImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  @JsonKey(name: "updated_at")
  String? get updatedAt;

  /// Create a copy of JarvisConversation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisConversationImplCopyWith<_$JarvisConversationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

JarvisStoredMessage _$JarvisStoredMessageFromJson(Map<String, dynamic> json) {
  return _JarvisStoredMessage.fromJson(json);
}

/// @nodoc
mixin _$JarvisStoredMessage {
  String get role => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  Map<String, dynamic>? get meta => throw _privateConstructorUsedError;
  @JsonKey(name: "created_at")
  String? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this JarvisStoredMessage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of JarvisStoredMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisStoredMessageCopyWith<JarvisStoredMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisStoredMessageCopyWith<$Res> {
  factory $JarvisStoredMessageCopyWith(
          JarvisStoredMessage value, $Res Function(JarvisStoredMessage) then) =
      _$JarvisStoredMessageCopyWithImpl<$Res, JarvisStoredMessage>;
  @useResult
  $Res call(
      {String role,
      String content,
      Map<String, dynamic>? meta,
      @JsonKey(name: "created_at") String? createdAt});
}

/// @nodoc
class _$JarvisStoredMessageCopyWithImpl<$Res, $Val extends JarvisStoredMessage>
    implements $JarvisStoredMessageCopyWith<$Res> {
  _$JarvisStoredMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisStoredMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? role = null,
    Object? content = null,
    Object? meta = freezed,
    Object? createdAt = freezed,
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
      meta: freezed == meta
          ? _value.meta
          : meta // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$JarvisStoredMessageImplCopyWith<$Res>
    implements $JarvisStoredMessageCopyWith<$Res> {
  factory _$$JarvisStoredMessageImplCopyWith(_$JarvisStoredMessageImpl value,
          $Res Function(_$JarvisStoredMessageImpl) then) =
      __$$JarvisStoredMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String role,
      String content,
      Map<String, dynamic>? meta,
      @JsonKey(name: "created_at") String? createdAt});
}

/// @nodoc
class __$$JarvisStoredMessageImplCopyWithImpl<$Res>
    extends _$JarvisStoredMessageCopyWithImpl<$Res, _$JarvisStoredMessageImpl>
    implements _$$JarvisStoredMessageImplCopyWith<$Res> {
  __$$JarvisStoredMessageImplCopyWithImpl(_$JarvisStoredMessageImpl _value,
      $Res Function(_$JarvisStoredMessageImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStoredMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? role = null,
    Object? content = null,
    Object? meta = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(_$JarvisStoredMessageImpl(
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String,
      content: null == content
          ? _value.content
          : content // ignore: cast_nullable_to_non_nullable
              as String,
      meta: freezed == meta
          ? _value._meta
          : meta // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$JarvisStoredMessageImpl implements _JarvisStoredMessage {
  const _$JarvisStoredMessageImpl(
      {required this.role,
      this.content = "",
      final Map<String, dynamic>? meta,
      @JsonKey(name: "created_at") this.createdAt})
      : _meta = meta;

  factory _$JarvisStoredMessageImpl.fromJson(Map<String, dynamic> json) =>
      _$$JarvisStoredMessageImplFromJson(json);

  @override
  final String role;
  @override
  @JsonKey()
  final String content;
  final Map<String, dynamic>? _meta;
  @override
  Map<String, dynamic>? get meta {
    final value = _meta;
    if (value == null) return null;
    if (_meta is EqualUnmodifiableMapView) return _meta;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  @JsonKey(name: "created_at")
  final String? createdAt;

  @override
  String toString() {
    return 'JarvisStoredMessage(role: $role, content: $content, meta: $meta, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisStoredMessageImpl &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.content, content) || other.content == content) &&
            const DeepCollectionEquality().equals(other._meta, _meta) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, role, content,
      const DeepCollectionEquality().hash(_meta), createdAt);

  /// Create a copy of JarvisStoredMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisStoredMessageImplCopyWith<_$JarvisStoredMessageImpl> get copyWith =>
      __$$JarvisStoredMessageImplCopyWithImpl<_$JarvisStoredMessageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$JarvisStoredMessageImplToJson(
      this,
    );
  }
}

abstract class _JarvisStoredMessage implements JarvisStoredMessage {
  const factory _JarvisStoredMessage(
          {required final String role,
          final String content,
          final Map<String, dynamic>? meta,
          @JsonKey(name: "created_at") final String? createdAt}) =
      _$JarvisStoredMessageImpl;

  factory _JarvisStoredMessage.fromJson(Map<String, dynamic> json) =
      _$JarvisStoredMessageImpl.fromJson;

  @override
  String get role;
  @override
  String get content;
  @override
  Map<String, dynamic>? get meta;
  @override
  @JsonKey(name: "created_at")
  String? get createdAt;

  /// Create a copy of JarvisStoredMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisStoredMessageImplCopyWith<_$JarvisStoredMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

JarvisConversationDetail _$JarvisConversationDetailFromJson(
    Map<String, dynamic> json) {
  return _JarvisConversationDetail.fromJson(json);
}

/// @nodoc
mixin _$JarvisConversationDetail {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  List<JarvisStoredMessage> get messages => throw _privateConstructorUsedError;

  /// Serializes this JarvisConversationDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of JarvisConversationDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $JarvisConversationDetailCopyWith<JarvisConversationDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisConversationDetailCopyWith<$Res> {
  factory $JarvisConversationDetailCopyWith(JarvisConversationDetail value,
          $Res Function(JarvisConversationDetail) then) =
      _$JarvisConversationDetailCopyWithImpl<$Res, JarvisConversationDetail>;
  @useResult
  $Res call({String id, String title, List<JarvisStoredMessage> messages});
}

/// @nodoc
class _$JarvisConversationDetailCopyWithImpl<$Res,
        $Val extends JarvisConversationDetail>
    implements $JarvisConversationDetailCopyWith<$Res> {
  _$JarvisConversationDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisConversationDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? messages = null,
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
      messages: null == messages
          ? _value.messages
          : messages // ignore: cast_nullable_to_non_nullable
              as List<JarvisStoredMessage>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$JarvisConversationDetailImplCopyWith<$Res>
    implements $JarvisConversationDetailCopyWith<$Res> {
  factory _$$JarvisConversationDetailImplCopyWith(
          _$JarvisConversationDetailImpl value,
          $Res Function(_$JarvisConversationDetailImpl) then) =
      __$$JarvisConversationDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String title, List<JarvisStoredMessage> messages});
}

/// @nodoc
class __$$JarvisConversationDetailImplCopyWithImpl<$Res>
    extends _$JarvisConversationDetailCopyWithImpl<$Res,
        _$JarvisConversationDetailImpl>
    implements _$$JarvisConversationDetailImplCopyWith<$Res> {
  __$$JarvisConversationDetailImplCopyWithImpl(
      _$JarvisConversationDetailImpl _value,
      $Res Function(_$JarvisConversationDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisConversationDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? messages = null,
  }) {
    return _then(_$JarvisConversationDetailImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      messages: null == messages
          ? _value._messages
          : messages // ignore: cast_nullable_to_non_nullable
              as List<JarvisStoredMessage>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$JarvisConversationDetailImpl implements _JarvisConversationDetail {
  const _$JarvisConversationDetailImpl(
      {required this.id,
      this.title = "New chat",
      final List<JarvisStoredMessage> messages = const <JarvisStoredMessage>[]})
      : _messages = messages;

  factory _$JarvisConversationDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$JarvisConversationDetailImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final String title;
  final List<JarvisStoredMessage> _messages;
  @override
  @JsonKey()
  List<JarvisStoredMessage> get messages {
    if (_messages is EqualUnmodifiableListView) return _messages;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_messages);
  }

  @override
  String toString() {
    return 'JarvisConversationDetail(id: $id, title: $title, messages: $messages)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisConversationDetailImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality().equals(other._messages, _messages));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, title, const DeepCollectionEquality().hash(_messages));

  /// Create a copy of JarvisConversationDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisConversationDetailImplCopyWith<_$JarvisConversationDetailImpl>
      get copyWith => __$$JarvisConversationDetailImplCopyWithImpl<
          _$JarvisConversationDetailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$JarvisConversationDetailImplToJson(
      this,
    );
  }
}

abstract class _JarvisConversationDetail implements JarvisConversationDetail {
  const factory _JarvisConversationDetail(
          {required final String id,
          final String title,
          final List<JarvisStoredMessage> messages}) =
      _$JarvisConversationDetailImpl;

  factory _JarvisConversationDetail.fromJson(Map<String, dynamic> json) =
      _$JarvisConversationDetailImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  List<JarvisStoredMessage> get messages;

  /// Create a copy of JarvisConversationDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisConversationDetailImplCopyWith<_$JarvisConversationDetailImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$JarvisStreamEvent {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $JarvisStreamEventCopyWith<$Res> {
  factory $JarvisStreamEventCopyWith(
          JarvisStreamEvent value, $Res Function(JarvisStreamEvent) then) =
      _$JarvisStreamEventCopyWithImpl<$Res, JarvisStreamEvent>;
}

/// @nodoc
class _$JarvisStreamEventCopyWithImpl<$Res, $Val extends JarvisStreamEvent>
    implements $JarvisStreamEventCopyWith<$Res> {
  _$JarvisStreamEventCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$JarvisThinkingImplCopyWith<$Res> {
  factory _$$JarvisThinkingImplCopyWith(_$JarvisThinkingImpl value,
          $Res Function(_$JarvisThinkingImpl) then) =
      __$$JarvisThinkingImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$JarvisThinkingImplCopyWithImpl<$Res>
    extends _$JarvisStreamEventCopyWithImpl<$Res, _$JarvisThinkingImpl>
    implements _$$JarvisThinkingImplCopyWith<$Res> {
  __$$JarvisThinkingImplCopyWithImpl(
      _$JarvisThinkingImpl _value, $Res Function(_$JarvisThinkingImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$JarvisThinkingImpl implements JarvisThinking {
  const _$JarvisThinkingImpl();

  @override
  String toString() {
    return 'JarvisStreamEvent.thinking()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$JarvisThinkingImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) {
    return thinking();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) {
    return thinking?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) {
    if (thinking != null) {
      return thinking();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) {
    return thinking(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) {
    return thinking?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) {
    if (thinking != null) {
      return thinking(this);
    }
    return orElse();
  }
}

abstract class JarvisThinking implements JarvisStreamEvent {
  const factory JarvisThinking() = _$JarvisThinkingImpl;
}

/// @nodoc
abstract class _$$JarvisToolEventImplCopyWith<$Res> {
  factory _$$JarvisToolEventImplCopyWith(_$JarvisToolEventImpl value,
          $Res Function(_$JarvisToolEventImpl) then) =
      __$$JarvisToolEventImplCopyWithImpl<$Res>;
  @useResult
  $Res call({JarvisToolActivity tool});

  $JarvisToolActivityCopyWith<$Res> get tool;
}

/// @nodoc
class __$$JarvisToolEventImplCopyWithImpl<$Res>
    extends _$JarvisStreamEventCopyWithImpl<$Res, _$JarvisToolEventImpl>
    implements _$$JarvisToolEventImplCopyWith<$Res> {
  __$$JarvisToolEventImplCopyWithImpl(
      _$JarvisToolEventImpl _value, $Res Function(_$JarvisToolEventImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tool = null,
  }) {
    return _then(_$JarvisToolEventImpl(
      null == tool
          ? _value.tool
          : tool // ignore: cast_nullable_to_non_nullable
              as JarvisToolActivity,
    ));
  }

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $JarvisToolActivityCopyWith<$Res> get tool {
    return $JarvisToolActivityCopyWith<$Res>(_value.tool, (value) {
      return _then(_value.copyWith(tool: value));
    });
  }
}

/// @nodoc

class _$JarvisToolEventImpl implements JarvisToolEvent {
  const _$JarvisToolEventImpl(this.tool);

  @override
  final JarvisToolActivity tool;

  @override
  String toString() {
    return 'JarvisStreamEvent.tool(tool: $tool)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisToolEventImpl &&
            (identical(other.tool, tool) || other.tool == tool));
  }

  @override
  int get hashCode => Object.hash(runtimeType, tool);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisToolEventImplCopyWith<_$JarvisToolEventImpl> get copyWith =>
      __$$JarvisToolEventImplCopyWithImpl<_$JarvisToolEventImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) {
    return tool(this.tool);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) {
    return tool?.call(this.tool);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) {
    if (tool != null) {
      return tool(this.tool);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) {
    return tool(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) {
    return tool?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) {
    if (tool != null) {
      return tool(this);
    }
    return orElse();
  }
}

abstract class JarvisToolEvent implements JarvisStreamEvent {
  const factory JarvisToolEvent(final JarvisToolActivity tool) =
      _$JarvisToolEventImpl;

  JarvisToolActivity get tool;

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisToolEventImplCopyWith<_$JarvisToolEventImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$JarvisConfirmEventImplCopyWith<$Res> {
  factory _$$JarvisConfirmEventImplCopyWith(_$JarvisConfirmEventImpl value,
          $Res Function(_$JarvisConfirmEventImpl) then) =
      __$$JarvisConfirmEventImplCopyWithImpl<$Res>;
  @useResult
  $Res call({JarvisConfirm confirm});

  $JarvisConfirmCopyWith<$Res> get confirm;
}

/// @nodoc
class __$$JarvisConfirmEventImplCopyWithImpl<$Res>
    extends _$JarvisStreamEventCopyWithImpl<$Res, _$JarvisConfirmEventImpl>
    implements _$$JarvisConfirmEventImplCopyWith<$Res> {
  __$$JarvisConfirmEventImplCopyWithImpl(_$JarvisConfirmEventImpl _value,
      $Res Function(_$JarvisConfirmEventImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? confirm = null,
  }) {
    return _then(_$JarvisConfirmEventImpl(
      null == confirm
          ? _value.confirm
          : confirm // ignore: cast_nullable_to_non_nullable
              as JarvisConfirm,
    ));
  }

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $JarvisConfirmCopyWith<$Res> get confirm {
    return $JarvisConfirmCopyWith<$Res>(_value.confirm, (value) {
      return _then(_value.copyWith(confirm: value));
    });
  }
}

/// @nodoc

class _$JarvisConfirmEventImpl implements JarvisConfirmEvent {
  const _$JarvisConfirmEventImpl(this.confirm);

  @override
  final JarvisConfirm confirm;

  @override
  String toString() {
    return 'JarvisStreamEvent.confirm(confirm: $confirm)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisConfirmEventImpl &&
            (identical(other.confirm, confirm) || other.confirm == confirm));
  }

  @override
  int get hashCode => Object.hash(runtimeType, confirm);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisConfirmEventImplCopyWith<_$JarvisConfirmEventImpl> get copyWith =>
      __$$JarvisConfirmEventImplCopyWithImpl<_$JarvisConfirmEventImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) {
    return confirm(this.confirm);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) {
    return confirm?.call(this.confirm);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) {
    if (confirm != null) {
      return confirm(this.confirm);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) {
    return confirm(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) {
    return confirm?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) {
    if (confirm != null) {
      return confirm(this);
    }
    return orElse();
  }
}

abstract class JarvisConfirmEvent implements JarvisStreamEvent {
  const factory JarvisConfirmEvent(final JarvisConfirm confirm) =
      _$JarvisConfirmEventImpl;

  JarvisConfirm get confirm;

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisConfirmEventImplCopyWith<_$JarvisConfirmEventImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$JarvisMessageEventImplCopyWith<$Res> {
  factory _$$JarvisMessageEventImplCopyWith(_$JarvisMessageEventImpl value,
          $Res Function(_$JarvisMessageEventImpl) then) =
      __$$JarvisMessageEventImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String text});
}

/// @nodoc
class __$$JarvisMessageEventImplCopyWithImpl<$Res>
    extends _$JarvisStreamEventCopyWithImpl<$Res, _$JarvisMessageEventImpl>
    implements _$$JarvisMessageEventImplCopyWith<$Res> {
  __$$JarvisMessageEventImplCopyWithImpl(_$JarvisMessageEventImpl _value,
      $Res Function(_$JarvisMessageEventImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? text = null,
  }) {
    return _then(_$JarvisMessageEventImpl(
      null == text
          ? _value.text
          : text // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc

class _$JarvisMessageEventImpl implements JarvisMessageEvent {
  const _$JarvisMessageEventImpl(this.text);

  @override
  final String text;

  @override
  String toString() {
    return 'JarvisStreamEvent.message(text: $text)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisMessageEventImpl &&
            (identical(other.text, text) || other.text == text));
  }

  @override
  int get hashCode => Object.hash(runtimeType, text);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisMessageEventImplCopyWith<_$JarvisMessageEventImpl> get copyWith =>
      __$$JarvisMessageEventImplCopyWithImpl<_$JarvisMessageEventImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) {
    return message(text);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) {
    return message?.call(text);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) {
    if (message != null) {
      return message(text);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) {
    return message(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) {
    return message?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) {
    if (message != null) {
      return message(this);
    }
    return orElse();
  }
}

abstract class JarvisMessageEvent implements JarvisStreamEvent {
  const factory JarvisMessageEvent(final String text) =
      _$JarvisMessageEventImpl;

  String get text;

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisMessageEventImplCopyWith<_$JarvisMessageEventImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$JarvisErrorEventImplCopyWith<$Res> {
  factory _$$JarvisErrorEventImplCopyWith(_$JarvisErrorEventImpl value,
          $Res Function(_$JarvisErrorEventImpl) then) =
      __$$JarvisErrorEventImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String message});
}

/// @nodoc
class __$$JarvisErrorEventImplCopyWithImpl<$Res>
    extends _$JarvisStreamEventCopyWithImpl<$Res, _$JarvisErrorEventImpl>
    implements _$$JarvisErrorEventImplCopyWith<$Res> {
  __$$JarvisErrorEventImplCopyWithImpl(_$JarvisErrorEventImpl _value,
      $Res Function(_$JarvisErrorEventImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? message = null,
  }) {
    return _then(_$JarvisErrorEventImpl(
      null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc

class _$JarvisErrorEventImpl implements JarvisErrorEvent {
  const _$JarvisErrorEventImpl(this.message);

  @override
  final String message;

  @override
  String toString() {
    return 'JarvisStreamEvent.error(message: $message)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisErrorEventImpl &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisErrorEventImplCopyWith<_$JarvisErrorEventImpl> get copyWith =>
      __$$JarvisErrorEventImplCopyWithImpl<_$JarvisErrorEventImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) {
    return error(this.message);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) {
    return error?.call(this.message);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) {
    if (error != null) {
      return error(this.message);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) {
    return error(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) {
    return error?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) {
    if (error != null) {
      return error(this);
    }
    return orElse();
  }
}

abstract class JarvisErrorEvent implements JarvisStreamEvent {
  const factory JarvisErrorEvent(final String message) = _$JarvisErrorEventImpl;

  String get message;

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisErrorEventImplCopyWith<_$JarvisErrorEventImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$JarvisDoneEventImplCopyWith<$Res> {
  factory _$$JarvisDoneEventImplCopyWith(_$JarvisDoneEventImpl value,
          $Res Function(_$JarvisDoneEventImpl) then) =
      __$$JarvisDoneEventImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String? conversationId});
}

/// @nodoc
class __$$JarvisDoneEventImplCopyWithImpl<$Res>
    extends _$JarvisStreamEventCopyWithImpl<$Res, _$JarvisDoneEventImpl>
    implements _$$JarvisDoneEventImplCopyWith<$Res> {
  __$$JarvisDoneEventImplCopyWithImpl(
      _$JarvisDoneEventImpl _value, $Res Function(_$JarvisDoneEventImpl) _then)
      : super(_value, _then);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? conversationId = freezed,
  }) {
    return _then(_$JarvisDoneEventImpl(
      freezed == conversationId
          ? _value.conversationId
          : conversationId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$JarvisDoneEventImpl implements JarvisDoneEvent {
  const _$JarvisDoneEventImpl(this.conversationId);

  @override
  final String? conversationId;

  @override
  String toString() {
    return 'JarvisStreamEvent.done(conversationId: $conversationId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$JarvisDoneEventImpl &&
            (identical(other.conversationId, conversationId) ||
                other.conversationId == conversationId));
  }

  @override
  int get hashCode => Object.hash(runtimeType, conversationId);

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$JarvisDoneEventImplCopyWith<_$JarvisDoneEventImpl> get copyWith =>
      __$$JarvisDoneEventImplCopyWithImpl<_$JarvisDoneEventImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() thinking,
    required TResult Function(JarvisToolActivity tool) tool,
    required TResult Function(JarvisConfirm confirm) confirm,
    required TResult Function(String text) message,
    required TResult Function(String message) error,
    required TResult Function(String? conversationId) done,
  }) {
    return done(conversationId);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? thinking,
    TResult? Function(JarvisToolActivity tool)? tool,
    TResult? Function(JarvisConfirm confirm)? confirm,
    TResult? Function(String text)? message,
    TResult? Function(String message)? error,
    TResult? Function(String? conversationId)? done,
  }) {
    return done?.call(conversationId);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? thinking,
    TResult Function(JarvisToolActivity tool)? tool,
    TResult Function(JarvisConfirm confirm)? confirm,
    TResult Function(String text)? message,
    TResult Function(String message)? error,
    TResult Function(String? conversationId)? done,
    required TResult orElse(),
  }) {
    if (done != null) {
      return done(conversationId);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(JarvisThinking value) thinking,
    required TResult Function(JarvisToolEvent value) tool,
    required TResult Function(JarvisConfirmEvent value) confirm,
    required TResult Function(JarvisMessageEvent value) message,
    required TResult Function(JarvisErrorEvent value) error,
    required TResult Function(JarvisDoneEvent value) done,
  }) {
    return done(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(JarvisThinking value)? thinking,
    TResult? Function(JarvisToolEvent value)? tool,
    TResult? Function(JarvisConfirmEvent value)? confirm,
    TResult? Function(JarvisMessageEvent value)? message,
    TResult? Function(JarvisErrorEvent value)? error,
    TResult? Function(JarvisDoneEvent value)? done,
  }) {
    return done?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(JarvisThinking value)? thinking,
    TResult Function(JarvisToolEvent value)? tool,
    TResult Function(JarvisConfirmEvent value)? confirm,
    TResult Function(JarvisMessageEvent value)? message,
    TResult Function(JarvisErrorEvent value)? error,
    TResult Function(JarvisDoneEvent value)? done,
    required TResult orElse(),
  }) {
    if (done != null) {
      return done(this);
    }
    return orElse();
  }
}

abstract class JarvisDoneEvent implements JarvisStreamEvent {
  const factory JarvisDoneEvent(final String? conversationId) =
      _$JarvisDoneEventImpl;

  String? get conversationId;

  /// Create a copy of JarvisStreamEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$JarvisDoneEventImplCopyWith<_$JarvisDoneEventImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
