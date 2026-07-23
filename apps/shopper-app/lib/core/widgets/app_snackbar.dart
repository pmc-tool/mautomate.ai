import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// The tone of an app snackbar — drives its colour and leading glyph.
enum AppSnackKind { success, error, neutral }

/// Shows a consistent, floating snackbar anywhere in the app.
///
/// One styling for every transient message so success / error / neutral toasts
/// look identical everywhere they are raised (add-to-cart, cart mutation
/// failures, …) instead of each screen hand-rolling its own [SnackBar].
///
/// Success and error use the fixed solid brand tones ([AppColors.successSolid]
/// / [AppColors.dangerSolid]) which keep white content above WCAG-AA in BOTH
/// light and dark; neutral defers to the themed snackbar surface. Any visible
/// snackbar is cleared first so messages never stack.
void showAppSnackBar(
  BuildContext context,
  String message, {
  AppSnackKind kind = AppSnackKind.neutral,
}) {
  final c = context.colors;
  final messenger = ScaffoldMessenger.of(context);

  Color? background;
  Color foreground;
  IconData? icon;
  switch (kind) {
    case AppSnackKind.success:
      background = AppColors.successSolid;
      foreground = Colors.white;
      icon = PhosphorIcons.checkCircle();
    case AppSnackKind.error:
      background = AppColors.dangerSolid;
      foreground = Colors.white;
      icon = PhosphorIcons.warning();
    case AppSnackKind.neutral:
      // Defer to SnackBarThemeData for the surface; match its content colour.
      background = null;
      foreground =
          c.brightness == Brightness.dark ? c.textPrimary : Colors.white;
      icon = null;
  }

  messenger
    ..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: background,
        content: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, color: foreground, size: 18),
              const Gap(AppSpacing.sm),
            ],
            Expanded(
              child: Text(message, style: TextStyle(color: foreground)),
            ),
          ],
        ),
      ),
    );
}
