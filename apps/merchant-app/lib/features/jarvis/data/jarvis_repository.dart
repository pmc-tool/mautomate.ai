import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "../../../core/api/sse.dart";
import "jarvis_models.dart";

/// Thin transport for the Jarvis endpoints, mirroring the web client
/// (apps/storefront/src/components/merchant-admin/jarvis-panel.tsx):
///  - POST /merchant/jarvis                    — streamed agent run (SSE)
///  - POST /merchant/jarvis/apply              — execute a confirmed write
///  - GET  /merchant/jarvis/conversations      — chat history
///  - GET  /merchant/jarvis/conversations/:id  — one chat + its messages
///
/// The SSE transport lives in core/api/sse.dart; this maps raw frames into the
/// typed [JarvisStreamEvent] union so the controller never touches wire format.
class JarvisRepository {
  JarvisRepository(this._dio);

  final Dio _dio;

  /// Runs a Jarvis turn and yields parsed stream events as they arrive.
  ///
  /// [conversationId] makes the run durable (server-side history); omit it for
  /// an ephemeral chat, exactly like the floating web panel. [history] is the
  /// short rolling window of prior turns the web client also sends.
  Stream<JarvisStreamEvent> sendMessage({
    required String message,
    String? conversationId,
    List<Map<String, String>> history = const [],
    String? token,
    CancelToken? cancelToken,
  }) async* {
    final body = <String, dynamic>{
      "message": message,
      "history": history,
      if (conversationId != null && conversationId.isNotEmpty)
        "conversation_id": conversationId,
    };

    await for (final frame in postSse(
      _dio,
      path: "/merchant/jarvis",
      body: body,
      token: token,
      cancelToken: cancelToken,
    )) {
      final event = _mapFrame(frame);
      if (event != null) yield event;
    }
  }

  /// Executes a confirmed write. Returns the parsed `{ ok, message, undo }`
  /// body even on a 4xx (the gate rejects with `{ ok:false, message }`), so the
  /// caller can show the reason inline rather than a generic failure.
  ///
  /// Pass [confirmText] for a hard-tier action (the typed word); leave it null
  /// for a soft one-tap action or an undo (which posts only the token).
  Future<JarvisApplyResult> applyAction({
    required String token,
    String? confirmText,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/jarvis/apply",
        data: <String, dynamic>{
          "token": token,
          if (confirmText != null) "confirm_text": confirmText,
        },
      );
      return JarvisApplyResult.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      );
    } on DioException catch (e) {
      // The gate returns a structured {ok:false, message} on 400/403/409 — keep
      // that message rather than masking it with a generic transport error.
      final data = e.response?.data;
      if (data is Map && data.containsKey("ok")) {
        return JarvisApplyResult.fromJson(Map<String, dynamic>.from(data));
      }
      return JarvisApplyResult(
        ok: false,
        message: ApiError.from(e, fallback: "That did not go through.").message,
      );
    } catch (e) {
      return JarvisApplyResult(
        ok: false,
        message: ApiError.from(e, fallback: "That did not go through.").message,
      );
    }
  }

  /// GET /merchant/jarvis/conversations -> the store's chats, newest first.
  Future<List<JarvisConversation>> listConversations() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/jarvis/conversations");
      final map = Map<String, dynamic>.from(res.data as Map);
      final list = (map["conversations"] as List?) ?? const [];
      return list
          .map((e) => JarvisConversation.fromJson(
                Map<String, dynamic>.from(e as Map),
              ))
          .toList();
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not load your chats");
    }
  }

  /// GET /merchant/jarvis/conversations/:id -> one chat and its messages.
  Future<JarvisConversationDetail> getConversation(String id) async {
    try {
      final res =
          await _dio.get<dynamic>("/merchant/jarvis/conversations/$id");
      return JarvisConversationDetail.fromJson(
        Map<String, dynamic>.from(res.data as Map),
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not open that chat");
    }
  }

  /// POST /merchant/jarvis/conversations -> start a new durable chat.
  Future<String> createConversation({String title = "New chat"}) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/jarvis/conversations",
        data: <String, dynamic>{"title": title},
      );
      final map = Map<String, dynamic>.from(res.data as Map);
      return (map["id"] ?? "").toString();
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not start a new chat");
    }
  }

  /// DELETE /merchant/jarvis/conversations/:id.
  Future<void> deleteConversation(String id) async {
    try {
      await _dio.delete<dynamic>("/merchant/jarvis/conversations/$id");
    } catch (e) {
      throw ApiError.from(e, fallback: "Could not delete that chat");
    }
  }

  JarvisStreamEvent? _mapFrame(SseFrame frame) {
    final p = frame.data;
    switch (frame.event) {
      case "thinking":
        return const JarvisStreamEvent.thinking();
      case "tool":
        final id = (p["id"] ?? "").toString();
        return JarvisStreamEvent.tool(
          JarvisToolActivity(
            id: id.isEmpty ? (p["name"] ?? "tool").toString() : id,
            label: (p["label"] ?? p["name"] ?? "Working").toString(),
            state: _toolState(p["state"]),
          ),
        );
      case "tool_call":
        // A tool STARTED, with its (sanitized) args — augments the matching
        // `tool` activity so the app can show what Jarvis is about to do.
        final id = (p["id"] ?? "").toString();
        return JarvisStreamEvent.tool(
          JarvisToolActivity(
            id: id.isEmpty ? (p["name"] ?? "tool").toString() : id,
            label: (p["label"] ?? p["name"] ?? "Working").toString(),
            kind: p["kind"]?.toString(),
            args: p["args"] is Map
                ? Map<String, dynamic>.from(p["args"] as Map)
                : null,
          ),
        );
      case "tool_result":
        // A READ tool's data — augments the matching activity with the result.
        final id = (p["id"] ?? "").toString();
        final ok = p["ok"] == true;
        return JarvisStreamEvent.tool(
          JarvisToolActivity(
            id: id.isEmpty ? (p["name"] ?? "tool").toString() : id,
            label: (p["label"] ?? p["name"] ?? "Working").toString(),
            state: ok ? ToolState.done : ToolState.error,
            ok: ok,
            resultData: p["data"],
            resultError: p["error"]?.toString(),
          ),
        );
      case "confirm":
        final token = (p["token"] ?? "").toString();
        if (token.isEmpty) return null;
        final rawId = (p["id"] ?? "").toString();
        return JarvisStreamEvent.confirm(
          JarvisConfirm(
            id: rawId.isNotEmpty
                ? rawId
                : (token.length >= 12 ? token.substring(0, 12) : token),
            action: (p["action"] ?? "").toString(),
            token: token,
            summary: (p["summary"] ?? "Confirm this change?").toString(),
            tier: p["tier"] == "hard" ? ConfirmTier.hard : ConfirmTier.soft,
            requireText: p["require_text"]?.toString(),
            details: p["details"] is Map
                ? Map<String, dynamic>.from(p["details"] as Map)
                : const <String, dynamic>{},
          ),
        );
      case "message":
        return JarvisStreamEvent.message((p["text"] ?? "").toString());
      case "error":
        return JarvisStreamEvent.error(
          (p["message"] ?? "Something went wrong.").toString(),
        );
      case "done":
        return JarvisStreamEvent.done(p["conversation_id"]?.toString());
      default:
        return null;
    }
  }

  ToolState _toolState(Object? raw) {
    switch (raw) {
      case "done":
        return ToolState.done;
      case "error":
        return ToolState.error;
      default:
        return ToolState.running;
    }
  }
}

final jarvisRepositoryProvider = Provider<JarvisRepository>(
  (ref) => JarvisRepository(ref.watch(dioProvider)),
);
