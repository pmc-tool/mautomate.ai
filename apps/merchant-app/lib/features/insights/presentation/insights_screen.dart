import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/insights_controller.dart";
import "../data/insights_models.dart";
import "widgets/insights_skeleton.dart";
import "widgets/kpi_scorecard.dart";
import "widgets/metric_bar_list.dart";
import "widgets/range_switcher.dart";
import "widgets/time_series_chart.dart";

/// Insights — the merchant's analytics surface. Composes two backend primitives
/// (mirroring the web dashboard): the commerce numbers + revenue series from
/// GET /merchant/orders, and the storefront's web traffic from
/// GET /merchant/analytics (Umami). A Today / 7 days / 30 days switcher drives
/// both.
///
/// Every state is handled: a content-shaped skeleton while loading, a friendly
/// error with retry, and a designed empty state for a quiet period. Pull to
/// refresh anywhere.
class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  Future<void> _refresh(WidgetRef ref) =>
      ref.read(insightsControllerProvider.notifier).refresh();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(insightsControllerProvider);

    return AppScaffold(
      title: "Insights",
      onRefresh: () => _refresh(ref),
      body: async.when(
        skipLoadingOnRefresh: true,
        loading: () => const InsightsSkeleton(),
        error: (error, _) => _ErrorBody(
          message: _messageOf(error),
          onRetry: () => _refresh(ref),
        ),
        data: (snapshot) => _InsightsBody(snapshot: snapshot),
      ),
    );
  }
}

String _messageOf(Object error) {
  final s = error.toString();
  final idx = s.indexOf("): ");
  return idx >= 0 ? s.substring(idx + 3) : s;
}

class _InsightsBody extends ConsumerWidget {
  const _InsightsBody({required this.snapshot});

  final InsightsSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = snapshot.stats;
    final traffic = snapshot.traffic;

    void setRange(InsightsRange r) =>
        ref.read(insightsControllerProvider.notifier).setRange(r);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: AppSpacing.screen,
      children: [
        // Range switcher (+ realtime pill when we have live traffic).
        Row(
          children: [
            Expanded(
              child: RangeSwitcher(value: snapshot.range, onChanged: setRange),
            ),
            if (traffic != null && traffic.realtime > 0) ...[
              const Gap(AppSpacing.sm),
              _RealtimePill(count: traffic.realtime),
            ],
          ],
        ),
        const Gap(AppSpacing.lg),

        if (snapshot.isEmpty)
          _EmptyBody(range: snapshot.range)
        else ...[
          // Hero chart
          _HeroChartCard(snapshot: snapshot),
          const Gap(AppSpacing.xl),

          // KPI scorecards
          SectionHeader(
            title: "Key numbers",
            icon: PhosphorIconsRegular.chartBar,
          ),
          const Gap(AppSpacing.md),
          _KpiGrid(
            children: [
              KpiScorecard(
                label: "Revenue",
                icon: PhosphorIconsRegular.currencyDollar,
                iconColor: context.colors.success,
                trend: stats.revenueTrend,
                comparePhrase: snapshot.range.comparePhrase,
                value: MoneyText(
                  amount: stats.revenue,
                  currencyCode: stats.currencyCode,
                  strong: true,
                ),
              ),
              KpiScorecard(
                label: "Orders",
                icon: PhosphorIconsRegular.receipt,
                trend: stats.ordersTrend,
                comparePhrase: snapshot.range.comparePhrase,
                value: Text("${stats.orderCount}"),
              ),
              KpiScorecard(
                label: "Avg. order value",
                icon: PhosphorIconsRegular.tag,
                value: MoneyText(
                  amount: stats.avgOrderValue,
                  currencyCode: stats.currencyCode,
                  strong: true,
                ),
              ),
              if (traffic != null)
                KpiScorecard(
                  label: "Conversion",
                  icon: PhosphorIconsRegular.target,
                  iconColor: context.colors.cyan,
                  value: Text(
                    traffic.conversionRate == null
                        ? "—"
                        : "${traffic.conversionRate!.toStringAsFixed(traffic.conversionRate! < 10 ? 1 : 0)}%",
                  ),
                ),
              if (traffic != null)
                KpiScorecard(
                  label: "Visitors",
                  icon: PhosphorIconsRegular.users,
                  value: Text(_compact(traffic.visitors)),
                ),
              KpiScorecard(
                label: "Products live",
                icon: PhosphorIconsRegular.package,
                value: Text("${stats.productsLive}"),
              ),
            ],
          ),
          const Gap(AppSpacing.xl),

          // Traffic section, or a hint when web analytics is off.
          if (traffic != null)
            _TrafficSection(traffic: traffic)
          else if (!snapshot.analyticsEnabled)
            const _AnalyticsOffCard(),
        ],
      ],
    );
  }
}

/// The headline chart: a metric total for the range and a [TimeSeriesChart],
/// with an inline Revenue / Orders toggle. Stateful only for the toggle.
class _HeroChartCard extends StatefulWidget {
  const _HeroChartCard({required this.snapshot});

  final InsightsSnapshot snapshot;

  @override
  State<_HeroChartCard> createState() => _HeroChartCardState();
}

class _HeroChartCardState extends State<_HeroChartCard> {
  bool _showRevenue = true;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final snapshot = widget.snapshot;
    final stats = snapshot.stats;
    final series = snapshot.series;

    final values = series
        .map((b) => _showRevenue ? b.revenue.toDouble() : b.orders.toDouble())
        .toList();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (_showRevenue ? "Revenue" : "Orders").toUpperCase(),
                      style: text.labelSmall?.copyWith(color: c.textMuted),
                    ),
                    const Gap(AppSpacing.xs),
                    _showRevenue
                        ? MoneyText(
                            amount: stats.revenue,
                            currencyCode: stats.currencyCode,
                            strong: true,
                            style: text.headlineSmall,
                          )
                        : Text("${stats.orderCount}", style: text.headlineSmall),
                  ],
                ),
              ),
              _MetricToggle(
                showRevenue: _showRevenue,
                onChanged: (v) => setState(() => _showRevenue = v),
              ),
            ],
          ),
          const Gap(AppSpacing.lg),
          TimeSeriesChart(values: values, color: c.cyan),
          const Gap(AppSpacing.sm),
          // First/last axis labels — light, unobtrusive.
          if (series.length > 1)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(series.first.label,
                    style: text.labelSmall?.copyWith(color: c.textMuted)),
                Text(series.last.label,
                    style: text.labelSmall?.copyWith(color: c.textMuted)),
              ],
            ),
        ],
      ),
    );
  }
}

class _MetricToggle extends StatelessWidget {
  const _MetricToggle({required this.showRevenue, required this.onChanged});

  final bool showRevenue;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    Widget seg(String label, bool isRevenue) {
      final selected = isRevenue == showRevenue;
      return Semantics(
        button: true,
        selected: selected,
        child: GestureDetector(
          onTap: () => onChanged(isRevenue),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: selected ? c.cyan.withValues(alpha: 0.16) : Colors.transparent,
              borderRadius: AppRadius.smAll,
            ),
            child: Text(
              label,
              style: text.labelSmall?.copyWith(
                color: selected ? c.textPrimary : c.textMuted,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.surfaceInset,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [seg("Revenue", true), seg("Orders", false)],
      ),
    );
  }
}

/// A responsive grid for the KPI scorecards: two across on phones, three on
/// wide screens, wrapping to as many rows as needed.
class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 560 ? 3 : 2;
        const spacing = AppSpacing.md;
        final tileWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children)
              SizedBox(width: tileWidth, child: child),
          ],
        );
      },
    );
  }
}

class _TrafficSection extends StatelessWidget {
  const _TrafficSection({required this.traffic});

  final TrafficStats traffic;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: "Storefront traffic",
          subtitle: "How shoppers are finding and browsing your store.",
          icon: PhosphorIconsRegular.globe,
        ),
        const Gap(AppSpacing.md),
        _KpiGrid(
          children: [
            KpiScorecard(
              label: "Page views",
              icon: PhosphorIconsRegular.eye,
              value: Text(_compact(traffic.pageviews)),
            ),
            KpiScorecard(
              label: "Visits",
              icon: PhosphorIconsRegular.cursorClick,
              value: Text(_compact(traffic.visits)),
            ),
            KpiScorecard(
              label: "Bounce rate",
              icon: PhosphorIconsRegular.arrowUUpLeft,
              value: Text("${traffic.bounceRate.round()}%"),
            ),
            KpiScorecard(
              label: "Avg. visit",
              icon: PhosphorIconsRegular.timer,
              value: Text(_duration(traffic.avgVisitSeconds)),
            ),
          ],
        ),
        const Gap(AppSpacing.lg),
        MetricBarList(
          title: "Top pages",
          icon: PhosphorIconsRegular.file,
          rows: traffic.topPages,
        ),
        const Gap(AppSpacing.md),
        MetricBarList(
          title: "Top referrers",
          icon: PhosphorIconsRegular.link,
          rows: traffic.topReferrers,
        ),
        const Gap(AppSpacing.md),
        MetricBarList(
          title: "Countries",
          icon: PhosphorIconsRegular.mapPin,
          rows: traffic.topCountries,
          labelFormatter: _country,
        ),
        const Gap(AppSpacing.md),
        MetricBarList(
          title: "Devices",
          icon: PhosphorIconsRegular.deviceMobile,
          rows: traffic.topDevices,
          labelFormatter: _capitalize,
        ),
        if (!traffic.hasAnyTop) ...[
          const Gap(AppSpacing.md),
          Text(
            "No visits recorded yet — breakdowns appear here as shoppers browse your storefront.",
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: c.textMuted),
          ),
        ],
      ],
    );
  }
}

class _RealtimePill extends StatelessWidget {
  const _RealtimePill({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
      decoration: BoxDecoration(
        color: c.successBg,
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        border: Border.all(color: c.successBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: c.success, shape: BoxShape.circle),
          ),
          const Gap(AppSpacing.xs),
          Text(
            "$count online",
            style: text.labelSmall?.copyWith(
              color: c.success,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AnalyticsOffCard extends StatelessWidget {
  const _AnalyticsOffCard();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      color: c.infoBg,
      borderColor: c.infoBorder,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIconsRegular.info, size: 20, color: c.info),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Web analytics isn't on yet",
                  style: text.bodyMedium?.copyWith(
                    color: c.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Gap(AppSpacing.xxs),
                Text(
                  "Your sales numbers are live above. Storefront traffic and visitor insights show here once analytics is switched on for your store.",
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBody extends StatelessWidget {
  const _EmptyBody({required this.range});

  final InsightsRange range;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xxxl),
      child: EmptyState(
        icon: PhosphorIconsRegular.chartLineUp,
        title: "No activity ${range == InsightsRange.today ? "today" : "in this period"} yet",
        message:
            "Sales and visitor insights appear here as orders come in and shoppers browse your store. Try a wider date range.",
      ),
    );
  }
}

/// Full-screen error that still pulls-to-refresh.
class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Padding(
              padding: AppSpacing.screen,
              child: Center(
                child: ErrorStateView(
                  title: "Couldn't load your insights",
                  message: message,
                  onRetry: onRetry,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ------------------------------------------------------------------ helpers

String _compact(int v) {
  if (v >= 1000000) return "${(v / 1000000).toStringAsFixed(1)}M";
  if (v >= 1000) return "${(v / 1000).toStringAsFixed(1)}k";
  return "$v";
}

String _duration(double seconds) {
  if (seconds < 1) return "0s";
  final m = seconds ~/ 60;
  final s = (seconds % 60).round();
  return m > 0 ? "${m}m ${s}s" : "${s}s";
}

String _capitalize(String s) =>
    s.isEmpty ? "Unknown" : s[0].toUpperCase() + s.substring(1);

const Map<String, String> _countries = {
  "US": "United States",
  "GB": "United Kingdom",
  "AU": "Australia",
  "BD": "Bangladesh",
  "IN": "India",
  "CA": "Canada",
  "DE": "Germany",
  "FR": "France",
  "NL": "Netherlands",
  "SG": "Singapore",
};

String _country(String code) =>
    _countries[code.toUpperCase()] ?? (code.isEmpty ? "Unknown" : code);
