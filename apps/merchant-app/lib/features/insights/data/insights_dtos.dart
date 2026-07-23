// Freezed DTOs for the Insights (analytics) surface, mirroring the merchant
// backend JSON the web dashboard consumes:
//   - GET /merchant/analytics        (apps/.../dashboard/analytics/page.tsx)
//   - GET /merchant/orders           (composed like `fetchOverview`)
//   - GET /merchant/products
//
// Only the fields the Insights surface needs are modelled; unknown JSON keys are
// ignored and every field defaults, so a partial/misshaped payload never throws.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern.
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "insights_dtos.freezed.dart";
part "insights_dtos.g.dart";

/// Coerce any JSON scalar to a display string (Umami returns `x` as either a
/// label string or a numeric bucket key; the web client wraps it in `String(...)`).
String _asString(Object? v) => v?.toString() ?? "";

/// Coerce any JSON scalar to a [num] (0 when absent or unparseable).
num _asNum(Object? v) =>
    v is num ? v : num.tryParse(v?.toString() ?? "") ?? 0;

/// One `{ x, y }` point from an Umami series or metric breakdown. `x` is a label
/// (a page path, referrer, country code, or a time-bucket key); `y` is a count.
@freezed
class MetricPoint with _$MetricPoint {
  const factory MetricPoint({
    @JsonKey(fromJson: _asString) @Default("") String x,
    @JsonKey(fromJson: _asNum) @Default(0) num y,
  }) = _MetricPoint;

  factory MetricPoint.fromJson(Map<String, dynamic> json) =>
      _$MetricPointFromJson(json);
}

/// The Umami KPI block from GET /merchant/analytics → `stats`.
@freezed
class AnalyticsStatsDto with _$AnalyticsStatsDto {
  const factory AnalyticsStatsDto({
    @JsonKey(fromJson: _asNum) @Default(0) num pageviews,
    @JsonKey(fromJson: _asNum) @Default(0) num visitors,
    @JsonKey(fromJson: _asNum) @Default(0) num visits,
    @JsonKey(fromJson: _asNum) @Default(0) num bounces,
    @JsonKey(fromJson: _asNum) @Default(0) num totaltime,
  }) = _AnalyticsStatsDto;

  factory AnalyticsStatsDto.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsStatsDtoFromJson(json);
}

/// The metric breakdowns from GET /merchant/analytics → `top`. Only the lists
/// the Insights surface renders are modelled.
@freezed
class AnalyticsTopDto with _$AnalyticsTopDto {
  const factory AnalyticsTopDto({
    @Default(<MetricPoint>[]) List<MetricPoint> pages,
    @Default(<MetricPoint>[]) List<MetricPoint> referrers,
    @Default(<MetricPoint>[]) List<MetricPoint> countries,
    @Default(<MetricPoint>[]) List<MetricPoint> devices,
  }) = _AnalyticsTopDto;

  factory AnalyticsTopDto.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsTopDtoFromJson(json);
}

/// GET /merchant/analytics — the store's web analytics (traffic). `enabled` is
/// false when the platform hasn't switched Umami on; the surface then falls
/// back to commerce-only insights. `stats`/`top` are null when a website exists
/// but has no data yet.
@freezed
class MerchantAnalyticsDto with _$MerchantAnalyticsDto {
  const factory MerchantAnalyticsDto({
    @Default(false) bool enabled,
    String? range,
    @JsonKey(fromJson: _asNum) @Default(0) num realtime,
    AnalyticsStatsDto? stats,
    AnalyticsTopDto? top,
  }) = _MerchantAnalyticsDto;

  factory MerchantAnalyticsDto.fromJson(Map<String, dynamic> json) =>
      _$MerchantAnalyticsDtoFromJson(json);
}

/// A row from GET /merchant/orders. Totals are in MAJOR currency units already
/// (the web overview formats `order.total` directly), so [MoneyText] uses
/// `minorUnits: false`.
@freezed
class InsightsOrderDto with _$InsightsOrderDto {
  const factory InsightsOrderDto({
    @Default("") String id,
    @JsonKey(name: "created_at") String? createdAt,
    @JsonKey(fromJson: _asNum) @Default(0) num total,
    @JsonKey(name: "currency_code") @Default("usd") String currencyCode,
  }) = _InsightsOrderDto;

  factory InsightsOrderDto.fromJson(Map<String, dynamic> json) =>
      _$InsightsOrderDtoFromJson(json);
}

/// A row from GET /merchant/products — only what "products live" needs.
@freezed
class InsightsProductDto with _$InsightsProductDto {
  const factory InsightsProductDto({
    @Default("") String id,
    @Default("") String status,
    Map<String, dynamic>? metadata,
  }) = _InsightsProductDto;

  factory InsightsProductDto.fromJson(Map<String, dynamic> json) =>
      _$InsightsProductDtoFromJson(json);
}
