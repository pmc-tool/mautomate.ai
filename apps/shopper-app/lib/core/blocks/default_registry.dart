import "package:flutter_riverpod/flutter_riverpod.dart";

import "block_registry.dart";
import "renderers/brand_strip_block.dart";
import "renderers/category_showcase_block.dart";
import "renderers/container_block.dart";
import "renderers/deal_of_day_block.dart";
import "renderers/hero_block.dart";
import "renderers/image_block.dart";
import "renderers/image_gallery_block.dart";
import "renderers/instagram_grid_block.dart";
import "renderers/newsletter_block.dart";
import "renderers/product_grid_block.dart";
import "renderers/promo_banner_grid_block.dart";
import "renderers/rich_text_block.dart";
import "renderers/testimonials_block.dart";

/// The default block registry: the FULL catalog of native renderers keyed by
/// the CMS `block_type` (with a few generic Puck aliases). Each declares the
/// highest `schema_version` it supports (all current CMS blocks are v1) so a
/// newer server-side block shape degrades gracefully via [PageRenderer].
///
/// The 13 catalog block types (SHOPPER_BLOCK_CATALOG.md) are all covered here.
/// Extend without an engine change either by adding a renderer file + a line
/// below, or at runtime via `registry.withBlocks({...})` + a provider override.
final BlockRegistry defaultBlockRegistry = BlockRegistry({
  // 1. hero_slider — full-bleed carousel.
  "hero_slider": const BlockRegistration(heroBlock, maxSchemaVersion: 1),
  "hero": const BlockRegistration(heroBlock, maxSchemaVersion: 1),

  // 2. product_tabs — tabbed LIVE product grids (data-bound).
  "product_tabs": const BlockRegistration(productGridBlock, maxSchemaVersion: 1),
  "product_grid":
      const BlockRegistration(productGridBlock, maxSchemaVersion: 1),

  // 3. promo_banner_grid — mixed promo / category / instagram tiles.
  "promo_banner_grid":
      const BlockRegistration(promoBannerGridBlock, maxSchemaVersion: 1),

  // 4. category_showcase — "shop by category" tile grid (optional live counts).
  "category_showcase":
      const BlockRegistration(categoryShowcaseBlock, maxSchemaVersion: 1),

  // 5. image_with_text — image + copy media object.
  "image_with_text": const BlockRegistration(imageBlock, maxSchemaVersion: 1),
  "image": const BlockRegistration(imageBlock, maxSchemaVersion: 1),

  // 6. rich_text — sanitized HTML content.
  "rich_text": const BlockRegistration(richTextBlock, maxSchemaVersion: 1),
  "text": const BlockRegistration(richTextBlock, maxSchemaVersion: 1),

  // 7. deal_of_day — single promo + live countdown (optional product ref).
  "deal_of_day": const BlockRegistration(dealOfDayBlock, maxSchemaVersion: 1),

  // 8. brand_strip — row of brand logos.
  "brand_strip": const BlockRegistration(brandStripBlock, maxSchemaVersion: 1),

  // 9. testimonials — customer quote cards.
  "testimonials":
      const BlockRegistration(testimonialsBlock, maxSchemaVersion: 1),

  // 10. instagram_grid — row of square instagram tiles.
  "instagram_grid":
      const BlockRegistration(instagramGridBlock, maxSchemaVersion: 1),

  // 11. image_gallery — collage / lookbook grid.
  "image_gallery":
      const BlockRegistration(imageGalleryBlock, maxSchemaVersion: 1),

  // 12. newsletter — email-signup section.
  "newsletter": const BlockRegistration(newsletterBlock, maxSchemaVersion: 1),

  // 13. container — free-form column layout of atomic widgets (secondary
  //     dispatch on widget_type).
  "container": const BlockRegistration(containerBlock, maxSchemaVersion: 1),
});

/// The active registry. Override in a `ProviderScope` to inject blocks or a
/// test double.
final blockRegistryProvider =
    Provider<BlockRegistry>((ref) => defaultBlockRegistry);
