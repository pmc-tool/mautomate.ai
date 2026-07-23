import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../core/theme/app_colors.dart";
import "../catalog/catalog_controls.dart";
import "../catalog/catalog_list_controller.dart";
import "../catalog/product_detail_repository.dart";
import "../catalog/product_grid_view.dart";

/// A category detail — the store catalog scoped to one category.
///
/// Pushed OVER the shell via `context.pushCategory(id)`. The category name is
/// resolved from [singleCategoryProvider] for the app-bar title; the products
/// come from the shared paginated [catalogListControllerProvider] scoped by
/// `category_id`, rendered through the same [ProductGridView] as the PLP, with a
/// sort control (no category filter — it is already scoped).
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, required this.categoryId});

  /// The `:id` path param — the category id to load.
  final String categoryId;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  CatalogSort _sort = CatalogSort.newest;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final query =
        CatalogQuery(categoryId: widget.categoryId, sort: _sort);
    final state = ref.watch(catalogListControllerProvider(query));
    final controller =
        ref.read(catalogListControllerProvider(query).notifier);
    final category = ref.watch(singleCategoryProvider(widget.categoryId));
    final title = category.valueOrNull?.name ?? "Category";

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(title: Text(title)),
      body: Column(
        children: [
          CatalogControlsBar(
            sort: _sort,
            onSortChanged: (s) => setState(() => _sort = s),
          ),
          Expanded(
            child: ProductGridView(
              state: state,
              onRefresh: controller.refresh,
              onLoadMore: controller.loadMore,
              onRetry: controller.loadInitial,
              emptyTitle: "Nothing in this category",
              emptyMessage:
                  "This category doesn't have any products right now.",
            ),
          ),
        ],
      ),
    );
  }
}
