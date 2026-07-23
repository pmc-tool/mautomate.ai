import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// A title block for a section or card: an optional uppercase [eyebrow], a
/// [title], an optional [subtitle], and an optional trailing [action] (usually
/// a [GhostButton] or icon button).
///
/// Mirrors the web `SectionCard` header — optional leading icon tile, title +
/// description on the left, action on the right.
///
/// ```dart
/// SectionHeader(
///   title: "Needs attention",
///   subtitle: "3 orders awaiting fulfilment",
///   icon: PhosphorIcons.warning(),
///   action: GhostButton(label: "View all", onPressed: _openOrders),
/// )
/// ```
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.eyebrow,
    this.icon,
    this.action,
    this.padding = EdgeInsets.zero,
  });

  /// The section title.
  final String title;

  /// Optional supporting line beneath the title.
  final String? subtitle;

  /// Optional uppercase, tracked label above the title.
  final String? eyebrow;

  /// Optional leading icon, shown in a tinted square tile.
  final IconData? icon;

  /// Optional trailing action widget.
  final Widget? action;

  /// Outer padding around the header.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: c.surfaceMuted,
                borderRadius: AppRadius.smAll,
              ),
              child: Icon(icon, size: 20, color: c.textSecondary),
            ),
            const Gap(AppSpacing.md),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (eyebrow != null) ...[
                  Text(
                    eyebrow!.toUpperCase(),
                    style: text.labelSmall?.copyWith(color: c.textMuted),
                  ),
                  const Gap(AppSpacing.xs),
                ],
                Text(title, style: text.titleMedium),
                if (subtitle != null) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    subtitle!,
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          if (action != null) ...[
            const Gap(AppSpacing.md),
            action!,
          ],
        ],
      ),
    );
  }
}
