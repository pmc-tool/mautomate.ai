import "package:flutter/material.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/theme/theme.dart";

/// A product image tile that degrades gracefully.
///
/// Renders the product [url] when it loads; while loading it shows a calm
/// surface, and on any failure (offline, dead URL) it falls back to a tinted
/// package glyph — never a broken-image icon. Used by both the list rows and
/// the detail header.
class ProductThumbnail extends StatelessWidget {
  const ProductThumbnail({
    super.key,
    required this.url,
    this.size = 44,
    this.radius = AppRadius.sm,
  });

  final String? url;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final borderRadius = BorderRadius.circular(radius);

    Widget placeholder() => Icon(
          PhosphorIcons.package(),
          size: size * 0.42,
          color: c.textMuted,
        );

    final hasUrl = url != null && url!.trim().isNotEmpty;

    return ClipRRect(
      borderRadius: borderRadius,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: c.surfaceMuted,
          borderRadius: borderRadius,
          border: Border.all(color: c.border),
        ),
        alignment: Alignment.center,
        child: hasUrl
            ? Image.network(
                url!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                errorBuilder: (_, __, ___) => placeholder(),
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return Center(
                    child: SizedBox(
                      width: size * 0.3,
                      height: size * 0.3,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: c.textMuted,
                      ),
                    ),
                  );
                },
              )
            : placeholder(),
      ),
    );
  }
}
