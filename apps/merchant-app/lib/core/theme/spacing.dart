import "package:flutter/widgets.dart";

/// The mAutomate spacing scale — a 4/8 rhythm with ~16 gutters.
///
/// Use these tokens for every gap, pad and inset instead of magic numbers, so
/// vertical/horizontal rhythm stays consistent across screens.
///
/// ```dart
/// Padding(padding: EdgeInsets.all(AppSpacing.lg), child: ...)
/// Column(children: [a, const Gap(AppSpacing.md), b])
/// ```
class AppSpacing {
  const AppSpacing._();

  /// 2 — hairline nudge.
  static const double xxs = 2;

  /// 4 — the base unit.
  static const double xs = 4;

  /// 8 — tight gap between related elements.
  static const double sm = 8;

  /// 12 — default gap inside a group.
  static const double md = 12;

  /// 16 — the standard gutter / card padding.
  static const double lg = 16;

  /// 24 — section spacing.
  static const double xl = 24;

  /// 32 — large block spacing.
  static const double xxl = 32;

  /// 48 — screen-level breathing room.
  static const double xxxl = 48;

  // --- Common ready-made insets -----------------------------------------

  /// Standard screen edge padding (16 all round).
  static const EdgeInsets screen = EdgeInsets.all(lg);

  /// Standard horizontal screen padding.
  static const EdgeInsets screenH = EdgeInsets.symmetric(horizontal: lg);

  /// Standard card interior padding.
  static const EdgeInsets card = EdgeInsets.all(lg);
}

/// The corner-radius scale, matching the web (`radius` in `design.ts`).
class AppRadius {
  const AppRadius._();

  static const double sm = 6;
  static const double md = 10;
  static const double lg = 14;
  static const double pill = 999;

  static const BorderRadius smAll = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgAll = BorderRadius.all(Radius.circular(lg));
}

/// A square, direction-agnostic spacer.
///
/// A single [Gap] works inside both a [Row] and a [Column] — it sizes itself
/// on both axes, so the parent only consumes the axis it lays out along.
///
/// ```dart
/// Row(children: [icon, const Gap(AppSpacing.sm), label])
/// ```
class Gap extends StatelessWidget {
  /// Creates a spacer of [size] logical pixels on both axes.
  const Gap(this.size, {super.key});

  /// 4dp spacer.
  const Gap.xs({super.key}) : size = AppSpacing.xs;

  /// 8dp spacer.
  const Gap.sm({super.key}) : size = AppSpacing.sm;

  /// 12dp spacer.
  const Gap.md({super.key}) : size = AppSpacing.md;

  /// 16dp spacer.
  const Gap.lg({super.key}) : size = AppSpacing.lg;

  /// 24dp spacer.
  const Gap.xl({super.key}) : size = AppSpacing.xl;

  /// The gap extent in logical pixels.
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size);
}
