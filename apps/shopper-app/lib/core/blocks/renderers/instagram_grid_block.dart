import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `instagram_grid` — a row of square instagram tiles.
///
/// Shape (backend `modules/cms/registry/instagram-grid.ts`):
/// ```
/// { handle, heading?, images:[ { image, href } ] }
/// ```
Widget instagramGridBlock(BuildContext context, BlockData data) {
  final images = data.maps("images");
  final handle = data.str("handle");
  final heading = data.str("heading");
  if (images.isEmpty && handle == null) return const SizedBox.shrink();

  final c = context.colors;
  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: AppSpacing.screenH,
          child: Row(
            children: [
              Icon(PhosphorIcons.instagramLogo(), color: c.textPrimary, size: 20),
              const Gap(AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (heading != null)
                      Text(heading, style: text.titleMedium),
                    if (handle != null)
                      Text(
                        handle,
                        style: text.labelMedium
                            ?.copyWith(color: c.textSecondary),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (images.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: AppSpacing.screenH,
              itemCount: images.length,
              separatorBuilder: (_, __) => const Gap(AppSpacing.sm),
              itemBuilder: (_, i) {
                final img = images[i];
                return GestureDetector(
                  onTap: () => handleBlockHref(context, img["href"] as String?),
                  child: StoreImage(
                    url: data.resolve(img["image"] as String?),
                    width: 120,
                    height: 120,
                    fit: BoxFit.cover,
                    borderRadius: AppRadius.mdAll,
                  ),
                );
              },
            ),
          ),
        ],
      ],
    ),
  );
}
