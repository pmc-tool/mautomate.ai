import "package:flutter/material.dart";

import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "product_detail.dart";

/// The option-matrix picker on the PDP.
///
/// Renders one labelled row of choice chips per [ProductDetail.options]. The
/// selected value is highlighted (accent); a value that no in-stock combination
/// can reach given the OTHER current selections is disabled. Tapping a chip
/// calls [onSelect] with the option id + value so the PDP can recompute the
/// selected variant. Purely presentational + cart-free, so it is unit-testable
/// in isolation.
class VariantSelector extends StatelessWidget {
  const VariantSelector({
    super.key,
    required this.detail,
    required this.selected,
    required this.onSelect,
  });

  final ProductDetail detail;

  /// Current selection: `option_id` -> chosen value.
  final Map<String, String> selected;

  /// Called with (`optionId`, `value`) when a chip is tapped.
  final void Function(String optionId, String value) onSelect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final option in detail.options) ...[
          Text(
            option.title,
            style: text.titleSmall?.copyWith(color: c.textPrimary),
          ),
          const Gap(AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final value in option.values)
                _OptionChip(
                  key: ValueKey("${option.id}:$value"),
                  label: value,
                  selected: selected[option.id] == value,
                  available:
                      detail.isValueAvailable(option.id, value, selected),
                  onTap: () => onSelect(option.id, value),
                ),
            ],
          ),
          const Gap(AppSpacing.lg),
        ],
      ],
    );
  }
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({
    super.key,
    required this.label,
    required this.selected,
    required this.available,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool available;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final Color bg;
    final Color fg;
    final Color border;
    if (selected) {
      bg = c.accentTint;
      fg = c.accent;
      border = c.accent;
    } else if (!available) {
      bg = c.surfaceInset;
      fg = c.textDisabled;
      border = c.border;
    } else {
      bg = c.surface;
      fg = c.textPrimary;
      border = c.borderStrong;
    }

    return Semantics(
      button: true,
      selected: selected,
      enabled: available,
      label: label,
      child: GestureDetector(
        // Allow re-selecting the current value; only block truly unreachable
        // combinations that are not already selected.
        onTap: (available || selected) ? onTap : null,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: fg,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  decoration: (!available && !selected)
                      ? TextDecoration.lineThrough
                      : null,
                ),
          ),
        ),
      ),
    );
  }
}
