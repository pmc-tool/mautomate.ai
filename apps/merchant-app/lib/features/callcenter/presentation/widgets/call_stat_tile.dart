import "package:flutter/material.dart";

import "../../../../core/theme/theme.dart";

/// A compact KPI tile: an uppercase [label], a large [value], and a tinted
/// icon chip. Mirrors the web call-center `StatTile`. Used on the overview and
/// the analytics screen so numbers read the same across both.
class CallStatTile extends StatelessWidget {
  const CallStatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.tone = CallStatTone.neutral,
  });

  final String label;
  final String value;
  final IconData icon;
  final CallStatTone tone;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final (fg, bg) = _chip(c, tone);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.labelSmall?.copyWith(
                    color: c.textMuted,
                    letterSpacing: 0.4,
                  ),
                ),
                const Gap(AppSpacing.xs),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          const Gap(AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(color: bg, borderRadius: AppRadius.smAll),
            child: Icon(icon, size: 18, color: fg),
          ),
        ],
      ),
    );
  }

  (Color, Color) _chip(AppColors c, CallStatTone t) {
    switch (t) {
      case CallStatTone.info:
        return (c.info, c.infoBg);
      case CallStatTone.success:
        return (c.success, c.successBg);
      case CallStatTone.accent:
        return (c.accent, c.accentTint);
      case CallStatTone.warning:
        return (c.warning, c.warningBg);
      case CallStatTone.neutral:
        return (c.textSecondary, c.surfaceMuted);
    }
  }
}

/// The semantic tint of a [CallStatTile]'s icon chip.
enum CallStatTone { neutral, info, success, accent, warning }
