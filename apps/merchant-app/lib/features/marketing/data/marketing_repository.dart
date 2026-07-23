import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "marketing_models.dart";

/// Thin transport for the merchant Marketing endpoints, mirroring the web
/// client's `getMarketingSummary`, `listMarketingPosts`, `getMarketingPost`,
/// `createMarketingPost`, `schedulePost`, `approvePost`, `publishPostNow`,
/// `deleteMarketingPost`, `listSocialAccounts`, `disconnectSocialAccount`,
/// `refreshSocialAccount` and `listMarketingCampaigns`
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
class MarketingRepository {
  MarketingRepository(this._dio);

  final Dio _dio;

  static List<Map<String, dynamic>> _list(Object? raw) =>
      (raw is List ? raw : const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList(growable: false);

  /// GET /merchant/marketing -> the overview counts.
  Future<MarketingSummary> getSummary() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/marketing");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load your marketing overview", 0);
      }
      return MarketingSummary.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your marketing overview");
    }
  }

  /// GET /merchant/marketing/posts?status=&limit= -> { posts, count }.
  Future<List<MarketingPost>> listPosts({String? status, int limit = 100}) async {
    try {
      final params = <String, dynamic>{"limit": limit};
      if (status != null && status.isNotEmpty) params["status"] = status;
      final res = await _dio.get<dynamic>(
        "/merchant/marketing/posts",
        queryParameters: params,
      );
      final data = res.data;
      final raw = (data is Map ? data["posts"] : null);
      return _list(raw).map(MarketingPost.fromJson).toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your posts");
    }
  }

  /// GET /merchant/marketing/posts/:id -> { post } (hydrates targets + media).
  Future<MarketingPost> getPost(String id) async {
    try {
      final res = await _dio.get<dynamic>("/merchant/marketing/posts/$id");
      final post = (res.data is Map ? res.data["post"] : null);
      if (post is! Map) {
        throw ApiError("This post could not be found.", 404, "not_found");
      }
      return MarketingPost.fromJson(Map<String, dynamic>.from(post));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load this post");
    }
  }

  /// POST /merchant/marketing/posts — create a draft. When [platforms] AND
  /// [scheduledAt] are both set the backend creates scheduled targets and flips
  /// the post to "scheduled" (a public action — the caller confirms first).
  Future<MarketingPost> createPost({
    String? title,
    String? body,
    List<String>? hashtags,
    String? linkUrl,
    List<String>? platforms,
    String? scheduledAt,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (title != null && title.isNotEmpty) data["title"] = title;
      if (body != null && body.isNotEmpty) data["body"] = body;
      if (hashtags != null && hashtags.isNotEmpty) data["hashtags"] = hashtags;
      if (linkUrl != null && linkUrl.isNotEmpty) data["link_url"] = linkUrl;
      if (platforms != null && platforms.isNotEmpty) {
        data["platforms"] = platforms;
        if (scheduledAt != null && scheduledAt.isNotEmpty) {
          data["scheduled_at"] = scheduledAt;
        }
      }
      final res = await _dio.post<dynamic>(
        "/merchant/marketing/posts",
        data: data,
      );
      final post = (res.data is Map ? res.data["post"] : null);
      if (post is! Map) {
        throw ApiError("The post could not be created.", 0);
      }
      return MarketingPost.fromJson(Map<String, dynamic>.from(post));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't create this post");
    }
  }

  /// POST /merchant/marketing/posts/:id/schedule — set/clear the schedule.
  /// Pass [scheduledAt] null to unschedule. Requires existing targets.
  Future<void> schedulePost(
    String id, {
    required String? scheduledAt,
    List<String>? targetPlatforms,
  }) async {
    try {
      final data = <String, dynamic>{"scheduled_at": scheduledAt};
      if (targetPlatforms != null && targetPlatforms.isNotEmpty) {
        data["target_platforms"] = targetPlatforms;
      }
      await _dio.post<dynamic>(
        "/merchant/marketing/posts/$id/schedule",
        data: data,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't schedule this post");
    }
  }

  /// POST /merchant/marketing/posts/:id/approve — submit | approve | reject.
  Future<void> approvePost(String id, {required String action}) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/marketing/posts/$id/approve",
        data: {"action": action},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't update this post");
    }
  }

  /// POST /merchant/marketing/posts/:id/publish-now — a public action; the
  /// caller confirms first and the server enforces its own gate.
  Future<PublishResult> publishNow(String id) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/marketing/posts/$id/publish-now",
      );
      final data = res.data;
      return PublishResult.fromJson(
        data is Map ? Map<String, dynamic>.from(data) : const {},
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't publish this post");
    }
  }

  /// DELETE /merchant/marketing/posts/:id.
  Future<void> deletePost(String id) async {
    try {
      await _dio.delete<dynamic>("/merchant/marketing/posts/$id");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't delete this post");
    }
  }

  /// GET /merchant/marketing/accounts -> { accounts, providers }.
  Future<SocialAccountsResult> listAccounts() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/marketing/accounts");
      final data = res.data;
      final accounts = _list(data is Map ? data["accounts"] : null)
          .map(SocialAccount.fromJson)
          .toList(growable: false);
      final providers = _list(data is Map ? data["providers"] : null)
          .map(SocialProvider.fromJson)
          .toList(growable: false);
      return SocialAccountsResult(accounts: accounts, providers: providers);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your channels");
    }
  }

  /// DELETE /merchant/marketing/accounts/:id — disconnect an account.
  Future<void> disconnectAccount(String id) async {
    try {
      await _dio.delete<dynamic>("/merchant/marketing/accounts/$id");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't disconnect this account");
    }
  }

  /// POST /merchant/marketing/accounts/:id/refresh — refresh an account token.
  Future<void> refreshAccount(String id) async {
    try {
      await _dio.post<dynamic>("/merchant/marketing/accounts/$id/refresh");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't refresh this account");
    }
  }

  /// GET /merchant/marketing/campaigns?status=&limit= -> { campaigns, count }.
  Future<List<MarketingCampaign>> listCampaigns({
    String? status,
    int limit = 100,
  }) async {
    try {
      final params = <String, dynamic>{"limit": limit};
      if (status != null && status.isNotEmpty) params["status"] = status;
      final res = await _dio.get<dynamic>(
        "/merchant/marketing/campaigns",
        queryParameters: params,
      );
      final raw = (res.data is Map ? res.data["campaigns"] : null);
      return _list(raw).map(MarketingCampaign.fromJson).toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your campaigns");
    }
  }
}

final marketingRepositoryProvider = Provider<MarketingRepository>(
  (ref) => MarketingRepository(ref.read(dioProvider)),
);
