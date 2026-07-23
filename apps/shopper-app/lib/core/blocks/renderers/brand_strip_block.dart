import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `brand_strip` — a horizontal row of brand logos.
///
/// Shape (backend `modules/cms/registry/brand-strip.ts`):
/// ```
/// { title?, brands:[ { image, href } ] }
/// ```
Widget brandStripBlock(BuildContext context, BlockData data) {
  final brands = data.maps("brands");
  final title = data.str("title");
  if (brands.isEmpty) return const SizedBox.shrink();

  final c = context.colors;
  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Padding(
            padding: AppSpacing.screenH,
            child: Text(title, style: text.titleMedium),
          ),
          const Gap(AppSpacing.lg),
        ],
        SizedBox(
          height: 56,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: AppSpacing.screenH,
            itemCount: brands.length,
            separatorBuilder: (_, __) => const Gap(AppSpacing.xl),
            itemBuilder: (_, i) {
              final b = brands[i];
              return GestureDetector(
                onTap: () => handleBlockHref(context, b["href"] as String?),
                child: Container(
                  width: 110,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: c.surfaceMuted,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: StoreImage(
                    url: data.resolve(b["image"] as String?),
                    fit: BoxFit.contain,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}
