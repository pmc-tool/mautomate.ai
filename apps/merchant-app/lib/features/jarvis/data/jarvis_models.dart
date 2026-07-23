// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "jarvis_models.freezed.dart";
part "jarvis_models.g.dart";

/// Who authored a chat turn.
enum ChatRole { user, assistant }

/// A proposed write is either one-tap (soft) or type-a-word (hard). The SERVER
/// enforces the real gate on /merchant/jarvis/apply; the app only renders it.
enum ConfirmTier { soft, hard }

/// Lifecycle of a single confirmation card.
enum ConfirmStatus { pending, applying, done, dismissed }

/// State of a tool call as it ticks through the stream.
enum ToolState { running, done, error }

/// One tool call Jarvis is running, surfaced live from the stream.
///
/// The coarse `tool` frame fills [id]/[label]/[state]; the richer `tool_call`
/// frame adds [kind] + [args] (what it's about to do), and `tool_result` adds
/// [ok] + [resultData]/[resultError] (a read tool's data) — the same detail the
/// web panel shows. These extras are null until their frame arrives.
@freezed
class JarvisToolActivity with _$JarvisToolActivity {
  const factory JarvisToolActivity({
    required String id,
    required String label,
    @Default(ToolState.running) ToolState state,

    /// "read" | "write", from the `tool_call` frame.
    String? kind,

    /// The tool's (server-sanitized) call arguments, from the `tool_call` frame.
    Map<String, dynamic>? args,

    /// Whether a read tool succeeded, from the `tool_result` frame.
    bool? ok,

    /// A read tool's returned data (any JSON shape), from `tool_result`.
    Object? resultData,

    /// A read tool's error message, from `tool_result`.
    String? resultError,
  }) = _JarvisToolActivity;
}

/// A reversible-action handle returned by /merchant/jarvis/apply.
@freezed
class JarvisUndo with _$JarvisUndo {
  const factory JarvisUndo({
    required String token,
    @Default("Undo") String label,
  }) = _JarvisUndo;

  factory JarvisUndo.fromJson(Map<String, dynamic> json) =>
      _$JarvisUndoFromJson(json);
}

/// A confirmation the merchant must approve before a change runs. Built from a
/// `confirm` frame; its [status] then advances locally as the merchant acts.
@freezed
class JarvisConfirm with _$JarvisConfirm {
  const factory JarvisConfirm({
    required String id,
    required String action,
    required String token,
    required String summary,
    @Default(ConfirmTier.soft) ConfirmTier tier,
    String? requireText,
    @Default(<String, dynamic>{}) Map<String, dynamic> details,
    @Default(ConfirmStatus.pending) ConfirmStatus status,
    String? error,
    String? resultMsg,
    JarvisUndo? undo,
    @Default(false) bool undoing,
    @Default(false) bool undone,
  }) = _JarvisConfirm;
}

/// One rendered turn in the transcript. An assistant turn accretes tools and
/// confirms as the stream runs, then settles on [text] (or [error]).
@freezed
class ChatMessage with _$ChatMessage {
  const factory ChatMessage({
    required ChatRole role,
    String? text,
    @Default(<JarvisToolActivity>[]) List<JarvisToolActivity> tools,
    @Default(<JarvisConfirm>[]) List<JarvisConfirm> confirms,
    @Default(false) bool thinking,
    String? error,
  }) = _ChatMessage;
}

/// The result of POST /merchant/jarvis/apply.
@freezed
class JarvisApplyResult with _$JarvisApplyResult {
  const factory JarvisApplyResult({
    @Default(false) bool ok,
    String? message,
    JarvisUndo? undo,
  }) = _JarvisApplyResult;

  factory JarvisApplyResult.fromJson(Map<String, dynamic> json) =>
      _$JarvisApplyResultFromJson(json);
}

/// A row in the conversation history list (GET /merchant/jarvis/conversations).
@freezed
class JarvisConversation with _$JarvisConversation {
  const factory JarvisConversation({
    required String id,
    @Default("New chat") String title,
    @JsonKey(name: "updated_at") String? updatedAt,
  }) = _JarvisConversation;

  factory JarvisConversation.fromJson(Map<String, dynamic> json) =>
      _$JarvisConversationFromJson(json);
}

/// A persisted message inside one conversation.
@freezed
class JarvisStoredMessage with _$JarvisStoredMessage {
  const factory JarvisStoredMessage({
    required String role,
    @Default("") String content,
    Map<String, dynamic>? meta,
    @JsonKey(name: "created_at") String? createdAt,
  }) = _JarvisStoredMessage;

  factory JarvisStoredMessage.fromJson(Map<String, dynamic> json) =>
      _$JarvisStoredMessageFromJson(json);
}

/// A full conversation with its messages (GET /merchant/jarvis/conversations/:id).
@freezed
class JarvisConversationDetail with _$JarvisConversationDetail {
  const factory JarvisConversationDetail({
    required String id,
    @Default("New chat") String title,
    @Default(<JarvisStoredMessage>[]) List<JarvisStoredMessage> messages,
  }) = _JarvisConversationDetail;

  factory JarvisConversationDetail.fromJson(Map<String, dynamic> json) =>
      _$JarvisConversationDetailFromJson(json);
}

/// A parsed Jarvis stream event — the app-level union the chat controller
/// drives its state machine off of (mapped from raw SSE frames in the repo).
@freezed
sealed class JarvisStreamEvent with _$JarvisStreamEvent {
  /// The loop started / is still working.
  const factory JarvisStreamEvent.thinking() = JarvisThinking;

  /// A tool call started or finished.
  const factory JarvisStreamEvent.tool(JarvisToolActivity tool) = JarvisToolEvent;

  /// A write was proposed and needs confirmation.
  const factory JarvisStreamEvent.confirm(JarvisConfirm confirm) =
      JarvisConfirmEvent;

  /// The final natural-language answer.
  const factory JarvisStreamEvent.message(String text) = JarvisMessageEvent;

  /// The run failed.
  const factory JarvisStreamEvent.error(String message) = JarvisErrorEvent;

  /// The run finished; carries the server conversation id when durable.
  const factory JarvisStreamEvent.done(String? conversationId) = JarvisDoneEvent;
}
