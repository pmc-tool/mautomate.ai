import "package:flutter/foundation.dart";
import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// The graceful fallback for a block whose `type` has no registered renderer.
///
/// This is the app's forward-compatibility guarantee: a store can ship a NEW
/// block type (or a Wave-2 type this binary predates) and the page still
/// renders — the unknown block simply degrades, never crashes.
///
/// - In DEBUG builds it renders a small, clearly-labelled placeholder naming the
///   missing `type`, so engineers see exactly which renderer to add.
/// - In RELEASE builds it renders NOTHING ([SizedBox.shrink]) — shoppers never
///   see a debug artifact.
class UnknownBlock extends StatelessWidget {
  const UnknownBlock({super.key, required this.type});

  final String type;

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return const SizedBox.shrink();

    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: c.warningBg,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.warningBorder),
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.puzzlePiece(), color: c.warning, size: 20),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              'No renderer for block "$type" (debug only)',
              style: text.labelMedium?.copyWith(color: c.warning),
            ),
          ),
        ],
      ),
    );
  }
}
