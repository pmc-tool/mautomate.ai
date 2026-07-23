import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/intl.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/widgets/widgets.dart";
import "../application/marketing_channels_controller.dart";
import "../data/marketing_models.dart";
import "marketing_platforms.dart";

/// The Channels tab: the status of connected social accounts, with in-app
/// refresh + disconnect, plus a catalogue of channels the merchant can connect.
///
/// Connecting a NEW account requires an OAuth consent redirect (or a token
/// hand-off) that is completed on the web dashboard — the app shows honest
/// guidance rather than a button that cannot finish the flow here.
class MarketingChannelsTab extends ConsumerStatefulWidget {
  const MarketingChannelsTab({super.key});

  @override
  ConsumerState<MarketingChannelsTab> createState() =>
      _MarketingChannelsTabState();
}

class _MarketingChannelsTabState extends ConsumerState<MarketingChannelsTab> {
  String? _busyId;

  MarketingChannelsController get _controller =>
      ref.read(marketingChannelsControllerProvider.notifier);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(marketingChannelsControllerProvider);

    if (state.isLoading && state.accounts.isEmpty && state.providers.isEmpty) {
      return const SkeletonList();
    }

    if (state.error != null && state.accounts.isEmpty) {
      return _refreshable(
        ErrorStateView(
          message: state.error!.message,
          onRetry: _controller.retry,
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _controller.refresh,
      color: context.colors.accent,
      backgroundColor: context.colors.surface,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: AppSpacing.screen,
        children: [
          const SectionHeader(
            title: "Connected accounts",
            subtitle: "Publish and message from these channels.",
          ),
          const Gap(AppSpacing.md),
          if (state.accounts.isEmpty)
            _GuidanceCard(
              icon: PhosphorIcons.plugs(),
              title: "No channels connected yet",
              message:
                  "Connect Facebook, Instagram, X, LinkedIn or Telegram to "
                  "publish from your store. Connecting opens a secure "
                  "authorization step — finish it from your dashboard on the "
                  "web, then pull to refresh here.",
            )
          else
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < state.accounts.length; i++) ...[
                    if (i > 0)
                      Divider(
                        height: 1,
                        color: context.colors.border,
                        indent: AppSpacing.lg,
                        endIndent: AppSpacing.lg,
                      ),
                    _AccountRow(
                      account: state.accounts[i],
                      busy: _busyId == state.accounts[i].id,
                      onRefresh: () => _refreshAccount(state.accounts[i]),
                      onDisconnect: () => _disconnect(state.accounts[i]),
                    ),
                  ],
                ],
              ),
            ),
          if (state.providers.isNotEmpty) ...[
            const Gap(AppSpacing.xl),
            const SectionHeader(
              title: "Available channels",
              subtitle: "Connect a new channel from your dashboard on the web.",
            ),
            const Gap(AppSpacing.md),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < state.providers.length; i++) ...[
                    if (i > 0)
                      Divider(
                        height: 1,
                        color: context.colors.border,
                        indent: AppSpacing.lg,
                        endIndent: AppSpacing.lg,
                      ),
                    _ProviderRow(provider: state.providers[i]),
                  ],
                ],
              ),
            ),
          ],
          const Gap(AppSpacing.xl),
        ],
      ),
    );
  }

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: _controller.refresh,
      color: context.colors.accent,
      backgroundColor: context.colors.surface,
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        ),
      ),
    );
  }

  Future<void> _refreshAccount(SocialAccount account) async {
    setState(() => _busyId = account.id);
    try {
      await _controller.refreshAccount(account.id);
      if (mounted) _toast("Account refreshed.");
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _disconnect(SocialAccount account) async {
    final c = context.colors;
    final name = account.displayName ?? account.handle ?? platformMeta(account.platform).label;
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: c.surface,
        title: const Text("Disconnect this account?"),
        content: Text(
          "\"$name\" will be disconnected. Scheduled posts targeting it won't "
          "publish until you reconnect.",
        ),
        actions: [
          GhostButton(
            label: "Back",
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          GhostButton(
            label: "Disconnect",
            destructive: true,
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busyId = account.id);
    try {
      await _controller.disconnect(account.id);
      if (mounted) _toast("Account disconnected.");
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
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

class _AccountRow extends StatelessWidget {
  const _AccountRow({
    required this.account,
    required this.busy,
    required this.onRefresh,
    required this.onDisconnect,
  });

  final SocialAccount account;
  final bool busy;
  final VoidCallback onRefresh;
  final VoidCallback onDisconnect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final meta = platformMeta(account.platform);
    final title = account.displayName?.trim().isNotEmpty == true
        ? account.displayName!
        : (account.handle ?? meta.label);
    final subtitle = [
      meta.label,
      if (account.handle != null && account.handle!.isNotEmpty) "@${account.handle}",
      if (account.connectedAt != null) _fmtConnected(account.connectedAt!),
    ].where((s) => s.isNotEmpty).join("  ·  ");

    return Opacity(
      opacity: busy ? 0.5 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Container(
              height: 40,
              width: 40,
              decoration: BoxDecoration(
                color: c.surfaceMuted,
                borderRadius: AppRadius.smAll,
              ),
              child: Icon(meta.icon, size: 20, color: c.textSecondary),
            ),
            const Gap(AppSpacing.md),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleSmall),
                  const Gap(AppSpacing.xxs),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ],
              ),
            ),
            const Gap(AppSpacing.sm),
            StatusChip(status: account.status),
            PopupMenuButton<String>(
              icon: Icon(PhosphorIcons.dotsThreeOutline(), size: 20, color: c.textSecondary),
              color: c.surface,
              enabled: !busy,
              onSelected: (v) {
                if (v == "refresh") onRefresh();
                if (v == "disconnect") onDisconnect();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: "refresh",
                  child: Row(
                    children: [
                      Icon(PhosphorIcons.arrowClockwise(), size: 18, color: c.textSecondary),
                      const Gap(AppSpacing.sm),
                      const Text("Refresh"),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: "disconnect",
                  child: Row(
                    children: [
                      Icon(PhosphorIcons.plugs(), size: 18, color: c.danger),
                      const Gap(AppSpacing.sm),
                      Text("Disconnect", style: TextStyle(color: c.danger)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _fmtConnected(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return "";
    return "Connected ${DateFormat.yMMMd().format(dt.toLocal())}";
  }
}

class _ProviderRow extends StatelessWidget {
  const _ProviderRow({required this.provider});

  final SocialProvider provider;

  @override
  Widget build(BuildContext context) {
    final meta = platformMeta(provider.platform);
    final label = provider.label.isNotEmpty ? provider.label : meta.label;
    final String note;
    final StatusTone tone;
    if (provider.connected) {
      note = "Connected";
      tone = StatusTone.success;
    } else if (!provider.configured) {
      note = "Unavailable";
      tone = StatusTone.neutral;
    } else {
      note = "Connect on web";
      tone = StatusTone.info;
    }

    return ListRowTile(
      icon: meta.icon,
      title: label,
      subtitle: provider.configured
          ? "Ready to connect from your web dashboard."
          : "Not enabled on this store.",
      showChevron: false,
      trailing: StatusChip.custom(label: note, tone: tone),
    );
  }
}

class _GuidanceCard extends StatelessWidget {
  const _GuidanceCard({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: c.infoBg,
              borderRadius: AppRadius.smAll,
              border: Border.all(color: c.infoBorder),
            ),
            child: Icon(icon, size: 20, color: c.info),
          ),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleSmall),
                const Gap(AppSpacing.xs),
                Text(
                  message,
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
