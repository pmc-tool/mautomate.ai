import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/api/api_error.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "orders_repository.dart";

/// The signed-in customer order history. Pushed over the account tab.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final orders = ref.watch(ordersProvider);

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(title: const Text("Your orders")),
      body: SafeArea(
        child: orders.when(
          loading: () => const SkeletonList(),
          error: (e, _) => ErrorStateView(
            message: ApiError.from(e).message,
            onRetry: () => ref.invalidate(ordersProvider),
          ),
          data: (list) {
            if (list.isEmpty) {
              return EmptyState(
                icon: PhosphorIcons.package(),
                title: "No orders yet",
                message: "When you place an order it will show up here.",
              );
            }
            return RefreshIndicator(
              color: c.accent,
              onRefresh: () async => ref.invalidate(ordersProvider),
              child: ListView.separated(
                padding: AppSpacing.screen,
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const Gap(AppSpacing.md),
                itemBuilder: (_, i) => _OrderTile(order: list[i]),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});

  final StoreOrder order;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final date = _formatDate(order.createdAt);

    return Container(
      padding: AppSpacing.card,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: c.surfaceMuted,
              borderRadius: AppRadius.smAll,
            ),
            child: Icon(PhosphorIcons.receipt(), color: c.textMuted, size: 20),
          ),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(order.label, style: text.titleSmall),
                const Gap(AppSpacing.xxs),
                Text(
                  [
                    if (date != null) date,
                    if (order.itemCount != null)
                      "${order.itemCount} item${order.itemCount == 1 ? "" : "s"}",
                    if (order.status != null) order.status!,
                  ].join("  ·  "),
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ],
            ),
          ),
          if (order.total != null)
            Text(
              formatMoney(order.total!, order.currencyCode),
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
        ],
      ),
    );
  }

  String? _formatDate(String? iso) {
    if (iso == null) return null;
    final dt = DateTime.tryParse(iso);
    if (dt == null) return null;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return "${months[dt.month - 1]} ${dt.day}, ${dt.year}";
  }
}
