import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../../core/theme/theme.dart";
import "../../data/jarvis_models.dart";

/// One line showing a tool Jarvis is running: a spinner while it runs, a check
/// when it finishes, an x on failure — with the tool's human label. Mirrors the
/// web per-tool row.
class ToolActivityChip extends StatelessWidget {
  const ToolActivityChip({super.key, required this.tool});

  final JarvisToolActivity tool;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _leading(colors),
          const Gap(AppSpacing.sm),
          Flexible(
            child: Text(
              tool.label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.textSecondary,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _leading(AppColors colors) {
    switch (tool.state) {
      case ToolState.running:
        return SizedBox(
          width: 13,
          height: 13,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(colors.accent),
          ),
        );
      case ToolState.done:
        return Icon(PhosphorIconsFill.check, size: 14, color: colors.success);
      case ToolState.error:
        return Icon(PhosphorIconsFill.x, size: 14, color: colors.danger);
    }
  }
}
