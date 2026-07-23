import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/product_detail_controller.dart";
import "../data/product_models.dart";
import "product_thumbnail.dart";
import "restock_sheet.dart";

/// Product detail + quick edits: publish/unpublish, edit a variant's price, and
/// edit a variant's stock. Opened from a product list row.
class ProductDetailScreen extends ConsumerWidget {
  const ProductDetailScreen({
    super.key,
    required this.productId,
    this.initialTitle,
  });

  final String productId;

  /// Shown in the app bar until the product loads, so the transition reads
  /// instantly.
  final String? initialTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(productDetailControllerProvider(productId));
    final controller =
        ref.read(productDetailControllerProvider(productId).notifier);
    final product = state.product;

    return AppScaffold(
      title: product?.title ?? initialTitle ?? "Product",
      body: _body(context, ref, state, controller),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    ProductDetailState state,
    ProductDetailController controller,
  ) {
    if (state.loading && state.product == null) {
      return const _DetailSkeleton();
    }

    if (state.error != null && state.product == null) {
      return ErrorStateView(
        message: state.error!.message,
        onRetry: controller.refresh,
      );
    }

    final product = state.product;
    if (product == null) {
      return const EmptyState(
        title: "Product unavailable",
        message: "We couldn't find this product. It may have been removed.",
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refresh,
      color: context.colors.accent,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: AppSpacing.screen,
        children: [
          _HeaderCard(product: product),
          const Gap(AppSpacing.lg),
          _VisibilityCard(state: state, controller: controller),
          const Gap(AppSpacing.lg),
          _VariantsSection(
            product: product,
            controller: controller,
          ),
          const Gap(AppSpacing.xxl),
        ],
      ),
    );
  }
}

/// Product identity: thumbnail, title, handle and status chip.
class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.product});

  final ProductDetail product;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProductThumbnail(url: product.thumbnail, size: 72, radius: AppRadius.md),
          const Gap(AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.title, style: text.titleMedium),
                if (product.handle.isNotEmpty) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    "/${product.handle}",
                    style: text.bodySmall?.copyWith(color: c.textMuted),
                  ),
                ],
                const Gap(AppSpacing.sm),
                Align(
                  alignment: Alignment.centerLeft,
                  child: StatusChip(status: product.status),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The publish/unpublish toggle.
class _VisibilityCard extends StatelessWidget {
  const _VisibilityCard({required this.state, required this.controller});

  final ProductDetailState state;
  final ProductDetailController controller;

  Future<void> _toggle(BuildContext context) async {
    // The publish state we're moving TO (state is the pre-toggle value).
    final willPublish = !state.isPublished;
    try {
      await controller.togglePublish();
      if (context.mounted) {
        _showSnack(
          context,
          willPublish ? "Product published" : "Product moved to draft",
        );
      }
    } on ApiError catch (e) {
      if (context.mounted) _showSnack(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final published = state.isPublished;

    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Published in store", style: text.titleSmall),
                const Gap(AppSpacing.xxs),
                Text(
                  published
                      ? "Customers can find and buy this product."
                      : "Hidden from your storefront until published.",
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ],
            ),
          ),
          const Gap(AppSpacing.md),
          if (state.togglingStatus)
            const SizedBox(
              height: 24,
              width: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Switch.adaptive(
              value: published,
              activeTrackColor: c.accent,
              onChanged: (_) => _toggle(context),
            ),
        ],
      ),
    );
  }
}

/// The variants list, each with price + stock quick-edits.
class _VariantsSection extends StatelessWidget {
  const _VariantsSection({required this.product, required this.controller});

  final ProductDetail product;
  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    if (product.variants.isEmpty) {
      return const AppCard(
        child: EmptyState(
          compact: true,
          title: "No variants",
          message: "This product has no variants to price or stock yet.",
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: product.variants.length == 1
              ? "Pricing & stock"
              : "Variants",
          subtitle: product.variants.length == 1
              ? "Quick-edit this product's price and stock."
              : "${product.variants.length} variants",
          padding: const EdgeInsets.only(
            left: AppSpacing.xs,
            bottom: AppSpacing.md,
          ),
        ),
        for (final variant in product.variants) ...[
          _VariantCard(
            product: product,
            variant: variant,
            controller: controller,
          ),
          const Gap(AppSpacing.md),
        ],
      ],
    );
  }
}

class _VariantCard extends StatelessWidget {
  const _VariantCard({
    required this.product,
    required this.variant,
    required this.controller,
  });

  final ProductDetail product;
  final ProductVariant variant;
  final ProductDetailController controller;

  ProductPrice? get _price =>
      variant.prices.isNotEmpty ? variant.prices.first : null;

  String get _currency => _price?.currencyCode ?? "usd";

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final showTitle = product.variants.length > 1;

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showTitle)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    variant.title.isEmpty ? "Variant" : variant.title,
                    style: text.titleSmall,
                  ),
                  if (variant.sku != null && variant.sku!.isNotEmpty) ...[
                    const Gap(AppSpacing.xxs),
                    Text(
                      "SKU ${variant.sku}",
                      style: text.bodySmall?.copyWith(color: c.textMuted),
                    ),
                  ],
                ],
              ),
            ),
          _EditRow(
            icon: PhosphorIcons.tag(),
            label: "Price",
            value: _price != null
                ? MoneyText(
                    amount: _price!.amount,
                    currencyCode: _currency,
                    strong: true,
                  )
                : Text(
                    "Not set",
                    style: text.bodyMedium?.copyWith(color: c.textMuted),
                  ),
            onEdit: () => _editPrice(context),
          ),
          Divider(height: 1, thickness: 1, color: c.border),
          _EditRow(
            icon: PhosphorIcons.stack(),
            label: "Inventory",
            value: Text(
              variant.inventoryQuantity != null
                  ? "${variant.inventoryQuantity!.toInt()} in stock"
                  : "Not tracked",
              style: text.bodyMedium?.copyWith(
                color: c.textPrimary,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            onEdit: () => _openRestock(context),
          ),
        ],
      ),
    );
  }

  Future<void> _editPrice(BuildContext context) async {
    await _showQuickEditSheet(
      context: context,
      title: "Edit price",
      subtitle: product.variants.length > 1 ? variant.title : product.title,
      label: "Price (${_currency.toUpperCase()})",
      initialValue: _price != null ? _trimNum(_price!.amount) : "",
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r"[0-9.]")),
      ],
      validator: (v) {
        final raw = (v ?? "").trim();
        if (raw.isEmpty) return "Enter a price";
        final parsed = double.tryParse(raw);
        if (parsed == null) return "Enter a valid number";
        if (parsed < 0) return "Price can't be negative";
        return null;
      },
      onSave: (v) => controller.savePrice(
        variant.id,
        double.parse(v.trim()),
        _currency,
      ),
      successMessage: "Price updated",
    );
  }

  Future<void> _openRestock(BuildContext context) {
    // The location-aware restock flow (set / +-adjust) writes real inventory
    // levels via the dedicated stock endpoint, then refreshes this product.
    return showRestockSheet(
      context: context,
      productId: product.id,
      variantId: variant.id,
      variantLabel: product.variants.length > 1 ? variant.title : product.title,
    );
  }

  static String _trimNum(num n) {
    if (n == n.roundToDouble()) return n.toInt().toString();
    return n.toString();
  }
}

/// A label + current value + edit affordance row inside a variant card.
class _EditRow extends StatelessWidget {
  const _EditRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onEdit,
  });

  final IconData icon;
  final String label;
  final Widget value;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onEdit();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: c.textSecondary),
              const Gap(AppSpacing.md),
              Text(
                label,
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
              const Spacer(),
              value,
              const Gap(AppSpacing.sm),
              Icon(PhosphorIcons.pencilSimple(), size: 16, color: c.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView(
        padding: AppSpacing.screen,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          Row(
            children: [
              const SkeletonBox(width: 72, height: 72, borderRadius: AppRadius.mdAll),
              const Gap(AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonBox(width: 180, height: 16),
                    Gap(AppSpacing.sm),
                    SkeletonBox(width: 120, height: 12),
                    Gap(AppSpacing.sm),
                    SkeletonBox(width: 72, height: 20),
                  ],
                ),
              ),
            ],
          ),
          const Gap(AppSpacing.xl),
          const SkeletonBox(width: double.infinity, height: 64, borderRadius: AppRadius.lgAll),
          const Gap(AppSpacing.lg),
          const SkeletonBox(width: double.infinity, height: 120, borderRadius: AppRadius.lgAll),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick-edit bottom sheet
// ---------------------------------------------------------------------------

/// Presents a validated single-field edit sheet. [onSave] performs the write
/// (and may throw [ApiError]); on success the sheet closes and a confirmation
/// snackbar shows. Returns when the sheet is dismissed.
Future<void> _showQuickEditSheet({
  required BuildContext context,
  required String title,
  String? subtitle,
  required String label,
  required String initialValue,
  required TextInputType keyboardType,
  required List<TextInputFormatter> inputFormatters,
  required FormFieldValidator<String> validator,
  required Future<void> Function(String value) onSave,
  required String successMessage,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _QuickEditSheet(
      title: title,
      subtitle: subtitle,
      label: label,
      initialValue: initialValue,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      validator: validator,
      onSave: onSave,
      successMessage: successMessage,
    ),
  );
}

class _QuickEditSheet extends StatefulWidget {
  const _QuickEditSheet({
    required this.title,
    required this.subtitle,
    required this.label,
    required this.initialValue,
    required this.keyboardType,
    required this.inputFormatters,
    required this.validator,
    required this.onSave,
    required this.successMessage,
  });

  final String title;
  final String? subtitle;
  final String label;
  final String initialValue;
  final TextInputType keyboardType;
  final List<TextInputFormatter> inputFormatters;
  final FormFieldValidator<String> validator;
  final Future<void> Function(String value) onSave;
  final String successMessage;

  @override
  State<_QuickEditSheet> createState() => _QuickEditSheetState();
}

class _QuickEditSheetState extends State<_QuickEditSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialValue);
  bool _saving = false;
  String? _submitError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _submitError = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    // Capture the messenger + colours before the sheet pops, so the
    // confirmation survives its own context being deactivated.
    final messenger = ScaffoldMessenger.of(context);
    final colors = context.colors;
    try {
      await widget.onSave(_controller.text);
      if (!mounted) return;
      Navigator.of(context).pop();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(_appSnack(colors, widget.successMessage));
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _submitError = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _submitError = "Something went wrong. Please try again.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: c.borderStrong,
                        borderRadius: AppRadius.smAll,
                      ),
                    ),
                  ),
                  const Gap(AppSpacing.lg),
                  Text(widget.title, style: text.titleMedium),
                  if (widget.subtitle != null) ...[
                    const Gap(AppSpacing.xxs),
                    Text(
                      widget.subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall?.copyWith(color: c.textSecondary),
                    ),
                  ],
                  const Gap(AppSpacing.lg),
                  AppTextField(
                    controller: _controller,
                    label: widget.label,
                    autofocus: true,
                    enabled: !_saving,
                    keyboardType: widget.keyboardType,
                    inputFormatters: widget.inputFormatters,
                    textInputAction: TextInputAction.done,
                    validator: widget.validator,
                    onSubmitted: (_) => _save(),
                    errorText: _submitError,
                  ),
                  const Gap(AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: SecondaryButton(
                          label: "Cancel",
                          onPressed:
                              _saving ? null : () => Navigator.of(context).pop(),
                        ),
                      ),
                      const Gap(AppSpacing.md),
                      Expanded(
                        child: PrimaryButton(
                          label: "Save",
                          isLoading: _saving,
                          onPressed: _save,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

void _showSnack(BuildContext context, String message, {bool isError = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(_appSnack(context.colors, message, isError: isError));
}

/// Builds the standard confirmation/error snackbar. Takes resolved [colors] so
/// it can be shown after its originating context has been popped.
SnackBar _appSnack(AppColors colors, String message, {bool isError = false}) {
  return SnackBar(
    content: Row(
      children: [
        Icon(
          isError ? PhosphorIcons.warning() : PhosphorIcons.checkCircle(),
          size: 18,
          color: Colors.white,
        ),
        const Gap(AppSpacing.sm),
        Expanded(child: Text(message)),
      ],
    ),
    backgroundColor: isError ? AppColors.dangerSolid : AppColors.successSolid,
    behavior: SnackBarBehavior.floating,
  );
}
