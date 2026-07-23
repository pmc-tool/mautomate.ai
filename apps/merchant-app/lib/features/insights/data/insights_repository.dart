// Transport + aggregation for the Insights surface. Mirrors the web
// dashboard, which composes two primitives client-side (like `fetchOverview`):
//   - GET /merchant/analytics?range=  → the storefront's web traffic (Umami)
//   - GET /merchant/orders?from=&to=  → the commerce numbers + revenue series
// plus GET /merchant/products (products live) and GET /merchant/customers.
//
// Fault model: the COMMERCE aggregate (orders/products) must load for the
// screen to mean anything, so a failure there propagates as an [ApiError].
// Web analytics is best-effort ENRICHMENT — a disabled module or a transient
// error simply drops the traffic section instead of blanking the screen.
import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "insights_dtos.dart";
import "insights_models.dart";

class InsightsRepository {
  InsightsRepository(this._dio);

  final Dio _dio;

  Map<String, dynamic> _asMap(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  List<dynamic> _asList(Object? v) => v is List ? v : const [];

  /// Loads and composes the whole Insights snapshot for [range].
  Future<InsightsSnapshot> fetchInsights(InsightsRange range) async {
    final now = DateTime.now();
    final window = _windowFor(range, now);

    // Commerce (required) — current + previous window for trend, plus catalog.
    // Traffic (best-effort) runs alongside; its failure is swallowed to null.
    final results = await Future.wait([
      _listOrders(from: window.start, to: window.end), // 0
      _listOrders(from: window.prevStart, to: window.start), // 1
      _listProducts(), // 2
      _customerCount(), // 3
      _analytics(range.umamiKey), // 4 (nullable)
    ]);

    final current = results[0] as List<InsightsOrderDto>;
    final previous = results[1] as List<InsightsOrderDto>;
    final products = results[2] as List<InsightsProductDto>;
    final customers = results[3] as int;
    final analytics = results[4] as MerchantAnalyticsDto?;

    final stats = _deriveStats(
      current: current,
      previous: previous,
      products: products,
      customers: customers,
    );

    final series = _bucketSeries(current, range, window, now);
    final traffic = _deriveTraffic(analytics, orderCount: current.length);

    return InsightsSnapshot(
      range: range,
      stats: stats,
      series: series,
      traffic: traffic,
      analyticsEnabled: analytics?.enabled ?? false,
    );
  }

  // ------------------------------------------------------------- core fetch

  Future<List<InsightsOrderDto>> _listOrders({
    required DateTime from,
    required DateTime to,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/orders",
        queryParameters: {
          "from": from.toUtc().toIso8601String(),
          "to": to.toUtc().toIso8601String(),
        },
      );
      return _asList(_asMap(res.data)["orders"])
          .map((e) => InsightsOrderDto.fromJson(_asMap(e)))
          .toList();
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load sales");
    }
  }

  Future<List<InsightsProductDto>> _listProducts() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/products");
      return _asList(_asMap(res.data)["products"])
          .map((e) => InsightsProductDto.fromJson(_asMap(e)))
          .toList();
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load products");
    }
  }

  Future<int> _customerCount() async {
    // Best-effort: a customers failure shouldn't sink the whole screen.
    try {
      final res = await _dio.get<dynamic>("/merchant/customers");
      final data = _asMap(res.data);
      final count = data["count"];
      if (count is num) return count.toInt();
      return _asList(data["customers"]).length;
    } catch (_) {
      return 0;
    }
  }

  Future<MerchantAnalyticsDto?> _analytics(String rangeKey) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/analytics",
        queryParameters: {"range": rangeKey},
      );
      return MerchantAnalyticsDto.fromJson(_asMap(res.data));
    } catch (_) {
      return null;
    }
  }

  // ------------------------------------------------------------- derivation

  InsightsStats _deriveStats({
    required List<InsightsOrderDto> current,
    required List<InsightsOrderDto> previous,
    required List<InsightsProductDto> products,
    required int customers,
  }) {
    num revenue = 0;
    for (final o in current) {
      revenue += o.total;
    }
    num prevRevenue = 0;
    for (final o in previous) {
      prevRevenue += o.total;
    }

    final orderCount = current.length;
    final avg = orderCount > 0 ? revenue / orderCount : 0;

    final productsLive = products
        .where((p) => p.status == "published" && p.metadata?["is_sample"] != true)
        .length;

    final currencyCode =
        current.isNotEmpty ? current.first.currencyCode : "usd";

    return InsightsStats(
      revenue: revenue,
      orderCount: orderCount,
      avgOrderValue: avg,
      productsLive: productsLive,
      customers: customers,
      currencyCode: currencyCode,
      revenueTrend: _trend(revenue, prevRevenue),
      ordersTrend: _trend(orderCount, previous.length),
    );
  }

  /// Period-over-period change. A zero baseline with current activity is "New"
  /// (no honest percentage exists); zero-to-zero is [TrendDelta.none].
  TrendDelta _trend(num current, num previous) {
    if (previous == 0) {
      return current > 0
          ? const TrendDelta(percent: null, isNew: true)
          : TrendDelta.none;
    }
    final pct = ((current - previous) / previous) * 100;
    return TrendDelta(percent: pct, isNew: false);
  }

  /// Bucket orders into an ordered series spanning the whole window. "Today"
  /// buckets hourly (up to the current hour); multi-day ranges bucket daily.
  /// Empty buckets are kept at 0 so the chart shows real gaps.
  List<TimeBucket> _bucketSeries(
    List<InsightsOrderDto> orders,
    InsightsRange range,
    _Window window,
    DateTime now,
  ) {
    final hourly = range == InsightsRange.today;

    // Pre-build empty buckets keyed by their period start.
    final buckets = <DateTime, _MutableBucket>{};
    final keys = <DateTime>[];

    if (hourly) {
      final start = DateTime(now.year, now.month, now.day);
      for (var h = 0; h <= now.hour; h++) {
        final k = start.add(Duration(hours: h));
        keys.add(k);
        buckets[k] = _MutableBucket();
      }
    } else {
      final days = window.end.difference(
            DateTime(window.start.year, window.start.month, window.start.day),
          ).inDays +
          1;
      final start = DateTime(window.start.year, window.start.month, window.start.day);
      for (var d = 0; d < days; d++) {
        final k = DateTime(start.year, start.month, start.day + d);
        keys.add(k);
        buckets[k] = _MutableBucket();
      }
    }

    for (final o in orders) {
      final created = DateTime.tryParse(o.createdAt ?? "")?.toLocal();
      if (created == null) continue;
      final key = hourly
          ? DateTime(created.year, created.month, created.day, created.hour)
          : DateTime(created.year, created.month, created.day);
      final b = buckets[key];
      if (b == null) continue;
      b.revenue += o.total;
      b.orders += 1;
    }

    return [
      for (final k in keys)
        TimeBucket(
          label: hourly ? _hourLabel(k) : _dayLabel(k),
          revenue: buckets[k]!.revenue,
          orders: buckets[k]!.orders,
        ),
    ];
  }

  TrafficStats? _deriveTraffic(
    MerchantAnalyticsDto? a, {
    required int orderCount,
  }) {
    if (a == null || !a.enabled) return null;
    final s = a.stats;
    if (s == null) return null;

    final visits = s.visits.toInt();
    final bounceRate = visits > 0 ? (s.bounces / visits) * 100 : 0.0;
    final avgVisit = visits > 0 ? s.totaltime / visits : 0.0;
    final perVisit = visits > 0 ? s.pageviews / visits : 0.0;
    final conversion = visits > 0 ? (orderCount / visits) * 100 : null;

    List<MetricRow> rows(List<MetricPoint>? pts) => (pts ?? const [])
        .where((p) => p.y > 0)
        .map((p) => MetricRow(label: p.x, value: p.y))
        .toList();

    final top = a.top;
    return TrafficStats(
      visitors: s.visitors.toInt(),
      pageviews: s.pageviews.toInt(),
      visits: visits,
      bounceRate: bounceRate.toDouble(),
      avgVisitSeconds: avgVisit.toDouble(),
      viewsPerVisit: perVisit.toDouble(),
      realtime: a.realtime.toInt(),
      conversionRate: conversion?.toDouble(),
      topPages: rows(top?.pages),
      topReferrers: rows(top?.referrers),
      topCountries: rows(top?.countries),
      topDevices: rows(top?.devices),
    );
  }

  // ---------------------------------------------------------------- helpers

  _Window _windowFor(InsightsRange range, DateTime now) {
    switch (range) {
      case InsightsRange.today:
        final start = DateTime(now.year, now.month, now.day);
        final prevStart = start.subtract(const Duration(days: 1));
        return _Window(start: start, end: now, prevStart: prevStart);
      case InsightsRange.sevenDays:
        final start = now.subtract(const Duration(days: 7));
        final prevStart = now.subtract(const Duration(days: 14));
        return _Window(start: start, end: now, prevStart: prevStart);
      case InsightsRange.thirtyDays:
        final start = now.subtract(const Duration(days: 30));
        final prevStart = now.subtract(const Duration(days: 60));
        return _Window(start: start, end: now, prevStart: prevStart);
    }
  }

  static const _months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  String _dayLabel(DateTime d) => "${_months[d.month - 1]} ${d.day}";

  String _hourLabel(DateTime d) {
    final h = d.hour;
    final suffix = h < 12 ? "am" : "pm";
    final display = h % 12 == 0 ? 12 : h % 12;
    return "$display$suffix";
  }
}

/// A resolved date window: the current period, its end, and where the previous
/// (comparison) period begins.
class _Window {
  const _Window({
    required this.start,
    required this.end,
    required this.prevStart,
  });

  final DateTime start;
  final DateTime end;
  final DateTime prevStart;
}

class _MutableBucket {
  num revenue = 0;
  int orders = 0;
}

/// Insights data-access, bound to the shared authenticated [dioProvider].
final insightsRepositoryProvider = Provider<InsightsRepository>(
  (ref) => InsightsRepository(ref.read(dioProvider)),
);
