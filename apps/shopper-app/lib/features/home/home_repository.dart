import "package:dio/dio.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/api/dio_client.dart";
import "../../core/blocks/block_node.dart";
import "../../core/config/app_config.dart";
import "../../core/config/config_providers.dart";
import "../../core/theme/brand_theme.dart";
import "sample_page.dart";

/// Result of loading the home page: the normalized page, the resolved store
/// brand, and the raw `design` / `chrome` payloads (threaded through for Wave 2
/// to draw store chrome + apply full design tokens).
@immutable
class HomeLoad {
  const HomeLoad({
    required this.page,
    required this.brand,
    required this.fromFixture,
    this.design = const {},
    this.chrome = const {},
  });

  final StorePage page;
  final StoreBrand brand;

  /// `design` key: `{ colors:{primary,dark,text,heading,bg,border}, fonts, logo }`.
  /// WAVE 2: map onto the full ThemeData beyond the accent.
  final Map<String, dynamic> design;

  /// `chrome` key: `{ topbar, header, footer }` global store settings.
  /// WAVE 2: draw the native header / announcement bar / footer from this.
  final Map<String, dynamic> chrome;

  /// True when the live endpoint was unavailable and the bundled sample was
  /// used — surfaced so the UI can show a subtle "preview data" note in debug.
  final bool fromFixture;
}

/// Fetches the store's home page, branding, design tokens and chrome.
///
/// Tries, in order:
///   1. The LIVE app-render endpoint (`GET /store/cms/app/pages/home`) — returns
///      `{ page:{sections[]}, design, branding, chrome, ... }` in one call
///      (see `apps/backend/SHOPPER_BLOCK_CATALOG.md`).
///   2. The plain CMS live read (`/store/cms/pages/home`) — page-only fallback.
///   3. The bundled [kSampleHomePage] fixture, so the pipeline always renders in
///      dev / before a publishable key is provisioned.
///
/// Whichever responds with a parseable page shape wins.
class HomeRepository {
  HomeRepository(this._dio, this._config);

  final Dio _dio;
  final AppConfig _config;

  static const List<String> _endpoints = [
    "/store/cms/app/pages/home",
    "/store/cms/pages/home",
  ];

  Future<HomeLoad> fetchHomePage() async {
    for (final path in _endpoints) {
      try {
        final res = await _dio.get<Map<String, dynamic>>(path);
        final body = res.data;
        if (body == null) continue;
        final page = StorePage.fromJson(body);
        if (page.isEmpty) continue;
        return HomeLoad(
          page: page,
          brand: _brandFrom(body, page),
          design: _mapAt(body, "design"),
          chrome: _mapAt(body, "chrome"),
          fromFixture: false,
        );
      } catch (e) {
        debugPrint("[home] $path failed: $e");
      }
    }

    // Fallback: bundled sample so the engine is always demonstrable.
    final page = StorePage.fromJson(kSampleHomePage);
    return HomeLoad(
      page: page,
      brand: _brandFrom(const {}, page),
      fromFixture: true,
    );
  }

  Map<String, dynamic> _mapAt(Map<String, dynamic> body, String key) {
    final v = body[key];
    return v is Map ? v.cast<String, dynamic>() : const {};
  }

  /// Extract store branding from the `branding` object, with sensible fallbacks:
  /// accent falls back to the `design.colors.primary` theme token; name/logo to
  /// the page meta / design logo.
  StoreBrand _brandFrom(Map<String, dynamic> body, StorePage page) {
    final branding = _mapAt(body, "branding");
    final design = _mapAt(body, "design");
    final colors = design["colors"] is Map
        ? (design["colors"] as Map).cast<String, dynamic>()
        : const {};

    final logo = branding["logo_url"] ?? branding["logo"] ?? design["logo"];
    final accentHex = branding["accent"] ?? colors["primary"];
    final name = branding["name"] ?? page.meta["store_name"];

    return StoreBrand(
      logoUrl: _config.resolveAsset(logo is String ? logo : null),
      accent: parseBrandHex(accentHex is String ? accentHex : null),
      storeName: name is String && name.isNotEmpty ? name : null,
    );
  }
}

final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => HomeRepository(
    ref.watch(storeDioProvider),
    ref.watch(appConfigProvider),
  ),
);
