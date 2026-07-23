import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/auth/auth_controller.dart";
import "../data/jarvis_models.dart";
import "../data/jarvis_repository.dart";

/// Immutable state for the Jarvis chat screen.
class JarvisChatState {
  const JarvisChatState({
    this.messages = const <ChatMessage>[],
    this.busy = false,
    this.conversationId,
  });

  /// The transcript, oldest first.
  final List<ChatMessage> messages;

  /// True while a stream is in flight (locks the composer).
  final bool busy;

  /// The durable server conversation id, once one exists for this chat.
  final String? conversationId;

  JarvisChatState copyWith({
    List<ChatMessage>? messages,
    bool? busy,
    String? conversationId,
  }) {
    return JarvisChatState(
      messages: messages ?? this.messages,
      busy: busy ?? this.busy,
      conversationId: conversationId ?? this.conversationId,
    );
  }
}

/// Drives the Jarvis SSE lifecycle and the confirm-gate interactions.
///
/// Ports the web state machine (jarvis-panel.tsx): append the user turn + an
/// assistant placeholder, open the stream, then patch the trailing assistant
/// turn as `thinking | tool | confirm | message | error | done` frames arrive.
/// Writes never run inline — a `confirm` frame renders a card, and only
/// [applyConfirm] (via /merchant/jarvis/apply) actually executes.
class JarvisChatController extends Notifier<JarvisChatState> {
  CancelToken? _cancel;

  @override
  JarvisChatState build() {
    ref.onDispose(() => _cancel?.cancel());
    return const JarvisChatState();
  }

  JarvisRepository get _repo => ref.read(jarvisRepositoryProvider);
  String? get _token => ref.read(authControllerProvider).token;

  /// Sends a turn and streams the reply. No-op on empty input or while busy.
  Future<void> send(String raw) async {
    final message = raw.trim();
    if (message.isEmpty || state.busy) return;

    // Short rolling history window (oldest first), matching the web client.
    final withText =
        state.messages.where((m) => (m.text ?? "").isNotEmpty).toList();
    final recent =
        withText.length > 6 ? withText.sublist(withText.length - 6) : withText;
    final history = recent
        .map((m) => {
              "role": m.role == ChatRole.user ? "user" : "assistant",
              "content": m.text ?? "",
            })
        .toList();

    state = state.copyWith(
      busy: true,
      messages: [
        ...state.messages,
        ChatMessage(role: ChatRole.user, text: message),
        const ChatMessage(role: ChatRole.assistant, thinking: true),
      ],
    );

    // Make the chat durable so it appears in history. Best-effort: if it fails,
    // the run still proceeds ephemerally.
    var convId = state.conversationId;
    if (convId == null) {
      try {
        final title =
            message.length > 60 ? message.substring(0, 60) : message;
        final created = await _repo.createConversation(title: title);
        if (created.isNotEmpty) {
          convId = created;
          state = state.copyWith(conversationId: created);
        }
      } catch (_) {
        convId = null;
      }
    }

    final cancel = CancelToken();
    _cancel = cancel;
    try {
      await for (final event in _repo.sendMessage(
        message: message,
        conversationId: convId,
        history: history,
        token: _token,
        cancelToken: cancel,
      )) {
        _handle(event);
      }
    } catch (_) {
      if (cancel.isCancelled) return;
      _patchLast(
        (t) => t.copyWith(
          thinking: false,
          error: "Something went wrong. Try again in a moment.",
        ),
      );
    } finally {
      if (identical(_cancel, cancel)) _cancel = null;
      _patchLast((t) => t.copyWith(thinking: false));
      state = state.copyWith(busy: false);
    }
  }

  void _handle(JarvisStreamEvent event) {
    switch (event) {
      case JarvisThinking():
        _patchLast((t) => t.copyWith(thinking: true));
      case JarvisToolEvent(:final tool):
        _patchLast((t) {
          final tools = [...t.tools];
          final idx = tools.indexWhere((x) => x.id == tool.id);
          if (idx < 0) {
            tools.add(tool);
          } else {
            // Merge, don't replace: the coarse `tool`, the `tool_call` (args)
            // and the `tool_result` (data) frames each fill in part of the same
            // activity, so keep prior fields when a later frame omits them and
            // never regress a finished tool back to running.
            final prev = tools[idx];
            final terminal =
                prev.state == ToolState.done || prev.state == ToolState.error;
            tools[idx] = prev.copyWith(
              label: tool.label.isNotEmpty ? tool.label : prev.label,
              state: (terminal && tool.state == ToolState.running)
                  ? prev.state
                  : tool.state,
              kind: tool.kind ?? prev.kind,
              args: tool.args ?? prev.args,
              ok: tool.ok ?? prev.ok,
              resultData: tool.resultData ?? prev.resultData,
              resultError: tool.resultError ?? prev.resultError,
            );
          }
          return t.copyWith(tools: tools, thinking: true);
        });
      case JarvisConfirmEvent(:final confirm):
        _patchLast((t) {
          if (t.confirms.any((c) => c.token == confirm.token)) return t;
          return t.copyWith(
            confirms: [...t.confirms, confirm],
            thinking: true,
          );
        });
      case JarvisMessageEvent(:final text):
        _patchLast((t) => t.copyWith(text: text, thinking: false));
      case JarvisErrorEvent(:final message):
        _patchLast(
          (t) => t.copyWith(
            error: message.isEmpty ? "Something went wrong." : message,
            thinking: false,
          ),
        );
      case JarvisDoneEvent(:final conversationId):
        if (conversationId != null &&
            conversationId.isNotEmpty &&
            state.conversationId == null) {
          state = state.copyWith(conversationId: conversationId);
        }
        _patchLast((t) => t.copyWith(thinking: false));
    }
  }

  /// Applies a confirmation. For a hard-tier card, [confirmText] is the typed
  /// word; the SERVER re-checks it. On success the card flips to done (with any
  /// Undo); on failure it returns to pending with the reason.
  Future<void> applyConfirm(JarvisConfirm confirm, String confirmText) async {
    _updateConfirm(
      confirm.id,
      (c) => c.copyWith(status: ConfirmStatus.applying, error: null),
    );
    final res = await _repo.applyAction(
      token: confirm.token,
      confirmText: confirmText,
    );
    if (res.ok) {
      _updateConfirm(
        confirm.id,
        (c) => c.copyWith(
          status: ConfirmStatus.done,
          resultMsg: res.message ?? "Done.",
          undo: res.undo,
        ),
      );
    } else {
      _updateConfirm(
        confirm.id,
        (c) => c.copyWith(
          status: ConfirmStatus.pending,
          error: res.message ?? "That did not go through.",
        ),
      );
    }
  }

  /// Reverses a completed, reversible action via its undo token.
  Future<void> applyUndo(JarvisConfirm confirm) async {
    final undo = confirm.undo;
    if (undo == null) return;
    _updateConfirm(
      confirm.id,
      (c) => c.copyWith(undoing: true, error: null),
    );
    final res = await _repo.applyAction(token: undo.token);
    if (res.ok) {
      _updateConfirm(
        confirm.id,
        (c) => c.copyWith(undoing: false, undone: true, undo: null),
      );
    } else {
      _updateConfirm(
        confirm.id,
        (c) => c.copyWith(
          undoing: false,
          error: res.message ?? "Could not undo that.",
        ),
      );
    }
  }

  /// Dismisses a pending confirmation without applying it ("Not now").
  void dismissConfirm(String id) {
    _updateConfirm(id, (c) => c.copyWith(status: ConfirmStatus.dismissed));
  }

  /// Starts a fresh, empty chat (cancelling any in-flight run).
  void startNewChat() {
    _cancel?.cancel();
    _cancel = null;
    state = const JarvisChatState();
  }

  /// Loads a durable conversation into the transcript and continues it.
  void loadConversation(JarvisConversationDetail detail) {
    _cancel?.cancel();
    _cancel = null;
    final messages = detail.messages
        .where((m) => m.role == "user" || m.role == "assistant")
        .map(
          (m) => ChatMessage(
            role: m.role == "user" ? ChatRole.user : ChatRole.assistant,
            text: m.content,
          ),
        )
        .toList();
    state = JarvisChatState(
      messages: messages,
      conversationId: detail.id,
    );
  }

  void _patchLast(ChatMessage Function(ChatMessage) fn) {
    if (state.messages.isEmpty) return;
    final next = [...state.messages];
    next[next.length - 1] = fn(next.last);
    state = state.copyWith(messages: next);
  }

  void _updateConfirm(String id, JarvisConfirm Function(JarvisConfirm) fn) {
    final next = state.messages.map((m) {
      if (!m.confirms.any((c) => c.id == id)) return m;
      return m.copyWith(
        confirms: m.confirms.map((c) => c.id == id ? fn(c) : c).toList(),
      );
    }).toList();
    state = state.copyWith(messages: next);
  }
}

final jarvisChatControllerProvider =
    NotifierProvider<JarvisChatController, JarvisChatState>(
  JarvisChatController.new,
);
