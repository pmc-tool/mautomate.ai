import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/app_buttons.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `image` and `image_with_text`.
///
/// Generic Puck `image` shape: `{ src|image, alt?, aspect_ratio? }`.
/// CMS `image_with_text` shape (backend `modules/cms/registry/image-with-text.ts`):
/// ```
/// { image, image_side:"left"|"right", eyebrow?, title, body?, cta?:{label?,href} }
/// ```
///
/// WAVE 1: a plain image, OR — when copy fields are present — an image + text
/// media object stacked vertically (image on top, copy below) for a clean mobile
/// layout. WAVE 2 (see SHOPPER_BLOCK_CATALOG.md): honor `image_side` as a
/// side-by-side layout on wider viewports, aspect-ratio prop, and CTA routing.
Widget imageBlock(BuildContext context, BlockData data) {
  final image = data.asset("image") ?? data.asset("src");
  final title = data.str("title");
  final body = data.str("body");
  final eyebrow = data.str("eyebrow");
  final cta = data.object("cta");
  final ctaLabel = (cta["label"] as String?)?.trim();

  final hasCopy = title != null || body != null || eyebrow != null;

  if (image == null && !hasCopy) return const SizedBox.shrink();

  // Plain image (no copy).
  if (!hasCopy) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: StoreImage(
        url: image,
        width: double.infinity,
        height: 240,
        fit: BoxFit.cover,
      ),
    );
  }

  final c = context.colors;
  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (image != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: StoreImage(
              url: image,
              width: double.infinity,
              height: 220,
              fit: BoxFit.cover,
              borderRadius: AppRadius.lgAll,
            ),
          ),
        Padding(
          padding: AppSpacing.screenH,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null) ...[
                Text(
                  eyebrow.toUpperCase(),
                  style: text.labelSmall
                      ?.copyWith(color: c.accent, letterSpacing: 1.2),
                ),
                const Gap(AppSpacing.xs),
              ],
              if (title != null)
                Text(
                  title.replaceAll(r"\n", "\n"),
                  style: text.headlineSmall?.copyWith(color: c.textPrimary),
                ),
              if (body != null) ...[
                const Gap(AppSpacing.sm),
                Text(
                  body,
                  style: text.bodyMedium?.copyWith(color: c.textSecondary),
                ),
              ],
              if (ctaLabel != null && ctaLabel.isNotEmpty) ...[
                const Gap(AppSpacing.lg),
                PrimaryButton(
                  label: ctaLabel,
                  onPressed: () =>
                      handleBlockHref(context, cta["href"] as String?),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}
