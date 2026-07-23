import "../router/routes.dart";

/// A resolved in-app navigation target for an incoming deep link.
///
/// [location] is a concrete go_router location (e.g. `/product/t-shirt`,
/// `/shop`, `/`). [isDetail] distinguishes the two navigation families the app
/// uses (see `routes.dart`):
///  - **tabs** (home/shop/search/cart/account) are switched with `router.go(...)`,
///  - **detail** routes (category/product) are PUSHED over the shell with
///    `router.push(...)` so they open full-screen with a back button.
class DeepLinkTarget {
  const DeepLinkTarget(this.location, {required this.isDetail});

  final String location;
  final bool isDetail;

  @override
  String toString() => "DeepLinkTarget($location, isDetail: $isDetail)";

  @override
  bool operator ==(Object other) =>
      other is DeepLinkTarget &&
      other.location == location &&
      other.isDetail == isDetail;

  @override
  int get hashCode => Object.hash(location, isDetail);
}

/// Pure mapping from an incoming deep-link [Uri] to an in-app [DeepLinkTarget].
///
/// It handles BOTH transports the app exposes, normalising them to the same set
/// of canonical routes ([AppRoutes]):
///
///  1. **App Links / Universal Links** — `https://<store-host>/product/t-shirt`.
///     The host is the store domain; the meaningful part is the PATH.
///  2. **Custom-scheme links** — `mautomate://product/t-shirt` (or the per-store
///     scheme). Here Dart parses the first segment as the URI *host*
///     (`uri.host == "product"`), so we fold the host back in as the leading
///     path segment before matching.
///
/// Recognised shapes (mirrors the web-href map in `AppNav.navigateToHref`):
///   /                                   -> home        (tab)
///   /shop | /store | /collections | /products (no id)  -> shop  (tab)
///   /search?q=...                       -> search      (tab)
///   /cart                               -> cart        (tab)
///   /account | /login | /profile        -> account     (tab)
///   /category/:id | /categories/:id     -> category    (detail, push)
///   /product/:handle | /products/:handle -> product     (detail, push)
///
/// Anything unrecognised returns `null` and the caller simply ignores it (an
/// unknown link never navigates to a bogus screen or crashes).
class DeepLinkHandler {
  const DeepLinkHandler._();

  /// Resolve [uri] to a [DeepLinkTarget], or `null` when it maps to nothing
  /// in-app.
  static DeepLinkTarget? resolve(Uri uri) {
    // Fold a custom-scheme host back into the path. For `mautomate://cart` the
    // scheme is "mautomate", host is "cart" and there is no path; for
    // `https://store.com/cart` the host is the domain and the path carries the
    // route — so we only treat the host as a segment for non-http(s) schemes.
    final isWeb = uri.scheme == "http" || uri.scheme == "https";
    final segments = <String>[
      if (!isWeb && uri.host.isNotEmpty) uri.host,
      ...uri.pathSegments.where((s) => s.isNotEmpty),
    ];

    final q = uri.queryParameters["q"];

    if (segments.isEmpty) {
      return const DeepLinkTarget(AppRoutes.home, isDetail: false);
    }

    final first = segments.first.toLowerCase();

    // Detail routes need a second segment (the id / handle).
    if (segments.length >= 2) {
      final id = segments[1];
      if ((first == "category" || first == "categories") && id.isNotEmpty) {
        return DeepLinkTarget(AppRoutes.category(id), isDetail: true);
      }
      if ((first == "product" || first == "products") && id.isNotEmpty) {
        return DeepLinkTarget(AppRoutes.product(id), isDetail: true);
      }
    }

    // Single-segment tab routes.
    switch (first) {
      case "home":
        return const DeepLinkTarget(AppRoutes.home, isDetail: false);
      case "shop":
      case "store":
      case "collections":
      case "products":
      case "product":
        // Bare /products or /shop (no id) with an optional search query.
        if (q != null && q.trim().isNotEmpty) {
          return DeepLinkTarget(AppRoutes.searchQuery(q), isDetail: false);
        }
        return const DeepLinkTarget(AppRoutes.shop, isDetail: false);
      case "search":
        return DeepLinkTarget(AppRoutes.searchQuery(q), isDetail: false);
      case "cart":
        return const DeepLinkTarget(AppRoutes.cart, isDetail: false);
      case "account":
      case "login":
      case "profile":
        return const DeepLinkTarget(AppRoutes.account, isDetail: false);
    }

    return null;
  }

  /// Convenience: resolve a raw string link. Returns `null` for unparseable or
  /// unrecognised links.
  static DeepLinkTarget? resolveString(String? link) {
    final raw = (link ?? "").trim();
    if (raw.isEmpty) return null;
    final uri = Uri.tryParse(raw);
    if (uri == null) return null;
    return resolve(uri);
  }
}
