import "dart:math" as math;
import "dart:ui" as ui;

import "package:flutter/material.dart";
import "package:flutter/scheduler.dart";

/// What the orb is doing right now. Drives motion speed, glow intensity and the
/// iridescent accent — mirrors the web stage's four states.
enum JarvisOrbState {
  /// Resting — a slow, calm breath.
  idle,

  /// Hearing the merchant — swells and reacts to mic amplitude.
  listening,

  /// Working the request — faster, hotter, cool accent rides the rim.
  thinking,

  /// Speaking a reply — pulses with the synthesized speech envelope.
  speaking,
}

/// The living Jarvis orb.
///
/// A single molten sphere rendered by a `FragmentProgram` shader
/// (`shaders/jarvis_orb.frag`, ported 1:1 from the accepted web v3 orb): a
/// domain-warped fluid body, a hot gold/ember/white core, an iridescent rim and
/// a tight ember bloom on a clean dark field. It eases smoothly between
/// [JarvisOrbState]s and reacts to [amplitude] (0..1) — mic level while
/// listening, a speech envelope while speaking.
///
/// The orb renders on a dark field (the shader fills its rect with near-black
/// outside the sphere), so host it on an ink/dark surface. If the shader cannot
/// be loaded or compiled on the device, it degrades gracefully to a clean
/// animated gradient circle ([_OrbFallback]). Reduced-motion is respected: the
/// body is frozen calm and the glow is clamped.
class JarvisOrb extends StatefulWidget {
  const JarvisOrb({
    super.key,
    this.state = JarvisOrbState.idle,
    this.amplitude = 0,
    this.size = 240,
  });

  /// The current activity, driving speed / heat / accent.
  final JarvisOrbState state;

  /// Live intensity 0..1 (mic level or speech envelope).
  final double amplitude;

  /// The square extent of the orb host, in logical pixels.
  final double size;

  @override
  State<JarvisOrb> createState() => _JarvisOrbState();
}

class _JarvisOrbState extends State<JarvisOrb>
    with SingleTickerProviderStateMixin {
  // Shared across every orb instance — the program is compiled once.
  static Future<ui.FragmentProgram>? _programFuture;

  Ticker? _ticker;
  final _RepaintTick _repaint = _RepaintTick();
  _OrbPainter? _painter;
  bool _failed = false;

  // Eased scene values (mirror the web `approach` loop).
  double _time = 0;
  double _level = 0;
  double _speed = 0.16;
  double _enter = 0;
  double _hue = 0;
  Duration _last = Duration.zero;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      _programFuture ??= ui.FragmentProgram.fromAsset("shaders/jarvis_orb.frag");
      final program = await _programFuture!;
      if (!mounted) return;
      final shader = program.fragmentShader();
      _painter = _OrbPainter(shader: shader, repaint: _repaint);
      _ticker = createTicker(_onTick)..start();
      setState(() {});
    } catch (_) {
      // No shader support (or a compile failure) — fall back to the gradient.
      _programFuture = null;
      if (!mounted) return;
      setState(() => _failed = true);
    }
  }

  void _onTick(Duration elapsed) {
    final painter = _painter;
    if (painter == null) return;

    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    final dtRaw = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    // Clamp dt so a stalled frame can't jerk the easing.
    final dt = dtRaw.clamp(0.0, 1.0 / 30.0);

    // Targets by state — ported from the web stage.
    final st = widget.state;
    final tSpeed = switch (st) {
      JarvisOrbState.thinking => 0.78,
      JarvisOrbState.listening => 0.42,
      JarvisOrbState.speaking => 0.5,
      JarvisOrbState.idle => 0.17,
    };
    final baseLevel = switch (st) {
      JarvisOrbState.thinking => 0.34,
      JarvisOrbState.listening => 0.12,
      JarvisOrbState.speaking => 0.18,
      JarvisOrbState.idle => 0.06,
    };
    final audio = widget.amplitude.clamp(0.0, 1.0);
    final tLevel = math.max(baseLevel, audio);
    final tHue = st == JarvisOrbState.thinking ? 1.0 : 0.0;

    double approach(double cur, double target, double rate) =>
        cur + (target - cur) * (1 - math.exp(-rate * dt));

    _speed = approach(_speed, reduce ? 0.05 : tSpeed, 3);
    _level = approach(_level, reduce ? math.min(0.2, tLevel) : tLevel, 9);
    _enter = approach(_enter, 1, 2.2);
    _hue = approach(_hue, tHue, 1.5);
    // Real elapsed seconds drive the fluid; frozen when motion is reduced.
    _time = reduce ? 6.0 : elapsed.inMicroseconds / 1e6;

    painter
      ..time = _time
      ..level = _level
      ..speed = _speed
      ..enter = _enter
      ..hue = _hue * math.pi;
    _repaint.tick();
  }

  @override
  void dispose() {
    _ticker?.dispose();
    _painter?.dispose();
    _repaint.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dim = widget.size;
    if (_failed || _painter == null) {
      return _OrbFallback(
        size: dim,
        state: widget.state,
        amplitude: widget.amplitude,
        pending: !_failed,
      );
    }
    return SizedBox(
      width: dim,
      height: dim,
      child: CustomPaint(
        isComplex: true,
        painter: _painter,
      ),
    );
  }
}

/// Paints the orb shader. Uniform fields are mutated each tick and a
/// [ChangeNotifier] (`repaint`) drives the repaint, so the widget tree never
/// rebuilds during animation.
class _OrbPainter extends CustomPainter {
  _OrbPainter({required this.shader, required Listenable repaint})
      : super(repaint: repaint);

  final ui.FragmentShader shader;

  double time = 0;
  double level = 0;
  double speed = 0.16;
  double enter = 0;
  double hue = 0;

  @override
  void paint(Canvas canvas, Size size) {
    // Uniform order must match shaders/jarvis_orb.frag.
    shader
      ..setFloat(0, size.width)
      ..setFloat(1, size.height)
      ..setFloat(2, time)
      ..setFloat(3, level)
      ..setFloat(4, speed)
      ..setFloat(5, enter)
      ..setFloat(6, hue);
    canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
  }

  void dispose() => shader.dispose();

  @override
  bool shouldRepaint(covariant _OrbPainter oldDelegate) => true;
}

/// A tiny [ChangeNotifier] whose only job is to drive [CustomPaint.repaint] each
/// frame — [notifyListeners] is protected, so we expose [tick] to fire it.
class _RepaintTick extends ChangeNotifier {
  void tick() => notifyListeners();
}

/// A dependency-free gradient orb used when the shader is unavailable (older
/// devices, no Impeller) or still loading. Same molten palette, a gentle
/// breathing scale + glow that lifts with [amplitude]; motion is dropped under
/// reduced-motion.
class _OrbFallback extends StatefulWidget {
  const _OrbFallback({
    required this.size,
    required this.state,
    required this.amplitude,
    required this.pending,
  });

  final double size;
  final JarvisOrbState state;
  final double amplitude;

  /// True while the shader is still resolving (not a hard failure) — kept
  /// visually identical, so the swap is seamless if the shader arrives.
  final bool pending;

  @override
  State<_OrbFallback> createState() => _OrbFallbackState();
}

class _OrbFallbackState extends State<_OrbFallback>
    with SingleTickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  );

  @override
  void initState() {
    super.initState();
    _breath.repeat(reverse: true);
  }

  @override
  void dispose() {
    _breath.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final amp = widget.amplitude.clamp(0.0, 1.0);
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: ColoredBox(
        color: const Color(0xFF07090C),
        child: Center(
          child: AnimatedBuilder(
            animation: _breath,
            builder: (context, _) {
              final breathe = reduce ? 0.5 : _breath.value;
              final scale = 1.0 + (reduce ? 0.0 : 0.05 * breathe) + 0.06 * amp;
              final glow = 0.35 + 0.35 * breathe + 0.3 * amp;
              final core = widget.size * 0.62;
              return Container(
                width: core,
                height: core,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(
                    center: Alignment(0, -0.1),
                    radius: 0.72,
                    colors: [
                      Color(0xFFFFF2E0),
                      Color(0xFFFFB055),
                      Color(0xFFF26522),
                      Color(0xFF7A1508),
                    ],
                    stops: [0.0, 0.32, 0.62, 1.0],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF26522)
                          .withValues(alpha: glow.clamp(0.0, 1.0)),
                      blurRadius: 48 + 26 * amp,
                      spreadRadius: 2 + 6 * amp,
                    ),
                  ],
                ),
                transform: Matrix4.diagonal3Values(scale, scale, 1),
                transformAlignment: Alignment.center,
              );
            },
          ),
        ),
      ),
    );
  }
}
