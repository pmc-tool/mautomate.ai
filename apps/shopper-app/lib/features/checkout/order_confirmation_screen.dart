import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/router/routes.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "checkout_models.dart";

/// The order-placed confirmation, shown after a successful completion.
///
/// It is a terminal screen: it replaces the checkout in the navigator (so Back
/// does not return to a completed cart) and offers a single way forward —
/// continue shopping, which returns to the Home tab.
class OrderConfirmationScreen extends ConsumerWidget {
  const OrderConfirmationScreen({super.key, required this.order});

  final CheckoutOrder order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    void continueShopping() {
      // Leave the checkout stack and return to the shell, then Home.
      Navigator.of(context).popUntil((route) => route.isFirst);
      context.goHome();
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) continueShopping();
      },
      child: Scaffold(
        backgroundColor: c.background,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text("Order confirmed"),
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: AppSpacing.screen,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Gap(AppSpacing.xl),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: c.surfaceMuted,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      PhosphorIcons.checkCircle(PhosphorIconsStyle.fill),
                      size: 48,
                      color: c.primary,
                    ),
                  ),
                ),
                const Gap(AppSpacing.lg),
                Text(
                  "Thank you for your order",
                  style: text.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const Gap(AppSpacing.xs),
                Text(
                  "Your order ${order.reference} has been placed."
                  "${order.email != null ? " A confirmation was sent to ${order.email}." : ""}",
                  style: text.bodyMedium?.copyWith(color: c.textSecondary),
                  textAlign: TextAlign.center,
                ),
                const Gap(AppSpacing.xl),
                Container(
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: AppRadius.lgAll,
                    border: Border.all(color: c.border),
                  ),
                  padding: AppSpacing.card,
                  child: Column(
                    children: [
                      _row(context, "Order number", order.reference),
                      if (order.itemCount > 0) ...[
                        const Gap(AppSpacing.sm),
                        _row(
                          context,
                          "Items",
                          "${order.itemCount} item${order.itemCount == 1 ? "" : "s"}",
                        ),
                      ],
                      if (order.total != null) ...[
                        const Gap(AppSpacing.sm),
                        _row(
                          context,
                          "Total",
                          formatMoney(order.total!, order.currencyCode),
                          strong: true,
                        ),
                      ],
                    ],
                  ),
                ),
                const Gap(AppSpacing.xl),
                PrimaryButton(
                  label: "Continue shopping",
                  icon: PhosphorIcons.storefront(),
                  fullWidth: true,
                  onPressed: continueShopping,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value,
      {bool strong = false}) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: text.bodyMedium?.copyWith(color: c.textSecondary)),
        Text(
          value,
          style: strong
              ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700)
              : text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
