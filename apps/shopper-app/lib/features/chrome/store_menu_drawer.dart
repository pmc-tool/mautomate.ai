import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/router/routes.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/brand_theme.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "categories_repository.dart";
import "chrome_controller.dart";
import "store_chrome.dart";

/// The store navigation drawer: renders the header menu (`chrome.header.menu`),
/// expanding any `__dynamic_categories__` sentinel (or `children_dynamic` item)
/// into the store's LIVE top-level categories fetched from
/// `/store/product-categories`. Ordinary menu items become tappable links routed
/// through [AppNav.navigateToHref]. Falls back to the standard shell
/// destinations when the store defines no menu.
class StoreMenuDrawer extends ConsumerWidget {
  const StoreMenuDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final brand = ref.watch(brandProvider);
    final header = ref.watch(storeChromeProvider.select((v) => v.header));
    final menu = header?.menu ?? const <ChromeMenuItem>[];

    return Drawer(
      backgroundColor: c.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: [
                  StoreLogo(
                    url: brand.logoUrl,
                    label: brand.storeName ?? "Store",
                    size: 36,
                  ),
                  const Gap(AppSpacing.sm),
                  Expanded(
                    child: Text(
                      brand.storeName ?? "Store",
                      style: text.titleMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                children: [
                  if (menu.isEmpty)
                    ..._defaultDestinations(context)
                  else
                    for (final item in menu)
                      if (item.expandsCategories)
                        _DynamicCategories(item: item)
                      else
                        _MenuTile(
                          label: item.label,
                          onTap: () => _navigate(context, item.href),
                        ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _defaultDestinations(BuildContext context) => [
        _MenuTile(
          label: "Home",
          icon: PhosphorIcons.house(),
          onTap: () {
            Navigator.of(context).maybePop();
            context.goHome();
          },
        ),
        _MenuTile(
          label: "Shop",
          icon: PhosphorIcons.storefront(),
          onTap: () {
            Navigator.of(context).maybePop();
            context.goShop();
          },
        ),
        _MenuTile(
          label: "Search",
          icon: PhosphorIcons.magnifyingGlass(),
          onTap: () {
            Navigator.of(context).maybePop();
            context.goSearch();
          },
        ),
      ];

  void _navigate(BuildContext context, String? href) {
    Navigator.of(context).maybePop();
    context.navigateToHref(href);
  }
}

/// Expands one dynamic-category menu item into live category links.
class _DynamicCategories extends ConsumerWidget {
  const _DynamicCategories({required this.item});

  final ChromeMenuItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final async = ref.watch(topCategoriesProvider);

    final heading = item.isDynamicSentinel ? "Shop by category" : item.label;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xs,
          ),
          child: Text(
            heading.toUpperCase(),
            style: text.labelSmall?.copyWith(color: c.textMuted),
          ),
        ),
        async.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.sm,
            ),
            child: Shimmer(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 160, height: 14),
                  Gap(AppSpacing.md),
                  SkeletonBox(width: 120, height: 14),
                  Gap(AppSpacing.md),
                  SkeletonBox(width: 140, height: 14),
                ],
              ),
            ),
          ),
          error: (_, __) => const SizedBox.shrink(),
          data: (categories) {
            final limited = item.limit != null && item.limit! > 0
                ? categories.take(item.limit!).toList()
                : categories;
            if (limited.isEmpty) {
              // Graceful empty: nothing to expand, keep the item as a plain
              // link if it has an href, otherwise draw nothing.
              if (item.href != null) {
                return _MenuTile(
                  label: item.label,
                  onTap: () {
                    Navigator.of(context).maybePop();
                    context.navigateToHref(item.href);
                  },
                );
              }
              return const SizedBox.shrink();
            }
            return Column(
              children: [
                for (final cat in limited)
                  _MenuTile(
                    label: cat.name,
                    dense: true,
                    onTap: () {
                      Navigator.of(context).maybePop();
                      context.pushCategory(cat.id);
                    },
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.label,
    required this.onTap,
    this.icon,
    this.dense = false,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return ListTile(
      dense: dense,
      leading: icon != null ? Icon(icon, size: 20, color: c.textSecondary) : null,
      title: Text(label, style: text.bodyLarge),
      trailing: Icon(
        PhosphorIcons.caretRight(),
        size: 16,
        color: c.textMuted,
      ),
      onTap: onTap,
    );
  }
}
