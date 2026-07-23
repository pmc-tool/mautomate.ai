import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/api/api_error.dart";
import "../../core/router/routes.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../checkout/checkout_screen.dart";
import "cart_controller.dart";
import "cart_models.dart";

/// The cart screen — live line items, order summary and a checkout entry.
///
/// Reads [cartControllerProvider] and renders its AsyncValue: a spinner on the
/// first load, an [ErrorStateView] with retry when a fetch fails with no cart
/// to fall back to, an [EmptyState] when the cart is empty, and the line-item
/// list + summary otherwise. Mutations (qty stepper, remove) go through the
/// controller; failures are surfaced as a SnackBar (never a crash).
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final state = ref.watch(cartControllerProvider);

    // Surface mutation failures without losing the visible cart.
    ref.listen<AsyncValue<Cart?>>(cartControllerProvider, (prev, next) {
      if (next.hasError && !next.isLoading) {
        final msg = ApiError.from(next.error!).message;
        showAppSnackBar(context, msg, kind: AppSnackKind.error);
      }
    });

    final cart = state.valueOrNull;
    final busy = state.isLoading;

    Widget body;
    if (state.isLoading && cart == null) {
      body = const SkeletonList(itemCount: 4);
    } else if (state.hasError && cart == null) {
      body = ErrorStateView(
        message: ApiError.from(state.error!).message,
        onRetry: () => ref.read(cartControllerProvider.notifier).refresh(),
      );
    } else if (cart == null || cart.isEmpty) {
      body = EmptyState(
        icon: PhosphorIcons.shoppingCartSimple(),
        title: "Your cart is empty",
        message: "Browse the store and add something you love.",
        action: PrimaryButton(
          label: "Start shopping",
          icon: PhosphorIcons.storefront(),
          onPressed: () => context.goShop(),
        ),
      );
    } else {
      body = _CartBody(cart: cart, busy: busy);
    }

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(
        title: const Text("Cart"),
        automaticallyImplyLeading: false,
        bottom: busy && cart != null
            ? const PreferredSize(
                preferredSize: Size.fromHeight(2),
                child: LinearProgressIndicator(minHeight: 2),
              )
            : null,
      ),
      body: SafeArea(child: body),
    );
  }
}

class _CartBody extends ConsumerWidget {
  const _CartBody({required this.cart, required this.busy});

  final Cart cart;
  final bool busy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: context.colors.accent,
            onRefresh: () =>
                ref.read(cartControllerProvider.notifier).refresh(),
            child: ListView.separated(
              padding: AppSpacing.screen,
              itemCount: cart.items.length,
              separatorBuilder: (_, __) => const Divider(height: AppSpacing.xl),
              itemBuilder: (_, i) => _LineItemRow(
                item: cart.items[i],
                currencyCode: cart.currencyCode,
                enabled: !busy,
              ),
            ),
          ),
        ),
        _SummaryBar(cart: cart),
      ],
    );
  }
}

class _LineItemRow extends ConsumerWidget {
  const _LineItemRow({
    required this.item,
    required this.currencyCode,
    required this.enabled,
  });

  final CartLineItem item;
  final String? currencyCode;
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final ctrl = ref.read(cartControllerProvider.notifier);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        StoreImage(
          url: item.thumbnail,
          width: 72,
          height: 72,
          borderRadius: AppRadius.mdAll,
        ),
        const Gap(AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: text.titleSmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (item.subtitle != null) ...[
                const Gap(AppSpacing.xxs),
                Text(
                  item.subtitle!,
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const Gap(AppSpacing.sm),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _QtyStepper(
                    quantity: item.quantity,
                    enabled: enabled,
                    onChanged: (q) => ctrl.updateItem(item.id, q),
                  ),
                  Text(
                    item.total != null
                        ? formatMoney(item.total!, currencyCode)
                        : (item.unitPrice != null
                            ? formatMoney(item.unitPrice!, currencyCode)
                            : ""),
                    style: text.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: "Remove",
          onPressed: enabled ? () => ctrl.removeItem(item.id) : null,
          icon: Icon(PhosphorIcons.trash(), size: 20, color: c.textMuted),
        ),
      ],
    );
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({
    required this.quantity,
    required this.onChanged,
    required this.enabled,
  });

  final int quantity;
  final ValueChanged<int> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    Widget btn(IconData icon, VoidCallback? onTap) => InkResponse(
          onTap: enabled ? onTap : null,
          radius: 20,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xs),
            child: Icon(
              icon,
              size: 18,
              color: enabled ? c.textPrimary : c.textDisabled,
            ),
          ),
        );

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: c.border),
        borderRadius: AppRadius.mdAll,
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          btn(PhosphorIcons.minus(), () => onChanged(quantity - 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            child: Text("$quantity", style: text.titleSmall),
          ),
          btn(PhosphorIcons.plus(), () => onChanged(quantity + 1)),
        ],
      ),
    );
  }
}

class _SummaryBar extends StatelessWidget {
  const _SummaryBar({required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final total = cart.total ?? cart.subtotal;

    Widget line(String label, num? amount, {bool strong = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: strong
                    ? text.titleMedium
                    : text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
              Text(
                amount != null ? formatMoney(amount, cart.currencyCode) : "—",
                style: strong
                    ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700)
                    : text.bodyMedium,
              ),
            ],
          ),
        );

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).padding.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (cart.subtotal != null) line("Subtotal", cart.subtotal),
          line("Total", total, strong: true),
          const Gap(AppSpacing.md),
          PrimaryButton(
            label: "Checkout",
            icon: PhosphorIcons.lock(),
            fullWidth: true,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const CheckoutScreen(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
