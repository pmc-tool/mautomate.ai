import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "package:mautomate_merchant/core/auth/auth_controller.dart";
import "package:mautomate_merchant/core/theme/theme.dart";
import "package:mautomate_merchant/core/theme/brand_theme.dart";
import "package:mautomate_merchant/core/widgets/widgets.dart";

/// The "More" hub: the fifth bottom-nav tab. Everything that does not earn a
/// permanent tab lives here — grouped by intent (Grow / Operate / Manage) —
/// plus the signed-in merchant's account and a sign-out action.
///
/// Each row deep-links to its surface with `context.push`, so the surface opens
/// full-screen over the shell with a back button. The rows are stable landing
/// points; feature engineers replace each destination screen's body without
/// touching this hub or the router.
class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(authControllerProvider).me;

    return AppScaffold(
      title: "More",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.xxl,
        ),
        children: [
          _AccountCard(
            name: me?.merchant.name,
            email: me?.merchant.email,
            storeName: me?.store.name,
          ),
          const Gap(AppSpacing.xl),
          _MoreGroup(
            heading: "Grow",
            subtitle: "Bring customers in and keep them coming back.",
            items: [
              _MoreItem(
                icon: PhosphorIconsRegular.megaphone,
                title: "Marketing",
                description: "Campaigns, social posts and audiences",
                route: "/marketing",
              ),
              _MoreItem(
                icon: PhosphorIconsRegular.target,
                title: "Ads",
                description: "Run Meta and Google ad campaigns",
                route: "/ads",
              ),
              _MoreItem(
                icon: PhosphorIconsRegular.chartLineUp,
                title: "Insights",
                description: "Sales, traffic and store performance",
                route: "/insights",
              ),
            ],
          ),
          const Gap(AppSpacing.xl),
          _MoreGroup(
            heading: "Operate",
            subtitle: "The day-to-day of running your store.",
            items: [
              _MoreItem(
                icon: PhosphorIconsRegular.tray,
                title: "Inbox",
                description: "Reply to customers or hand off to Jarvis",
                route: "/inbox",
              ),
              _MoreItem(
                icon: PhosphorIconsRegular.rocketLaunch,
                title: "Setup",
                description: "Finish getting your store ready to sell",
                route: "/setup",
              ),
            ],
          ),
          const Gap(AppSpacing.xl),
          _MoreGroup(
            heading: "Manage",
            subtitle: "Your store's account, reach and infrastructure.",
            items: [
              _MoreItem(
                icon: PhosphorIconsRegular.headset,
                title: "Call Center",
                description: "AI voice agent and call history",
                route: "/callcenter",
              ),
              _MoreItem(
                icon: PhosphorIconsRegular.globe,
                title: "Domains",
                description: "Custom domain and DNS",
                route: "/domains",
              ),
              _MoreItem(
                icon: PhosphorIconsRegular.creditCard,
                title: "Billing",
                description: "Plan, credits and usage",
                route: "/billing",
              ),
              _MoreItem(
                icon: PhosphorIconsRegular.gear,
                title: "Settings",
                description: "Store details, team and preferences",
                route: "/settings",
              ),
            ],
          ),
          const Gap(AppSpacing.xl),
          GhostButton(
            label: "Sign out",
            icon: PhosphorIconsRegular.signOut,
            fullWidth: true,
            destructive: true,
            onPressed: () => _confirmSignOut(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final c = context.colors;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: c.surface,
        title: const Text("Sign out?"),
        content: const Text(
          "You will need to sign in again to manage your store.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(
              "Cancel",
              style: TextStyle(color: c.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              "Sign out",
              style: TextStyle(color: c.danger, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      HapticFeedback.mediumImpact();
      await ref.read(authControllerProvider.notifier).signOut();
    }
  }
}

/// The account header: who is signed in and to which store.
class _AccountCard extends StatelessWidget {
  const _AccountCard({this.name, this.email, this.storeName});

  final String? name;
  final String? email;
  final String? storeName;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;

    final displayName = (name != null && name!.isNotEmpty) ? name! : "Merchant";

    return AppCard(
      child: Row(
        children: [
          BrandLogo(size: 52, fallbackLabel: displayName),
          const Gap(AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleMedium,
                ),
                if (email != null && email!.isNotEmpty) ...[
                  const Gap(AppSpacing.xxs),
                  Text(
                    email!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(color: c.textSecondary),
                  ),
                ],
                if (storeName != null && storeName!.isNotEmpty) ...[
                  const Gap(AppSpacing.sm),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        PhosphorIconsRegular.storefront,
                        size: 14,
                        color: c.textMuted,
                      ),
                      const Gap(AppSpacing.xs),
                      Flexible(
                        child: Text(
                          storeName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.labelMedium?.copyWith(
                            color: c.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A titled group of [_MoreItem] rows rendered as a single carded list.
class _MoreGroup extends StatelessWidget {
  const _MoreGroup({
    required this.heading,
    required this.subtitle,
    required this.items,
  });

  final String heading;
  final String subtitle;
  final List<_MoreItem> items;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          eyebrow: heading,
          title: subtitle,
          padding: const EdgeInsets.only(
            left: AppSpacing.xs,
            bottom: AppSpacing.md,
          ),
        ),
        AppCard(
          padding: EdgeInsets.zero,
          clip: true,
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0)
                  Divider(height: 1, thickness: 1, color: c.border, indent: 0),
                ListRowTile(
                  icon: items[i].icon,
                  title: items[i].title,
                  subtitle: items[i].description,
                  onTap: () => context.push(items[i].route),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// One navigable destination within a [_MoreGroup].
class _MoreItem {
  const _MoreItem({
    required this.icon,
    required this.title,
    required this.description,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String description;
  final String route;
}
