import "package:flutter/foundation.dart";

/// Per-store build-time binding for the white-label shopper app.
///
/// ONE Flutter binary renders ANY store. Which store a given binary is bound to
/// is decided ENTIRELY by these `--dart-define` values — the white-label
/// factory stamps them per merchant when it builds each store's branded binary:
///
/// ```
/// flutter build apk \
///   --dart-define=API_BASE_URL=https://merchant.mautomate.ai \
///   --dart-define=STORE_PUBLISHABLE_KEY=pk_01ABC... \
///   --dart-define=TENANT_ID=tnt_01XYZ... \
///   --dart-define=CMS_BASE=https://foreverfinds.shop
/// ```
///
/// Nothing else in the app hardcodes a host, key or tenant — everything routes
/// through [AppConfig], so a rebuild with different defines produces a fully
/// re-pointed store app with zero code changes.
@immutable
class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.publishableKey,
    required this.tenantId,
    required this.cmsBase,
  });

  /// The public backend origin serving the Medusa **store** API
  /// (`/store/products`, `/store/carts`, `/store/cms/...`). The store API lives
  /// on the SAME backend the merchant app talks to (`merchant.mautomate.ai`),
  /// so the staging default matches `dio_client.dart` in the merchant app.
  final String apiBaseUrl;

  /// Medusa **publishable API key** (`x-publishable-api-key`). This is what
  /// scopes every store-API call to ONE store's sales channel — it is the
  /// primary per-store binding and the factory bakes a real key per merchant.
  /// Empty in staging until a key is stamped in.
  final String publishableKey;

  /// The owning tenant id. Sent as `x-tenant-id` so pooled multi-tenant CMS
  /// reads (which resolve the store from the request) bind to the right store
  /// even before a per-store publishable key exists. Optional/informational.
  final String tenantId;

  /// Base origin for resolving RELATIVE asset URLs that CMS blocks carry
  /// (e.g. a hero image stored as `/learts/assets/images/slider/slide-1.webp`).
  /// The block renderers resolve such paths against this origin. Defaults to
  /// [apiBaseUrl] when not separately provided.
  final String cmsBase;

  /// Reads the configuration from the compile-time environment. All values have
  /// sensible staging defaults so `flutter run` works with no defines.
  factory AppConfig.fromEnvironment() {
    const apiBase = String.fromEnvironment(
      "API_BASE_URL",
      defaultValue: "https://merchant.mautomate.ai",
    );
    const cms = String.fromEnvironment("CMS_BASE", defaultValue: "");
    return AppConfig(
      apiBaseUrl: apiBase,
      publishableKey: String.fromEnvironment("STORE_PUBLISHABLE_KEY"),
      tenantId: String.fromEnvironment("TENANT_ID"),
      cmsBase: cms.isEmpty ? apiBase : cms,
    );
  }

  bool get hasPublishableKey => publishableKey.isNotEmpty;
  bool get hasTenant => tenantId.isNotEmpty;

  /// Resolve a possibly-relative asset [url] to an absolute one against
  /// [cmsBase]. Absolute `http(s)` URLs and `data:` URIs pass through
  /// unchanged; a leading-slash or bare path is joined to the CMS origin.
  /// Returns null for null/empty input.
  String? resolveAsset(String? url) {
    if (url == null) return null;
    final u = url.trim();
    if (u.isEmpty) return null;
    if (u.startsWith("http://") ||
        u.startsWith("https://") ||
        u.startsWith("data:")) {
      return u;
    }
    final base = cmsBase.endsWith("/")
        ? cmsBase.substring(0, cmsBase.length - 1)
        : cmsBase;
    final path = u.startsWith("/") ? u : "/$u";
    return "$base$path";
  }

  @override
  String toString() =>
      "AppConfig(apiBaseUrl: $apiBaseUrl, tenantId: $tenantId, "
      "cmsBase: $cmsBase, hasKey: $hasPublishableKey)";
}
