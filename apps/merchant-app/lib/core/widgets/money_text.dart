import "package:flutter/material.dart";
import "package:intl/intl.dart";

/// Formats and renders a monetary amount consistently across the app.
///
/// Uses `intl`'s currency formatting so the correct symbol, grouping and
/// decimal places are chosen from the [currencyCode] (and optional [locale]).
/// Keep money rendering going through this widget so totals never drift in
/// style between screens.
///
/// Medusa returns most amounts as plain decimals; if a value is in minor units
/// (cents), pass `minorUnits: true` to divide by 100.
///
/// ```dart
/// MoneyText(amount: order.total, currencyCode: order.currencyCode)
/// MoneyText(amount: 4800, currencyCode: "usd", minorUnits: true) // $48.00
/// ```
class MoneyText extends StatelessWidget {
  const MoneyText({
    super.key,
    required this.amount,
    required this.currencyCode,
    this.minorUnits = false,
    this.locale,
    this.style,
    this.color,
    this.strong = false,
    this.placeholder = "—",
  });

  /// The numeric amount. When null, [placeholder] is shown.
  final num? amount;

  /// ISO currency code (e.g. "usd", "eur", "gbp"). Case-insensitive.
  final String currencyCode;

  /// Whether [amount] is expressed in minor units (cents) and must be /100.
  final bool minorUnits;

  /// Optional locale for grouping/decimal conventions (defaults to ambient).
  final String? locale;

  /// Optional text style override. Defaults to the ambient body style.
  final TextStyle? style;

  /// Optional colour override.
  final Color? color;

  /// Renders with a semibold weight (for totals/emphasis).
  final bool strong;

  /// Shown when [amount] is null.
  final String placeholder;

  /// Formats [amount] to a currency string without building a widget — handy
  /// for `Text.rich`, chart labels, or accessibility strings.
  static String format(
    num amount,
    String currencyCode, {
    bool minorUnits = false,
    String? locale,
  }) {
    final value = minorUnits ? amount / 100 : amount;
    final format = NumberFormat.simpleCurrency(
      locale: locale,
      name: currencyCode.toUpperCase(),
    );
    return format.format(value);
  }

  @override
  Widget build(BuildContext context) {
    final base = style ?? Theme.of(context).textTheme.bodyMedium;
    final effective = base?.copyWith(
      color: color ?? base.color,
      fontWeight: strong ? FontWeight.w600 : base.fontWeight,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    final label = amount == null
        ? placeholder
        : format(
            amount!,
            currencyCode,
            minorUnits: minorUnits,
            locale: locale,
          );

    return Text(label, style: effective);
  }
}
