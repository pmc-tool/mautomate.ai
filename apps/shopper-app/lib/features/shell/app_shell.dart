import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

import "../../core/theme/app_colors.dart";
import "../cart/cart_providers.dart";

/// The app shell: the active tab plus a branded bottom navigation bar for
/// Home / Shop / Search / Cart / Account.
///
/// Wraps a [StatefulNavigationShell] so each tab keeps its own navigation stack
/// and scroll position. The Cart destination carries a live item-count badge
/// (from [cartItemCountProvider]). The bar's selected colour is the store brand
/// accent — `context.colors.accent` already resolves to the store's accent
/// (applied to the theme in `app.dart` from `brandProvider`), so the nav reflects
/// the store automatically in both light and dark.
///
/// Detail routes (category, product) are pushed OVER this shell full-screen with
/// a back button — they are NOT tabs.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final cartCount = ref.watch(cartItemCountProvider);

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: c.surface,
          indicatorColor: c.accentTint,
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: selected ? c.accent : c.textSecondary,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  letterSpacing: 0,
                );
          }),
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (index) => navigationShell.goBranch(
            index,
            // Re-tapping the active tab returns it to its initial route.
            initialLocation: index == navigationShell.currentIndex,
          ),
          destinations: [
            NavigationDestination(
              icon: Icon(PhosphorIconsRegular.house, color: c.textSecondary),
              selectedIcon: Icon(PhosphorIconsFill.house, color: c.accent),
              label: "Home",
            ),
            NavigationDestination(
              icon: Icon(PhosphorIconsRegular.storefront, color: c.textSecondary),
              selectedIcon: Icon(PhosphorIconsFill.storefront, color: c.accent),
              label: "Shop",
            ),
            NavigationDestination(
              icon: Icon(
                PhosphorIconsRegular.magnifyingGlass,
                color: c.textSecondary,
              ),
              selectedIcon: Icon(
                PhosphorIconsFill.magnifyingGlass,
                color: c.accent,
              ),
              label: "Search",
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: cartCount > 0,
                label: Text(cartCount > 99 ? "99+" : "$cartCount"),
                backgroundColor: c.accent,
                textColor: c.onAccent,
                child: Icon(
                  PhosphorIconsRegular.shoppingCartSimple,
                  color: c.textSecondary,
                ),
              ),
              selectedIcon: Badge(
                isLabelVisible: cartCount > 0,
                label: Text(cartCount > 99 ? "99+" : "$cartCount"),
                backgroundColor: c.accent,
                textColor: c.onAccent,
                child: Icon(
                  PhosphorIconsFill.shoppingCartSimple,
                  color: c.accent,
                ),
              ),
              label: "Cart",
            ),
            NavigationDestination(
              icon: Icon(PhosphorIconsRegular.user, color: c.textSecondary),
              selectedIcon: Icon(PhosphorIconsFill.user, color: c.accent),
              label: "Account",
            ),
          ],
        ),
      ),
    );
  }
}
