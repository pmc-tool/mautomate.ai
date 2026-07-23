import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../api/catalog_binding.dart";
import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `category_showcase` — a "Shop by category" tile grid.
///
/// Shape (backend `modules/cms/registry/category-showcase.ts`):
/// ```
/// { sub_title?, title, items:[ { category_id?, label, image, href } ] }
/// ```
/// Tiles with a `category_id` resolve a LIVE product count (best-effort, via
/// [categoryProductCountProvider]); tiles without one are static. A missing
/// count never blocks the tile — it simply shows no count.
Widget categoryShowcaseBlock(BuildContext context, BlockData data) {
  final items = data.maps("items");
  final title = data.str("title");
  if (items.isEmpty && title == null) return const SizedBox.shrink();

  final subTitle = data.str("sub_title");
  final c = context.colors;
  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: AppSpacing.screenH,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (subTitle != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Text(
                    subTitle.toUpperCase(),
                    style: text.labelSmall
                        ?.copyWith(color: c.accent, letterSpacing: 1.2),
                  ),
                ),
              if (title != null) Text(title, style: text.titleLarge),
            ],
          ),
        ),
        if (items.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          Padding(
            padding: AppSpacing.screenH,
            child: GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              mainAxisSpacing: AppSpacing.md,
              crossAxisSpacing: AppSpacing.md,
              childAspectRatio: 0.8,
              children: [
                for (final item in items)
                  _CategoryCard(
                    image: data.resolve(item["image"] as String?),
                    label: (item["label"] as String?)?.trim(),
                    categoryId: item["category_id"] is String
                        ? item["category_id"] as String
                        : null,
                    onTap: () =>
                        handleBlockHref(context, item["href"] as String?),
                  ),
              ],
            ),
          ),
        ],
      ],
    ),
  );
}

class _CategoryCard extends ConsumerWidget {
  const _CategoryCard({
    required this.image,
    required this.label,
    required this.categoryId,
    required this.onTap,
  });

  final String? image;
  final String? label;
  final String? categoryId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    String? countLabel;
    if (categoryId != null) {
      final count = ref.watch(categoryProductCountProvider(categoryId!));
      countLabel = count.maybeWhen(
        data: (n) => n == null ? null : "$n ${n == 1 ? 'item' : 'items'}",
        orElse: () => null,
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: StoreImage(
              url: image,
              width: double.infinity,
              fit: BoxFit.cover,
              borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
            ),
          ),
          const Gap(AppSpacing.sm),
          if (label != null)
            Text(
              label!,
              style: text.labelMedium?.copyWith(color: c.textPrimary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          if (countLabel != null)
            Text(
              countLabel,
              style: text.labelSmall?.copyWith(color: c.textMuted),
            ),
        ],
      ),
    );
  }
}
