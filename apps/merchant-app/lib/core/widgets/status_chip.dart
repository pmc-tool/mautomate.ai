import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// The semantic tone of a [StatusChip].
enum StatusTone { neutral, success, pending, error, info }

/// A compact, pill-shaped status label with a semantic tint.
///
/// Ported from the web `StatusBadge`: the same status→tone mapping (paid,
/// fulfilled, published → success; pending, draft → pending; failed, canceled
/// → error; etc.) so an order/product status reads identically across web and
/// mobile. Underscores are humanised and the label is capitalised.
///
/// Two ways to use it:
/// ```dart
/// StatusChip(status: order.paymentStatus)          // auto tone from status
/// StatusChip(label: "Autopilot", tone: StatusTone.info) // explicit
/// ```
class StatusChip extends StatelessWidget {
  /// Derives tone and label from a raw backend [status] string.
  const StatusChip({super.key, required String status})
      : _status = status,
        label = null,
        tone = null,
        icon = null;

  /// An explicitly-toned chip with your own [label].
  const StatusChip.custom({
    super.key,
    required this.label,
    required this.tone,
    this.icon,
  }) : _status = null;

  final String? _status;

  /// The display label (used by [StatusChip.custom]).
  final String? label;

  /// The explicit tone (used by [StatusChip.custom]).
  final StatusTone? tone;

  /// Optional leading icon for a custom chip.
  final IconData? icon;

  static StatusTone toneForStatus(String? status) {
    switch ((status ?? "").toLowerCase().trim()) {
      case "published":
      case "live":
      case "active":
      case "paid":
      case "captured":
      case "completed":
      case "fulfilled":
      case "delivered":
      case "shipped":
      case "verified":
      case "success":
      case "connected":
        return StatusTone.success;
      case "pending":
      case "processing":
      case "draft":
      case "proposed":
      case "partially_fulfilled":
      case "partially_paid":
      case "awaiting":
      case "requires_action":
        return StatusTone.pending;
      case "failed":
      case "canceled":
      case "cancelled":
      case "expired":
      case "unverified":
      case "rejected":
      case "refunded":
      case "error":
        return StatusTone.error;
      case "info":
      case "not_fulfilled":
      case "unfulfilled":
        return StatusTone.info;
      default:
        return StatusTone.neutral;
    }
  }

  static String _humanise(String status) {
    final cleaned = status.replaceAll("_", " ").trim();
    if (cleaned.isEmpty) return "—";
    return cleaned[0].toUpperCase() + cleaned.substring(1);
  }

  ({Color fg, Color bg, Color border}) _palette(AppColors c, StatusTone t) {
    switch (t) {
      case StatusTone.success:
        return (fg: c.success, bg: c.successBg, border: c.successBorder);
      case StatusTone.pending:
        return (fg: c.warning, bg: c.warningBg, border: c.warningBorder);
      case StatusTone.error:
        return (fg: c.danger, bg: c.dangerBg, border: c.dangerBorder);
      case StatusTone.info:
        return (fg: c.info, bg: c.infoBg, border: c.infoBorder);
      case StatusTone.neutral:
        return (fg: c.textSecondary, bg: c.surfaceMuted, border: c.border);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final effectiveTone = tone ?? toneForStatus(_status);
    final effectiveLabel = label ?? _humanise(_status ?? "");
    final p = _palette(c, effectiveTone);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: p.bg,
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        border: Border.all(color: p.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: p.fg),
            const Gap(AppSpacing.xs),
          ],
          Text(
            effectiveLabel,
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: p.fg, letterSpacing: 0.2, height: 1.1),
          ),
        ],
      ),
    );
  }
}
