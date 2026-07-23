import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/account/account_screen.dart";
import "../../features/cart/cart_screen.dart";
import "../../features/category/category_screen.dart";
import "../../features/home/home_screen.dart";
import "../../features/product/product_screen.dart";
import "../../features/search/search_screen.dart";
import "../../features/shell/app_shell.dart";
import "../../features/shop/shop_screen.dart";
import "routes.dart";

/// The app router.
///
/// A [StatefulShellRoute.indexedStack] provides the five bottom-nav tabs — Home
/// (`/`), Shop (`/shop`), Search (`/search`), Cart (`/cart`), Account
/// (`/account`) — each in its own navigation stack ([AppShell] draws the branded
/// nav bar). Detail routes — Category (`/category/:id`) and Product
/// (`/product/:handle`) — are TOP-LEVEL routes pushed OVER the shell so they open
/// full-screen with a back button.
///
/// All paths + names live in `routes.dart` ([AppRoutes] / [RouteNames]); use the
/// [AppNav] helpers (`context.goShop()`, `context.pushProduct(handle)`,
/// `context.navigateToHref(cta.href)`) to navigate. Wave 2b fills in the screen
/// bodies (currently `ComingSoonScaffold` placeholders) without touching this
/// file.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: AppRoutes.home,
    routes: [
      // Detail routes — top-level siblings of the shell, so they push on the
      // root navigator (full-screen, bottom nav hidden, back button).
      GoRoute(
        path: AppRoutes.categoryPattern,
        name: RouteNames.category,
        builder: (context, state) =>
            CategoryScreen(categoryId: state.pathParameters["id"] ?? ""),
      ),
      GoRoute(
        path: AppRoutes.productPattern,
        name: RouteNames.product,
        builder: (context, state) =>
            ProductScreen(handle: state.pathParameters["handle"] ?? ""),
      ),

      // The bottom-nav shell — five branches, each an independent stack.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                name: RouteNames.home,
                builder: (_, __) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.shop,
                name: RouteNames.shop,
                builder: (_, __) => const ShopScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.search,
                name: RouteNames.search,
                builder: (_, state) => SearchScreen(
                  initialQuery: state.uri.queryParameters["q"],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.cart,
                name: RouteNames.cart,
                builder: (_, __) => const CartScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.account,
                name: RouteNames.account,
                builder: (_, __) => const AccountScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
