import "dart:async";
import "dart:math" as math;

import "package:daily_flutter/daily_flutter.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:permission_handler/permission_handler.dart";

import "../../../core/api/api_error.dart";
import "../data/jarvis_models.dart";
import "../data/jarvis_repository.dart";
import "../data/jarvis_voice_repository.dart";

/// What the live loop is doing right now — drives the orb + the sheet labels.
/// Mirrors the four web-stage states plus a leading [connecting] beat while the
/// Daily room spins up.
enum JarvisLivePhase {
  /// Spinning up the room / waiting for the bot to join.
  connecting,

  /// Connected, ready — no one is talking.
  idle,

  /// The merchant is talking (local is the active speaker).
  listening,

  /// Between turns — the merchant finished, Jarvis hasn't answered yet.
  thinking,

  /// Jarvis is talking (the bot is the active speaker).
  speaking,

  /// The session has ended (left the room, or a fatal error).
  ended,
}

/// The transport health of the Daily session, surfaced so the sheet can show a
/// truthful "Connecting" / "Reconnecting" / "Couldn't connect" hint.
enum JarvisLiveConnection { idle, connecting, connected, reconnecting, error }

/// A hard blocker the merchant must resolve before live voice can work.
enum JarvisLiveBlock {
  /// No blocker.
  none,

  /// Microphone permission was refused — live voice can't hear the merchant.
  micDenied,
}

/// Immutable state for the real-time voice loop.
class JarvisLiveState {
  const JarvisLiveState({
    this.active = false,
    this.phase = JarvisLivePhase.connecting,
    this.connection = JarvisLiveConnection.idle,
    this.amplitude = 0,
    this.micLive = true,
    this.caption = "",
    this.notice,
    this.block = JarvisLiveBlock.none,
    this.pending = const <JarvisConfirm>[],
  });

  /// True once [start] has been invoked and teardown hasn't finished — the
  /// sheet renders the live surface while this holds.
  final bool active;

  /// The current activity, fed to the orb + the status label.
  final JarvisLivePhase phase;

  /// Underlying transport health.
  final JarvisLiveConnection connection;

  /// Live intensity 0..1 — a smoothed envelope synthesized from the real
  /// turn-taking (Daily's active-speaker signal, driven by the real bot audio).
  final double amplitude;

  /// Whether the merchant's mic is currently un-muted.
  final bool micLive;

  /// A best-effort caption of the latest transcript (bot or merchant) parsed
  /// from Daily app-messages, when the pipeline sends them.
  final String caption;

  /// A transient, friendly message (e.g. a connection problem).
  final String? notice;

  /// A hard blocker needing merchant action.
  final JarvisLiveBlock block;

  /// Writes Jarvis proposed over voice that still need the merchant's confirm.
  final List<JarvisConfirm> pending;

  bool get isConnecting => phase == JarvisLivePhase.connecting;
  bool get isSpeaking => phase == JarvisLivePhase.speaking;
  bool get isListening => phase == JarvisLivePhase.listening;
  bool get hasEnded => phase == JarvisLivePhase.ended;

  static const Object _keep = Object();

  JarvisLiveState copyWith({
    bool? active,
    JarvisLivePhase? phase,
    JarvisLiveConnection? connection,
    double? amplitude,
    bool? micLive,
    String? caption,
    Object? notice = _keep,
    JarvisLiveBlock? block,
    List<JarvisConfirm>? pending,
  }) {
    return JarvisLiveState(
      active: active ?? this.active,
      phase: phase ?? this.phase,
      connection: connection ?? this.connection,
      amplitude: amplitude ?? this.amplitude,
      micLive: micLive ?? this.micLive,
      caption: caption ?? this.caption,
      notice: identical(notice, _keep) ? this.notice : notice as String?,
      block: block ?? this.block,
      pending: pending ?? this.pending,
    );
  }
}

/// Drives the PREMIUM real-time voice loop for Jarvis — the mobile twin of the
/// web Jarvis Stage.
///
/// Unlike the on-device [JarvisVoiceController] (which transcribes locally and
/// runs the same text SSE path), this joins the SAME pipecat voice pipeline the
/// web uses over Daily WebRTC: it asks the backend to spin up a room + bot
/// (`voice/start`), joins with the merchant's mic published, and lets Daily play
/// the bot's audio natively — full-duplex, so barge-in is handled by the
/// pipeline. The orb is driven by the real turn-taking: Daily's active-speaker
/// signal (a product of the real bot audio) selects the phase, and a smoothed
/// envelope animates the amplitude (the Flutter SDK exposes no per-track PCM
/// level, so the amplitude is synthesized rather than sampled).
///
/// Every failure mode — permission denied, room start failure, a dropped
/// connection — lands on a clear state with a retry, never a dead screen.
class JarvisRealtimeVoiceController extends Notifier<JarvisLiveState> {
  final math.Random _rand = math.Random();

  CallClient? _call;
  StreamSubscription<Event>? _events;
  String _callId = "";

  // Guards so start/stop can't race or double-run.
  bool _starting = false;
  bool _stopping = false;
  int _generation = 0;

  // Envelope animation.
  Timer? _envelope;
  double _amp = 0;
  double _pulse = 0;

  // Turn-taking demotion: when the active speaker goes quiet we ease back to
  // idle rather than freezing on the last state.
  Timer? _settleTimer;

  // Polls the voice confirm queue while a call is live.
  Timer? _pendingPoll;

  JarvisVoiceRepository get _repo => ref.read(jarvisVoiceRepositoryProvider);

  @override
  JarvisLiveState build() {
    ref.onDispose(_teardown);
    return const JarvisLiveState();
  }

  /// Starts a live session. No-op if one is already active or starting.
  Future<void> start() async {
    if (_starting || state.active) return;
    _starting = true;
    _stopping = false;
    final gen = ++_generation;

    state = const JarvisLiveState(
      active: true,
      phase: JarvisLivePhase.connecting,
      connection: JarvisLiveConnection.connecting,
      micLive: true,
    );
    _startEnvelope();

    // 1) Microphone permission — live voice is useless if Jarvis can't hear the
    // merchant. Daily also requests it internally, but we check up-front so a
    // denial becomes a clear, actionable state instead of a silent dead mic.
    try {
      final status = await Permission.microphone.request();
      if (gen != _generation) return; // superseded/stopped mid-await
      if (!status.isGranted) {
        _starting = false;
        state = state.copyWith(
          phase: JarvisLivePhase.ended,
          connection: JarvisLiveConnection.error,
          block: JarvisLiveBlock.micDenied,
        );
        _stopEnvelope();
        return;
      }
    } catch (_) {
      // If the permission plugin itself fails, fall through and let the join
      // attempt surface any problem — we never hard-fail on the pre-check.
    }

    // 2) Ask the backend to create the room + dispatch the Jarvis bot.
    JarvisVoiceSession session;
    try {
      session = await _repo.start();
    } on ApiError catch (e) {
      if (gen != _generation) return;
      _starting = false;
      _fail(e.message);
      return;
    } catch (_) {
      if (gen != _generation) return;
      _starting = false;
      _fail("Live voice isn't available right now. Please try again.");
      return;
    }
    if (gen != _generation) {
      // Stopped while starting — release the room we just created.
      unawaited(_repo.stop(session.callId));
      return;
    }
    if (!session.isJoinable) {
      _starting = false;
      _fail("Live voice isn't available right now. Please try again.");
      return;
    }
    _callId = session.callId;

    // 3) Join the Daily room with the mic published + the camera off.
    try {
      final call = await CallClient.create();
      if (gen != _generation) {
        // Stopped during creation — dispose the orphan client + release room.
        unawaited(call.dispose());
        unawaited(_repo.stop(_callId));
        return;
      }
      _call = call;
      _events = call.events.listen(_onEvent, onError: (_) {});

      // Publish audio, never video (mirrors the web `videoSource:false` +
      // `setLocalAudio(true)`). Setting this before join means join never tries
      // to acquire the camera, so no camera permission is ever requested.
      await call.setInputsEnabled(camera: false, microphone: true);
      if (gen != _generation) return;

      await call.join(
        url: Uri.parse(session.roomUrl),
        token: session.token,
      );
      if (gen != _generation) return;

      // Assert the mic is live post-join (this is the track the pipecat VAD
      // listens to).
      await call.setInputsEnabled(camera: false, microphone: true);

      _starting = false;
      state = state.copyWith(
        connection: JarvisLiveConnection.connected,
        // Stay in "connecting" until the bot actually joins/speaks; the phase
        // advances on the first active-speaker / participant event.
      );
      _startPendingPoll();
    } catch (_) {
      if (gen != _generation) return;
      _starting = false;
      _fail("Couldn't connect to Jarvis. Please try again.");
      unawaited(_disposeCall());
      unawaited(_repo.stop(_callId));
      _callId = "";
    }
  }

  /// Mutes / un-mutes the merchant's microphone (the sheet's mic control). A
  /// no-op if the call isn't live.
  Future<void> toggleMic() async {
    final call = _call;
    if (call == null) return;
    final next = !state.micLive;
    try {
      await call.setInputsEnabled(microphone: next);
      state = state.copyWith(micLive: next);
    } catch (_) {
      // Leave the previous state; the merchant can try again.
    }
  }

  /// Ends the live session and tears everything down. Safe to call repeatedly.
  Future<void> stop() async {
    if (_stopping) return;
    _stopping = true;
    _generation++; // cancel any in-flight start
    _settleTimer?.cancel();
    _stopPendingPoll();
    _stopEnvelope();

    final callId = _callId;
    _callId = "";
    await _disposeCall();
    if (callId.isNotEmpty) {
      unawaited(_repo.stop(callId));
    }

    // Only reset to a clean idle if we're not preserving a blocker for the UI.
    if (state.block == JarvisLiveBlock.none) {
      state = const JarvisLiveState();
    } else {
      state = state.copyWith(active: false);
    }
    _stopping = false;
  }

  /// Clears a resolved blocker (e.g. after granting the mic in Settings) so the
  /// merchant can retry.
  void clearBlock() {
    state = state.copyWith(block: JarvisLiveBlock.none, notice: null);
  }

  // ---- Voice-proposed writes (the confirm gate) ------------------------

  void _startPendingPoll() {
    _pendingPoll?.cancel();
    // Poll the voice confirm queue every ~3s while the call is live so a write
    // Jarvis proposed by voice surfaces as a card the merchant can approve.
    _pendingPoll = Timer.periodic(
      const Duration(seconds: 3),
      (_) => unawaited(_pollPending()),
    );
    unawaited(_pollPending());
  }

  void _stopPendingPoll() {
    _pendingPoll?.cancel();
    _pendingPoll = null;
  }

  Future<void> _pollPending() async {
    if (!state.active) return;
    final incoming = await _repo.pending();
    if (!state.active) return;
    final priorByToken = {for (final c in state.pending) c.token: c};
    final next = <JarvisConfirm>[];
    final seen = <String>{};
    for (final proposal in incoming) {
      seen.add(proposal.token);
      // Keep any local status (applying / done / dismissed / error) so a poll
      // never resets a card the merchant already acted on.
      next.add(priorByToken[proposal.token] ?? proposal);
    }
    // Retain locally-acted cards the server no longer lists so their outcome
    // (or a dismissed choice) stays put instead of flickering back as fresh.
    for (final tracked in state.pending) {
      if (!seen.contains(tracked.token) &&
          tracked.status != ConfirmStatus.pending) {
        next.add(tracked);
      }
    }
    state = state.copyWith(pending: next);
  }

  /// Applies a voice-proposed write through the same confirmed-apply path as
  /// chat (POST /merchant/jarvis/apply). [confirmText] is the typed word for a
  /// hard-tier action, empty for a soft one-tap.
  Future<void> applyPending(JarvisConfirm confirm, String confirmText) async {
    _updatePending(
      confirm.token,
      (c) => c.copyWith(status: ConfirmStatus.applying, error: null),
    );
    final res = await ref.read(jarvisRepositoryProvider).applyAction(
          token: confirm.token,
          confirmText: confirmText,
        );
    if (res.ok) {
      _updatePending(
        confirm.token,
        (c) => c.copyWith(
          status: ConfirmStatus.done,
          resultMsg: res.message ?? "Done.",
          undo: res.undo,
        ),
      );
    } else {
      _updatePending(
        confirm.token,
        (c) => c.copyWith(
          status: ConfirmStatus.pending,
          error: res.message ?? "That didn't go through.",
        ),
      );
    }
  }

  /// Reverses a completed voice-proposed action via its undo token.
  Future<void> applyPendingUndo(JarvisConfirm confirm) async {
    final undo = confirm.undo;
    if (undo == null) return;
    _updatePending(
      confirm.token,
      (c) => c.copyWith(undoing: true, error: null),
    );
    final res = await ref
        .read(jarvisRepositoryProvider)
        .applyAction(token: undo.token);
    if (res.ok) {
      _updatePending(
        confirm.token,
        (c) => c.copyWith(undoing: false, undone: true, undo: null),
      );
    } else {
      _updatePending(
        confirm.token,
        (c) => c.copyWith(
          undoing: false,
          error: res.message ?? "Could not undo that.",
        ),
      );
    }
  }

  /// Dismisses a proposed write ("Not now") without applying it.
  void dismissPending(String token) {
    _updatePending(token, (c) => c.copyWith(status: ConfirmStatus.dismissed));
  }

  void _updatePending(String token, JarvisConfirm Function(JarvisConfirm) fn) {
    final next = state.pending
        .map((c) => c.token == token ? fn(c) : c)
        .toList(growable: false);
    state = state.copyWith(pending: next);
  }

  // ---- Daily events -----------------------------------------------------

  void _onEvent(Event event) {
    if (!state.active) return;

    if (event is CallStateUpdatedEvent) {
      switch (event.stateData.state) {
        case CallState.joining:
          state = state.copyWith(connection: JarvisLiveConnection.connecting);
        case CallState.joined:
          state = state.copyWith(connection: JarvisLiveConnection.connected);
        case CallState.leaving:
          break;
        case CallState.left:
          // Left unexpectedly (not via our stop()) — reflect the drop.
          if (!_stopping && state.active) {
            state = state.copyWith(
              phase: JarvisLivePhase.ended,
              connection: JarvisLiveConnection.error,
              notice: "The call ended. Tap to reconnect.",
            );
            _stopEnvelope();
          }
        case CallState.initialized:
          break;
      }
      return;
    }

    if (event is ActiveSpeakerChangedEvent) {
      _applySpeaker(event.participant);
      return;
    }

    if (event is ParticipantJoinedEvent) {
      // The bot (a remote participant) has joined — leave the "connecting" beat
      // for a ready idle if we're still waiting.
      if (!event.participant.info.isLocal && state.isConnecting) {
        state = state.copyWith(phase: JarvisLivePhase.idle);
      }
      return;
    }

    if (event is ParticipantLeftEvent) {
      if (!event.participant.info.isLocal && !_stopping && state.active) {
        // The bot dropped out — surface it rather than freezing.
        state = state.copyWith(
          phase: JarvisLivePhase.idle,
          notice: "Jarvis left the call. Tap to reconnect.",
        );
      }
      return;
    }

    if (event is AppMessageReceivedEvent) {
      _applyCaption(event.data);
      return;
    }

    if (event is ErrorEvent) {
      if (!_stopping && state.active) {
        state = state.copyWith(
          connection: JarvisLiveConnection.reconnecting,
          notice: "Connection trouble — trying to recover.",
        );
      }
      return;
    }
  }

  /// Maps the active speaker to a phase. The bot speaking → [speaking]; the
  /// merchant speaking → [listening]; silence eases back through [thinking] to
  /// [idle]. This is the real turn-taking — Daily derives the active speaker
  /// from the actual audio in the room.
  void _applySpeaker(Participant? participant) {
    _settleTimer?.cancel();
    if (participant == null) {
      // Nobody is talking. If Jarvis had the floor the turn is simply over; if
      // the merchant just finished, show a brief "thinking" beat before idle.
      final wasListening = state.isListening;
      state = state.copyWith(
        phase: wasListening ? JarvisLivePhase.thinking : JarvisLivePhase.idle,
      );
      _pulse = 0.3;
      _settleTimer = Timer(const Duration(milliseconds: 1100), () {
        if (state.active && !state.isSpeaking && !state.isListening) {
          state = state.copyWith(phase: JarvisLivePhase.idle);
        }
      });
      return;
    }
    if (participant.info.isLocal) {
      state = state.copyWith(phase: JarvisLivePhase.listening);
    } else {
      state = state.copyWith(phase: JarvisLivePhase.speaking);
    }
    _pulse = 0.5;
  }

  /// Best-effort caption parsing from a Daily app-message. The exact schema
  /// depends on the pipeline, so we probe a few shapes and never throw — if none
  /// match, captions simply stay empty in live mode.
  void _applyCaption(String raw) {
    if (raw.isEmpty) return;
    // App-messages arrive as JSON strings; pull any text-ish field out.
    final text = _extractText(raw);
    if (text != null && text.trim().isNotEmpty) {
      state = state.copyWith(caption: text.trim());
    }
  }

  String? _extractText(String raw) {
    // Cheap, dependency-free probe: look for "text"/"transcript"/"content"
    // string values without a full JSON parse dependency chain.
    for (final key in const ["text", "transcript", "content"]) {
      final marker = '"$key"';
      final at = raw.indexOf(marker);
      if (at < 0) continue;
      final colon = raw.indexOf(":", at + marker.length);
      if (colon < 0) continue;
      final firstQuote = raw.indexOf('"', colon + 1);
      if (firstQuote < 0) continue;
      final endQuote = raw.indexOf('"', firstQuote + 1);
      if (endQuote < 0) continue;
      final value = raw.substring(firstQuote + 1, endQuote);
      if (value.isNotEmpty) return value;
    }
    return null;
  }

  // ---- Amplitude envelope ----------------------------------------------

  void _startEnvelope() {
    _envelope?.cancel();
    var tick = 0;
    _envelope = Timer.periodic(const Duration(milliseconds: 90), (_) {
      tick++;
      final target = switch (state.phase) {
        JarvisLivePhase.speaking => 0.34 +
            0.18 * math.sin(tick * 0.7).abs() +
            0.12 * math.sin(tick * 1.9 + 1.0).abs() +
            _rand.nextDouble() * 0.08,
        JarvisLivePhase.listening => 0.22 +
            0.14 * math.sin(tick * 0.9).abs() +
            _rand.nextDouble() * 0.06,
        JarvisLivePhase.thinking => 0.16,
        JarvisLivePhase.connecting => 0.12 + 0.06 * math.sin(tick * 0.5).abs(),
        JarvisLivePhase.idle => 0.05,
        JarvisLivePhase.ended => 0.0,
      };
      // Ease toward the target + fold in a decaying turn-boundary pulse.
      _amp += (target + _pulse - _amp) * 0.35;
      _amp = _amp.clamp(0.0, 1.0);
      _pulse *= 0.7;
      state = state.copyWith(amplitude: _amp);
    });
  }

  void _stopEnvelope() {
    _envelope?.cancel();
    _envelope = null;
    _amp = 0;
    _pulse = 0;
    if (state.active) {
      state = state.copyWith(amplitude: 0);
    }
  }

  void _fail(String message) {
    _stopEnvelope();
    state = state.copyWith(
      phase: JarvisLivePhase.ended,
      connection: JarvisLiveConnection.error,
      notice: message,
    );
  }

  Future<void> _disposeCall() async {
    final sub = _events;
    _events = null;
    try {
      await sub?.cancel();
    } catch (_) {}
    final call = _call;
    _call = null;
    if (call != null) {
      try {
        await call.leave();
      } catch (_) {}
      try {
        await call.dispose();
      } catch (_) {}
    }
  }

  void _teardown() {
    _generation++;
    _settleTimer?.cancel();
    _pendingPoll?.cancel();
    _envelope?.cancel();
    unawaited(_disposeCall());
    if (_callId.isNotEmpty) {
      unawaited(_repo.stop(_callId));
      _callId = "";
    }
  }
}

final jarvisRealtimeVoiceControllerProvider =
    NotifierProvider<JarvisRealtimeVoiceController, JarvisLiveState>(
  JarvisRealtimeVoiceController.new,
);
