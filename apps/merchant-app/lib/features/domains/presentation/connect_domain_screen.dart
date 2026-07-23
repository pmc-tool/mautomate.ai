import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/api/api_error.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/domains_list_controller.dart";
import "../data/domain_models.dart";
import "../data/domains_repository.dart";
import "widgets/dns_instructions_card.dart";

/// Guided "connect a domain I own" flow.
///
/// Two stages, no faked completion:
///   1. Enter the domain -> `POST /merchant/domains` returns the exact DNS /
///      nameserver changes to make at the registrar.
///   2. After the merchant makes those changes, tapping "Check status" calls
///      `POST /merchant/domains/verify` and shows the REAL current state
///      (verified / still pending). SSL + routing take over once DNS propagates.
class ConnectDomainScreen extends ConsumerStatefulWidget {
  const ConnectDomainScreen({super.key});

  @override
  ConsumerState<ConnectDomainScreen> createState() =>
      _ConnectDomainScreenState();
}

class _ConnectDomainScreenState extends ConsumerState<ConnectDomainScreen> {
  final _controller = TextEditingController();

  bool _connecting = false;
  bool _verifying = false;
  ApiError? _error;
  ConnectDomainResponse? _result;
  VerifyDomainResponse? _verifyState;

  DomainsRepository get _repo => ref.read(domainsRepositoryProvider);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    final domain = _controller.text.trim().toLowerCase();
    if (domain.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _connecting = true;
      _error = null;
      _verifyState = null;
    });
    try {
      final res = await _repo.connect(domain);
      if (!mounted) return;
      setState(() {
        _result = res;
        _connecting = false;
      });
      ref.read(domainsListControllerProvider.notifier).reload();
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _connecting = false;
      });
    }
  }

  Future<void> _verify() async {
    final result = _result;
    if (result == null) return;
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      final res = await _repo.verify(result.domainId);
      if (!mounted) return;
      setState(() {
        _verifyState = res;
        _verifying = false;
      });
      ref.read(domainsListControllerProvider.notifier).reload();
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _verifying = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final result = _result;

    return AppScaffold(
      title: "Connect a domain",
      body: ListView(
        padding: AppSpacing.screen,
        children: [
          Text(
            "Already own a domain? Point it at your store. Enter it below and "
            "we'll show you the exact records to set at your registrar.",
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: c.textSecondary),
          ),
          const Gap(AppSpacing.lg),
          AppTextField(
            controller: _controller,
            label: "Your domain",
            hint: "yourbrand.com",
            prefixIcon: PhosphorIcons.globe(),
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.go,
            enabled: !_connecting,
            onSubmitted: (_) => _connect(),
          ),
          const Gap(AppSpacing.md),
          PrimaryButton(
            label: result == null ? "Connect domain" : "Connect a different domain",
            icon: PhosphorIcons.linkSimple(),
            fullWidth: true,
            isLoading: _connecting,
            onPressed: _connecting ? null : _connect,
          ),
          if (_error != null) ...[
            const Gap(AppSpacing.md),
            _InlineError(message: _error!.message),
          ],
          if (result != null) ...[
            const Gap(AppSpacing.xl),
            SectionHeader(
              title: "Set these up",
              subtitle: result.message.isNotEmpty
                  ? result.message
                  : "Make these changes at your registrar, then check the status.",
              icon: PhosphorIcons.wrench(),
            ),
            const Gap(AppSpacing.md),
            DnsInstructionsCard(instructions: result.instructions),
            const Gap(AppSpacing.lg),
            _VerifyPanel(
              state: _verifyState,
              verifying: _verifying,
              onVerify: _verify,
            ),
          ],
        ],
      ),
    );
  }
}

/// The status panel below the DNS steps: a "Check status" action plus the real
/// verification/SSL result once checked. DNS can take up to a few hours to
/// propagate, so a pending result is normal, not an error.
class _VerifyPanel extends StatelessWidget {
  const _VerifyPanel({
    required this.state,
    required this.verifying,
    required this.onVerify,
  });

  final VerifyDomainResponse? state;
  final bool verifying;
  final VoidCallback onVerify;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final s = state;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIcons.shieldCheck(), size: 18, color: c.textSecondary),
              const Gap(AppSpacing.sm),
              Expanded(
                child: Text(
                  "Verification status",
                  style: text.titleSmall?.copyWith(color: c.textPrimary),
                ),
              ),
            ],
          ),
          if (s != null) ...[
            const Gap(AppSpacing.md),
            Row(
              children: [
                StatusChip(status: s.verificationStatus),
                const Gap(AppSpacing.sm),
                StatusChip.custom(
                  label: "SSL ${s.sslStatus.isEmpty ? "—" : s.sslStatus}",
                  tone: s.sslStatus.toLowerCase() == "active" ||
                          s.sslStatus.toLowerCase() == "issued"
                      ? StatusTone.success
                      : StatusTone.pending,
                ),
              ],
            ),
            const Gap(AppSpacing.sm),
            Text(
              s.pending
                  ? "Still propagating. DNS changes can take up to a few hours — "
                      "check again shortly."
                  : "Your domain is verified. It will start serving your store "
                      "once SSL finishes issuing.",
              style: text.bodySmall?.copyWith(color: c.textSecondary),
            ),
          ] else ...[
            const Gap(AppSpacing.sm),
            Text(
              "Once you've made the changes above, check whether they've taken "
              "effect.",
              style: text.bodySmall?.copyWith(color: c.textSecondary),
            ),
          ],
          const Gap(AppSpacing.md),
          SecondaryButton(
            label: s == null ? "Check status" : "Check again",
            icon: PhosphorIcons.arrowClockwise(),
            fullWidth: true,
            isLoading: verifying,
            onPressed: verifying ? null : onVerify,
          ),
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: AppSpacing.card,
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
