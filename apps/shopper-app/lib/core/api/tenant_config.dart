import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "dio_client.dart";

/// The store's public runtime config, resolved from `GET /tenant-config`.
///
/// The backend is pooled multi-tenant: `/store/regions` returns EVERY tenant's
/// region, so the app cannot pick a currency by country. Each tenant instead
/// PINS its region; `/tenant-config` returns that store's [regionId] +
/// [currencyCode] (from `tenant.meta`). Passing [regionId] to price-aware
/// catalog calls (`/store/products?region_id=…`) is what makes variant prices
/// resolve in the store's currency (see SHOPPER_STORE_API.md).
@immutable
class TenantConfig {
  const TenantConfig({this.regionId, this.currencyCode});

  const TenantConfig.empty() : regionId = null, currencyCode = null;

  /// The store's pinned region id — pass to price-aware catalog calls. Null
  /// when `/tenant-config` was unreachable (prices then come back unpriced,
  /// which the UI degrades to "price on request" rather than crashing).
  final String? regionId;

  /// The store's currency code (e.g. `usd`), for price formatting fallbacks.
  final String? currencyCode;

  bool get hasRegion => regionId != null && regionId!.isNotEmpty;

  /// Parse defensively from the `/tenant-config` body. The value may sit at the
  /// top level or under a `config`/`store` envelope — we probe both and never
  /// throw on a shape we don't recognise.
  factory TenantConfig.fromJson(Map<String, dynamic> json) {
    String? pick(String key) {
      for (final scope in [json, json["config"], json["store"], json["tenant"]]) {
        if (scope is Map) {
          final v = scope[key];
          if (v is String && v.trim().isNotEmpty) return v.trim();
        }
      }
      return null;
    }

    return TenantConfig(
      regionId: pick("region_id"),
      currencyCode: pick("currency_code"),
    );
  }
}

/// The store's resolved [TenantConfig], fetched once and cached for the session.
///
/// Fail-soft by design: any error (missing route, network, unparseable body)
/// resolves to [TenantConfig.empty] so data-bound blocks still fetch products —
/// they just come back without prices instead of failing the page.
final tenantConfigProvider = FutureProvider<TenantConfig>((ref) async {
  final dio = ref.watch(storeDioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>("/tenant-config");
    final body = res.data;
    if (body == null) return const TenantConfig.empty();
    return TenantConfig.fromJson(body);
  } catch (e) {
    if (kDebugMode) debugPrint("[tenant-config] failed, using empty: $e");
    return const TenantConfig.empty();
  }
});
