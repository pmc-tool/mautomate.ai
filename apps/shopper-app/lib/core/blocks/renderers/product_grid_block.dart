import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../api/catalog_binding.dart";
import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/empty_state.dart";
import "../../widgets/product_card.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `product_tabs` / `product_grid` — tabbed LIVE product grids.
///
/// CMS `product_tabs` shape (backend `modules/cms/registry/product-tabs.ts`):
/// ```
/// { tabs: [ { label, source:"all"|"category"|"collection"|"manual",
///             category_id?, collection_id?, product_ids?, sort?, limit? } ] }
/// ```
/// Generic Puck `product_grid`: `{ title?, collection_id?|category_id?, limit? }`.
///
/// Each tab's binding is resolved through [catalogProductsProvider] (which pulls
/// the store `region_id` so prices resolve), rendered as real [ProductCard]s.
/// Degrades gracefully: skeletons while loading, an empty state on a dangling
/// ref / no results, and it never throws.
Widget productGridBlock(BuildContext context, BlockData data) =>
    _ProductTabsBlock(data: data);

class _ProductTabsBlock extends ConsumerStatefulWidget {
  const _ProductTabsBlock({required this.data});

  final BlockData data;

  @override
  ConsumerState<_ProductTabsBlock> createState() => _ProductTabsBlockState();
}

class _ProductTabsBlockState extends ConsumerState<_ProductTabsBlock> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final rawTabs = data.maps("tabs");

    // Synthesize a single tab for a generic product_grid block.
    final tabs = rawTabs.isNotEmpty
        ? rawTabs
        : [
            {
              "label": data.strOr("title", "Products"),
              "source": data.str("category_id") != null
                  ? "category"
                  : (data.str("collection_id") != null ? "collection" : "all"),
              "category_id": data.str("category_id"),
              "collection_id": data.str("collection_id"),
              "limit": data.integer("limit", fallback: 8),
            },
          ];

    final title = data.str("title") ??
        (rawTabs.isEmpty ? null : (tabs.first["label"] as String?)?.trim());

    final selected = _selected.clamp(0, tabs.length - 1);
    final binding = CatalogBinding.fromTab(tabs[selected]);
    final async = ref.watch(catalogProductsProvider(binding));

    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null && title.isNotEmpty)
            Padding(
              padding: AppSpacing.screenH,
              child: Text(title, style: text.titleLarge),
            ),
          if (tabs.length > 1) ...[
            const Gap(AppSpacing.md),
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: AppSpacing.screenH,
                itemCount: tabs.length,
                separatorBuilder: (_, __) => const Gap(AppSpacing.sm),
                itemBuilder: (_, i) {
                  final label = (tabs[i]["label"] as String?)?.trim() ?? "Tab";
                  final isSel = i == selected;
                  return GestureDetector(
                    onTap: () => setState(() => _selected = i),
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                      ),
                      decoration: BoxDecoration(
                        color: isSel ? c.accentTint : c.surfaceMuted,
                        borderRadius:
                            const BorderRadius.all(Radius.circular(AppRadius.pill)),
                      ),
                      child: Text(
                        label,
                        style: text.labelMedium?.copyWith(
                          color: isSel ? c.accent : c.textSecondary,
                          fontWeight: isSel ? FontWeight.w600 : FontWeight.w500,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
          const Gap(AppSpacing.lg),
          Padding(
            padding: AppSpacing.screenH,
            child: async.when(
              loading: () => _grid(
                List.generate(
                  binding.limit.clamp(2, 6),
                  (_) => const ProductCardSkeleton(),
                ),
              ),
              error: (_, __) => const _ProductsEmpty(),
              data: (products) {
                if (products.isEmpty) return const _ProductsEmpty();
                return _grid([
                  for (final p in products)
                    ProductCard(
                      product: p,
                      onTap: () => handleProductTap(context, p),
                    ),
                ]);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _grid(List<Widget> children) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacing.lg,
      crossAxisSpacing: AppSpacing.lg,
      childAspectRatio: 0.64,
      children: children,
    );
  }
}

class _ProductsEmpty extends StatelessWidget {
  const _ProductsEmpty();

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      title: "No products yet",
      message: "Check back soon — new products will appear here.",
      compact: true,
    );
  }
}
