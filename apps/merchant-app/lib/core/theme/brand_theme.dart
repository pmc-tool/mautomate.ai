import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../auth/auth_controller.dart";
import "app_colors.dart";
import "spacing.dart";

/// White-label per-merchant branding (P2) — layered ADDITIVELY on top of the
/// design system (`AppColors` / `AppTheme`), never replacing it.
///
/// Two, strictly-optional, brand signals are resolved from the signed-in
/// merchant's session (`/merchant/me` -> `store.logo_url` + `store.brand_accent`):
///
///  1. **Logo** — shown by [BrandLogo] in the More hub header and the Home
///     app bar, replacing the initial avatar. Falls back gracefully to the
///     merchant initial (never a broken-image icon).
///  2. **Accent** — an optional brand hex that OVERRIDES the ember accent
///     family via [applyBrandAccent]. When absent (the common case) the app is
///     pixel-identical to today: ember accent, initial avatar.
///
/// ### Wiring the accent override globally
/// [applyBrandAccent] returns an `AppColors` copy, so `context.colors.accent`
/// (and every widget that reads it) can reflect the brand. A FULL, consistent
/// override — including the Material component themes baked inside
/// `AppTheme._build` (buttons, inputs, nav bar) — requires the theme to be
/// built from the brand-adjusted tokens. Because `core/theme/app_theme.dart`
/// is owned by the design system and intentionally left untouched here, the
/// accent is plumbed end-to-end but NOT force-wired into `app.dart`. To light
/// it up, the theme owner makes `AppTheme.light()/dark()` accept an
/// `AppColors` and `app.dart` passes the branded set:
///
/// ```dart
/// // app.dart (ConsumerWidget already):
/// final brand = ref.watch(brandProvider);
/// theme: AppTheme.light(applyBrandAccent(AppColors.light, brand.accent)),
/// darkTheme: AppTheme.dark(applyBrandAccent(AppColors.dark, brand.accent)),
/// ```
///
/// Until then, branding is logo-first (visible immediately) and the accent
/// helper/provider are ready for a one-line, zero-risk activation.

/// Immutable brand identity resolved from the current session.
@immutable
class MerchantBrand {
  const MerchantBrand({this.logoUrl, this.accent});

  /// The merchant's uploaded logo URL, or null when unset.
  final String? logoUrl;

  /// The merchant's brand accent, or null to keep the ember default.
  final Color? accent;

  bool get hasLogo => logoUrl != null && logoUrl!.isNotEmpty;
  bool get hasAccent => accent != null;

  /// The neutral default: no logo, ember accent.
  static const MerchantBrand none = MerchantBrand();
}

/// Parse a `#RRGGBB` / `#RGB` / `RRGGBB` (optional 8-digit `AARRGGBB`) hex
/// string into a [Color]. Returns null for null/empty/malformed input so an
/// unset or bad value silently degrades to the ember default.
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

/// The active merchant brand, derived from the auth session. Recomputes only
/// when `me` changes; returns [MerchantBrand.none] when signed out.
final brandProvider = Provider<MerchantBrand>((ref) {
  final me = ref.watch(authControllerProvider.select((s) => s.me));
  if (me == null) return MerchantBrand.none;
  final logo = me.store.logoUrl;
  return MerchantBrand(
    logoUrl: (logo != null && logo.isNotEmpty) ? logo : null,
    accent: parseBrandHex(me.store.brandAccent),
  );
});

/// Return a copy of [base] with the ember accent family overridden by the
/// merchant's brand [accent]. If [accent] is null, [base] is returned
/// UNCHANGED — a merchant with no custom brand looks identical to today.
///
/// The whole accent family is kept internally consistent: hover/active shades
/// are derived from the brand hue, the tint is an opaque blend over the base
/// surface, `onAccent` flips to the readable ink/white, and the focus ring
/// tracks the new hue. All other tokens (surfaces, text, semantics) are
/// preserved.
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

/// Lighten ([delta] > 0) or darken ([delta] < 0) [color] in HSL space.
Color _shade(Color color, double delta) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness + delta).clamp(0.0, 1.0);
  return hsl.withLightness(l).toColor();
}

/// Pick the readable foreground (dark ink or white) for text/icons drawn on
/// [color], from its relative luminance.
Color _readableOn(Color color) =>
    color.computeLuminance() > 0.5 ? AppColors.inkBase : Colors.white;

/// The merchant's logo as a rounded, bordered tile with a graceful fallback to
/// the merchant/store initial (or a storefront glyph when no label is known).
///
/// Reads the logo URL from [brandProvider]; a network error or a still-loading
/// image never surfaces a broken-image icon — it shows the initial fallback or
/// a subtle skeleton fill. All colours come from `context.colors` (no hardcoded
/// hex), so it is correct in light and dark and follows any accent override.
class BrandLogo extends ConsumerWidget {
  const BrandLogo({
    super.key,
    this.size = 52,
    this.fallbackLabel,
    this.radius,
  });

  /// Edge length of the square tile.
  final double size;

  /// Name used to derive the fallback initial (merchant or store name).
  final String? fallbackLabel;

  /// Corner radius override; defaults to the medium token.
  final BorderRadius? radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final brand = ref.watch(brandProvider);
    final br = radius ?? AppRadius.mdAll;
    final fallback = _fallback(context, c, br);

    if (!brand.hasLogo) return fallback;

    return ClipRRect(
      borderRadius: br,
      child: Container(
        height: size,
        width: size,
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: br,
          border: Border.all(color: c.border),
        ),
        child: Image.network(
          brand.logoUrl!,
          height: size,
          width: size,
          fit: BoxFit.cover,
          gaplessPlayback: true,
          errorBuilder: (_, __, ___) => fallback,
          loadingBuilder: (ctx, child, progress) {
            if (progress == null) return child;
            return Container(
              height: size,
              width: size,
              color: c.skeletonBase,
            );
          },
        ),
      ),
    );
  }

  Widget _fallback(BuildContext context, AppColors c, BorderRadius br) {
    final label = (fallbackLabel ?? "").trim();
    final initial =
        label.isNotEmpty ? label.characters.first.toUpperCase() : null;
    return Container(
      height: size,
      width: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c.accentTint,
        borderRadius: br,
        border: Border.all(color: c.border),
      ),
      child: initial != null
          ? Text(
              initial,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: c.accent,
                    fontWeight: FontWeight.w700,
                    fontSize: size * 0.42,
                  ),
            )
          : Icon(
              PhosphorIconsRegular.storefront,
              color: c.accent,
              size: size * 0.5,
            ),
    );
  }
}
