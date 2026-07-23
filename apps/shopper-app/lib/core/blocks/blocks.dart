/// Barrel export for the server-driven block-renderer engine.
///
/// The engine that turns a store's CMS/Puck page JSON into native Flutter UI:
///
///  - [StorePage] / [BlockNode] — normalize either backend shape (Puck
///    `{root, content}` OR CMS `{page:{sections}}`) into ordered `{type, props}`.
///  - [BlockData] — the typed, defensive prop accessor handed to every renderer.
///  - [BlockBuilder] / [BlockRegistry] — the `type -> widget` registry contract
///    Wave 2 builds ~20 renderers against.
///  - [defaultBlockRegistry] / [blockRegistryProvider] — the wired starter set.
///  - [PageRenderer] — stacks the blocks into a scrollable native page,
///    degrading unknown/broken blocks to [UnknownBlock] (never crashing).
///
/// ```dart
/// import "package:mautomate_shopper/core/blocks/blocks.dart";
/// ```
library;

export "block_data.dart";
export "block_node.dart";
export "block_registry.dart";
export "default_registry.dart";
export "page_renderer.dart";
export "unknown_block.dart";
