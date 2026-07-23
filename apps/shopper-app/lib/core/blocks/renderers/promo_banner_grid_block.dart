import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `promo_banner_grid` — mixed promo / category / instagram tiles.
///
/// Shape (backend `modules/cms/registry/promo-banner-grid.ts`):
/// ```
/// { intro?:{title,body,link_label,href},
///   sale?:{image,special_title,title,link_label,href},
///   categories:[{image,title,count_label?,href,wide?}],
///   instagram?:{image,sub_title,handle,href} }
/// ```
/// Every group is optional — an absent group is simply not drawn. Category
/// tiles honour `wide` (span full width). All tiles route taps through the
/// navigation seam.
Widget promoBannerGridBlock(BuildContext context, BlockData data) {
  final intro = data.object("intro");
  final sale = data.object("sale");
  final categories = data.maps("categories");
  final instagram = data.object("instagram");

  final hasIntro = (intro["title"] as String?)?.trim().isNotEmpty ?? false;
  final hasSale = data.resolve(sale["image"] as String?) != null;
  final hasInstagram = data.resolve(instagram["image"] as String?) != null;

  if (!hasIntro && !hasSale && categories.isEmpty && !hasInstagram) {
    return const SizedBox.shrink();
  }

  final c = context.colors;
  final text = Theme.of(context).textTheme;

  return Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
    child: Padding(
      padding: AppSpacing.screenH,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasIntro) ...[
            Text(
              (intro["title"] as String).trim().replaceAll(r"\n", "\n"),
              style: text.headlineSmall?.copyWith(color: c.textPrimary),
            ),
            if ((intro["body"] as String?)?.trim().isNotEmpty ?? false) ...[
              const Gap(AppSpacing.sm),
              Text(
                (intro["body"] as String).trim(),
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
            ],
            if ((intro["link_label"] as String?)?.trim().isNotEmpty ??
                false) ...[
              const Gap(AppSpacing.sm),
              _TextLink(
                label: (intro["link_label"] as String).trim(),
                onTap: () => handleBlockHref(context, intro["href"] as String?),
              ),
            ],
            const Gap(AppSpacing.lg),
          ],
          if (hasSale) ...[
            _SaleBanner(
              image: data.resolve(sale["image"] as String?),
              specialTitle: (sale["special_title"] as String?)?.trim(),
              title: (sale["title"] as String?)?.trim(),
              linkLabel: (sale["link_label"] as String?)?.trim(),
              onTap: () => handleBlockHref(context, sale["href"] as String?),
            ),
            const Gap(AppSpacing.lg),
          ],
          if (categories.isNotEmpty)
            _CategoryTiles(categories: categories, data: data),
          if (hasInstagram) ...[
            const Gap(AppSpacing.lg),
            _InstagramTile(
              image: data.resolve(instagram["image"] as String?),
              subTitle: (instagram["sub_title"] as String?)?.trim(),
              handle: (instagram["handle"] as String?)?.trim(),
              onTap: () =>
                  handleBlockHref(context, instagram["href"] as String?),
            ),
          ],
        ],
      ),
    ),
  );
}

class _TextLink extends StatelessWidget {
  const _TextLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: text.labelLarge?.copyWith(
          color: c.accent,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _SaleBanner extends StatelessWidget {
  const _SaleBanner({
    required this.image,
    required this.specialTitle,
    required this.title,
    required this.linkLabel,
    required this.onTap,
  });

  final String? image;
  final String? specialTitle;
  final String? title;
  final String? linkLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: AppRadius.lgAll,
        child: SizedBox(
          height: 180,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              StoreImage(url: image, fit: BoxFit.cover),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Color(0x99000000), Color(0x22000000)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (specialTitle != null && specialTitle!.isNotEmpty)
                      Text(
                        specialTitle!.toUpperCase(),
                        style: text.labelSmall?.copyWith(
                          color: Colors.white70,
                          letterSpacing: 1.2,
                        ),
                      ),
                    if (title != null && title!.isNotEmpty) ...[
                      const Gap(AppSpacing.xs),
                      Text(
                        title!.replaceAll(r"\n", "\n"),
                        style: text.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    if (linkLabel != null && linkLabel!.isNotEmpty) ...[
                      const Gap(AppSpacing.sm),
                      Text(
                        linkLabel!,
                        style: text.labelLarge?.copyWith(
                          color: Colors.white,
                          decoration: TextDecoration.underline,
                          decorationColor: Colors.white,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryTiles extends StatelessWidget {
  const _CategoryTiles({required this.categories, required this.data});

  final List<Map<String, dynamic>> categories;
  final BlockData data;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = AppSpacing.md;
        final full = constraints.maxWidth;
        final half = (full - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final cat in categories)
              SizedBox(
                width: (cat["wide"] == true) ? full : half,
                child: _CategoryTile(
                  image: data.resolve(cat["image"] as String?),
                  title: (cat["title"] as String?)?.trim(),
                  countLabel: (cat["count_label"] as String?)?.trim(),
                  onTap: () => handleBlockHref(context, cat["href"] as String?),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.image,
    required this.title,
    required this.countLabel,
    required this.onTap,
  });

  final String? image;
  final String? title;
  final String? countLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: AppRadius.mdAll,
        child: AspectRatio(
          aspectRatio: 1.4,
          child: Stack(
            fit: StackFit.expand,
            children: [
              StoreImage(url: image, fit: BoxFit.cover),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Color(0xAA000000), Color(0x11000000)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null && title!.isNotEmpty)
                      Text(
                        title!,
                        style: text.titleSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    if (countLabel != null && countLabel!.isNotEmpty)
                      Text(
                        countLabel!,
                        style: text.labelSmall?.copyWith(color: Colors.white70),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InstagramTile extends StatelessWidget {
  const _InstagramTile({
    required this.image,
    required this.subTitle,
    required this.handle,
    required this.onTap,
  });

  final String? image;
  final String? subTitle;
  final String? handle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: AppRadius.lgAll,
        child: SizedBox(
          height: 160,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              StoreImage(url: image, fit: BoxFit.cover),
              const DecoratedBox(
                decoration: BoxDecoration(color: Color(0x55000000)),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (subTitle != null && subTitle!.isNotEmpty)
                      Text(
                        subTitle!.toUpperCase(),
                        style: text.labelSmall?.copyWith(
                          color: Colors.white70,
                          letterSpacing: 1.4,
                        ),
                      ),
                    if (handle != null && handle!.isNotEmpty) ...[
                      const Gap(AppSpacing.xs),
                      Text(
                        handle!,
                        style: text.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
