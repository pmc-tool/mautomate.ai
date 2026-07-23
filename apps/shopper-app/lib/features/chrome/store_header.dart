import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/router/routes.dart";
import "../../core/theme/app_colors.dart";
import "../../core/theme/brand_theme.dart";
import "../../core/theme/spacing.dart";
import "../../core/widgets/widgets.dart";
import "../cart/cart_providers.dart";
import "chrome_controller.dart";
import "store_topbar.dart";

/// The store header: the pinned top bar drawn on browsing screens.
///
/// Composes the announcement [StoreTopbar] (when present) over a header row with
/// the store logo/name (tap → Home), a menu button that opens the categories
/// drawer (when the store's menu expands into live categories), a search
/// affordance and a cart icon with a live item-count badge. All driven by
/// `chrome.header` + `branding`, themed from the active [AppColors] (which
/// already carries the store brand accent), and correct in light + dark.
///
/// Placed at the top of a screen's body (inside the Scaffold, so its menu button
/// can open the Scaffold drawer). The scrollable page renders below it.
class StoreHeader extends ConsumerWidget {
  const StoreHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final brand = ref.watch(brandProvider);
    final header = ref.watch(storeChromeProvider.select((v) => v.header));

    final showSearch = header?.searchEnabled ?? true;
    final showCart = header?.showCart ?? true;
    final showAccount = header?.showAccount ?? true;
    final showWishlist = header?.showWishlist ?? false;
    final hasCategoryMenu = header?.hasCategoryMenu ?? false;

    return Material(
      color: c.surface,
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const StoreTopbar(),
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: c.surface,
                border: Border(
                  bottom: BorderSide(color: c.border),
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              child: Row(
                children: [
                  if (hasCategoryMenu)
                    _HeaderIcon(
                      icon: PhosphorIcons.list(),
                      tooltip: "Menu",
                      onTap: () {
                        final scaffold = Scaffold.maybeOf(context);
                        if (scaffold?.hasDrawer ?? false) {
                          scaffold!.openDrawer();
                        }
                      },
                    ),
                  const Gap(AppSpacing.xs),
                  Expanded(
                    child: InkWell(
                      borderRadius: AppRadius.smAll,
                      onTap: () => context.goHome(),
                      child: Padding(
                        padding:
                            const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                        child: Row(
                          children: [
                            StoreLogo(
                              url: brand.logoUrl,
                              label: brand.storeName ?? "Store",
                              size: 32,
                            ),
                            const Gap(AppSpacing.sm),
                            Flexible(
                              child: Text(
                                brand.storeName ?? "Store",
                                overflow: TextOverflow.ellipsis,
                                style: text.titleMedium,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (showSearch)
                    _HeaderIcon(
                      icon: PhosphorIcons.magnifyingGlass(),
                      tooltip: "Search",
                      onTap: () => context.goSearch(),
                    ),
                  if (showWishlist)
                    _HeaderIcon(
                      icon: PhosphorIcons.heart(),
                      tooltip: "Wishlist",
                      onTap: () => context.goAccount(),
                    ),
                  if (showAccount)
                    _HeaderIcon(
                      icon: PhosphorIcons.user(),
                      tooltip: "Account",
                      onTap: () => context.goAccount(),
                    ),
                  if (showCart) const _CartIcon(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A single tappable header icon button with a comfortable tap target.
class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({
    required this.icon,
    required this.onTap,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, size: 22, color: c.textPrimary),
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
    );
  }
}

/// The cart icon with a live item-count badge (from [cartItemCountProvider]).
class _CartIcon extends ConsumerWidget {
  const _CartIcon();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final count = ref.watch(cartItemCountProvider);
    return IconButton(
      onPressed: () => context.goCart(),
      tooltip: "Cart",
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text(count > 99 ? "99+" : "$count"),
        backgroundColor: c.accent,
        textColor: c.onAccent,
        child: Icon(
          PhosphorIcons.shoppingCartSimple(),
          size: 22,
          color: c.textPrimary,
        ),
      ),
    );
  }
}
