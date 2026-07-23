// DTOs for the merchant Advertising feature, mirroring the web client's Ads*
// types (apps/storefront/src/lib/merchant-admin/api.ts) field-for-field —
// connections, ad accounts, the campaign rows + overview aggregation, and the
// campaign detail (ads, totals, daily series, action timeline).
//
// freezed + json_serializable so parsing, equality and copyWith are generated.
// Field names are snake_case on the wire, camelCase in Dart via @JsonKey.
//
// Run codegen after editing:
//   dart run build_runner build --delete-conflicting-outputs
//
// `invalid_annotation_target` is suppressed because @JsonKey on a freezed
// factory parameter is the documented, generator-supported pattern (same
// convention as the Orders/Products/Jarvis DTOs).
// ignore_for_file: invalid_annotation_target
import "package:freezed_annotation/freezed_annotation.dart";

part "ads_models.freezed.dart";
part "ads_models.g.dart";

/// A linked ad-platform account (an OAuth grant). Mirrors the web
/// `AdsConnection`.
@freezed
class AdsConnection with _$AdsConnection {
  const factory AdsConnection({
    @Default("") String id,
    @Default("") String platform,
    @JsonKey(name: "display_name") String? displayName,
    @Default("") String status,
    List<String>? scopes,
    @JsonKey(name: "expires_at") String? expiresAt,
    @JsonKey(name: "connected_at") String? connectedAt,
  }) = _AdsConnection;

  factory AdsConnection.fromJson(Map<String, dynamic> json) =>
      _$AdsConnectionFromJson(json);
}

/// An ad account discovered under a [AdsConnection]. Mirrors `AdsAccount`.
@freezed
class AdsAccount with _$AdsAccount {
  const factory AdsAccount({
    @Default("") String id,
    @JsonKey(name: "connection_id") @Default("") String connectionId,
    @Default("") String platform,
    @JsonKey(name: "external_id") @Default("") String externalId,
    String? name,
    String? currency,
    String? timezone,
    @Default("") String status,
    @Default(false) bool selected,
    @JsonKey(name: "last_synced_at") String? lastSyncedAt,
  }) = _AdsAccount;

  factory AdsAccount.fromJson(Map<String, dynamic> json) =>
      _$AdsAccountFromJson(json);
}

/// A connectable ad platform (meta / google / tiktok / mock). Mirrors
/// `AdsPlatformInfo`.
@freezed
class AdsPlatformInfo with _$AdsPlatformInfo {
  const factory AdsPlatformInfo({
    @Default("") String platform,
    @Default("") String label,
    @Default("oauth") String connect,
    @Default(false) bool configured,
  }) = _AdsPlatformInfo;

  factory AdsPlatformInfo.fromJson(Map<String, dynamic> json) =>
      _$AdsPlatformInfoFromJson(json);
}

/// A Facebook Page / identity the ad can publish as (GET /merchant/ads/pages).
/// Meta requires one for a campaign; the create form makes the merchant pick it.
@freezed
class AdsPage with _$AdsPage {
  const factory AdsPage({
    @Default("") String id,
    String? name,
  }) = _AdsPage;

  factory AdsPage.fromJson(Map<String, dynamic> json) =>
      _$AdsPageFromJson(json);
}

/// A campaign row in the overview/campaigns table. Mirrors `AdsCampaignRow`.
@freezed
class AdsCampaignRow with _$AdsCampaignRow {
  const factory AdsCampaignRow({
    @Default("") String id,
    @JsonKey(name: "external_id") String? externalId,
    @Default("") String platform,
    @Default("") String name,
    String? objective,
    @Default("") String status,
    @JsonKey(name: "external_status") String? externalStatus,
    @Default("") String source,
    @JsonKey(name: "daily_budget") num? dailyBudget,
    @JsonKey(name: "lifetime_budget") num? lifetimeBudget,
    String? currency,
    @Default(0) num spend,
    @Default(0) num impressions,
    @Default(0) num clicks,
    @Default(0) num conversions,
    @JsonKey(name: "conversion_value") @Default(0) num conversionValue,
    @JsonKey(name: "last_synced_at") String? lastSyncedAt,
  }) = _AdsCampaignRow;

  factory AdsCampaignRow.fromJson(Map<String, dynamic> json) =>
      _$AdsCampaignRowFromJson(json);
}

/// Aggregate totals across the selected window. Mirrors `AdsOverview.totals`.
@freezed
class AdsTotals with _$AdsTotals {
  const factory AdsTotals({
    @Default(0) num spend,
    @Default(0) num impressions,
    @Default(0) num clicks,
    @Default(0) num conversions,
    @JsonKey(name: "conversion_value") @Default(0) num conversionValue,
    num? roas,
    String? currency,
  }) = _AdsTotals;

  factory AdsTotals.fromJson(Map<String, dynamic> json) =>
      _$AdsTotalsFromJson(json);
}

/// A single day in the spend series. Mirrors `AdsOverview.daily[]`.
@freezed
class AdsDailyPoint with _$AdsDailyPoint {
  const factory AdsDailyPoint({
    @Default("") String date,
    @Default(0) num spend,
    @Default(0) num conversions,
  }) = _AdsDailyPoint;

  factory AdsDailyPoint.fromJson(Map<String, dynamic> json) =>
      _$AdsDailyPointFromJson(json);
}

/// GET /merchant/ads/overview -> the whole Advertising overview payload.
/// Mirrors `AdsOverview`.
@freezed
class AdsOverview with _$AdsOverview {
  const factory AdsOverview({
    @Default(30) int days,
    @Default(<AdsConnection>[]) List<AdsConnection> connections,
    @Default(<AdsAccount>[]) List<AdsAccount> accounts,
    @Default(AdsTotals()) AdsTotals totals,
    @Default(<AdsCampaignRow>[]) List<AdsCampaignRow> campaigns,
    @Default(<AdsDailyPoint>[]) List<AdsDailyPoint> daily,
    @JsonKey(name: "last_synced_at") String? lastSyncedAt,
  }) = _AdsOverview;

  factory AdsOverview.fromJson(Map<String, dynamic> json) =>
      _$AdsOverviewFromJson(json);

  const AdsOverview._();

  /// True once at least one connection is in the "connected" state.
  bool get hasConnection =>
      connections.any((c) => c.status == "connected");

  /// True once the ad account has at least one campaign.
  bool get hasCampaigns => campaigns.isNotEmpty;
}

/// GET /merchant/ads/accounts -> connections + accounts + platforms. Mirrors
/// `AdsAccountsResponse`.
@freezed
class AdsAccountsResponse with _$AdsAccountsResponse {
  const factory AdsAccountsResponse({
    @Default(<AdsConnection>[]) List<AdsConnection> connections,
    @Default(<AdsAccount>[]) List<AdsAccount> accounts,
    @Default(<AdsPlatformInfo>[]) List<AdsPlatformInfo> platforms,
  }) = _AdsAccountsResponse;

  factory AdsAccountsResponse.fromJson(Map<String, dynamic> json) =>
      _$AdsAccountsResponseFromJson(json);
}

/// POST /merchant/ads/sync -> a summary of what the sync touched. Mirrors
/// `AdsSyncSummary`.
@freezed
class AdsSyncSummary with _$AdsSyncSummary {
  const factory AdsSyncSummary({
    @Default(0) int connections,
    @Default(0) int accounts,
    @Default(0) int campaigns,
    @JsonKey(name: "insight_rows") @Default(0) int insightRows,
    @Default(<String>[]) List<String> errors,
  }) = _AdsSyncSummary;

  factory AdsSyncSummary.fromJson(Map<String, dynamic> json) =>
      _$AdsSyncSummaryFromJson(json);
}

// --- Campaign detail ---------------------------------------------------------

/// The core campaign record inside the detail payload. Mirrors
/// `AdsCampaignDetail.campaign`.
@freezed
class AdsCampaign with _$AdsCampaign {
  const factory AdsCampaign({
    @Default("") String id,
    @JsonKey(name: "external_id") String? externalId,
    @Default("") String platform,
    @Default("") String name,
    String? objective,
    @Default("") String status,
    @JsonKey(name: "external_status") String? externalStatus,
    @Default("") String source,
    @JsonKey(name: "daily_budget") num? dailyBudget,
    @JsonKey(name: "lifetime_budget") num? lifetimeBudget,
    String? currency,
    Map<String, dynamic>? spec,
    @JsonKey(name: "created_at") @Default("") String createdAt,
    @JsonKey(name: "last_synced_at") String? lastSyncedAt,
    String? error,
  }) = _AdsCampaign;

  factory AdsCampaign.fromJson(Map<String, dynamic> json) =>
      _$AdsCampaignFromJson(json);
}

/// The creative attached to an ad. Mirrors `AdsCampaignDetail.ads[].creative`.
@freezed
class AdsCreative with _$AdsCreative {
  const factory AdsCreative({
    String? headline,
    @JsonKey(name: "primary_text") String? primaryText,
    @JsonKey(name: "image_url") String? imageUrl,
    @JsonKey(name: "link_url") String? linkUrl,
  }) = _AdsCreative;

  factory AdsCreative.fromJson(Map<String, dynamic> json) =>
      _$AdsCreativeFromJson(json);
}

/// An ad inside a campaign. Mirrors `AdsCampaignDetail.ads[]`.
@freezed
class AdsAd with _$AdsAd {
  const factory AdsAd({
    @Default("") String id,
    String? name,
    @Default("") String status,
    AdsCreative? creative,
  }) = _AdsAd;

  factory AdsAd.fromJson(Map<String, dynamic> json) => _$AdsAdFromJson(json);
}

/// A single day in the campaign performance series. Mirrors
/// `AdsCampaignDetail.daily[]`.
@freezed
class AdsCampaignDaily with _$AdsCampaignDaily {
  const factory AdsCampaignDaily({
    @Default("") String date,
    @Default(0) num spend,
    @Default(0) num clicks,
    @Default(0) num conversions,
  }) = _AdsCampaignDaily;

  factory AdsCampaignDaily.fromJson(Map<String, dynamic> json) =>
      _$AdsCampaignDailyFromJson(json);
}

/// A timeline entry — every change to the campaign, by whom and why. Mirrors
/// `AdsCampaignDetail.timeline[]`.
@freezed
class AdsTimelineEntry with _$AdsTimelineEntry {
  const factory AdsTimelineEntry({
    @Default("") String id,
    @Default("") String actor,
    @Default("") String action,
    String? reason,
    Map<String, dynamic>? before,
    Map<String, dynamic>? after,
    @Default("") String at,
  }) = _AdsTimelineEntry;

  factory AdsTimelineEntry.fromJson(Map<String, dynamic> json) =>
      _$AdsTimelineEntryFromJson(json);
}

/// GET /merchant/ads/campaigns/:id -> the full campaign detail. Mirrors
/// `AdsCampaignDetail`.
@freezed
class AdsCampaignDetail with _$AdsCampaignDetail {
  const factory AdsCampaignDetail({
    required AdsCampaign campaign,
    @Default(<AdsAd>[]) List<AdsAd> ads,
    @Default(AdsTotals()) AdsTotals totals,
    @Default(<AdsCampaignDaily>[]) List<AdsCampaignDaily> daily,
    @Default(<AdsTimelineEntry>[]) List<AdsTimelineEntry> timeline,
  }) = _AdsCampaignDetail;

  factory AdsCampaignDetail.fromJson(Map<String, dynamic> json) =>
      _$AdsCampaignDetailFromJson(json);
}

/// Body for POST /merchant/ads/campaigns. Mirrors `CreateAdsCampaignInput`.
/// Only the core fields — AI-generated creative + product anchoring are
/// scoped out of the mobile create flow (do those on web).
@freezed
class CreateAdsCampaignInput with _$CreateAdsCampaignInput {
  const factory CreateAdsCampaignInput({
    @Default("meta") String platform,
    @Default("") String name,
    @Default("sales") String goal,
    @JsonKey(name: "daily_budget") @Default(0) num dailyBudget,
    @Default(<String>[]) List<String> countries,
    @JsonKey(name: "product_handle") String? productHandle,
    @JsonKey(name: "link_url") String? linkUrl,
    @Default("") String headline,
    @JsonKey(name: "primary_text") @Default("") String primaryText,
    @JsonKey(name: "image_url") String? imageUrl,
    @JsonKey(name: "page_id") String? pageId,
    @JsonKey(name: "start_at") String? startAt,
  }) = _CreateAdsCampaignInput;

  factory CreateAdsCampaignInput.fromJson(Map<String, dynamic> json) =>
      _$CreateAdsCampaignInputFromJson(json);
}
