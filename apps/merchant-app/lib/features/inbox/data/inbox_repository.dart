import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "inbox_models.dart";

/// The reply outcome: the backend records the reply on the thread even when the
/// external channel send fails; [delivered] reports the external outcome.
typedef ReplyResult = ({InboxMessage message, bool delivered});

/// A drafted reply. [needsAi] is true when no AI provider is configured.
typedef SuggestResult = ({String suggestion, bool needsAi});

/// A loaded thread: the conversation plus its full message history.
typedef ThreadResult = ({InboxConversation conversation, List<InboxMessage> messages});

/// Filters for [InboxRepository.listConversations], mirroring the web
/// `ListInboxConversationsParams`.
class InboxListParams {
  const InboxListParams({
    this.status,
    this.excludeClosed = false,
    this.channel,
    this.handlerMode,
    this.assigned,
    this.starred,
    this.unread,
    this.q,
    this.limit,
    this.offset,
  });

  final String? status;
  final bool excludeClosed;
  final String? channel;
  final String? handlerMode;

  /// "me" = assigned to the signed-in agent, "none" = nobody has claimed it.
  final String? assigned;
  final bool? starred;
  final bool? unread;
  final String? q;
  final int? limit;
  final int? offset;

  Map<String, dynamic> toQuery() {
    final p = <String, dynamic>{};
    if (status != null && status!.isNotEmpty) {
      p["status"] = status;
    } else if (excludeClosed) {
      p["exclude_closed"] = "true";
    }
    if (channel != null && channel!.isNotEmpty) p["channel"] = channel;
    if (handlerMode != null && handlerMode!.isNotEmpty) {
      p["handler_mode"] = handlerMode;
    }
    if (assigned != null && assigned!.isNotEmpty) p["assigned"] = assigned;
    if (starred == true) p["starred"] = "true";
    if (unread == true) p["unread"] = "true";
    if (q != null && q!.isNotEmpty) p["q"] = q;
    if (limit != null) p["limit"] = "$limit";
    if (offset != null) p["offset"] = "$offset";
    return p;
  }
}

/// Thin transport for the merchant unified-inbox endpoints, mirroring the web
/// client's `getInboxCounts`, `listInboxConversations`, `getInboxConversation`,
/// `replyToInboxConversation`, `suggestInboxReply`, `takeOverInboxConversation`,
/// `returnInboxConversationToAi`, `setInboxConversationStatus`,
/// `starInboxConversation` and `markInboxConversationRead`
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
///
/// Backend base: /merchant/marketing/conversations (tenant-scoped, merchant-auth).
class InboxRepository {
  InboxRepository(this._dio);

  final Dio _dio;

  static const String _base = "/merchant/marketing/conversations";

  Map<String, dynamic> _asMap(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : const {};

  /// GET /counts -> the exact per-view + per-channel badge counts.
  Future<InboxCounts> getCounts() async {
    try {
      final res = await _dio.get<dynamic>("$_base/counts");
      return InboxCounts.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load inbox counts");
    }
  }

  /// GET / -> { conversations, count }.
  Future<List<InboxConversation>> listConversations(
    InboxListParams params,
  ) async {
    try {
      final query = params.toQuery();
      final res = await _dio.get<dynamic>(
        _base,
        queryParameters: query.isEmpty ? null : query,
      );
      final data = res.data;
      final raw =
          (data is Map ? data["conversations"] : null) as List? ?? const [];
      return raw
          .map((e) => InboxConversation.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load conversations");
    }
  }

  /// GET /:id -> { conversation, messages, customer360 }. The customer360 block
  /// is not consumed by the app yet.
  Future<ThreadResult> getConversation(String id) async {
    try {
      final res = await _dio.get<dynamic>("$_base/$id");
      final data = res.data;
      final conv = (data is Map ? data["conversation"] : null);
      if (conv is! Map) {
        throw ApiError("This conversation could not be found.", 404, "not_found");
      }
      final rawMessages =
          (data is Map ? data["messages"] : null) as List? ?? const [];
      final messages = rawMessages
          .map((e) => InboxMessage.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false);
      return (
        conversation: InboxConversation.fromJson(Map<String, dynamic>.from(conv)),
        messages: messages,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load this conversation");
    }
  }

  /// POST /:id/reply -> { message, delivered }.
  Future<ReplyResult> reply(String id, String text) async {
    try {
      final res = await _dio.post<dynamic>(
        "$_base/$id/reply",
        data: {"text": text},
      );
      final data = _asMap(res.data);
      return (
        message: InboxMessage.fromJson(_asMap(data["message"])),
        delivered: data["delivered"] == true,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't send the reply");
    }
  }

  /// POST /:id/suggest -> { suggestion, needs_ai }. Drafts a reply, never sends.
  Future<SuggestResult> suggest(String id) async {
    try {
      final res = await _dio.post<dynamic>("$_base/$id/suggest", data: {});
      final data = _asMap(res.data);
      final suggestion = data["suggestion"];
      return (
        suggestion: suggestion is String ? suggestion : "",
        needsAi: data["needs_ai"] == true,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't draft a reply");
    }
  }

  Future<InboxConversation> _conversationAction(
    String path,
    String fallback, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final res = await _dio.post<dynamic>(path, data: body ?? <String, dynamic>{});
      final data = res.data;
      final conv = (data is Map ? data["conversation"] : null);
      if (conv is! Map) {
        throw ApiError(fallback, 0);
      }
      return InboxConversation.fromJson(Map<String, dynamic>.from(conv));
    } catch (e) {
      throw ApiError.from(e, fallback: fallback);
    }
  }

  /// POST /:id/take-over. Throws ApiError 409 when another agent holds it.
  Future<InboxConversation> takeOver(String id) =>
      _conversationAction("$_base/$id/take-over", "Couldn't take over the conversation");

  /// POST /:id/return-to-ai. Throws ApiError 403 when assigned to another agent.
  Future<InboxConversation> returnToAi(String id) =>
      _conversationAction("$_base/$id/return-to-ai", "Couldn't return the conversation to the AI");

  /// POST /:id/status.
  Future<InboxConversation> setStatus(String id, String status) =>
      _conversationAction(
        "$_base/$id/status",
        "Couldn't update the status",
        body: {"status": status},
      );

  /// POST /:id/star. Omit [starred] to toggle the current value.
  Future<InboxConversation> star(String id, {bool? starred}) =>
      _conversationAction(
        "$_base/$id/star",
        "Couldn't update the star",
        body: starred == null ? {} : {"starred": starred},
      );

  /// POST /:id/read — clears the unread badge.
  Future<InboxConversation> markRead(String id) =>
      _conversationAction("$_base/$id/read", "Couldn't mark the conversation read");
}

final inboxRepositoryProvider = Provider<InboxRepository>(
  (ref) => InboxRepository(ref.read(dioProvider)),
);
