import "dart:typed_data";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:image_picker/image_picker.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/setup_controller.dart";
import "../data/setup_models.dart";
import "../data/setup_reference.dart";

/// Setup — the resumable shop setup wizard.
///
/// A short, guided flow that walks a merchant through everything a store needs
/// before it can sell: business basics, brand, a real product, delivery and
/// payments. Progress is REAL — the ticks come from GET /merchant/setup/status
/// (verified against the store's actual products / shipping / payment), never
/// from "clicked Next" — so the merchant is never told they are done when they
/// cannot yet take an order.
///
/// On mobile the desktop vertical stepper becomes a stack of expandable step
/// cards: one card per step, each showing its live status, and only one open at
/// a time (the resume step opens first). Every action re-reads the status so
/// progress updates in place.
class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  SetupStep? _expanded;
  bool _resumeApplied = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(setupControllerProvider);

    // Open the resume step once the snapshot first loads.
    if (!_resumeApplied && state.data != null) {
      _resumeApplied = true;
      _expanded = state.resumeStep;
    }

    return AppScaffold(
      title: "Set up your shop",
      onRefresh: ref.read(setupControllerProvider.notifier).refresh,
      body: _body(context, state),
    );
  }

  Widget _body(BuildContext context, SetupState state) {
    if (state.isLoading && state.data == null) {
      return const _SetupSkeleton();
    }
    if (state.data == null && state.error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: AppSpacing.screen,
        children: [
          const Gap(AppSpacing.xxxl),
          ErrorStateView(
            message: state.error!.message,
            onRetry: ref.read(setupControllerProvider.notifier).retry,
          ),
        ],
      );
    }

    final data = state.data!;
    final status = data.status;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xxl,
      ),
      children: [
        _ProgressHeader(status: status),
        const Gap(AppSpacing.lg),
        for (final step in SetupStep.values) ...[
          _StepCard(
            step: step,
            done: _stepDone(step, data),
            expanded: _expanded == step,
            onToggle: () => _toggle(step),
            child: _stepBody(step),
          ),
          const Gap(AppSpacing.md),
        ],
      ],
    );
  }

  void _toggle(SetupStep step) {
    setState(() => _expanded = _expanded == step ? null : step);
    if (_expanded == step) {
      ref.read(setupControllerProvider.notifier).setCurrentStep(step);
    }
  }

  /// Advance to the next step, opening it.
  void _next(SetupStep from) {
    final idx = SetupStep.values.indexOf(from);
    final next = idx + 1 < SetupStep.values.length
        ? SetupStep.values[idx + 1]
        : null;
    setState(() => _expanded = next);
    if (next != null) {
      ref.read(setupControllerProvider.notifier).setCurrentStep(next);
    }
  }

  Widget _stepBody(SetupStep step) {
    switch (step) {
      case SetupStep.basics:
        return _BasicsBody(onDone: () => _next(step));
      case SetupStep.brand:
        return _BrandBody(onDone: () => _next(step));
      case SetupStep.products:
        return _ProductsBody(onContinue: () => _next(step));
      case SetupStep.delivery:
        return _DeliveryBody(onDone: () => _next(step));
      case SetupStep.payments:
        return _PaymentsBody(onContinue: () => _next(step));
      case SetupStep.review:
        return _ReviewBody(onJump: (s) {
          setState(() => _expanded = s);
        });
    }
  }

  /// A step reads "done" from the verified status where one exists, falling back
  /// to the persisted draft for the soft steps.
  bool _stepDone(SetupStep step, SetupSnapshot data) {
    final status = data.status;
    final completed = data.setup.completed;
    switch (step) {
      case SetupStep.basics:
        return completed.contains(step.key);
      case SetupStep.brand:
        return (data.logoUrl != null && data.logoUrl!.isNotEmpty) ||
            completed.contains(step.key);
      case SetupStep.products:
        return status?.products ?? completed.contains(step.key);
      case SetupStep.delivery:
        return status?.shipping ?? completed.contains(step.key);
      case SetupStep.payments:
        return status?.payment ?? completed.contains(step.key);
      case SetupStep.review:
        return status?.readyToSell ?? false;
    }
  }
}

// ---------------------------------------------------------------------------
// Progress header
// ---------------------------------------------------------------------------

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({required this.status});

  final SetupStatus? status;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = status;
    final pct = s?.percent ?? 0;
    final ready = s?.readyToSell ?? false;
    final missing = s?.missingRequired ?? const <String>[];

    // Human labels for what's left, from the verified task list.
    final leftLabels = <String>[
      for (final key in missing)
        (s?.tasks.firstWhere(
                  (t) => t.key == key,
                  orElse: () => const SetupTask(),
                ))
                ?.label ??
            key,
    ].where((e) => e.isNotEmpty).toList();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ready ? "Ready to sell" : "$pct% complete",
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ready ? c.success : c.textPrimary,
                      ),
                ),
              ),
              StatusChip.custom(
                label: ready ? "Ready" : "In progress",
                tone: ready ? StatusTone.success : StatusTone.pending,
                icon: ready
                    ? PhosphorIcons.checkCircle()
                    : PhosphorIcons.circleDashed(),
              ),
            ],
          ),
          const Gap(AppSpacing.md),
          ClipRRect(
            borderRadius: AppRadius.smAll,
            child: LinearProgressIndicator(
              value: (pct.clamp(0, 100)) / 100,
              minHeight: 8,
              backgroundColor: c.surfaceMuted,
              valueColor: AlwaysStoppedAnimation<Color>(
                ready ? c.success : c.primary,
              ),
            ),
          ),
          const Gap(AppSpacing.md),
          Text(
            ready
                ? "Everything required is done — your store can take orders."
                : leftLabels.isEmpty
                    ? "A few short steps and you're ready to sell."
                    : "What's left: ${leftLabels.join(", ")}.",
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: c.textSecondary,
                ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Expandable step card shell
// ---------------------------------------------------------------------------

class _StepCard extends StatelessWidget {
  const _StepCard({
    required this.step,
    required this.done,
    required this.expanded,
    required this.onToggle,
    required this.child,
  });

  final SetupStep step;
  final bool done;
  final bool expanded;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      borderColor: expanded ? c.borderStrong : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: AppRadius.lgAll,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: [
                  _StepBadge(index: step.index + 1, done: done),
                  const Gap(AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.title,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: c.textPrimary,
                              ),
                        ),
                        if (step.optional)
                          Text(
                            "Optional",
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: c.textMuted),
                          ),
                      ],
                    ),
                  ),
                  const Gap(AppSpacing.sm),
                  StatusChip.custom(
                    label: done
                        ? "Done"
                        : step.optional
                            ? "Optional"
                            : "To do",
                    tone: done
                        ? StatusTone.success
                        : step.optional
                            ? StatusTone.neutral
                            : StatusTone.pending,
                  ),
                  const Gap(AppSpacing.sm),
                  Icon(
                    expanded
                        ? PhosphorIcons.caretUp()
                        : PhosphorIcons.caretDown(),
                    size: 18,
                    color: c.textMuted,
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Divider(height: 1, color: c.border),
                  const Gap(AppSpacing.lg),
                  child,
                ],
              ),
            ),
            crossFadeState: expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 180),
            sizeCurve: Curves.easeInOut,
          ),
        ],
      ),
    );
  }
}

class _StepBadge extends StatelessWidget {
  const _StepBadge({required this.index, required this.done});

  final int index;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done ? c.success : c.surfaceMuted,
        border: done ? null : Border.all(color: c.border),
      ),
      child: done
          ? Icon(PhosphorIcons.check(), size: 15, color: c.onPrimary)
          : Text(
              "$index",
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: c.textSecondary,
                  ),
            ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared inline bits
// ---------------------------------------------------------------------------

/// A small inline error line, mirroring the web `ErrorLine`.
class _InlineError extends StatelessWidget {
  const _InlineError(this.message);

  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    final c = context.colors;
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.md),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.dangerBg,
        border: Border.all(color: c.dangerBorder),
        borderRadius: AppRadius.smAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.warningCircle(), size: 16, color: c.danger),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              message!,
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

/// A verified status banner (green when satisfied, amber when not).
class _StatusBanner extends StatelessWidget {
  const _StatusBanner({
    required this.ok,
    required this.okText,
    required this.pendingText,
    required this.okIcon,
    required this.pendingIcon,
  });

  final bool ok;
  final String okText;
  final String pendingText;
  final IconData okIcon;
  final IconData pendingIcon;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final bg = ok ? c.successBg : c.warningBg;
    final border = ok ? c.successBorder : c.warningBorder;
    final fg = ok ? c.success : c.warning;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        children: [
          Icon(ok ? okIcon : pendingIcon, size: 20, color: fg),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              ok ? okText : pendingText,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: fg, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

/// A tappable "select" field that opens a modal picker sheet. Used for the
/// country / currency / type / category dropdowns (mobile-native, not a
/// cramped desktop <select>).
class _PickerField extends StatelessWidget {
  const _PickerField({
    required this.label,
    required this.value,
    required this.onTap,
    this.hint,
  });

  final String label;
  final String value;
  final String? hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context)
              .textTheme
              .labelMedium
              ?.copyWith(color: c.textSecondary, fontWeight: FontWeight.w600),
        ),
        const Gap(AppSpacing.xs),
        InkWell(
          onTap: onTap,
          borderRadius: AppRadius.mdAll,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: c.surface,
              border: Border.all(color: c.border),
              borderRadius: AppRadius.mdAll,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value.isEmpty ? (hint ?? "Choose…") : value,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: value.isEmpty ? c.textMuted : c.textPrimary,
                        ),
                  ),
                ),
                Icon(PhosphorIcons.caretDown(), size: 16, color: c.textMuted),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Opens a modal bottom sheet to pick one value from [options] (value, label).
Future<String?> _showPickerSheet(
  BuildContext context, {
  required String title,
  required List<MapEntry<String, String>> options,
  required String selected,
  bool searchable = false,
}) {
  final c = context.colors;
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: c.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return _PickerSheet(
        title: title,
        options: options,
        selected: selected,
        searchable: searchable,
      );
    },
  );
}

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({
    required this.title,
    required this.options,
    required this.selected,
    required this.searchable,
  });

  final String title;
  final List<MapEntry<String, String>> options;
  final String selected;
  final bool searchable;

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String _q = "";

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final needle = _q.trim().toLowerCase();
    final filtered = needle.isEmpty
        ? widget.options
        : widget.options
            .where((e) =>
                e.value.toLowerCase().contains(needle) ||
                e.key.toLowerCase().contains(needle))
            .toList();

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.75,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Gap(AppSpacing.md),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: c.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.title,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(
                      icon: Icon(PhosphorIcons.x(), size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              if (widget.searchable)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.sm,
                  ),
                  child: AppTextField(
                    hint: "Search…",
                    prefixIcon: PhosphorIcons.magnifyingGlass(),
                    autofocus: false,
                    onChanged: (v) => setState(() => _q = v),
                  ),
                ),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final e = filtered[i];
                    final isSel = e.key == widget.selected;
                    return ListRowTile(
                      title: e.value,
                      showChevron: false,
                      trailing: isSel
                          ? Icon(PhosphorIcons.check(),
                              size: 18, color: c.accent)
                          : null,
                      onTap: () => Navigator.of(context).pop(e.key),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step: Business basics
// ---------------------------------------------------------------------------

class _BasicsBody extends ConsumerStatefulWidget {
  const _BasicsBody({required this.onDone});
  final VoidCallback onDone;

  @override
  ConsumerState<_BasicsBody> createState() => _BasicsBodyState();
}

class _BasicsBodyState extends ConsumerState<_BasicsBody> {
  late final TextEditingController _name;
  String _country = "us";
  String _currency = "usd";
  String _type = "individual";
  String _category = "";
  bool _saving = false;
  String? _error;
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _seed(SetupSnapshot d) {
    if (_seeded) return;
    _seeded = true;
    _name.text = d.name;
    _country =
        (d.defaultCountry?.isNotEmpty ?? false) ? d.defaultCountry! : d.status?.storeCountry ?? "us";
    _currency = (d.currencyCode).toLowerCase();
    _type = d.business.type ?? "individual";
    _category = d.business.category ?? "";
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (_name.text.trim().isEmpty) {
      setState(() => _error = "Give your store a name.");
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(setupControllerProvider.notifier).saveBasics(
            name: _name.text,
            defaultCountry: _country,
            currency: _currency,
            businessType: _type,
            category: _category,
          );
      if (!mounted) return;
      widget.onDone();
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(setupControllerProvider).data;
    if (data != null) _seed(data);
    final c = context.colors;
    final currencyLabel = kCurrencies
        .firstWhere((e) => e.code == _currency,
            orElse: () => CurrencyOption(_currency, _currency.toUpperCase()))
        .label;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "The essentials. Your store country decides where you sell and is "
          "what makes delivery and checkout work.",
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: c.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        AppTextField(
          label: "Store name",
          hint: "e.g. Aurora Boutique",
          controller: _name,
          textCapitalization: TextCapitalization.words,
        ),
        const Gap(AppSpacing.lg),
        _PickerField(
          label: "Store country",
          value: countryName(_country),
          onTap: () async {
            final picked = await _showPickerSheet(
              context,
              title: "Store country",
              options: kCountryEntries,
              selected: _country,
              searchable: true,
            );
            if (picked != null) setState(() => _country = picked);
          },
        ),
        const Gap(AppSpacing.lg),
        _PickerField(
          label: "Currency",
          value: currencyLabel,
          onTap: () async {
            final picked = await _showPickerSheet(
              context,
              title: "Currency",
              options: [
                for (final e in kCurrencies) MapEntry(e.code, e.label),
              ],
              selected: _currency,
            );
            if (picked != null) setState(() => _currency = picked);
          },
        ),
        const Gap(AppSpacing.lg),
        _PickerField(
          label: "Business type",
          value: kBusinessTypes
              .firstWhere((e) => e.value == _type,
                  orElse: () => kBusinessTypes.first)
              .label,
          onTap: () async {
            final picked = await _showPickerSheet(
              context,
              title: "Business type",
              options: [
                for (final e in kBusinessTypes) MapEntry(e.value, e.label),
              ],
              selected: _type,
            );
            if (picked != null) setState(() => _type = picked);
          },
        ),
        const Gap(AppSpacing.lg),
        _PickerField(
          label: "What do you sell?",
          value: _category,
          hint: "Choose a category…",
          onTap: () async {
            final picked = await _showPickerSheet(
              context,
              title: "What do you sell?",
              options: [for (final e in kCategories) MapEntry(e, e)],
              selected: _category,
            );
            if (picked != null) setState(() => _category = picked);
          },
        ),
        _InlineError(_error),
        const Gap(AppSpacing.lg),
        PrimaryButton(
          label: "Save & continue",
          icon: PhosphorIcons.arrowRight(),
          isLoading: _saving,
          fullWidth: true,
          onPressed: _saving ? null : _save,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step: Brand & logo
// ---------------------------------------------------------------------------

class _BrandBody extends ConsumerStatefulWidget {
  const _BrandBody({required this.onDone});
  final VoidCallback onDone;

  @override
  ConsumerState<_BrandBody> createState() => _BrandBodyState();
}

class _BrandBodyState extends ConsumerState<_BrandBody> {
  final TextEditingController _description = TextEditingController();
  final TextEditingController _prompt = TextEditingController();
  bool _seeded = false;
  bool _saving = false;
  bool _uploading = false;
  double _uploadProgress = 0;
  bool _generating = false;
  List<String> _aiLogos = const [];
  String? _error;

  @override
  void dispose() {
    _description.dispose();
    _prompt.dispose();
    super.dispose();
  }

  void _seed(SetupSnapshot d) {
    if (_seeded) return;
    _seeded = true;
    _description.text = d.business.description ?? "";
  }

  Future<void> _pickAndUpload() async {
    setState(() => _error = null);
    try {
      final picker = ImagePicker();
      final XFile? file = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        imageQuality: 90,
      );
      if (file == null) return;
      final Uint8List bytes = await file.readAsBytes();
      setState(() {
        _uploading = true;
        _uploadProgress = 0;
      });
      await ref.read(setupControllerProvider.notifier).uploadLogo(
            bytes: bytes,
            filename: file.name,
            onProgress: (p) {
              if (mounted) setState(() => _uploadProgress = p);
            },
          );
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _generate() async {
    setState(() {
      _error = null;
      _generating = true;
      _aiLogos = const [];
    });
    try {
      final logos = await ref
          .read(setupControllerProvider.notifier)
          .generateLogos(prompt: _prompt.text.trim());
      if (mounted) setState(() => _aiLogos = logos);
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _pickAi(String url) async {
    setState(() => _error = null);
    try {
      await ref.read(setupControllerProvider.notifier).pickLogo(url);
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    }
  }

  Future<void> _saveDescription() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(setupControllerProvider.notifier)
          .saveBrand(description: _description.text);
      if (!mounted) return;
      widget.onDone();
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(setupControllerProvider).data;
    if (data != null) _seed(data);
    final logoUrl = data?.logoUrl;
    final c = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Make the store feel like yours. This is optional — you can add it "
          "any time.",
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: c.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        _LogoPreview(url: logoUrl),
        const Gap(AppSpacing.md),
        if (_uploading) ...[
          ClipRRect(
            borderRadius: AppRadius.smAll,
            child: LinearProgressIndicator(
              value: _uploadProgress > 0 ? _uploadProgress : null,
              minHeight: 6,
              backgroundColor: c.surfaceMuted,
              valueColor: AlwaysStoppedAnimation<Color>(c.accent),
            ),
          ),
          const Gap(AppSpacing.xs),
          Text(
            "Uploading… ${(_uploadProgress * 100).round()}%",
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: c.textMuted),
          ),
          const Gap(AppSpacing.sm),
        ],
        SecondaryButton(
          label: logoUrl != null && logoUrl.isNotEmpty
              ? "Replace logo"
              : "Upload from device",
          icon: PhosphorIcons.uploadSimple(),
          fullWidth: true,
          onPressed: _uploading ? null : _pickAndUpload,
        ),
        const Gap(AppSpacing.lg),
        // AI generation panel.
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: c.surfaceMuted,
            border: Border.all(color: c.border),
            borderRadius: AppRadius.mdAll,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(PhosphorIcons.sparkle(), size: 16, color: c.accent),
                  const Gap(AppSpacing.sm),
                  Expanded(
                    child: Text(
                      "No logo yet? Generate one",
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const Gap(AppSpacing.xs),
              Text(
                "Uses AI credits. We create a few clean logo marks you can use "
                "as-is or replace later.",
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: c.textMuted),
              ),
              const Gap(AppSpacing.md),
              AppTextField(
                controller: _prompt,
                hint: "e.g. ${data?.name.isNotEmpty ?? false ? data!.name : "your store"} — a modern shop",
              ),
              const Gap(AppSpacing.sm),
              PrimaryButton(
                label: "Generate logo",
                icon: PhosphorIcons.sparkle(),
                isLoading: _generating,
                fullWidth: true,
                onPressed: _generating ? null : _generate,
              ),
              if (_generating) ...[
                const Gap(AppSpacing.sm),
                Text(
                  "Designing your logo — this takes about 30 seconds.",
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: c.textMuted),
                ),
              ],
              if (_aiLogos.isNotEmpty) ...[
                const Gap(AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final url in _aiLogos)
                      _AiLogoOption(
                        url: url,
                        selected: logoUrl == url,
                        onTap: () => _pickAi(url),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const Gap(AppSpacing.lg),
        AppTextField(
          label: "Short description",
          controller: _description,
          hint: "e.g. Handmade silver jewellery, shipped worldwide.",
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
        ),
        _InlineError(_error),
        const Gap(AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: GhostButton(
                label: "Skip for now",
                onPressed: () async {
                  await ref
                      .read(setupControllerProvider.notifier)
                      .persistStep(SetupStep.brand, skipped: true);
                  if (mounted) widget.onDone();
                },
              ),
            ),
            const Gap(AppSpacing.sm),
            Expanded(
              child: PrimaryButton(
                label: "Save & continue",
                isLoading: _saving,
                onPressed: _saving ? null : _saveDescription,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _LogoPreview extends StatelessWidget {
  const _LogoPreview({required this.url});
  final String? url;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final has = url != null && url!.isNotEmpty;
    return Container(
      height: 110,
      width: double.infinity,
      decoration: BoxDecoration(
        color: c.surfaceInset,
        border: Border.all(color: c.border),
        borderRadius: AppRadius.mdAll,
      ),
      alignment: Alignment.center,
      child: has
          ? Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Image.network(
                url!,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) =>
                    Icon(PhosphorIcons.image(), color: c.textMuted, size: 28),
              ),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIcons.image(), color: c.textMuted, size: 28),
                const Gap(AppSpacing.xs),
                Text(
                  "No logo yet",
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

class _AiLogoOption extends StatelessWidget {
  const _AiLogoOption({
    required this.url,
    required this.selected,
    required this.onTap,
  });

  final String url;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: 84,
        height: 84,
        padding: const EdgeInsets.all(AppSpacing.xs),
        decoration: BoxDecoration(
          color: c.surface,
          border: Border.all(
            color: selected ? c.accent : c.border,
            width: selected ? 2 : 1,
          ),
          borderRadius: AppRadius.mdAll,
        ),
        child: Image.network(
          url,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) =>
              Icon(PhosphorIcons.image(), color: c.textMuted),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step: Products
// ---------------------------------------------------------------------------

class _ProductsBody extends ConsumerStatefulWidget {
  const _ProductsBody({required this.onContinue});
  final VoidCallback onContinue;

  @override
  ConsumerState<_ProductsBody> createState() => _ProductsBodyState();
}

class _ProductsBodyState extends ConsumerState<_ProductsBody> {
  bool _rechecking = false;

  Future<void> _recheck() async {
    setState(() => _rechecking = true);
    await ref.read(setupControllerProvider.notifier).refresh();
    if (mounted) setState(() => _rechecking = false);
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(setupControllerProvider).status;
    final hasProducts = status?.products ?? false;
    final c = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Your store needs at least one real product to sell. Your store "
          "already includes a sample so it doesn't look empty — it isn't "
          "counted, so add your own when you're ready.",
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: c.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        _StatusBanner(
          ok: hasProducts,
          okText: "You've added a real product. Nice.",
          pendingText: "No real products yet — just the sample.",
          okIcon: PhosphorIcons.checkCircle(),
          pendingIcon: PhosphorIcons.shoppingBag(),
        ),
        const Gap(AppSpacing.md),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              ListRowTile(
                icon: PhosphorIcons.plusCircle(),
                title: "Add my own product",
                subtitle: "Open the product editor — title, price, photos.",
                onTap: () => context.push("/products"),
              ),
              Divider(height: 1, color: c.border),
              ListRowTile(
                icon: PhosphorIcons.storefront(),
                title: "View my products",
                subtitle: "See what's in your catalog, including the sample.",
                onTap: () => context.push("/products"),
              ),
            ],
          ),
        ),
        const Gap(AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: "I've added one — recheck",
                icon: PhosphorIcons.arrowClockwise(),
                isLoading: _rechecking,
                onPressed: _rechecking ? null : _recheck,
              ),
            ),
            const Gap(AppSpacing.sm),
            Expanded(
              child: PrimaryButton(
                label: "Continue",
                onPressed: () async {
                  await ref
                      .read(setupControllerProvider.notifier)
                      .persistStep(SetupStep.products,
                          completed: hasProducts, skipped: !hasProducts);
                  if (mounted) widget.onContinue();
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step: Delivery
// ---------------------------------------------------------------------------

class _DeliveryBody extends ConsumerStatefulWidget {
  const _DeliveryBody({required this.onDone});
  final VoidCallback onDone;

  @override
  ConsumerState<_DeliveryBody> createState() => _DeliveryBodyState();
}

class _DeliveryBodyState extends ConsumerState<_DeliveryBody> {
  final TextEditingController _amount = TextEditingController();
  final Set<String> _selected = {};
  String _priceType = "free";
  String _query = "";
  bool _saving = false;
  String? _error;
  bool _seeded = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  void _seed(SetupSnapshot d) {
    if (_seeded) return;
    _seeded = true;
    final storeCountry =
        (d.defaultCountry?.isNotEmpty ?? false) ? d.defaultCountry! : d.status?.storeCountry ?? "us";
    _selected
      ..add(storeCountry)
      ..addAll(d.status?.shippingCountries ?? const []);
  }

  Future<void> _save(String storeCountry, String currency) async {
    setState(() => _error = null);
    if (_selected.isEmpty) {
      setState(() => _error = "Pick at least one country you deliver to.");
      return;
    }
    if (!_selected.contains(storeCountry)) {
      setState(() => _error =
          "Include your store country (${storeCountry.toUpperCase()}) — shoppers there can't check out otherwise.");
      return;
    }
    int amountMinor = 0;
    if (_priceType == "flat") {
      final v = double.tryParse(_amount.text.trim());
      if (v == null || v < 0) {
        setState(() =>
            _error = "Enter a delivery charge, or choose Free delivery.");
        return;
      }
      amountMinor = (v * 100).round();
    }
    setState(() => _saving = true);
    try {
      await ref.read(setupControllerProvider.notifier).saveDelivery(
            countries: _selected.toList(),
            priceType: _priceType,
            amountMinor: amountMinor,
          );
      if (!mounted) return;
      widget.onDone();
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(setupControllerProvider).data;
    if (data != null) _seed(data);
    final c = context.colors;
    final storeCountry = (data?.defaultCountry?.isNotEmpty ?? false)
        ? data!.defaultCountry!
        : data?.status?.storeCountry ?? "us";
    final currency = (data?.currencyCode ?? "usd").toUpperCase();
    final shippingSet = data?.status?.shipping ?? false;
    final shippingCountries = data?.status?.shippingCountries ?? const [];

    final needle = _query.trim().toLowerCase();
    final filtered = needle.isEmpty
        ? kCountryEntries
        : kCountryEntries
            .where((e) =>
                e.value.toLowerCase().contains(needle) ||
                e.key.contains(needle))
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Tell us where you deliver and what you charge. We'll create the "
          "delivery option so shoppers can check out.",
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: c.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        if (shippingSet) ...[
          _StatusBanner(
            ok: true,
            okText:
                "Delivery is set up for ${shippingCountries.map((e) => e.toUpperCase()).join(", ")}. Add more below.",
            pendingText: "",
            okIcon: PhosphorIcons.checkCircle(),
            pendingIcon: PhosphorIcons.truck(),
          ),
          const Gap(AppSpacing.md),
        ],
        Text(
          "Countries you deliver to",
          style: Theme.of(context)
              .textTheme
              .labelMedium
              ?.copyWith(color: c.textSecondary, fontWeight: FontWeight.w600),
        ),
        const Gap(AppSpacing.xs),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: c.border),
            borderRadius: AppRadius.mdAll,
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: AppTextField(
                  hint: "Search countries…",
                  prefixIcon: PhosphorIcons.magnifyingGlass(),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
              Divider(height: 1, color: c.border),
              SizedBox(
                height: 220,
                child: ListView.builder(
                  padding: EdgeInsets.zero,
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final e = filtered[i];
                    final checked = _selected.contains(e.key);
                    final isStore = e.key == storeCountry;
                    return CheckboxListTile(
                      dense: true,
                      controlAffinity: ListTileControlAffinity.leading,
                      value: checked,
                      activeColor: c.accent,
                      onChanged: (_) => setState(() {
                        if (checked) {
                          _selected.remove(e.key);
                        } else {
                          _selected.add(e.key);
                        }
                      }),
                      title: Row(
                        children: [
                          Expanded(child: Text(e.value)),
                          if (isStore)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: c.primary,
                                borderRadius:
                                    BorderRadius.circular(AppRadius.pill),
                              ),
                              child: Text(
                                "your country",
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(color: c.onPrimary),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        if (!_selected.contains(storeCountry)) ...[
          const Gap(AppSpacing.sm),
          Text(
            "Tip: include ${storeCountry.toUpperCase()} (your store country) so "
            "your own customers can order.",
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: c.warning),
          ),
        ],
        const Gap(AppSpacing.lg),
        Text(
          "Delivery charge",
          style: Theme.of(context)
              .textTheme
              .labelMedium
              ?.copyWith(color: c.textSecondary, fontWeight: FontWeight.w600),
        ),
        const Gap(AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: _ChoiceTile(
                label: "Free",
                selected: _priceType == "free",
                onTap: () => setState(() => _priceType = "free"),
              ),
            ),
            const Gap(AppSpacing.sm),
            Expanded(
              child: _ChoiceTile(
                label: "Flat rate",
                selected: _priceType == "flat",
                onTap: () => setState(() => _priceType = "flat"),
              ),
            ),
          ],
        ),
        if (_priceType == "flat") ...[
          const Gap(AppSpacing.sm),
          AppTextField(
            label: "Amount ($currency)",
            controller: _amount,
            hint: "0.00",
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ],
        _InlineError(_error),
        const Gap(AppSpacing.lg),
        PrimaryButton(
          label: "Save delivery & continue",
          icon: PhosphorIcons.arrowRight(),
          isLoading: _saving,
          fullWidth: true,
          onPressed: _saving ? null : () => _save(storeCountry, currency),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step: Payments
// ---------------------------------------------------------------------------

class _PaymentsBody extends ConsumerStatefulWidget {
  const _PaymentsBody({required this.onContinue});
  final VoidCallback onContinue;

  @override
  ConsumerState<_PaymentsBody> createState() => _PaymentsBodyState();
}

class _PaymentsBodyState extends ConsumerState<_PaymentsBody> {
  bool _rechecking = false;

  Future<void> _recheck() async {
    setState(() => _rechecking = true);
    await ref.read(setupControllerProvider.notifier).refresh();
    if (mounted) setState(() => _rechecking = false);
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(setupControllerProvider).status;
    final hasPayment = status?.payment ?? false;
    final c = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Connect a way to get paid. Open payment settings, enable a method "
          "and add your keys — then come back and recheck.",
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: c.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        _StatusBanner(
          ok: hasPayment,
          okText: "A payment method is enabled and ready.",
          pendingText: "No payment method enabled yet.",
          okIcon: PhosphorIcons.checkCircle(),
          pendingIcon: PhosphorIcons.creditCard(),
        ),
        const Gap(AppSpacing.md),
        AppCard(
          padding: EdgeInsets.zero,
          child: ListRowTile(
            icon: PhosphorIcons.creditCard(),
            title: "Open payment settings",
            subtitle: "Enable and configure a gateway.",
            onTap: () => context.push("/settings"),
          ),
        ),
        const Gap(AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: "I've enabled one — recheck",
                icon: PhosphorIcons.arrowClockwise(),
                isLoading: _rechecking,
                onPressed: _rechecking ? null : _recheck,
              ),
            ),
            const Gap(AppSpacing.sm),
            Expanded(
              child: PrimaryButton(
                label: "Continue",
                onPressed: () async {
                  await ref
                      .read(setupControllerProvider.notifier)
                      .persistStep(SetupStep.payments,
                          completed: hasPayment, skipped: !hasPayment);
                  if (mounted) widget.onContinue();
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step: Review & go live
// ---------------------------------------------------------------------------

class _ReviewBody extends ConsumerStatefulWidget {
  const _ReviewBody({required this.onJump});
  final void Function(SetupStep) onJump;

  @override
  ConsumerState<_ReviewBody> createState() => _ReviewBodyState();
}

class _ReviewBodyState extends ConsumerState<_ReviewBody> {
  bool _removing = false;
  int? _removed;
  bool _finishing = false;

  // Verified tasks that map to a wizard step switch in-place; others (domain)
  // navigate to their own page.
  static const Map<String, SetupStep> _taskToStep = {
    "store_country": SetupStep.basics,
    "business_details": SetupStep.basics,
    "logo": SetupStep.brand,
    "products": SetupStep.products,
    "shipping": SetupStep.delivery,
    "payment": SetupStep.payments,
  };

  Future<void> _removeDemo() async {
    setState(() => _removing = true);
    try {
      final n = await ref.read(setupControllerProvider.notifier).removeDemo();
      if (mounted) setState(() => _removed = n);
    } catch (_) {
      if (mounted) setState(() => _removed = null);
    } finally {
      if (mounted) setState(() => _removing = false);
    }
  }

  Future<void> _finish() async {
    setState(() => _finishing = true);
    try {
      await ref.read(setupControllerProvider.notifier).finish();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text("Your store is ready to sell.")),
        );
    } catch (_) {
      // finish is best-effort; status already reflects readiness.
    } finally {
      if (mounted) setState(() => _finishing = false);
    }
  }

  void _onFix(SetupTask t) {
    final step = _taskToStep[t.key];
    if (step != null) {
      widget.onJump(step);
    } else if (t.ctaHref.isNotEmpty) {
      // Domain and other page-based tasks live outside the wizard.
      final path = t.ctaHref.startsWith("/dashboard")
          ? t.ctaHref.replaceFirst("/dashboard", "")
          : t.ctaHref;
      if (path.startsWith("/")) context.push(path);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(setupControllerProvider).status;
    final c = context.colors;
    if (status == null) {
      return const SizedBox.shrink();
    }
    final ready = status.readyToSell;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          ready
              ? "Everything required is done — your store can take orders."
              : "Here's what's left before your store can take an order.",
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: c.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: c.border),
            borderRadius: AppRadius.mdAll,
          ),
          child: Column(
            children: [
              for (var i = 0; i < status.tasks.length; i++) ...[
                if (i > 0) Divider(height: 1, color: c.border),
                _ReviewTaskRow(
                  task: status.tasks[i],
                  onFix: () => _onFix(status.tasks[i]),
                ),
              ],
            ],
          ),
        ),
        const Gap(AppSpacing.lg),
        // Remove demo data.
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: c.surfaceMuted,
            border: Border.all(color: c.border),
            borderRadius: AppRadius.mdAll,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Remove demo data",
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const Gap(AppSpacing.xs),
              Text(
                "Deletes the sample product your store was created with. Do "
                "this once you've added your own.",
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: c.textMuted),
              ),
              const Gap(AppSpacing.sm),
              SecondaryButton(
                label: _removed != null
                    ? (_removed! > 0 ? "Removed $_removed" : "Nothing to remove")
                    : "Remove demo data",
                icon: PhosphorIcons.trash(),
                isLoading: _removing,
                fullWidth: true,
                onPressed:
                    (_removing || _removed != null) ? null : _removeDemo,
              ),
            ],
          ),
        ),
        const Gap(AppSpacing.lg),
        if (ready)
          PrimaryButton(
            label: "Start selling",
            icon: PhosphorIcons.checkCircle(),
            isLoading: _finishing,
            fullWidth: true,
            onPressed: _finishing ? null : _finish,
          )
        else
          Text(
            "Finish the required steps above to start selling.",
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: c.textMuted),
          ),
      ],
    );
  }
}

class _ReviewTaskRow extends StatelessWidget {
  const _ReviewTaskRow({required this.task, required this.onFix});

  final SetupTask task;
  final VoidCallback onFix;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final done = task.done;
    final detail = (!done && (task.blockerDetail?.isNotEmpty ?? false))
        ? task.blockerDetail!
        : task.why;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done
                  ? c.success
                  : task.required
                      ? c.warningBg
                      : c.surfaceMuted,
            ),
            child: Icon(
              done ? PhosphorIcons.check() : PhosphorIcons.warning(),
              size: 12,
              color: done
                  ? c.onPrimary
                  : task.required
                      ? c.warning
                      : c.textMuted,
            ),
          ),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        task.label,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w500,
                              color: done ? c.textMuted : c.textPrimary,
                              decoration:
                                  done ? TextDecoration.lineThrough : null,
                            ),
                      ),
                    ),
                    if (!task.required) ...[
                      const Gap(AppSpacing.xs),
                      Text(
                        "optional",
                        style: Theme.of(context)
                            .textTheme
                            .labelSmall
                            ?.copyWith(color: c.textMuted),
                      ),
                    ],
                  ],
                ),
                if (!done && detail.isNotEmpty) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    detail,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: task.blockerDetail?.isNotEmpty ?? false
                              ? c.warning
                              : c.textMuted,
                        ),
                  ),
                ],
              ],
            ),
          ),
          if (!done) ...[
            const Gap(AppSpacing.sm),
            GhostButton(
              label: "Fix",
              size: AppButtonSize.small,
              onPressed: onFix,
            ),
          ],
        ],
      ),
    );
  }
}

/// A radio-style selectable tile (avoids the deprecated Radio group API).
class _ChoiceTile extends StatelessWidget {
  const _ChoiceTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.mdAll,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: selected ? c.accentTint : c.surface,
          border: Border.all(
            color: selected ? c.accent : c.border,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: AppRadius.mdAll,
        ),
        child: Row(
          children: [
            Icon(
              selected
                  ? PhosphorIconsFill.checkCircle
                  : PhosphorIconsRegular.circle,
              size: 18,
              color: selected ? c.accent : c.textMuted,
            ),
            const Gap(AppSpacing.sm),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    color: c.textPrimary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

class _SetupSkeleton extends StatelessWidget {
  const _SetupSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: AppSpacing.screen,
      children: [
        Shimmer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SkeletonBox(height: 84, borderRadius: AppRadius.lgAll),
              const Gap(AppSpacing.lg),
              for (var i = 0; i < 6; i++) ...[
                const SkeletonBox(height: 64, borderRadius: AppRadius.lgAll),
                const Gap(AppSpacing.md),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------

String _msg(Object e) => ApiError.from(e).message;
