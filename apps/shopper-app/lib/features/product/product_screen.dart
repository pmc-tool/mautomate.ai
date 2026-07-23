import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/blocks/block_actions.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../cart/cart_providers.dart";
import "../catalog/product_detail.dart";
import "../catalog/product_detail_repository.dart";
import "../catalog/quantity_stepper.dart";
import "../catalog/variant_selector.dart";

/// The product detail page (PDP).
///
/// Pushed OVER the shell via `context.pushProduct(handle)`. Fetches the full
/// product ([productDetailProvider]) — gallery, option matrix, variants, prices
/// in the store region — then lets the shopper pick options (via
/// [VariantSelector]), choose a quantity ([QuantityStepper]) and add the
/// resolved variant to the cart. The description renders as native HTML with the
/// same light renderer the `rich_text` block uses.
///
/// Add-to-cart calls the cart controller owned by the cart feature:
/// `ref.read(cartControllerProvider.notifier).addVariant(variantId, quantity: q)`.
class ProductScreen extends ConsumerStatefulWidget {
  const ProductScreen({super.key, required this.handle});

  /// The `:handle` path param — the product handle to load.
  final String handle;

  @override
  ConsumerState<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends ConsumerState<ProductScreen> {
  final Map<String, String> _selected = {};
  int _quantity = 1;
  bool _adding = false;

  ProductVariant? _resolveVariant(ProductDetail detail) {
    if (!detail.hasOptions) return detail.defaultVariant;
    return detail.variantForSelection(_selected);
  }

  Future<void> _addToCart(ProductVariant variant) async {
    setState(() => _adding = true);
    try {
      await ref
          .read(cartControllerProvider.notifier)
          .addVariant(variant.id, quantity: _quantity);
      if (!mounted) return;
      showAppSnackBar(context, "Added to cart", kind: AppSnackKind.success);
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(
        context,
        "Couldn't add to cart. Please try again.",
        kind: AppSnackKind.error,
      );
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final async = ref.watch(productDetailProvider(widget.handle));

    return Scaffold(
      backgroundColor: c.background,
      appBar: AppBar(title: const Text("Product")),
      body: async.when(
        loading: () => const _PdpSkeleton(),
        error: (err, _) => ErrorStateView(
          message:
              "We couldn't load this product. Check your connection and try again.",
          onRetry: () => ref.invalidate(productDetailProvider(widget.handle)),
        ),
        data: (detail) {
          if (detail == null) {
            return EmptyState(
              icon: PhosphorIcons.package(),
              title: "Product not found",
              message: "This product may have been removed or is unavailable.",
            );
          }
          return _content(context, detail);
        },
      ),
    );
  }

  Widget _content(BuildContext context, ProductDetail detail) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final variant = _resolveVariant(detail);
    final images =
        detail.images.isNotEmpty ? detail.images : [detail.thumbnail ?? ""];

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              _Gallery(imageUrls: images.where((u) => u.isNotEmpty).toList()),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(detail.title, style: text.headlineSmall),
                    if (detail.subtitle != null &&
                        detail.subtitle!.trim().isNotEmpty) ...[
                      const Gap(AppSpacing.xs),
                      Text(
                        detail.subtitle!,
                        style: text.bodyMedium?.copyWith(color: c.textSecondary),
                      ),
                    ],
                    const Gap(AppSpacing.md),
                    _PriceLine(detail: detail, variant: variant),
                    const Gap(AppSpacing.xl),
                    if (detail.hasOptions) ...[
                      VariantSelector(
                        detail: detail,
                        selected: _selected,
                        onSelect: (optionId, value) {
                          setState(() {
                            if (_selected[optionId] == value) {
                              _selected.remove(optionId);
                            } else {
                              _selected[optionId] = value;
                            }
                          });
                        },
                      ),
                    ],
                    if (variant != null && !variant.inStock) ...[
                      _StockNote(
                        color: c.danger,
                        icon: PhosphorIcons.warning(),
                        label: "Out of stock",
                      ),
                      const Gap(AppSpacing.lg),
                    ] else if (variant != null &&
                        variant.manageInventory &&
                        !variant.allowBackorder &&
                        (variant.inventoryQuantity ?? 0) <= 5 &&
                        (variant.inventoryQuantity ?? 0) > 0) ...[
                      _StockNote(
                        color: c.warning,
                        icon: PhosphorIcons.timer(),
                        label:
                            "Only ${variant.inventoryQuantity} left in stock",
                      ),
                      const Gap(AppSpacing.lg),
                    ],
                    if (detail.description != null &&
                        detail.description!.trim().isNotEmpty) ...[
                      const Gap(AppSpacing.sm),
                      Text("Details", style: text.titleMedium),
                      const Gap(AppSpacing.sm),
                      _Description(html: detail.description!),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        _AddToCartBar(
          variant: variant,
          quantity: _quantity,
          isAdding: _adding,
          hasOptions: detail.hasOptions,
          onQuantityChanged: (q) => setState(() => _quantity = q),
          onAdd: variant == null ? null : () => _addToCart(variant),
        ),
      ],
    );
  }
}

/// The swipeable image gallery with a dot indicator.
class _Gallery extends StatefulWidget {
  const _Gallery({required this.imageUrls});

  final List<String> imageUrls;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  final _pageController = PageController();
  int _page = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final urls = widget.imageUrls.isEmpty ? [""] : widget.imageUrls;

    return AspectRatio(
      aspectRatio: 1,
      child: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: urls.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (_, i) => StoreImage(
              url: urls[i].isEmpty ? null : urls[i],
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          if (urls.length > 1)
            Positioned(
              bottom: AppSpacing.md,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < urls.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _page ? 20 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _page
                            ? c.accent
                            : c.onAccent.withValues(alpha: 0.7),
                        borderRadius: const BorderRadius.all(Radius.circular(3)),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// The price line: the selected/base price, plus a compare-at strike on sale.
class _PriceLine extends StatelessWidget {
  const _PriceLine({required this.detail, required this.variant});

  final ProductDetail detail;
  final ProductVariant? variant;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    // Choose a variant to price: the selected one, else the cheapest.
    ProductVariant? priced = variant;
    priced ??= _cheapest(detail.variants);

    if (priced == null || priced.priceAmount == null) {
      return Text(
        "Price on request",
        style: text.titleMedium?.copyWith(color: c.textMuted),
      );
    }

    final prefix = variant == null && detail.hasOptions ? "From " : "";
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          "$prefix${formatMoney(priced.priceAmount!, priced.currencyCode)}",
          style: text.headlineSmall?.copyWith(
            color: priced.isOnSale ? c.accent : c.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (priced.isOnSale) ...[
          const Gap(AppSpacing.sm),
          Text(
            formatMoney(priced.originalAmount!, priced.currencyCode),
            style: text.titleMedium?.copyWith(
              color: c.textMuted,
              decoration: TextDecoration.lineThrough,
            ),
          ),
        ],
      ],
    );
  }

  static ProductVariant? _cheapest(List<ProductVariant> variants) {
    ProductVariant? best;
    for (final v in variants) {
      if (v.priceAmount == null) continue;
      if (best == null || v.priceAmount! < best.priceAmount!) best = v;
    }
    return best ?? (variants.isEmpty ? null : variants.first);
  }
}

class _StockNote extends StatelessWidget {
  const _StockNote({
    required this.color,
    required this.icon,
    required this.label,
  });

  final Color color;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const Gap(AppSpacing.xs),
        Text(
          label,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: color, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _Description extends StatelessWidget {
  const _Description({required this.html});

  final String html;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return HtmlWidget(
      html,
      textStyle: text.bodyMedium?.copyWith(color: c.textSecondary, height: 1.5),
      onTapUrl: (url) {
        handleBlockHref(context, url);
        return true;
      },
      customWidgetBuilder: (element) {
        const blocked = {"script", "style", "iframe", "object", "embed"};
        if (blocked.contains(element.localName)) return const SizedBox.shrink();
        return null;
      },
    );
  }
}

/// The pinned bottom add-to-cart bar: quantity stepper + primary action.
class _AddToCartBar extends StatelessWidget {
  const _AddToCartBar({
    required this.variant,
    required this.quantity,
    required this.isAdding,
    required this.hasOptions,
    required this.onQuantityChanged,
    required this.onAdd,
  });

  final ProductVariant? variant;
  final int quantity;
  final bool isAdding;
  final bool hasOptions;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final outOfStock = variant != null && !variant!.inStock;
    final label = variant == null
        ? (hasOptions ? "Select options" : "Unavailable")
        : (outOfStock ? "Out of stock" : "Add to cart");
    final enabled = variant != null && !outOfStock && !isAdding;

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              QuantityStepper(
                value: quantity,
                onChanged: onQuantityChanged,
              ),
              const Gap(AppSpacing.md),
              Expanded(
                child: PrimaryButton(
                  label: label,
                  icon: PhosphorIcons.shoppingCartSimple(),
                  isLoading: isAdding,
                  onPressed: enabled ? onAdd : null,
                  fullWidth: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PdpSkeleton extends StatelessWidget {
  const _PdpSkeleton();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Shimmer(
      child: ListView(
        padding: EdgeInsets.zero,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(color: c.skeletonBase),
          ),
          const Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 220, height: 22),
                Gap(AppSpacing.md),
                SkeletonBox(width: 120, height: 18),
                Gap(AppSpacing.xl),
                SkeletonBox(width: double.infinity, height: 12),
                Gap(AppSpacing.sm),
                SkeletonBox(width: double.infinity, height: 12),
                Gap(AppSpacing.sm),
                SkeletonBox(width: 200, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
