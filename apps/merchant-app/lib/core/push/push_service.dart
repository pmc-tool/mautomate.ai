// Push-notification scaffolding for the mAutomate merchant app.
//
// ============================ DORMANT UNTIL CONFIGURED ======================
// This ships INERT. Firebase needs platform config that the user provides later
// (android/app/google-services.json + ios GoogleService-Info.plist and the
// matching Gradle/plist wiring). Until those exist:
//   - `bootstrapPushFirebase()` catches the init failure and leaves
//     `gPushFirebaseReady = false`,
//   - every PushService method sees that flag (or catches a throw) and becomes a
//     clean no-op with a debug log.
// The app NEVER crashes for the want of push config. Once the config is dropped
// in, `Firebase.initializeApp()` succeeds, the flag flips true, and registration
// starts working with no further code change.
// ===========================================================================
import "package:dio/dio.dart";
import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../api/dio_client.dart";
import "../router/app_router.dart";

/// Whether `Firebase.initializeApp()` succeeded this launch. When false, push is
/// simply unavailable (no config yet) and every entry point no-ops.
bool gPushFirebaseReady = false;

/// FCM background handler. Must be a top-level (or static) function annotated for
/// the VM entry point. System notifications with a `notification` payload are
/// shown by the OS automatically; we do no Firebase work here, so it stays a
/// safe no-op that never needs Firebase initialized.
@pragma("vm:entry-point")
Future<void> pushBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    debugPrint("[push] background message: ${message.messageId}");
  }
}

/// Attempt to initialize Firebase for push. Call ONCE from `main()` before
/// `runApp`. Guarded: a missing/!invalid config throws and we degrade to a
/// disabled-push app rather than crashing.
Future<void> bootstrapPushFirebase() async {
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(pushBackgroundHandler);
    gPushFirebaseReady = true;
    if (kDebugMode) {
      debugPrint("[push] Firebase initialized — push available");
    }
  } catch (e) {
    gPushFirebaseReady = false;
    if (kDebugMode) {
      debugPrint("[push] Firebase not configured — push disabled ($e)");
    }
  }
}

/// Coordinates FCM registration with the merchant session and routes taps.
///
/// Lifecycle (driven from `app.dart` on auth transitions):
///   - signed in  -> [registerDevice]  (permission + token + POST /merchant/devices)
///   - signed out -> [unregister]      (DELETE token + FCM deleteToken)
class PushService {
  PushService(this._ref);

  final Ref _ref;

  bool _listenersWired = false;

  Dio get _dio => _ref.read(dioProvider);

  String get _platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? "ios" : "android";

  /// True only when Firebase came up this launch.
  bool get _available => gPushFirebaseReady;

  /// Request permission, obtain the FCM token, and register it with the backend
  /// for the signed-in merchant. Safe no-op when Firebase isn't configured.
  Future<void> registerDevice() async {
    if (!_available) {
      if (kDebugMode) debugPrint("[push] registerDevice skipped — unavailable");
      return;
    }
    try {
      final messaging = FirebaseMessaging.instance;

      // Prompt for permission (Android 13+, iOS). We register the token even if
      // the user declines — data messages still deliver and they can enable
      // alerts later in system settings.
      await messaging.requestPermission();

      _wireListeners();

      final token = await messaging.getToken();
      if (token == null || token.isEmpty) {
        if (kDebugMode) debugPrint("[push] no FCM token yet");
        return;
      }
      await _postToken(token);

      // Cold-start: if the app was launched by tapping a notification, honour
      // its deep link now that we're signed in and the router is ready.
      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        _routeFromData(initial.data);
      }
    } catch (e) {
      if (kDebugMode) debugPrint("[push] registerDevice failed: $e");
    }
  }

  /// Remove this device's token on sign-out so a signed-out phone stops getting
  /// this merchant's notifications. Safe no-op when unavailable.
  Future<void> unregister() async {
    if (!_available) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        // Best-effort backend removal (endpoint is idempotent).
        try {
          await _dio.post<dynamic>(
            "/merchant/devices/unregister",
            data: {"token": token},
          );
        } catch (_) {
          // Sign-out must never be blocked by a failed unregister.
        }
      }
      await messaging.deleteToken();
    } catch (e) {
      if (kDebugMode) debugPrint("[push] unregister failed: $e");
    }
  }

  // --------------------------------------------------------------- internals

  void _wireListeners() {
    if (_listenersWired) return;
    _listenersWired = true;
    try {
      final messaging = FirebaseMessaging.instance;

      // A refreshed token must be re-registered so we keep reaching the device.
      messaging.onTokenRefresh.listen((token) {
        if (token.isNotEmpty) {
          _postToken(token);
        }
      });

      // Foreground messages: the OS does not auto-display these. We log for now;
      // an in-app banner can be layered on later without changing this contract.
      FirebaseMessaging.onMessage.listen((message) {
        if (kDebugMode) {
          debugPrint("[push] foreground message: ${message.data}");
        }
      });

      // Tap on a notification that opened (from background) the app.
      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        _routeFromData(message.data);
      });
    } catch (e) {
      if (kDebugMode) debugPrint("[push] wiring listeners failed: $e");
    }
  }

  Future<void> _postToken(String token) async {
    try {
      await _dio.post<dynamic>(
        "/merchant/devices",
        data: {"token": token, "platform": _platform},
      );
      if (kDebugMode) debugPrint("[push] registered device ($_platform)");
    } catch (e) {
      // A registration failure is non-fatal; we retry on the next sign-in /
      // token refresh.
      if (kDebugMode) debugPrint("[push] token registration failed: $e");
    }
  }

  /// Deep-link a tapped notification to the right screen. The backend sends a
  /// go_router path in `data.route` (e.g. "/orders", "/products", "/jarvis").
  void _routeFromData(Map<String, dynamic> data) {
    final route = data["route"];
    if (route is! String || route.isEmpty) return;
    // Only honour known in-app roots — never navigate to an arbitrary string.
    const allowed = {"/home", "/orders", "/products", "/jarvis"};
    if (!allowed.contains(route)) return;
    try {
      _ref.read(goRouterProvider).go(route);
    } catch (e) {
      if (kDebugMode) debugPrint("[push] routing failed: $e");
    }
  }
}

/// The push service, bound to the app's providers (Dio + router).
final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));
