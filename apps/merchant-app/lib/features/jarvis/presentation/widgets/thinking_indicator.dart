import "package:flutter/material.dart";

import "../../../../core/theme/theme.dart";

/// Three softly bouncing dots shown while Jarvis is thinking before any text,
/// tool, or confirm has arrived. Mirrors the web `Dots` pulse.
class ThinkingIndicator extends StatefulWidget {
  const ThinkingIndicator({super.key});

  @override
  State<ThinkingIndicator> createState() => _ThinkingIndicatorState();
}

class _ThinkingIndicatorState extends State<ThinkingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = context.colors.textMuted;
    return Semantics(
      label: "Jarvis is thinking",
      child: SizedBox(
        height: 12,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (i) {
                final phase = (_controller.value - i * 0.15) % 1.0;
                final lift = phase < 0.3 ? (phase / 0.3) : 0.0;
                final opacity = 0.3 + 0.7 * lift;
                return Padding(
                  padding: EdgeInsets.only(right: i == 2 ? 0 : AppSpacing.xs),
                  child: Transform.translate(
                    offset: Offset(0, -2 * lift),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: opacity),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                );
              }),
            );
          },
        ),
      ),
    );
  }
}
