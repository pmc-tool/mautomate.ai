import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/domains_list_controller.dart";
import "../data/domain_models.dart";
import "../data/domains_repository.dart";
import "connect_domain_screen.dart";
import "dns_records_screen.dart";
import "domain_search_screen.dart";
import "widgets/dns_instructions_card.dart";

/// Domains hub: the store's current domains (free subdomain + connected /
/// registered) with their live verification + SSL state, plus entry points to
/// connect a domain the merchant owns or find and register a new one.
///
/// Class name + const constructor are kept stable for the router.
class DomainsScreen extends ConsumerWidget {
  const DomainsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(domainsListControllerProvider);
    final controller = ref.read(domainsListControllerProvider.notifier);

    return AppScaffold(
      title: "Domains",
      body: _body(context, ref, state, controller),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    DomainsListState state,
    DomainsListController controller,
  ) {
    if (state.loading) {
      return const SkeletonList(itemCount: 4);
    }
    if (state.error != null) {
      return ErrorStateView(
        message: state.error!.message,
        onRetry: controller.retry,
      );
    }

    return RefreshIndicator(
      color: context.colors.accent,
      onRefresh: controller.refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
        children: [
          const Gap(AppSpacing.sm),
          const _SectionPad(
            child: SectionHeader(
              title: "Your domains",
              subtitle: "Where your store can be reached.",
            ),
          ),
          if (state.domains.isEmpty)
            const _SectionPad(
              child: EmptyState(
                compact: true,
                icon: null,
                title: "No domains yet",
                message: "Connect a domain you own or register a new one below.",
              ),
            )
          else
            for (final d in state.domains)
              _SectionPad(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: _DomainCard(domain: d),
                ),
              ),
          const Gap(AppSpacing.md),
          const _SectionPad(
            child: SectionHeader(
              title: "Add a domain",
              subtitle: "Use a domain you own, or find a new one.",
            ),
          ),
          _SectionPad(
            child: AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListRowTile(
                    icon: PhosphorIcons.linkSimple(),
                    title: "Connect a domain I own",
                    subtitle: "Point an existing domain at your store",
                    onTap: () => _open(context, const ConnectDomainScreen()),
                  ),
                  Divider(height: 1, color: context.colors.border),
                  ListRowTile(
                    icon: PhosphorIcons.magnifyingGlass(),
                    title: "Find a new domain",
                    subtitle: "Search availability and register",
                    onTap: () => _open(context, const DomainSearchScreen()),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }
}

/// Standard horizontal screen padding wrapper for a stacked column child.
class _SectionPad extends StatelessWidget {
  const _SectionPad({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(padding: AppSpacing.screenH, child: child);
  }
}

/// A single domain: its address, type, primary flag, verification + SSL chips,
/// and — for a still-pending custom domain — the DNS steps and an inline
/// "Check status" action. Registrar-managed domains link to their DNS records;
/// custom domains can be disconnected.
class _DomainCard extends ConsumerStatefulWidget {
  const _DomainCard({required this.domain});

  final Domain domain;

  @override
  ConsumerState<_DomainCard> createState() => _DomainCardState();
}

class _DomainCardState extends ConsumerState<_DomainCard> {
  bool _showSteps = false;
  bool _verifying = false;
  bool _disconnecting = false;

  DomainsRepository get _repo => ref.read(domainsRepositoryProvider);

  bool get _isFree => widget.domain.type == "free";

  bool get _isVerified =>
      widget.domain.verificationStatus.toLowerCase() == "verified" ||
      widget.domain.verificationStatus.toLowerCase() == "active";

  Future<void> _verify() async {
    setState(() => _verifying = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await _repo.verify(widget.domain.id);
      await ref.read(domainsListControllerProvider.notifier).reload();
      if (!mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(
              res.pending
                  ? "Still propagating — check again shortly."
                  : "Verified. SSL is finishing up.",
            ),
          ),
        );
    } on ApiError catch (e) {
      if (!mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.dangerSolid,
          ),
        );
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _disconnect() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) {
        final c = dialogCtx.colors;
        return AlertDialog(
          backgroundColor: c.surface,
          title: Text("Disconnect ${widget.domain.domain}?"),
          content: Text(
            "Your store will stop serving on this domain. You can reconnect it "
            "again later.",
            style: TextStyle(color: c.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(false),
              child: const Text("Cancel"),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.dangerSolid,
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.of(dialogCtx).pop(true),
              child: const Text("Disconnect"),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) return;

    setState(() => _disconnecting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _repo.disconnect(widget.domain.id);
      await ref.read(domainsListControllerProvider.notifier).reload();
    } on ApiError catch (e) {
      if (!mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.dangerSolid,
          ),
        );
    } finally {
      if (mounted) setState(() => _disconnecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final d = widget.domain;
    final hasSteps = d.instructions.isNotEmpty;
    final showSetup = !_isFree && !_isVerified;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: c.surfaceMuted,
                  borderRadius: AppRadius.smAll,
                ),
                child: Icon(
                  _isFree ? PhosphorIcons.houseLine() : PhosphorIcons.globe(),
                  size: 18,
                  color: c.textSecondary,
                ),
              ),
              const Gap(AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      d.domain,
                      style: text.titleSmall?.copyWith(color: c.textPrimary),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Gap(AppSpacing.xxs),
                    Text(
                      _isFree
                          ? "Free mAutomate address"
                          : d.registrarManaged
                              ? "Registered with mAutomate"
                              : "Connected domain",
                      style: text.labelSmall?.copyWith(color: c.textMuted),
                    ),
                  ],
                ),
              ),
              if (d.isPrimary)
                StatusChip.custom(
                  label: "Primary",
                  tone: StatusTone.info,
                  icon: PhosphorIcons.star(),
                ),
            ],
          ),
          const Gap(AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (!_isFree)
                StatusChip(status: d.verificationStatus),
              StatusChip.custom(
                label: "SSL ${d.sslStatus.isEmpty ? "—" : d.sslStatus}",
                tone: (d.sslStatus.toLowerCase() == "active" ||
                        d.sslStatus.toLowerCase() == "issued" ||
                        _isFree)
                    ? StatusTone.success
                    : StatusTone.pending,
              ),
            ],
          ),
          if (showSetup && hasSteps) ...[
            const Gap(AppSpacing.md),
            GhostButton(
              label: _showSteps ? "Hide setup steps" : "Show setup steps",
              icon: _showSteps
                  ? PhosphorIcons.caretUp()
                  : PhosphorIcons.caretDown(),
              size: AppButtonSize.small,
              onPressed: () => setState(() => _showSteps = !_showSteps),
            ),
            if (_showSteps) ...[
              const Gap(AppSpacing.sm),
              DnsInstructionsCard(instructions: d.instructions),
            ],
          ],
          if (showSetup) ...[
            const Gap(AppSpacing.md),
            SecondaryButton(
              label: "Check status",
              icon: PhosphorIcons.arrowClockwise(),
              fullWidth: true,
              isLoading: _verifying,
              onPressed: _verifying ? null : _verify,
            ),
          ],
          if (!_isFree) ...[
            const Gap(AppSpacing.sm),
            Row(
              children: [
                if (d.registrarManaged)
                  Expanded(
                    child: GhostButton(
                      label: "DNS records",
                      icon: PhosphorIcons.listBullets(),
                      size: AppButtonSize.small,
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => DnsRecordsScreen(domain: d.domain),
                        ),
                      ),
                    ),
                  ),
                if (d.registrarManaged) const Gap(AppSpacing.sm),
                Expanded(
                  child: GhostButton(
                    label: "Disconnect",
                    icon: PhosphorIcons.linkBreak(),
                    size: AppButtonSize.small,
                    destructive: true,
                    isLoading: _disconnecting,
                    onPressed: _disconnecting ? null : _disconnect,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
