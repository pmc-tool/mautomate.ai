import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../../data/home_models.dart";

/// A single "Needs attention" card: a tinted icon, the headline, a one-line
/// explanation, and — when the item has a destination — a chevron. Tapping a
/// routed item jumps to that tab; informational items are not tappable.
class AttentionCard extends StatelessWidget {
  const AttentionCard({super.key, required this.item, this.onTap});

  final AttentionItem item;
  final VoidCallback? onTap;

  ({Color fg, Color bg, Color border}) _palette(AppColors c) {
    switch (item.tone) {
      case AttentionTone.danger:
        return (fg: c.danger, bg: c.dangerBg, border: c.dangerBorder);
      case AttentionTone.warning:
        return (fg: c.warning, bg: c.warningBg, border: c.warningBorder);
      case AttentionTone.info:
        return (fg: c.info, bg: c.infoBg, border: c.infoBorder);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final p = _palette(c);
    final tappable = item.route != null && onTap != null;

    return AppCard(
      onTap: tappable ? onTap : null,
      borderColor: p.border,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: p.bg,
              borderRadius: AppRadius.mdAll,
            ),
            child: Icon(item.icon, size: 20, color: p.fg),
          ),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: text.titleSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(AppSpacing.xxs),
                Text(
                  item.detail,
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ],
            ),
          ),
          if (tappable) ...[
            const Gap(AppSpacing.sm),
            Icon(
              PhosphorIconsRegular.caretRight,
              size: 18,
              color: c.textMuted,
            ),
          ],
        ],
      ),
    );
  }
}
