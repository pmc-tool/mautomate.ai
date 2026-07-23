import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";

/// A compact +/- quantity control for the PDP add-to-cart row.
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 1,
    this.max = 99,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int max;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.borderStrong),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepButton(
            icon: PhosphorIcons.minus(),
            enabled: value > min,
            onTap: () => onChanged(value - 1),
          ),
          Container(
            constraints: const BoxConstraints(minWidth: 40),
            alignment: Alignment.center,
            child: Text(
              "$value",
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: c.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          _StepButton(
            icon: PhosphorIcons.plus(),
            enabled: value < max,
            onTap: () => onChanged(value + 1),
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      borderRadius: AppRadius.mdAll,
      onTap: enabled
          ? () {
              HapticFeedback.selectionClick();
              onTap();
            }
          : null,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Icon(
          icon,
          size: 16,
          color: enabled ? c.textPrimary : c.textDisabled,
        ),
      ),
    );
  }
}
