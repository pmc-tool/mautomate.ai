import "package:flutter/material.dart";

import "../../theme/spacing.dart";
import "../../widgets/app_buttons.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `hero` / `hero_slider`.
///
/// Data shape (CMS `hero_slider`; backend `modules/cms/registry/hero-slider.ts`):
/// ```
/// { autoplay_ms?: int, slides: [ { image, subtitle?, title, cta:{label?, href} } ] }
/// ```
/// Also tolerates a flat generic Puck hero (`{ image, title, subtitle, cta }`)
/// by treating the block itself as a single slide.
///
/// WAVE 1: renders the FIRST slide as a full-bleed image hero with an overlaid
/// subtitle / title / CTA. WAVE 2 (see SHOPPER_BLOCK_CATALOG.md): auto-advancing
/// PageView carousel honoring `autoplay_ms`, CTA href wired into the router.
Widget heroBlock(BuildContext context, BlockData data) {
  final slides = data.maps("slides");
  final Map<String, dynamic> slide = slides.isNotEmpty ? slides.first : data.raw;

  final image = data.resolve(slide["image"] as String?);
  final title = (slide["title"] as String?)?.trim();
  final subtitle = (slide["subtitle"] as String?)?.trim();
  final cta = slide["cta"];
  final ctaLabel = (cta is Map && cta["label"] is String)
      ? (cta["label"] as String).trim()
      : null;

  if (image == null && (title == null || title.isEmpty)) {
    return const SizedBox.shrink();
  }

  final text = Theme.of(context).textTheme;

  return SizedBox(
    height: 420,
    width: double.infinity,
    child: Stack(
      fit: StackFit.expand,
      children: [
        StoreImage(url: image, fit: BoxFit.cover),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [Color(0x99000000), Color(0x22000000), Color(0x00000000)],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (subtitle != null && subtitle.isNotEmpty) ...[
                Text(
                  subtitle.toUpperCase(),
                  style: text.labelSmall?.copyWith(
                    color: Colors.white70,
                    letterSpacing: 1.2,
                  ),
                ),
                const Gap(AppSpacing.sm),
              ],
              if (title != null && title.isNotEmpty)
                Text(
                  title.replaceAll(r"\n", "\n"),
                  style: text.displaySmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              if (ctaLabel != null && ctaLabel.isNotEmpty) ...[
                const Gap(AppSpacing.lg),
                PrimaryButton(
                  label: ctaLabel,
                  onPressed: () => handleBlockHref(
                    context,
                    cta is Map ? cta["href"] as String? : null,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}
