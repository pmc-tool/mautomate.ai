import "package:flutter/material.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

/// A single headline metric on Home: an eyebrow label, a big value, and a
/// tinted Phosphor icon. Composes the design-system [AppCard] — it does not
/// restyle it. [value] is any widget so callers can drop in a [MoneyText].
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.iconColor,
  });

  final String label;
  final Widget value;
  final IconData icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final tint = iconColor ?? c.textSecondary;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: tint),
              const Gap(AppSpacing.sm),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: text.labelSmall?.copyWith(color: c.textMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const Gap(AppSpacing.sm),
          DefaultTextStyle.merge(
            style: text.titleLarge!.copyWith(color: c.textPrimary),
            child: value,
          ),
        ],
      ),
    );
  }
}
