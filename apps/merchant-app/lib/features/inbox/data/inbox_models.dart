// DTOs for the merchant Inbox feature, mirroring the web client's inbox types
// (apps/storefront/src/lib/merchant-admin/api.ts): InboxContact, InboxConversation,
// InboxMessage and InboxCounts. freezed + json_serializable generate parsing,
// equality and copyWith. Field names are snake_case on the wire, camelCase in
// Dart via @JsonKey.
//
// The channel / status / handler_mode columns are LEFT AS STRINGS on purpose:
// the web types are `Union | string`, so a value the app has not seen yet must
// still round-trip and render, never crash the list.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "inbox_models.freezed.dart";
part "inbox_models.g.dart";

int _toInt(Object? v) =>
    v is int ? v : (v is num ? v.toInt() : int.tryParse("$v") ?? 0);

/// The person on the far side of a conversation.
@freezed
class InboxContact with _$InboxContact {
  const factory InboxContact({
    @Default("") String id,
    @JsonKey(name: "display_name") String? displayName,
    @JsonKey(name: "avatar_url") String? avatarUrl,
    String? phone,
    String? email,
    @JsonKey(name: "customer_id") String? customerId,
  }) = _InboxContact;

  factory InboxContact.fromJson(Map<String, dynamic> json) =>
      _$InboxContactFromJson(json);
}

/// A row in the inbox list — mirrors the web `InboxConversation`
/// (GET /merchant/marketing/conversations -> { conversations, count }).
@freezed
class InboxConversation with _$InboxConversation {
  const factory InboxConversation({
    @Default("") String id,
    @Default("") String channel,
    @Default("open") String status,
    @JsonKey(name: "handler_mode") @Default("ai") String handlerMode,
    @JsonKey(name: "handoff_reason") String? handoffReason,
    @JsonKey(name: "chatbot_id") String? chatbotId,
    @Default(false) bool starred,
    @JsonKey(name: "unread_count", fromJson: _toInt) @Default(0) int unreadCount,
    @JsonKey(name: "last_message_at") String? lastMessageAt,
    @JsonKey(name: "assigned_user_id") String? assignedUserId,
    InboxContact? contact,
    String? preview,
  }) = _InboxConversation;

  factory InboxConversation.fromJson(Map<String, dynamic> json) =>
      _$InboxConversationFromJson(json);
}

/// One message in a thread — mirrors the web `InboxMessage`. `media` is loosely
/// typed on the wire (the backend attaches product cards etc.); the app keeps
/// the fields it renders.
@freezed
class InboxMessage with _$InboxMessage {
  const factory InboxMessage({
    @Default("") String id,
    @Default("") String direction,
    @Default("") String author,
    String? body,
    @JsonKey(name: "sent_at") String? sentAt,
    @JsonKey(name: "delivery_status") String? deliveryStatus,
  }) = _InboxMessage;

  factory InboxMessage.fromJson(Map<String, dynamic> json) =>
      _$InboxMessageFromJson(json);
}

/// Per-view badge counts over the WHOLE inbox — mirrors `InboxCounts.views`.
@freezed
class InboxViewCounts with _$InboxViewCounts {
  const factory InboxViewCounts({
    @JsonKey(name: "needs_you", fromJson: _toInt) @Default(0) int needsYou,
    @JsonKey(fromJson: _toInt) @Default(0) int unassigned,
    @JsonKey(fromJson: _toInt) @Default(0) int mine,
    @JsonKey(fromJson: _toInt) @Default(0) int starred,
    @JsonKey(fromJson: _toInt) @Default(0) int open,
    @JsonKey(fromJson: _toInt) @Default(0) int closed,
    @JsonKey(fromJson: _toInt) @Default(0) int all,
    @JsonKey(fromJson: _toInt) @Default(0) int unread,
  }) = _InboxViewCounts;

  factory InboxViewCounts.fromJson(Map<String, dynamic> json) =>
      _$InboxViewCountsFromJson(json);
}

/// Exact badge counts for the inbox — mirrors the web `InboxCounts`
/// (GET /merchant/marketing/conversations/counts).
@freezed
class InboxCounts with _$InboxCounts {
  const factory InboxCounts({
    @Default(InboxViewCounts()) InboxViewCounts views,
    @Default(<String, int>{}) Map<String, int> channels,
  }) = _InboxCounts;

  factory InboxCounts.fromJson(Map<String, dynamic> json) =>
      _$InboxCountsFromJson(json);
}
