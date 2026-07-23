// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'marketing_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MarketingPostsSummaryImpl _$$MarketingPostsSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$MarketingPostsSummaryImpl(
      total: (json['total'] as num?)?.toInt() ?? 0,
      byStatus: (json['by_status'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, (e as num).toInt()),
          ) ??
          const <String, int>{},
    );

Map<String, dynamic> _$$MarketingPostsSummaryImplToJson(
        _$MarketingPostsSummaryImpl instance) =>
    <String, dynamic>{
      'total': instance.total,
      'by_status': instance.byStatus,
    };

_$MarketingSummaryImpl _$$MarketingSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$MarketingSummaryImpl(
      posts: json['posts'] == null
          ? null
          : MarketingPostsSummary.fromJson(
              json['posts'] as Map<String, dynamic>),
      scheduledNext7d: (json['scheduled_next_7d'] as num?)?.toInt() ?? 0,
      brandVoiceCount: (json['brand_voice_count'] as num?)?.toInt() ?? 0,
      connectedAccountsCount:
          (json['connected_accounts_count'] as num?)?.toInt() ?? 0,
      recentConversationsCount:
          (json['recent_conversations_count'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$MarketingSummaryImplToJson(
        _$MarketingSummaryImpl instance) =>
    <String, dynamic>{
      'posts': instance.posts,
      'scheduled_next_7d': instance.scheduledNext7d,
      'brand_voice_count': instance.brandVoiceCount,
      'connected_accounts_count': instance.connectedAccountsCount,
      'recent_conversations_count': instance.recentConversationsCount,
    };

_$MarketingPostTargetImpl _$$MarketingPostTargetImplFromJson(
        Map<String, dynamic> json) =>
    _$MarketingPostTargetImpl(
      id: json['id'] as String? ?? "",
      platform: json['platform'] as String? ?? "",
      socialAccountId: json['social_account_id'] as String?,
      status: json['status'] as String? ?? "pending",
      overrideBody: json['override_body'] as String?,
      overrideHashtags: (json['override_hashtags'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      scheduledAt: json['scheduled_at'] as String?,
      publishedAt: json['published_at'] as String?,
      externalUrl: json['external_url'] as String?,
      error: json['error'] as String?,
    );

Map<String, dynamic> _$$MarketingPostTargetImplToJson(
        _$MarketingPostTargetImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'platform': instance.platform,
      'social_account_id': instance.socialAccountId,
      'status': instance.status,
      'override_body': instance.overrideBody,
      'override_hashtags': instance.overrideHashtags,
      'scheduled_at': instance.scheduledAt,
      'published_at': instance.publishedAt,
      'external_url': instance.externalUrl,
      'error': instance.error,
    };

_$MarketingPostMediaImpl _$$MarketingPostMediaImplFromJson(
        Map<String, dynamic> json) =>
    _$MarketingPostMediaImpl(
      id: json['id'] as String? ?? "",
      kind: json['kind'] as String? ?? "image",
      url: json['url'] as String?,
      alt: json['alt'] as String?,
      position: (json['position'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$MarketingPostMediaImplToJson(
        _$MarketingPostMediaImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': instance.kind,
      'url': instance.url,
      'alt': instance.alt,
      'position': instance.position,
    };

_$MarketingPostImpl _$$MarketingPostImplFromJson(Map<String, dynamic> json) =>
    _$MarketingPostImpl(
      id: json['id'] as String? ?? "",
      status: json['status'] as String? ?? "draft",
      title: json['title'] as String?,
      body: json['body'] as String?,
      source: json['source'] as String? ?? "manual",
      hashtags: (json['hashtags'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      linkUrl: json['link_url'] as String?,
      campaignId: json['campaign_id'] as String?,
      createdAt: json['created_at'] as String? ?? "",
      updatedAt: json['updated_at'] as String? ?? "",
      targets: (json['targets'] as List<dynamic>?)
          ?.map((e) => MarketingPostTarget.fromJson(e as Map<String, dynamic>))
          .toList(),
      media: (json['media'] as List<dynamic>?)
          ?.map((e) => MarketingPostMedia.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$MarketingPostImplToJson(_$MarketingPostImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'title': instance.title,
      'body': instance.body,
      'source': instance.source,
      'hashtags': instance.hashtags,
      'link_url': instance.linkUrl,
      'campaign_id': instance.campaignId,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
      'targets': instance.targets,
      'media': instance.media,
    };

_$SocialAccountImpl _$$SocialAccountImplFromJson(Map<String, dynamic> json) =>
    _$SocialAccountImpl(
      id: json['id'] as String? ?? "",
      platform: json['platform'] as String? ?? "",
      handle: json['handle'] as String?,
      displayName: json['display_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      status: json['status'] as String? ?? "connected",
      connectedAt: json['connected_at'] as String?,
    );

Map<String, dynamic> _$$SocialAccountImplToJson(_$SocialAccountImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'platform': instance.platform,
      'handle': instance.handle,
      'display_name': instance.displayName,
      'avatar_url': instance.avatarUrl,
      'status': instance.status,
      'connected_at': instance.connectedAt,
    };

_$SocialProviderImpl _$$SocialProviderImplFromJson(Map<String, dynamic> json) =>
    _$SocialProviderImpl(
      platform: json['platform'] as String? ?? "",
      label: json['label'] as String? ?? "",
      configured: json['configured'] as bool? ?? false,
      connect: json['connect'] as String? ?? "oauth",
      connected: json['connected'] as bool? ?? false,
    );

Map<String, dynamic> _$$SocialProviderImplToJson(
        _$SocialProviderImpl instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'label': instance.label,
      'configured': instance.configured,
      'connect': instance.connect,
      'connected': instance.connected,
    };

_$MarketingCampaignImpl _$$MarketingCampaignImplFromJson(
        Map<String, dynamic> json) =>
    _$MarketingCampaignImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String? ?? "",
      objective: json['objective'] as String?,
      status: json['status'] as String? ?? "draft",
      startsAt: json['starts_at'] as String?,
      endsAt: json['ends_at'] as String?,
      productIds: (json['product_ids'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      createdAt: json['created_at'] as String? ?? "",
      updatedAt: json['updated_at'] as String? ?? "",
    );

Map<String, dynamic> _$$MarketingCampaignImplToJson(
        _$MarketingCampaignImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'objective': instance.objective,
      'status': instance.status,
      'starts_at': instance.startsAt,
      'ends_at': instance.endsAt,
      'product_ids': instance.productIds,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
    };
