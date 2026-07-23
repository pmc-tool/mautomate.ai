import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/auth/auth_controller.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/theme/brand_theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

import "../application/home_controller.dart";
import "../data/home_dtos.dart";
import "../data/home_models.dart";
import "widgets/attention_card.dart";
import "widgets/home_skeleton.dart";
import "widgets/stat_tile.dart";

/// The merchant's landing dashboard: what needs attention right now, the
/// headline numbers, recent orders, and quick actions. Mirrors the web
/// overview (apps/storefront/src/app/dashboard/overview/page.tsx) with a
/// native "Needs attention" surface on top.
///
/// Every state is handled: a content-shaped skeleton while loading, a friendly
/// error with retry, and per-section empty guidance. Pull to refresh anywhere.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) =>
      ref.read(homeControllerProvider.notifier).refresh();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeAsync = ref.watch(homeControllerProvider);
    final me = ref.watch(authControllerProvider).me;
    final storeName = me?.store.name;
    final brand = ref.watch(brandProvider);
    final title = storeName == null || storeName.isEmpty ? "Home" : storeName;

    return AppScaffold(
      title: title,
      titleWidget: brand.hasLogo
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                BrandLogo(
                  size: 28,
                  radius: AppRadius.smAll,
                  fallbackLabel: title,
                ),
                const Gap(AppSpacing.sm),
                Flexible(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ],
            )
          : null,
      onRefresh: () => _refresh(ref),
      body: homeAsync.when(
        skipLoadingOnRefresh: true,
        loading: () => const HomeSkeleton(),
        error: (error, _) => _ErrorBody(
          message: error is Exception ? _messageOf(error) : error.toString(),
          onRetry: () => _refresh(ref),
        ),
        data: (snapshot) => _HomeBody(
          snapshot: snapshot,
          greetingName: me?.merchant.name.isNotEmpty == true
              ? me!.merchant.name
              : me?.merchant.email,
          storeDomain: me?.store.domain,
        ),
      ),
    );
  }
}

/// Pull the friendly message out of our typed [ApiError] without importing it
/// at the call site — any Exception falls back to its string form.
String _messageOf(Object error) {
  final s = error.toString();
  final idx = s.indexOf("): ");
  return idx >= 0 ? s.substring(idx + 3) : s;
}

class _HomeBody extends StatelessWidget {
  const _HomeBody({
    required this.snapshot,
    required this.greetingName,
    required this.storeDomain,
  });

  final HomeSnapshot snapshot;
  final String? greetingName;
  final String? storeDomain;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final stats = snapshot.stats;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: AppSpacing.screen,
      children: [
        // Greeting
        Text(
          greetingName == null ? "Welcome back" : "Welcome back, $greetingName",
          style: text.titleLarge,
        ),
        if (storeDomain != null && storeDomain!.isNotEmpty) ...[
          const Gap(AppSpacing.xxs),
          Text(
            storeDomain!,
            style: text.bodySmall?.copyWith(color: c.textMuted),
          ),
        ],
        const Gap(AppSpacing.xl),

        // Needs attention
        SectionHeader(
          title: "Needs attention",
          icon: PhosphorIconsRegular.bell,
        ),
        const Gap(AppSpacing.md),
        if (snapshot.attention.isEmpty)
          _AllClearCard()
        else
          for (final item in snapshot.attention) ...[
            AttentionCard(
              item: item,
              onTap: item.route == null
                  ? null
                  : () => context.go(item.route!),
            ),
            const Gap(AppSpacing.sm),
          ],
        const Gap(AppSpacing.xl),

        // Key numbers
        SectionHeader(
          title: "Your numbers",
          icon: PhosphorIconsRegular.chartLineUp,
        ),
        const Gap(AppSpacing.md),
        _StatGrid(
          tiles: [
            StatTile(
              label: "Total sales",
              icon: PhosphorIconsRegular.currencyDollar,
              iconColor: c.success,
              value: MoneyText(
                amount: stats.totalSales,
                currencyCode: stats.currencyCode,
                strong: true,
              ),
            ),
            StatTile(
              label: "Orders this month",
              icon: PhosphorIconsRegular.receipt,
              value: Text("${stats.ordersThisMonth}"),
            ),
            StatTile(
              label: "Products live",
              icon: PhosphorIconsRegular.package,
              value: Text("${stats.productsLive}"),
            ),
            StatTile(
              label: "Customers",
              icon: PhosphorIconsRegular.users,
              value: Text("${stats.customers}"),
            ),
            StatTile(
              label: "Credit balance",
              icon: PhosphorIconsRegular.wallet,
              iconColor: c.success,
              value: MoneyText(
                amount: stats.creditBalance,
                currencyCode: "USD",
                strong: true,
              ),
            ),
          ],
        ),
        const Gap(AppSpacing.xl),

        // Recent orders
        SectionHeader(
          title: "Recent orders",
          icon: PhosphorIconsRegular.clockCounterClockwise,
          action: GhostButton(
            label: "View all",
            size: AppButtonSize.small,
            onPressed: () => context.go("/orders"),
          ),
        ),
        const Gap(AppSpacing.md),
        if (snapshot.recentOrders.isEmpty)
          AppCard(
            child: EmptyState(
              compact: true,
              icon: PhosphorIconsRegular.receipt,
              title: "No orders yet",
              message:
                  "Your latest orders will show here once customers start buying.",
            ),
          )
        else
          AppCard(
            padding: EdgeInsets.zero,
            clip: true,
            child: Column(
              children: [
                for (var i = 0; i < snapshot.recentOrders.length; i++) ...[
                  if (i > 0)
                    Divider(height: 1, thickness: 1, color: c.border),
                  _OrderRow(order: snapshot.recentOrders[i]),
                ],
              ],
            ),
          ),
        const Gap(AppSpacing.xl),

        // Quick actions
        SectionHeader(
          title: "Quick actions",
          icon: PhosphorIconsRegular.lightning,
        ),
        const Gap(AppSpacing.md),
        AppCard(
          padding: EdgeInsets.zero,
          clip: true,
          child: Column(
            children: [
              ListRowTile(
                icon: PhosphorIconsRegular.plus,
                title: "Add a product",
                subtitle: "List something new to sell",
                onTap: () => context.go("/products"),
              ),
              Divider(height: 1, thickness: 1, color: c.border),
              ListRowTile(
                icon: PhosphorIconsRegular.receipt,
                title: "View orders",
                subtitle: "Fulfil and manage orders",
                onTap: () => context.go("/orders"),
              ),
              Divider(height: 1, thickness: 1, color: c.border),
              ListRowTile(
                icon: PhosphorIconsRegular.sparkle,
                title: "Ask Jarvis",
                subtitle: "Run your shop by talking to it",
                onTap: () => context.go("/jarvis"),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The slim, reassuring state when nothing needs the merchant's attention.
class _AllClearCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return AppCard(
      borderColor: c.successBorder,
      color: c.successBg,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Icon(PhosphorIconsFill.checkCircle, size: 22, color: c.success),
          const Gap(AppSpacing.md),
          Expanded(
            child: Text(
              "You're all caught up — nothing needs attention.",
              style: text.bodyMedium?.copyWith(color: c.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

/// A responsive grid for the stat tiles: three across on wide screens, two on
/// phones, wrapping to as many rows as needed.
class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 560 ? 3 : 2;
        const spacing = AppSpacing.md;
        final tileWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final tile in tiles)
              SizedBox(width: tileWidth, child: tile),
          ],
        );
      },
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.order});

  final HomeOrder order;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final subtitle = order.email ?? order.customerName;
    return ListRowTile(
      showChevron: false,
      title: "#${order.displayId}",
      subtitle: (subtitle == null || subtitle.isEmpty) ? null : subtitle,
      onTap: () => context.go("/orders"),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          MoneyText(
            amount: order.total,
            currencyCode: order.currencyCode,
            strong: true,
            color: c.textPrimary,
          ),
          const Gap(AppSpacing.xs),
          StatusChip(status: order.status),
        ],
      ),
    );
  }
}

/// Full-screen error that still pulls-to-refresh (the scroll view is always
/// scrollable so the [RefreshIndicator] can fire over it).
class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Padding(
              padding: AppSpacing.screen,
              child: Center(
                child: ErrorStateView(
                  title: "Couldn't load your dashboard",
                  message: message,
                  onRetry: onRetry,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
