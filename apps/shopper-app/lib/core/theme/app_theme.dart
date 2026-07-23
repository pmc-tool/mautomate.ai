import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "app_colors.dart";
import "app_typography.dart";
import "spacing.dart";

/// The single source of truth for the app's Material 3 [ThemeData].
///
/// `AppTheme.light()` / `AppTheme.dark()` return fully wired themes: colour
/// scheme, Inter typography, and component themes (app bar, inputs, cards,
/// dividers, chips, buttons) — all reading from [AppColors], which is also
/// registered as a [ThemeExtension] so widgets can reach every semantic token
/// via `context.colors`.
///
/// `app.dart` (owned by the foundation agent) imports this and passes the two
/// themes to `MaterialApp`. Do not build ad-hoc `ThemeData` elsewhere.
class AppTheme {
  const AppTheme._();

  /// Light theme.
  ///
  /// Pass [brandColors] to build the theme from a brand-adjusted token set
  /// (e.g. `applyBrandAccent(AppColors.light, accent)`) so a white-label
  /// merchant's accent flows into every Material component theme. When null
  /// (the default) the theme is built from [AppColors.light] — byte-identical
  /// to before, so a store without a brand accent is unchanged.
  static ThemeData light([AppColors? brandColors]) =>
      _build(brandColors ?? AppColors.light);

  /// Dark theme. See [light] for the optional [brandColors] override.
  static ThemeData dark([AppColors? brandColors]) =>
      _build(brandColors ?? AppColors.dark);

  static ThemeData _build(AppColors c) {
    final isDark = c.brightness == Brightness.dark;

    final colorScheme = ColorScheme(
      brightness: c.brightness,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.accentTint,
      onPrimaryContainer: c.accent,
      secondary: c.accent,
      onSecondary: c.onAccent,
      secondaryContainer: c.accentTint,
      onSecondaryContainer: c.accent,
      tertiary: c.cyan,
      onTertiary: c.textInverse,
      error: c.danger,
      onError: isDark ? c.background : Colors.white,
      errorContainer: c.dangerBg,
      onErrorContainer: c.danger,
      surface: c.surface,
      onSurface: c.textPrimary,
      surfaceContainerHighest: c.surfaceMuted,
      onSurfaceVariant: c.textSecondary,
      outline: c.border,
      outlineVariant: c.border,
      shadow: c.shadow,
      scrim: c.overlay,
      inverseSurface: isDark ? c.textPrimary : AppColors.inkBase,
      onInverseSurface: isDark ? c.background : Colors.white,
      inversePrimary: c.accent,
    );

    final textTheme = AppTypography.textTheme(
      bodyColor: c.textPrimary,
      displayColor: c.textPrimary,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: c.brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: c.background,
      canvasColor: c.background,
      textTheme: textTheme,
      primaryColor: c.primary,
      dividerColor: c.border,
      splashFactory: InkSparkle.splashFactory,
      // Register the token set so `context.colors` resolves everywhere.
      extensions: <ThemeExtension<dynamic>>[c],

      appBarTheme: AppBarTheme(
        backgroundColor: c.surface,
        foregroundColor: c.textPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        shadowColor: c.shadow,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle:
            isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        iconTheme: IconThemeData(color: c.textPrimary, size: 22),
      ),

      dividerTheme: DividerThemeData(
        color: c.border,
        thickness: 1,
        space: 1,
      ),

      cardTheme: CardThemeData(
        color: c.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: c.border),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceInset,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: c.textMuted),
        labelStyle: textTheme.labelMedium?.copyWith(color: c.textSecondary),
        floatingLabelStyle: textTheme.labelMedium?.copyWith(color: c.accent),
        prefixIconColor: c.textMuted,
        suffixIconColor: c.textMuted,
        errorStyle: textTheme.labelMedium?.copyWith(color: c.danger),
        border: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: c.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: c.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: c.danger, width: 1.5),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: c.border.withValues(alpha: 0.5)),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: c.surfaceMuted,
        side: BorderSide(color: c.border),
        labelStyle: textTheme.labelMedium?.copyWith(color: c.textSecondary),
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
      ),

      // Baseline button themes. The component kit's PrimaryButton /
      // SecondaryButton / GhostButton are preferred, but these keep any raw
      // Material buttons on-brand and above the 48dp tap-target floor.
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          disabledBackgroundColor: c.surfaceMuted,
          disabledForegroundColor: c.textDisabled,
          elevation: 0,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          textStyle: textTheme.labelLarge,
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.textPrimary,
          side: BorderSide(color: c.borderStrong),
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          textStyle: textTheme.labelLarge,
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.accent,
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          textStyle: textTheme.labelLarge,
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
      ),

      iconTheme: IconThemeData(color: c.textSecondary, size: 22),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? c.surfaceMuted : AppColors.inkBase,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: isDark ? c.textPrimary : Colors.white,
        ),
        actionTextColor: c.accent,
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),

      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: c.surface,
        selectedItemColor: c.accent,
        unselectedItemColor: c.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        selectedLabelStyle: textTheme.labelSmall?.copyWith(letterSpacing: 0.2),
        unselectedLabelStyle:
            textTheme.labelSmall?.copyWith(letterSpacing: 0.2),
      ),

      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface,
        indicatorColor: c.accentTint,
        elevation: 0,
        height: 64,
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => textTheme.labelMedium?.copyWith(
            color: states.contains(WidgetState.selected)
                ? c.accent
                : c.textMuted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 24,
            color:
                states.contains(WidgetState.selected) ? c.accent : c.textMuted,
          ),
        ),
      ),

      listTileTheme: ListTileThemeData(
        iconColor: c.textSecondary,
        textColor: c.textPrimary,
        tileColor: c.surface,
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: c.accent,
        linearTrackColor: c.surfaceMuted,
        circularTrackColor: c.surfaceMuted,
      ),

      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white
              : c.textMuted,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? c.accent
              : c.surfaceMuted,
        ),
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? c.accent
              : c.border,
        ),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: c.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
        ),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
        titleTextStyle: textTheme.titleLarge,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: c.textSecondary),
      ),

      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: isDark ? c.surfaceMuted : AppColors.inkBase,
          borderRadius: AppRadius.smAll,
        ),
        textStyle: textTheme.labelMedium?.copyWith(
          color: isDark ? c.textPrimary : Colors.white,
        ),
      ),

      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStateProperty.all(c.borderStrong),
        radius: const Radius.circular(AppRadius.pill),
        thickness: WidgetStateProperty.all(4),
      ),

      splashColor: c.accent.withValues(alpha: 0.08),
      highlightColor: c.accent.withValues(alpha: 0.04),
    );
  }
}
