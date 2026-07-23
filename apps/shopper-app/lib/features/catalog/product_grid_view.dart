import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/blocks/block_actions.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "catalog_list_controller.dart";

/// The shared product grid used by the Shop, Category and Search screens.
///
/// Renders a responsive grid of [ProductCard]s from a [CatalogListState] with:
/// a skeleton grid on first load, a full-screen error/empty state when there is
/// nothing to show, pull-to-refresh, infinite scroll (calls [onLoadMore] near
/// the bottom), and a footer spinner while the next page appends. Tapping a card
/// routes through the navigation seam ([handleProductTap]).
///
/// It is intentionally presentational — the owning screen holds the
/// [CatalogListController] and passes its [state] plus the [onRefresh] /
/// [onLoadMore] callbacks, so PLP / Category / Search share one grid.
class ProductGridView extends StatefulWidget {
  const ProductGridView({
    super.key,
    required this.state,
    required this.onRefresh,
    required this.onLoadMore,
    this.onRetry,
    this.emptyTitle = "No products",
    this.emptyMessage = "There's nothing to show here yet.",
    this.emptyIcon,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.header,
  });

  final CatalogListState state;
  final Future<void> Function() onRefresh;
  final VoidCallback onLoadMore;
  final VoidCallback? onRetry;
  final String emptyTitle;
  final String emptyMessage;
  final IconData? emptyIcon;
  final EdgeInsets padding;

  /// Optional widget pinned above the grid inside the same scroll view (e.g. a
  /// results-count line). Sort/filter controls usually sit OUTSIDE the grid.
  final Widget? header;

  @override
  State<ProductGridView> createState() => _ProductGridViewState();
}

class _ProductGridViewState extends State<ProductGridView> {
  final _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final pos = _controller.position;
    if (pos.pixels >= pos.maxScrollExtent - 400) {
      widget.onLoadMore();
    }
  }

  int _columnsFor(double width) {
    if (width >= 900) return 4;
    if (width >= 600) return 3;
    return 2;
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;

    // First load — skeleton grid.
    if (state.isLoadingInitial && state.items.isEmpty) {
      return _SkeletonGrid(padding: widget.padding, columnsFor: _columnsFor);
    }

    // Hard failure with nothing to show — full error state with retry.
    if (state.error != null && state.items.isEmpty) {
      return ErrorStateView(
        message:
            "We couldn't load these products. Check your connection and try again.",
        onRetry: widget.onRetry,
      );
    }

    // Loaded but empty.
    if (state.isEmpty) {
      return RefreshIndicator(
        color: context.colors.accent,
        onRefresh: widget.onRefresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                title: widget.emptyTitle,
                message: widget.emptyMessage,
                icon: widget.emptyIcon ?? PhosphorIcons.package(),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: context.colors.accent,
      onRefresh: widget.onRefresh,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = _columnsFor(constraints.maxWidth);
          return CustomScrollView(
            controller: _controller,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (widget.header != null)
                SliverToBoxAdapter(child: widget.header),
              SliverPadding(
                padding: widget.padding,
                sliver: SliverGrid(
                  gridDelegate:
                      SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: AppSpacing.lg,
                    crossAxisSpacing: AppSpacing.lg,
                    childAspectRatio: 0.62,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, i) {
                      final product = state.items[i];
                      return ProductCard(
                        product: product,
                        onTap: () => handleProductTap(context, product),
                      );
                    },
                    childCount: state.items.length,
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: _Footer(isLoadingMore: state.isLoadingMore),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.isLoadingMore});

  final bool isLoadingMore;

  @override
  Widget build(BuildContext context) {
    if (!isLoadingMore) return const SizedBox(height: AppSpacing.xl);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: Center(
        child: SizedBox(
          height: 22,
          width: 22,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: context.colors.accent,
          ),
        ),
      ),
    );
  }
}

class _SkeletonGrid extends StatelessWidget {
  const _SkeletonGrid({required this.padding, required this.columnsFor});

  final EdgeInsets padding;
  final int Function(double width) columnsFor;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = columnsFor(constraints.maxWidth);
        return Shimmer(
          child: GridView.builder(
            padding: padding,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              mainAxisSpacing: AppSpacing.lg,
              crossAxisSpacing: AppSpacing.lg,
              childAspectRatio: 0.62,
            ),
            itemCount: columns * 3,
            itemBuilder: (_, __) => const ProductCardSkeleton(),
          ),
        );
      },
    );
  }
}
