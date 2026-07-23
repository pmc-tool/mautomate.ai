import "package:flutter/material.dart";

/// The mAutomate type system — Inter, one family, one scale.
///
/// Mirrors the web dashboard's Inter scale (see `design.ts`): a small, tight
/// set of sizes with restrained weights and negative tracking on large text.
/// Nothing here sets a colour — colour is applied by [AppTheme] from the
/// active [AppColors] so light/dark parity is automatic.
///
/// Material slot mapping (use the nearest slot in your widgets):
/// - `displayLarge/Medium/Small` — big numbers, hero metrics.
/// - `headlineSmall` / `titleLarge` — page & screen titles.
/// - `titleMedium` — card / section titles.
/// - `titleSmall` — list-row titles, strong labels.
/// - `bodyLarge/Medium/Small` — running text (Medium is the workhorse).
/// - `labelLarge` — button text.
/// - `labelMedium` — chips, field labels.
/// - `labelSmall` — the uppercase eyebrow (tracked).
class AppTypography {
  const AppTypography._();

  /// Builds the Inter [TextTheme]. Pass the resolved primary/secondary text
  /// colours so body and heading slots default to the right ink.
  ///
  /// [bodyColor] paints body/label slots; [displayColor] paints the
  /// display/headline/title slots (usually the same primary ink).
  static TextTheme textTheme({
    required Color bodyColor,
    required Color displayColor,
  }) {
    // Inter is bundled as a static-weight asset (see pubspec `fonts:`), so the
    // family resolves fully offline with no runtime network fetch. We start
    // from Material's populated text theme and stamp the Inter family across
    // every slot, then override sizes/weights/tracking to our own scale.
    final base =
        ThemeData(brightness: Brightness.light).textTheme.apply(
              fontFamily: "Inter",
            );

    final scaled = base.copyWith(
      displayLarge: base.displayLarge?.copyWith(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.5,
        height: 1.15,
      ),
      displayMedium: base.displayMedium?.copyWith(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
        height: 1.18,
      ),
      displaySmall: base.displaySmall?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
        height: 1.2,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.3,
        height: 1.25,
      ),
      headlineSmall: base.headlineSmall?.copyWith(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        height: 1.3,
      ),
      titleLarge: base.titleLarge?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        height: 1.3,
      ),
      titleMedium: base.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.1,
        height: 1.35,
      ),
      titleSmall: base.titleSmall?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        height: 1.4,
      ),
      bodyLarge: base.bodyLarge?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 1.5,
      ),
      bodyMedium: base.bodyMedium?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.5,
      ),
      bodySmall: base.bodySmall?.copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 1.45,
      ),
      labelLarge: base.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        height: 1.2,
      ),
      labelMedium: base.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        height: 1.4,
      ),
      labelSmall: base.labelSmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.7,
        height: 1.4,
      ),
    );

    return scaled.apply(
      bodyColor: bodyColor,
      displayColor: displayColor,
    );
  }
}
