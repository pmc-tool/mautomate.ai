import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// A single list row: an optional leading icon (in a tinted tile) or custom
/// [leading] widget, a [title], an optional [subtitle], and an optional
/// [trailing] widget. When [onTap] is set a chevron is shown by default and a
/// selection haptic fires on tap.
///
/// This is the standard row for orders, products, conversations, settings —
/// use it everywhere a scrollable list of records appears so rows stay a
/// uniform ≥56dp height with consistent spacing.
///
/// ```dart
/// ListRowTile(
///   icon: PhosphorIcons.receipt(),
///   title: "#1042 · Jane Doe",
///   subtitle: "2 items · £48.00",
///   trailing: StatusChip(status: "fulfilled"),
///   onTap: () => open(id),
/// )
/// ```
class ListRowTile extends StatelessWidget {
  const ListRowTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.leading,
    this.trailing,
    this.onTap,
    this.showChevron = true,
    this.iconColor,
    this.padding = const EdgeInsets.symmetric(
      horizontal: AppSpacing.lg,
      vertical: AppSpacing.md,
    ),
  });

  /// Primary line.
  final String title;

  /// Optional secondary line.
  final String? subtitle;

  /// Convenience leading icon rendered in a tinted square tile. Ignored when
  /// [leading] is provided.
  final IconData? icon;

  /// Fully custom leading widget (avatar, thumbnail). Takes precedence over
  /// [icon].
  final Widget? leading;

  /// Trailing widget (a chip, value, or control). When null and [onTap] is
  /// set, a chevron is shown if [showChevron] is true.
  final Widget? trailing;

  /// Row tap handler. When null the row is static.
  final VoidCallback? onTap;

  /// Whether to render a trailing chevron for tappable rows without a custom
  /// [trailing].
  final bool showChevron;

  /// Overrides the leading icon colour.
  final Color? iconColor;

  /// Row padding.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    Widget? lead = leading;
    if (lead == null && icon != null) {
      lead = Container(
        height: 40,
        width: 40,
        decoration: BoxDecoration(
          color: c.surfaceMuted,
          borderRadius: AppRadius.smAll,
        ),
        child: Icon(icon, size: 20, color: iconColor ?? c.textSecondary),
      );
    }

    Widget? trail = trailing;
    if (trail == null && onTap != null && showChevron) {
      trail = Icon(PhosphorIcons.caretRight(), size: 16, color: c.textMuted);
    }

    final row = Padding(
      padding: padding,
      child: Row(
        children: [
          if (lead != null) ...[lead, const Gap(AppSpacing.md)],
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall,
                ),
                if (subtitle != null) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          if (trail != null) ...[const Gap(AppSpacing.md), trail],
        ],
      ),
    );

    if (onTap == null) {
      return ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: row,
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        splashColor: c.accent.withValues(alpha: 0.06),
        highlightColor: c.accent.withValues(alpha: 0.03),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap!.call();
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: row,
        ),
      ),
    );
  }
}
