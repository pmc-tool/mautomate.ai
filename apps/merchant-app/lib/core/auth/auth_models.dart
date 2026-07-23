// DTOs for the merchant session, mirroring the web client's `Merchant`,
// `Store` and `MeResponse` types (apps/storefront/src/lib/merchant-admin/
// api.ts). Hand-written (no codegen) so the foundation analyzes cleanly
// without a build_runner pass; richer feature DTOs use freezed later.

class Merchant {
  const Merchant({
    required this.id,
    required this.email,
    required this.name,
    required this.status,
    required this.mfaEnabled,
  });

  final String id;
  final String email;
  final String name;
  final String status;
  final bool mfaEnabled;

  factory Merchant.fromJson(Map<String, dynamic> json) => Merchant(
        id: (json["id"] ?? "") as String,
        email: (json["email"] ?? "") as String,
        name: (json["name"] ?? "") as String,
        status: (json["status"] ?? "") as String,
        mfaEnabled: (json["mfa_enabled"] ?? false) as bool,
      );
}

class Store {
  const Store({
    required this.id,
    required this.name,
    required this.slug,
    required this.status,
    this.domain,
    this.creditBalance,
    this.activeTheme,
    this.allowedThemes,
    this.package,
    this.logoUrl,
    this.brandAccent,
  });

  final String id;
  final String name;
  final String slug;
  final String status;
  final String? domain;
  final num? creditBalance;
  final String? activeTheme;
  final List<String>? allowedThemes;
  final String? package;

  /// The merchant's uploaded logo URL (tenant.meta.logo_url), if set.
  final String? logoUrl;

  /// The merchant's brand accent colour as a hex string, if set.
  final String? brandAccent;

  factory Store.fromJson(Map<String, dynamic> json) => Store(
        id: (json["id"] ?? "") as String,
        name: (json["name"] ?? "") as String,
        slug: (json["slug"] ?? "") as String,
        status: (json["status"] ?? "") as String,
        domain: json["domain"] as String?,
        creditBalance: json["credit_balance"] as num?,
        activeTheme: json["active_theme"] as String?,
        allowedThemes: (json["allowed_themes"] as List?)
            ?.map((e) => e.toString())
            .toList(),
        package: json["package"] as String?,
        logoUrl: json["logo_url"] as String?,
        brandAccent: json["brand_accent"] as String?,
      );
}

/// GET /merchant/me -> { merchant, store }
class MeResponse {
  const MeResponse({required this.merchant, required this.store});

  final Merchant merchant;
  final Store store;

  factory MeResponse.fromJson(Map<String, dynamic> json) => MeResponse(
        merchant: Merchant.fromJson(
          Map<String, dynamic>.from((json["merchant"] ?? {}) as Map),
        ),
        store: Store.fromJson(
          Map<String, dynamic>.from((json["store"] ?? {}) as Map),
        ),
      );
}
