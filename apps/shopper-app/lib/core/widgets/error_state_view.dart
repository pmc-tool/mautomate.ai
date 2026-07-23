import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";
import "app_buttons.dart";

/// The designed error state for a failed load, with a Retry affordance.
///
/// Every screen's error branch renders this instead of a bare exception or a
/// stuck spinner. The [message] should say what went wrong in plain language;
/// [onRetry], when provided, shows a Retry button that re-runs the load.
///
/// ```dart
/// ErrorStateView(
///   message: "Couldn't load your orders. Check your connection and retry.",
///   onRetry: ref.read(ordersProvider.notifier).refresh,
/// )
/// ```
class ErrorStateView extends StatelessWidget {
  const ErrorStateView({
    super.key,
    this.title = "Something went wrong",
    required this.message,
    this.onRetry,
    this.retryLabel = "Retry",
    this.icon,
    this.compact = false,
  });

  /// Short headline.
  final String title;

  /// Plain-language explanation + how to recover.
  final String message;

  /// Retry handler. When null, no retry button is shown.
  final VoidCallback? onRetry;

  /// Retry button label.
  final String retryLabel;

  /// Override the default warning glyph.
  final IconData? icon;

  /// Tighter layout for use inside a card.
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
                color: c.dangerBg,
                shape: BoxShape.circle,
                border: Border.all(color: c.dangerBorder),
              ),
              child: Icon(
                icon ?? PhosphorIcons.warning(),
                size: 26,
                color: c.danger,
              ),
            ),
            const Gap(AppSpacing.lg),
            Text(title, style: text.titleMedium, textAlign: TextAlign.center),
            const Gap(AppSpacing.xs),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
            ),
            if (onRetry != null) ...[
              const Gap(AppSpacing.xl),
              SecondaryButton(
                label: retryLabel,
                icon: PhosphorIcons.arrowClockwise(),
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
