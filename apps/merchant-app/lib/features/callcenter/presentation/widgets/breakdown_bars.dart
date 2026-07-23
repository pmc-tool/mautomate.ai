import "package:flutter/material.dart";

import "../../../../core/theme/theme.dart";
import "../../../../core/widgets/widgets.dart";
import "../call_format.dart";

/// A labelled horizontal bar list — one row per key, bar width proportional to
/// the largest value. Mirrors the web analytics `BreakdownCard` body. Used for
/// outcomes, statuses and sentiment.
class BreakdownBars extends StatelessWidget {
  const BreakdownBars({
    super.key,
    required this.data,
    required this.emptyText,
    this.useStatusChip = true,
  });

  /// Key -> count. Rendered sorted by count, descending.
  final Map<String, num> data;

  /// Shown when [data] is empty.
  final String emptyText;

  /// Render each key as a [StatusChip] (statuses/outcomes) rather than plain
  /// humanised text (sentiments).
  final bool useStatusChip;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final entries = data.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    if (entries.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Text(
          emptyText,
          style: text.bodySmall?.copyWith(color: c.textMuted),
        ),
      );
    }

    final max = entries.fold<num>(1, (m, e) => e.value > m ? e.value : m);

    return Column(
      children: [
        for (final e in entries)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Row(
              children: [
                SizedBox(
                  width: 116,
                  child: useStatusChip
                      ? Align(
                          alignment: Alignment.centerLeft,
                          child: StatusChip(status: e.key),
                        )
                      : Text(
                          humaniseToken(e.key),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall
                              ?.copyWith(color: c.textSecondary),
                        ),
                ),
                const Gap(AppSpacing.md),
                Expanded(
                  child: ClipRRect(
                    borderRadius:
                        const BorderRadius.all(Radius.circular(AppRadius.pill)),
                    child: LinearProgressIndicator(
                      value: (e.value / max).clamp(0.0, 1.0).toDouble(),
                      minHeight: 8,
                      backgroundColor: c.surfaceMuted,
                      valueColor: AlwaysStoppedAnimation<Color>(c.primary),
                    ),
                  ),
                ),
                const Gap(AppSpacing.md),
                SizedBox(
                  width: 40,
                  child: Text(
                    "${e.value.toInt()}",
                    textAlign: TextAlign.right,
                    style: text.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
