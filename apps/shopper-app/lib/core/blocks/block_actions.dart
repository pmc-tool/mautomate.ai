/// The single navigation SEAM the block renderers emit through.
///
/// Every renderer routes its taps through [handleBlockHref] (for a CMS `href`)
/// or [handleProductTap] (for a product card), so navigation is wired in ONE
/// place — here — not across the ~13 renderer files.
///
/// Internal hrefs map to app routes via [AppNav.navigateToHref]
/// (`/store`, `/store?q=…`, `/cart`, `/account`, `/category/:id`,
/// `/product/:handle`, …); `http(s)`/`mailto`/`tel` open via `url_launcher`;
/// `#`/empty is a no-op.
library;

import "dart:async";

import "package:flutter/foundation.dart";
import "package:flutter/widgets.dart";
import "package:url_launcher/url_launcher.dart";

import "../api/store_product.dart";
import "../router/routes.dart";

/// Handle a CMS block CTA `href`. Internal paths map to app routes; external
/// URLs open in the browser; `#`/empty is a no-op.
void handleBlockHref(BuildContext context, String? href) {
  final target = href?.trim();
  if (target == null || target.isEmpty || target == "#") return;

  // Try in-app navigation first (returns false for external / unknown).
  if (context.navigateToHref(target)) return;

  // External schemes open in the browser.
  final lower = target.toLowerCase();
  if (lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("mailto:") ||
      lower.startsWith("tel:")) {
    unawaited(_launchExternal(target));
  } else if (kDebugMode) {
    debugPrint('[block-nav] unhandled href: "$target"');
  }
}

Future<void> _launchExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  } catch (e) {
    if (kDebugMode) debugPrint('[block-nav] launch failed for "$url": $e');
  }
}

/// Handle a product-card tap → the product detail screen. Falls back to the id
/// when the handle is absent.
void handleProductTap(BuildContext context, StoreProduct product) {
  final handle = product.handle;
  context.pushProduct(
    (handle != null && handle.isNotEmpty) ? handle : product.id,
  );
}
