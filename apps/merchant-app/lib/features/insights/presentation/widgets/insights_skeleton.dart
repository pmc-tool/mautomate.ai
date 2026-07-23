import "package:flutter/material.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

/// Content-shaped loading placeholder for Insights: the chart card, then the
/// KPI grid, then a couple of breakdown cards — so the skeleton reads like the
/// screen it precedes, not a generic spinner.
class InsightsSkeleton extends StatelessWidget {
  const InsightsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    Widget card(Widget child) => Container(
          padding: AppSpacing.card,
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: c.border),
          ),
          child: child,
        );

    return Shimmer(
      child: ListView(
        padding: AppSpacing.screen,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          const SkeletonBox(width: 220, height: 34, borderRadius: AppRadius.mdAll),
          const Gap(AppSpacing.lg),
          // Hero chart
          card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonBox(width: 120, height: 12),
                Gap(AppSpacing.sm),
                SkeletonBox(width: 160, height: 26),
                Gap(AppSpacing.lg),
                SkeletonBox(width: double.infinity, height: 168, borderRadius: AppRadius.mdAll),
              ],
            ),
          ),
          const Gap(AppSpacing.xl),
          // KPI grid
          Row(
            children: [
              Expanded(child: card(const _KpiLines())),
              const Gap(AppSpacing.md),
              Expanded(child: card(const _KpiLines())),
            ],
          ),
          const Gap(AppSpacing.md),
          Row(
            children: [
              Expanded(child: card(const _KpiLines())),
              const Gap(AppSpacing.md),
              Expanded(child: card(const _KpiLines())),
            ],
          ),
          const Gap(AppSpacing.xl),
          card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonBox(width: 140, height: 14),
                Gap(AppSpacing.md),
                SkeletonBox(width: double.infinity, height: 12),
                Gap(AppSpacing.sm),
                SkeletonBox(width: double.infinity, height: 12),
                Gap(AppSpacing.sm),
                SkeletonBox(width: 220, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiLines extends StatelessWidget {
  const _KpiLines();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: const [
        SkeletonBox(width: 90, height: 10),
        Gap(AppSpacing.md),
        SkeletonBox(width: 110, height: 22),
        Gap(AppSpacing.sm),
        SkeletonBox(width: 64, height: 12),
      ],
    );
  }
}
