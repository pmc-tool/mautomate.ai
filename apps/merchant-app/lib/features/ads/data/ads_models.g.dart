// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ads_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdsConnectionImpl _$$AdsConnectionImplFromJson(Map<String, dynamic> json) =>
    _$AdsConnectionImpl(
      id: json['id'] as String? ?? "",
      platform: json['platform'] as String? ?? "",
      displayName: json['display_name'] as String?,
      status: json['status'] as String? ?? "",
      scopes:
          (json['scopes'] as List<dynamic>?)?.map((e) => e as String).toList(),
      expiresAt: json['expires_at'] as String?,
      connectedAt: json['connected_at'] as String?,
    );

Map<String, dynamic> _$$AdsConnectionImplToJson(_$AdsConnectionImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'platform': instance.platform,
      'display_name': instance.displayName,
      'status': instance.status,
      'scopes': instance.scopes,
      'expires_at': instance.expiresAt,
      'connected_at': instance.connectedAt,
    };

_$AdsAccountImpl _$$AdsAccountImplFromJson(Map<String, dynamic> json) =>
    _$AdsAccountImpl(
      id: json['id'] as String? ?? "",
      connectionId: json['connection_id'] as String? ?? "",
      platform: json['platform'] as String? ?? "",
      externalId: json['external_id'] as String? ?? "",
      name: json['name'] as String?,
      currency: json['currency'] as String?,
      timezone: json['timezone'] as String?,
      status: json['status'] as String? ?? "",
      selected: json['selected'] as bool? ?? false,
      lastSyncedAt: json['last_synced_at'] as String?,
    );

Map<String, dynamic> _$$AdsAccountImplToJson(_$AdsAccountImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'connection_id': instance.connectionId,
      'platform': instance.platform,
      'external_id': instance.externalId,
      'name': instance.name,
      'currency': instance.currency,
      'timezone': instance.timezone,
      'status': instance.status,
      'selected': instance.selected,
      'last_synced_at': instance.lastSyncedAt,
    };

_$AdsPlatformInfoImpl _$$AdsPlatformInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$AdsPlatformInfoImpl(
      platform: json['platform'] as String? ?? "",
      label: json['label'] as String? ?? "",
      connect: json['connect'] as String? ?? "oauth",
      configured: json['configured'] as bool? ?? false,
    );

Map<String, dynamic> _$$AdsPlatformInfoImplToJson(
        _$AdsPlatformInfoImpl instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'label': instance.label,
      'connect': instance.connect,
      'configured': instance.configured,
    };

_$AdsPageImpl _$$AdsPageImplFromJson(Map<String, dynamic> json) =>
    _$AdsPageImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String?,
    );

Map<String, dynamic> _$$AdsPageImplToJson(_$AdsPageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
    };

_$AdsCampaignRowImpl _$$AdsCampaignRowImplFromJson(Map<String, dynamic> json) =>
    _$AdsCampaignRowImpl(
      id: json['id'] as String? ?? "",
      externalId: json['external_id'] as String?,
      platform: json['platform'] as String? ?? "",
      name: json['name'] as String? ?? "",
      objective: json['objective'] as String?,
      status: json['status'] as String? ?? "",
      externalStatus: json['external_status'] as String?,
      source: json['source'] as String? ?? "",
      dailyBudget: json['daily_budget'] as num?,
      lifetimeBudget: json['lifetime_budget'] as num?,
      currency: json['currency'] as String?,
      spend: json['spend'] as num? ?? 0,
      impressions: json['impressions'] as num? ?? 0,
      clicks: json['clicks'] as num? ?? 0,
      conversions: json['conversions'] as num? ?? 0,
      conversionValue: json['conversion_value'] as num? ?? 0,
      lastSyncedAt: json['last_synced_at'] as String?,
    );

Map<String, dynamic> _$$AdsCampaignRowImplToJson(
        _$AdsCampaignRowImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'external_id': instance.externalId,
      'platform': instance.platform,
      'name': instance.name,
      'objective': instance.objective,
      'status': instance.status,
      'external_status': instance.externalStatus,
      'source': instance.source,
      'daily_budget': instance.dailyBudget,
      'lifetime_budget': instance.lifetimeBudget,
      'currency': instance.currency,
      'spend': instance.spend,
      'impressions': instance.impressions,
      'clicks': instance.clicks,
      'conversions': instance.conversions,
      'conversion_value': instance.conversionValue,
      'last_synced_at': instance.lastSyncedAt,
    };

_$AdsTotalsImpl _$$AdsTotalsImplFromJson(Map<String, dynamic> json) =>
    _$AdsTotalsImpl(
      spend: json['spend'] as num? ?? 0,
      impressions: json['impressions'] as num? ?? 0,
      clicks: json['clicks'] as num? ?? 0,
      conversions: json['conversions'] as num? ?? 0,
      conversionValue: json['conversion_value'] as num? ?? 0,
      roas: json['roas'] as num?,
      currency: json['currency'] as String?,
    );

Map<String, dynamic> _$$AdsTotalsImplToJson(_$AdsTotalsImpl instance) =>
    <String, dynamic>{
      'spend': instance.spend,
      'impressions': instance.impressions,
      'clicks': instance.clicks,
      'conversions': instance.conversions,
      'conversion_value': instance.conversionValue,
      'roas': instance.roas,
      'currency': instance.currency,
    };

_$AdsDailyPointImpl _$$AdsDailyPointImplFromJson(Map<String, dynamic> json) =>
    _$AdsDailyPointImpl(
      date: json['date'] as String? ?? "",
      spend: json['spend'] as num? ?? 0,
      conversions: json['conversions'] as num? ?? 0,
    );

Map<String, dynamic> _$$AdsDailyPointImplToJson(_$AdsDailyPointImpl instance) =>
    <String, dynamic>{
      'date': instance.date,
      'spend': instance.spend,
      'conversions': instance.conversions,
    };

_$AdsOverviewImpl _$$AdsOverviewImplFromJson(Map<String, dynamic> json) =>
    _$AdsOverviewImpl(
      days: (json['days'] as num?)?.toInt() ?? 30,
      connections: (json['connections'] as List<dynamic>?)
              ?.map((e) => AdsConnection.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsConnection>[],
      accounts: (json['accounts'] as List<dynamic>?)
              ?.map((e) => AdsAccount.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsAccount>[],
      totals: json['totals'] == null
          ? const AdsTotals()
          : AdsTotals.fromJson(json['totals'] as Map<String, dynamic>),
      campaigns: (json['campaigns'] as List<dynamic>?)
              ?.map((e) => AdsCampaignRow.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsCampaignRow>[],
      daily: (json['daily'] as List<dynamic>?)
              ?.map((e) => AdsDailyPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsDailyPoint>[],
      lastSyncedAt: json['last_synced_at'] as String?,
    );

Map<String, dynamic> _$$AdsOverviewImplToJson(_$AdsOverviewImpl instance) =>
    <String, dynamic>{
      'days': instance.days,
      'connections': instance.connections,
      'accounts': instance.accounts,
      'totals': instance.totals,
      'campaigns': instance.campaigns,
      'daily': instance.daily,
      'last_synced_at': instance.lastSyncedAt,
    };

_$AdsAccountsResponseImpl _$$AdsAccountsResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$AdsAccountsResponseImpl(
      connections: (json['connections'] as List<dynamic>?)
              ?.map((e) => AdsConnection.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsConnection>[],
      accounts: (json['accounts'] as List<dynamic>?)
              ?.map((e) => AdsAccount.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsAccount>[],
      platforms: (json['platforms'] as List<dynamic>?)
              ?.map((e) => AdsPlatformInfo.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsPlatformInfo>[],
    );

Map<String, dynamic> _$$AdsAccountsResponseImplToJson(
        _$AdsAccountsResponseImpl instance) =>
    <String, dynamic>{
      'connections': instance.connections,
      'accounts': instance.accounts,
      'platforms': instance.platforms,
    };

_$AdsSyncSummaryImpl _$$AdsSyncSummaryImplFromJson(Map<String, dynamic> json) =>
    _$AdsSyncSummaryImpl(
      connections: (json['connections'] as num?)?.toInt() ?? 0,
      accounts: (json['accounts'] as num?)?.toInt() ?? 0,
      campaigns: (json['campaigns'] as num?)?.toInt() ?? 0,
      insightRows: (json['insight_rows'] as num?)?.toInt() ?? 0,
      errors: (json['errors'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
    );

Map<String, dynamic> _$$AdsSyncSummaryImplToJson(
        _$AdsSyncSummaryImpl instance) =>
    <String, dynamic>{
      'connections': instance.connections,
      'accounts': instance.accounts,
      'campaigns': instance.campaigns,
      'insight_rows': instance.insightRows,
      'errors': instance.errors,
    };

_$AdsCampaignImpl _$$AdsCampaignImplFromJson(Map<String, dynamic> json) =>
    _$AdsCampaignImpl(
      id: json['id'] as String? ?? "",
      externalId: json['external_id'] as String?,
      platform: json['platform'] as String? ?? "",
      name: json['name'] as String? ?? "",
      objective: json['objective'] as String?,
      status: json['status'] as String? ?? "",
      externalStatus: json['external_status'] as String?,
      source: json['source'] as String? ?? "",
      dailyBudget: json['daily_budget'] as num?,
      lifetimeBudget: json['lifetime_budget'] as num?,
      currency: json['currency'] as String?,
      spec: json['spec'] as Map<String, dynamic>?,
      createdAt: json['created_at'] as String? ?? "",
      lastSyncedAt: json['last_synced_at'] as String?,
      error: json['error'] as String?,
    );

Map<String, dynamic> _$$AdsCampaignImplToJson(_$AdsCampaignImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'external_id': instance.externalId,
      'platform': instance.platform,
      'name': instance.name,
      'objective': instance.objective,
      'status': instance.status,
      'external_status': instance.externalStatus,
      'source': instance.source,
      'daily_budget': instance.dailyBudget,
      'lifetime_budget': instance.lifetimeBudget,
      'currency': instance.currency,
      'spec': instance.spec,
      'created_at': instance.createdAt,
      'last_synced_at': instance.lastSyncedAt,
      'error': instance.error,
    };

_$AdsCreativeImpl _$$AdsCreativeImplFromJson(Map<String, dynamic> json) =>
    _$AdsCreativeImpl(
      headline: json['headline'] as String?,
      primaryText: json['primary_text'] as String?,
      imageUrl: json['image_url'] as String?,
      linkUrl: json['link_url'] as String?,
    );

Map<String, dynamic> _$$AdsCreativeImplToJson(_$AdsCreativeImpl instance) =>
    <String, dynamic>{
      'headline': instance.headline,
      'primary_text': instance.primaryText,
      'image_url': instance.imageUrl,
      'link_url': instance.linkUrl,
    };

_$AdsAdImpl _$$AdsAdImplFromJson(Map<String, dynamic> json) => _$AdsAdImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String?,
      status: json['status'] as String? ?? "",
      creative: json['creative'] == null
          ? null
          : AdsCreative.fromJson(json['creative'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AdsAdImplToJson(_$AdsAdImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'status': instance.status,
      'creative': instance.creative,
    };

_$AdsCampaignDailyImpl _$$AdsCampaignDailyImplFromJson(
        Map<String, dynamic> json) =>
    _$AdsCampaignDailyImpl(
      date: json['date'] as String? ?? "",
      spend: json['spend'] as num? ?? 0,
      clicks: json['clicks'] as num? ?? 0,
      conversions: json['conversions'] as num? ?? 0,
    );

Map<String, dynamic> _$$AdsCampaignDailyImplToJson(
        _$AdsCampaignDailyImpl instance) =>
    <String, dynamic>{
      'date': instance.date,
      'spend': instance.spend,
      'clicks': instance.clicks,
      'conversions': instance.conversions,
    };

_$AdsTimelineEntryImpl _$$AdsTimelineEntryImplFromJson(
        Map<String, dynamic> json) =>
    _$AdsTimelineEntryImpl(
      id: json['id'] as String? ?? "",
      actor: json['actor'] as String? ?? "",
      action: json['action'] as String? ?? "",
      reason: json['reason'] as String?,
      before: json['before'] as Map<String, dynamic>?,
      after: json['after'] as Map<String, dynamic>?,
      at: json['at'] as String? ?? "",
    );

Map<String, dynamic> _$$AdsTimelineEntryImplToJson(
        _$AdsTimelineEntryImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'actor': instance.actor,
      'action': instance.action,
      'reason': instance.reason,
      'before': instance.before,
      'after': instance.after,
      'at': instance.at,
    };

_$AdsCampaignDetailImpl _$$AdsCampaignDetailImplFromJson(
        Map<String, dynamic> json) =>
    _$AdsCampaignDetailImpl(
      campaign: AdsCampaign.fromJson(json['campaign'] as Map<String, dynamic>),
      ads: (json['ads'] as List<dynamic>?)
              ?.map((e) => AdsAd.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsAd>[],
      totals: json['totals'] == null
          ? const AdsTotals()
          : AdsTotals.fromJson(json['totals'] as Map<String, dynamic>),
      daily: (json['daily'] as List<dynamic>?)
              ?.map((e) => AdsCampaignDaily.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsCampaignDaily>[],
      timeline: (json['timeline'] as List<dynamic>?)
              ?.map((e) => AdsTimelineEntry.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <AdsTimelineEntry>[],
    );

Map<String, dynamic> _$$AdsCampaignDetailImplToJson(
        _$AdsCampaignDetailImpl instance) =>
    <String, dynamic>{
      'campaign': instance.campaign,
      'ads': instance.ads,
      'totals': instance.totals,
      'daily': instance.daily,
      'timeline': instance.timeline,
    };

_$CreateAdsCampaignInputImpl _$$CreateAdsCampaignInputImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateAdsCampaignInputImpl(
      platform: json['platform'] as String? ?? "meta",
      name: json['name'] as String? ?? "",
      goal: json['goal'] as String? ?? "sales",
      dailyBudget: json['daily_budget'] as num? ?? 0,
      countries: (json['countries'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      productHandle: json['product_handle'] as String?,
      linkUrl: json['link_url'] as String?,
      headline: json['headline'] as String? ?? "",
      primaryText: json['primary_text'] as String? ?? "",
      imageUrl: json['image_url'] as String?,
      pageId: json['page_id'] as String?,
      startAt: json['start_at'] as String?,
    );

Map<String, dynamic> _$$CreateAdsCampaignInputImplToJson(
        _$CreateAdsCampaignInputImpl instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'name': instance.name,
      'goal': instance.goal,
      'daily_budget': instance.dailyBudget,
      'countries': instance.countries,
      'product_handle': instance.productHandle,
      'link_url': instance.linkUrl,
      'headline': instance.headline,
      'primary_text': instance.primaryText,
      'image_url': instance.imageUrl,
      'page_id': instance.pageId,
      'start_at': instance.startAt,
    };
