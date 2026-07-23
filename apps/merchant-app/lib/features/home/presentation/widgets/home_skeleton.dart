import "package:flutter/material.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

/// The Home loading state — a content-shaped skeleton (greeting, an attention
/// card, the stat grid, a couple of order rows) under one shared shimmer.
/// Used instead of a bare spinner so the wait reads as "the dashboard is
/// coming", not "something is stuck".
class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView(
        padding: AppSpacing.screen,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          const SkeletonBox(width: 180, height: 22),
          const Gap(AppSpacing.sm),
          const SkeletonBox(width: 240, height: 14),
          const Gap(AppSpacing.xl),
          _card(context, const SizedBox(height: 40)),
          const Gap(AppSpacing.lg),
          Row(
            children: [
              Expanded(child: _card(context, const SizedBox(height: 56))),
              const Gap(AppSpacing.md),
              Expanded(child: _card(context, const SizedBox(height: 56))),
            ],
          ),
          const Gap(AppSpacing.md),
          Row(
            children: [
              Expanded(child: _card(context, const SizedBox(height: 56))),
              const Gap(AppSpacing.md),
              Expanded(child: _card(context, const SizedBox(height: 56))),
            ],
          ),
          const Gap(AppSpacing.xl),
          const SkeletonBox(width: 140, height: 18),
          const Gap(AppSpacing.md),
          for (var i = 0; i < 3; i++) ...[
            _card(
              context,
              Row(
                children: const [
                  SkeletonBox(width: 64, height: 14),
                  Spacer(),
                  SkeletonBox(width: 56, height: 14),
                ],
              ),
            ),
            const Gap(AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  Widget _card(BuildContext context, Widget child) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: c.border),
      ),
      child: child,
    );
  }
}
