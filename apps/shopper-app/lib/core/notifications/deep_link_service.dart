import "dart:async";

import "package:app_links/app_links.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../router/app_router.dart";
import "deep_link_handler.dart";

/// Receives OS-level deep links — Android App Links, iOS Universal Links, and
/// custom-scheme URLs (`mautomate://…` / the per-store scheme) — for BOTH cold
/// start (app launched by a link) and warm start (link opened while running),
/// and routes them through [DeepLinkHandler] into go_router.
///
/// Transport is the `app_links` package rather than go_router's built-in
/// platform-route ingestion, because the latter only reliably maps http(s)
/// paths — custom schemes arrive as `scheme://<segment>/…` which needs the
/// host-folding [DeepLinkHandler] performs. Handling everything here keeps one
/// consistent mapping and avoids double-navigation.
class DeepLinkService {
  DeepLinkService(this._ref);

  final Ref _ref;
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  bool _initialized = false;
  String? _lastHandled;

  GoRouter get _router => _ref.read(routerProvider);

  /// Wire the cold-start link and the warm-link stream. Idempotent.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        _handle(initial, replace: true);
      }
    } catch (e) {
      if (kDebugMode) debugPrint("[deeplink] initial link failed: $e");
    }
    _sub = _appLinks.uriLinkStream.listen(
      (uri) => _handle(uri),
      onError: (Object e) {
        if (kDebugMode) debugPrint("[deeplink] stream error: $e");
      },
    );
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
  }

  void _handle(Uri uri, {bool replace = false}) {
    final target = DeepLinkHandler.resolve(uri);
    if (target == null) {
      if (kDebugMode) debugPrint("[deeplink] ignored: $uri");
      return;
    }
    // Guard against the same link being delivered twice (some platforms emit
    // both an initial link and a stream event for one launch).
    final key = "${target.location}|$replace";
    if (key == _lastHandled) return;
    _lastHandled = key;

    try {
      if (target.isDetail) {
        // Detail routes push over the shell (full-screen, back button).
        _router.push(target.location);
      } else if (replace) {
        // Cold start: replace the initial home location with the linked tab.
        _router.go(target.location);
      } else {
        _router.go(target.location);
      }
      if (kDebugMode) debugPrint("[deeplink] -> ${target.location}");
    } catch (e) {
      if (kDebugMode) debugPrint("[deeplink] routing failed: $e");
    }
  }
}

/// The deep-link service, bound to the app router.
final deepLinkServiceProvider =
    Provider<DeepLinkService>((ref) => DeepLinkService(ref));
