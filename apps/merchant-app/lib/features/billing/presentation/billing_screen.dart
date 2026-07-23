import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/theme/theme.dart";
import "../../../core/util/open_url.dart";
import "../../../core/widgets/widgets.dart";
import "../application/billing_controller.dart";
import "../data/billing_models.dart";

/// Billing — the merchant's plan, AI credit wallet, monthly allowance, per-
/// feature usage, purchasable credit packs and credit history. Replaces the
/// Wave-A placeholder in place (class name + const constructor are stable).
///
/// Buying a pack and changing a plan both run through the server, which
/// enforces payment: when a browser checkout is required we surface the link
/// honestly (copy + open-in-browser); when a gateway isn't live yet, or a plan
/// change applies immediately, we show the backend's own explanation.
class BillingScreen extends ConsumerWidget {
  const BillingScreen({super.key});

  static final NumberFormat _nf = NumberFormat.decimalPattern();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<BillingState>(billingControllerProvider, (prev, next) {
      final event = next.event;
      if (event != null && event != prev?.event) {
        _handleEvent(context, ref, event);
        ref.read(billingControllerProvider.notifier).clearEvent();
      }
    });

    final state = ref.watch(billingControllerProvider);
    final controller = ref.read(billingControllerProvider.notifier);

    return AppScaffold(
      title: "Billing",
      onRefresh: controller.refresh,
      body: _buildBody(context, state, controller),
    );
  }

  Widget _buildBody(
    BuildContext context,
    BillingState state,
    BillingController controller,
  ) {
    if (state.isLoading && state.overview == null) {
      return const _BillingSkeleton();
    }
    if (state.error != null && state.overview == null) {
      return ErrorStateView(
        message: state.error!.message,
        onRetry: controller.retry,
      );
    }
    final ov = state.overview;
    if (ov == null) {
      return EmptyState(
        icon: PhosphorIcons.creditCard(),
        title: "Billing isn't available yet",
        message: "Your plan and credit details will appear here shortly.",
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: AppSpacing.screen,
      children: [
        if (!ov.gateway.configured) ...[
          const _GatewayBanner(),
          const Gap(AppSpacing.lg),
        ],
        _BalanceHero(overview: ov),
        const Gap(AppSpacing.lg),
        _CurrentPlanCard(overview: ov),
        const Gap(AppSpacing.lg),
        _CreditsCard(state: state, controller: controller),
        const Gap(AppSpacing.lg),
        _UsageCard(overview: ov),
        const Gap(AppSpacing.lg),
        _PlansCard(state: state, controller: controller),
        const Gap(AppSpacing.lg),
        _HistoryCard(state: state, controller: controller),
        const Gap(AppSpacing.xl),
      ],
    );
  }

  void _handleEvent(BuildContext context, WidgetRef ref, BillingEvent event) {
    if (event.checkoutUrl != null) {
      _showCheckoutSheet(context, event.checkoutUrl!);
      return;
    }
    final message = event.error ?? event.notice;
    if (message == null) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: event.error != null ? AppColors.dangerSolid : null,
          duration: const Duration(seconds: 5),
        ),
      );
  }

  Future<void> _showCheckoutSheet(BuildContext context, String url) async {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: c.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: AppSpacing.screen,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(PhosphorIcons.lockKey(), size: 20, color: c.accent),
                  const Gap(AppSpacing.sm),
                  Text("Finish your purchase", style: text.titleMedium),
                ],
              ),
              const Gap(AppSpacing.sm),
              Text(
                "Complete payment securely in your browser, then pull down to "
                "refresh your balance.",
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
              const Gap(AppSpacing.lg),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: c.surfaceMuted,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Text(
                  url,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ),
              const Gap(AppSpacing.lg),
              PrimaryButton(
                label: "Open in browser",
                icon: PhosphorIcons.arrowSquareOut(),
                fullWidth: true,
                onPressed: () async {
                  if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                  await openExternalUrl(context, url);
                },
              ),
              const Gap(AppSpacing.sm),
              SecondaryButton(
                label: "Copy payment link",
                icon: PhosphorIcons.copy(),
                fullWidth: true,
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: url));
                  if (sheetContext.mounted) {
                    Navigator.of(sheetContext).pop();
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(
                        const SnackBar(
                          content: Text(
                            "Payment link copied — open it in your browser.",
                          ),
                        ),
                      );
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _fmt(num n) => BillingScreen._nf.format(n.round());

// --------------------------------------------------------------------------
// Gateway banner
// --------------------------------------------------------------------------

class _GatewayBanner extends StatelessWidget {
  const _GatewayBanner();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.warningBg,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: c.warningBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.info(), size: 20, color: c.warning),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Card payments are being set up",
                  style: text.titleSmall?.copyWith(color: c.textPrimary),
                ),
                const Gap(AppSpacing.xxs),
                Text(
                  "You can change your plan anytime — upgrades take effect "
                  "immediately at no charge until card billing goes live. Your "
                  "balance and usage are tracked accurately.",
                  style: text.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Balance hero
// --------------------------------------------------------------------------

class _BalanceHero extends StatelessWidget {
  const _BalanceHero({required this.overview});

  final BillingOverview overview;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final total = overview.credits?.total ?? overview.wallet.balance;
    final expiring = overview.credits?.expiring ?? 0;
    final purchased = overview.credits?.purchased ?? 0;
    final reserved = overview.wallet.reserved;
    final allowance = overview.allowance;

    return AppCard(
      color: c.primary,
      borderColor: c.primary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "AVAILABLE AI CREDITS",
            style: text.labelSmall?.copyWith(
              color: c.onPrimary.withValues(alpha: 0.6),
              letterSpacing: 1.2,
            ),
          ),
          const Gap(AppSpacing.xs),
          Text(
            _fmt(total),
            style: text.displaySmall?.copyWith(
              color: c.onPrimary,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (reserved > 0) ...[
            const Gap(AppSpacing.xxs),
            Text(
              "${_fmt(reserved)} credits on hold",
              style: text.bodySmall?.copyWith(
                color: c.onPrimary.withValues(alpha: 0.6),
              ),
            ),
          ],
          if (expiring > 0 || purchased > 0) ...[
            const Gap(AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                if (expiring > 0)
                  _HeroChip(
                    color: c.warning,
                    label: overview.credits?.nextExpiry != null
                        ? "${_fmt(expiring)} plan credits · expire ${_shortDate(overview.credits!.nextExpiry!)}"
                        : "${_fmt(expiring)} plan credits",
                  ),
                if (purchased > 0)
                  _HeroChip(
                    color: c.success,
                    label: "${_fmt(purchased)} purchased · never expire",
                  ),
              ],
            ),
          ],
          if (allowance.included > 0) ...[
            const Gap(AppSpacing.lg),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Monthly allowance",
                  style: text.bodySmall?.copyWith(
                    color: c.onPrimary.withValues(alpha: 0.6),
                  ),
                ),
                Text(
                  "${_fmt(allowance.usedThisCycle)} / ${_fmt(allowance.included)} used",
                  style: text.bodySmall?.copyWith(
                    color: c.onPrimary.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
            const Gap(AppSpacing.sm),
            ClipRRect(
              borderRadius: const BorderRadius.all(Radius.circular(4)),
              child: LinearProgressIndicator(
                value: allowance.included <= 0
                    ? 0
                    : (allowance.usedThisCycle / allowance.included)
                        .clamp(0, 1)
                        .toDouble(),
                minHeight: 8,
                backgroundColor: c.onPrimary.withValues(alpha: 0.15),
                valueColor: AlwaysStoppedAnimation(c.onPrimary),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const Gap(AppSpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: c.onPrimary,
                ),
          ),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Current plan
// --------------------------------------------------------------------------

class _CurrentPlanCard extends StatelessWidget {
  const _CurrentPlanCard({required this.overview});

  final BillingOverview overview;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final plan = overview.currentPlan;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Your plan",
            subtitle: "Subscription tier and what it includes.",
            icon: PhosphorIcons.identificationBadge(),
          ),
          const Gap(AppSpacing.lg),
          if (plan == null)
            Text(
              "No active plan.",
              style: text.bodyMedium?.copyWith(color: c.textSecondary),
            )
          else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(plan.name, style: text.headlineSmall),
                      const Gap(AppSpacing.xxs),
                      Text(
                        "${plan.priceUsd > 0 ? "${MoneyText.format(plan.priceUsd, "usd")}/mo" : "Free"} · ${_fmt(plan.includedCredits)} credits/mo included",
                        style: text.bodySmall?.copyWith(color: c.textSecondary),
                      ),
                    ],
                  ),
                ),
                const Gap(AppSpacing.sm),
                StatusChip(status: overview.planStatus),
              ],
            ),
            if (overview.trialEndsAt != null) ...[
              const Gap(AppSpacing.md),
              Text(
                "Trial ends ${_shortDate(overview.trialEndsAt!)}",
                style: text.bodySmall?.copyWith(color: c.textMuted),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Credits + packs
// --------------------------------------------------------------------------

class _CreditsCard extends StatelessWidget {
  const _CreditsCard({required this.state, required this.controller});

  final BillingState state;
  final BillingController controller;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final ov = state.overview!;
    final balance = ov.wallet.balance;
    final lowBalance = balance < 100;
    final packs = ov.packs;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "AI credits",
            subtitle: "Spent on AI calls, content, chatbot and SMS.",
            icon: PhosphorIcons.sparkle(),
          ),
          const Gap(AppSpacing.lg),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _fmt(balance),
                style: text.headlineMedium?.copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const Gap(AppSpacing.xs),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  "credits",
                  style: text.bodyMedium?.copyWith(color: c.textSecondary),
                ),
              ),
              const Spacer(),
              if (ov.wallet.reserved > 0)
                Text(
                  "${_fmt(ov.wallet.reserved)} reserved",
                  style: text.bodySmall?.copyWith(color: c.textMuted),
                ),
            ],
          ),
          if (lowBalance) ...[
            const Gap(AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: c.warningBg,
                borderRadius: AppRadius.smAll,
                border: Border.all(color: c.warningBorder),
              ),
              child: Row(
                children: [
                  Icon(PhosphorIcons.warning(), size: 16, color: c.warning),
                  const Gap(AppSpacing.sm),
                  Expanded(
                    child: Text(
                      "Your balance is low — top up so AI calls, posts and "
                      "chatbot replies keep running.",
                      style: text.bodySmall?.copyWith(color: c.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (packs.isNotEmpty) ...[
            const Gap(AppSpacing.lg),
            Text(
              "Buy credits",
              style: text.labelMedium?.copyWith(color: c.textSecondary),
            ),
            const Gap(AppSpacing.sm),
            LayoutBuilder(
              builder: (context, constraints) {
                const spacing = AppSpacing.sm;
                final width = (constraints.maxWidth - spacing) / 2;
                return Wrap(
                  spacing: spacing,
                  runSpacing: spacing,
                  children: [
                    for (var i = 0; i < packs.length; i++)
                      SizedBox(
                        width: width,
                        child: _PackTile(
                          pack: packs[i],
                          busy: state.busyPackIndex == i,
                          disabled: state.busyPackIndex != null,
                          onTap: () => _confirmBuy(context, i, packs[i]),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmBuy(
    BuildContext context,
    int index,
    BillingPack pack,
  ) async {
    final ok = await _confirm(
      context,
      title: "Buy ${_fmt(pack.credits)} credits?",
      message:
          "You'll be charged ${MoneyText.format(pack.amountUsd, "usd")} to add ${_fmt(pack.credits)} credits to your wallet. Payment is completed securely and your card is only charged once you confirm.",
      confirmLabel: "Continue",
    );
    if (ok) controller.buyPack(index);
  }
}

class _PackTile extends StatelessWidget {
  const _PackTile({
    required this.pack,
    required this.busy,
    required this.disabled,
    required this.onTap,
  });

  final BillingPack pack;
  final bool busy;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: disabled ? null : onTap,
      color: c.surfaceMuted,
      borderColor: c.border,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: SizedBox(
        height: 52,
        child: busy
            ? const Center(
                child: SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    "${_fmt(pack.credits)} credits",
                    style: text.titleSmall,
                  ),
                  const Gap(AppSpacing.xxs),
                  Row(
                    children: [
                      MoneyText(
                        amount: pack.amountUsd,
                        currencyCode: "usd",
                        style: text.bodySmall,
                        color: c.textSecondary,
                      ),
                      if (pack.bonusPct > 0) ...[
                        const Gap(AppSpacing.xs),
                        Text(
                          "+${_fmt(pack.bonusPct)}%",
                          style: text.labelSmall?.copyWith(color: c.success),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Usage
// --------------------------------------------------------------------------

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.overview});

  final BillingOverview overview;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final usage = overview.usage;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Usage this cycle",
            subtitle: "Credits consumed per feature this month.",
            icon: PhosphorIcons.chartBar(),
          ),
          const Gap(AppSpacing.md),
          if (usage.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Text(
                "No AI usage yet this month.",
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
            )
          else
            ...usage.map((u) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(u.label, style: text.bodyMedium),
                      ),
                      Text(
                        "${_fmt(u.units)} · ",
                        style: text.bodySmall?.copyWith(color: c.textMuted),
                      ),
                      Text(
                        "${_fmt(u.credits)} cr",
                        style: text.bodyMedium?.copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Plans
// --------------------------------------------------------------------------

class _PlansCard extends StatelessWidget {
  const _PlansCard({required this.state, required this.controller});

  final BillingState state;
  final BillingController controller;

  @override
  Widget build(BuildContext context) {
    final ov = state.overview!;
    final plans = ov.plans;
    final currentKey = ov.currentPlan?.key;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Plans",
            subtitle: "Upgrade or downgrade your subscription.",
            icon: PhosphorIcons.stack(),
          ),
          const Gap(AppSpacing.lg),
          if (plans.isEmpty)
            const EmptyState(
              compact: true,
              title: "No plans available",
              message: "Subscription plans will appear here soon.",
            )
          else
            ...plans.map((p) {
              final isCurrent = p.key == currentKey;
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: _PlanTile(
                  plan: p,
                  isCurrent: isCurrent,
                  busy: state.busyPlanKey == p.key,
                  disabled: state.busyPlanKey != null,
                  onChoose: () => _confirmChange(context, p),
                ),
              );
            }),
        ],
      ),
    );
  }

  Future<void> _confirmChange(BuildContext context, BillingPlan plan) async {
    final ok = await _confirm(
      context,
      title: "Switch to ${plan.name}?",
      message: plan.priceUsd > 0
          ? "You'll move to ${plan.name} at ${MoneyText.format(plan.priceUsd, "usd")}/mo. Card billing may open in your browser to confirm."
          : "You'll move to the free ${plan.name} plan.",
      confirmLabel: "Switch plan",
    );
    if (ok) controller.changePlan(plan.key);
  }
}

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.plan,
    required this.isCurrent,
    required this.busy,
    required this.disabled,
    required this.onChoose,
  });

  final BillingPlan plan;
  final bool isCurrent;
  final bool busy;
  final bool disabled;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    final features = <String>[
      "${_fmt(plan.includedCredits)} AI credits / month",
      if (plan.productsLimit != null) "${_fmt(plan.productsLimit!)} products",
      if (plan.seatsLimit != null) "${_fmt(plan.seatsLimit!)} staff seats",
      if (plan.domainsLimit != null) "${_fmt(plan.domainsLimit!)} custom domains",
    ];

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isCurrent ? c.surfaceMuted : c.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: isCurrent ? c.borderStrong : c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(plan.name, style: text.titleSmall)),
              if (isCurrent)
                const StatusChip.custom(
                  label: "Current",
                  tone: StatusTone.success,
                ),
            ],
          ),
          const Gap(AppSpacing.xs),
          Text(
            plan.priceUsd > 0
                ? "${MoneyText.format(plan.priceUsd, "usd")}/mo"
                : "Free",
            style: text.headlineSmall,
          ),
          const Gap(AppSpacing.sm),
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
                child: Row(
                  children: [
                    Icon(PhosphorIcons.check(), size: 14, color: c.textMuted),
                    const Gap(AppSpacing.xs),
                    Expanded(
                      child: Text(
                        f,
                        style: text.bodySmall?.copyWith(color: c.textSecondary),
                      ),
                    ),
                  ],
                ),
              )),
          const Gap(AppSpacing.md),
          if (isCurrent)
            SecondaryButton(
              label: "Current plan",
              fullWidth: true,
              onPressed: null,
            )
          else
            PrimaryButton(
              label: "Choose ${plan.name}",
              fullWidth: true,
              isLoading: busy,
              onPressed: disabled ? null : onChoose,
            ),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Credit history
// --------------------------------------------------------------------------

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.state, required this.controller});

  final BillingState state;
  final BillingController controller;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final credits = state.credits;
    final txns = credits?.transactions ?? const <CreditTransaction>[];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: "Credit history",
            subtitle: "Top-ups, grants and metered spend.",
            icon: PhosphorIcons.receipt(),
          ),
          const Gap(AppSpacing.md),
          if (txns.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Text(
                "No transactions yet.",
                style: text.bodyMedium?.copyWith(color: c.textSecondary),
              ),
            )
          else ...[
            ...txns.map((t) => _HistoryRow(txn: t)),
            if (state.hasMoreHistory) ...[
              const Gap(AppSpacing.sm),
              SecondaryButton(
                label: "Load more",
                fullWidth: true,
                size: AppButtonSize.small,
                isLoading: state.loadingMoreHistory,
                onPressed: controller.loadMoreHistory,
              ),
            ],
            if ((credits?.count ?? 0) > 0) ...[
              const Gap(AppSpacing.sm),
              Center(
                child: Text(
                  "Showing ${txns.length} of ${credits!.count}",
                  style: text.bodySmall?.copyWith(color: c.textMuted),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.txn});

  final CreditTransaction txn;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final positive = txn.amount >= 0;
    final label = txn.label ?? txn.type ?? "Activity";

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodyMedium,
                ),
                const Gap(AppSpacing.xxs),
                Text(
                  _shortDate(txn.createdAt),
                  style: text.bodySmall?.copyWith(color: c.textMuted),
                ),
              ],
            ),
          ),
          const Gap(AppSpacing.md),
          Text(
            "${positive ? "+" : ""}${_fmt(txn.amount)}",
            style: text.titleSmall?.copyWith(
              color: positive ? c.success : c.textPrimary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------

String _shortDate(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return "";
  return DateFormat.yMMMd().format(dt.toLocal());
}

Future<bool> _confirm(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
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

// --------------------------------------------------------------------------
// Skeleton
// --------------------------------------------------------------------------

class _BillingSkeleton extends StatelessWidget {
  const _BillingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: AppSpacing.screen,
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              SkeletonLoader(height: 12, width: 120),
              Gap(AppSpacing.md),
              SkeletonLoader(height: 40, width: 180),
              Gap(AppSpacing.lg),
              SkeletonLoader(height: 8),
            ],
          ),
        ),
        const Gap(AppSpacing.lg),
        ...List.generate(2, (i) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonLoader(height: 18, width: 140),
                  Gap(AppSpacing.sm),
                  SkeletonLoader(height: 12, width: 220),
                  Gap(AppSpacing.lg),
                  SkeletonLoader(height: 44),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
