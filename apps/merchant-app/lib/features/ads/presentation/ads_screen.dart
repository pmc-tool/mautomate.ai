import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/ads_overview_controller.dart";
import "../data/ads_models.dart";
import "ads_campaign_detail_screen.dart";
import "ads_connect_screen.dart";
import "ads_create_campaign_screen.dart";
import "ads_format.dart";

/// Advertising — Overview. Cross-platform ad performance for this store: spend,
/// impressions, clicks, purchases and ROAS over a selectable window, a daily
/// spend strip, and the campaign list. Every figure is aggregated from insight
/// rows the ad platform actually returned — an unconnected or empty store shows
/// an honest empty state, never sample numbers.
///
/// Spend is real platform money billed to the merchant's own ad account (their
/// card at Meta/Google) — it is shown in the ad account's currency and is NOT
/// the mAutomate credits system.
///
/// This is the routed surface (`/ads`, class name + const ctor stable). The
/// connect flow, campaign detail and create wizard push on top of it.
class AdsScreen extends ConsumerWidget {
  const AdsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Surface a transient sync/refresh error (data already on screen) as a
    // snackbar rather than replacing the whole screen with an error state.
    ref.listen<AdsOverviewState>(adsOverviewControllerProvider, (prev, next) {
      final err = next.error;
      if (err != null && next.overview != null && prev?.error != err) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(err.message)));
      }
    });

    final state = ref.watch(adsOverviewControllerProvider);
    final controller = ref.read(adsOverviewControllerProvider.notifier);

    return AppScaffold(
      title: "Advertising",
      onRefresh: controller.refresh,
      actions: [
        if (state.hasConnection)
          IconButton(
            icon: Icon(PhosphorIcons.plus()),
            tooltip: "New campaign",
            onPressed: () => _openCreate(context),
          ),
      ],
      body: _content(context, ref, state, controller),
    );
  }

  Future<void> _openCreate(BuildContext context) async {
    final created = await Navigator.of(context).push<bool>(
      AdsCreateCampaignScreen.route(),
    );
    if (created == true && context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              "Campaign created and paused. Open it to review, then launch.",
            ),
          ),
        );
    }
  }

  Widget _content(
    BuildContext context,
    WidgetRef ref,
    AdsOverviewState state,
    AdsOverviewController controller,
  ) {
    if (state.isLoading && state.overview == null) {
      return const SingleChildScrollView(
        physics: AlwaysScrollableScrollPhysics(),
        child: Padding(
          padding: AppSpacing.screen,
          child: _OverviewSkeleton(),
        ),
      );
    }

    if (state.error != null && state.overview == null) {
      return _Scrollable(
        child: ErrorStateView(
          message: state.error!.message,
          onRetry: controller.retry,
        ),
      );
    }

    if (!state.hasConnection) {
      return _Scrollable(
        child: EmptyState(
          icon: PhosphorIcons.megaphone(),
          title: "No ad account connected yet",
          message:
              "Connect your Meta ad account and your campaigns, spend and "
              "results show up here — no more switching to Ads Manager.",
          action: PrimaryButton(
            label: "Connect an ad account",
            icon: PhosphorIcons.plugsConnected(),
            onPressed: () => _openConnect(context),
          ),
        ),
      );
    }

    final overview = state.overview!;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        _WindowAndSync(state: state, controller: controller),
        const Gap(AppSpacing.lg),
        _KpiGrid(totals: overview.totals),
        if (overview.daily.isNotEmpty) ...[
          const Gap(AppSpacing.lg),
          _SpendCard(overview: overview),
        ],
        const Gap(AppSpacing.lg),
        _CampaignsCard(overview: overview),
        const Gap(AppSpacing.lg),
        _ManageRow(onConnect: () => _openConnect(context)),
      ],
    );
  }

  Future<void> _openConnect(BuildContext context) =>
      Navigator.of(context).push(AdsConnectScreen.route());
}

// --- Window selector + sync -------------------------------------------------

class _WindowAndSync extends StatelessWidget {
  const _WindowAndSync({required this.state, required this.controller});

  final AdsOverviewState state;
  final AdsOverviewController controller;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final ago = syncedAgo(state.overview?.lastSyncedAt);

    return Row(
      children: [
        Expanded(
          child: _WindowSegmented(
            days: state.days,
            onSelected: controller.setWindow,
          ),
        ),
        const Gap(AppSpacing.sm),
        if (ago != null)
          Flexible(
            child: Text(
              "Synced $ago",
              textAlign: TextAlign.right,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.textMuted),
            ),
          ),
        const Gap(AppSpacing.sm),
        SecondaryButton(
          label: "Sync",
          icon: PhosphorIcons.arrowsClockwise(),
          size: AppButtonSize.small,
          isLoading: state.isSyncing,
          onPressed: () => _sync(context),
        ),
      ],
    );
  }

  Future<void> _sync(BuildContext context) async {
    try {
      final summary = await controller.syncNow();
      if (context.mounted && summary != null && summary.errors.isNotEmpty) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text("Sync finished with issues: ${summary.errors.first}"),
            ),
          );
      }
    } catch (_) {
      // The controller stored the error; the screen's listener shows it.
    }
  }
}

class _WindowSegmented extends StatelessWidget {
  const _WindowSegmented({required this.days, required this.onSelected});

  final int days;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: c.border),
      ),
      padding: const EdgeInsets.all(2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: kAdsWindows.map((w) {
          final selected = w == days;
          return Padding(
            padding: const EdgeInsets.only(right: 2),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: AppRadius.smAll,
                onTap: () => onSelected(w),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.xs + 2,
                  ),
                  decoration: BoxDecoration(
                    color: selected ? c.primary : Colors.transparent,
                    borderRadius: AppRadius.smAll,
                  ),
                  child: Text(
                    "${w}d",
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: selected ? c.onPrimary : c.textSecondary,
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w500,
                        ),
                  ),
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

// --- KPI grid ---------------------------------------------------------------

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.totals});

  final AdsTotals totals;

  @override
  Widget build(BuildContext context) {
    final currency = totals.currency ?? "usd";
    final tiles = <Widget>[
      _KpiTile(
        label: "Spend",
        value: MoneyText(
          amount: totals.spend,
          currencyCode: currency,
          strong: true,
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
      _KpiTile(label: "Impressions", value: _num(context, totals.impressions)),
      _KpiTile(label: "Clicks", value: _num(context, totals.clicks)),
      _KpiTile(
        label: "Purchases",
        value: _num(context, totals.conversions),
        hint: totals.conversionValue > 0
            ? "${MoneyText.format(totals.conversionValue, currency)} value"
            : null,
      ),
      _KpiTile(
        label: "ROAS",
        value: Text(
          fmtRoas(totals.roas),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        hint: totals.roas == null ? "Needs purchase tracking" : null,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = AppSpacing.sm;
        final columns = constraints.maxWidth >= 520 ? 3 : 2;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: tiles
              .map((t) => SizedBox(width: width, child: t))
              .toList(growable: false),
        );
      },
    );
  }

  Widget _num(BuildContext context, num v) => Text(
        fmtInt(v),
        style: Theme.of(context).textTheme.titleLarge,
      );
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({required this.label, required this.value, this.hint});

  final String label;
  final Widget value;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: text.labelSmall?.copyWith(color: c.textMuted),
          ),
          const Gap(AppSpacing.xs),
          value,
          if (hint != null) ...[
            const Gap(AppSpacing.xxs),
            Text(
              hint!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.bodySmall?.copyWith(color: c.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Daily spend strip ------------------------------------------------------

class _SpendCard extends StatelessWidget {
  const _SpendCard({required this.overview});

  final AdsOverview overview;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Daily spend",
            subtitle: "Spend per day over the last ${overview.days} days.",
          ),
          const Gap(AppSpacing.md),
          _SpendStrip(
            daily: overview.daily,
            currency: overview.totals.currency,
          ),
        ],
      ),
    );
  }
}

class _SpendStrip extends StatelessWidget {
  const _SpendStrip({required this.daily, required this.currency});

  final List<AdsDailyPoint> daily;
  final String? currency;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final max = daily.fold<double>(
      0.01,
      (m, d) => d.spend.toDouble() > m ? d.spend.toDouble() : m,
    );
    return SizedBox(
      height: 88,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: daily.map((d) {
          final ratio = (d.spend / max).clamp(0.0, 1.0);
          final h = (ratio * 88).clamp(d.spend > 0 ? 4.0 : 1.0, 88.0);
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1.5),
              child: Tooltip(
                message: "${fmtDate(d.date)}: "
                    "${MoneyText.format(d.spend, currency ?? "usd")}",
                child: Container(
                  height: h,
                  decoration: BoxDecoration(
                    color: d.spend > 0 ? c.accent : c.surfaceMuted,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(AppRadius.sm),
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

// --- Campaigns list ---------------------------------------------------------

class _CampaignsCard extends StatelessWidget {
  const _CampaignsCard({required this.overview});

  final AdsOverview overview;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: SectionHeader(
              title: "Campaigns",
              subtitle:
                  "Everything running in your connected ad accounts. Numbers "
                  "cover the selected window.",
            ),
          ),
          if (overview.campaigns.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.md),
              child: EmptyState(
                compact: true,
                icon: null,
                title: "No campaigns yet",
                message:
                    "When your ad account has campaigns they appear here with "
                    "their results. Just connected? Try Sync.",
              ),
            )
          else
            ...List.generate(overview.campaigns.length, (i) {
              final campaign = overview.campaigns[i];
              return Column(
                children: [
                  if (i > 0)
                    Divider(
                      height: 1,
                      thickness: 1,
                      color: c.border,
                      indent: AppSpacing.lg,
                      endIndent: AppSpacing.lg,
                    ),
                  _CampaignRow(campaign: campaign),
                ],
              );
            }),
        ],
      ),
    );
  }
}

class _CampaignRow extends StatelessWidget {
  const _CampaignRow({required this.campaign});

  final AdsCampaignRow campaign;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final objective = fmtObjective(campaign.objective);
    final platform = campaign.platform.isEmpty
        ? ""
        : humanise(campaign.platform);
    final meta = [platform, objective].where((s) => s.isNotEmpty).join(" · ");
    final budget = campaign.dailyBudget != null
        ? "${MoneyText.format(campaign.dailyBudget!, campaign.currency ?? "usd")}/day"
        : campaign.lifetimeBudget != null
            ? MoneyText.format(
                campaign.lifetimeBudget!, campaign.currency ?? "usd")
            : null;

    return ListRowTile(
      title: campaign.name,
      subtitle: meta.isEmpty ? null : meta,
      showChevron: false,
      onTap: () => Navigator.of(context).push(
        AdsCampaignDetailScreen.route(campaign.id, campaign.name),
      ),
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          MoneyText(
            amount: campaign.spend,
            currencyCode: campaign.currency ?? "usd",
            strong: true,
          ),
          const Gap(AppSpacing.xs),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (budget != null) ...[
                Text(
                  budget,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: c.textMuted),
                ),
                const Gap(AppSpacing.sm),
              ],
              StatusChip(status: campaign.status),
            ],
          ),
        ],
      ),
    );
  }
}

// --- Manage row -------------------------------------------------------------

class _ManageRow extends StatelessWidget {
  const _ManageRow({required this.onConnect});

  final VoidCallback onConnect;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: ListRowTile(
        icon: PhosphorIcons.plugsConnected(),
        title: "Ad accounts & connections",
        subtitle: "Connect platforms and pick the account this store uses",
        onTap: onConnect,
      ),
    );
  }
}

// --- Loading + scroll helpers -----------------------------------------------

class _OverviewSkeleton extends StatelessWidget {
  const _OverviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SkeletonBox(width: 140, height: 36),
              const Spacer(),
              SkeletonBox(width: 80, height: 36, borderRadius: AppRadius.mdAll),
            ],
          ),
          const Gap(AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: List.generate(
              4,
              (_) => const SkeletonBox(width: 150, height: 74),
            ),
          ),
          const Gap(AppSpacing.lg),
          const SkeletonBox(
            width: double.infinity,
            height: 140,
            borderRadius: AppRadius.lgAll,
          ),
          const Gap(AppSpacing.lg),
          const SkeletonBox(
            width: double.infinity,
            height: 200,
            borderRadius: AppRadius.lgAll,
          ),
        ],
      ),
    );
  }
}

/// Wraps a non-scrolling widget (empty/error) so pull-to-refresh still works.
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
