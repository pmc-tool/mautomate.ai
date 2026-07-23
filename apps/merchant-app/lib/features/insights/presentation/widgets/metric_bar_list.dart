import "package:flutter/material.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../../data/insights_models.dart";

/// A ranked breakdown list (top pages, referrers, countries, devices …), ported
/// from the web analytics `TopList`: each row is a label + count with a faint
/// proportional bar behind it, so the relative weight reads at a glance.
///
/// Wrapped in an [AppCard] with a [SectionHeader]; renders its own empty line
/// when there's no data yet.
class MetricBarList extends StatelessWidget {
  const MetricBarList({
    super.key,
    required this.title,
    required this.icon,
    required this.rows,
    this.labelFormatter,
    this.max = 6,
  });

  final String title;
  final IconData icon;
  final List<MetricRow> rows;

  /// Optional prettifier for the raw label (e.g. country code → name).
  final String Function(String raw)? labelFormatter;

  /// How many rows to show at most.
  final int max;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final data = rows.take(max).toList();
    final peak = data.fold<num>(1, (m, r) => r.value > m ? r.value : m);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title, icon: icon),
          const Gap(AppSpacing.md),
          if (data.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Text(
                "No data yet.",
                style: text.bodySmall?.copyWith(color: c.textMuted),
              ),
            )
          else
            for (var i = 0; i < data.length; i++) ...[
              if (i > 0) const Gap(AppSpacing.xs),
              _BarRow(
                label: _label(data[i].label),
                value: data[i].value,
                fraction: (data[i].value / peak).clamp(0.0, 1.0).toDouble(),
              ),
            ],
        ],
      ),
    );
  }

  String _label(String raw) {
    if (raw.isEmpty) return "Direct / none";
    return labelFormatter?.call(raw) ?? raw;
  }
}

class _BarRow extends StatelessWidget {
  const _BarRow({
    required this.label,
    required this.value,
    required this.fraction,
  });

  final String label;
  final num value;
  final double fraction;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return ClipRRect(
      borderRadius: AppRadius.smAll,
      child: Stack(
        children: [
          // Proportional fill behind the row.
          Positioned.fill(
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: fraction == 0 ? 0.02 : fraction,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: c.cyan.withValues(alpha: 0.14),
                  borderRadius: AppRadius.smAll,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 7,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(color: c.textPrimary),
                  ),
                ),
                const Gap(AppSpacing.sm),
                Text(
                  _compact(value),
                  style: text.bodySmall?.copyWith(
                    color: c.textSecondary,
                    fontWeight: FontWeight.w600,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _compact(num v) {
    if (v >= 1000000) return "${(v / 1000000).toStringAsFixed(1)}M";
    if (v >= 1000) return "${(v / 1000).toStringAsFixed(1)}k";
    return v.toInt().toString();
  }
}
