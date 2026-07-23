import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/call_center_controllers.dart";
import "../data/call_center_models.dart";
import "widgets/breakdown_bars.dart";
import "widgets/call_stat_tile.dart";

/// Call analytics for the last 30 days: connect rate, containment and handle
/// time up top, then outcome / status / sentiment breakdowns and daily volume.
/// Read-only.
class CallAnalyticsScreen extends ConsumerWidget {
  const CallAnalyticsScreen({super.key});

  /// Convenience route so the overview can push without touching the router.
  static Route<void> route() {
    return MaterialPageRoute<void>(builder: (_) => const CallAnalyticsScreen());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(callAnalyticsControllerProvider);

    return AppScaffold(
      title: "Analytics",
      onRefresh: () => ref.refresh(callAnalyticsControllerProvider.future),
      body: async.when(
        loading: () => const SkeletonList(itemCount: 5),
        error: (err, _) => _Scrollable(
          child: ErrorStateView(
            message:
                err is ApiError ? err.message : "Couldn't load analytics.",
            onRetry: () => ref.invalidate(callAnalyticsControllerProvider),
          ),
        ),
        data: (analytics) => _body(context, analytics),
      ),
    );
  }

  Widget _body(BuildContext context, CallCenterAnalytics analytics) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final s = analytics.summary;
    final hasData = s.total > 0;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        Text(
          "Last 30 days",
          style: text.bodySmall?.copyWith(color: c.textMuted),
        ),
        const Gap(AppSpacing.md),
        _statGrid(s),
        if (!hasData) ...[
          const Gap(AppSpacing.lg),
          AppCard(
            child: EmptyState(
              compact: true,
              icon: PhosphorIcons.chartBar(),
              title: "No calls in this window",
              message:
                  "Once your agents handle calls, connect rate, containment "
                  "and outcomes show up here.",
            ),
          ),
        ] else ...[
          const Gap(AppSpacing.lg),
          _breakdownCard(
            context,
            title: "Outcomes",
            description: "How conversations ended.",
            data: analytics.outcomes,
            emptyText: "No outcome data for this range.",
          ),
          const Gap(AppSpacing.lg),
          _breakdownCard(
            context,
            title: "By status",
            description: "Where calls landed in the pipeline.",
            data: analytics.byStatus,
            emptyText: "No status data for this range.",
          ),
          const Gap(AppSpacing.lg),
          _breakdownCard(
            context,
            title: "Sentiment",
            description: "How callers felt, judged from the transcript.",
            data: analytics.sentiment,
            emptyText: "No sentiment data for this range.",
            useStatusChip: false,
          ),
          const Gap(AppSpacing.lg),
          _byDayCard(context, analytics.byDay),
        ],
        if (analytics.kpisNote.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          Text(
            analytics.kpisNote,
            style: text.bodySmall?.copyWith(color: c.textMuted),
          ),
        ],
      ],
    );
  }

  Widget _statGrid(CallAnalyticsSummary s) {
    final tiles = <Widget>[
      CallStatTile(
        label: "Total calls",
        value: "${s.total}",
        icon: PhosphorIcons.chatCircle(),
        tone: CallStatTone.info,
      ),
      CallStatTile(
        label: "Connect rate",
        value: "${(s.connectRate * 100).toStringAsFixed(1)}%",
        icon: PhosphorIcons.phone(),
        tone: CallStatTone.success,
      ),
      CallStatTile(
        label: "Containment",
        value: "${(s.containmentRate * 100).toStringAsFixed(1)}%",
        icon: PhosphorIcons.chartPie(),
        tone: CallStatTone.accent,
      ),
      CallStatTile(
        label: "Avg handle time",
        value: "${s.avgHandleTime.round()}s",
        icon: PhosphorIcons.clock(),
        tone: CallStatTone.warning,
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = AppSpacing.md;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final t in tiles) SizedBox(width: width, child: t),
          ],
        );
      },
    );
  }

  Widget _breakdownCard(
    BuildContext context, {
    required String title,
    required String description,
    required Map<String, num> data,
    required String emptyText,
    bool useStatusChip = true,
  }) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title, subtitle: description),
          const Gap(AppSpacing.lg),
          BreakdownBars(
            data: data,
            emptyText: emptyText,
            useStatusChip: useStatusChip,
          ),
        ],
      ),
    );
  }

  Widget _byDayCard(BuildContext context, List<CallDayPoint> byDay) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: "Calls by day",
            subtitle: "Daily call volume in this range.",
          ),
          const Gap(AppSpacing.lg),
          if (byDay.isEmpty)
            Text(
              "No daily data for this range.",
              style: text.bodySmall?.copyWith(color: c.textMuted),
            )
          else
            _DayBars(data: byDay),
        ],
      ),
    );
  }
}

class _DayBars extends StatelessWidget {
  const _DayBars({required this.data});

  final List<CallDayPoint> data;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final max = data.fold<num>(1, (m, d) => d.count > m ? d.count : m);

    return Column(
      children: [
        for (final d in data)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Row(
              children: [
                SizedBox(
                  width: 84,
                  child: Text(
                    d.date,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(
                      color: c.textMuted,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                const Gap(AppSpacing.md),
                Expanded(
                  child: ClipRRect(
                    borderRadius:
                        const BorderRadius.all(Radius.circular(AppRadius.pill)),
                    child: LinearProgressIndicator(
                      value: (d.count / max).clamp(0.0, 1.0).toDouble(),
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
                    "${d.count}",
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

/// Wraps a non-scrolling widget (error) so pull-to-refresh still works.
class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        );
      },
    );
  }
}
