import "package:flutter/material.dart";
import "package:intl/intl.dart";

import "../api/store_product.dart";
import "../theme/app_colors.dart";
import "../theme/spacing.dart";
import "skeleton_loader.dart";
import "store_image.dart";

/// The reusable storefront product tile.
///
/// The single product-card widget shared by the data-bound blocks
/// (`product_tabs`, `deal_of_day`) AND — by contract — the Wave 2b catalog /
/// search / cart-related screens. Shows the thumbnail, title (2 lines), price,
/// and a struck-through compare-at price when the product is on sale.
///
/// ### Layout contract (Wave 2b reads this)
/// The card FILLS its parent's width and lays out top-to-bottom:
/// a square [StoreImage] (the image flexes to fill remaining height when the
/// parent bounds it), then the title, then the price row. It is designed to
/// drop into a `GridView` cell (bounded height) as-is, or into a horizontal
/// list wrapped in a `SizedBox(width: …)`. It never overflows and never throws
/// (missing image → placeholder tile; missing price → "Price on request").
///
/// Tapping calls [onTap] — renderers pass `() => handleProductTap(context, p)`
/// (the navigation seam), so the routing agent wires product detail in one place.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.imageAspectRatio = 1.0,
  });

  final StoreProduct product;
  final VoidCallback? onTap;

  /// Width / height ratio of the image tile (1.0 = square, <1 = portrait).
  final double imageAspectRatio;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: imageAspectRatio,
            child: StoreImage(
              url: product.thumbnail,
              width: double.infinity,
              fit: BoxFit.cover,
              borderRadius: AppRadius.mdAll,
            ),
          ),
          const Gap(AppSpacing.sm),
          Text(
            product.title,
            style: text.titleSmall?.copyWith(color: c.textPrimary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const Gap(AppSpacing.xxs),
          _PriceRow(product: product),
        ],
      ),
    );
  }
}

/// The price line: the current price, plus a struck-through compare-at price
/// when the product is on sale. Falls back to "Price on request" when the store
/// returned no pricing context (no `region_id`).
class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.product});

  final StoreProduct product;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    if (product.priceAmount == null) {
      return Text(
        "Price on request",
        style: text.bodySmall?.copyWith(color: c.textMuted),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(
          child: Text(
            formatMoney(product.priceAmount!, product.currencyCode),
            style: text.titleSmall?.copyWith(
              color: product.isOnSale ? c.accent : c.textPrimary,
              fontWeight: FontWeight.w700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (product.isOnSale) ...[
          const Gap(AppSpacing.xs),
          Flexible(
            child: Text(
              formatMoney(product.originalAmount!, product.currencyCode),
              style: text.bodySmall?.copyWith(
                color: c.textMuted,
                decoration: TextDecoration.lineThrough,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ],
    );
  }
}

/// The [ProductCard] loading placeholder — same footprint, under one shimmer.
/// Used by the data-bound blocks while products fetch.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key, this.imageAspectRatio = 1.0});

  final double imageAspectRatio;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: imageAspectRatio,
            child: const SkeletonBox(
              width: double.infinity,
              height: double.infinity,
              borderRadius: AppRadius.mdAll,
            ),
          ),
          const Gap(AppSpacing.sm),
          const SkeletonBox(width: 130, height: 12),
          const Gap(AppSpacing.xs),
          const SkeletonBox(width: 64, height: 12),
        ],
      ),
    );
  }
}

/// Format a major-unit [amount] in [currencyCode] (default USD) as a localized
/// currency string. Never throws on an unknown currency code — it falls back to
/// an uppercase-code prefix.
String formatMoney(num amount, String? currencyCode) {
  final code = (currencyCode ?? "usd").toUpperCase();
  try {
    return NumberFormat.simpleCurrency(name: code).format(amount);
  } catch (_) {
    return "$code ${amount.toStringAsFixed(2)}";
  }
}
