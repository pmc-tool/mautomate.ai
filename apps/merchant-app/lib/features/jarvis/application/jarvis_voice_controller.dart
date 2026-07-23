import "dart:async";
import "dart:math" as math;

import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_tts/flutter_tts.dart";
import "package:speech_to_text/speech_recognition_error.dart";
import "package:speech_to_text/speech_recognition_result.dart";
import "package:speech_to_text/speech_to_text.dart";

import "../data/jarvis_models.dart";
import "jarvis_chat_controller.dart";

/// What the voice loop is doing right now — drives the orb + the sheet labels.
enum JarvisVoicePhase {
  /// Nothing active; ready for a tap.
  idle,

  /// Capturing speech from the microphone.
  listening,

  /// The transcript was sent; waiting on Jarvis to finish its run.
  thinking,

  /// Reading the reply aloud.
  speaking,
}

/// A hard blocker the merchant must resolve before voice can work. Distinct from
/// a transient [JarvisVoiceState.notice] because it needs guidance + an action.
enum JarvisVoiceBlock {
  /// No blocker.
  none,

  /// Microphone / speech permission was refused.
  micDenied,

  /// This device has no on-device speech recognition.
  unsupported,
}

/// Immutable state for the Jarvis voice loop.
class JarvisVoiceState {
  const JarvisVoiceState({
    this.phase = JarvisVoicePhase.idle,
    this.amplitude = 0,
    this.transcript = "",
    this.notice,
    this.block = JarvisVoiceBlock.none,
    this.ready = false,
  });

  /// The current activity.
  final JarvisVoicePhase phase;

  /// Live intensity 0..1 — mic level while listening, speech envelope while
  /// speaking. Fed straight to the orb.
  final double amplitude;

  /// The live (partial) transcript while listening, then the final utterance.
  final String transcript;

  /// A transient, friendly message (e.g. "I didn't hear anything").
  final String? notice;

  /// A hard blocker needing merchant action.
  final JarvisVoiceBlock block;

  /// True once speech recognition initialized successfully.
  final bool ready;

  bool get isListening => phase == JarvisVoicePhase.listening;
  bool get isSpeaking => phase == JarvisVoicePhase.speaking;
  bool get isThinking => phase == JarvisVoicePhase.thinking;

  static const Object _keep = Object();

  JarvisVoiceState copyWith({
    JarvisVoicePhase? phase,
    double? amplitude,
    String? transcript,
    Object? notice = _keep,
    JarvisVoiceBlock? block,
    bool? ready,
  }) {
    return JarvisVoiceState(
      phase: phase ?? this.phase,
      amplitude: amplitude ?? this.amplitude,
      transcript: transcript ?? this.transcript,
      notice: identical(notice, _keep) ? this.notice : notice as String?,
      block: block ?? this.block,
      ready: ready ?? this.ready,
    );
  }
}

/// Drives the on-device voice loop for Jarvis — "talk to your shop".
///
/// The native path uses no server voice: `speech_to_text` transcribes on-device,
/// the final utterance is handed to the existing [JarvisChatController] (the same
/// text SSE path as typing), and when the reply finalizes `flutter_tts` reads it
/// back. The orb reacts to a normalized mic level while listening and to a
/// synthesized speech envelope while speaking.
///
/// Barge-in: [startListening] always stops any in-flight speech first, so a tap
/// to talk interrupts Jarvis. Every failure mode — permission denied, no speech,
/// or a device with no recognizer — lands on a clear state, never a dead mic.
class JarvisVoiceController extends Notifier<JarvisVoiceState> {
  final SpeechToText _speech = SpeechToText();
  final FlutterTts _tts = FlutterTts();
  final math.Random _rand = math.Random();

  bool _initStarted = false;
  bool _sttAvailable = false;

  // One listen session's guards.
  bool _sessionSubmitted = false;

  // Reply plumbing: only voice turns should be spoken back.
  bool _awaitingReply = false;

  // Speaking envelope.
  Timer? _speakTimer;
  double _pulse = 0;
  bool _spokeSettled = false;

  // Adaptive mic-level normalization (device units differ: iOS dB, Android raw).
  double _minLevel = double.infinity;
  double _maxLevel = double.negativeInfinity;
  double _micAmp = 0;

  @override
  JarvisVoiceState build() {
    // Speak the reply once a voice-initiated run finishes.
    ref.listen<JarvisChatState>(jarvisChatControllerProvider, _onChatChanged);
    ref.onDispose(_teardown);
    return const JarvisVoiceState();
  }

  /// Lazily initializes the STT engine + TTS handlers. Safe to call repeatedly;
  /// only the first call does work. Call when the voice sheet opens.
  Future<void> ensureReady() async {
    if (_initStarted) return;
    _initStarted = true;

    await _tts.awaitSpeakCompletion(true);
    try {
      await _tts.setLanguage("en-US");
      await _tts.setSpeechRate(0.5);
      await _tts.setPitch(1.0);
      await _tts.setVolume(1.0);
    } catch (_) {
      // Non-fatal: TTS still speaks with engine defaults.
    }
    _tts.setStartHandler(() {});
    _tts.setCompletionHandler(_onSpeakSettled);
    _tts.setCancelHandler(_onSpeakSettled);
    _tts.setErrorHandler((_) => _onSpeakSettled());
    _tts.setProgressHandler((_, __, ___, ____) => _speechPulse());

    try {
      _sttAvailable = await _speech.initialize(
        onStatus: _onSttStatus,
        onError: _onSttError,
      );
    } catch (_) {
      _sttAvailable = false;
    }

    if (_sttAvailable) {
      state = state.copyWith(ready: true, block: JarvisVoiceBlock.none);
    } else {
      state = state.copyWith(
        ready: false,
        block: JarvisVoiceBlock.unsupported,
      );
    }
  }

  /// Begins listening. Barges in on any active speech first. No-op while already
  /// listening or thinking.
  Future<void> startListening() async {
    await ensureReady();
    if (state.isListening || state.isThinking) return;

    if (!_sttAvailable) {
      state = state.copyWith(block: JarvisVoiceBlock.unsupported);
      return;
    }

    await _stopSpeaking(); // barge-in
    _resetLevels();
    _sessionSubmitted = false;
    state = state.copyWith(
      phase: JarvisVoicePhase.listening,
      transcript: "",
      amplitude: 0,
      notice: null,
      block: JarvisVoiceBlock.none,
    );

    try {
      await _speech.listen(
        onResult: _onResult,
        onSoundLevelChange: _onSoundLevel,
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: true,
          listenMode: ListenMode.dictation,
          listenFor: const Duration(seconds: 30),
          pauseFor: const Duration(seconds: 3),
        ),
      );
    } catch (_) {
      state = state.copyWith(
        phase: JarvisVoicePhase.idle,
        amplitude: 0,
        notice: "Couldn't start listening. Tap to try again.",
      );
      return;
    }

    // If the OS refused the mic, initialize()/listen() won't have permission.
    if (!await _speech.hasPermission) {
      state = state.copyWith(
        phase: JarvisVoicePhase.idle,
        amplitude: 0,
        block: JarvisVoiceBlock.micDenied,
      );
    }
  }

  /// Finalizes the current utterance (the merchant tapped "Done"). The engine
  /// emits a final result, which is submitted through [_onSttStatus].
  Future<void> stopListening() async {
    if (!state.isListening) return;
    await _speech.stop();
  }

  /// Abandons the current listen/speak without sending anything.
  Future<void> cancel() async {
    _sessionSubmitted = true;
    _awaitingReply = false;
    await _speech.cancel();
    await _stopSpeaking();
    state = state.copyWith(
      phase: JarvisVoicePhase.idle,
      amplitude: 0,
      transcript: "",
      notice: null,
    );
  }

  /// Called when the voice sheet closes — release the mic and silence TTS.
  Future<void> close() async {
    _awaitingReply = false;
    _sessionSubmitted = true;
    await _speech.cancel();
    await _stopSpeaking();
    state = state.copyWith(
      phase: JarvisVoicePhase.idle,
      amplitude: 0,
      notice: null,
    );
  }

  /// Clears a resolved blocker so the merchant can retry (e.g. after granting
  /// the mic permission in Settings).
  void clearBlock() {
    state = state.copyWith(block: JarvisVoiceBlock.none, notice: null);
  }

  // ---- STT callbacks ----------------------------------------------------

  void _onResult(SpeechRecognitionResult result) {
    if (!state.isListening) return;
    state = state.copyWith(transcript: result.recognizedWords);
    if (result.finalResult) {
      _submit(result.recognizedWords);
    }
  }

  void _onSttStatus(String status) {
    // The engine stopped on its own (pause timeout / done) — finalize whatever
    // we heard so the merchant never gets a silent dead-end.
    if (status == "done" || status == "notListening") {
      if (state.isListening && !_sessionSubmitted) {
        final heard = state.transcript.trim();
        if (heard.isNotEmpty) {
          _submit(heard);
        } else {
          _noSpeech();
        }
      }
    }
  }

  void _onSttError(SpeechRecognitionError error) {
    final msg = error.errorMsg.toLowerCase();
    if (msg.contains("permission") || msg.contains("denied")) {
      state = state.copyWith(
        phase: JarvisVoicePhase.idle,
        amplitude: 0,
        block: JarvisVoiceBlock.micDenied,
      );
      return;
    }
    if (msg.contains("no_match") ||
        msg.contains("speech_timeout") ||
        msg.contains("no_speech")) {
      _noSpeech();
      return;
    }
    // Transient (network/busy). Only surface if we were mid-listen.
    if (state.isListening) {
      state = state.copyWith(
        phase: JarvisVoicePhase.idle,
        amplitude: 0,
        notice: "I didn't catch that. Tap to try again.",
      );
    }
  }

  void _onSoundLevel(double level) {
    if (!state.isListening) return;
    _minLevel = math.min(_minLevel, level);
    _maxLevel = math.max(_maxLevel, level);
    final range = _maxLevel - _minLevel;
    final norm = range > 0.5 ? (level - _minLevel) / range : 0.0;
    _micAmp += (norm.clamp(0.0, 1.0) - _micAmp) * 0.5;
    state = state.copyWith(amplitude: _micAmp.clamp(0.0, 1.0));
  }

  // ---- Submit + reply ---------------------------------------------------

  void _submit(String text) {
    if (_sessionSubmitted) return;
    _sessionSubmitted = true;
    final utterance = text.trim();
    if (utterance.isEmpty) {
      _noSpeech();
      return;
    }
    unawaited(_speech.stop());
    _awaitingReply = true;
    state = state.copyWith(
      phase: JarvisVoicePhase.thinking,
      transcript: utterance,
      amplitude: 0,
      notice: null,
    );
    ref.read(jarvisChatControllerProvider.notifier).send(utterance);
  }

  void _noSpeech() {
    unawaited(_speech.stop());
    _micAmp = 0;
    state = state.copyWith(
      phase: JarvisVoicePhase.idle,
      amplitude: 0,
      notice: "I didn't hear anything. Tap the mic and speak.",
    );
  }

  void _onChatChanged(JarvisChatState? prev, JarvisChatState next) {
    if (!_awaitingReply) return;
    final wasBusy = prev?.busy ?? false;
    if (!(wasBusy && !next.busy)) return; // only on busy -> idle
    _awaitingReply = false;

    final last = next.messages.isNotEmpty ? next.messages.last : null;
    if (last == null || last.role != ChatRole.assistant) {
      state = state.copyWith(phase: JarvisVoicePhase.idle);
      return;
    }
    final speech = _replyToSpeak(last);
    if (speech == null || speech.isEmpty) {
      state = state.copyWith(phase: JarvisVoicePhase.idle);
    } else {
      unawaited(_speak(speech));
    }
  }

  /// Chooses what Jarvis should say out loud. Writes are never spoken as if
  /// done — a pending confirm is described and the merchant is sent to the card.
  String? _replyToSpeak(ChatMessage m) {
    if (m.error != null && m.error!.trim().isNotEmpty) {
      return m.error!.trim();
    }
    final text = (m.text ?? "").trim();
    final pending =
        m.confirms.where((c) => c.status == ConfirmStatus.pending).toList();
    if (text.isNotEmpty) {
      if (pending.isNotEmpty) {
        return "$text I've prepared that change on screen for you to review.";
      }
      return text;
    }
    if (pending.isNotEmpty) {
      return "${pending.first.summary}. Review it on screen to approve.";
    }
    return null;
  }

  // ---- TTS + speaking envelope -----------------------------------------

  Future<void> _speak(String text) async {
    _spokeSettled = false;
    state = state.copyWith(
      phase: JarvisVoicePhase.speaking,
      amplitude: 0.2,
      notice: null,
    );
    _startSpeechEnvelope();
    try {
      await _tts.speak(_sanitizeForSpeech(text));
    } catch (_) {
      // fall through to settle
    }
    // With awaitSpeakCompletion(true) this resolves when done; the handler may
    // also fire — _onSpeakSettled is idempotent.
    _onSpeakSettled();
  }

  void _startSpeechEnvelope() {
    _speakTimer?.cancel();
    var tick = 0;
    _speakTimer = Timer.periodic(const Duration(milliseconds: 90), (_) {
      tick++;
      final base = 0.32 +
          0.14 * math.sin(tick * 0.7) +
          0.10 * math.sin(tick * 1.9 + 1.0);
      final jitter = _rand.nextDouble() * 0.08;
      final amp = (base + jitter + _pulse).clamp(0.12, 1.0);
      _pulse *= 0.72; // decay word-boundary pulses
      state = state.copyWith(amplitude: amp);
    });
  }

  void _speechPulse() {
    _pulse = 0.35;
  }

  void _onSpeakSettled() {
    if (_spokeSettled) return;
    _spokeSettled = true;
    _speakTimer?.cancel();
    _speakTimer = null;
    _pulse = 0;
    if (state.isSpeaking) {
      state = state.copyWith(phase: JarvisVoicePhase.idle, amplitude: 0);
    }
  }

  Future<void> _stopSpeaking() async {
    _speakTimer?.cancel();
    _speakTimer = null;
    _pulse = 0;
    _spokeSettled = true;
    try {
      await _tts.stop();
    } catch (_) {
      // ignore
    }
  }

  /// Strips light markdown so it isn't read out as literal symbols.
  String _sanitizeForSpeech(String text) {
    return text
        // Markdown links → just the visible label.
        .replaceAllMapped(
          RegExp(r"\[(.*?)\]\((.*?)\)"),
          (m) => m.group(1) ?? "",
        )
        .replaceAll(RegExp(r"[*_`#>]"), "")
        .replaceAll(RegExp(r"\s+"), " ")
        .trim();
  }

  void _resetLevels() {
    _minLevel = double.infinity;
    _maxLevel = double.negativeInfinity;
    _micAmp = 0;
  }

  void _teardown() {
    _speakTimer?.cancel();
    try {
      _speech.cancel();
    } catch (_) {}
    try {
      _tts.stop();
    } catch (_) {}
  }
}

final jarvisVoiceControllerProvider =
    NotifierProvider<JarvisVoiceController, JarvisVoiceState>(
  JarvisVoiceController.new,
);
