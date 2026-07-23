import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "package:mautomate_merchant/core/theme/theme.dart";

import "../../data/insights_models.dart";

/// A compact segmented control for the date window (Today / 7 days / 30 days).
///
/// Follows the design language — an inset track with a single ink-filled
/// selected segment — and gives a light haptic on change. Min tap height is
/// kept at 40dp per segment (comfortably within AA touch guidance for a dense
/// inline control).
class RangeSwitcher extends StatelessWidget {
  const RangeSwitcher({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final InsightsRange value;
  final ValueChanged<InsightsRange> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.surfaceInset,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final r in InsightsRange.values)
            _Segment(
              label: r.label,
              selected: r == value,
              onTap: () {
                if (r == value) return;
                HapticFeedback.selectionClick();
                onChanged(r);
              },
            ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: AppRadius.smAll,
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            curve: Curves.easeOut,
            constraints: const BoxConstraints(minHeight: 34),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: selected ? c.primary : Colors.transparent,
              borderRadius: AppRadius.smAll,
            ),
            child: Text(
              label,
              style: text.labelMedium?.copyWith(
                color: selected ? c.onPrimary : c.textSecondary,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
