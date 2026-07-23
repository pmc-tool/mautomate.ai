import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/domain_search_controller.dart";
import "../application/domains_list_controller.dart";
import "../data/domain_models.dart";
import "../data/domains_repository.dart";
import "package:mautomate_merchant/core/util/open_url.dart";

/// "Find a new domain" — search availability across TLDs and, when the registrar
/// is configured, register one. Buying is a PURCHASE: it is always gated behind
/// an explicit confirm dialog, and the SERVER enforces entitlement, availability
/// and payment (the app only asks; the charge happens server-side).
class DomainSearchScreen extends ConsumerStatefulWidget {
  const DomainSearchScreen({super.key});

  @override
  ConsumerState<DomainSearchScreen> createState() => _DomainSearchScreenState();
}

class _DomainSearchScreenState extends ConsumerState<DomainSearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    ref.read(domainSearchControllerProvider.notifier).search(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(domainSearchControllerProvider);
    final controller = ref.read(domainSearchControllerProvider.notifier);

    return AppScaffold(
      title: "Find a domain",
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: AppTextField(
              controller: _controller,
              hint: "Search a name, e.g. yourbrand",
              prefixIcon: PhosphorIcons.magnifyingGlass(),
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _submit(),
              suffix: IconButton(
                icon: Icon(PhosphorIcons.arrowRight()),
                tooltip: "Search",
                onPressed: _submit,
              ),
            ),
          ),
          if (state.configured == false)
            const Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: _EstimateNotice(),
            ),
          Expanded(child: _body(context, state, controller)),
        ],
      ),
    );
  }

  Widget _body(
    BuildContext context,
    DomainSearchState state,
    DomainSearchController controller,
  ) {
    if (state.idle) {
      return const EmptyState(
        icon: null,
        title: "Search for your domain",
        message:
            "Type a name to see which addresses are available and what they cost.",
      );
    }
    if (state.loading) {
      return const SkeletonList(itemCount: 6);
    }
    if (state.error != null) {
      return ErrorStateView(
        message: state.error!.message,
        onRetry: controller.retry,
      );
    }
    if (state.isEmpty) {
      return EmptyState(
        icon: PhosphorIcons.magnifyingGlass(),
        title: "No results",
        message: "We couldn't find suggestions for “${state.query}”. "
            "Try a different name.",
      );
    }

    final results = state.results;
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      itemCount: results.length,
      separatorBuilder: (_, __) => Divider(
        height: 1,
        thickness: 1,
        indent: AppSpacing.lg,
        endIndent: AppSpacing.lg,
        color: context.colors.border,
      ),
      itemBuilder: (context, index) => _ResultRow(
        result: results[index],
        registrarConfigured: state.configured ?? false,
      ),
    );
  }
}

class _EstimateNotice extends StatelessWidget {
  const _EstimateNotice();

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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(PhosphorIcons.info(), size: 18, color: c.warning),
          const Gap(AppSpacing.sm),
          Expanded(
            child: Text(
              "Live pricing isn't switched on yet, so the prices shown are "
              "estimates until it is.",
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.warning),
            ),
          ),
        ],
      ),
    );
  }
}

/// A single availability row: the domain, an available/taken chip, its price and
/// (when available) a Register action.
class _ResultRow extends ConsumerWidget {
  const _ResultRow({required this.result, required this.registrarConfigured});

  final DomainSearchResult result;
  final bool registrarConfigured;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final price = result.price;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        result.domain,
                        style: text.titleSmall?.copyWith(color: c.textPrimary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (result.isPremium) ...[
                      const Gap(AppSpacing.sm),
                      StatusChip.custom(
                        label: "Premium",
                        tone: StatusTone.info,
                      ),
                    ],
                  ],
                ),
                const Gap(AppSpacing.xs),
                Row(
                  children: [
                    StatusChip.custom(
                      label: result.available ? "Available" : "Taken",
                      tone: result.available
                          ? StatusTone.success
                          : StatusTone.neutral,
                    ),
                    if (price != null && result.available) ...[
                      const Gap(AppSpacing.sm),
                      MoneyText(
                        amount: price.register,
                        currencyCode: price.currency,
                        style: text.bodySmall
                            ?.copyWith(color: c.textSecondary),
                      ),
                      Text(
                        " / yr",
                        style: text.bodySmall?.copyWith(color: c.textMuted),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (result.available) ...[
            const Gap(AppSpacing.md),
            SecondaryButton(
              label: "Register",
              size: AppButtonSize.small,
              onPressed: () => _confirmBuy(context, ref),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmBuy(BuildContext context, WidgetRef ref) async {
    final price = result.price;
    final priceLine = price != null
        ? "${price.currency} ${price.register.toStringAsFixed(2)} for the first year"
        : "the listed price";
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) {
        final c = dialogCtx.colors;
        return AlertDialog(
          backgroundColor: c.surface,
          title: Text("Register ${result.domain}?"),
          content: Text(
            registrarConfigured
                ? "This starts a secure card checkout to register "
                    "${result.domain} for $priceLine. Auto-renew and privacy "
                    "are on, and the domain is registered as soon as your "
                    "payment clears."
                : "Live pricing isn't switched on yet, so the amount shown is "
                    "an estimate. You'll be taken to a secure checkout to "
                    "register ${result.domain}.",
            style: TextStyle(color: c.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(false),
              child: const Text("Cancel"),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: c.accent,
                foregroundColor: c.onAccent,
              ),
              onPressed: () => Navigator.of(dialogCtx).pop(true),
              child: const Text("Continue to payment"),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !context.mounted) return;
    await _runBuy(context, ref);
  }

  Future<void> _runBuy(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text("Starting checkout for ${result.domain}…")),
      );
    try {
      final res = await ref
          .read(domainsRepositoryProvider)
          .buy(domainName: result.domain);
      ref.read(domainsListControllerProvider.notifier).reload();
      if (!context.mounted) return;
      messenger.hideCurrentSnackBar();

      final checkoutUrl = res.checkoutUrl;
      if (res.awaitingPayment &&
          checkoutUrl != null &&
          checkoutUrl.isNotEmpty) {
        // A domain is paid by card: the registrar only registers it once the
        // payment webhook confirms. Send the merchant to checkout and never
        // imply the domain is registered before the money has arrived.
        await openExternalUrl(context, checkoutUrl);
        if (!context.mounted) return;
        await showDialog<void>(
          context: context,
          builder: (dialogCtx) {
            final c = dialogCtx.colors;
            return AlertDialog(
              backgroundColor: c.surface,
              title: const Text("Complete your payment"),
              content: Text(
                "Complete payment to register ${result.domain}. We opened the "
                "secure checkout in your browser — once your payment clears, "
                "the domain is registered and connected to your store "
                "automatically.",
                style: TextStyle(color: c.textSecondary),
              ),
              actions: [
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: c.onPrimary,
                  ),
                  onPressed: () => Navigator.of(dialogCtx).pop(),
                  child: const Text("Done"),
                ),
              ],
            );
          },
        );
        return;
      }

      // No checkout link came back — the server couldn't start payment. Say so
      // plainly rather than implying the domain was registered.
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            "Couldn't start checkout for ${result.domain}. Please try again.",
          ),
          backgroundColor: AppColors.dangerSolid,
        ),
      );
    } on ApiError catch (e) {
      if (!context.mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.dangerSolid,
          ),
        );
    }
  }
}
