// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'insights_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MetricPointImpl _$$MetricPointImplFromJson(Map<String, dynamic> json) =>
    _$MetricPointImpl(
      x: json['x'] == null ? "" : _asString(json['x']),
      y: json['y'] == null ? 0 : _asNum(json['y']),
    );

Map<String, dynamic> _$$MetricPointImplToJson(_$MetricPointImpl instance) =>
    <String, dynamic>{
      'x': instance.x,
      'y': instance.y,
    };

_$AnalyticsStatsDtoImpl _$$AnalyticsStatsDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$AnalyticsStatsDtoImpl(
      pageviews: json['pageviews'] == null ? 0 : _asNum(json['pageviews']),
      visitors: json['visitors'] == null ? 0 : _asNum(json['visitors']),
      visits: json['visits'] == null ? 0 : _asNum(json['visits']),
      bounces: json['bounces'] == null ? 0 : _asNum(json['bounces']),
      totaltime: json['totaltime'] == null ? 0 : _asNum(json['totaltime']),
    );

Map<String, dynamic> _$$AnalyticsStatsDtoImplToJson(
        _$AnalyticsStatsDtoImpl instance) =>
    <String, dynamic>{
      'pageviews': instance.pageviews,
      'visitors': instance.visitors,
      'visits': instance.visits,
      'bounces': instance.bounces,
      'totaltime': instance.totaltime,
    };

_$AnalyticsTopDtoImpl _$$AnalyticsTopDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$AnalyticsTopDtoImpl(
      pages: (json['pages'] as List<dynamic>?)
              ?.map((e) => MetricPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <MetricPoint>[],
      referrers: (json['referrers'] as List<dynamic>?)
              ?.map((e) => MetricPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <MetricPoint>[],
      countries: (json['countries'] as List<dynamic>?)
              ?.map((e) => MetricPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <MetricPoint>[],
      devices: (json['devices'] as List<dynamic>?)
              ?.map((e) => MetricPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <MetricPoint>[],
    );

Map<String, dynamic> _$$AnalyticsTopDtoImplToJson(
        _$AnalyticsTopDtoImpl instance) =>
    <String, dynamic>{
      'pages': instance.pages,
      'referrers': instance.referrers,
      'countries': instance.countries,
      'devices': instance.devices,
    };

_$MerchantAnalyticsDtoImpl _$$MerchantAnalyticsDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$MerchantAnalyticsDtoImpl(
      enabled: json['enabled'] as bool? ?? false,
      range: json['range'] as String?,
      realtime: json['realtime'] == null ? 0 : _asNum(json['realtime']),
      stats: json['stats'] == null
          ? null
          : AnalyticsStatsDto.fromJson(json['stats'] as Map<String, dynamic>),
      top: json['top'] == null
          ? null
          : AnalyticsTopDto.fromJson(json['top'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$MerchantAnalyticsDtoImplToJson(
        _$MerchantAnalyticsDtoImpl instance) =>
    <String, dynamic>{
      'enabled': instance.enabled,
      'range': instance.range,
      'realtime': instance.realtime,
      'stats': instance.stats,
      'top': instance.top,
    };

_$InsightsOrderDtoImpl _$$InsightsOrderDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$InsightsOrderDtoImpl(
      id: json['id'] as String? ?? "",
      createdAt: json['created_at'] as String?,
      total: json['total'] == null ? 0 : _asNum(json['total']),
      currencyCode: json['currency_code'] as String? ?? "usd",
    );

Map<String, dynamic> _$$InsightsOrderDtoImplToJson(
        _$InsightsOrderDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'created_at': instance.createdAt,
      'total': instance.total,
      'currency_code': instance.currencyCode,
    };

_$InsightsProductDtoImpl _$$InsightsProductDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$InsightsProductDtoImpl(
      id: json['id'] as String? ?? "",
      status: json['status'] as String? ?? "",
      metadata: json['metadata'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$InsightsProductDtoImplToJson(
        _$InsightsProductDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'metadata': instance.metadata,
    };
