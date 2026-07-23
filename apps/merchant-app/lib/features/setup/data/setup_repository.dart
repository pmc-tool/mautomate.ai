import "dart:typed_data";

import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "setup_models.dart";

/// Thin transport for the shop Setup wizard endpoints, mirroring the web
/// client's `getSetup`, `getSetupStatus`, `patchSetup`, `setupDelivery`,
/// `uploadSetupLogo`, `generateSetupLogos`, `removeDemoData` and
/// `updateTenantCurrencies` (apps/storefront/src/lib/merchant-admin/api.ts)
/// function-for-function.
///
/// The Dio interceptor attaches the merchant Bearer token and maps failures to
/// a friendly [ApiError]; every method rewraps for a step-appropriate fallback.
class SetupRepository {
  SetupRepository(this._dio);

  final Dio _dio;

  /// GET /merchant/setup — the draft + business fields + embedded verified
  /// `status`.
  Future<SetupSnapshot> getSetup() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/setup");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Setup is unavailable right now.", 0);
      }
      return SetupSnapshot.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your setup");
    }
  }

  /// GET /merchant/setup/status — the verified completeness picture on its own.
  Future<SetupStatus> getStatus() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/setup/status");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Setup status is unavailable right now.", 0);
      }
      return SetupStatus.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your setup status");
    }
  }

  /// PATCH /merchant/setup — persists the draft and/or captured business fields.
  /// Any subset of the fields may be supplied; the returned snapshot has no
  /// `status` block (callers re-read [getSetup] for the fresh verified picture).
  Future<SetupSnapshot> patchSetup({
    SetupDraft? draft,
    String? name,
    String? defaultCountry,
    SetupBusiness? business,
    Object? logoUrl = _keep,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (draft != null) body["draft"] = draft.toJson();
      if (name != null) body["name"] = name;
      if (defaultCountry != null) body["default_country"] = defaultCountry;
      if (business != null) body["business"] = business.toJson();
      if (logoUrl != _keep) body["logo_url"] = logoUrl;
      final res = await _dio.patch<dynamic>("/merchant/setup", data: body);
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't save your setup.", 0);
      }
      return SetupSnapshot.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't save your setup");
    }
  }

  /// POST /merchant/setup/delivery — one-call quick delivery. Creates the
  /// shipping option so shoppers can check out. [amount] is in minor units
  /// (cents) and only used for a flat rate.
  Future<void> setDelivery({
    required List<String> countries,
    required String priceType, // "free" | "flat"
    int amount = 0,
    String? name,
  }) async {
    try {
      final body = <String, dynamic>{
        "countries": countries,
        "price_type": priceType,
        "amount": priceType == "flat" ? amount : 0,
      };
      if (name != null && name.isNotEmpty) body["name"] = name;
      await _dio.post<dynamic>("/merchant/setup/delivery", data: body);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't set up delivery");
    }
  }

  /// POST /merchant/setup/logo (multipart) — uploads a logo image and returns
  /// its hosted URL. [onProgress] reports 0..1 send progress for the UI.
  Future<String> uploadLogo({
    required Uint8List bytes,
    required String filename,
    void Function(double progress)? onProgress,
  }) async {
    try {
      final form = FormData.fromMap({
        "file": MultipartFile.fromBytes(bytes, filename: filename),
      });
      final res = await _dio.post<dynamic>(
        "/merchant/setup/logo",
        data: form,
        onSendProgress: (sent, total) {
          if (onProgress != null && total > 0) {
            onProgress(sent / total);
          }
        },
      );
      final data = res.data;
      final url = (data is Map ? data["url"] : null);
      if (url is! String || url.isEmpty) {
        throw ApiError("The logo uploaded but no URL came back.", 0);
      }
      return url;
    } catch (e) {
      throw ApiError.from(e, fallback: "Logo upload failed");
    }
  }

  /// POST /merchant/setup/logo/generate — AI-generates logo marks (metered,
  /// uses AI credits) and returns their URLs.
  Future<List<String>> generateLogos({String? prompt, int count = 4}) async {
    try {
      final body = <String, dynamic>{"count": count};
      if (prompt != null && prompt.isNotEmpty) body["prompt"] = prompt;
      final res =
          await _dio.post<dynamic>("/merchant/setup/logo/generate", data: body);
      final data = res.data;
      final raw = (data is Map ? data["logos"] : null) as List? ?? const [];
      return raw.whereType<String>().toList(growable: false);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't generate a logo right now");
    }
  }

  /// POST /merchant/setup/remove-demo — deletes the placeholder sample product
  /// the store was created with; returns how many rows were removed.
  Future<int> removeDemo() async {
    try {
      final res = await _dio.post<dynamic>("/merchant/setup/remove-demo");
      final data = res.data;
      final n = (data is Map ? data["removed"] : null);
      return n is int ? n : (n is num ? n.round() : 0);
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't remove the demo data");
    }
  }

  /// POST /merchant/store/currencies — persists the tenant's currency selection
  /// (enabled set + default). Codes are validated server-side against the
  /// global store's supported list.
  Future<void> updateCurrencies({
    required List<String> currencies,
    required String defaultCurrency,
  }) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/store/currencies",
        data: {
          "currencies": currencies.map((c) => c.toLowerCase()).toList(),
          "default_currency": defaultCurrency.toLowerCase(),
        },
      );
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't update your currency");
    }
  }

  /// Sentinel so [patchSetup] can distinguish "leave logo_url untouched" from
  /// "explicitly set logo_url to null".
  static const Object _keep = Object();
}

final setupRepositoryProvider = Provider<SetupRepository>(
  (ref) => SetupRepository(ref.read(dioProvider)),
);
