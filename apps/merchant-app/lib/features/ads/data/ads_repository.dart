import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "ads_models.dart";

/// Thin transport for the merchant Advertising endpoints (/merchant/ads/*),
/// mirroring the web client's `getAdsOverview`, `listAdsAccounts`,
/// `runAdsSyncNow`, `connectAdsPlatform`, `selectAdsAccount`,
/// `disconnectAdsConnection`, `getAdsCampaignDetail`, `setAdsCampaignStatus`,
/// `setAdsCampaignBudget` and `createAdsCampaign`
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
///
/// Ad SPEND stays on the merchant's own card at the platform — these APIs read
/// performance and manage the connection/campaign, they never move money here.
class AdsRepository {
  AdsRepository(this._dio);

  final Dio _dio;

  Map<String, dynamic> _asMap(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  /// GET /merchant/ads/overview?days= -> the overview payload.
  Future<AdsOverview> getOverview({int days = 30}) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/ads/overview",
        queryParameters: {"days": days},
      );
      return AdsOverview.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load advertising data");
    }
  }

  /// GET /merchant/ads/accounts -> connections + accounts + platforms.
  Future<AdsAccountsResponse> listAccounts() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/ads/accounts");
      return AdsAccountsResponse.fromJson(_asMap(res.data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your ad accounts");
    }
  }

  /// POST /merchant/ads/sync -> re-pulls campaigns + insights from platforms.
  Future<AdsSyncSummary> runSyncNow() async {
    try {
      final res = await _dio.post<dynamic>("/merchant/ads/sync");
      final data = _asMap(res.data);
      return AdsSyncSummary.fromJson(_asMap(data["summary"]));
    } catch (e) {
      throw ApiError.from(e, fallback: "Sync failed");
    }
  }

  /// POST /merchant/ads/accounts/connect -> either an OAuth `auth_url` to open
  /// in a browser, or a direct connection object. Returns the raw map so the
  /// caller can branch on which came back.
  Future<({String? authUrl, AdsConnection? connection})> connectPlatform(
    String platform,
  ) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/ads/accounts/connect",
        data: {"platform": platform},
      );
      final data = _asMap(res.data);
      final url = data["auth_url"];
      final conn = data["connection"];
      return (
        authUrl: url is String && url.isNotEmpty ? url : null,
        connection: conn is Map ? AdsConnection.fromJson(_asMap(conn)) : null,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't start connecting this platform");
    }
  }

  /// POST /merchant/ads/accounts/:id/select -> pick (or unpick) the account
  /// this store advertises from.
  Future<AdsAccount> selectAccount(String accountId, bool selected) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/ads/accounts/$accountId/select",
        data: {"selected": selected},
      );
      final data = _asMap(res.data);
      return AdsAccount.fromJson(_asMap(data["account"]));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't update the selected account");
    }
  }

  /// DELETE /merchant/ads/accounts/:connectionId -> disconnect a platform.
  Future<void> disconnectConnection(String connectionId) async {
    try {
      await _dio.delete<dynamic>("/merchant/ads/accounts/$connectionId");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't disconnect this platform");
    }
  }

  /// GET /merchant/ads/campaigns/:id -> the full campaign detail.
  Future<AdsCampaignDetail> getCampaignDetail(String id) async {
    try {
      final res = await _dio.get<dynamic>("/merchant/ads/campaigns/$id");
      final data = res.data;
      if (data is! Map || data["campaign"] is! Map) {
        throw ApiError("This campaign could not be found.", 404, "not_found");
      }
      return AdsCampaignDetail.fromJson(_asMap(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load this campaign");
    }
  }

  /// POST /merchant/ads/campaigns/:id/status -> "active" (launch) | "paused".
  /// The confirm gate lives in the UI; the server enforces the real change.
  Future<void> setCampaignStatus(String id, String status) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/ads/campaigns/$id/status",
        data: {"status": status},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't change the campaign status");
    }
  }

  /// POST /merchant/ads/campaigns/:id/budget -> set the daily budget.
  Future<void> setCampaignBudget(String id, num dailyBudget) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/ads/campaigns/$id/budget",
        data: {"daily_budget": dailyBudget},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't change the budget");
    }
  }

  /// GET /merchant/ads/pages?platform=meta -> the Facebook Pages the ad can
  /// publish as (the "publish as" picker). Response shape: { pages: [{id,name}] }.
  Future<List<AdsPage>> listPages({String platform = "meta"}) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/ads/pages",
        queryParameters: {"platform": platform},
      );
      final data = _asMap(res.data);
      final list = (data["pages"] as List?) ?? const [];
      return list
          .map((e) => AdsPage.fromJson(_asMap(e)))
          .toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your Facebook Pages");
    }
  }

  /// POST /merchant/ads/campaigns -> creates a campaign. The backend always
  /// creates it PAUSED; the merchant launches it explicitly from the detail
  /// screen once they've reviewed everything.
  Future<String> createCampaign(CreateAdsCampaignInput input) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/ads/campaigns",
        data: input.toJson(),
      );
      final data = _asMap(res.data);
      final campaign = _asMap(data["campaign"]);
      return (campaign["id"] as String?) ?? "";
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't create this campaign");
    }
  }
}

final adsRepositoryProvider = Provider<AdsRepository>(
  (ref) => AdsRepository(ref.read(dioProvider)),
);
