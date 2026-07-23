import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "jarvis_models.dart";

/// A live Jarvis voice session handed back by the backend `voice/start` route.
///
/// Mirrors the JSON the web stage consumes
/// (apps/backend/src/api/merchant/jarvis/voice/start): a Daily room + an owner
/// meeting token to join it, the `call_id` that pins the session to this
/// merchant's tenant (used again to stop it), and whether the pipecat bot was
/// dispatched into the room.
class JarvisVoiceSession {
  const JarvisVoiceSession({
    required this.callId,
    required this.roomUrl,
    required this.token,
    required this.botDispatched,
  });

  /// The tenant-bound call row id — replayed to `voice/stop`.
  final String callId;

  /// The Daily room URL the client joins.
  final String roomUrl;

  /// A short-lived owner meeting token for the room.
  final String token;

  /// True when the voice runtime accepted the bot dispatch. When false the room
  /// exists but Jarvis may take a beat (or never) to join — the caller shows a
  /// "connecting" state and, if the bot never arrives, a clear fallback.
  final bool botDispatched;

  factory JarvisVoiceSession.fromJson(Map<String, dynamic> json) {
    return JarvisVoiceSession(
      callId: (json["call_id"] ?? "").toString(),
      roomUrl: (json["room_url"] ?? "").toString(),
      token: (json["token"] ?? "").toString(),
      botDispatched: json["bot_dispatched"] == true,
    );
  }

  /// True only when we have the minimum needed to join a room.
  bool get isJoinable => roomUrl.isNotEmpty && token.isNotEmpty;
}

/// Transport for the premium real-time Jarvis voice pipeline (Daily WebRTC →
/// pipecat → Jarvis), mirroring the web stage's start/stop calls:
///  - POST /merchant/jarvis/voice/start -> { call_id, room_url, token, ... }
///  - POST /merchant/jarvis/voice/stop  -> ends the tenant-bound session
///
/// The session is tenant-scoped server-side by the authenticated merchant token
/// (attached by the Dio interceptor); the client never supplies a tenant.
class JarvisVoiceRepository {
  JarvisVoiceRepository(this._dio);

  final Dio _dio;

  /// Starts a live voice session. Throws an [ApiError] with a friendly message
  /// when the voice service is unavailable (503) or the request otherwise
  /// fails, so the controller can degrade to a clear, actionable state.
  Future<JarvisVoiceSession> start() async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/jarvis/voice/start",
        data: const <String, dynamic>{},
      );
      final map = Map<String, dynamic>.from(res.data as Map);
      return JarvisVoiceSession.fromJson(map);
    } catch (e) {
      throw ApiError.from(
        e,
        fallback: "Live voice isn't available right now. Please try again.",
      );
    }
  }

  /// Ends a live session (best-effort). The session also expires server-side on
  /// its own, so a failure here is swallowed — never block teardown on it.
  Future<void> stop(String callId) async {
    if (callId.isEmpty) return;
    try {
      await _dio.post<dynamic>(
        "/merchant/jarvis/voice/stop",
        data: <String, dynamic>{"call_id": callId},
      );
    } catch (_) {
      // Best-effort: the room + call row expire on their own.
    }
  }

  /// GET /merchant/jarvis/voice/pending — the writes Jarvis PROPOSED over voice
  /// that are still awaiting the merchant's confirmation. Voice never executes a
  /// write: it queues a signed, tenant-bound plan token here, which the merchant
  /// applies through the same POST /merchant/jarvis/apply path as chat. Each row
  /// (`{ id, action, tier, require_text, summary, token, exp, call_id,
  /// created_at }`) maps onto the shared [JarvisConfirm] model. Best-effort — a
  /// failed poll must never break the live call, so it yields an empty list.
  Future<List<JarvisConfirm>> pending() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/jarvis/voice/pending");
      final map = Map<String, dynamic>.from(res.data as Map);
      final list = (map["pending"] as List?) ?? const [];
      return list
          .whereType<Map>()
          .map((raw) {
            final row = Map<String, dynamic>.from(raw);
            final token = (row["token"] ?? "").toString();
            final id = (row["id"] ?? "").toString();
            return JarvisConfirm(
              id: id.isNotEmpty
                  ? id
                  : (token.length >= 12 ? token.substring(0, 12) : token),
              action: (row["action"] ?? "").toString(),
              token: token,
              summary: (row["summary"] ?? "Confirm this change?").toString(),
              tier: row["tier"] == "hard" ? ConfirmTier.hard : ConfirmTier.soft,
              requireText: row["require_text"]?.toString(),
            );
          })
          .where((c) => c.token.isNotEmpty)
          .toList(growable: false);
    } catch (_) {
      return const <JarvisConfirm>[];
    }
  }
}

final jarvisVoiceRepositoryProvider = Provider<JarvisVoiceRepository>(
  (ref) => JarvisVoiceRepository(ref.watch(dioProvider)),
);
