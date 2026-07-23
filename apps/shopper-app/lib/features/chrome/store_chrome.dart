import "package:flutter/foundation.dart";

/// Typed, defensive view of the store chrome the app-render endpoint returns
/// under the `chrome` key (`{ topbar, header, footer }`).
///
/// These are GLOBAL store settings (the same objects the web storefront reads
/// from `GET /store/cms/settings`), delivered alongside the page so the native
/// app can draw the announcement bar / header / footer without a second call
/// (see `apps/backend/SHOPPER_BLOCK_CATALOG.md`).
///
/// Every model parses from a loose `Map` and NEVER throws — a missing or
/// mis-shaped group simply yields `null`/empty so that visual area is not drawn.
@immutable
class StoreChrome {
  const StoreChrome({this.topbar, this.header, this.footer});

  final ChromeTopbar? topbar;
  final ChromeHeader? header;
  final ChromeFooter? footer;

  /// The neutral empty chrome (draw nothing) — first paint before load.
  static const StoreChrome empty = StoreChrome();

  bool get isEmpty => topbar == null && header == null && footer == null;

  /// Parse the raw `chrome` map from the app-render payload.
  factory StoreChrome.fromPayload(Map<String, dynamic>? chrome) {
    if (chrome == null) return StoreChrome.empty;
    return StoreChrome(
      topbar: _mapOrNull(chrome["topbar"], ChromeTopbar.fromJson),
      header: _mapOrNull(chrome["header"], ChromeHeader.fromJson),
      footer: _mapOrNull(chrome["footer"], ChromeFooter.fromJson),
    );
  }
}

// ---------------------------------------------------------------------------
// Topbar (announcement bar)
// ---------------------------------------------------------------------------

/// `chrome.topbar` — `{ message, enabled, language_label, currency_label, links[] }`.
@immutable
class ChromeTopbar {
  const ChromeTopbar({
    required this.enabled,
    this.message,
    this.languageLabel,
    this.currencyLabel,
    this.links = const [],
  });

  final bool enabled;
  final String? message;
  final String? languageLabel;
  final String? currencyLabel;
  final List<ChromeLink> links;

  /// Whether there is anything worth drawing.
  bool get hasContent =>
      enabled &&
      (_notEmpty(message) ||
          links.isNotEmpty ||
          _notEmpty(languageLabel) ||
          _notEmpty(currencyLabel));

  factory ChromeTopbar.fromJson(Map<String, dynamic> json) => ChromeTopbar(
        enabled: _boolOr(json["enabled"], true),
        message: _str(json, const ["message", "text"]),
        languageLabel: _str(json, const ["language_label", "language"]),
        currencyLabel: _str(json, const ["currency_label", "currency"]),
        links: _links(json["links"]),
      );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/// `chrome.header` — logo, search config, icon toggles and the nav menu.
@immutable
class ChromeHeader {
  const ChromeHeader({
    this.logo,
    this.logoAlt,
    this.searchEnabled = true,
    this.searchPlaceholder,
    this.searchAction,
    this.showAccount = true,
    this.showWishlist = false,
    this.showCart = true,
    this.menu = const [],
  });

  final String? logo;
  final String? logoAlt;
  final bool searchEnabled;
  final String? searchPlaceholder;

  /// The href the search box submits to (e.g. `/store?q=`).
  final String? searchAction;

  final bool showAccount;
  final bool showWishlist;
  final bool showCart;
  final List<ChromeMenuItem> menu;

  /// True when any menu item expands into live store categories — the header
  /// should offer a categories menu/drawer.
  bool get hasCategoryMenu => menu.any((m) => m.expandsCategories);

  factory ChromeHeader.fromJson(Map<String, dynamic> json) {
    final search = _asMap(json["search"]);
    final icons = _asMap(json["icons"]);
    return ChromeHeader(
      logo: _str(json, const ["logo"]),
      logoAlt: _str(json, const ["logo_alt", "logoAlt"]),
      searchEnabled: _boolOr(search["enabled"], true),
      searchPlaceholder: _str(search, const ["placeholder"]),
      searchAction: _str(search, const ["action", "href"]),
      showAccount: _boolOr(icons["account"], true),
      showWishlist: _boolOr(icons["wishlist"], false),
      showCart: _boolOr(icons["cart"], true),
      menu: _menu(json["menu"]),
    );
  }
}

/// A header nav item. A sentinel with `label == "__dynamic_categories__"` (or an
/// item flagged `children_dynamic`) expands into live top-level categories.
@immutable
class ChromeMenuItem {
  const ChromeMenuItem({
    required this.label,
    this.href,
    this.childrenDynamic = false,
    this.source,
    this.limit,
  });

  final String label;
  final String? href;
  final bool childrenDynamic;
  final String? source;
  final int? limit;

  /// The magic label that means "expand into the store's live categories".
  static const String dynamicCategoriesSentinel = "__dynamic_categories__";

  bool get isDynamicSentinel => label == dynamicCategoriesSentinel;

  /// Whether this item should be replaced/augmented by live categories.
  bool get expandsCategories => isDynamicSentinel || childrenDynamic;

  factory ChromeMenuItem.fromJson(Map<String, dynamic> json) => ChromeMenuItem(
        label: _str(json, const ["label", "title", "name"]) ?? "",
        href: _str(json, const ["href", "url", "link"]),
        childrenDynamic: _boolOr(json["children_dynamic"], false),
        source: _str(json, const ["source"]),
        limit: _intOrNull(json["limit"]),
      );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

/// `chrome.footer` — contact block, link columns, socials, newsletter mention,
/// payment strip and copyright (`{year}` substituted).
@immutable
class ChromeFooter {
  const ChromeFooter({
    this.contact,
    this.columns = const [],
    this.social = const [],
    this.newsletter,
    this.bottomLogo,
    this.paymentImage,
    this.copyright,
  });

  final FooterContact? contact;
  final List<FooterColumn> columns;
  final List<ChromeLink> social;
  final FooterNewsletter? newsletter;
  final String? bottomLogo;
  final String? paymentImage;
  final String? copyright;

  bool get isEmpty =>
      contact == null &&
      columns.isEmpty &&
      social.isEmpty &&
      newsletter == null &&
      !_notEmpty(copyright) &&
      !_notEmpty(paymentImage) &&
      !_notEmpty(bottomLogo);

  /// The copyright line with a `{year}` token replaced by the current year.
  String? get resolvedCopyright {
    final c = copyright;
    if (c == null || c.isEmpty) return null;
    return c.replaceAll("{year}", DateTime.now().year.toString());
  }

  factory ChromeFooter.fromJson(Map<String, dynamic> json) {
    final columns = <FooterColumn>[];

    // `column_categories` — a single column of category links (any list shape).
    final catCol = FooterColumn.fromJson(
      json["column_categories"],
      fallbackTitle: "Categories",
    );
    if (catCol != null) columns.add(catCol);

    // `column_links` — an array of link columns.
    final rawCols = json["column_links"];
    if (rawCols is List) {
      for (final raw in rawCols) {
        final col = FooterColumn.fromJson(raw);
        if (col != null) columns.add(col);
      }
    }

    return ChromeFooter(
      contact: FooterContact.fromJson(json["contact"]),
      columns: columns,
      social: _links(json["social"]),
      newsletter: FooterNewsletter.fromJson(json["newsletter"]),
      bottomLogo: _str(json, const ["bottom_logo", "bottomLogo"]),
      paymentImage: _str(json, const ["payment_image", "paymentImage"]),
      copyright: _str(json, const ["copyright"]),
    );
  }
}

/// A footer link column: a heading plus a list of links.
@immutable
class FooterColumn {
  const FooterColumn({this.title, this.links = const []});

  final String? title;
  final List<ChromeLink> links;

  bool get isEmpty => links.isEmpty && !_notEmpty(title);

  /// Parse a column from either `{title, links|items|categories}` or a bare
  /// list of links. Returns null when there is nothing to show.
  static FooterColumn? fromJson(dynamic raw, {String? fallbackTitle}) {
    if (raw is List) {
      final links = _links(raw);
      if (links.isEmpty) return null;
      return FooterColumn(title: fallbackTitle, links: links);
    }
    if (raw is Map) {
      final map = raw.cast<String, dynamic>();
      final links = _links(
        map["links"] ?? map["items"] ?? map["categories"] ?? map["children"],
      );
      final title =
          _str(map, const ["title", "heading", "label"]) ?? fallbackTitle;
      final col = FooterColumn(title: title, links: links);
      return col.isEmpty ? null : col;
    }
    return null;
  }
}

/// The footer contact block.
@immutable
class FooterContact {
  const FooterContact({this.title, this.lines = const []});

  final String? title;
  final List<String> lines;

  bool get isEmpty => lines.isEmpty && !_notEmpty(title);

  static FooterContact? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final lines = <String>[];
    for (final key in const ["address", "phone", "email", "text", "hours"]) {
      final v = map[key];
      if (v is String && v.trim().isNotEmpty) lines.add(v.trim());
    }
    // Also accept an explicit `lines` array.
    final rawLines = map["lines"];
    if (rawLines is List) {
      for (final l in rawLines) {
        if (l is String && l.trim().isNotEmpty) lines.add(l.trim());
      }
    }
    final contact = FooterContact(
      title: _str(map, const ["title", "heading"]),
      lines: lines,
    );
    return contact.isEmpty ? null : contact;
  }
}

/// The footer newsletter mention (the actual subscribe form is Wave 2b).
@immutable
class FooterNewsletter {
  const FooterNewsletter({this.title, this.subtitle, this.placeholder});

  final String? title;
  final String? subtitle;
  final String? placeholder;

  bool get isEmpty =>
      !_notEmpty(title) && !_notEmpty(subtitle) && !_notEmpty(placeholder);

  static FooterNewsletter? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final n = FooterNewsletter(
      title: _str(map, const ["title", "heading"]),
      subtitle: _str(map, const ["subtitle", "description", "text"]),
      placeholder: _str(map, const ["placeholder"]),
    );
    return n.isEmpty ? null : n;
  }
}

// ---------------------------------------------------------------------------
// Shared: a label + href link
// ---------------------------------------------------------------------------

/// A generic `{ label, href }` link used across topbar links, menu items,
/// footer columns and socials. Socials additionally carry a [platform] hint.
@immutable
class ChromeLink {
  const ChromeLink({required this.label, this.href, this.platform});

  final String label;
  final String? href;

  /// For socials: the network name (`instagram`, `facebook`, …) used to pick a
  /// glyph. Null for ordinary links.
  final String? platform;

  factory ChromeLink.fromJson(Map<String, dynamic> json) => ChromeLink(
        label: _str(json, const ["label", "title", "name", "platform", "network"]) ??
            "",
        href: _str(json, const ["href", "url", "link"]),
        platform: _str(json, const ["platform", "network", "icon", "name"]),
      );
}

// ---------------------------------------------------------------------------
// Parsing helpers (private)
// ---------------------------------------------------------------------------

Map<String, dynamic> _asMap(dynamic v) =>
    v is Map ? v.cast<String, dynamic>() : const {};

T? _mapOrNull<T>(dynamic v, T Function(Map<String, dynamic>) parse) =>
    v is Map ? parse(v.cast<String, dynamic>()) : null;

bool _notEmpty(String? s) => s != null && s.trim().isNotEmpty;

bool _boolOr(dynamic v, bool fallback) {
  if (v is bool) return v;
  if (v is String) {
    final s = v.toLowerCase().trim();
    if (s == "true" || s == "1" || s == "yes") return true;
    if (s == "false" || s == "0" || s == "no") return false;
  }
  if (v is num) return v != 0;
  return fallback;
}

int? _intOrNull(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v.trim());
  return null;
}

String? _str(Map<String, dynamic> map, List<String> keys) {
  for (final k in keys) {
    final v = map[k];
    if (v is String && v.trim().isNotEmpty) return v.trim();
  }
  return null;
}

List<ChromeLink> _links(dynamic raw) {
  if (raw is! List) return const [];
  final out = <ChromeLink>[];
  for (final item in raw) {
    if (item is Map) {
      final link = ChromeLink.fromJson(item.cast<String, dynamic>());
      if (link.label.isNotEmpty || _notEmpty(link.href)) out.add(link);
    } else if (item is String && item.trim().isNotEmpty) {
      out.add(ChromeLink(label: item.trim()));
    }
  }
  return out;
}

List<ChromeMenuItem> _menu(dynamic raw) {
  if (raw is! List) return const [];
  final out = <ChromeMenuItem>[];
  for (final item in raw) {
    if (item is Map) {
      final mi = ChromeMenuItem.fromJson(item.cast<String, dynamic>());
      if (mi.label.isNotEmpty) out.add(mi);
    }
  }
  return out;
}
