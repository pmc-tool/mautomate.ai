import "package:cached_network_image/cached_network_image.dart";
import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../theme/app_colors.dart";
import "../theme/spacing.dart";

/// A network image with design-system loading + error states, used by the block
/// renderers so no block ever shows a raw broken-image glyph or a jarring blank.
///
/// While loading it shows a subtle skeleton fill; on error it shows a muted
/// image-placeholder tile. All colours come from `context.colors` so it is
/// correct in light and dark.
class StoreImage extends StatelessWidget {
  const StoreImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
  });

  /// Absolute image URL (block renderers resolve relative URLs via AppConfig
  /// before constructing this). Null/empty renders the placeholder.
  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final radius = borderRadius ?? BorderRadius.zero;
    Widget placeholder(IconData icon) => Container(
          width: width,
          height: height,
          color: c.surfaceMuted,
          alignment: Alignment.center,
          child: Icon(icon, color: c.textMuted, size: 28),
        );

    final Widget child = (url == null || url!.trim().isEmpty)
        ? placeholder(PhosphorIcons.image())
        : CachedNetworkImage(
            imageUrl: url!,
            fit: fit,
            width: width,
            height: height,
            placeholder: (_, __) => Container(
              width: width,
              height: height,
              color: c.skeletonBase,
            ),
            errorWidget: (_, __, ___) =>
                placeholder(PhosphorIcons.imageBroken()),
          );

    if (radius == BorderRadius.zero) return child;
    return ClipRRect(borderRadius: radius, child: child);
  }
}

/// A rounded logo tile with an initial fallback (store header use).
class StoreLogo extends StatelessWidget {
  const StoreLogo({
    super.key,
    required this.url,
    this.label,
    this.size = 40,
  });

  final String? url;
  final String? label;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final br = AppRadius.mdAll;
    final initial = (label ?? "").trim();
    Widget fallback() => Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.accentTint,
            borderRadius: br,
            border: Border.all(color: c.border),
          ),
          child: initial.isNotEmpty
              ? Text(
                  initial.characters.first.toUpperCase(),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: c.accent,
                        fontWeight: FontWeight.w700,
                      ),
                )
              : Icon(PhosphorIcons.storefront(), color: c.accent, size: size * 0.5),
        );

    if (url == null || url!.trim().isEmpty) return fallback();
    return ClipRRect(
      borderRadius: br,
      child: CachedNetworkImage(
        imageUrl: url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, __) =>
            Container(width: size, height: size, color: c.skeletonBase),
        errorWidget: (_, __, ___) => fallback(),
      ),
    );
  }
}
