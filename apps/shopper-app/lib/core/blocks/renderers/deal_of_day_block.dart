import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../api/catalog_binding.dart";
import "../../api/store_product.dart";
import "../../theme/app_colors.dart";
import "../../theme/spacing.dart";
import "../../widgets/app_buttons.dart";
import "../../widgets/product_card.dart";
import "../../widgets/store_image.dart";
import "../block_actions.dart";
import "../block_data.dart";

/// Renderer for `deal_of_day` — a single promo with a live countdown timer.
///
/// Shape (backend `modules/cms/registry/deal-of-day.ts`):
/// ```
/// { image, title, description?, countdown_to: ISO8601, cta:{label?, href} }
/// ```
/// Optionally the block may carry a product ref (`product_id` / `product_ids`);
/// when present it is resolved live and the product's price/image enrich the
/// promo. A dangling ref degrades silently to the static promo. The timer ticks
/// down to `countdown_to` client-side and cleans itself up on dispose.
Widget dealOfDayBlock(BuildContext context, BlockData data) =>
    _DealOfDayBlock(data: data);

class _DealOfDayBlock extends ConsumerStatefulWidget {
  const _DealOfDayBlock({required this.data});

  final BlockData data;

  @override
  ConsumerState<_DealOfDayBlock> createState() => _DealOfDayBlockState();
}

class _DealOfDayBlockState extends ConsumerState<_DealOfDayBlock> {
  Timer? _timer;
  Duration _remaining = Duration.zero;
  DateTime? _target;

  @override
  void initState() {
    super.initState();
    _target = DateTime.tryParse(widget.data.strOr("countdown_to", ""));
    _tick();
    if (_target != null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    }
  }

  void _tick() {
    if (_target == null) return;
    final now = DateTime.now();
    final left = _target!.difference(now);
    if (!mounted) return;
    setState(() {
      _remaining = left.isNegative ? Duration.zero : left;
    });
    if (left.isNegative) _timer?.cancel();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Optional product binding from a `product_id` / `product_ids` prop.
  CatalogBinding? get _productBinding {
    final raw = widget.data.raw;
    final single = raw["product_id"];
    final many = raw["product_ids"];
    final ids = <String>[
      if (single is String && single.isNotEmpty) single,
      if (many is List) ...many.whereType<String>(),
    ];
    if (ids.isEmpty) return null;
    return CatalogBinding(source: "manual", productIds: ids, limit: ids.length);
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final image = data.asset("image");
    final title = data.str("title");
    final description = data.str("description");
    final cta = data.object("cta");
    final ctaLabel = (cta["label"] as String?)?.trim();

    if (image == null && title == null) return const SizedBox.shrink();

    // Best-effort live product enrichment.
    StoreProduct? product;
    final binding = _productBinding;
    if (binding != null) {
      product = ref.watch(catalogProductsProvider(binding)).maybeWhen(
            data: (list) => list.isEmpty ? null : list.first,
            orElse: () => null,
          );
    }

    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: c.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (image != null)
            StoreImage(
              url: image,
              width: double.infinity,
              height: 200,
              fit: BoxFit.cover,
            ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null)
                  Text(
                    title.replaceAll(r"\n", "\n"),
                    style: text.titleLarge?.copyWith(color: c.textPrimary),
                  ),
                if (product != null) ...[
                  const Gap(AppSpacing.xs),
                  Text(
                    product.title,
                    style: text.bodyMedium?.copyWith(color: c.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (product.priceAmount != null) ...[
                    const Gap(AppSpacing.xxs),
                    Row(
                      children: [
                        Text(
                          formatMoney(product.priceAmount!, product.currencyCode),
                          style: text.titleMedium?.copyWith(
                            color: c.accent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (product.isOnSale) ...[
                          const Gap(AppSpacing.sm),
                          Text(
                            formatMoney(
                              product.originalAmount!,
                              product.currencyCode,
                            ),
                            style: text.bodySmall?.copyWith(
                              color: c.textMuted,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ] else if (description != null) ...[
                  const Gap(AppSpacing.sm),
                  Text(
                    description,
                    style: text.bodyMedium?.copyWith(color: c.textSecondary),
                  ),
                ],
                if (_target != null) ...[
                  const Gap(AppSpacing.lg),
                  _Countdown(remaining: _remaining),
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
}

/// A HH : MM : SS countdown display of [remaining] time.
class _Countdown extends StatelessWidget {
  const _Countdown({required this.remaining});

  final Duration remaining;

  @override
  Widget build(BuildContext context) {
    final days = remaining.inDays;
    final hours = remaining.inHours % 24;
    final minutes = remaining.inMinutes % 60;
    final seconds = remaining.inSeconds % 60;
    final expired = remaining == Duration.zero;

    final c = context.colors;
    final text = Theme.of(context).textTheme;

    if (expired) {
      return Text(
        "Offer ended",
        style: text.labelLarge?.copyWith(color: c.textMuted),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (days > 0) ...[
          _Unit(value: days, label: "d"),
          const Gap(AppSpacing.sm),
        ],
        _Unit(value: hours, label: "h"),
        const Gap(AppSpacing.sm),
        _Unit(value: minutes, label: "m"),
        const Gap(AppSpacing.sm),
        _Unit(value: seconds, label: "s"),
      ],
    );
  }
}

class _Unit extends StatelessWidget {
  const _Unit({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.accentTint,
        borderRadius: AppRadius.smAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            value.toString().padLeft(2, "0"),
            style: text.titleMedium?.copyWith(
              color: c.accent,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          Text(
            label,
            style: text.labelSmall?.copyWith(color: c.accent),
          ),
        ],
      ),
    );
  }
}
