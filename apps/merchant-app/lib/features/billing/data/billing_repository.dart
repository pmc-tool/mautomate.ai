import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "billing_models.dart";

/// Thin transport for the merchant Billing endpoints, mirroring the web client
/// (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function:
///  - `getBillingOverview` -> GET  /merchant/billing/overview
///  - `getCredits`         -> GET  /merchant/credits?limit&offset
///  - `topUpCredits`       -> POST /merchant/credits { credits, amount_usd }
///  - `changePlan`         -> POST /merchant/billing/change-plan { key }
class BillingRepository {
  BillingRepository(this._dio);

  final Dio _dio;

  /// GET /merchant/billing/overview.
  Future<BillingOverview> getOverview() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/billing/overview");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load your billing details.", 0);
      }
      return BillingOverview.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your billing details");
    }
  }

  /// GET /merchant/credits?limit=&offset= — the wallet + paginated ledger.
  Future<CreditsHistory> getCredits({int limit = 20, int offset = 0}) async {
    try {
      final res = await _dio.get<dynamic>(
        "/merchant/credits",
        queryParameters: {"limit": limit, "offset": offset},
      );
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load your credit history.", 0);
      }
      return CreditsHistory.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your credit history");
    }
  }

  /// POST /merchant/credits { credits, amount_usd } — start a credit top-up.
  ///
  /// On success (201) the gateway returns a `checkout_url` the merchant opens
  /// in a browser. When no live gateway is configured the backend answers 503
  /// with an explanation — that is not a hard error here: it's returned as a
  /// [CheckoutOutcome.message] so the UI shows an honest notice rather than a
  /// red failure.
  Future<CheckoutOutcome> buyPack({
    required int credits,
    required num amountUsd,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/credits",
        data: {"credits": credits, "amount_usd": amountUsd},
      );
      final data = res.data;
      final url = (data is Map ? data["checkout_url"] : null);
      return CheckoutOutcome(
        checkoutUrl: url is String ? url : null,
      );
    } on DioException catch (e) {
      final status = e.response?.statusCode ?? 0;
      final body = e.response?.data;
      final msg = (body is Map ? body["message"] ?? body["error"] : null);
      if (status == 503) {
        return CheckoutOutcome(
          message: msg is String && msg.isNotEmpty
              ? msg
              : "Card payments are being set up for your region — we couldn't start checkout yet. Your balance and usage are still tracked.",
        );
      }
      throw ApiError.from(e, fallback: "Couldn't start your purchase");
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't start your purchase");
    }
  }

  /// POST /merchant/billing/change-plan { key } — switch subscription tier.
  ///
  /// Returns a `checkout_url` when card billing is live, otherwise the change
  /// is applied immediately at no charge and the backend's `message` explains
  /// the outcome (both carried in the [CheckoutOutcome]).
  Future<CheckoutOutcome> changePlan(String key) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/billing/change-plan",
        data: {"key": key},
      );
      final data = res.data;
      final url = (data is Map ? data["checkout_url"] : null);
      final msg = (data is Map ? data["message"] : null);
      return CheckoutOutcome(
        checkoutUrl: url is String ? url : null,
        message: msg is String ? msg : null,
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't change your plan");
    }
  }
}

final billingRepositoryProvider = Provider<BillingRepository>(
  (ref) => BillingRepository(ref.read(dioProvider)),
);
