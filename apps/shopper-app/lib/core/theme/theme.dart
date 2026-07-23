/// Barrel export for the mAutomate shopper-app design system.
///
/// Ported from the merchant app's `core/theme` so both apps share ONE visual
/// language (ink + ember, Inter, the 4/8 spacing rhythm). The only shopper-side
/// difference is where the brand accent comes from: the merchant app resolves it
/// from the signed-in merchant's session, whereas the shopper app resolves it
/// from the bound store's public branding (see `brand_theme.dart`).
///
/// ```dart
/// import "package:mautomate_shopper/core/theme/theme.dart";
/// ```
library;

export "app_colors.dart";
export "app_theme.dart";
export "app_typography.dart";
export "brand_theme.dart";
export "spacing.dart";
