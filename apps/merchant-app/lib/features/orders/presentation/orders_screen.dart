import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/orders_list_controller.dart";
import "../data/order_models.dart";
import "order_detail_screen.dart";

/// The Orders tab: a searchable, status-filterable, paginated list of orders.
/// Rows show the order number, customer, date, total and fulfilment status;
/// tapping one opens the full [OrderDetailScreen].
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 400) {
      ref.read(ordersListControllerProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Surface a transient refresh error (data already on screen) as a snackbar.
    ref.listen<OrdersListState>(ordersListControllerProvider, (prev, next) {
      final err = next.error;
      if (err != null && next.orders.isNotEmpty && prev?.error != err) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(err.message)));
      }
    });

    final state = ref.watch(ordersListControllerProvider);
    final controller = ref.read(ordersListControllerProvider.notifier);

    return AppScaffold(
      title: "Orders",
      onRefresh: controller.refresh,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: AppTextField(
              controller: _searchController,
              hint: "Search by order #, name or email",
              prefixIcon: PhosphorIcons.magnifyingGlass(),
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.search,
              onChanged: controller.search,
              suffix: state.query.isEmpty
                  ? null
                  : IconButton(
                      icon: Icon(PhosphorIcons.x(), size: 18),
                      tooltip: "Clear",
                      onPressed: () {
                        _searchController.clear();
                        controller.search("");
                      },
                    ),
            ),
          ),
          _StatusFilterBar(
            selected: state.status,
            onSelected: controller.setStatus,
          ),
          const Gap(AppSpacing.sm),
          Expanded(child: _content(context, state, controller)),
        ],
      ),
    );
  }

  Widget _content(
    BuildContext context,
    OrdersListState state,
    OrdersListController controller,
  ) {
    if (state.isLoading && state.orders.isEmpty) {
      return const SkeletonList();
    }

    if (state.error != null && state.orders.isEmpty) {
      return _Scrollable(
        child: ErrorStateView(
          message: state.error!.message,
          onRetry: controller.retry,
        ),
      );
    }

    if (state.isEmpty) {
      return _Scrollable(
        child: EmptyState(
          icon: PhosphorIcons.receipt(),
          title: state.hasFilters ? "No matching orders" : "No orders yet",
          message: state.hasFilters
              ? "No orders match your search or filter. Try clearing them."
              : "When customers check out, their orders show up here.",
        ),
      );
    }

    final rows = state.visible;
    return ListView.separated(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      itemCount: rows.length + (state.hasMore ? 1 : 0),
      separatorBuilder: (context, _) => Divider(
        height: 1,
        thickness: 1,
        color: context.colors.border,
        indent: AppSpacing.lg,
        endIndent: AppSpacing.lg,
      ),
      itemBuilder: (context, index) {
        if (index >= rows.length) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Center(
              child: SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        return _OrderRow(order: rows[index]);
      },
    );
  }
}

/// The horizontally-scrolling status filter pills.
class _StatusFilterBar extends StatelessWidget {
  const _StatusFilterBar({required this.selected, required this.onSelected});

  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: kOrderStatusOptions.length,
        separatorBuilder: (_, __) => const Gap(AppSpacing.sm),
        itemBuilder: (context, index) {
          final option = kOrderStatusOptions[index];
          return _FilterPill(
            label: option.label,
            selected: option.value == selected,
            onTap: () => onSelected(option.value),
          );
        },
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        onTap: onTap,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          decoration: BoxDecoration(
            color: selected ? c.accentTint : c.surface,
            borderRadius:
                const BorderRadius.all(Radius.circular(AppRadius.pill)),
            border: Border.all(color: selected ? c.accent : c.border),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected ? c.accent : c.textSecondary,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
          ),
        ),
      ),
    );
  }
}

/// A single order row in the list.
class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.order});

  final OrderSummary order;

  @override
  Widget build(BuildContext context) {
    final items = order.itemCount ?? 0;
    final subtitle = [
      _formatDate(order.createdAt),
      "$items ${items == 1 ? "item" : "items"}",
    ].where((s) => s.isNotEmpty).join("  ·  ");

    return ListRowTile(
      title: "#${order.displayId}  ·  ${order.customerName ?? "Guest"}",
      subtitle: subtitle,
      showChevron: false,
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          MoneyText(
            amount: order.total,
            currencyCode: order.currencyCode,
            strong: true,
          ),
          const Gap(AppSpacing.xs),
          StatusChip(
            status: order.fulfillmentStatus ?? order.status,
          ),
        ],
      ),
      onTap: () => Navigator.of(context).push(
        OrderDetailScreen.route(order.id, order.displayId),
      ),
    );
  }
}

/// Formats an ISO date to a short, locale-aware label ("Jul 14, 2026").
String _formatDate(String iso) {
  if (iso.isEmpty) return "";
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "";
  return DateFormat.yMMMd().format(dt.toLocal());
}

/// Wraps a non-scrolling widget (empty/error) so pull-to-refresh still works.
class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        );
      },
    );
  }
}
