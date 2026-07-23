import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:collection/collection.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/product_detail_controller.dart";
import "../data/product_models.dart";
import "../data/products_repository.dart";

/// How the restock quantity is interpreted.
enum _RestockMode {
  /// Set the on-hand quantity to an exact number.
  set,

  /// Add to (or subtract from) the current on-hand quantity.
  adjust,
}

/// Opens the restock bottom sheet for a variant. Loads the variant's real
/// stock level (location-aware, via `GET /merchant/products/{id}/stock`), lets
/// the merchant set an exact quantity or apply a +/- adjustment, writes it back
/// with `POST .../stock`, then refreshes the product detail (which syncs the
/// list row). Returns when the sheet is dismissed.
Future<void> showRestockSheet({
  required BuildContext context,
  required String productId,
  required String variantId,
  required String variantLabel,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _RestockSheet(
      productId: productId,
      variantId: variantId,
      variantLabel: variantLabel,
    ),
  );
}

class _RestockSheet extends ConsumerStatefulWidget {
  const _RestockSheet({
    required this.productId,
    required this.variantId,
    required this.variantLabel,
  });

  final String productId;
  final String variantId;
  final String variantLabel;

  @override
  ConsumerState<_RestockSheet> createState() => _RestockSheetState();
}

class _RestockSheetState extends ConsumerState<_RestockSheet> {
  final _formKey = GlobalKey<FormState>();
  final _controller = TextEditingController();

  bool _loading = true;
  ApiError? _loadError;
  bool _saving = false;
  String? _submitError;

  _RestockMode _mode = _RestockMode.set;

  // The resolved stock target for this variant.
  StockVariant? _variant;
  StockLocation? _location; // primary location we write to

  ProductsRepository get _repo => ref.read(productsRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final matrix = await _repo.stock(widget.productId);
      final variant = matrix.variants
          .where((v) => v.variantId == widget.variantId)
          .firstOrNull;
      final location =
          variant != null && variant.locations.isNotEmpty
              ? variant.locations.first
              : null;
      if (!mounted) return;
      setState(() {
        _variant = variant;
        _location = location;
        _loading = false;
        // Seed the field with the current quantity for the "set" mode.
        if (location != null) {
          _controller.text = "${location.stockedQuantity.toInt()}";
        }
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e;
      });
    }
  }

  int get _currentQty => (_location?.stockedQuantity ?? 0).toInt();

  /// The resulting on-hand quantity for the entered value, or null if invalid.
  int? get _targetQty {
    final raw = _controller.text.trim();
    if (raw.isEmpty) return null;
    final n = int.tryParse(raw);
    if (n == null) return null;
    return _mode == _RestockMode.set ? n : _currentQty + n;
  }

  void _setMode(_RestockMode mode) {
    if (mode == _mode) return;
    setState(() {
      _mode = mode;
      _submitError = null;
      // Sensible seed per mode: current qty for "set", empty delta for "adjust".
      _controller.text = mode == _RestockMode.set ? "$_currentQty" : "";
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _submitError = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final variant = _variant;
    final location = _location;
    if (variant?.inventoryItemId == null || location == null) return;

    final target = _targetQty;
    if (target == null) return;

    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final colors = context.colors;
    try {
      await _repo.setStock(widget.productId, [
        StockLevelUpdate(
          inventoryItemId: variant!.inventoryItemId!,
          locationId: location.locationId,
          stockedQuantity: target,
        ),
      ]);
      // Refresh detail (which syncs the list row) from the server's truth.
      await ref
          .read(productDetailControllerProvider(widget.productId).notifier)
          .refresh();
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      Navigator.of(context).pop();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(_appSnack(colors, "Stock updated"));
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
    final c = context.colors;
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
            child: _content(context),
          ),
        ),
      ),
    );
  }

  Widget _content(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    Widget grabber() => Center(
          child: Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: c.borderStrong,
              borderRadius: AppRadius.smAll,
            ),
          ),
        );

    if (_loading) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          grabber(),
          const Gap(AppSpacing.xl),
          const Center(
            child: SizedBox(
              height: 26,
              width: 26,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
          const Gap(AppSpacing.md),
          Text(
            "Loading stock…",
            textAlign: TextAlign.center,
            style: text.bodySmall?.copyWith(color: c.textSecondary),
          ),
          const Gap(AppSpacing.lg),
        ],
      );
    }

    if (_loadError != null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          grabber(),
          const Gap(AppSpacing.lg),
          Text("Restock", style: text.titleMedium),
          const Gap(AppSpacing.lg),
          Text(
            _loadError!.message,
            style: text.bodyMedium?.copyWith(color: c.textSecondary),
          ),
          const Gap(AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  label: "Close",
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              const Gap(AppSpacing.md),
              Expanded(
                child: PrimaryButton(
                  label: "Try again",
                  icon: PhosphorIcons.arrowClockwise(),
                  onPressed: _load,
                ),
              ),
            ],
          ),
        ],
      );
    }

    // Loaded but this variant does not track inventory -> nothing to restock.
    if (_variant?.inventoryItemId == null || _location == null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          grabber(),
          const Gap(AppSpacing.lg),
          Text("Restock", style: text.titleMedium),
          const Gap(AppSpacing.xxs),
          Text(
            widget.variantLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: c.textSecondary),
          ),
          const Gap(AppSpacing.lg),
          AppCard(
            color: c.surfaceMuted,
            child: Row(
              children: [
                Icon(PhosphorIcons.infinity(), size: 18, color: c.textSecondary),
                const Gap(AppSpacing.sm),
                Expanded(
                  child: Text(
                    "This variant doesn't track inventory, so there's no stock to restock.",
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ),
              ],
            ),
          ),
          const Gap(AppSpacing.lg),
          PrimaryButton(
            label: "Close",
            fullWidth: true,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      );
    }

    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          grabber(),
          const Gap(AppSpacing.lg),
          Text("Restock", style: text.titleMedium),
          const Gap(AppSpacing.xxs),
          Text(
            widget.variantLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: c.textSecondary),
          ),
          const Gap(AppSpacing.lg),
          _CurrentStockRow(location: _location!),
          const Gap(AppSpacing.lg),
          _ModeSelector(
            mode: _mode,
            onChanged: _saving ? null : _setMode,
          ),
          const Gap(AppSpacing.lg),
          AppTextField(
            controller: _controller,
            label: _mode == _RestockMode.set
                ? "New quantity"
                : "Adjust by (+/-)",
            autofocus: true,
            enabled: !_saving,
            keyboardType: TextInputType.numberWithOptions(
              signed: _mode == _RestockMode.adjust,
            ),
            inputFormatters: [
              _mode == _RestockMode.set
                  ? FilteringTextInputFormatter.digitsOnly
                  : FilteringTextInputFormatter.allow(RegExp(r"[0-9-]")),
            ],
            textInputAction: TextInputAction.done,
            errorText: _submitError,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _save(),
            validator: (v) {
              final raw = (v ?? "").trim();
              if (raw.isEmpty) {
                return _mode == _RestockMode.set
                    ? "Enter a quantity"
                    : "Enter an amount to add or remove";
              }
              final n = int.tryParse(raw);
              if (n == null) return "Enter a whole number";
              if (_mode == _RestockMode.set && n < 0) {
                return "Quantity can't be negative";
              }
              final target = _mode == _RestockMode.set ? n : _currentQty + n;
              if (target < 0) return "That would drop stock below zero";
              return null;
            },
          ),
          const Gap(AppSpacing.md),
          _ResultPreview(current: _currentQty, target: _targetQty),
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
    );
  }
}

/// Shows the current on-hand and reserved quantity at the target location.
class _CurrentStockRow extends StatelessWidget {
  const _CurrentStockRow({required this.location});

  final StockLocation location;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final reserved = location.reservedQuantity.toInt();
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.surfaceMuted,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.stack(), size: 18, color: c.textSecondary),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  location.locationName.isEmpty
                      ? "In stock"
                      : location.locationName,
                  style: text.bodyMedium?.copyWith(color: c.textPrimary),
                ),
                if (reserved > 0) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    "$reserved reserved",
                    style: text.bodySmall?.copyWith(color: c.textMuted),
                  ),
                ],
              ],
            ),
          ),
          Text(
            "${location.stockedQuantity.toInt()}",
            style: text.titleMedium?.copyWith(
              color: c.textPrimary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// Set vs adjust toggle.
class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.mode, required this.onChanged});

  final _RestockMode mode;
  final ValueChanged<_RestockMode>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ModeOption(
            label: "Set to",
            icon: PhosphorIcons.equals(),
            selected: mode == _RestockMode.set,
            onTap: onChanged == null ? null : () => onChanged!(_RestockMode.set),
          ),
        ),
        const Gap(AppSpacing.sm),
        Expanded(
          child: _ModeOption(
            label: "Adjust",
            icon: PhosphorIcons.plusMinus(),
            selected: mode == _RestockMode.adjust,
            onTap: onChanged == null
                ? null
                : () => onChanged!(_RestockMode.adjust),
          ),
        ),
      ],
    );
  }
}

class _ModeOption extends StatelessWidget {
  const _ModeOption({
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
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? c.primary : c.surface,
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: selected ? c.primary : c.borderStrong),
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

/// Live "current -> resulting" preview.
class _ResultPreview extends StatelessWidget {
  const _ResultPreview({required this.current, required this.target});

  final int current;
  final int? target;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final resolved = target;
    final showResult = resolved != null && resolved != current;
    return Row(
      children: [
        Icon(PhosphorIcons.arrowRight(), size: 14, color: c.textMuted),
        const Gap(AppSpacing.sm),
        Text(
          showResult ? "New on-hand: $resolved" : "On-hand: $current",
          style: text.bodySmall?.copyWith(
            color: showResult ? c.textPrimary : c.textMuted,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
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
