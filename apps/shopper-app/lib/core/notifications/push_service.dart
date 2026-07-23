// Push-notification scaffolding for the mAutomate shopper app.
//
// ============================ DORMANT UNTIL CONFIGURED ======================
// This ships INERT. Firebase needs platform config the store owner provides
// later (android/app/google-services.json + ios GoogleService-Info.plist, plus
// an APNs key for iOS — see PUSH_SETUP.md). Until those exist:
//   - `bootstrapPushFirebase()` catches the init failure and leaves
//     `gPushFirebaseReady = false`,
//   - every PushService method sees that flag (or catches a throw) and becomes a
//     clean no-op with a debug log.
// The app NEVER crashes for the want of push config, and builds a release APK
// with NO google-services.json (the Gradle plugin is applied only when that file
// is present — see android/app/build.gradle.kts). Once the config is dropped in,
// `Firebase.initializeApp()` succeeds, the flag flips true, and registration
// starts working with no further Dart change.
// ===========================================================================
import "dart:convert";

import "package:dio/dio.dart";
import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";
import "package:flutter/foundation.dart";
import "package:flutter_local_notifications/flutter_local_notifications.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/auth/auth_store.dart";
import "../api/dio_client.dart";
import "../router/app_router.dart";
import "deep_link_handler.dart";

/// Whether `Firebase.initializeApp()` succeeded this launch. When false, push is
/// simply unavailable (no config yet) and every entry point no-ops.
bool gPushFirebaseReady = false;

/// Android notification channel used to surface FOREGROUND messages (the OS
/// does not auto-display data/foreground messages, so we render them locally).
const AndroidNotificationChannel _kChannel = AndroidNotificationChannel(
  "shopper_default",
  "Store notifications",
  description: "Order updates, offers and messages from the store.",
  importance: Importance.high,
);

/// FCM background isolate handler. Must be a top-level (or static) function
/// annotated for the VM entry point. System notifications that carry a
/// `notification` payload are shown by the OS automatically; we do no Firebase
/// work here, so this stays a safe no-op that never needs a warm Firebase.
@pragma("vm:entry-point")
Future<void> pushBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    debugPrint("[push] background message: ${message.messageId}");
  }
}

/// Attempt to initialize Firebase for push. Call ONCE from `main()` before
/// `runApp`. Guarded: a missing/invalid config throws and we degrade to a
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

/// Coordinates FCM registration for the shopper, renders foreground alerts, and
/// routes notification taps to the right screen via [DeepLinkHandler].
///
/// Lifecycle (driven from `app.dart`):
///   - once, on first frame        -> [init]           (permission + token +
///                                                       listeners + cold-start tap)
///   - customer signs in           -> [syncWithSession] (POST token, associated
///                                                        with the customer)
///   - customer signs out          -> [onSignedOut]     (best-effort token removal)
class PushService {
  PushService(this._ref);

  final Ref _ref;

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  bool _localReady = false;
  String? _fcmToken;

  Dio get _dio => _ref.read(storeDioProvider);
  AuthStore get _authStore => _ref.read(authStoreProvider);
  GoRouter get _router => _ref.read(routerProvider);

  String get _platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? "ios" : "android";

  /// True only when Firebase came up this launch.
  bool get _available => gPushFirebaseReady;

  /// Request permission, wire listeners, obtain the FCM token, and honour a
  /// cold-start notification tap. Safe no-op when Firebase isn't configured.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    if (!_available) {
      if (kDebugMode) debugPrint("[push] init skipped — unavailable");
      return;
    }
    try {
      final messaging = FirebaseMessaging.instance;

      // Prompt for permission (Android 13+ POST_NOTIFICATIONS, iOS alert/badge).
      await messaging.requestPermission();

      await _initLocalNotifications();
      _wireListeners();

      _fcmToken = await messaging.getToken();
      if (_fcmToken != null && _fcmToken!.isNotEmpty) {
        // If a customer is already signed in (session restored on boot),
        // associate the token now.
        await _postTokenIfSignedIn();
      } else if (kDebugMode) {
        debugPrint("[push] no FCM token yet");
      }

      // Cold-start: app launched by tapping a notification while terminated.
      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        _routeFromData(initial.data);
      }
    } catch (e) {
      if (kDebugMode) debugPrint("[push] init failed: $e");
    }
  }

  /// Re-associate the device token with the now-signed-in customer. Called on a
  /// sign-in transition. Safe no-op when unavailable / no token yet.
  Future<void> syncWithSession() async {
    if (!_available) return;
    await _postTokenIfSignedIn();
  }

  /// Best-effort token removal on sign-out so a signed-out phone stops receiving
  /// this customer's notifications. The FCM token itself is kept (anonymous
  /// pushes may still be desired); only the customer association is dropped.
  Future<void> onSignedOut() async {
    if (!_available) return;
    final token = _fcmToken;
    if (token == null || token.isEmpty) return;
    try {
      // TODO(backend): implement DELETE /store/customers/me/push-tokens (or an
      // unauthenticated unregister). Endpoint is expected to be idempotent.
      await _dio.delete<dynamic>(
        "/store/customers/me/push-tokens",
        data: {"token": token},
      );
    } catch (_) {
      // Sign-out must never be blocked by a failed unregister.
    }
  }

  // --------------------------------------------------------------- internals

  Future<void> _initLocalNotifications() async {
    if (_localReady) return;
    try {
      const androidInit =
          AndroidInitializationSettings("@mipmap/ic_launcher");
      const iosInit = DarwinInitializationSettings(
        // Permission is requested via FirebaseMessaging.requestPermission();
        // don't double-prompt here.
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      );
      await _local.initialize(
        const InitializationSettings(android: androidInit, iOS: iosInit),
        onDidReceiveNotificationResponse: (response) {
          _routeFromPayload(response.payload);
        },
      );
      // Create the Android channel up front so foreground alerts have a home.
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_kChannel);
      _localReady = true;
    } catch (e) {
      if (kDebugMode) debugPrint("[push] local-notif init failed: $e");
    }
  }

  void _wireListeners() {
    try {
      final messaging = FirebaseMessaging.instance;

      // A refreshed token must be re-registered so we keep reaching the device.
      messaging.onTokenRefresh.listen((token) {
        _fcmToken = token;
        if (token.isNotEmpty) {
          _postTokenIfSignedIn();
        }
      });

      // Foreground messages are NOT auto-shown by the OS — render locally so the
      // shopper sees them while using the app; tap routes via the payload.
      FirebaseMessaging.onMessage.listen(_showForeground);

      // Tap on a notification that opened the app from the background.
      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        _routeFromData(message.data);
      });
    } catch (e) {
      if (kDebugMode) debugPrint("[push] wiring listeners failed: $e");
    }
  }

  Future<void> _showForeground(RemoteMessage message) async {
    if (kDebugMode) debugPrint("[push] foreground message: ${message.data}");
    final notification = message.notification;
    if (notification == null || !_localReady) return;
    try {
      await _local.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _kChannel.id,
            _kChannel.name,
            channelDescription: _kChannel.description,
            importance: Importance.high,
            priority: Priority.high,
            icon: "@mipmap/ic_launcher",
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        // Carry the routing data through so a tap can deep-link.
        payload: jsonEncode(message.data),
      );
    } catch (e) {
      if (kDebugMode) debugPrint("[push] show foreground failed: $e");
    }
  }

  /// Register the FCM token with the backend, associated with the signed-in
  /// customer via their session bearer token. No-op when signed out (there is
  /// no customer to associate — we re-post on the next sign-in / token refresh).
  Future<void> _postTokenIfSignedIn() async {
    final token = _fcmToken;
    if (token == null || token.isEmpty) return;
    String? bearer;
    try {
      bearer = await _authStore.readToken();
    } catch (_) {
      bearer = null;
    }
    if (bearer == null || bearer.isEmpty) {
      if (kDebugMode) {
        debugPrint("[push] token held; will register once signed in");
      }
      return;
    }
    try {
      // TODO(backend): implement POST /store/customers/me/push-tokens accepting
      // { token, platform } with the customer bearer, storing one row per
      // (customer, device token) so campaigns/order updates can target a phone.
      await _dio.post<dynamic>(
        "/store/customers/me/push-tokens",
        data: {"token": token, "platform": _platform},
        options: Options(headers: {"authorization": "Bearer $bearer"}),
      );
      if (kDebugMode) debugPrint("[push] registered device ($_platform)");
    } catch (e) {
      // Non-fatal; retried on the next sign-in / token refresh.
      if (kDebugMode) debugPrint("[push] token registration failed: $e");
    }
  }

  /// Route a tapped LOCAL notification, whose payload is the JSON-encoded
  /// message data map.
  void _routeFromPayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map) {
        _routeFromData(decoded.map((k, v) => MapEntry(k.toString(), v)));
      }
    } catch (e) {
      if (kDebugMode) debugPrint("[push] bad payload: $e");
    }
  }

  /// Deep-link a tapped notification to the right screen. The backend sends
  /// either a ready go_router path in `data.route` (e.g. "/product/t-shirt") or
  /// a full link in `data.link` (an https App Link or a custom-scheme URL); both
  /// are normalised through [DeepLinkHandler].
  void _routeFromData(Map<String, dynamic> data) {
    final raw = (data["route"] ?? data["link"] ?? data["deeplink"])?.toString();
    final target = DeepLinkHandler.resolveString(raw);
    if (target == null) return;
    try {
      if (target.isDetail) {
        _router.push(target.location);
      } else {
        _router.go(target.location);
      }
    } catch (e) {
      if (kDebugMode) debugPrint("[push] routing failed: $e");
    }
  }
}

/// The push service, bound to the app's providers (Dio + router + auth store).
final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));
