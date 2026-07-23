import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "call_center_models.dart";

/// Thin transport for the merchant Call Center endpoints, mirroring the web
/// client's `getCallCenterDashboard`, `listCallCenterCalls`, `getCallCenterCall`,
/// `getCallCenterAnalytics`, `listCallAgents` and `listCallPhoneNumbers`
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function.
///
/// P2 is read-focused: the app surfaces the AI call center (agent status,
/// connected numbers, call history and analytics). Buying/attaching numbers and
/// editing agents stay on the full web dashboard — those flows spend recurring
/// credits and are out of scope here.
class CallCenterRepository {
  CallCenterRepository(this._dio);

  final Dio _dio;

  /// GET /merchant/call-center -> the overview dashboard.
  Future<CallCenterDashboard> getDashboard() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/call-center");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load the call center.", 0);
      }
      return CallCenterDashboard.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load the call center");
    }
  }

  /// GET /merchant/call-center/agents -> { agents, count }.
  Future<List<CallAgent>> listAgents() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/call-center/agents");
      final data = res.data;
      final raw = (data is Map ? data["agents"] : null) as List? ?? const [];
      return raw
          .map((e) => CallAgent.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your agents");
    }
  }

  /// GET /merchant/call-center/phone-numbers -> numbers + provider readiness.
  Future<PhoneNumbersResult> listPhoneNumbers() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/call-center/phone-numbers");
      final data = res.data;
      if (data is! Map) return const PhoneNumbersResult();
      return PhoneNumbersResult.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your phone numbers");
    }
  }

  /// GET /merchant/call-center/calls?status=&direction=&limit=&offset= ->
  /// { calls, count, limit, offset }.
  Future<List<CallCenterCall>> listCalls({
    String? status,
    String? direction,
    int limit = 200,
    int offset = 0,
  }) async {
    try {
      final params = <String, dynamic>{"limit": limit, "offset": offset};
      if (status != null && status.isNotEmpty) params["status"] = status;
      if (direction != null && direction.isNotEmpty) {
        params["direction"] = direction;
      }
      final res = await _dio.get<dynamic>(
        "/merchant/call-center/calls",
        queryParameters: params,
      );
      final data = res.data;
      final raw = (data is Map ? data["calls"] : null) as List? ?? const [];
      return raw
          .map((e) =>
              CallCenterCall.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your calls");
    }
  }

  /// GET /merchant/call-center/calls/:id -> the full call detail.
  Future<CallDetail> getCall(String id) async {
    try {
      final res = await _dio.get<dynamic>("/merchant/call-center/calls/$id");
      final data = res.data;
      if (data is! Map || data["call"] is! Map) {
        throw ApiError("This call could not be found.", 404, "not_found");
      }
      return CallDetail.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load this call");
    }
  }

  /// GET /merchant/call-center/analytics?from=&to= -> the analytics summary.
  Future<CallCenterAnalytics> getAnalytics({String? from, String? to}) async {
    try {
      final params = <String, dynamic>{};
      if (from != null && from.isNotEmpty) params["from"] = from;
      if (to != null && to.isNotEmpty) params["to"] = to;
      final res = await _dio.get<dynamic>(
        "/merchant/call-center/analytics",
        queryParameters: params.isEmpty ? null : params,
      );
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load analytics.", 0);
      }
      return CallCenterAnalytics.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load analytics");
    }
  }
}

final callCenterRepositoryProvider = Provider<CallCenterRepository>(
  (ref) => CallCenterRepository(ref.read(dioProvider)),
);
