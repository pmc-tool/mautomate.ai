import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../data/ads_models.dart";
import "../data/ads_repository.dart";

/// Advertising — create campaign (core). A focused form that creates a Meta
/// campaign from a goal, a daily budget, target countries and the ad copy. The
/// backend always creates it PAUSED; the merchant reviews it on the detail
/// screen and launches explicitly.
///
/// Scoped down from the web wizard: AI-generated copy/image/video and the
/// product-catalog anchor are intentionally left to the web dashboard — this
/// form covers the manual create path end to end.
class AdsCreateCampaignScreen extends ConsumerStatefulWidget {
  const AdsCreateCampaignScreen({super.key});

  static Route<bool> route() {
    return MaterialPageRoute<bool>(
      builder: (_) => const AdsCreateCampaignScreen(),
    );
  }

  @override
  ConsumerState<AdsCreateCampaignScreen> createState() =>
      _AdsCreateCampaignScreenState();
}

class _Goal {
  const _Goal(this.value, this.label, this.icon);
  final String value;
  final String label;
  final IconData icon;
}

class _AdsCreateCampaignScreenState
    extends ConsumerState<AdsCreateCampaignScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _budget = TextEditingController(text: "20");
  final _countries = TextEditingController(text: "US");
  final _headline = TextEditingController();
  final _primaryText = TextEditingController();
  final _linkUrl = TextEditingController();

  final List<_Goal> _goals = [
    _Goal("sales", "Sales", PhosphorIcons.shoppingCart()),
    _Goal("traffic", "Traffic", PhosphorIcons.cursorClick()),
    _Goal("awareness", "Awareness", PhosphorIcons.eye()),
  ];
  String _goal = "sales";
  bool _submitting = false;

  // The Facebook Page the ad publishes as. Meta requires it, so the form loads
  // the merchant's Pages up-front and blocks submit until one is chosen.
  List<AdsPage> _pages = const [];
  String? _pageId;
  bool _pagesLoading = true;
  String? _pagesError;

  @override
  void initState() {
    super.initState();
    _loadPages();
  }

  Future<void> _loadPages() async {
    setState(() {
      _pagesLoading = true;
      _pagesError = null;
    });
    try {
      final pages = await ref.read(adsRepositoryProvider).listPages();
      if (!mounted) return;
      setState(() {
        _pages = pages;
        _pagesLoading = false;
        // Drop a stale selection and auto-pick when there's exactly one Page.
        if (_pageId != null && !pages.any((p) => p.id == _pageId)) {
          _pageId = null;
        }
        if (_pageId == null && pages.length == 1) {
          _pageId = pages.first.id;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pages = const [];
        _pagesLoading = false;
        _pagesError = ApiError.from(e).message;
      });
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _budget.dispose();
    _countries.dispose();
    _headline.dispose();
    _primaryText.dispose();
    _linkUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppScaffold(
      title: "New campaign",
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            Text(
              "Create a Meta campaign. It starts paused so you can review it "
              "before any spend — launch it from the campaign screen.",
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.textSecondary),
            ),
            const Gap(AppSpacing.lg),
            _label(context, "Goal"),
            const Gap(AppSpacing.sm),
            _GoalSelector(
              goals: _goals,
              selected: _goal,
              onSelected: (g) => setState(() => _goal = g),
            ),
            const Gap(AppSpacing.lg),
            _label(context, "Publish as"),
            const Gap(AppSpacing.sm),
            _PagePicker(
              pages: _pages,
              loading: _pagesLoading,
              error: _pagesError,
              selected: _pageId,
              onSelected: (id) => setState(() => _pageId = id),
              onRetry: _loadPages,
            ),
            const Gap(AppSpacing.lg),
            AppTextField(
              controller: _name,
              label: "Campaign name",
              hint: "e.g. Summer sale — prospecting",
              textCapitalization: TextCapitalization.sentences,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? "Give it a name." : null,
            ),
            const Gap(AppSpacing.lg),
            AppTextField(
              controller: _budget,
              label: "Daily budget",
              hint: "e.g. 20",
              helperText: "The most it spends per day, billed to your ad account.",
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              validator: (v) {
                final parsed = num.tryParse((v ?? "").trim());
                if (parsed == null || parsed <= 0) {
                  return "Enter an amount above 0.";
                }
                return null;
              },
            ),
            const Gap(AppSpacing.lg),
            AppTextField(
              controller: _countries,
              label: "Target countries",
              hint: "e.g. US, GB, CA",
              helperText: "Comma-separated ISO country codes.",
              validator: (v) =>
                  _parseCountries(v).isEmpty ? "Add at least one country." : null,
            ),
            const Gap(AppSpacing.lg),
            AppTextField(
              controller: _headline,
              label: "Headline",
              hint: "The bold line at the top of your ad",
              textCapitalization: TextCapitalization.sentences,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? "Add a headline." : null,
            ),
            const Gap(AppSpacing.lg),
            AppTextField(
              controller: _primaryText,
              label: "Primary text",
              hint: "The main message of your ad",
              maxLines: 4,
              minLines: 3,
              textCapitalization: TextCapitalization.sentences,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? "Add the ad's primary text."
                  : null,
            ),
            const Gap(AppSpacing.lg),
            AppTextField(
              controller: _linkUrl,
              label: "Destination link (optional)",
              hint: "https://your-store.com/products/...",
              keyboardType: TextInputType.url,
            ),
            const Gap(AppSpacing.xl),
            PrimaryButton(
              label: "Create campaign (paused)",
              icon: PhosphorIcons.check(),
              fullWidth: true,
              isLoading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(BuildContext context, String text) => Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: context.colors.textSecondary,
            ),
      );

  List<String> _parseCountries(String? raw) {
    return (raw ?? "")
        .split(RegExp(r"[,\s]+"))
        .map((s) => s.trim().toUpperCase())
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Meta requires the Page the ad publishes as; the server rejects a create
    // without it, so gate the submit here with a clear prompt.
    final pageId = _pageId;
    if (pageId == null || pageId.isEmpty) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text("Pick the Facebook Page your ad publishes as."),
          ),
        );
      return;
    }

    setState(() => _submitting = true);
    final link = _linkUrl.text.trim();
    final input = CreateAdsCampaignInput(
      platform: "meta",
      name: _name.text.trim(),
      goal: _goal,
      dailyBudget: num.tryParse(_budget.text.trim()) ?? 0,
      countries: _parseCountries(_countries.text),
      headline: _headline.text.trim(),
      primaryText: _primaryText.text.trim(),
      linkUrl: link.isEmpty ? null : link,
      pageId: pageId,
    );
    try {
      await ref.read(adsRepositoryProvider).createCampaign(input);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final msg = ApiError.from(e).message;
      if (msg.toLowerCase().contains("pixel")) {
        // A Sales campaign needs an active pixel, which can't be switched on
        // from the app yet — guide the merchant to the web instead of leaving
        // the 403 as a fleeting snackbar.
        await _showPixelHelp(msg);
      } else {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(msg),
              backgroundColor: AppColors.dangerSolid,
            ),
          );
      }
    }
  }

  Future<void> _showPixelHelp(String serverMessage) async {
    await showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        final c = dialogCtx.colors;
        return AlertDialog(
          backgroundColor: c.surface,
          title: const Text("Set up your pixel first"),
          content: Text(
            "$serverMessage\n\nTracking and catalog setup isn't in the app "
            "yet — open Advertising on the web dashboard (Ad accounts, then "
            "Tracking & catalog) to switch your pixel on, then create this "
            "Sales campaign again. Or pick a Traffic or Awareness goal, which "
            "don't need a pixel.",
            style: TextStyle(color: c.textSecondary),
          ),
          actions: [
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: c.primary,
                foregroundColor: c.onPrimary,
              ),
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text("Got it"),
            ),
          ],
        );
      },
    );
  }
}

class _GoalSelector extends StatelessWidget {
  const _GoalSelector({
    required this.goals,
    required this.selected,
    required this.onSelected,
  });

  final List<_Goal> goals;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: goals.map((goal) {
        final isSelected = goal.value == selected;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: goal == goals.last ? 0 : AppSpacing.sm,
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: AppRadius.mdAll,
                onTap: () => onSelected(goal.value),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    vertical: AppSpacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected ? c.accentTint : c.surface,
                    borderRadius: AppRadius.mdAll,
                    border: Border.all(
                      color: isSelected ? c.accent : c.border,
                    ),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        goal.icon,
                        size: 20,
                        color: isSelected ? c.accent : c.textSecondary,
                      ),
                      const Gap(AppSpacing.xs),
                      Text(
                        goal.label,
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color:
                                      isSelected ? c.accent : c.textSecondary,
                                  fontWeight: isSelected
                                      ? FontWeight.w600
                                      : FontWeight.w500,
                                ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(growable: false),
    );
  }
}


/// The "Publish as" picker — the Facebook Pages the ad can run under. Loading,
/// error (with retry) and empty states are all handled so the merchant is never
/// stuck without knowing why they can't pick a Page.
class _PagePicker extends StatelessWidget {
  const _PagePicker({
    required this.pages,
    required this.loading,
    required this.error,
    required this.selected,
    required this.onSelected,
    required this.onRetry,
  });

  final List<AdsPage> pages;
  final bool loading;
  final String? error;
  final String? selected;
  final ValueChanged<String> onSelected;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    if (loading) {
      return Row(
        children: [
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: c.accent),
          ),
          const Gap(AppSpacing.sm),
          Text(
            "Loading your Facebook Pages…",
            style: text.bodySmall?.copyWith(color: c.textSecondary),
          ),
        ],
      );
    }

    if (error != null) {
      return _PageNotice(message: error!, onRetry: onRetry);
    }

    if (pages.isEmpty) {
      return _PageNotice(
        message:
            "No Facebook Page is available yet. Connect a Page to your Meta ad "
            "account on the web dashboard, then try again.",
        onRetry: onRetry,
      );
    }

    return Column(
      children: [
        for (final p in pages)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: AppRadius.mdAll,
                onTap: () => onSelected(p.id),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: selected == p.id ? c.accentTint : c.surface,
                    borderRadius: AppRadius.mdAll,
                    border: Border.all(
                      color: selected == p.id ? c.accent : c.border,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        selected == p.id
                            ? PhosphorIconsFill.checkCircle
                            : PhosphorIconsRegular.circle,
                        size: 20,
                        color: selected == p.id ? c.accent : c.textMuted,
                      ),
                      const Gap(AppSpacing.md),
                      Expanded(
                        child: Text(
                          (p.name == null || p.name!.isEmpty)
                              ? "Page ${p.id}"
                              : p.name!,
                          style:
                              text.bodyMedium?.copyWith(color: c.textPrimary),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// A warning card for the Page picker's error / empty states, with a retry.
class _PageNotice extends StatelessWidget {
  const _PageNotice({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: AppSpacing.card,
      decoration: BoxDecoration(
        color: c.warningBg,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.warningBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(PhosphorIcons.info(), size: 18, color: c.warning),
              const Gap(AppSpacing.sm),
              Expanded(
                child: Text(
                  message,
                  style:
                      Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: c.warning,
                          ),
                ),
              ),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onRetry,
              child: const Text("Try again"),
            ),
          ),
        ],
      ),
    );
  }
}
