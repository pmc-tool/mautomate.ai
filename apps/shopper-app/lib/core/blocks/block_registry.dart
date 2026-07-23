import "package:flutter/widgets.dart";

import "block_data.dart";

/// A renderer: given a [BuildContext] and the block's [BlockData], return the
/// native widget for that block. This IS the extension point — Wave 2 writes
/// ~20 of these (one per catalog block) and registers them below.
typedef BlockBuilder = Widget Function(BuildContext context, BlockData data);

/// One registry entry: the [builder] plus the highest `schema_version` of that
/// block type this renderer understands.
@immutable
class BlockRegistration {
  const BlockRegistration(this.builder, {this.maxSchemaVersion = 1});

  final BlockBuilder builder;

  /// The newest schema this renderer supports. Per the catalog's forward-compat
  /// rule, the page renderer SKIPS a block whose `schema_version` exceeds this
  /// (a newer server can ship a block shape this binary predates) rather than
  /// mis-rendering it.
  final int maxSchemaVersion;
}

/// The block-type -> renderer registry.
///
/// The single mapping from a CMS block `block_type` string to a native Flutter
/// widget builder. Lookups are O(1). The registry is immutable: [withBlocks]
/// returns a NEW registry with extra registrations layered on, so Wave 2 (or a
/// test) can extend the default set without mutating global state.
///
/// Aliases are first-class: several `block_type` strings may map to the same
/// builder (e.g. the CMS `hero_slider` and a generic `hero`), so the same engine
/// renders alternate keys.
class BlockRegistry {
  BlockRegistry(Map<String, BlockRegistration> entries)
      : _entries = Map.unmodifiable(entries);

  /// Convenience: build a registry from bare builders (each defaulting to
  /// `maxSchemaVersion: 1`).
  factory BlockRegistry.of(Map<String, BlockBuilder> builders) => BlockRegistry(
        builders.map((k, v) => MapEntry(k, BlockRegistration(v))),
      );

  final Map<String, BlockRegistration> _entries;

  /// The registration for [type], or null when unregistered (the page renderer
  /// then shows its graceful fallback — never a crash).
  BlockRegistration? registrationFor(String type) => _entries[type];

  /// The renderer for [type], or null when unregistered.
  BlockBuilder? builderFor(String type) => _entries[type]?.builder;

  /// Whether [type] has a registered renderer.
  bool isRegistered(String type) => _entries.containsKey(type);

  /// Whether this registry can render [type] at [schemaVersion] — registered AND
  /// the version is within the renderer's supported range.
  bool supports(String type, int schemaVersion) {
    final reg = _entries[type];
    return reg != null && schemaVersion <= reg.maxSchemaVersion;
  }

  /// All registered type keys (for diagnostics / the debug overlay).
  Iterable<String> get registeredTypes => _entries.keys;

  /// A new registry with [extra] registrations added (overriding same-keyed
  /// defaults). Use this to extend the default set.
  BlockRegistry withBlocks(Map<String, BlockRegistration> extra) =>
      BlockRegistry({..._entries, ...extra});
}
