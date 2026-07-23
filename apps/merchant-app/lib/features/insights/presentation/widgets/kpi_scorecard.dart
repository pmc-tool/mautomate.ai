import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../../data/insights_models.dart";

/// A single KPI scorecard: an eyebrow label with a tinted Phosphor icon, a big
/// value (any widget, so callers drop in a [MoneyText]), and an optional
/// period-over-period trend pill ("↑ 12% vs previous 7 days").
///
/// Composes the design-system [AppCard]; the trend colour uses the semantic
/// success/danger tokens so up/down reads correctly in light and dark.
class KpiScorecard extends StatelessWidget {
  const KpiScorecard({
    super.key,
    required this.label,
    required this.icon,
    required this.value,
    this.iconColor,
    this.trend,
    this.comparePhrase,
  });

  final String label;
  final IconData icon;
  final Widget value;
  final Color? iconColor;

  /// When provided (and it has a value), a trend pill is shown beneath.
  final TrendDelta? trend;

  /// The "vs previous …" phrase for accessibility + the caption.
  final String? comparePhrase;

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
          if (trend != null && trend!.hasValue) ...[
            const Gap(AppSpacing.sm),
            _TrendPill(trend: trend!, comparePhrase: comparePhrase),
          ],
        ],
      ),
    );
  }
}

class _TrendPill extends StatelessWidget {
  const _TrendPill({required this.trend, this.comparePhrase});

  final TrendDelta trend;
  final String? comparePhrase;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    if (trend.isNew) {
      return Semantics(
        label: "New this period",
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsFill.sparkle, size: 13, color: c.info),
            const Gap(AppSpacing.xs),
            Flexible(
              child: Text(
                "New",
                style: text.labelSmall?.copyWith(
                  color: c.info,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final up = trend.isUp;
    final pct = trend.percent ?? 0;
    final flat = pct.abs() < 0.05;
    final tone = flat
        ? c.textSecondary
        : (up ? c.success : c.danger);
    final glyph = flat
        ? PhosphorIconsRegular.minus
        : (up ? PhosphorIconsFill.trendUp : PhosphorIconsFill.trendDown);
    final magnitude = pct.abs();
    final pctLabel = magnitude >= 100
        ? "${magnitude.round()}%"
        : "${magnitude.toStringAsFixed(magnitude < 10 ? 1 : 0)}%";

    return Semantics(
      label:
          "${flat ? "No change" : (up ? "Up" : "Down")} $pctLabel ${comparePhrase ?? ""}",
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(glyph, size: 13, color: tone),
          const Gap(AppSpacing.xs),
          Flexible(
            child: Text.rich(
              TextSpan(children: [
                TextSpan(
                  text: flat ? "0%" : "${up ? "+" : "-"}$pctLabel",
                  style: text.labelSmall?.copyWith(
                    color: tone,
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                if (comparePhrase != null)
                  TextSpan(
                    text: "  ${comparePhrase!}",
                    style: text.labelSmall?.copyWith(color: c.textMuted),
                  ),
              ]),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
