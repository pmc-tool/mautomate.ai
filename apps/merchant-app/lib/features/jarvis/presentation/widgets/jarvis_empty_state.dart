import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../../core/theme/theme.dart";

/// First-run welcome for a fresh Jarvis chat: a short greeting and a few
/// tappable example prompts so the merchant is never staring at a blank box.
class JarvisEmptyState extends StatelessWidget {
  const JarvisEmptyState({super.key, required this.onPrompt});

  /// Called with an example prompt when the merchant taps a suggestion chip.
  final ValueChanged<String> onPrompt;

  static const _greeting =
      "Hi, I am Jarvis. Ask me about your shop, or tell me to do something: "
      "set up delivery, publish a product, change a price, fulfil or refund an "
      "order. I read your live data, and I always show a confirmation before "
      "anything changes.";

  static const _suggestions = <String>[
    "How is my shop doing?",
    "Is my store ready to sell?",
    "Show my recent orders",
    "What needs my attention?",
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.accentTint,
              borderRadius: AppRadius.lgAll,
            ),
            child: Icon(
              PhosphorIconsFill.sparkle,
              color: colors.accent,
              size: 24,
            ),
          ),
          const Gap(AppSpacing.md),
          Text(
            "Ask Jarvis",
            style: textTheme.titleMedium?.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Gap(AppSpacing.xs),
          Text(
            _greeting,
            style: textTheme.bodyMedium?.copyWith(
              color: colors.textSecondary,
              height: 1.45,
            ),
          ),
          const Gap(AppSpacing.lg),
          Text(
            "TRY ASKING",
            style: textTheme.labelSmall?.copyWith(
              color: colors.textMuted,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
          const Gap(AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final suggestion in _suggestions)
                _SuggestionChip(
                  label: suggestion,
                  onTap: () => onPrompt(suggestion),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SuggestionChip extends StatelessWidget {
  const _SuggestionChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.surface,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: colors.border),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ),
      ),
    );
  }
}
