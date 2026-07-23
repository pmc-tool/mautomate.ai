import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/ads_campaign_detail_controller.dart";
import "../data/ads_models.dart";
import "ads_format.dart";

/// Advertising — campaign detail. The status control (Launch / Pause), the
/// daily budget, the window performance totals, the ad previews, and the
/// action timeline: every change to this campaign — by the merchant, the AI, or
/// the autopilot — with who did it and why.
///
/// Launch/Pause and budget changes each go through a confirm dialog; the server
/// enforces the real gate (spend is billed to the merchant's own ad account).
class AdsCampaignDetailScreen extends ConsumerStatefulWidget {
  const AdsCampaignDetailScreen({
    super.key,
    required this.campaignId,
    this.campaignName,
  });

  final String campaignId;
  final String? campaignName;

  static Route<void> route(String campaignId, String? campaignName) {
    return MaterialPageRoute<void>(
      builder: (_) => AdsCampaignDetailScreen(
        campaignId: campaignId,
        campaignName: campaignName,
      ),
    );
  }

  @override
  ConsumerState<AdsCampaignDetailScreen> createState() =>
      _AdsCampaignDetailScreenState();
}

class _AdsCampaignDetailScreenState
    extends ConsumerState<AdsCampaignDetailScreen> {
  String? _busy;

  AdsCampaignDetailController get _controller =>
      ref.read(adsCampaignDetailControllerProvider(widget.campaignId).notifier);

  @override
  Widget build(BuildContext context) {
    final state =
        ref.watch(adsCampaignDetailControllerProvider(widget.campaignId));

    return AppScaffold(
      title: widget.campaignName ?? "Campaign",
      onRefresh: () => ref.refresh(
        adsCampaignDetailControllerProvider(widget.campaignId).future,
      ),
      body: state.when(
        loading: () => const SkeletonList(itemCount: 5),
        error: (e, _) => _Scrollable(
          child: ErrorStateView(
            message: ApiError.from(e).message,
            onRetry: () => ref.invalidate(
              adsCampaignDetailControllerProvider(widget.campaignId),
            ),
          ),
        ),
        data: (detail) => _body(context, detail),
      ),
    );
  }

  Widget _body(BuildContext context, AdsCampaignDetail detail) {
    final campaign = detail.campaign;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        _HeaderCard(campaign: campaign),
        const Gap(AppSpacing.lg),
        _StatusCard(
          campaign: campaign,
          busy: _busy,
          onLaunch: () => _launch(campaign),
          onPause: () => _pause(campaign),
          onEditBudget: () => _editBudget(campaign),
        ),
        const Gap(AppSpacing.lg),
        _TotalsCard(totals: detail.totals, currency: campaign.currency),
        if (detail.ads.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          _AdsCard(ads: detail.ads),
        ],
        const Gap(AppSpacing.lg),
        _TimelineCard(timeline: detail.timeline),
      ],
    );
  }

  // --- Actions --------------------------------------------------------------

  Future<void> _launch(AdsCampaign campaign) async {
    final perDay = campaign.dailyBudget != null
        ? MoneyText.format(campaign.dailyBudget!, campaign.currency ?? "usd")
        : "your set budget";
    final ok = await _confirm(
      title: "Launch this campaign?",
      message:
          "\"${campaign.name}\" starts spending up to $perDay per day, billed "
          "to your ad account. You can pause it any time.",
      confirmLabel: "Launch",
    );
    if (!ok) return;
    await _run("launch", _controller.launch, success: "Campaign is live.");
  }

  Future<void> _pause(AdsCampaign campaign) async {
    final ok = await _confirm(
      title: "Pause this campaign?",
      message: "\"${campaign.name}\" stops spending until you launch it again.",
      confirmLabel: "Pause",
    );
    if (!ok) return;
    await _run("pause", _controller.pause, success: "Campaign paused.");
  }

  Future<void> _editBudget(AdsCampaign campaign) async {
    final value = await _promptBudget(campaign);
    if (value == null) return;
    await _run(
      "budget",
      () => _controller.setBudget(value),
      success: "Daily budget updated.",
    );
  }

  Future<void> _run(
    String tag,
    Future<void> Function() action, {
    required String success,
  }) async {
    setState(() => _busy = tag);
    try {
      await action();
      if (mounted) _toast(success);
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
    bool destructive = false,
  }) async {
    final c = context.colors;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: c.surface,
        title: Text(title),
        content: Text(message),
        actions: [
          GhostButton(
            label: "Back",
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          if (destructive)
            GhostButton(
              label: confirmLabel,
              destructive: true,
              size: AppButtonSize.small,
              onPressed: () => Navigator.of(dialogContext).pop(true),
            )
          else
            PrimaryButton(
              label: confirmLabel,
              size: AppButtonSize.small,
              onPressed: () => Navigator.of(dialogContext).pop(true),
            ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<num?> _promptBudget(AdsCampaign campaign) async {
    final c = context.colors;
    final currency = campaign.currency ?? "usd";
    final controller = TextEditingController(
      text: campaign.dailyBudget != null
          ? campaign.dailyBudget!.toString()
          : "",
    );
    String? errorText;

    final value = await showDialog<num>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setLocal) => AlertDialog(
          backgroundColor: c.surface,
          title: const Text("Daily budget"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "The most this campaign spends per day, in "
                "${currency.toUpperCase()}. Billed to your ad account.",
                style: Theme.of(dialogContext)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: c.textSecondary),
              ),
              const Gap(AppSpacing.md),
              AppTextField(
                controller: controller,
                autofocus: true,
                hint: "e.g. 20",
                errorText: errorText,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ],
          ),
          actions: [
            GhostButton(
              label: "Cancel",
              size: AppButtonSize.small,
              onPressed: () => Navigator.of(dialogContext).pop(),
            ),
            PrimaryButton(
              label: "Save",
              size: AppButtonSize.small,
              onPressed: () {
                final parsed = num.tryParse(controller.text.trim());
                if (parsed == null || parsed <= 0) {
                  setLocal(() => errorText = "Enter an amount above 0.");
                  return;
                }
                Navigator.of(dialogContext).pop(parsed);
              },
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    return value;
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: error ? AppColors.dangerSolid : null,
        ),
      );
  }
}

// --- Header -----------------------------------------------------------------

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.campaign});

  final AdsCampaign campaign;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final meta = [
      campaign.platform.isEmpty ? "" : humanise(campaign.platform),
      fmtObjective(campaign.objective),
      campaign.createdAt.isEmpty ? "" : "created ${fmtDate(campaign.createdAt)}",
    ].where((s) => s.isNotEmpty).join(" · ");

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(campaign.name, style: text.titleMedium)),
              const Gap(AppSpacing.sm),
              StatusChip(status: campaign.status),
            ],
          ),
          if (meta.isNotEmpty) ...[
            const Gap(AppSpacing.xs),
            Text(meta, style: text.bodySmall?.copyWith(color: c.textSecondary)),
          ],
          if (campaign.error != null && campaign.error!.isNotEmpty) ...[
            const Gap(AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: c.dangerBg,
                borderRadius: AppRadius.smAll,
                border: Border.all(color: c.dangerBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(PhosphorIcons.warning(), size: 16, color: c.danger),
                  const Gap(AppSpacing.sm),
                  Expanded(
                    child: Text(
                      campaign.error!,
                      style: text.bodySmall?.copyWith(color: c.danger),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Status + budget control ------------------------------------------------

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.campaign,
    required this.busy,
    required this.onLaunch,
    required this.onPause,
    required this.onEditBudget,
  });

  final AdsCampaign campaign;
  final String? busy;
  final VoidCallback onLaunch;
  final VoidCallback onPause;
  final VoidCallback onEditBudget;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final isActive = campaign.status == "active";
    final canToggle = campaign.status == "active" ||
        campaign.status == "paused" ||
        campaign.status == "draft";
    final budgetLabel = campaign.dailyBudget != null
        ? "${MoneyText.format(campaign.dailyBudget!, campaign.currency ?? "usd")} / day"
        : campaign.lifetimeBudget != null
            ? "${MoneyText.format(campaign.lifetimeBudget!, campaign.currency ?? "usd")} lifetime"
            : "Not set";

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "DAILY BUDGET",
                      style: text.labelSmall?.copyWith(color: c.textMuted),
                    ),
                    const Gap(AppSpacing.xxs),
                    Text(budgetLabel, style: text.titleMedium),
                  ],
                ),
              ),
              GhostButton(
                label: "Edit",
                icon: PhosphorIcons.pencilSimple(),
                size: AppButtonSize.small,
                onPressed: busy == null ? onEditBudget : null,
                isLoading: busy == "budget",
              ),
            ],
          ),
          const Gap(AppSpacing.md),
          if (canToggle)
            (isActive
                ? SecondaryButton(
                    label: "Pause campaign",
                    icon: PhosphorIcons.pause(),
                    fullWidth: true,
                    onPressed: busy == null ? onPause : null,
                    isLoading: busy == "pause",
                  )
                : PrimaryButton(
                    label: "Launch campaign",
                    icon: PhosphorIcons.rocketLaunch(),
                    fullWidth: true,
                    onPressed: busy == null ? onLaunch : null,
                    isLoading: busy == "launch",
                  ))
          else
            Text(
              "This campaign is ${humanise(campaign.status).toLowerCase()} and "
              "can't be launched or paused from here.",
              style: text.bodySmall?.copyWith(color: c.textMuted),
            ),
        ],
      ),
    );
  }
}

// --- Totals -----------------------------------------------------------------

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.totals, required this.currency});

  final AdsTotals totals;
  final String? currency;

  @override
  Widget build(BuildContext context) {
    final cur = currency ?? totals.currency ?? "usd";
    final rows = <(String, Widget)>[
      (
        "Spend",
        MoneyText(amount: totals.spend, currencyCode: cur, strong: true)
      ),
      ("Impressions", Text(fmtInt(totals.impressions))),
      ("Clicks", Text(fmtInt(totals.clicks))),
      ("Purchases", Text(fmtInt(totals.conversions))),
      (
        "Value",
        MoneyText(amount: totals.conversionValue, currencyCode: cur)
      ),
      ("ROAS", Text(fmtRoas(totals.roas))),
    ];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Performance",
            subtitle: "Results over the campaign's reporting window.",
          ),
          const Gap(AppSpacing.md),
          ...List.generate(rows.length, (i) {
            final (label, value) = rows[i];
            return Padding(
              padding: EdgeInsets.only(
                bottom: i == rows.length - 1 ? 0 : AppSpacing.sm,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    label,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: context.colors.textSecondary),
                  ),
                  value,
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

// --- Ads --------------------------------------------------------------------

class _AdsCard extends StatelessWidget {
  const _AdsCard({required this.ads});

  final List<AdsAd> ads;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Ads",
            subtitle: "The creative running in this campaign.",
          ),
          const Gap(AppSpacing.md),
          ...List.generate(ads.length, (i) {
            final ad = ads[i];
            final creative = ad.creative;
            return Padding(
              padding: EdgeInsets.only(
                bottom: i == ads.length - 1 ? 0 : AppSpacing.md,
              ),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: c.surfaceInset,
                  borderRadius: AppRadius.smAll,
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            creative?.headline?.isNotEmpty == true
                                ? creative!.headline!
                                : (ad.name ?? "Ad"),
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                        const Gap(AppSpacing.sm),
                        StatusChip(status: ad.status),
                      ],
                    ),
                    if (creative?.primaryText?.isNotEmpty == true) ...[
                      const Gap(AppSpacing.xs),
                      Text(
                        creative!.primaryText!,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: c.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

// --- Timeline ---------------------------------------------------------------

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({required this.timeline});

  final List<AdsTimelineEntry> timeline;

  IconData _actorIcon(String actor) {
    switch (actor) {
      case "ai":
        return PhosphorIcons.sparkle();
      case "autopilot":
        return PhosphorIcons.robot();
      case "system":
        return PhosphorIcons.gear();
      default:
        return PhosphorIcons.user();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Activity",
            subtitle: "Every change to this campaign, and who made it.",
          ),
          const Gap(AppSpacing.md),
          if (timeline.isEmpty)
            Text(
              "No activity yet.",
              style: text.bodySmall?.copyWith(color: c.textMuted),
            )
          else
            ...List.generate(timeline.length, (i) {
              final entry = timeline[i];
              return Padding(
                padding: EdgeInsets.only(
                  bottom: i == timeline.length - 1 ? 0 : AppSpacing.md,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: c.surfaceMuted,
                        borderRadius: AppRadius.smAll,
                      ),
                      child: Icon(
                        _actorIcon(entry.actor),
                        size: 16,
                        color: c.textSecondary,
                      ),
                    ),
                    const Gap(AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(humanise(entry.action), style: text.titleSmall),
                          if (entry.reason != null &&
                              entry.reason!.isNotEmpty) ...[
                            const Gap(AppSpacing.xxs),
                            Text(
                              entry.reason!,
                              style: text.bodySmall
                                  ?.copyWith(color: c.textSecondary),
                            ),
                          ],
                          const Gap(AppSpacing.xxs),
                          Text(
                            [humanise(entry.actor), fmtDateTime(entry.at)]
                                .where((s) => s.isNotEmpty)
                                .join(" · "),
                            style: text.labelSmall?.copyWith(color: c.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

/// Wraps a non-scrolling widget so pull-to-refresh still works on empty/error.
class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        );
      },
    );
  }
}
