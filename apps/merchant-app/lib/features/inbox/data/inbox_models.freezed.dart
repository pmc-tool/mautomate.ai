// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'inbox_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

InboxContact _$InboxContactFromJson(Map<String, dynamic> json) {
  return _InboxContact.fromJson(json);
}

/// @nodoc
mixin _$InboxContact {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: "display_name")
  String? get displayName => throw _privateConstructorUsedError;
  @JsonKey(name: "avatar_url")
  String? get avatarUrl => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  @JsonKey(name: "customer_id")
  String? get customerId => throw _privateConstructorUsedError;

  /// Serializes this InboxContact to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InboxContact
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InboxContactCopyWith<InboxContact> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InboxContactCopyWith<$Res> {
  factory $InboxContactCopyWith(
          InboxContact value, $Res Function(InboxContact) then) =
      _$InboxContactCopyWithImpl<$Res, InboxContact>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_name") String? displayName,
      @JsonKey(name: "avatar_url") String? avatarUrl,
      String? phone,
      String? email,
      @JsonKey(name: "customer_id") String? customerId});
}

/// @nodoc
class _$InboxContactCopyWithImpl<$Res, $Val extends InboxContact>
    implements $InboxContactCopyWith<$Res> {
  _$InboxContactCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InboxContact
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayName = freezed,
    Object? avatarUrl = freezed,
    Object? phone = freezed,
    Object? email = freezed,
    Object? customerId = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      displayName: freezed == displayName
          ? _value.displayName
          : displayName // ignore: cast_nullable_to_non_nullable
              as String?,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      customerId: freezed == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$InboxContactImplCopyWith<$Res>
    implements $InboxContactCopyWith<$Res> {
  factory _$$InboxContactImplCopyWith(
          _$InboxContactImpl value, $Res Function(_$InboxContactImpl) then) =
      __$$InboxContactImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: "display_name") String? displayName,
      @JsonKey(name: "avatar_url") String? avatarUrl,
      String? phone,
      String? email,
      @JsonKey(name: "customer_id") String? customerId});
}

/// @nodoc
class __$$InboxContactImplCopyWithImpl<$Res>
    extends _$InboxContactCopyWithImpl<$Res, _$InboxContactImpl>
    implements _$$InboxContactImplCopyWith<$Res> {
  __$$InboxContactImplCopyWithImpl(
      _$InboxContactImpl _value, $Res Function(_$InboxContactImpl) _then)
      : super(_value, _then);

  /// Create a copy of InboxContact
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? displayName = freezed,
    Object? avatarUrl = freezed,
    Object? phone = freezed,
    Object? email = freezed,
    Object? customerId = freezed,
  }) {
    return _then(_$InboxContactImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      displayName: freezed == displayName
          ? _value.displayName
          : displayName // ignore: cast_nullable_to_non_nullable
              as String?,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      customerId: freezed == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxContactImpl implements _InboxContact {
  const _$InboxContactImpl(
      {this.id = "",
      @JsonKey(name: "display_name") this.displayName,
      @JsonKey(name: "avatar_url") this.avatarUrl,
      this.phone,
      this.email,
      @JsonKey(name: "customer_id") this.customerId});

  factory _$InboxContactImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxContactImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey(name: "display_name")
  final String? displayName;
  @override
  @JsonKey(name: "avatar_url")
  final String? avatarUrl;
  @override
  final String? phone;
  @override
  final String? email;
  @override
  @JsonKey(name: "customer_id")
  final String? customerId;

  @override
  String toString() {
    return 'InboxContact(id: $id, displayName: $displayName, avatarUrl: $avatarUrl, phone: $phone, email: $email, customerId: $customerId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxContactImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.displayName, displayName) ||
                other.displayName == displayName) &&
            (identical(other.avatarUrl, avatarUrl) ||
                other.avatarUrl == avatarUrl) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.customerId, customerId) ||
                other.customerId == customerId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, displayName, avatarUrl, phone, email, customerId);

  /// Create a copy of InboxContact
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InboxContactImplCopyWith<_$InboxContactImpl> get copyWith =>
      __$$InboxContactImplCopyWithImpl<_$InboxContactImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InboxContactImplToJson(
      this,
    );
  }
}

abstract class _InboxContact implements InboxContact {
  const factory _InboxContact(
          {final String id,
          @JsonKey(name: "display_name") final String? displayName,
          @JsonKey(name: "avatar_url") final String? avatarUrl,
          final String? phone,
          final String? email,
          @JsonKey(name: "customer_id") final String? customerId}) =
      _$InboxContactImpl;

  factory _InboxContact.fromJson(Map<String, dynamic> json) =
      _$InboxContactImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: "display_name")
  String? get displayName;
  @override
  @JsonKey(name: "avatar_url")
  String? get avatarUrl;
  @override
  String? get phone;
  @override
  String? get email;
  @override
  @JsonKey(name: "customer_id")
  String? get customerId;

  /// Create a copy of InboxContact
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxContactImplCopyWith<_$InboxContactImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InboxConversation _$InboxConversationFromJson(Map<String, dynamic> json) {
  return _InboxConversation.fromJson(json);
}

/// @nodoc
mixin _$InboxConversation {
  String get id => throw _privateConstructorUsedError;
  String get channel => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  @JsonKey(name: "handler_mode")
  String get handlerMode => throw _privateConstructorUsedError;
  @JsonKey(name: "handoff_reason")
  String? get handoffReason => throw _privateConstructorUsedError;
  @JsonKey(name: "chatbot_id")
  String? get chatbotId => throw _privateConstructorUsedError;
  bool get starred => throw _privateConstructorUsedError;
  @JsonKey(name: "unread_count", fromJson: _toInt)
  int get unreadCount => throw _privateConstructorUsedError;
  @JsonKey(name: "last_message_at")
  String? get lastMessageAt => throw _privateConstructorUsedError;
  @JsonKey(name: "assigned_user_id")
  String? get assignedUserId => throw _privateConstructorUsedError;
  InboxContact? get contact => throw _privateConstructorUsedError;
  String? get preview => throw _privateConstructorUsedError;

  /// Serializes this InboxConversation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InboxConversation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InboxConversationCopyWith<InboxConversation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InboxConversationCopyWith<$Res> {
  factory $InboxConversationCopyWith(
          InboxConversation value, $Res Function(InboxConversation) then) =
      _$InboxConversationCopyWithImpl<$Res, InboxConversation>;
  @useResult
  $Res call(
      {String id,
      String channel,
      String status,
      @JsonKey(name: "handler_mode") String handlerMode,
      @JsonKey(name: "handoff_reason") String? handoffReason,
      @JsonKey(name: "chatbot_id") String? chatbotId,
      bool starred,
      @JsonKey(name: "unread_count", fromJson: _toInt) int unreadCount,
      @JsonKey(name: "last_message_at") String? lastMessageAt,
      @JsonKey(name: "assigned_user_id") String? assignedUserId,
      InboxContact? contact,
      String? preview});

  $InboxContactCopyWith<$Res>? get contact;
}

/// @nodoc
class _$InboxConversationCopyWithImpl<$Res, $Val extends InboxConversation>
    implements $InboxConversationCopyWith<$Res> {
  _$InboxConversationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InboxConversation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? channel = null,
    Object? status = null,
    Object? handlerMode = null,
    Object? handoffReason = freezed,
    Object? chatbotId = freezed,
    Object? starred = null,
    Object? unreadCount = null,
    Object? lastMessageAt = freezed,
    Object? assignedUserId = freezed,
    Object? contact = freezed,
    Object? preview = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      handlerMode: null == handlerMode
          ? _value.handlerMode
          : handlerMode // ignore: cast_nullable_to_non_nullable
              as String,
      handoffReason: freezed == handoffReason
          ? _value.handoffReason
          : handoffReason // ignore: cast_nullable_to_non_nullable
              as String?,
      chatbotId: freezed == chatbotId
          ? _value.chatbotId
          : chatbotId // ignore: cast_nullable_to_non_nullable
              as String?,
      starred: null == starred
          ? _value.starred
          : starred // ignore: cast_nullable_to_non_nullable
              as bool,
      unreadCount: null == unreadCount
          ? _value.unreadCount
          : unreadCount // ignore: cast_nullable_to_non_nullable
              as int,
      lastMessageAt: freezed == lastMessageAt
          ? _value.lastMessageAt
          : lastMessageAt // ignore: cast_nullable_to_non_nullable
              as String?,
      assignedUserId: freezed == assignedUserId
          ? _value.assignedUserId
          : assignedUserId // ignore: cast_nullable_to_non_nullable
              as String?,
      contact: freezed == contact
          ? _value.contact
          : contact // ignore: cast_nullable_to_non_nullable
              as InboxContact?,
      preview: freezed == preview
          ? _value.preview
          : preview // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }

  /// Create a copy of InboxConversation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $InboxContactCopyWith<$Res>? get contact {
    if (_value.contact == null) {
      return null;
    }

    return $InboxContactCopyWith<$Res>(_value.contact!, (value) {
      return _then(_value.copyWith(contact: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$InboxConversationImplCopyWith<$Res>
    implements $InboxConversationCopyWith<$Res> {
  factory _$$InboxConversationImplCopyWith(_$InboxConversationImpl value,
          $Res Function(_$InboxConversationImpl) then) =
      __$$InboxConversationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String channel,
      String status,
      @JsonKey(name: "handler_mode") String handlerMode,
      @JsonKey(name: "handoff_reason") String? handoffReason,
      @JsonKey(name: "chatbot_id") String? chatbotId,
      bool starred,
      @JsonKey(name: "unread_count", fromJson: _toInt) int unreadCount,
      @JsonKey(name: "last_message_at") String? lastMessageAt,
      @JsonKey(name: "assigned_user_id") String? assignedUserId,
      InboxContact? contact,
      String? preview});

  @override
  $InboxContactCopyWith<$Res>? get contact;
}

/// @nodoc
class __$$InboxConversationImplCopyWithImpl<$Res>
    extends _$InboxConversationCopyWithImpl<$Res, _$InboxConversationImpl>
    implements _$$InboxConversationImplCopyWith<$Res> {
  __$$InboxConversationImplCopyWithImpl(_$InboxConversationImpl _value,
      $Res Function(_$InboxConversationImpl) _then)
      : super(_value, _then);

  /// Create a copy of InboxConversation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? channel = null,
    Object? status = null,
    Object? handlerMode = null,
    Object? handoffReason = freezed,
    Object? chatbotId = freezed,
    Object? starred = null,
    Object? unreadCount = null,
    Object? lastMessageAt = freezed,
    Object? assignedUserId = freezed,
    Object? contact = freezed,
    Object? preview = freezed,
  }) {
    return _then(_$InboxConversationImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      handlerMode: null == handlerMode
          ? _value.handlerMode
          : handlerMode // ignore: cast_nullable_to_non_nullable
              as String,
      handoffReason: freezed == handoffReason
          ? _value.handoffReason
          : handoffReason // ignore: cast_nullable_to_non_nullable
              as String?,
      chatbotId: freezed == chatbotId
          ? _value.chatbotId
          : chatbotId // ignore: cast_nullable_to_non_nullable
              as String?,
      starred: null == starred
          ? _value.starred
          : starred // ignore: cast_nullable_to_non_nullable
              as bool,
      unreadCount: null == unreadCount
          ? _value.unreadCount
          : unreadCount // ignore: cast_nullable_to_non_nullable
              as int,
      lastMessageAt: freezed == lastMessageAt
          ? _value.lastMessageAt
          : lastMessageAt // ignore: cast_nullable_to_non_nullable
              as String?,
      assignedUserId: freezed == assignedUserId
          ? _value.assignedUserId
          : assignedUserId // ignore: cast_nullable_to_non_nullable
              as String?,
      contact: freezed == contact
          ? _value.contact
          : contact // ignore: cast_nullable_to_non_nullable
              as InboxContact?,
      preview: freezed == preview
          ? _value.preview
          : preview // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxConversationImpl implements _InboxConversation {
  const _$InboxConversationImpl(
      {this.id = "",
      this.channel = "",
      this.status = "open",
      @JsonKey(name: "handler_mode") this.handlerMode = "ai",
      @JsonKey(name: "handoff_reason") this.handoffReason,
      @JsonKey(name: "chatbot_id") this.chatbotId,
      this.starred = false,
      @JsonKey(name: "unread_count", fromJson: _toInt) this.unreadCount = 0,
      @JsonKey(name: "last_message_at") this.lastMessageAt,
      @JsonKey(name: "assigned_user_id") this.assignedUserId,
      this.contact,
      this.preview});

  factory _$InboxConversationImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxConversationImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String channel;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey(name: "handler_mode")
  final String handlerMode;
  @override
  @JsonKey(name: "handoff_reason")
  final String? handoffReason;
  @override
  @JsonKey(name: "chatbot_id")
  final String? chatbotId;
  @override
  @JsonKey()
  final bool starred;
  @override
  @JsonKey(name: "unread_count", fromJson: _toInt)
  final int unreadCount;
  @override
  @JsonKey(name: "last_message_at")
  final String? lastMessageAt;
  @override
  @JsonKey(name: "assigned_user_id")
  final String? assignedUserId;
  @override
  final InboxContact? contact;
  @override
  final String? preview;

  @override
  String toString() {
    return 'InboxConversation(id: $id, channel: $channel, status: $status, handlerMode: $handlerMode, handoffReason: $handoffReason, chatbotId: $chatbotId, starred: $starred, unreadCount: $unreadCount, lastMessageAt: $lastMessageAt, assignedUserId: $assignedUserId, contact: $contact, preview: $preview)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxConversationImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.handlerMode, handlerMode) ||
                other.handlerMode == handlerMode) &&
            (identical(other.handoffReason, handoffReason) ||
                other.handoffReason == handoffReason) &&
            (identical(other.chatbotId, chatbotId) ||
                other.chatbotId == chatbotId) &&
            (identical(other.starred, starred) || other.starred == starred) &&
            (identical(other.unreadCount, unreadCount) ||
                other.unreadCount == unreadCount) &&
            (identical(other.lastMessageAt, lastMessageAt) ||
                other.lastMessageAt == lastMessageAt) &&
            (identical(other.assignedUserId, assignedUserId) ||
                other.assignedUserId == assignedUserId) &&
            (identical(other.contact, contact) || other.contact == contact) &&
            (identical(other.preview, preview) || other.preview == preview));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      channel,
      status,
      handlerMode,
      handoffReason,
      chatbotId,
      starred,
      unreadCount,
      lastMessageAt,
      assignedUserId,
      contact,
      preview);

  /// Create a copy of InboxConversation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InboxConversationImplCopyWith<_$InboxConversationImpl> get copyWith =>
      __$$InboxConversationImplCopyWithImpl<_$InboxConversationImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InboxConversationImplToJson(
      this,
    );
  }
}

abstract class _InboxConversation implements InboxConversation {
  const factory _InboxConversation(
      {final String id,
      final String channel,
      final String status,
      @JsonKey(name: "handler_mode") final String handlerMode,
      @JsonKey(name: "handoff_reason") final String? handoffReason,
      @JsonKey(name: "chatbot_id") final String? chatbotId,
      final bool starred,
      @JsonKey(name: "unread_count", fromJson: _toInt) final int unreadCount,
      @JsonKey(name: "last_message_at") final String? lastMessageAt,
      @JsonKey(name: "assigned_user_id") final String? assignedUserId,
      final InboxContact? contact,
      final String? preview}) = _$InboxConversationImpl;

  factory _InboxConversation.fromJson(Map<String, dynamic> json) =
      _$InboxConversationImpl.fromJson;

  @override
  String get id;
  @override
  String get channel;
  @override
  String get status;
  @override
  @JsonKey(name: "handler_mode")
  String get handlerMode;
  @override
  @JsonKey(name: "handoff_reason")
  String? get handoffReason;
  @override
  @JsonKey(name: "chatbot_id")
  String? get chatbotId;
  @override
  bool get starred;
  @override
  @JsonKey(name: "unread_count", fromJson: _toInt)
  int get unreadCount;
  @override
  @JsonKey(name: "last_message_at")
  String? get lastMessageAt;
  @override
  @JsonKey(name: "assigned_user_id")
  String? get assignedUserId;
  @override
  InboxContact? get contact;
  @override
  String? get preview;

  /// Create a copy of InboxConversation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxConversationImplCopyWith<_$InboxConversationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InboxMessage _$InboxMessageFromJson(Map<String, dynamic> json) {
  return _InboxMessage.fromJson(json);
}

/// @nodoc
mixin _$InboxMessage {
  String get id => throw _privateConstructorUsedError;
  String get direction => throw _privateConstructorUsedError;
  String get author => throw _privateConstructorUsedError;
  String? get body => throw _privateConstructorUsedError;
  @JsonKey(name: "sent_at")
  String? get sentAt => throw _privateConstructorUsedError;
  @JsonKey(name: "delivery_status")
  String? get deliveryStatus => throw _privateConstructorUsedError;

  /// Serializes this InboxMessage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InboxMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InboxMessageCopyWith<InboxMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InboxMessageCopyWith<$Res> {
  factory $InboxMessageCopyWith(
          InboxMessage value, $Res Function(InboxMessage) then) =
      _$InboxMessageCopyWithImpl<$Res, InboxMessage>;
  @useResult
  $Res call(
      {String id,
      String direction,
      String author,
      String? body,
      @JsonKey(name: "sent_at") String? sentAt,
      @JsonKey(name: "delivery_status") String? deliveryStatus});
}

/// @nodoc
class _$InboxMessageCopyWithImpl<$Res, $Val extends InboxMessage>
    implements $InboxMessageCopyWith<$Res> {
  _$InboxMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InboxMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? direction = null,
    Object? author = null,
    Object? body = freezed,
    Object? sentAt = freezed,
    Object? deliveryStatus = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      direction: null == direction
          ? _value.direction
          : direction // ignore: cast_nullable_to_non_nullable
              as String,
      author: null == author
          ? _value.author
          : author // ignore: cast_nullable_to_non_nullable
              as String,
      body: freezed == body
          ? _value.body
          : body // ignore: cast_nullable_to_non_nullable
              as String?,
      sentAt: freezed == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as String?,
      deliveryStatus: freezed == deliveryStatus
          ? _value.deliveryStatus
          : deliveryStatus // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$InboxMessageImplCopyWith<$Res>
    implements $InboxMessageCopyWith<$Res> {
  factory _$$InboxMessageImplCopyWith(
          _$InboxMessageImpl value, $Res Function(_$InboxMessageImpl) then) =
      __$$InboxMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String direction,
      String author,
      String? body,
      @JsonKey(name: "sent_at") String? sentAt,
      @JsonKey(name: "delivery_status") String? deliveryStatus});
}

/// @nodoc
class __$$InboxMessageImplCopyWithImpl<$Res>
    extends _$InboxMessageCopyWithImpl<$Res, _$InboxMessageImpl>
    implements _$$InboxMessageImplCopyWith<$Res> {
  __$$InboxMessageImplCopyWithImpl(
      _$InboxMessageImpl _value, $Res Function(_$InboxMessageImpl) _then)
      : super(_value, _then);

  /// Create a copy of InboxMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? direction = null,
    Object? author = null,
    Object? body = freezed,
    Object? sentAt = freezed,
    Object? deliveryStatus = freezed,
  }) {
    return _then(_$InboxMessageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      direction: null == direction
          ? _value.direction
          : direction // ignore: cast_nullable_to_non_nullable
              as String,
      author: null == author
          ? _value.author
          : author // ignore: cast_nullable_to_non_nullable
              as String,
      body: freezed == body
          ? _value.body
          : body // ignore: cast_nullable_to_non_nullable
              as String?,
      sentAt: freezed == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as String?,
      deliveryStatus: freezed == deliveryStatus
          ? _value.deliveryStatus
          : deliveryStatus // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxMessageImpl implements _InboxMessage {
  const _$InboxMessageImpl(
      {this.id = "",
      this.direction = "",
      this.author = "",
      this.body,
      @JsonKey(name: "sent_at") this.sentAt,
      @JsonKey(name: "delivery_status") this.deliveryStatus});

  factory _$InboxMessageImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxMessageImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String direction;
  @override
  @JsonKey()
  final String author;
  @override
  final String? body;
  @override
  @JsonKey(name: "sent_at")
  final String? sentAt;
  @override
  @JsonKey(name: "delivery_status")
  final String? deliveryStatus;

  @override
  String toString() {
    return 'InboxMessage(id: $id, direction: $direction, author: $author, body: $body, sentAt: $sentAt, deliveryStatus: $deliveryStatus)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxMessageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.direction, direction) ||
                other.direction == direction) &&
            (identical(other.author, author) || other.author == author) &&
            (identical(other.body, body) || other.body == body) &&
            (identical(other.sentAt, sentAt) || other.sentAt == sentAt) &&
            (identical(other.deliveryStatus, deliveryStatus) ||
                other.deliveryStatus == deliveryStatus));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, direction, author, body, sentAt, deliveryStatus);

  /// Create a copy of InboxMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InboxMessageImplCopyWith<_$InboxMessageImpl> get copyWith =>
      __$$InboxMessageImplCopyWithImpl<_$InboxMessageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InboxMessageImplToJson(
      this,
    );
  }
}

abstract class _InboxMessage implements InboxMessage {
  const factory _InboxMessage(
          {final String id,
          final String direction,
          final String author,
          final String? body,
          @JsonKey(name: "sent_at") final String? sentAt,
          @JsonKey(name: "delivery_status") final String? deliveryStatus}) =
      _$InboxMessageImpl;

  factory _InboxMessage.fromJson(Map<String, dynamic> json) =
      _$InboxMessageImpl.fromJson;

  @override
  String get id;
  @override
  String get direction;
  @override
  String get author;
  @override
  String? get body;
  @override
  @JsonKey(name: "sent_at")
  String? get sentAt;
  @override
  @JsonKey(name: "delivery_status")
  String? get deliveryStatus;

  /// Create a copy of InboxMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxMessageImplCopyWith<_$InboxMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InboxViewCounts _$InboxViewCountsFromJson(Map<String, dynamic> json) {
  return _InboxViewCounts.fromJson(json);
}

/// @nodoc
mixin _$InboxViewCounts {
  @JsonKey(name: "needs_you", fromJson: _toInt)
  int get needsYou => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get unassigned => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get mine => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get starred => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get open => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get closed => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get all => throw _privateConstructorUsedError;
  @JsonKey(fromJson: _toInt)
  int get unread => throw _privateConstructorUsedError;

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
  $Res call(
      {@JsonKey(name: "needs_you", fromJson: _toInt) int needsYou,
      @JsonKey(fromJson: _toInt) int unassigned,
      @JsonKey(fromJson: _toInt) int mine,
      @JsonKey(fromJson: _toInt) int starred,
      @JsonKey(fromJson: _toInt) int open,
      @JsonKey(fromJson: _toInt) int closed,
      @JsonKey(fromJson: _toInt) int all,
      @JsonKey(fromJson: _toInt) int unread});
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
    Object? unassigned = null,
    Object? mine = null,
    Object? starred = null,
    Object? open = null,
    Object? closed = null,
    Object? all = null,
    Object? unread = null,
  }) {
    return _then(_value.copyWith(
      needsYou: null == needsYou
          ? _value.needsYou
          : needsYou // ignore: cast_nullable_to_non_nullable
              as int,
      unassigned: null == unassigned
          ? _value.unassigned
          : unassigned // ignore: cast_nullable_to_non_nullable
              as int,
      mine: null == mine
          ? _value.mine
          : mine // ignore: cast_nullable_to_non_nullable
              as int,
      starred: null == starred
          ? _value.starred
          : starred // ignore: cast_nullable_to_non_nullable
              as int,
      open: null == open
          ? _value.open
          : open // ignore: cast_nullable_to_non_nullable
              as int,
      closed: null == closed
          ? _value.closed
          : closed // ignore: cast_nullable_to_non_nullable
              as int,
      all: null == all
          ? _value.all
          : all // ignore: cast_nullable_to_non_nullable
              as int,
      unread: null == unread
          ? _value.unread
          : unread // ignore: cast_nullable_to_non_nullable
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
  $Res call(
      {@JsonKey(name: "needs_you", fromJson: _toInt) int needsYou,
      @JsonKey(fromJson: _toInt) int unassigned,
      @JsonKey(fromJson: _toInt) int mine,
      @JsonKey(fromJson: _toInt) int starred,
      @JsonKey(fromJson: _toInt) int open,
      @JsonKey(fromJson: _toInt) int closed,
      @JsonKey(fromJson: _toInt) int all,
      @JsonKey(fromJson: _toInt) int unread});
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
    Object? unassigned = null,
    Object? mine = null,
    Object? starred = null,
    Object? open = null,
    Object? closed = null,
    Object? all = null,
    Object? unread = null,
  }) {
    return _then(_$InboxViewCountsImpl(
      needsYou: null == needsYou
          ? _value.needsYou
          : needsYou // ignore: cast_nullable_to_non_nullable
              as int,
      unassigned: null == unassigned
          ? _value.unassigned
          : unassigned // ignore: cast_nullable_to_non_nullable
              as int,
      mine: null == mine
          ? _value.mine
          : mine // ignore: cast_nullable_to_non_nullable
              as int,
      starred: null == starred
          ? _value.starred
          : starred // ignore: cast_nullable_to_non_nullable
              as int,
      open: null == open
          ? _value.open
          : open // ignore: cast_nullable_to_non_nullable
              as int,
      closed: null == closed
          ? _value.closed
          : closed // ignore: cast_nullable_to_non_nullable
              as int,
      all: null == all
          ? _value.all
          : all // ignore: cast_nullable_to_non_nullable
              as int,
      unread: null == unread
          ? _value.unread
          : unread // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxViewCountsImpl implements _InboxViewCounts {
  const _$InboxViewCountsImpl(
      {@JsonKey(name: "needs_you", fromJson: _toInt) this.needsYou = 0,
      @JsonKey(fromJson: _toInt) this.unassigned = 0,
      @JsonKey(fromJson: _toInt) this.mine = 0,
      @JsonKey(fromJson: _toInt) this.starred = 0,
      @JsonKey(fromJson: _toInt) this.open = 0,
      @JsonKey(fromJson: _toInt) this.closed = 0,
      @JsonKey(fromJson: _toInt) this.all = 0,
      @JsonKey(fromJson: _toInt) this.unread = 0});

  factory _$InboxViewCountsImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxViewCountsImplFromJson(json);

  @override
  @JsonKey(name: "needs_you", fromJson: _toInt)
  final int needsYou;
  @override
  @JsonKey(fromJson: _toInt)
  final int unassigned;
  @override
  @JsonKey(fromJson: _toInt)
  final int mine;
  @override
  @JsonKey(fromJson: _toInt)
  final int starred;
  @override
  @JsonKey(fromJson: _toInt)
  final int open;
  @override
  @JsonKey(fromJson: _toInt)
  final int closed;
  @override
  @JsonKey(fromJson: _toInt)
  final int all;
  @override
  @JsonKey(fromJson: _toInt)
  final int unread;

  @override
  String toString() {
    return 'InboxViewCounts(needsYou: $needsYou, unassigned: $unassigned, mine: $mine, starred: $starred, open: $open, closed: $closed, all: $all, unread: $unread)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxViewCountsImpl &&
            (identical(other.needsYou, needsYou) ||
                other.needsYou == needsYou) &&
            (identical(other.unassigned, unassigned) ||
                other.unassigned == unassigned) &&
            (identical(other.mine, mine) || other.mine == mine) &&
            (identical(other.starred, starred) || other.starred == starred) &&
            (identical(other.open, open) || other.open == open) &&
            (identical(other.closed, closed) || other.closed == closed) &&
            (identical(other.all, all) || other.all == all) &&
            (identical(other.unread, unread) || other.unread == unread));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, needsYou, unassigned, mine,
      starred, open, closed, all, unread);

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
      {@JsonKey(name: "needs_you", fromJson: _toInt) final int needsYou,
      @JsonKey(fromJson: _toInt) final int unassigned,
      @JsonKey(fromJson: _toInt) final int mine,
      @JsonKey(fromJson: _toInt) final int starred,
      @JsonKey(fromJson: _toInt) final int open,
      @JsonKey(fromJson: _toInt) final int closed,
      @JsonKey(fromJson: _toInt) final int all,
      @JsonKey(fromJson: _toInt) final int unread}) = _$InboxViewCountsImpl;

  factory _InboxViewCounts.fromJson(Map<String, dynamic> json) =
      _$InboxViewCountsImpl.fromJson;

  @override
  @JsonKey(name: "needs_you", fromJson: _toInt)
  int get needsYou;
  @override
  @JsonKey(fromJson: _toInt)
  int get unassigned;
  @override
  @JsonKey(fromJson: _toInt)
  int get mine;
  @override
  @JsonKey(fromJson: _toInt)
  int get starred;
  @override
  @JsonKey(fromJson: _toInt)
  int get open;
  @override
  @JsonKey(fromJson: _toInt)
  int get closed;
  @override
  @JsonKey(fromJson: _toInt)
  int get all;
  @override
  @JsonKey(fromJson: _toInt)
  int get unread;

  /// Create a copy of InboxViewCounts
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxViewCountsImplCopyWith<_$InboxViewCountsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InboxCounts _$InboxCountsFromJson(Map<String, dynamic> json) {
  return _InboxCounts.fromJson(json);
}

/// @nodoc
mixin _$InboxCounts {
  InboxViewCounts get views => throw _privateConstructorUsedError;
  Map<String, int> get channels => throw _privateConstructorUsedError;

  /// Serializes this InboxCounts to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InboxCounts
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InboxCountsCopyWith<InboxCounts> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InboxCountsCopyWith<$Res> {
  factory $InboxCountsCopyWith(
          InboxCounts value, $Res Function(InboxCounts) then) =
      _$InboxCountsCopyWithImpl<$Res, InboxCounts>;
  @useResult
  $Res call({InboxViewCounts views, Map<String, int> channels});

  $InboxViewCountsCopyWith<$Res> get views;
}

/// @nodoc
class _$InboxCountsCopyWithImpl<$Res, $Val extends InboxCounts>
    implements $InboxCountsCopyWith<$Res> {
  _$InboxCountsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InboxCounts
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? views = null,
    Object? channels = null,
  }) {
    return _then(_value.copyWith(
      views: null == views
          ? _value.views
          : views // ignore: cast_nullable_to_non_nullable
              as InboxViewCounts,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as Map<String, int>,
    ) as $Val);
  }

  /// Create a copy of InboxCounts
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
abstract class _$$InboxCountsImplCopyWith<$Res>
    implements $InboxCountsCopyWith<$Res> {
  factory _$$InboxCountsImplCopyWith(
          _$InboxCountsImpl value, $Res Function(_$InboxCountsImpl) then) =
      __$$InboxCountsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({InboxViewCounts views, Map<String, int> channels});

  @override
  $InboxViewCountsCopyWith<$Res> get views;
}

/// @nodoc
class __$$InboxCountsImplCopyWithImpl<$Res>
    extends _$InboxCountsCopyWithImpl<$Res, _$InboxCountsImpl>
    implements _$$InboxCountsImplCopyWith<$Res> {
  __$$InboxCountsImplCopyWithImpl(
      _$InboxCountsImpl _value, $Res Function(_$InboxCountsImpl) _then)
      : super(_value, _then);

  /// Create a copy of InboxCounts
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? views = null,
    Object? channels = null,
  }) {
    return _then(_$InboxCountsImpl(
      views: null == views
          ? _value.views
          : views // ignore: cast_nullable_to_non_nullable
              as InboxViewCounts,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as Map<String, int>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InboxCountsImpl implements _InboxCounts {
  const _$InboxCountsImpl(
      {this.views = const InboxViewCounts(),
      final Map<String, int> channels = const <String, int>{}})
      : _channels = channels;

  factory _$InboxCountsImpl.fromJson(Map<String, dynamic> json) =>
      _$$InboxCountsImplFromJson(json);

  @override
  @JsonKey()
  final InboxViewCounts views;
  final Map<String, int> _channels;
  @override
  @JsonKey()
  Map<String, int> get channels {
    if (_channels is EqualUnmodifiableMapView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_channels);
  }

  @override
  String toString() {
    return 'InboxCounts(views: $views, channels: $channels)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InboxCountsImpl &&
            (identical(other.views, views) || other.views == views) &&
            const DeepCollectionEquality().equals(other._channels, _channels));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, views, const DeepCollectionEquality().hash(_channels));

  /// Create a copy of InboxCounts
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InboxCountsImplCopyWith<_$InboxCountsImpl> get copyWith =>
      __$$InboxCountsImplCopyWithImpl<_$InboxCountsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InboxCountsImplToJson(
      this,
    );
  }
}

abstract class _InboxCounts implements InboxCounts {
  const factory _InboxCounts(
      {final InboxViewCounts views,
      final Map<String, int> channels}) = _$InboxCountsImpl;

  factory _InboxCounts.fromJson(Map<String, dynamic> json) =
      _$InboxCountsImpl.fromJson;

  @override
  InboxViewCounts get views;
  @override
  Map<String, int> get channels;

  /// Create a copy of InboxCounts
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InboxCountsImplCopyWith<_$InboxCountsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
