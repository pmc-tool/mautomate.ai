# White-Label Factory — mAutomate Shopper App

ONE Flutter codebase (`apps/shopper-app`) renders ANY store. This document is the
operational guide for the **factory**: how to turn that one codebase into a
**branded per-store binary** and publish it to the Play Store / App Store under
the merchant's own developer account.

- What's baked at **build** time (per store): app **display name**, **launcher
  icon**, **applicationId / bundle id**, and the **store binding** (dart-defines:
  API base, publishable key, tenant id, CMS base).
- What stays **runtime-dynamic** (NOT baked): the theme **colors**, logo, fonts —
  these come live from the store's CMS `design`/`branding` payload
  (`brandProvider`). A per-store `accentColor` in the config is only a cosmetic
  first-paint splash default before that payload loads.

---

## 1. Design decision: single-config, NO Gradle product flavors

We use **one app whose identity is stamped at build time**, not Gradle product
flavors. Rationale:

- **Colors are already runtime-dynamic** (server-driven from the CMS payload), so
  there is nothing per-store to compile into resources. The only build-time
  variables are `applicationId`, app label, launcher icon, and the dart-defines.
- Flavors multiply build variants (`assembleDearwishRelease`, …), duplicate
  signing configs, and complicate the iOS project — for zero benefit here.
- Stamping via **Gradle project properties** (`ORG_GRADLE_PROJECT_storeAppId`,
  `ORG_GRADLE_PROJECT_storeAppLabel`) + a **manifest placeholder**
  (`${appLabel}`) + per-build **launcher-icon regeneration** + **dart-defines**
  is simpler, idempotent, and does not touch shared Gradle/iOS config per store.

So: **one binary shape, N brandings, stamped by `scripts/build_store.sh`.** Each
store build is independent and leaves the working tree unchanged.

---

## 2. Per-store config: `stores/<slug>.json`

Each store is one JSON file. `slug` = the file name (kebab-case). See
`stores/_TEMPLATE.json` for every field documented inline, and
`stores/dear-wish.json` for a real example.

```jsonc
{
  "slug": "dear-wish",
  "appName": "Dear Wish",                                  // launcher label + iOS display name
  "androidApplicationId": "ai.mautomate.shopper.dearwish", // Play package name (reverse-DNS, no dashes)
  "iosBundleId": "ai.mautomate.shopper.dearwish",          // App Store bundle id (usually identical)
  "accentColor": "#72a499",                                // OPTIONAL first-paint splash color
  "iconPath": "stores/icons/dear-wish.png",                // OPTIONAL 1024x1024 square PNG
  "dartDefines": {
    "API_BASE_URL": "https://api.mautomate.ai",            // store API origin (shared pooled backend)
    "STORE_PUBLISHABLE_KEY": "pk_...",                     // THE per-store binding (scopes tenancy + catalog)
    "TENANT_ID": "ten_...",                                // optional/informational (x-tenant-id)
    "CMS_BASE": "https://dearwish.shop"                    // origin for root-relative CMS asset URLs
  }
}
```

**Required:** `appName`, `androidApplicationId`, `dartDefines.STORE_PUBLISHABLE_KEY`,
`dartDefines.API_BASE_URL`, `dartDefines.CMS_BASE`. Everything else is optional
(`iosBundleId` defaults to `androidApplicationId`; `iconPath` falls back to the
default mAutomate icon; `TENANT_ID` is a fallback the backend can derive from the
key).

> `region_id` / `currency` are deliberately **not** baked — the app fetches them
> live from `GET /tenant-config` using the publishable key.

### Where the values come from (control plane)
- `STORE_PUBLISHABLE_KEY` → `tenant.publishable_key` (a `pk_...`). This one value
  scopes BOTH the CMS tenant and the catalog sales channel server-side.
- `TENANT_ID` → `tenant.id`.
- `CMS_BASE` → the store's primary storefront domain (`tenant_domain`).
- `appName` → the store's brand name (`branding.name`).

---

## 3. Add a new store (checklist)

1. `cp stores/_TEMPLATE.json stores/<slug>.json` and fill in the fields.
2. Drop the merchant's icon at `stores/icons/<slug>.png` (**1024×1024 PNG, square,
   no transparency** — iOS rejects alpha). Set `iconPath` to it.
3. Pick a unique `androidApplicationId` / `iosBundleId`
   (`ai.mautomate.shopper.<slugnodashes>`). **Never change it after publishing** —
   the stores treat a changed id as a different app.
4. `scripts/build_store.sh <slug>` → branded APK in `dist/<slug>/`.
5. For Play: `scripts/build_store.sh <slug> appbundle` → `.aab`.

---

## 4. Run the factory: `scripts/build_store.sh`

```
scripts/build_store.sh <slug> [target]
  <slug>    store config name (stores/<slug>.json), e.g. dear-wish
  [target]  apk (default) | appbundle | aab | ios
```

Examples:
```
scripts/build_store.sh dear-wish              # release APK  -> dist/dear-wish/dear-wish-release.apk
scripts/build_store.sh dear-wish appbundle    # Play .aab    -> dist/dear-wish/dear-wish-release.aab
scripts/build_store.sh dear-wish ios          # prints the macOS IPA steps (below)
```

What it does, per build:
1. Parses `stores/<slug>.json`.
2. **Backs up** the mipmaps / iOS icon set / `Info.plist` / `project.pbxproj`, and
   restores them on exit — **idempotent**, never pollutes git.
3. Regenerates the **launcher icon** from `iconPath` via `flutter_launcher_icons`
   (a per-store `flutter_launcher_icons_<slug>.yaml` it writes then deletes).
4. Runs `flutter build <target>` with:
   - `ORG_GRADLE_PROJECT_storeAppId=<androidApplicationId>` → Android applicationId
   - `ORG_GRADLE_PROJECT_storeAppLabel=<appName>` → `${appLabel}` in the manifest
   - `--dart-define=…` for every entry in `dartDefines`
5. Copies the artifact to `dist/<slug>/` and prints the applied id/label + size.

`dist/`, `flutter_launcher_icons_*.yaml`, and `android/key.properties` are
gitignored.

### Release signing (Android)
Out of the box the release build is signed with the **debug** keystore so it runs
immediately (fine for internal/QA). For a Play-uploadable artifact, drop the
merchant's keystore info in `android/key.properties` (same pattern as the
merchant app) BEFORE building:
```
storeFile=/absolute/path/to/merchant-upload-keystore.jks
storePassword=…
keyAlias=upload
keyPassword=…
```
`android/app/build.gradle.kts` auto-detects `key.properties` and switches release
signing to it; without it, it falls back to debug keys.

> **Environment note (host requirement):** the native `jni` transitive dep writes
> its CMake output *inside its own pub-cache package dir*. If the pub cache is not
> writable by the build user (e.g. root-owned after a `sudo` install), **release**
> builds fail with `hash_key.txt (No such file or directory)`. Fix once with
> `sudo chown -R $USER ~/.pub-cache`, or set `PUB_CACHE` to a writable dir and
> re-run `flutter pub get`. The script preflights this and prints the remedy.

---

## 5. iOS builds (require a Mac)

A signed `.ipa` **cannot** be produced on Linux — it needs macOS + Xcode + Apple
signing certificates. `scripts/build_store.sh <slug> ios` does the parts it can on
any host (stamps the iOS **display name**, **bundle id**, and **icon**) and then
prints the remaining macOS steps:

```
cd apps/shopper-app
flutter build ipa --release \
  --dart-define=API_BASE_URL=… --dart-define=STORE_PUBLISHABLE_KEY=… \
  --dart-define=TENANT_ID=… --dart-define=CMS_BASE=…
# then: open build/ios/archive/Runner.xcarchive in Xcode → Distribute App,
# signing with the MERCHANT's own Apple Developer account.
```
On the Mac, re-run the same `stores/<slug>.json` through the script (target `ios`)
to stamp the metadata, then archive/upload from Xcode. The bundle id to
create/select in App Store Connect is the config's `iosBundleId`.

---

## 6. Publishing

Each store's app is published under the **MERCHANT's own developer account** —
this is both the trust model (the app is the merchant's, billed to them) and the
key to passing store review (§7).

### Android — Google Play Console (merchant's account)
1. Merchant creates/owns a Play Console account ($25 one-time).
2. Create the app; the package name must equal `androidApplicationId`.
3. Upload the **`.aab`** (`scripts/build_store.sh <slug> appbundle`) signed with
   the merchant's upload key (`android/key.properties`). Enroll in Play App
   Signing.
4. Fill store listing (icon, screenshots, description, privacy policy), content
   rating, data-safety form.
5. Internal testing track → closed → production.

### iOS — App Store Connect (merchant's account)
1. Merchant enrolls in the Apple Developer Program ($99/yr).
2. Register the App ID = `iosBundleId`; create the app in App Store Connect.
3. On a Mac, archive with the merchant's distribution certificate/profile and
   upload via Xcode or Transporter.
4. Fill listing, privacy nutrition labels, submit for review.

### Per-store publishing checklist
- [ ] `stores/<slug>.json` complete; `STORE_PUBLISHABLE_KEY` verified against the live store
- [ ] 1024×1024 icon at `stores/icons/<slug>.png` (no alpha)
- [ ] `androidApplicationId` / `iosBundleId` unique and final (never changes later)
- [ ] Merchant's Play + Apple developer accounts ready
- [ ] Merchant's Android upload keystore in `android/key.properties`
- [ ] `scripts/build_store.sh <slug> appbundle` → verify `aapt dump badging` shows the right package + label
- [ ] iOS archived/uploaded on a Mac with the merchant's signing
- [ ] Store listings: brand name, icon, screenshots, privacy policy, data-safety/privacy labels
- [ ] Submit under the **merchant's** account

---

## 7. Apple Guideline 4.3 (spam / duplicate apps) strategy

Apple's **Guideline 4.3** rejects "a binary that is a copy of an existing one with
only minor changes" and, in particular, a single developer submitting many
near-identical apps ("commercialized template / app generation" — 4.3(b)). A
white-label commerce platform must avoid looking like one account spamming clones.

**Our compliance posture — each app is genuinely a different business's app:**

1. **Published under the MERCHANT's own developer account**, not a shared/factory
   account. This is the single most important factor: 4.3(b) targets *one*
   developer flooding the store with templates. Distinct merchants, each on their
   own account, publishing their own store's app, is the accepted white-label
   pattern (the same path Shopify/BigCommerce app builders use).
2. **Distinct brand identity per app:** unique name, unique 1024px icon, unique
   bundle id, the merchant's own real product catalog, copy, and imagery
   (server-driven, so every app shows a genuinely different storefront).
3. **Real, functional commerce:** live catalog, cart, and checkout backed by the
   merchant's actual store — not a hollow reskin.
4. **The merchant is the legal owner** of the listing, content, and customer
   relationship; mAutomate is the technology provider.

**Do NOT** publish many stores under one mAutomate-owned account with only
name/icon swapped — that is exactly what 4.3 rejects. If a merchant cannot/will
not run their own account, the compliant alternative is a **single mAutomate
marketplace app** that lists multiple stores inside one binary (a different
product), not N cloned binaries.

Google Play has an analogous "repetitive content / spam" policy; the same
strategy (merchant's own account, distinct brand, real content) satisfies it.

---

## 8. What the merchant must provide, per store

| Item | Needed for | Notes |
|------|-----------|-------|
| Brand name | app label / display name | → `appName` |
| App icon, 1024×1024 PNG, square, no alpha | launcher/App Store icon | → `stores/icons/<slug>.png` |
| Google Play Console account ($25 one-time) | Android publishing | merchant-owned |
| Android upload keystore (`.jks`) | Play signing | → `android/key.properties` |
| Apple Developer account ($99/yr) | iOS publishing | merchant-owned |
| Apple distribution cert/profile | iOS signing | created in their Apple account (on a Mac) |
| Store listing assets (screenshots, description, privacy policy) | review | per-store |

Everything else (store binding, catalog, theme colors, logo, content) is derived
automatically from the store's publishable key + live CMS payload.
