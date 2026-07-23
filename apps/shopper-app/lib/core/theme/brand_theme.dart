import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "app_colors.dart";

/// Per-store white-label branding for the shopper app.
///
/// Ported from the merchant app's `brand_theme.dart`, but the source of the
/// brand differs: the merchant app reads it from the signed-in merchant's
/// session, whereas the shopper app has NO login on the home path — the store
/// it renders is fixed by the build (`AppConfig`) and its public branding
/// (logo + accent) arrives with the store/CMS payload. The white-label factory
/// may also bake a static accent into the binary later; either way it flows
/// through [brandProvider] here.
///
/// Layered ADDITIVELY over `AppColors` / `AppTheme` — a store with no custom
/// accent is pixel-identical to the ember default.

/// Immutable store brand identity.
@immutable
class StoreBrand {
  const StoreBrand({this.logoUrl, this.accent, this.storeName});

  /// The store's logo URL (already absolute), or null when unset.
  final String? logoUrl;

  /// The store's brand accent, or null to keep the ember default.
  final Color? accent;

  /// Display name (for app bar title / fallback initial).
  final String? storeName;

  bool get hasLogo => logoUrl != null && logoUrl!.isNotEmpty;
  bool get hasAccent => accent != null;

  StoreBrand copyWith({String? logoUrl, Color? accent, String? storeName}) =>
      StoreBrand(
        logoUrl: logoUrl ?? this.logoUrl,
        accent: accent ?? this.accent,
        storeName: storeName ?? this.storeName,
      );

  /// The neutral default: no logo, ember accent.
  static const StoreBrand none = StoreBrand();
}

/// Parse a `#RRGGBB` / `#RGB` / `RRGGBB` (optional `AARRGGBB`) hex string into a
/// [Color]. Returns null for null/empty/malformed input so a bad value silently
/// degrades to the ember default.
Color? parseBrandHex(String? hex) {
  if (hex == null) return null;
  var h = hex.trim();
  if (h.isEmpty) return null;
  if (h.startsWith("#")) h = h.substring(1);
  if (h.length == 3) {
    h = h.split("").map((ch) => "$ch$ch").join();
  }
  if (h.length == 6) h = "FF$h";
  if (h.length != 8) return null;
  final value = int.tryParse(h, radix: 16);
  if (value == null) return null;
  return Color(value);
}

/// The active store brand. Overridable/updatable once the store payload loads.
///
/// Kept as a plain [StateProvider] so the home loader can set it from the
/// store/CMS response (`ref.read(brandProvider.notifier).state = ...`) without
/// coupling the theme to any specific data source. Defaults to [StoreBrand.none]
/// (ember) so first paint is correct before any network call resolves.
final brandProvider = StateProvider<StoreBrand>((ref) => StoreBrand.none);

/// Return a copy of [base] with the ember accent family overridden by the
/// store's brand [accent]. If [accent] is null, [base] is returned UNCHANGED.
AppColors applyBrandAccent(AppColors base, Color? accent) {
  if (accent == null) return base;
  final isDark = base.brightness == Brightness.dark;
  return base.copyWith(
    accent: accent,
    accentHover: _shade(accent, isDark ? 0.10 : -0.08),
    accentActive: _shade(accent, isDark ? 0.22 : -0.18),
    accentTint: Color.alphaBlend(
      accent.withValues(alpha: isDark ? 0.20 : 0.10),
      base.surface,
    ),
    onAccent: _readableOn(accent),
    focusRing: accent.withValues(alpha: isDark ? 0.36 : 0.28),
  );
}

Color _shade(Color color, double delta) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness + delta).clamp(0.0, 1.0);
  return hsl.withLightness(l).toColor();
}

Color _readableOn(Color color) =>
    color.computeLuminance() > 0.5 ? AppColors.inkBase : Colors.white;
