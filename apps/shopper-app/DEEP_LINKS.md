# Deep Links — mAutomate Shopper app

The app opens the right screen from three link transports, all normalised to the
same in-app routes by `lib/core/notifications/deep_link_handler.dart`:

1. **Android App Links** — verified `https://<store-domain>/…`
2. **iOS Universal Links** — verified `https://<store-domain>/…`
3. **Custom URL scheme** — `mautomate://…` (default/global) or a per-store scheme.

Incoming links are received (cold start + warm) by
`lib/core/notifications/deep_link_service.dart` via the `app_links` package and
routed into go_router. Notification taps route through the same handler
(`PushService._routeFromData`).

---

## URI → route mapping (`DeepLinkHandler`)

| Incoming link                                   | Opens                    |
| ----------------------------------------------- | ------------------------ |
| `/`                                             | Home tab                 |
| `/shop` `/store` `/collections` `/products`     | Shop tab                 |
| `/search?q=shoes`                               | Search tab (seeded)      |
| `/cart`                                         | Cart tab                 |
| `/account` `/login` `/profile`                  | Account tab              |
| `/category/:id` `/categories/:id`               | Category screen (pushed) |
| `/product/:handle` `/products/:handle`          | Product screen (pushed)  |

Custom-scheme links use the same shapes, e.g.
`mautomate://product/<handle>`, `mautomate://cart`, `mautomate://category/<id>`.
(For a custom scheme Dart parses the first segment as the URI host; the handler
folds it back into the path, so `mautomate://product/x` == `/product/x`.)

Unrecognised links are ignored (no navigation, no crash).

Tab links use `router.go` (switch tab); detail links (`product`/`category`) use
`router.push` (full-screen over the shell, with a back button) — matching the
app's existing navigation model in `lib/core/router/routes.dart`.

---

## Per-store configuration (white-label)

Android host + scheme are **manifest placeholders** stamped at build time
(`android/app/build.gradle.kts`), so the factory sets them per store:

```
ORG_GRADLE_PROJECT_storeDeepLinkHost=dearwish.shop     # verified App Links host
ORG_GRADLE_PROJECT_storeDeepLinkScheme=mautomate       # or a per-store scheme
```

Defaults for a bare build: host `app.invalid` (autoVerify harmlessly fails),
scheme `mautomate` (always works — custom schemes need no verification).

> **Factory change needed** (report item): `scripts/build_store.sh` does NOT yet
> export `ORG_GRADLE_PROJECT_storeDeepLinkHost` /
> `ORG_GRADLE_PROJECT_storeDeepLinkScheme`. Add them next to the existing
> `storeAppId` / `storeAppLabel` exports, deriving the host from the store's
> `CMS_BASE`/domain (strip scheme) and a scheme from the slug. Without this the
> App Links host stays the placeholder (custom scheme + push taps still work).

iOS (Info.plist custom scheme is set to `mautomate`; the factory can stamp a
per-store scheme). Universal Links host lives in `ios/Runner/Runner.entitlements`
(`applinks:<store-domain>`) and must be enabled in Xcode → Associated Domains.

---

## Server-hosted verification files (backend TODO)

For **verified** App Links / Universal Links, each store must serve, at its own
domain, two files. The storefront is per-tenant so it can emit these per store:

### Android — `https://<store-domain>/.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "ai.mautomate.shopper.<slug>",
    "sha256_cert_fingerprints": ["<APK signing cert SHA-256>"]
  }
}]
```
`package_name` = the store's stamped `applicationId`; the fingerprint is the
release keystore's SHA-256 (also the Play App Signing cert if using Play signing).

### iOS — `https://<store-domain>/.well-known/apple-app-site-association`
Served with `Content-Type: application/json`, **no** `.json` extension:
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "<TEAMID>.ai.mautomate.shopper.<slug>",
      "paths": ["/product/*", "/category/*", "/cart", "/search", "/"]
    }]
  }
}
```

> **Backend TODO**: add a per-tenant route that serves both files with the
> correct package name / appID / fingerprints for that store. Until then, App
> Links / Universal Links fall back to opening the browser, but the **custom
> scheme** (`mautomate://…`) and **notification-tap** deep links work with no
> server dependency.
