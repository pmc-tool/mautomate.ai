import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../config/app_config.dart";
import "../config/config_providers.dart";
import "block_data.dart";
import "block_node.dart";
import "block_registry.dart";
import "default_registry.dart";
import "unknown_block.dart";

/// Renders a normalized [StorePage] into a native, scrollable column of blocks.
///
/// The heart of the server-driven engine: it walks the page's ordered
/// [StorePage.content] (the flat `page.sections[]` array), dispatches each
/// block's `block_type` through the [BlockRegistry], and stacks the resulting
/// native widgets top-to-bottom. Three degrade paths, none of which crash:
///  - UNKNOWN `block_type` -> [UnknownBlock] (debug placeholder / nothing in
///    release).
///  - `schema_version` newer than the renderer supports -> skipped (catalog's
///    forward-compat rule).
///  - a renderer that itself throws -> caught per-block, degraded to fallback,
///    so one bad block cannot take down the page.
///
/// Blocks are full-bleed by contract (each owns its horizontal padding), so the
/// page adds no gutters — heroes and banners can run edge to edge.
class PageRenderer extends ConsumerWidget {
  const PageRenderer({
    super.key,
    required this.page,
    this.padding = EdgeInsets.zero,
    this.physics,
    this.shrinkWrap = false,
    this.leading,
    this.trailing,
  });

  /// The normalized page to render.
  final StorePage page;

  /// Outer scroll padding (usually zero — blocks are full-bleed).
  final EdgeInsetsGeometry padding;

  final ScrollPhysics? physics;
  final bool shrinkWrap;

  /// Optional widget rendered ABOVE the blocks (e.g. a store header).
  final Widget? leading;

  /// Optional widget rendered BELOW the blocks (e.g. a footer).
  final Widget? trailing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final registry = ref.watch(blockRegistryProvider);
    final config = ref.watch(appConfigProvider);

    final children = <Widget>[
      if (leading != null) leading!,
      for (final node in page.content)
        _SafeBlock(node: node, registry: registry, config: config),
      if (trailing != null) trailing!,
    ];

    return ListView(
      padding: padding,
      physics: physics,
      shrinkWrap: shrinkWrap,
      children: children,
    );
  }
}

/// Builds ONE block, applying the forward-compat guard and catching any error
/// the renderer throws so a single broken/newer block degrades to the fallback
/// instead of failing the whole page.
class _SafeBlock extends StatelessWidget {
  const _SafeBlock({
    required this.node,
    required this.registry,
    required this.config,
  });

  final BlockNode node;
  final BlockRegistry registry;
  final AppConfig config;

  @override
  Widget build(BuildContext context) {
    final reg = registry.registrationFor(node.type);
    // Unknown type -> graceful fallback.
    if (reg == null) return UnknownBlock(type: node.type);
    // A block newer than this renderer understands is skipped, not mis-rendered.
    if (node.schemaVersion > reg.maxSchemaVersion) {
      return UnknownBlock(
        type: "${node.type} v${node.schemaVersion} > v${reg.maxSchemaVersion}",
      );
    }
    try {
      return reg.builder(context, BlockData(node, config));
    } catch (e, st) {
      debugPrint('[blocks] renderer for "${node.type}" threw: $e\n$st');
      return UnknownBlock(type: node.type);
    }
  }
}
