# mAutomate Shopper App — BUILD_SPEC (Wave 1)

ONE server-driven Flutter app that renders ANY store from its CMS blocks,
branded per merchant. A white-label factory later stamps per-store binaries via
`--dart-define`. Wave 1 delivers the app skeleton + the **block-rendering
engine**, proven end to end (fetch page JSON → render native blocks).

- Location: `apps/shopper-app` (org `ai.mautomate`, package `mautomate_shopper`,
  platforms android + ios).
- Stack (mirrors the merchant app): Flutter 3.41 / Dart 3.5, Riverpod, Dio,
  go_router, Phosphor icons, Inter font. `cached_network_image` for block media.
- Status: `flutter analyze` → **clean**; `flutter test` → **2 passing**.

---

## 1. Per-store config (`lib/core/config`)

`AppConfig.fromEnvironment()` reads four `--dart-define`s (the factory stamps
these per merchant); all have staging defaults so `flutter run` works bare:

| define | meaning | default |
|--------|---------|---------|
| `API_BASE_URL` | backend origin serving the Medusa **store** API | `https://merchant.mautomate.ai` |
| `STORE_PUBLISHABLE_KEY` | Medusa publishable key — scopes CMS tenancy AND catalog sales-channel | (empty) |
| `TENANT_ID` | owning tenant (sent as `x-tenant-id`) | (empty) |
| `CMS_BASE` | origin for resolving root-relative asset URLs (`/learts/...`) | = `API_BASE_URL` |

`AppConfig.resolveAsset(url)` turns a root-relative CMS image path into an
absolute URL against `CMS_BASE`; absolute + `data:` URLs pass through.
Exposed via `appConfigProvider`.

Example factory build:
```
flutter build apk \
  --dart-define=API_BASE_URL=https://merchant.mautomate.ai \
  --dart-define=STORE_PUBLISHABLE_KEY=pk_01ABC... \
  --dart-define=TENANT_ID=tnt_01XYZ... \
  --dart-define=CMS_BASE=https://foreverfinds.shop
```

## 2. Design system (`lib/core/theme`, `lib/core/widgets`)

Ported 1:1 from the merchant app so both apps share ONE language (ink + ember,
Inter, 4/8 spacing). `AppTheme.light/dark`, `AppColors` ThemeExtension
(`context.colors`), `AppTypography`, `AppSpacing`/`AppRadius`/`Gap`.

- `context.colors.*` for every token — never hardcode hex. Light/dark parity is
  automatic.
- Brand override: `brandProvider` (a `StateProvider<StoreBrand>`) holds the
  store's logo / accent / name resolved from the app-render `branding`/`design`
  payload; `applyBrandAccent()` overrides the ember accent family; `app.dart`
  builds both themes from it. No custom accent ⇒ ember default (unchanged).
- Widget kit (subset): `PrimaryButton`/`SecondaryButton`, `EmptyState`,
  `ErrorStateView`, `Shimmer`/`SkeletonBox`/`SkeletonLoader`, and `StoreImage`/
  `StoreLogo` (cached network image with graceful loading + error states).

## 3. THE BLOCK RENDERER ENGINE (`lib/core/blocks`) — core deliverable

### Data contract (verified against the live backend)
The LIVE app-render endpoint `GET /store/cms/app/pages/:slug` (header
`x-publishable-api-key`) returns:
```jsonc
{
  "page":    { "slug","locale","version","sections":[ {block_type, schema_version, ...props}, ... ],"seo","meta" },
  "design":  { "colors":{primary,dark,text,heading,bg,border}, "fonts":{body,heading}, "logo" },
  "branding":{ "name","logo_url","accent","active_theme" },
  "chrome":  { "topbar","header","footer" },
  "locale","resolved_locale"
}
```
`page.sections[]` IS the block tree — a **flat, rank-ordered array**, rendered
top-to-bottom. There is **no** Puck `{root, content}` wrapper. Each section's
props are **siblings** of `block_type` (not nested under `props`).

### Pieces
- **`StorePage` / `BlockNode`** (`block_node.dart`) — normalize the payload into
  ordered `BlockNode{ type, props, schemaVersion }`. `type` == `block_type`;
  `props` == the section object minus `block_type`. Defensive: an `{ page: ... }`
  envelope is unwrapped, a `content`/`type` generic list is also accepted, and a
  malformed section is skipped (never thrown on). One bad block never fails the
  page.
- **`BlockData`** (`block_data.dart`) — the typed, defensive prop view handed to
  every renderer. `str/strOr/boolean/number/integer/list/maps/object`, plus
  `asset(key)` / `resolve(url)` (root-relative → absolute via `AppConfig`), and
  `raw` for exotic shapes. Renderers NEVER touch `props[...]` directly.
- **`BlockBuilder`** = `Widget Function(BuildContext, BlockData)`.
- **`BlockRegistry`** (`block_registry.dart`) — O(1) `block_type → BlockRegistration`
  map. `BlockRegistration{ builder, maxSchemaVersion }`. Immutable; `withBlocks()`
  layers extras. Aliases allowed (many keys → one builder).
- **`defaultBlockRegistry` / `blockRegistryProvider`** (`default_registry.dart`)
  — wires the starter renderers; override the provider to inject Wave-2 blocks.
- **`PageRenderer`** (`page_renderer.dart`) — walks `page.content`, dispatches
  each `block_type` through the registry into a scrollable `ListView`, with
  optional `leading`/`trailing` (store header / footer). Blocks are full-bleed
  (own their horizontal padding); the page adds no gutters.
- **`UnknownBlock`** (`unknown_block.dart`) — the graceful fallback: a labelled
  placeholder in DEBUG, `SizedBox.shrink()` in RELEASE.

### The three non-crash guarantees (catalog forward-compat rules)
1. **Unknown `block_type`** → `UnknownBlock` (skip in release).
2. **`schema_version` > renderer's `maxSchemaVersion`** → skipped, never
   mis-rendered (a newer server block shape degrades cleanly).
3. **A renderer that throws** → caught per-block in `_SafeBlock`, degraded to
   fallback; the rest of the page still renders.

### Renderer authoring contract (Wave 2 reads this)
A renderer is a `BlockBuilder`. Rules:
- Read props ONLY via `BlockData` helpers (or `.raw`).
- Resolve every media URL via `data.asset(key)` / `data.resolve(url)`.
- `title`/`subtitle` may contain `\n` → render as line breaks
  (`value.replaceAll(r"\n", "\n")`).
- Return a full-bleed section (own horizontal padding via `AppSpacing.screenH`).
- NEVER throw; if required data is absent return `SizedBox.shrink()`.
- `elementStyles` (optional per-block) is advisory — honor what you can, ignore
  the rest.

### Starter renderers shipped (proving the pipeline)
| block_type | file | Wave-1 behavior |
|------------|------|-----------------|
| `hero_slider` (+`hero`) | `renderers/hero_block.dart` | first slide as full-bleed image hero + scrim + subtitle/title/CTA |
| `rich_text` (+`text`) | `renderers/rich_text_block.dart` | HTML flattened to headings/paragraphs (Wave 2: real HTML widget) |
| `image_with_text` (+`image`) | `renderers/image_block.dart` | image + eyebrow/title/body/CTA media object (stacked) |
| `product_tabs` (+`product_grid`) | `renderers/product_grid_block.dart` | **STUB** — header + tab chips + placeholder product grid (no fetch) |

## 4. Store API client (`lib/core/api`)

- `storeDioProvider` — Dio at `AppConfig.apiBaseUrl`, auto-attaches
  `x-publishable-api-key` + `x-tenant-id`, maps errors to `ApiError`. No auth
  interceptor (anonymous browsing; customer auth is a later phase).
- `ProductsRepository` (`products_repository.dart`) — `GET /store/products`
  with `limit/offset/q/category_id[]/collection_id[]/id[]/order`, returns
  `List<StoreProduct>`. `StoreProduct` (`store_product.dart`) is a lean
  hand-written model (id/title/handle/thumbnail + cheapest variant price). The
  `product_tabs` Wave-2 renderer binds to this.

## 5. Home screen (`lib/features/home`) — end-to-end proof

`HomeRepository.fetchHomePage()` tries `/store/cms/app/pages/home` →
`/store/cms/pages/home` → bundled `kSampleHomePage` fixture (so the engine is
always demonstrable offline / before a key is stamped). It also extracts
`branding`/`design` (accent falls back to `design.colors.primary`) and threads
`design`/`chrome` through `HomeLoad` for Wave 2. `homeControllerProvider`
(FutureProvider) loads once and pushes the brand into `brandProvider`.
`HomeScreen` renders loading (shimmer) / error (`ErrorStateView` + retry) /
empty (`EmptyState`) / data (`PageRenderer` + pull-to-refresh + footer).

Fixture exercises: `hero_slider`, `rich_text`, `product_tabs`, `image_with_text`,
and a deliberate `unknown_future_block` (proves the fallback).

## 6. Folder structure
```
lib/
  main.dart · app.dart
  core/
    config/    app_config.dart · config_providers.dart
    theme/     app_colors · app_theme · app_typography · spacing · brand_theme · theme(barrel)
    widgets/   app_buttons · empty_state · error_state_view · skeleton_loader · store_image · widgets(barrel)
    api/       dio_client · api_error · store_product · products_repository
    blocks/    block_node · block_data · block_registry · default_registry · page_renderer · unknown_block · blocks(barrel)
               renderers/ hero_block · rich_text_block · image_block · product_grid_block
    router/    app_router.dart
  features/
    home/      home_repository · home_controller · home_screen · sample_page
```

## 7. Wave 2 plan (coordinate here)

1. **Fill the catalog** (`apps/backend/SHOPPER_BLOCK_CATALOG.md`) — 9 remaining
   renderers, one file in `blocks/renderers/` + one line in `default_registry`:
   `promo_banner_grid`, `category_showcase`, `deal_of_day`, `brand_strip`,
   `testimonials`, `instagram_grid`, `image_gallery`, `newsletter`, `container`
   (`container` = secondary dispatch on `widget_type`; lowest priority).
2. **Data-bound blocks fetch live** — `product_tabs` / `category_showcase` /
   `deal_of_day` resolve their id bindings through `ProductsRepository`; make
   these `ConsumerWidget`s and degrade gracefully on a 404 ref. Prices need a
   `region_id` from `GET /tenant-config` (see `SHOPPER_STORE_API.md`).
3. **`rich_text`** — swap the flattener for a real HTML widget (e.g.
   `flutter_html`), honor `width`, sanitize.
4. **Store chrome** — draw `chrome.topbar`/`header`/`footer` (already threaded
   through `HomeLoad`) natively; expand `design` tokens onto full `ThemeData`.
5. **Routing** — add `/store`, `/products/:handle`, `/cart`, `/account`; map
   block `cta.href` internal paths to these (CTAs currently no-op with a TODO).
6. **Catalog / product / cart screens**; then customer auth (adds a Bearer token
   to `storeDioProvider`).
