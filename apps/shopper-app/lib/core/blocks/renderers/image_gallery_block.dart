import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `image_gallery` — a collage / lookbook grid.
///
/// Shape (backend `modules/cms/registry/image-gallery.ts`):
/// ```
/// { heading?, subheading?, columns?:"2".."6", gap?:"<px>", aspect?:"square"|
///   "portrait"|"landscape"|"auto", items:[ { image, caption?, href? } ] }
/// ```
/// `columns` / `gap` arrive as strings; `aspect` maps to a tile ratio.
Widget imageGalleryBlock(BuildContext context, BlockData data) {
  final items = data.maps("items");
  if (items.isEmpty) return const SizedBox.shrink();

  final heading = data.str("heading");
  final subheading = data.str("subheading");
  final columns = (int.tryParse(data.strOr("columns", "3")) ?? 3).clamp(2, 6);
  final gap = (double.tryParse(data.strOr("gap", "12")) ?? 12).clamp(0, 40).toDouble();
  final ratio = switch (data.strOr("aspect", "square")) {
    "portrait" => 0.75,
    "landscape" => 1.5,
    "auto" => 1.0,
    _ => 1.0,
  };

  final c = context.colors;
  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (heading != null || subheading != null) ...[
          Padding(
            padding: AppSpacing.screenH,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (heading != null) Text(heading, style: text.titleLarge),
                if (subheading != null) ...[
                  const Gap(AppSpacing.xs),
                  Text(
                    subheading,
                    style: text.bodyMedium?.copyWith(color: c.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          const Gap(AppSpacing.lg),
        ],
        Padding(
          padding: AppSpacing.screenH,
          child: GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: columns,
            mainAxisSpacing: gap,
            crossAxisSpacing: gap,
            childAspectRatio: ratio,
            children: [
              for (final item in items)
                _GalleryTile(
                  url: data.resolve(item["image"] as String?),
                  caption: (item["caption"] as String?)?.trim(),
                  onTap: item["href"] is String
                      ? () => handleBlockHref(context, item["href"] as String?)
                      : null,
                ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _GalleryTile extends StatelessWidget {
  const _GalleryTile({
    required this.url,
    required this.caption,
    required this.onTap,
  });

  final String? url;
  final String? caption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: AppRadius.mdAll,
        child: Stack(
          fit: StackFit.expand,
          children: [
            StoreImage(url: url, fit: BoxFit.cover),
            if (caption != null && caption!.isNotEmpty)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Color(0xAA000000), Color(0x00000000)],
                    ),
                  ),
                  child: Text(
                    caption!,
                    style: text.labelSmall?.copyWith(color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
