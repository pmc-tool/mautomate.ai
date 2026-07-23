import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/theme/app_colors.dart";
import "../catalog/catalog_controls.dart";
import "../catalog/catalog_list_controller.dart";
import "../catalog/product_grid_view.dart";
import "../chrome/categories_repository.dart";

/// The catalog / shop listing (the "Shop" bottom-nav tab).
///
/// A responsive, paginated product grid of the whole store catalog with a sort
/// control (newest / price) and a category filter sourced from
/// [topCategoriesProvider]. Sort/filter changes rebuild the [CatalogQuery],
/// which swaps to a fresh paginated [catalogListControllerProvider]. Pull to
/// refresh, infinite scroll, skeleton + empty states all live in
/// [ProductGridView]. Cards route to the PDP through the navigation seam.
class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  CatalogSort _sort = CatalogSort.newest;
  String? _categoryId;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final query = CatalogQuery(sort: _sort, categoryId: _categoryId);
    final state = ref.watch(catalogListControllerProvider(query));
    final controller =
        ref.read(catalogListControllerProvider(query).notifier);
    final categories = ref.watch(topCategoriesProvider).valueOrNull;

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(title: const Text("Shop")),
      body: Column(
        children: [
          CatalogControlsBar(
            sort: _sort,
            onSortChanged: (s) => setState(() => _sort = s),
            categories: categories,
            selectedCategoryId: _categoryId,
            onCategoryChanged: (id) => setState(() => _categoryId = id),
          ),
          Expanded(
            child: ProductGridView(
              state: state,
              onRefresh: controller.refresh,
              onLoadMore: controller.loadMore,
              onRetry: controller.loadInitial,
              emptyTitle: _categoryId == null
                  ? "No products yet"
                  : "Nothing in this category",
              emptyMessage: _categoryId == null
                  ? "This store hasn't added any products yet."
                  : "Try a different category or clear the filter.",
            ),
          ),
        ],
      ),
    );
  }
}
