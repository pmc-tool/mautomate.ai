// Computed view-models for the Insights surface — derived in the repository
// from the raw DTOs, so the screen renders pure data. Not parsed from JSON, so
// these stay hand-written (no codegen).
import "package:flutter/widgets.dart";

/// The date window the merchant is looking at. Drives BOTH the commerce query
/// (orders `from`/`to`) and the Umami `range` key.
enum InsightsRange { today, sevenDays, thirtyDays }

extension InsightsRangeX on InsightsRange {
  /// Short label for the segmented switcher.
  String get label {
    switch (this) {
      case InsightsRange.today:
        return "Today";
      case InsightsRange.sevenDays:
        return "7 days";
      case InsightsRange.thirtyDays:
        return "30 days";
    }
  }

  /// The Umami range key expected by GET /merchant/analytics?range=.
  String get umamiKey {
    switch (this) {
      case InsightsRange.today:
        return "24h";
      case InsightsRange.sevenDays:
        return "7d";
      case InsightsRange.thirtyDays:
        return "30d";
    }
  }

  /// Human phrase for the comparison line ("vs previous 7 days").
  String get comparePhrase {
    switch (this) {
      case InsightsRange.today:
        return "vs yesterday";
      case InsightsRange.sevenDays:
        return "vs previous 7 days";
      case InsightsRange.thirtyDays:
        return "vs previous 30 days";
    }
  }
}

/// A period-over-period change for a KPI. [percent] is null when there is no
/// prior baseline to divide by (a brand-new metric) — the card then reads as
/// "New" rather than a misleading "+100%".
@immutable
class TrendDelta {
  const TrendDelta({required this.percent, required this.isNew});

  /// Signed percentage change (e.g. -12.5 or 30.0). Null when [isNew].
  final double? percent;

  /// True when there was activity now but none in the prior window.
  final bool isNew;

  bool get isUp => (percent ?? 0) >= 0;

  /// No prior data and no current data — nothing meaningful to show.
  static const none = TrendDelta(percent: null, isNew: false);

  bool get hasValue => isNew || percent != null;
}

/// One point on the revenue/orders time-series, already bucketed and labelled.
@immutable
class TimeBucket {
  const TimeBucket({
    required this.label,
    required this.revenue,
    required this.orders,
  });

  /// Short axis label for the endpoint tooltip / accessibility.
  final String label;
  final num revenue;
  final int orders;
}

/// A labelled value row for a breakdown list (top pages, referrers, …).
@immutable
class MetricRow {
  const MetricRow({required this.label, required this.value});

  final String label;
  final num value;
}

/// The headline commerce numbers for the selected range.
@immutable
class InsightsStats {
  const InsightsStats({
    required this.revenue,
    required this.orderCount,
    required this.avgOrderValue,
    required this.productsLive,
    required this.customers,
    required this.currencyCode,
    required this.revenueTrend,
    required this.ordersTrend,
  });

  final num revenue;
  final int orderCount;
  final num avgOrderValue;
  final int productsLive;
  final int customers;
  final String currencyCode;
  final TrendDelta revenueTrend;
  final TrendDelta ordersTrend;
}

/// The web-traffic slice of Insights (from Umami). Absent when analytics isn't
/// enabled for the platform or the store has no website yet.
@immutable
class TrafficStats {
  const TrafficStats({
    required this.visitors,
    required this.pageviews,
    required this.visits,
    required this.bounceRate,
    required this.avgVisitSeconds,
    required this.viewsPerVisit,
    required this.realtime,
    required this.conversionRate,
    required this.topPages,
    required this.topReferrers,
    required this.topCountries,
    required this.topDevices,
  });

  final int visitors;
  final int pageviews;
  final int visits;

  /// 0–100.
  final double bounceRate;
  final double avgVisitSeconds;
  final double viewsPerVisit;
  final int realtime;

  /// Orders ÷ visits × 100. Null when there are no visits to divide by.
  final double? conversionRate;

  final List<MetricRow> topPages;
  final List<MetricRow> topReferrers;
  final List<MetricRow> topCountries;
  final List<MetricRow> topDevices;

  bool get hasAnyTop =>
      topPages.isNotEmpty ||
      topReferrers.isNotEmpty ||
      topCountries.isNotEmpty ||
      topDevices.isNotEmpty;
}

/// Everything the Insights screen renders in one immutable snapshot.
@immutable
class InsightsSnapshot {
  const InsightsSnapshot({
    required this.range,
    required this.stats,
    required this.series,
    required this.traffic,
    required this.analyticsEnabled,
  });

  final InsightsRange range;
  final InsightsStats stats;

  /// Ordered buckets spanning the whole range (empty buckets included as 0, so
  /// the chart reads honestly rather than collapsing gaps).
  final List<TimeBucket> series;

  /// Null when web analytics is off or the store has no traffic data yet.
  final TrafficStats? traffic;

  /// Whether the platform has web analytics switched on at all (drives the
  /// "analytics not enabled" hint vs. a genuine empty period).
  final bool analyticsEnabled;

  /// True when there's genuinely nothing to show for this range.
  bool get isEmpty =>
      stats.orderCount == 0 &&
      series.every((b) => b.revenue == 0 && b.orders == 0) &&
      (traffic == null || traffic!.pageviews == 0);
}
