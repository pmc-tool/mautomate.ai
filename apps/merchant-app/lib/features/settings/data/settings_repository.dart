import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/api/api_error.dart";
import "../../../core/api/dio_client.dart";
import "settings_models.dart";

/// Thin transport for the merchant Settings endpoints, mirroring the web
/// client (apps/storefront/src/lib/merchant-admin/api.ts) function-for-function:
///  - `getSettings` / `updateSettings`      -> GET/PUT /merchant/settings
///  - `listStoreCurrencies` / `updateTenantCurrencies`
///                                          -> GET/POST /merchant/store/currencies
///  - store country (setup snapshot)        -> GET/PATCH /merchant/setup
///  - `listPaymentGateways` / `updatePaymentGateway`
///                                          -> GET/POST /merchant/payments/gateways
class SettingsRepository {
  SettingsRepository(this._dio);

  final Dio _dio;

  /// GET /merchant/settings -> { name, slug, domain, status }.
  Future<StoreProfile> getProfile() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/settings");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load your store profile.", 0);
      }
      return StoreProfile.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your store profile");
    }
  }

  /// PUT /merchant/settings { name } -> { name }. Slug/domain are fixed, so we
  /// return the caller's other fields unchanged with the persisted name.
  Future<String> updateName(String name) async {
    try {
      final res = await _dio.put<dynamic>(
        "/merchant/settings",
        data: {"name": name},
      );
      final data = res.data;
      final persisted = (data is Map ? data["name"] : null);
      return persisted is String && persisted.isNotEmpty ? persisted : name;
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't save your store name");
    }
  }

  /// GET /merchant/store/currencies -> { currencies, default_currency }.
  Future<StoreCurrencies> getCurrencies() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/store/currencies");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load your currencies.", 0);
      }
      return StoreCurrencies.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your currencies");
    }
  }

  /// POST /merchant/store/currencies { currencies, default_currency }
  /// -> { currencies, default_currency }. The backend validates every code
  /// against the platform's supported set and requires the default to be one
  /// of the submitted currencies.
  Future<StoreCurrencies> updateCurrencies({
    required List<String> currencies,
    required String defaultCurrency,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/store/currencies",
        data: {
          "currencies": currencies.map((c) => c.toLowerCase()).toList(),
          "default_currency": defaultCurrency.toLowerCase(),
        },
      );
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't save your currencies.", 0);
      }
      return StoreCurrencies.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't save your currencies");
    }
  }

  /// GET /merchant/setup -> snapshot including `default_country` (lowercase ISO
  /// alpha-2, or null). The store country lives in tenant meta and is the same
  /// value Jarvis's `set_store_country` writes.
  Future<String?> getStoreCountry() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/setup");
      final data = res.data;
      final cc = (data is Map ? data["default_country"] : null);
      if (cc is String && cc.trim().isNotEmpty) return cc.toLowerCase();
      return null;
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your store country");
    }
  }

  /// PATCH /merchant/setup { default_country } — persists the store country
  /// (2-letter code). Mirrors Jarvis's `set_store_country` write path.
  Future<String> updateStoreCountry(String code) async {
    try {
      final cc = code.toLowerCase();
      await _dio.patch<dynamic>(
        "/merchant/setup",
        data: {"default_country": cc},
      );
      return cc;
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't save your store country");
    }
  }

  /// GET /merchant/payments/gateways -> { tenant_country, gateways }.
  Future<GatewaysResponse> listGateways() async {
    try {
      final res = await _dio.get<dynamic>("/merchant/payments/gateways");
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't load your payment methods.", 0);
      }
      return GatewaysResponse.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't load your payment methods");
    }
  }

  /// POST /merchant/payments/gateways { gateway_id, enabled, enabled_regions,
  /// credentials } -> the updated gateway. The app toggles `enabled` only;
  /// sending an empty `credentials` map preserves any keys already vaulted
  /// (the backend skips undefined credential values). `enabled_regions`
  /// mirrors the gateway's own country list, exactly as the web client does.
  Future<PaymentGateway> setGatewayEnabled(
    PaymentGateway gateway,
    bool enabled,
  ) async {
    try {
      final res = await _dio.post<dynamic>(
        "/merchant/payments/gateways",
        data: {
          "gateway_id": gateway.id,
          "enabled": enabled,
          "enabled_regions": gateway.countries,
          "credentials": <String, dynamic>{},
        },
      );
      final data = res.data;
      if (data is! Map) {
        throw ApiError("Couldn't update this payment method.", 0);
      }
      return PaymentGateway.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      throw ApiError.from(e, fallback: "Couldn't update this payment method");
    }
  }
}

final settingsRepositoryProvider = Provider<SettingsRepository>(
  (ref) => SettingsRepository(ref.read(dioProvider)),
);
