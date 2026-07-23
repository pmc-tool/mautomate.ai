# Push Notifications — Setup Guide (mAutomate Shopper app)

The shopper app ships with a **complete FCM push scaffold that is INERT until a
Firebase project is configured**. With no config the app builds and runs fully —
push is simply disabled. This document is the exact checklist to turn it on.

> Design intent: a store owner who does not care about push does nothing. A store
> owner who wants push drops in two config files (+ an APNs key for iOS) and it
> works — no code changes.

---

## What already exists in the app

- `lib/core/notifications/push_service.dart` — `PushService` + `bootstrapPushFirebase()`.
  - `bootstrapPushFirebase()` runs in `main()` inside a try/catch. Without a real
    config `Firebase.initializeApp()` throws, `gPushFirebaseReady` stays `false`,
    and every `PushService` method becomes a clean no-op.
  - When configured: requests permission, gets the FCM token, listens for
    foreground / background / tapped messages, renders foreground alerts via
    `flutter_local_notifications`, and routes taps through the deep-link handler.
- `lib/core/notifications/deep_link_handler.dart` — pure URI → in-app route mapping.
- `lib/core/notifications/deep_link_service.dart` — OS deep-link receiver (see DEEP_LINKS.md).
- Android: the Google Services Gradle plugin is applied **only if
  `android/app/google-services.json` exists** (see `android/app/build.gradle.kts`).
  This is what lets a release APK build with **no** Firebase config.
- iOS: `ios/Runner/Runner.entitlements` holds the `aps-environment` +
  associated-domains entitlement (must be wired in Xcode — see below).

---

## The critical build guarantee (Android)

`android/app/build.gradle.kts`:

```kotlin
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")   // only when config present
}
```

- **No `google-services.json`** → plugin NOT applied → APK builds fine, push off.
- **Real `google-services.json`** → plugin applied → resources generated →
  `Firebase.initializeApp()` succeeds → push on.

Do **not** unconditionally apply `com.google.gms.google-services`; that would make
`google-services.json` mandatory and break every store that has not set up push.

---

## Enable push — step by step

### 1. Create a Firebase project
- https://console.firebase.google.com → Add project (one per store brand, or one
  shared project with multiple apps — either works).

### 2. Android
1. In the Firebase project, add an **Android app** with the store's
   `applicationId` (e.g. `ai.mautomate.shopper.dearwish` — it must match the
   value the white-label factory stamps; see `WHITE_LABEL.md`).
2. Download **`google-services.json`** and place it at
   `android/app/google-services.json`.
3. Rebuild. The Gradle log prints `google-services.json found — FCM push enabled`.

### 3. iOS
1. In the Firebase project, add an **iOS app** with the store's bundle id
   (e.g. `ai.mautomate.shopper.dearwish`).
2. Download **`GoogleService-Info.plist`** and add it to `ios/Runner/` (add it to
   the Runner target in Xcode).
3. Create an **APNs authentication key** (Apple Developer → Keys → +, enable
   Apple Push Notifications service) and upload the `.p8` to
   Firebase → Project settings → Cloud Messaging → Apple app configuration.
4. In Xcode → Runner target → Signing & Capabilities:
   - add the **Push Notifications** capability,
   - add **Background Modes → Remote notifications**,
   - add **Associated Domains** if you also want Universal Links (see DEEP_LINKS.md),
   - set **CODE_SIGN_ENTITLEMENTS** to `Runner/Runner.entitlements` if not already.
5. Set `aps-environment` in `Runner.entitlements` to `production` for
   TestFlight / App Store builds.

### 4. Backend token registration (TODO — not yet implemented)
The app posts the device token to the backend so campaigns / order updates can
target a phone. These routes must be added server-side:

- `POST /store/customers/me/push-tokens`  body `{ token, platform }`, customer
  bearer in `Authorization`. Store one row per (customer, device token).
- `DELETE /store/customers/me/push-tokens` body `{ token }` — idempotent; called
  on sign-out.

Until these exist the POST/DELETE fail silently (non-fatal) and push delivery via
FCM topics / direct token still works; only per-customer targeting from our
backend is pending.

---

## Sending a test notification
Firebase Console → Messaging → New campaign / test message → send to the FCM
token (printed in debug logs as the app registers). To deep-link the tap, include
a **data** payload with one of:

```json
{ "route": "/product/<handle>" }
{ "link":  "https://<store-domain>/product/<handle>" }
```

Both are normalised by `DeepLinkHandler` to the right screen.
