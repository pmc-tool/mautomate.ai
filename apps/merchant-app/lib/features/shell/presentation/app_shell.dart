import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:phosphor_flutter/phosphor_flutter.dart";

/// The signed-in app shell: the current tab plus a bottom navigation bar for
/// Home / Orders / Products / Jarvis / More. Uses [StatefulNavigationShell] so
/// each tab keeps its own navigation stack and scroll position.
///
/// Jarvis stays the flagship, held in the centre of the five destinations. The
/// "More" tab is the hub for every secondary surface (inbox, insights, setup,
/// marketing, ads, call center, domains, settings, billing) — those open
/// full-screen over the shell via `context.push`.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          // Re-tapping the active tab returns it to its initial route.
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(
            icon: Icon(PhosphorIconsRegular.house),
            selectedIcon: Icon(PhosphorIconsFill.house),
            label: "Home",
          ),
          NavigationDestination(
            icon: Icon(PhosphorIconsRegular.receipt),
            selectedIcon: Icon(PhosphorIconsFill.receipt),
            label: "Orders",
          ),
          NavigationDestination(
            icon: Icon(PhosphorIconsRegular.package),
            selectedIcon: Icon(PhosphorIconsFill.package),
            label: "Products",
          ),
          NavigationDestination(
            icon: Icon(PhosphorIconsRegular.sparkle),
            selectedIcon: Icon(PhosphorIconsFill.sparkle),
            label: "Jarvis",
          ),
          NavigationDestination(
            icon: Icon(PhosphorIconsRegular.dotsThreeCircle),
            selectedIcon: Icon(PhosphorIconsFill.dotsThreeCircle),
            label: "More",
          ),
        ],
      ),
    );
  }
}
