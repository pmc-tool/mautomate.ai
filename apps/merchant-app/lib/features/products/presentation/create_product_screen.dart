import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/create_product_controller.dart";
import "../application/products_list_controller.dart";
import "../data/products_repository.dart";
import "product_detail_screen.dart";
import "product_thumbnail.dart";

/// Create a product from a clean, mobile-appropriate multi-section form:
/// basics, pricing, inventory and an optional image. On success the products
/// list refreshes and this screen is replaced by the new product's detail.
///
/// The backend synthesises a single default variant from the top-level price /
/// stock / SKU, so this form covers the everyday "add a product" case without
/// the desktop options/variants matrix.
class CreateProductScreen extends ConsumerStatefulWidget {
  const CreateProductScreen({super.key});

  @override
  ConsumerState<CreateProductScreen> createState() =>
      _CreateProductScreenState();
}

class _CreateProductScreenState extends ConsumerState<CreateProductScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _price = TextEditingController();
  final _sku = TextEditingController();
  final _stock = TextEditingController(text: "0");
  final _imageUrl = TextEditingController();

  String _status = ProductStatus.draft;
  String? _currency;
  bool _saving = false;
  String? _submitError;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _price.dispose();
    _sku.dispose();
    _stock.dispose();
    _imageUrl.dispose();
    super.dispose();
  }

  ProductsRepository get _repo => ref.read(productsRepositoryProvider);

  /// The currencies the store can price in. Defaults to a single "usd" while
  /// loading or if the fetch fails, so the form is always usable.
  ({List<String> codes, String fallbackDefault}) _currencies() {
    final async = ref.watch(storeCurrenciesProvider);
    final data = async.valueOrNull;
    if (data == null || data.currencies.isEmpty) {
      return (codes: const ["usd"], fallbackDefault: "usd");
    }
    return (codes: data.currencies, fallbackDefault: data.defaultCurrency);
  }

  Future<void> _submit() async {
    if (_saving) return;
    setState(() => _submitError = null);
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final currencies = _currencies();
    final currency = _currency ?? currencies.fallbackDefault;

    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final colors = context.colors;
    try {
      final id = await _repo.create(
        title: _title.text,
        description: _description.text,
        status: _status,
        price: double.parse(_price.text.trim()),
        currencyCode: currency,
        inventoryQuantity: int.parse(_stock.text.trim()),
        sku: _sku.text,
        imageUrl: _imageUrl.text,
      );
      // Bring the new product into the list behind us.
      ref.read(productsListControllerProvider.notifier).refresh();
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(_appSnack(colors, "Product created"));
      // Land on the new product's detail; back returns to the (refreshed) list.
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ProductDetailScreen(
            productId: id,
            initialTitle: _title.text.trim(),
          ),
        ),
      );
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _submitError = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _submitError = "Something went wrong. Please try again.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencies = _currencies();
    final currency = _currency ?? currencies.fallbackDefault;

    return AppScaffold(
      title: "New product",
      body: Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screen,
          children: [
            if (_submitError != null) ...[
              _ErrorBanner(message: _submitError!),
              const Gap(AppSpacing.lg),
            ],
            _BasicsSection(
              title: _title,
              description: _description,
              status: _status,
              onStatusChanged: (s) => setState(() => _status = s),
              enabled: !_saving,
            ),
            const Gap(AppSpacing.lg),
            _PricingSection(
              price: _price,
              sku: _sku,
              currency: currency,
              currencies: currencies.codes,
              onCurrencyChanged: (c) => setState(() => _currency = c),
              enabled: !_saving,
            ),
            const Gap(AppSpacing.lg),
            _InventorySection(stock: _stock, enabled: !_saving),
            const Gap(AppSpacing.lg),
            _ImageSection(imageUrl: _imageUrl, enabled: !_saving),
            const Gap(AppSpacing.xl),
            PrimaryButton(
              label: "Create product",
              icon: PhosphorIcons.check(),
              isLoading: _saving,
              fullWidth: true,
              onPressed: _submit,
            ),
            const Gap(AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

class _BasicsSection extends StatelessWidget {
  const _BasicsSection({
    required this.title,
    required this.description,
    required this.status,
    required this.onStatusChanged,
    required this.enabled,
  });

  final TextEditingController title;
  final TextEditingController description;
  final String status;
  final ValueChanged<String> onStatusChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: "Basics",
            subtitle: "What you're selling.",
          ),
          const Gap(AppSpacing.lg),
          AppTextField(
            controller: title,
            label: "Title",
            hint: "e.g. Merino wool scarf",
            enabled: enabled,
            textInputAction: TextInputAction.next,
            textCapitalization: TextCapitalization.sentences,
            validator: (v) {
              final raw = (v ?? "").trim();
              if (raw.isEmpty) return "Give your product a title";
              if (raw.length < 2) return "Title is too short";
              return null;
            },
          ),
          const Gap(AppSpacing.lg),
          AppTextField(
            controller: description,
            label: "Description (optional)",
            hint: "Tell customers what makes it great.",
            enabled: enabled,
            maxLines: 4,
            minLines: 3,
            textCapitalization: TextCapitalization.sentences,
          ),
          const Gap(AppSpacing.lg),
          Text(
            "Status",
            style: Theme.of(context)
                .textTheme
                .labelMedium
                ?.copyWith(color: context.colors.textSecondary),
          ),
          const Gap(AppSpacing.sm),
          _StatusSelector(
            status: status,
            onChanged: enabled ? onStatusChanged : null,
          ),
        ],
      ),
    );
  }
}

class _PricingSection extends StatelessWidget {
  const _PricingSection({
    required this.price,
    required this.sku,
    required this.currency,
    required this.currencies,
    required this.onCurrencyChanged,
    required this.enabled,
  });

  final TextEditingController price;
  final TextEditingController sku;
  final String currency;
  final List<String> currencies;
  final ValueChanged<String> onCurrencyChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: "Pricing",
            subtitle: "The price customers pay.",
          ),
          const Gap(AppSpacing.lg),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AppTextField(
                  controller: price,
                  label: "Price (${currency.toUpperCase()})",
                  hint: "0.00",
                  enabled: enabled,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r"[0-9.]")),
                  ],
                  textInputAction: TextInputAction.next,
                  validator: (v) {
                    final raw = (v ?? "").trim();
                    if (raw.isEmpty) return "Enter a price";
                    final parsed = double.tryParse(raw);
                    if (parsed == null) return "Enter a valid number";
                    if (parsed < 0) return "Price can't be negative";
                    return null;
                  },
                ),
              ),
              if (currencies.length > 1) ...[
                const Gap(AppSpacing.md),
                _CurrencySelector(
                  value: currency,
                  currencies: currencies,
                  onChanged: enabled ? onCurrencyChanged : null,
                ),
              ],
            ],
          ),
          const Gap(AppSpacing.lg),
          AppTextField(
            controller: sku,
            label: "SKU (optional)",
            hint: "e.g. SCARF-WOOL-01",
            enabled: enabled,
            textCapitalization: TextCapitalization.characters,
          ),
        ],
      ),
    );
  }
}

class _InventorySection extends StatelessWidget {
  const _InventorySection({required this.stock, required this.enabled});

  final TextEditingController stock;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: "Inventory",
            subtitle: "How many you have on hand.",
          ),
          const Gap(AppSpacing.lg),
          AppTextField(
            controller: stock,
            label: "Initial stock",
            hint: "0",
            enabled: enabled,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.next,
            validator: (v) {
              final raw = (v ?? "").trim();
              if (raw.isEmpty) return "Enter a quantity (0 is fine)";
              final parsed = int.tryParse(raw);
              if (parsed == null) return "Enter a whole number";
              if (parsed < 0) return "Quantity can't be negative";
              return null;
            },
          ),
        ],
      ),
    );
  }
}

class _ImageSection extends StatelessWidget {
  const _ImageSection({required this.imageUrl, required this.enabled});

  final TextEditingController imageUrl;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: "Image",
            subtitle: "Optional — paste a link to a product photo.",
          ),
          const Gap(AppSpacing.lg),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: imageUrl,
                builder: (context, value, _) => ProductThumbnail(
                  url: value.text.trim(),
                  size: 56,
                  radius: AppRadius.md,
                ),
              ),
              const Gap(AppSpacing.md),
              Expanded(
                child: AppTextField(
                  controller: imageUrl,
                  label: "Image URL",
                  hint: "https://...",
                  enabled: enabled,
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.done,
                  validator: (v) {
                    final raw = (v ?? "").trim();
                    if (raw.isEmpty) return null; // optional
                    final uri = Uri.tryParse(raw);
                    if (uri == null ||
                        !uri.hasScheme ||
                        !(uri.isScheme("http") || uri.isScheme("https"))) {
                      return "Enter a valid http(s) link, or leave blank";
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const Gap(AppSpacing.sm),
          Text(
            "You can add more photos from the product page after creating it.",
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: c.textMuted),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Small controls
// ---------------------------------------------------------------------------

/// A two-option segmented control for the draft/published status.
class _StatusSelector extends StatelessWidget {
  const _StatusSelector({required this.status, required this.onChanged});

  final String status;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatusOption(
            label: "Draft",
            icon: PhosphorIcons.pencilSimple(),
            selected: status == ProductStatus.draft,
            onTap: onChanged == null
                ? null
                : () => onChanged!(ProductStatus.draft),
          ),
        ),
        const Gap(AppSpacing.sm),
        Expanded(
          child: _StatusOption(
            label: "Published",
            icon: PhosphorIcons.globe(),
            selected: status == ProductStatus.published,
            onTap: onChanged == null
                ? null
                : () => onChanged!(ProductStatus.published),
          ),
        ),
      ],
    );
  }
}

class _StatusOption extends StatelessWidget {
  const _StatusOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: onTap == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                onTap!();
              },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? c.primary : c.surface,
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: selected ? c.primary : c.borderStrong,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 16,
                color: selected ? c.onPrimary : c.textSecondary,
              ),
              const Gap(AppSpacing.sm),
              Text(
                label,
                style: text.labelLarge?.copyWith(
                  color: selected ? c.onPrimary : c.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A compact currency picker shown beside the price when the store prices in
/// more than one currency.
class _CurrencySelector extends StatelessWidget {
  const _CurrencySelector({
    required this.value,
    required this.currencies,
    required this.onChanged,
  });

  final String value;
  final List<String> currencies;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      // Align with the field body, below its label row.
      padding: const EdgeInsets.only(top: 26),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: c.borderStrong),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value,
            isDense: true,
            borderRadius: AppRadius.mdAll,
            icon: Icon(PhosphorIcons.caretDown(), size: 14, color: c.textMuted),
            style: text.labelLarge?.copyWith(color: c.textPrimary),
            dropdownColor: c.surface,
            onChanged: onChanged == null
                ? null
                : (v) {
                    if (v != null) onChanged!(v);
                  },
            items: [
              for (final code in currencies)
                DropdownMenuItem<String>(
                  value: code,
                  child: Text(code.toUpperCase()),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.dangerBg,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.dangerBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.warningCircle(), size: 18, color: c.danger),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.danger),
            ),
          ),
        ],
      ),
    );
  }
}

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
