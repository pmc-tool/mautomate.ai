import "package:flutter/widgets.dart";
import "package:go_router/go_router.dart";

/// The single source of truth for every route in the shopper app.
///
/// Wave 2b screens and the block-renderer agent depend on these constants +
/// helpers, so they can navigate without hardcoding path strings. This file is
/// intentionally SELF-CONTAINED (only `flutter` + `go_router`) so it can be
/// imported from anywhere — renderers, chrome widgets, feature screens — with no
/// dependency cycles.
///
/// Two families of routes:
///  - **Shell tabs** (bottom nav, kept in their own stacks): [home], [shop],
///    [search], [cart], [account]. Navigate with `context.go(...)` — switching
///    the selected tab.
///  - **Detail routes** (pushed OVER the shell, full-screen with a back button):
///    [category] / [product]. Navigate with `context.push(...)`.
class AppRoutes {
  const AppRoutes._();

  // --- Shell tabs (paths) ------------------------------------------------
  static const String home = "/";
  static const String shop = "/shop";
  static const String search = "/search";
  static const String cart = "/cart";
  static const String account = "/account";

  // --- Detail routes (path patterns for GoRoute registration) ------------
  static const String categoryPattern = "/category/:id";
  static const String productPattern = "/product/:handle";

  /// Build a concrete category detail path for a given category [id].
  static String category(String id) => "/category/${Uri.encodeComponent(id)}";

  /// Build a concrete product detail path for a given product [handle].
  static String product(String handle) =>
      "/product/${Uri.encodeComponent(handle)}";

  /// Build a search path, optionally pre-seeded with a query [q].
  static String searchQuery(String? q) {
    final query = (q ?? "").trim();
    if (query.isEmpty) return search;
    return "$search?q=${Uri.encodeQueryComponent(query)}";
  }
}

/// Stable go_router route NAMES (used for `context.goNamed` / `pushNamed` and
/// for keeping GoRoute definitions and links in sync).
class RouteNames {
  const RouteNames._();

  static const String home = "home";
  static const String shop = "shop";
  static const String search = "search";
  static const String cart = "cart";
  static const String account = "account";
  static const String category = "category";
  static const String product = "product";
}

/// Ergonomic navigation helpers on [BuildContext].
///
/// ```dart
/// context.goShop();               // switch to the Shop tab
/// context.pushProduct("t-shirt"); // open a product over the shell
/// context.navigateToHref(cta.href); // map a server href to in-app nav
/// ```
extension AppNav on BuildContext {
  /// Switch to the Home tab.
  void goHome() => go(AppRoutes.home);

  /// Switch to the Shop (catalog) tab.
  void goShop() => go(AppRoutes.shop);

  /// Switch to the Search tab, optionally seeding a query.
  void goSearch([String? q]) => go(AppRoutes.searchQuery(q));

  /// Switch to the Cart tab.
  void goCart() => go(AppRoutes.cart);

  /// Switch to the Account tab.
  void goAccount() => go(AppRoutes.account);

  /// Open a category detail screen over the shell.
  void pushCategory(String id) => push(AppRoutes.category(id));

  /// Open a product detail screen over the shell.
  void pushProduct(String handle) => push(AppRoutes.product(handle));

  /// Map a server-provided `href` to in-app navigation.
  ///
  /// The CMS/Puck payload uses web-style hrefs (`/store`, `/store?q=...`,
  /// `/cart`, `/account`, `/product/:handle`, `#`, or external `https://…`).
  /// This resolves the KNOWN internal paths to native routes and returns `true`
  /// when it handled navigation internally. It returns `false` (doing nothing)
  /// for external URLs, `#`, or anything it doesn't recognise — the caller may
  /// then choose to launch the URL in a browser.
  bool navigateToHref(String? href) {
    final raw = (href ?? "").trim();
    if (raw.isEmpty || raw == "#") return false;

    // External / non-in-app schemes are left to the caller.
    final lower = raw.toLowerCase();
    if (lower.startsWith("http://") ||
        lower.startsWith("https://") ||
        lower.startsWith("mailto:") ||
        lower.startsWith("tel:")) {
      return false;
    }

    final uri = Uri.tryParse(raw);
    if (uri == null) return false;

    // Normalise the path (drop a trailing slash except for root).
    var path = uri.path;
    if (path.isEmpty) path = "/";
    if (path.length > 1 && path.endsWith("/")) {
      path = path.substring(0, path.length - 1);
    }
    final segments = uri.pathSegments;
    final q = uri.queryParameters["q"];

    switch (path) {
      case "/":
        goHome();
        return true;
      case "/store":
      case "/shop":
      case "/collections":
      case "/products":
        // A search query on the catalog root routes to Search.
        if (q != null && q.trim().isNotEmpty) {
          goSearch(q);
        } else {
          goShop();
        }
        return true;
      case "/search":
        goSearch(q);
        return true;
      case "/cart":
        goCart();
        return true;
      case "/account":
      case "/login":
      case "/profile":
        goAccount();
        return true;
    }

    // Detail routes: /category/:id, /product|products/:handle.
    if (segments.length >= 2) {
      if (segments.first == "category" || segments.first == "categories") {
        pushCategory(segments[1]);
        return true;
      }
      if (segments.first == "product" || segments.first == "products") {
        pushProduct(segments[1]);
        return true;
      }
    }

    return false;
  }
}
