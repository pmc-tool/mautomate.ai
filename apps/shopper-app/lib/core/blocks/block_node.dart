import "package:flutter/foundation.dart";

/// A single renderable block, normalized to a `{ type, props }` node.
///
/// The LIVE app-render endpoint (`GET /store/cms/app/pages/:slug`) returns the
/// block tree as a FLAT, rank-ordered `page.sections[]` array — there is NO Puck
/// `{root, content}` wrapper (see `apps/backend/SHOPPER_BLOCK_CATALOG.md`). Each
/// section is:
///
///   `{ block_type: string, schema_version: number, ...props }`
///
/// i.e. the props are siblings of `block_type`, NOT nested under a `props` key.
/// [BlockNode] / [StorePage] normalize that (and, defensively, a generic
/// `{ type, props }` / `content` list) into ordered nodes so the registry has
/// ONE contract: dispatch on [BlockNode.type] (== `block_type`) and read
/// [BlockNode.props]. Render sections top-to-bottom in array order.
@immutable
class BlockNode {
  const BlockNode({required this.type, required this.props});

  /// The block discriminator the registry keys on (e.g. `hero_slider`,
  /// `rich_text`, `product_tabs`).
  final String type;

  /// The block's props. For a Puck node these are `item["props"]`; for a CMS
  /// section they are every key except `block_type` / `schema_version`.
  final Map<String, dynamic> props;

  /// The block's declared schema version (CMS snapshots stamp one; Puck nodes
  /// default to 0). Renderers may branch on it as the catalog evolves.
  int get schemaVersion {
    final v = props["schema_version"] ?? props["\$schemaVersion"];
    return v is int ? v : (v is num ? v.toInt() : 0);
  }
}

/// A normalized, renderable page: ordered [content] blocks plus the [root]
/// props (page-level layout hints) and any [meta] the backend attached.
@immutable
class StorePage {
  const StorePage({
    required this.content,
    this.root = const {},
    this.meta = const {},
    this.seo = const {},
  });

  /// Ordered blocks to render top-to-bottom.
  final List<BlockNode> content;

  /// Puck `root.props` (page-level settings, if any).
  final Map<String, dynamic> root;

  /// CMS `meta` (title, is_home, entity ids), if present.
  final Map<String, dynamic> meta;

  /// SEO block, if present.
  final Map<String, dynamic> seo;

  bool get isEmpty => content.isEmpty;

  /// Best-effort page title from Puck root props or CMS meta.
  String? get title {
    final rootTitle = root["title"];
    if (rootTitle is String && rootTitle.isNotEmpty) return rootTitle;
    final metaTitle = meta["title"];
    if (metaTitle is String && metaTitle.isNotEmpty) return metaTitle;
    return null;
  }

  /// Parse either supported page shape (or a `{ page: ... }` envelope) into a
  /// normalized [StorePage]. Defensive: unknown/mis-shaped items are skipped, not
  /// thrown on, so a single bad block never fails the whole page.
  factory StorePage.fromJson(Map<String, dynamic> json) {
    // Unwrap a `{ page: {...} }` envelope (the store CMS read uses this).
    final root0 = json["page"];
    final Map<String, dynamic> page =
        root0 is Map<String, dynamic> ? root0 : json;

    // Shape A: Puck `content` array. Shape B: CMS `sections` array.
    final rawList = page["content"] ?? page["sections"] ?? const [];
    final List items = rawList is List ? rawList : const [];

    final nodes = <BlockNode>[];
    for (final raw in items) {
      final node = _nodeFrom(raw);
      if (node != null) nodes.add(node);
    }

    final rootObj = page["root"];
    final rootProps = rootObj is Map<String, dynamic>
        ? (rootObj["props"] is Map<String, dynamic>
            ? rootObj["props"] as Map<String, dynamic>
            : rootObj)
        : const <String, dynamic>{};

    final metaObj = page["meta"];
    final seoObj = page["seo"];

    return StorePage(
      content: nodes,
      root: rootProps,
      meta: metaObj is Map<String, dynamic> ? metaObj : const {},
      seo: seoObj is Map<String, dynamic> ? seoObj : const {},
    );
  }

  static BlockNode? _nodeFrom(dynamic raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();

    // Puck node: has a `type` and (usually) a nested `props` object.
    final puckType = map["type"];
    if (puckType is String && puckType.isNotEmpty) {
      final p = map["props"];
      return BlockNode(
        type: puckType,
        props: p is Map ? p.cast<String, dynamic>() : const {},
      );
    }

    // CMS section: `block_type` with props spread flat on the object.
    final cmsType = map["block_type"];
    if (cmsType is String && cmsType.isNotEmpty) {
      final props = Map<String, dynamic>.from(map)
        ..remove("block_type");
      return BlockNode(type: cmsType, props: props);
    }

    return null;
  }
}
