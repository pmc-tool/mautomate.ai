import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/products_list_controller.dart";
import "../data/product_models.dart";
import "create_product_screen.dart";
import "product_detail_screen.dart";
import "product_thumbnail.dart";

/// Products tab: a searchable, paginated catalogue. Each row shows a thumbnail,
/// title, a published/draft status chip and the product's price. Tapping a row
/// opens the detail screen for quick edits. The app bar carries a "New product"
/// action that opens the create form.
class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

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
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 400) {
      ref.read(productsListControllerProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(productsListControllerProvider);
    final controller = ref.read(productsListControllerProvider.notifier);

    return AppScaffold(
      title: "Products",
      actions: [
        IconButton(
          icon: Icon(PhosphorIcons.plus()),
          tooltip: "New product",
          onPressed: _openCreate,
        ),
      ],
      body: Column(
        children: [
          _SearchHeader(
            controller: _searchController,
            onChanged: controller.search,
            onClear: () {
              _searchController.clear();
              controller.clearSearch();
            },
          ),
          Expanded(child: _body(context, state, controller)),
        ],
      ),
    );
  }

  Widget _body(
    BuildContext context,
    ProductsListState state,
    ProductsListController controller,
  ) {
    if (state.loading) {
      return const SkeletonList(itemCount: 8);
    }

    if (state.error != null) {
      return ErrorStateView(
        message: state.error!.message,
        onRetry: controller.retry,
      );
    }

    if (state.isEmpty) {
      final searching = state.query.trim().isNotEmpty;
      return RefreshIndicator(
        onRefresh: controller.refresh,
        color: context.colors.accent,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.12),
            EmptyState(
              icon: searching
                  ? PhosphorIcons.magnifyingGlass()
                  : PhosphorIcons.package(),
              title: searching ? "No matches" : "No products yet",
              message: searching
                  ? "No products match “${state.query.trim()}”. Try a different search."
                  : "When you add products to your catalogue, they'll appear here.",
              action: searching
                  ? null
                  : PrimaryButton(
                      label: "Add your first product",
                      icon: PhosphorIcons.plus(),
                      onPressed: _openCreate,
                    ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refresh,
      color: context.colors.accent,
      child: ListView.separated(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        itemCount: state.items.length + 1,
        separatorBuilder: (_, __) => Divider(
          height: 1,
          thickness: 1,
          indent: AppSpacing.lg,
          endIndent: AppSpacing.lg,
          color: context.colors.border,
        ),
        itemBuilder: (context, index) {
          if (index >= state.items.length) {
            return _ListFooter(state: state, onRetry: controller.loadMore);
          }
          return _ProductRow(
            product: state.items[index],
            onTap: () => _openDetail(state.items[index]),
          );
        },
      ),
    );
  }

  void _openCreate() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const CreateProductScreen(),
      ),
    );
  }

  void _openDetail(ProductListItem product) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductDetailScreen(
          productId: product.id,
          initialTitle: product.title,
        ),
      ),
    );
  }
}

/// The persistent search field above the list.
class _SearchHeader extends StatelessWidget {
  const _SearchHeader({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      child: ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (context, value, _) {
          return AppTextField(
            controller: controller,
            hint: "Search products",
            prefixIcon: PhosphorIcons.magnifyingGlass(),
            textInputAction: TextInputAction.search,
            onChanged: onChanged,
            suffix: value.text.isNotEmpty
                ? IconButton(
                    icon: Icon(PhosphorIcons.x(), size: 18),
                    color: c.textMuted,
                    splashRadius: 20,
                    tooltip: "Clear",
                    onPressed: onClear,
                  )
                : null,
          );
        },
      ),
    );
  }
}

/// A single product row.
class _ProductRow extends StatelessWidget {
  const _ProductRow({required this.product, required this.onTap});

  final ProductListItem product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListRowTile(
      onTap: onTap,
      showChevron: false,
      leading: ProductThumbnail(url: product.thumbnail, size: 48),
      title: product.title,
      subtitle: _subtitle(),
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          StatusChip(status: product.status),
          if (product.price != null) ...[
            const Gap(AppSpacing.xs),
            MoneyText(
              amount: product.price,
              currencyCode: product.currencyCode ?? "usd",
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  String _subtitle() {
    final parts = <String>[];
    final variants = product.variantCount ?? 0;
    if (variants > 0) {
      parts.add("$variants variant${variants == 1 ? "" : "s"}");
    }
    final stock = product.stock;
    if (stock != null) {
      parts.add("${stock.toInt()} in stock");
    }
    if (parts.isEmpty) return product.handle;
    return parts.join("  ·  ");
  }
}

/// The paging footer: a spinner while loading more, a retry line on failure, or
/// nothing when the list is complete.
class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.state, required this.onRetry});

  final ProductsListState state;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Center(
          child: SizedBox(
            height: 22,
            width: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (state.pageError != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        child: Column(
          children: [
            Text(
              state.pageError!.message,
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.textSecondary),
            ),
            const Gap(AppSpacing.md),
            SecondaryButton(
              label: "Try again",
              icon: PhosphorIcons.arrowClockwise(),
              size: AppButtonSize.small,
              onPressed: () => onRetry(),
            ),
          ],
        ),
      );
    }

    if (!state.hasMore && state.items.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Center(
          child: Text(
            "${state.count} product${state.count == 1 ? "" : "s"}",
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: c.textMuted),
          ),
        ),
      );
    }

    return const SizedBox(height: AppSpacing.xl);
  }
}
