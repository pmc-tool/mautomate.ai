import "package:flutter/material.dart";

/// The mAutomate merchant-app colour system.
///
/// One ramp, one scale, one accent — ported 1:1 from the web dashboard's
/// design language (`apps/storefront/src/modules/cms/editor/design.ts`).
///
/// "Ink is for action, ember is for state." Ink (`#0F1319`) is the solid,
/// high-contrast surface behind chrome and the primary call-to-action; ember
/// (`#F26522`) is the single warm signal, spent only on the thing the merchant
/// is touching right now.
///
/// [AppColors] is a [ThemeExtension] so every semantic token (surfaces,
/// borders, text, and the success/warning/danger/info tint families) is
/// available in BOTH light and dark themes through
/// `Theme.of(context).extension<AppColors>()` — or, more simply, the
/// `context.colors` helper defined at the bottom of this file.
///
/// Feature engineers should ALWAYS read colours from `context.colors` (never
/// hardcode a hex) so light/dark parity is automatic.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.brightness,
    required this.background,
    required this.surface,
    required this.surfaceMuted,
    required this.surfaceInset,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
    required this.textInverse,
    required this.primary,
    required this.onPrimary,
    required this.accent,
    required this.accentHover,
    required this.accentActive,
    required this.accentTint,
    required this.onAccent,
    required this.cyan,
    required this.focusRing,
    required this.overlay,
    required this.shadow,
    required this.success,
    required this.successBg,
    required this.successBorder,
    required this.danger,
    required this.dangerBg,
    required this.dangerBorder,
    required this.warning,
    required this.warningBg,
    required this.warningBorder,
    required this.info,
    required this.infoBg,
    required this.infoBorder,
    required this.skeletonBase,
    required this.skeletonHighlight,
  });

  /// Whether this token set targets a light or dark surface. Handy for
  /// widgets that need to branch (e.g. status-bar icon brightness).
  final Brightness brightness;

  // ---- Surfaces ---------------------------------------------------------
  /// App/page background — paper in light, ink base in dark.
  final Color background;

  /// A raised surface: cards, sheets, app bar.
  final Color surface;

  /// A subtle alternate fill: icon tiles, hover rows, zebra striping.
  final Color surfaceMuted;

  /// Input / well background (slightly inset from [surface]).
  final Color surfaceInset;

  // ---- Structure --------------------------------------------------------
  /// Hairline dividers and default control borders.
  final Color border;

  /// A stronger border for emphasis / focus-adjacent structure.
  final Color borderStrong;

  // ---- Text -------------------------------------------------------------
  /// Primary reading colour — headings and body.
  final Color textPrimary;

  /// Secondary text — descriptions, captions.
  final Color textSecondary;

  /// Muted text — placeholders, disabled-adjacent hints.
  final Color textMuted;

  /// Disabled text.
  final Color textDisabled;

  /// Text drawn ON a [primary] or dark fill.
  final Color textInverse;

  // ---- Action (ink) -----------------------------------------------------
  /// The primary action fill. Ink in light; a bright solid in dark so the
  /// CTA never disappears into the background.
  final Color primary;

  /// Foreground on [primary].
  final Color onPrimary;

  // ---- Accent (ember — state) ------------------------------------------
  final Color accent;
  final Color accentHover;
  final Color accentActive;

  /// Warm background for selected rows / active tabs.
  final Color accentTint;

  /// Foreground on [accent].
  final Color onAccent;

  /// Cool data accent (charts, secondary highlights).
  final Color cyan;

  // ---- Effects ----------------------------------------------------------
  /// Focus ring colour (already at its intended opacity).
  final Color focusRing;

  /// Modal / sheet scrim.
  final Color overlay;

  /// Ambient shadow colour for elevation.
  final Color shadow;

  // ---- Semantic families (foreground / tint bg / tint border) ----------
  final Color success;
  final Color successBg;
  final Color successBorder;
  final Color danger;
  final Color dangerBg;
  final Color dangerBorder;
  final Color warning;
  final Color warningBg;
  final Color warningBorder;
  final Color info;
  final Color infoBg;
  final Color infoBorder;

  // ---- Loading skeletons ------------------------------------------------
  final Color skeletonBase;
  final Color skeletonHighlight;

  // Brand constants — identical across themes. Exposed for the rare case a
  // widget needs the literal brand hue regardless of surface.
  static const Color inkBase = Color(0xFF0F1319);
  static const Color inkRaised = Color(0xFF171C24);
  static const Color inkHairline = Color(0xFF242A33);
  static const Color emberBase = Color(0xFFF26522);
  static const Color emberHover = Color(0xFFE05A1A);
  static const Color emberActive = Color(0xFFC94D12);
  static const Color paper = Color(0xFFF6F5F2);
  static const Color cyanBase = Color(0xFF4DD8E6);
  static const Color okBase = Color(0xFF12925A);
  static const Color dangerBase = Color(0xFFC43640);

  /// Solid danger fill for on-dark chrome (error snackbars/toasts). Fixed
  /// across themes and dark enough that light content text clears WCAG-AA in
  /// BOTH light and dark — unlike the theme [danger] token, which inverts to a
  /// light tint on dark surfaces and must never be used as a fill there.
  static const Color dangerSolid = Color(0xFFB42318);

  /// Solid success fill for on-dark chrome (success snackbars/toasts). Like
  /// [dangerSolid]: fixed across themes and dark enough for light content text
  /// to clear WCAG-AA in both light and dark.
  static const Color successSolid = Color(0xFF067647);

  /// Light theme tokens.
  static const AppColors light = AppColors(
    brightness: Brightness.light,
    background: paper,
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF3F4F6),
    surfaceInset: Color(0xFFF9FAFB),
    border: Color(0xFFE5E7EB),
    borderStrong: Color(0xFFD1D5DB),
    textPrimary: Color(0xFF111827),
    textSecondary: Color(0xFF6B7280),
    textMuted: Color(0xFF9CA3AF),
    textDisabled: Color(0xFFB6BCC4),
    textInverse: Color(0xFFFFFFFF),
    primary: inkBase,
    onPrimary: Color(0xFFFFFFFF),
    accent: emberBase,
    accentHover: emberHover,
    accentActive: emberActive,
    accentTint: Color(0xFFFEF1EA),
    onAccent: Color(0xFFFFFFFF),
    cyan: Color(0xFF0E9BAA),
    focusRing: Color(0x47F26522), // ember @ ~28%
    overlay: Color(0x66101828),
    shadow: Color(0x14101828),
    success: Color(0xFF067647),
    successBg: Color(0xFFECFDF3),
    successBorder: Color(0xFFABEFC6),
    danger: Color(0xFFB42318),
    dangerBg: Color(0xFFFEF3F2),
    dangerBorder: Color(0xFFFECDCA),
    warning: Color(0xFFB54708),
    warningBg: Color(0xFFFFFAEB),
    warningBorder: Color(0xFFFEDF89),
    info: Color(0xFF175CD3),
    infoBg: Color(0xFFEFF8FF),
    infoBorder: Color(0xFFB2DDFF),
    skeletonBase: Color(0xFFECEEF1),
    skeletonHighlight: Color(0xFFF7F8FA),
  );

  /// Dark theme tokens — full parity with [light], WCAG-AA tuned.
  static const AppColors dark = AppColors(
    brightness: Brightness.dark,
    background: inkBase,
    surface: inkRaised,
    surfaceMuted: Color(0xFF1F2530),
    surfaceInset: Color(0xFF121821),
    border: inkHairline,
    borderStrong: Color(0xFF333B47),
    textPrimary: Color(0xFFE7EAEE),
    textSecondary: Color(0xFF9BA3AF),
    textMuted: Color(0xFF6B7280),
    textDisabled: Color(0xFF565E6A),
    textInverse: Color(0xFF0F1319),
    // Ink can't be the CTA on a dark surface, so the action solid inverts to
    // a bright near-white; ember still owns "state".
    primary: Color(0xFFEDEFF2),
    onPrimary: inkBase,
    accent: emberBase,
    accentHover: Color(0xFFF3773A),
    accentActive: emberActive,
    accentTint: Color(0xFF2A1B12),
    onAccent: Color(0xFFFFFFFF),
    cyan: cyanBase,
    focusRing: Color(0x5CF26522), // ember @ ~36% for dark contrast
    overlay: Color(0x99050709),
    shadow: Color(0x66050709),
    success: Color(0xFF75E0A7),
    successBg: Color(0xFF10231A),
    successBorder: Color(0xFF1E4634),
    danger: Color(0xFFFDA29B),
    dangerBg: Color(0xFF2A1414),
    dangerBorder: Color(0xFF5B2321),
    warning: Color(0xFFFEC84B),
    warningBg: Color(0xFF2A1E0C),
    warningBorder: Color(0xFF55401C),
    info: Color(0xFF84CAFF),
    infoBg: Color(0xFF0C2036),
    infoBorder: Color(0xFF1E3A5B),
    skeletonBase: Color(0xFF20262F),
    skeletonHighlight: Color(0xFF2B333E),
  );

  @override
  AppColors copyWith({
    Brightness? brightness,
    Color? background,
    Color? surface,
    Color? surfaceMuted,
    Color? surfaceInset,
    Color? border,
    Color? borderStrong,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? textDisabled,
    Color? textInverse,
    Color? primary,
    Color? onPrimary,
    Color? accent,
    Color? accentHover,
    Color? accentActive,
    Color? accentTint,
    Color? onAccent,
    Color? cyan,
    Color? focusRing,
    Color? overlay,
    Color? shadow,
    Color? success,
    Color? successBg,
    Color? successBorder,
    Color? danger,
    Color? dangerBg,
    Color? dangerBorder,
    Color? warning,
    Color? warningBg,
    Color? warningBorder,
    Color? info,
    Color? infoBg,
    Color? infoBorder,
    Color? skeletonBase,
    Color? skeletonHighlight,
  }) {
    return AppColors(
      brightness: brightness ?? this.brightness,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      surfaceInset: surfaceInset ?? this.surfaceInset,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      textDisabled: textDisabled ?? this.textDisabled,
      textInverse: textInverse ?? this.textInverse,
      primary: primary ?? this.primary,
      onPrimary: onPrimary ?? this.onPrimary,
      accent: accent ?? this.accent,
      accentHover: accentHover ?? this.accentHover,
      accentActive: accentActive ?? this.accentActive,
      accentTint: accentTint ?? this.accentTint,
      onAccent: onAccent ?? this.onAccent,
      cyan: cyan ?? this.cyan,
      focusRing: focusRing ?? this.focusRing,
      overlay: overlay ?? this.overlay,
      shadow: shadow ?? this.shadow,
      success: success ?? this.success,
      successBg: successBg ?? this.successBg,
      successBorder: successBorder ?? this.successBorder,
      danger: danger ?? this.danger,
      dangerBg: dangerBg ?? this.dangerBg,
      dangerBorder: dangerBorder ?? this.dangerBorder,
      warning: warning ?? this.warning,
      warningBg: warningBg ?? this.warningBg,
      warningBorder: warningBorder ?? this.warningBorder,
      info: info ?? this.info,
      infoBg: infoBg ?? this.infoBg,
      infoBorder: infoBorder ?? this.infoBorder,
      skeletonBase: skeletonBase ?? this.skeletonBase,
      skeletonHighlight: skeletonHighlight ?? this.skeletonHighlight,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppColors(
      brightness: t < 0.5 ? brightness : other.brightness,
      background: c(background, other.background),
      surface: c(surface, other.surface),
      surfaceMuted: c(surfaceMuted, other.surfaceMuted),
      surfaceInset: c(surfaceInset, other.surfaceInset),
      border: c(border, other.border),
      borderStrong: c(borderStrong, other.borderStrong),
      textPrimary: c(textPrimary, other.textPrimary),
      textSecondary: c(textSecondary, other.textSecondary),
      textMuted: c(textMuted, other.textMuted),
      textDisabled: c(textDisabled, other.textDisabled),
      textInverse: c(textInverse, other.textInverse),
      primary: c(primary, other.primary),
      onPrimary: c(onPrimary, other.onPrimary),
      accent: c(accent, other.accent),
      accentHover: c(accentHover, other.accentHover),
      accentActive: c(accentActive, other.accentActive),
      accentTint: c(accentTint, other.accentTint),
      onAccent: c(onAccent, other.onAccent),
      cyan: c(cyan, other.cyan),
      focusRing: c(focusRing, other.focusRing),
      overlay: c(overlay, other.overlay),
      shadow: c(shadow, other.shadow),
      success: c(success, other.success),
      successBg: c(successBg, other.successBg),
      successBorder: c(successBorder, other.successBorder),
      danger: c(danger, other.danger),
      dangerBg: c(dangerBg, other.dangerBg),
      dangerBorder: c(dangerBorder, other.dangerBorder),
      warning: c(warning, other.warning),
      warningBg: c(warningBg, other.warningBg),
      warningBorder: c(warningBorder, other.warningBorder),
      info: c(info, other.info),
      infoBg: c(infoBg, other.infoBg),
      infoBorder: c(infoBorder, other.infoBorder),
      skeletonBase: c(skeletonBase, other.skeletonBase),
      skeletonHighlight: c(skeletonHighlight, other.skeletonHighlight),
    );
  }
}

/// Ergonomic access to the active [AppColors] token set.
///
/// ```dart
/// Container(color: context.colors.surface)
/// ```
extension AppColorsX on BuildContext {
  /// The [AppColors] registered on the current theme. Falls back to
  /// [AppColors.light] if (unexpectedly) not registered, so a widget never
  /// crashes for a missing extension.
  AppColors get colors =>
      Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
