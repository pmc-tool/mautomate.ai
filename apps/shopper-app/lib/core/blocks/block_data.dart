import "package:flutter/foundation.dart";

import "../config/app_config.dart";
import "block_node.dart";

/// The typed, defensive view of one block's props handed to every renderer.
///
/// Renderers NEVER read `node.props["x"]` directly — CMS/Puck JSON is untyped
/// and a merchant can leave any field null or wrong-typed. [BlockData] centralises
/// safe coercion (`str`, `boolean`, `integer`, `list`, `maps`) and asset-URL
/// resolution so ~20 Wave-2 renderers stay short and crash-proof: a missing or
/// malformed field yields a sensible default, never an exception.
///
/// ### Renderer contract (Wave 2 reads this)
/// A renderer is a `BlockBuilder`: `Widget Function(BuildContext, BlockData)`.
/// - Read props ONLY via the helpers below (or `raw` for exotic shapes).
/// - Resolve every image/media URL through [asset] so relative CMS paths
///   (`/learts/assets/...`) become absolute against `AppConfig.cmsBase`.
/// - Return a full-bleed section widget (own horizontal padding); the
///   [PageRenderer] stacks sections vertically with no added gutters.
/// - NEVER throw. If required data is absent, render nothing
///   (`SizedBox.shrink()`) or a graceful minimal state.
@immutable
class BlockData {
  const BlockData(this.node, this.config);

  final BlockNode node;
  final AppConfig config;

  /// The block type (registry key).
  String get type => node.type;

  /// The raw props map, for renderers that need shapes the helpers do not cover.
  Map<String, dynamic> get raw => node.props;

  int get schemaVersion => node.schemaVersion;

  // ---- Scalars ----------------------------------------------------------

  /// A string prop, or null when absent/empty/non-string.
  String? str(String key) {
    final v = node.props[key];
    if (v is String) {
      final t = v.trim();
      return t.isEmpty ? null : v;
    }
    return null;
  }

  /// A string prop with a fallback.
  String strOr(String key, String fallback) => str(key) ?? fallback;

  /// A boolean prop (accepts real bools and the strings "true"/"false").
  bool boolean(String key, {bool fallback = false}) {
    final v = node.props[key];
    if (v is bool) return v;
    if (v is String) return v.toLowerCase() == "true";
    return fallback;
  }

  /// A numeric prop as double, or [fallback].
  double number(String key, {double fallback = 0}) {
    final v = node.props[key];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? fallback;
    return fallback;
  }

  /// A numeric prop as int, or [fallback].
  int integer(String key, {int fallback = 0}) {
    final v = node.props[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? fallback;
    return fallback;
  }

  // ---- Collections ------------------------------------------------------

  /// A list prop (any element type), or an empty list.
  List<dynamic> list(String key) {
    final v = node.props[key];
    return v is List ? v : const [];
  }

  /// A list of object props, each cast to a string-keyed map (non-maps dropped).
  List<Map<String, dynamic>> maps(String key) {
    return list(key)
        .whereType<Map>()
        .map((m) => m.cast<String, dynamic>())
        .toList(growable: false);
  }

  /// A nested object prop, or an empty map.
  Map<String, dynamic> object(String key) {
    final v = node.props[key];
    return v is Map ? v.cast<String, dynamic>() : const {};
  }

  // ---- Assets -----------------------------------------------------------

  /// Resolve an image/media URL prop to an absolute URL against the store's
  /// CMS origin. Relative CMS paths become absolute; absolute + data URIs pass
  /// through. Returns null when absent.
  String? asset(String key) => config.resolveAsset(str(key));

  /// Resolve an arbitrary (already-extracted) URL string against the CMS origin.
  String? resolve(String? url) => config.resolveAsset(url);
}
