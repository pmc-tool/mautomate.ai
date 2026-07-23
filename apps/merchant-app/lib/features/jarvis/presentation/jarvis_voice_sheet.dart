import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../application/jarvis_realtime_voice_controller.dart";
import "../application/jarvis_voice_controller.dart";
import "../data/jarvis_models.dart";
import "widgets/confirm_card.dart";
import "widgets/jarvis_orb.dart";

/// Which voice engine the sheet is running.
enum _VoiceMode {
  /// On-device speech + TTS (the default). Works offline-ish, light on
  /// resources, no server voice — the merchant taps to talk.
  onDevice,

  /// Premium real-time voice over Daily → the same pipecat pipeline the web
  /// uses. Full-duplex (barge-in), the orb reacts to the real bot — needs a
  /// connection and more resources.
  live,
}

/// The immersive voice mode — "talk to your shop".
///
/// A focused, dark overlay built around the living [JarvisOrb]. Two engines
/// share the same orb + surface:
///  - ON-DEVICE (default): [JarvisVoiceController] transcribes on the device and
///    runs the same text path as typing; the orb reacts to the mic while
///    listening and to the reply while Jarvis speaks. Tap to talk, tap to
///    interrupt.
///  - LIVE: [JarvisRealtimeVoiceController] joins the real-time Daily pipeline;
///    it's continuous + full-duplex (just talk, barge-in works), the bot's voice
///    plays natively, and the orb follows the real turn-taking.
///
/// On-device is the default + the fallback (it needs no connectivity); Live is a
/// deliberate choice via the toggle. Every failure mode — permission, no speech,
/// no connection — lands on clear guidance, never a dead mic.
class JarvisVoiceSheet extends ConsumerStatefulWidget {
  const JarvisVoiceSheet._();

  /// Opens the voice sheet as a full-screen overlay.
  static Future<void> show(BuildContext context) {
    return showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierLabel: "Jarvis voice",
      barrierColor: const Color(0xCC05070A),
      transitionDuration: const Duration(milliseconds: 240),
      pageBuilder: (_, __, ___) => const JarvisVoiceSheet._(),
      transitionBuilder: (context, anim, _, child) {
        final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
        return FadeTransition(opacity: curved, child: child);
      },
    );
  }

  @override
  ConsumerState<JarvisVoiceSheet> createState() => _JarvisVoiceSheetState();
}

class _JarvisVoiceSheetState extends ConsumerState<JarvisVoiceSheet> {
  _VoiceMode _mode = _VoiceMode.onDevice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    // Default engine is on-device — start it listening straight away.
    final controller = ref.read(jarvisVoiceControllerProvider.notifier);
    await controller.ensureReady();
    if (!mounted || _mode != _VoiceMode.onDevice) return;
    final s = ref.read(jarvisVoiceControllerProvider);
    if (s.block == JarvisVoiceBlock.none) {
      HapticFeedback.selectionClick();
      controller.startListening();
    }
  }

  @override
  void dispose() {
    // Release both engines when the sheet leaves.
    ref.read(jarvisVoiceControllerProvider.notifier).close();
    ref.read(jarvisRealtimeVoiceControllerProvider.notifier).stop();
    super.dispose();
  }

  Future<void> _selectMode(_VoiceMode mode) async {
    if (mode == _mode) return;
    HapticFeedback.selectionClick();

    if (mode == _VoiceMode.live) {
      // Hand the mic from on-device to the live pipeline.
      await ref.read(jarvisVoiceControllerProvider.notifier).close();
      if (!mounted) return;
      setState(() => _mode = _VoiceMode.live);
      ref.read(jarvisRealtimeVoiceControllerProvider.notifier).start();
    } else {
      await ref.read(jarvisRealtimeVoiceControllerProvider.notifier).stop();
      if (!mounted) return;
      setState(() => _mode = _VoiceMode.onDevice);
      final controller = ref.read(jarvisVoiceControllerProvider.notifier);
      await controller.ensureReady();
      if (!mounted || _mode != _VoiceMode.onDevice) return;
      final s = ref.read(jarvisVoiceControllerProvider);
      if (s.block == JarvisVoiceBlock.none) {
        controller.startListening();
      }
    }
  }

  // ---- on-device controls ----------------------------------------------

  void _onDevicePrimary() {
    final controller = ref.read(jarvisVoiceControllerProvider.notifier);
    final s = ref.read(jarvisVoiceControllerProvider);
    switch (s.phase) {
      case JarvisVoicePhase.idle:
        HapticFeedback.mediumImpact();
        controller.startListening();
      case JarvisVoicePhase.listening:
        HapticFeedback.mediumImpact();
        controller.stopListening();
      case JarvisVoicePhase.speaking:
        HapticFeedback.selectionClick();
        controller.startListening(); // barge-in
      case JarvisVoicePhase.thinking:
        break; // working — nothing to do
    }
  }

  void _retryAfterBlock() {
    final controller = ref.read(jarvisVoiceControllerProvider.notifier);
    controller.clearBlock();
    controller.startListening();
  }

  // ---- live controls ----------------------------------------------------

  void _liveMic() {
    HapticFeedback.selectionClick();
    ref.read(jarvisRealtimeVoiceControllerProvider.notifier).toggleMic();
  }

  void _liveReconnect() {
    HapticFeedback.mediumImpact();
    final controller = ref.read(jarvisRealtimeVoiceControllerProvider.notifier);
    controller.clearBlock();
    controller.stop().then((_) {
      if (mounted && _mode == _VoiceMode.live) controller.start();
    });
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final orbSize = (media.size.shortestSide * 0.62).clamp(200.0, 300.0);

    return Material(
      type: MaterialType.transparency,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            children: [
              _TopBar(onClose: () => Navigator.of(context).maybePop()),
              const Gap(AppSpacing.lg),
              _ModeToggle(mode: _mode, onSelect: _selectMode),
              const Spacer(),
              if (_mode == _VoiceMode.onDevice)
                ..._buildOnDevice(context, orbSize)
              else
                ..._buildLive(context, orbSize),
              const Gap(AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildOnDevice(BuildContext context, double orbSize) {
    final s = ref.watch(jarvisVoiceControllerProvider);
    return [
      JarvisOrb(
        state: _nativeOrbState(s.phase),
        amplitude: s.amplitude,
        size: orbSize,
      ),
      const Gap(AppSpacing.xl),
      _StatusLabel(phase: s.phase),
      const Gap(AppSpacing.md),
      _TranscriptOrNotice(state: s),
      const Spacer(),
      if (s.block != JarvisVoiceBlock.none)
        _BlockedControl(
          block: s.block,
          onRetry: _retryAfterBlock,
          onClose: () => Navigator.of(context).maybePop(),
        )
      else
        _PrimaryControl(phase: s.phase, onTap: _onDevicePrimary),
    ];
  }

  List<Widget> _buildLive(BuildContext context, double orbSize) {
    final s = ref.watch(jarvisRealtimeVoiceControllerProvider);
    return [
      JarvisOrb(
        state: _liveOrbState(s.phase),
        amplitude: s.amplitude,
        size: orbSize,
      ),
      const Gap(AppSpacing.xl),
      _LiveStatusLabel(state: s),
      const Gap(AppSpacing.md),
      _LiveCaptionOrNotice(state: s),
      if (s.pending.any((c) => c.status != ConfirmStatus.dismissed)) ...[
        const Gap(AppSpacing.lg),
        _LivePendingConfirms(
          pending: s.pending,
          onConfirm: (c, t) => ref
              .read(jarvisRealtimeVoiceControllerProvider.notifier)
              .applyPending(c, t),
          onDismiss: (c) => ref
              .read(jarvisRealtimeVoiceControllerProvider.notifier)
              .dismissPending(c.token),
          onUndo: (c) => ref
              .read(jarvisRealtimeVoiceControllerProvider.notifier)
              .applyPendingUndo(c),
        ),
      ],
      const Spacer(),
      _LiveControl(
        state: s,
        onMic: _liveMic,
        onReconnect: _liveReconnect,
        onClose: () => Navigator.of(context).maybePop(),
      ),
    ];
  }

  JarvisOrbState _nativeOrbState(JarvisVoicePhase p) => switch (p) {
        JarvisVoicePhase.listening => JarvisOrbState.listening,
        JarvisVoicePhase.thinking => JarvisOrbState.thinking,
        JarvisVoicePhase.speaking => JarvisOrbState.speaking,
        JarvisVoicePhase.idle => JarvisOrbState.idle,
      };

  JarvisOrbState _liveOrbState(JarvisLivePhase p) => switch (p) {
        JarvisLivePhase.connecting => JarvisOrbState.thinking,
        JarvisLivePhase.listening => JarvisOrbState.listening,
        JarvisLivePhase.thinking => JarvisOrbState.thinking,
        JarvisLivePhase.speaking => JarvisOrbState.speaking,
        JarvisLivePhase.idle => JarvisOrbState.idle,
        JarvisLivePhase.ended => JarvisOrbState.idle,
      };
}

const Color _onDark = Color(0xFFE7EAEE);
const Color _onDarkMuted = Color(0xFF9BA3AF);
const Color _liveTrack = Color(0xFF1B212B);

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Row(
          children: [
            Icon(PhosphorIconsFill.sparkle,
                size: 16, color: AppColors.emberBase),
            const Gap(AppSpacing.sm),
            const Text(
              "Talk to Jarvis",
              style: TextStyle(
                color: _onDark,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const Spacer(),
        Semantics(
          button: true,
          label: "Close voice",
          child: IconButton(
            onPressed: onClose,
            iconSize: 24,
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            icon: const Icon(PhosphorIconsRegular.x, color: _onDarkMuted),
          ),
        ),
      ],
    );
  }
}

/// The engine switch: On-device (default) vs Live real-time.
class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.mode, required this.onSelect});

  final _VoiceMode mode;
  final ValueChanged<_VoiceMode> onSelect;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: "Voice engine",
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: _liveTrack,
          borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
          border: Border.all(color: const Color(0xFF283039)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ModeChip(
              icon: PhosphorIconsRegular.deviceMobile,
              label: "On-device",
              selected: mode == _VoiceMode.onDevice,
              onTap: () => onSelect(_VoiceMode.onDevice),
            ),
            _ModeChip(
              icon: PhosphorIconsFill.broadcast,
              label: "Live",
              selected: mode == _VoiceMode.live,
              onTap: () => onSelect(_VoiceMode.live),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Material(
        color: selected ? AppColors.emberBase : Colors.transparent,
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        child: InkWell(
          borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
          onTap: selected ? null : onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    icon,
                    size: 16,
                    color: selected ? Colors.white : _onDarkMuted,
                  ),
                  const Gap(AppSpacing.sm),
                  Text(
                    label,
                    style: TextStyle(
                      color: selected ? Colors.white : _onDarkMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusLabel extends StatelessWidget {
  const _StatusLabel({required this.phase});

  final JarvisVoicePhase phase;

  @override
  Widget build(BuildContext context) {
    final (text, muted) = switch (phase) {
      JarvisVoicePhase.idle => ("Tap to talk", true),
      JarvisVoicePhase.listening => ("Listening", false),
      JarvisVoicePhase.thinking => ("Working on it", false),
      JarvisVoicePhase.speaking => ("Speaking", false),
    };
    return _StatusText(text: text, muted: muted);
  }
}

class _LiveStatusLabel extends StatelessWidget {
  const _LiveStatusLabel({required this.state});

  final JarvisLiveState state;

  @override
  Widget build(BuildContext context) {
    final (text, muted) = switch (state.connection) {
      JarvisLiveConnection.error => ("Couldn't connect", false),
      JarvisLiveConnection.reconnecting => ("Reconnecting", false),
      _ => switch (state.phase) {
          JarvisLivePhase.connecting => ("Connecting", false),
          JarvisLivePhase.listening => ("Listening", false),
          JarvisLivePhase.thinking => ("Working on it", false),
          JarvisLivePhase.speaking => ("Jarvis", false),
          JarvisLivePhase.idle => ("Just talk", true),
          JarvisLivePhase.ended => ("Ended", true),
        },
    };
    return _StatusText(text: text, muted: muted);
  }
}

class _StatusText extends StatelessWidget {
  const _StatusText({required this.text, required this.muted});

  final String text;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Text(
        text,
        style: TextStyle(
          color: muted ? _onDarkMuted : _onDark,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _TranscriptOrNotice extends StatelessWidget {
  const _TranscriptOrNotice({required this.state});

  final JarvisVoiceState state;

  @override
  Widget build(BuildContext context) {
    final notice = state.notice;
    if (notice != null && notice.isNotEmpty) {
      return _NoticePill(text: notice);
    }
    final transcript = state.transcript.trim();
    return _CaptionText(
      text: transcript.isEmpty
          ? (state.phase == JarvisVoicePhase.listening
              ? "Go ahead, I'm listening."
              : "")
          : transcript,
      muted: transcript.isEmpty,
    );
  }
}

class _LiveCaptionOrNotice extends StatelessWidget {
  const _LiveCaptionOrNotice({required this.state});

  final JarvisLiveState state;

  @override
  Widget build(BuildContext context) {
    final notice = state.notice;
    if (notice != null && notice.isNotEmpty) {
      return _NoticePill(text: notice);
    }
    final caption = state.caption.trim();
    final placeholder = switch (state.phase) {
      JarvisLivePhase.connecting => "Connecting you to Jarvis…",
      JarvisLivePhase.idle => "Connected — just talk.",
      _ => "",
    };
    return _CaptionText(
      text: caption.isEmpty ? placeholder : caption,
      muted: caption.isEmpty,
    );
  }
}

class _NoticePill extends StatelessWidget {
  const _NoticePill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AppColors.emberBase.withValues(alpha: 0.14),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.emberBase.withValues(alpha: 0.35)),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(color: _onDark, fontSize: 14, height: 1.4),
      ),
    );
  }
}

class _CaptionText extends StatelessWidget {
  const _CaptionText({required this.text, required this.muted});

  final String text;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: muted ? _onDarkMuted : _onDark,
          fontSize: 17,
          height: 1.4,
        ),
      ),
    );
  }
}

/// The single big control for on-device mode. Its icon/label follow the phase;
/// tapping while speaking barges in.
class _PrimaryControl extends StatelessWidget {
  const _PrimaryControl({required this.phase, required this.onTap});

  final JarvisVoicePhase phase;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final thinking = phase == JarvisVoicePhase.thinking;
    final listening = phase == JarvisVoicePhase.listening;

    final (icon, label, semantic) = switch (phase) {
      JarvisVoicePhase.idle => (
          PhosphorIconsFill.microphone,
          "Tap to talk",
          "Start talking",
        ),
      JarvisVoicePhase.listening => (
          PhosphorIconsFill.check,
          "Done",
          "Finish and send",
        ),
      JarvisVoicePhase.speaking => (
          PhosphorIconsFill.microphone,
          "Tap to interrupt",
          "Interrupt and talk",
        ),
      JarvisVoicePhase.thinking => (
          PhosphorIconsRegular.circleNotch,
          "Working",
          "Jarvis is working",
        ),
    };

    return _BigButton(
      icon: icon,
      label: label,
      semantic: semantic,
      filled: !listening,
      busy: thinking,
      onTap: thinking ? null : onTap,
    );
  }
}

/// The live-mode control: mute/unmute while connected, a spinner while
/// connecting, a reconnect action on error, and the blocked state on a mic
/// denial.
class _LiveControl extends StatelessWidget {
  const _LiveControl({
    required this.state,
    required this.onMic,
    required this.onReconnect,
    required this.onClose,
  });

  final JarvisLiveState state;
  final VoidCallback onMic;
  final VoidCallback onReconnect;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    if (state.block == JarvisLiveBlock.micDenied) {
      return _BlockedControl(
        block: JarvisVoiceBlock.micDenied,
        onRetry: onReconnect,
        onClose: onClose,
      );
    }

    if (state.connection == JarvisLiveConnection.error ||
        state.phase == JarvisLivePhase.ended) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _BigButton(
            icon: PhosphorIconsRegular.arrowClockwise,
            label: "Reconnect",
            semantic: "Reconnect to Jarvis",
            filled: true,
            busy: false,
            onTap: onReconnect,
          ),
        ],
      );
    }

    final connecting = state.phase == JarvisLivePhase.connecting &&
        state.connection != JarvisLiveConnection.connected;
    if (connecting) {
      return _BigButton(
        icon: PhosphorIconsRegular.circleNotch,
        label: "Connecting",
        semantic: "Connecting to Jarvis",
        filled: true,
        busy: true,
        onTap: null,
      );
    }

    // Connected: the mic mutes / un-mutes the live audio.
    final live = state.micLive;
    return _BigButton(
      icon: live
          ? PhosphorIconsFill.microphone
          : PhosphorIconsFill.microphoneSlash,
      label: live ? "Mute" : "Unmute",
      semantic: live ? "Mute microphone" : "Unmute microphone",
      filled: !live,
      busy: false,
      onTap: onMic,
    );
  }
}

/// A shared big round control used by both engines — a filled (white) or ember
/// state with an optional busy spinner.
class _BigButton extends StatelessWidget {
  const _BigButton({
    required this.icon,
    required this.label,
    required this.semantic,
    required this.filled,
    required this.busy,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String semantic;

  /// True = white surface (idle/ready); false = ember surface (active/live).
  final bool filled;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: onTap != null,
          label: semantic,
          child: Opacity(
            opacity: busy ? 0.7 : 1.0,
            child: Material(
              color: filled ? Colors.white : AppColors.emberBase,
              shape: const CircleBorder(),
              elevation: 0,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: busy ? null : onTap,
                child: SizedBox(
                  width: 76,
                  height: 76,
                  child: busy
                      ? Padding(
                          padding: const EdgeInsets.all(26),
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              filled ? const Color(0xFF0F1319) : Colors.white,
                            ),
                          ),
                        )
                      : Icon(
                          icon,
                          size: 30,
                          color: filled
                              ? const Color(0xFF0F1319)
                              : Colors.white,
                        ),
                ),
              ),
            ),
          ),
        ),
        const Gap(AppSpacing.md),
        Text(
          label,
          style: const TextStyle(
            color: _onDarkMuted,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

/// Replaces the control when voice can't run — clear guidance + an action.
class _BlockedControl extends StatelessWidget {
  const _BlockedControl({
    required this.block,
    required this.onRetry,
    required this.onClose,
  });

  final JarvisVoiceBlock block;
  final VoidCallback onRetry;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final denied = block == JarvisVoiceBlock.micDenied;
    final title =
        denied ? "Microphone access is off" : "Voice isn't available here";
    final body = denied
        ? "Turn on microphone access for mAutomate in your device Settings, then try again. You can always type to Jarvis instead."
        : "This device doesn't offer on-device speech. You can still type to Jarvis — everything else works the same.";

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          denied
              ? PhosphorIconsRegular.microphoneSlash
              : PhosphorIconsRegular.warningCircle,
          size: 28,
          color: AppColors.emberBase,
        ),
        const Gap(AppSpacing.md),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: _onDark,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const Gap(AppSpacing.sm),
        Text(
          body,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: _onDarkMuted,
            fontSize: 14,
            height: 1.45,
          ),
        ),
        const Gap(AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (denied) ...[
              _DarkButton(label: "Try again", filled: true, onTap: onRetry),
              const Gap(AppSpacing.md),
            ],
            _DarkButton(
              label: "Type instead",
              filled: !denied,
              onTap: onClose,
            ),
          ],
        ),
      ],
    );
  }
}

/// A compact button styled for the dark voice surface (the design-system
/// buttons are theme-surfaced; this overlay is always dark).
class _DarkButton extends StatelessWidget {
  const _DarkButton({
    required this.label,
    required this.filled,
    required this.onTap,
  });

  final String label;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: filled ? Colors.white : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: filled
              ? BorderSide.none
              : const BorderSide(color: Color(0xFF333B47)),
        ),
        child: InkWell(
          borderRadius: AppRadius.mdAll,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              child: Text(
                label,
                style: TextStyle(
                  color: filled ? const Color(0xFF0F1319) : _onDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}


/// The voice confirm gate: writes Jarvis proposed over the live call, rendered
/// with the same [ConfirmCard] as chat so a soft one-tap or a typed hard confirm
/// works identically. Approving routes through POST /merchant/jarvis/apply.
class _LivePendingConfirms extends StatelessWidget {
  const _LivePendingConfirms({
    required this.pending,
    required this.onConfirm,
    required this.onDismiss,
    required this.onUndo,
  });

  final List<JarvisConfirm> pending;
  final void Function(JarvisConfirm confirm, String typed) onConfirm;
  final void Function(JarvisConfirm confirm) onDismiss;
  final void Function(JarvisConfirm confirm) onUndo;

  @override
  Widget build(BuildContext context) {
    final visible = pending
        .where((c) => c.status != ConfirmStatus.dismissed)
        .toList(growable: false);
    if (visible.isEmpty) return const SizedBox.shrink();
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 300),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: AppSpacing.xs),
            child: Text(
              "Approve to continue",
              style: TextStyle(
                color: _onDarkMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final c in visible)
                    ConfirmCard(
                      confirm: c,
                      onConfirm: (typed) => onConfirm(c, typed),
                      onDismiss: () => onDismiss(c),
                      onUndo: () => onUndo(c),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
