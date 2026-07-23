import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../../core/api/api_error.dart";
import "../../../core/theme/theme.dart";
import "../../../core/util/open_url.dart";
import "../../../core/widgets/widgets.dart";
import "../application/ads_accounts_controller.dart";
import "../data/ads_models.dart";
import "ads_format.dart";

/// Advertising — Connect. Link the ad platforms this store advertises on and
/// pick the ad account this store uses. Meta connects via OAuth (approved once
/// in a browser); the accounts you have access to are then discovered.
///
/// Ad spend is always billed by the platform to the merchant's own ad account —
/// connecting here never moves money.
///
/// Note: completing the OAuth handshake needs a browser. This build opens the
/// authorization link natively (external browser via `url_launcher`), with a
/// copy-link fallback; account selection + disconnect work fully in-app.
class AdsConnectScreen extends ConsumerWidget {
  const AdsConnectScreen({super.key});

  static Route<void> route() {
    return MaterialPageRoute<void>(builder: (_) => const AdsConnectScreen());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(adsAccountsControllerProvider);
    final controller = ref.read(adsAccountsControllerProvider.notifier);

    return AppScaffold(
      title: "Ad accounts",
      onRefresh: controller.refresh,
      body: state.when(
        loading: () => const SkeletonList(),
        error: (e, _) => _Scrollable(
          child: ErrorStateView(
            message: ApiError.from(e).message,
            onRetry: controller.refresh,
          ),
        ),
        data: (data) => _Body(data: data),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.data});

  final AdsAccountsResponse data;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  String? _busy;

  AdsAccountsController get _controller =>
      ref.read(adsAccountsControllerProvider.notifier);

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    // The platforms the API says are configured; fall back to Meta if none.
    final platforms = data.platforms.isNotEmpty
        ? data.platforms
        : const [
            AdsPlatformInfo(
              platform: "meta",
              label: "Meta ads",
              connect: "oauth",
              configured: true,
            ),
          ];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        Text(
          "Connect the platforms this store advertises on. Ad spend is always "
          "billed by the platform to your own ad account — connecting here "
          "never moves money.",
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: context.colors.textSecondary),
        ),
        const Gap(AppSpacing.lg),
        _PlatformsCard(
          platforms: platforms,
          connections: data.connections,
          busy: _busy,
          onConnect: _connect,
          onDisconnect: _disconnect,
        ),
        const Gap(AppSpacing.lg),
        _AccountsCard(
          accounts: data.accounts,
          busy: _busy,
          onSelect: _select,
        ),
      ],
    );
  }

  Future<void> _connect(String platform) async {
    setState(() => _busy = "connect:$platform");
    try {
      final result = await _controller.connect(platform);
      if (!mounted) return;
      if (result.authUrl != null) {
        await _showAuthUrl(result.authUrl!);
      } else {
        _toast("Connected. Pick the ad account this store uses below.");
      }
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _select(AdsAccount account) async {
    setState(() => _busy = "select:${account.id}");
    try {
      await _controller.selectAccount(account.id, !account.selected);
      if (mounted) {
        _toast(account.selected
            ? "Account unselected."
            : "Account selected for this store.");
      }
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _disconnect(AdsConnection connection) async {
    final ok = await _confirm(
      title: "Disconnect this platform?",
      message:
          "Your campaigns and results stop syncing into mAutomate. Your ad "
          "account at the platform is untouched.",
    );
    if (!ok) return;
    setState(() => _busy = "disconnect:${connection.id}");
    try {
      await _controller.disconnect(connection.id);
      if (mounted) _toast("Disconnected.");
    } catch (e) {
      if (mounted) _toast(ApiError.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _showAuthUrl(String url) async {
    final c = context.colors;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: c.surface,
        title: const Text("Finish connecting"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Open this authorization link in your browser to approve access, "
              "then come back and pull to refresh.",
              style: Theme.of(dialogContext)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.textSecondary),
            ),
            const Gap(AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: c.surfaceInset,
                borderRadius: AppRadius.smAll,
                border: Border.all(color: c.border),
              ),
              child: SelectableText(
                url,
                style: Theme.of(dialogContext).textTheme.bodySmall,
              ),
            ),
          ],
        ),
        actions: [
          GhostButton(
            label: "Close",
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
          SecondaryButton(
            label: "Copy link",
            icon: PhosphorIcons.copy(),
            size: AppButtonSize.small,
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: url));
              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
              if (mounted) _toast("Link copied to clipboard.");
            },
          ),
          PrimaryButton(
            label: "Open in browser",
            icon: PhosphorIcons.arrowSquareOut(),
            size: AppButtonSize.small,
            onPressed: () async {
              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
              await openExternalUrl(context, url);
            },
          ),
        ],
      ),
    );
  }

  Future<bool> _confirm({
    required String title,
    required String message,
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
          GhostButton(
            label: "Disconnect",
            destructive: true,
            size: AppButtonSize.small,
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    return result ?? false;
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

// --- Platforms --------------------------------------------------------------

class _PlatformsCard extends StatelessWidget {
  const _PlatformsCard({
    required this.platforms,
    required this.connections,
    required this.busy,
    required this.onConnect,
    required this.onDisconnect,
  });

  final List<AdsPlatformInfo> platforms;
  final List<AdsConnection> connections;
  final String? busy;
  final ValueChanged<String> onConnect;
  final ValueChanged<AdsConnection> onDisconnect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: SectionHeader(
              title: "Platforms",
              subtitle: "Link an ad platform to sync its campaigns here.",
            ),
          ),
          ...List.generate(platforms.length, (i) {
            final platform = platforms[i];
            final connection = connections
                .where((conn) => conn.platform == platform.platform)
                .cast<AdsConnection?>()
                .firstWhere((_) => true, orElse: () => null);
            final connected = connection?.status == "connected";
            final connecting = busy == "connect:${platform.platform}";
            final disconnecting =
                connection != null && busy == "disconnect:${connection.id}";

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
                ListRowTile(
                  icon: PhosphorIcons.megaphone(),
                  title: platform.label.isEmpty
                      ? humanise(platform.platform)
                      : platform.label,
                  subtitle: !platform.configured
                      ? "Coming soon"
                      : connection != null && !connected
                          ? "Reconnect needed"
                          : connected
                              ? "Connected"
                              : "Tap connect to link this platform",
                  showChevron: false,
                  trailing: _trailing(
                    context,
                    platform: platform,
                    connection: connection,
                    connected: connected,
                    connecting: connecting,
                    disconnecting: disconnecting,
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _trailing(
    BuildContext context, {
    required AdsPlatformInfo platform,
    required AdsConnection? connection,
    required bool connected,
    required bool connecting,
    required bool disconnecting,
  }) {
    if (!platform.configured) {
      return const StatusChip.custom(
        label: "Soon",
        tone: StatusTone.neutral,
      );
    }
    if (connected && connection != null) {
      return GhostButton(
        label: "Disconnect",
        destructive: true,
        size: AppButtonSize.small,
        isLoading: disconnecting,
        onPressed: busy == null ? () => onDisconnect(connection) : null,
      );
    }
    return SecondaryButton(
      label: connection != null ? "Reconnect" : "Connect",
      size: AppButtonSize.small,
      isLoading: connecting,
      onPressed: busy == null ? () => onConnect(platform.platform) : null,
    );
  }
}

// --- Accounts ---------------------------------------------------------------

class _AccountsCard extends StatelessWidget {
  const _AccountsCard({
    required this.accounts,
    required this.busy,
    required this.onSelect,
  });

  final List<AdsAccount> accounts;
  final String? busy;
  final ValueChanged<AdsAccount> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: SectionHeader(
              title: "Ad accounts",
              subtitle: "Pick the account this store advertises from.",
            ),
          ),
          if (accounts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.md),
              child: EmptyState(
                compact: true,
                icon: null,
                title: "No ad accounts yet",
                message:
                    "Connect a platform above and the ad accounts you have "
                    "access to appear here.",
              ),
            )
          else
            ...List.generate(accounts.length, (i) {
              final account = accounts[i];
              final selecting = busy == "select:${account.id}";
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
                  ListRowTile(
                    icon: PhosphorIcons.identificationCard(),
                    title: account.name?.isNotEmpty == true
                        ? account.name!
                        : account.externalId,
                    subtitle: [
                      humanise(account.platform),
                      if (account.currency != null)
                        account.currency!.toUpperCase(),
                    ].join(" · "),
                    showChevron: false,
                    trailing: account.selected
                        ? GhostButton(
                            label: "Selected",
                            icon: PhosphorIcons.checkCircle(),
                            size: AppButtonSize.small,
                            isLoading: selecting,
                            onPressed: busy == null ? () => onSelect(account) : null,
                          )
                        : SecondaryButton(
                            label: "Use this",
                            size: AppButtonSize.small,
                            isLoading: selecting,
                            onPressed: busy == null ? () => onSelect(account) : null,
                          ),
                  ),
                ],
              );
            }),
        ],
      ),
    );
  }
}

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
