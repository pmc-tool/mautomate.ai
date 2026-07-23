import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// The designed "nothing here yet" state for a screen or list.
///
/// Never show a blank area — every list/screen that can be empty renders an
/// [EmptyState] with a clear message and, where the merchant can act, an
/// [action]. Mirrors the web `EmptyState`: a circular icon tile, a title, a
/// constrained supporting line, and an optional action button.
///
/// ```dart
/// EmptyState(
///   icon: PhosphorIcons.package(),
///   title: "No orders yet",
///   message: "When customers check out, their orders show up here.",
///   action: PrimaryButton(label: "Share your store", onPressed: _share),
/// )
/// ```
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon,
    this.action,
    this.compact = false,
  });

  /// Short headline (what's empty).
  final String title;

  /// Optional supporting sentence — say why it's empty and what to do next.
  final String? message;

  /// Illustrative icon. Defaults to a storefront glyph.
  final IconData? icon;

  /// Optional primary action.
  final Widget? action;

  /// Tighter layout for use inside a card rather than a full screen.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final pad = compact ? AppSpacing.xl : AppSpacing.xxl;

    return Center(
      child: Padding(
        padding: EdgeInsets.all(pad),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: c.surfaceMuted,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon ?? PhosphorIcons.storefront(),
                size: 26,
                color: c.textMuted,
              ),
            ),
            const Gap(AppSpacing.lg),
            Text(title, style: text.titleMedium, textAlign: TextAlign.center),
            if (message != null) ...[
              const Gap(AppSpacing.xs),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Text(
                  message!,
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(color: c.textSecondary),
                ),
              ),
            ],
            if (action != null) ...[
              const Gap(AppSpacing.xl),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
