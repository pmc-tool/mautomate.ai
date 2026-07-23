# mAutomate Theme System — Engineering Guide

> **Audience:** a fresh Opus session asked to build a new storefront theme, port a
> React theme to the upload engine, fix an existing theme, or extend the theme
> platform. Read this end-to-end before touching code. Everything here was
> learned the hard way — the "CRITICAL GOTCHAS" section is the part that saves
> you a broken client store.

---

## 0. Orientation & golden rules

- **VM:** `ssh ratul@192.168.200.201`. Repo: `/home/ratul/brandtodoor` (monorepo:
  `apps/backend` = Medusa, `apps/storefront` = Next.js).
- **Shared node_modules** live at `/home/ratul/foreverfinds/node_modules`. Every
  build/run command needs:
  ```bash
  export NODE_PATH=/home/ratul/foreverfinds/node_modules
  export PATH=/home/ratul/foreverfinds/node_modules/.bin:/usr/local/bin:/usr/bin:/bin:$PATH
  ```
  ⚠️ `npm install` into that shared folder can PRUNE ad-hoc packages (e.g. it once
  removed `nodemailer` and crash-looped the backend). After any install, boot the
  backend and check. Prefer editing `package.json` + `yarn`, or avoid installs.
- **pm2 processes:** `b2d-backend` (Medusa :9500), `b2d-storefront-next` (Next :8601),
  `b2d-console`, `b2d-pgbouncer`, `b2d-edge`, redis. Postgres is the Docker
  container `ff-postgres` (DB `brandtodoor`, user `ff`); the app connects via
  pgbouncer. For SQL use `docker exec ff-postgres psql -U ff -d brandtodoor`.
- **Golden rules for a live client store (dhaka-bangladesh / "Dear Wish" is one):**
  1. Every theme change is **instantly reversible** — flip `tenant.meta.active_theme`
     back to `learts` (React) and restart. Keep that command handy.
  2. **Verify with a real browser**, not just `curl`. curl proves "returns 200";
     it cannot catch a broken scroll, a collapsed footer, or a layout bug. Both
     bugs that reached the live client were invisible to curl.
  3. Uploaded themes are **untrusted code running on our server for every tenant**.
     The validator is a security boundary, not a linter — don't weaken it.

---

## 1. Architecture — two rendering paths

A store's `tenant.meta.active_theme` decides how its storefront renders:

- **Compiled React themes** (legacy: `learts`, `aurora`, `cignet`, `shofy`, `ekka`,
  `helendo`, `bazaro`, `exzo`, `rokon`) — baked into the Next bundle.
- **Uploaded Liquid themes** (the platform going forward: `learts-liquid`, …) —
  Shopify-style packages stored in Postgres, rendered by a sandboxed liquidjs
  engine.

**The seam** (`apps/storefront/src/middleware.ts`): for a store on an uploaded
theme, middleware **rewrites** every storefront page to the Route Handler
`app/theme-render/[[...path]]/route.ts`, which renders the whole HTML document
through the theme's Liquid. Ownership is **inverted** — the theme owns EVERY page
except a `REACT_ONLY` blacklist (`account`, `checkout`, `order`, `payment`,
`verify-account`, `recover`, `wishlist`) and file-like paths (contain a `.`).
`?preview_theme=<handle>` forces the rewrite for ANY store (even React ones)
without changing its live theme — this is how you preview safely.

**Storage & delivery:**
- Backend module `apps/backend/src/modules/theme/` — models `theme` (stable
  identity/handle), `theme_version` (immutable), `theme_file` (bytes in Postgres,
  text or base64). Service `THEME_MODULE = "theme"`.
- Upload: `POST /admin/themes` (`apps/backend/src/api/admin/themes/route.ts`) —
  unzip defensively → `validateTheme()` → store as an immutable version. Nothing
  is written if validation fails.
- Public CDN (no publishable key; moved off `/store/*` which requires one):
  `/themes-cdn/bundle` (returns `{handle, version, manifest, files}`) and
  `/themes-cdn/asset` (one file by query param).
- Storefront render pipeline (`apps/storefront/src/modules/theme-runtime/`):
  `engine.ts` (sandboxed liquidjs), `loader.ts` (fetch + cache bundle by
  handle@version), `build-context.ts` (maps real commerce data → the theme
  contract). Assets proxied via `app/theme-assets/[handle]/[version]/[...path]`.
- **Editor Liquid canvas** (section 7) renders uploaded themes inside the visual
  editor for true WYSIWYG.

**Gold-standard reference theme:** `learts-liquid`. The full package source lives
at (local dev machine) `~/.claude/jobs/*/tmp/learts-liquid/` and on the VM at
`/tmp/learts-liquid/`. **Copy it as the template for every new theme.**

---

## 2. The theme package (what a theme IS)

```
theme.json                 # manifest (REQUIRED)
preview.png                # library thumbnail (REQUIRED)
layout/theme.liquid        # full <html> document (REQUIRED); outputs
                           #   {{ content_for_header }} + {{ content_for_layout }}
templates/
  index.liquid             # home — loops page.sections (REQUIRED)
  product.liquid           # PDP (REQUIRED)
  collection.liquid        # a collection/category listing (REQUIRED)
  list-collections.liquid  # /store — all products (REQUIRED)
  cart.liquid              # cart (REQUIRED)
  search.liquid            # search
  page.liquid              # generic CMS page (about-us, faq…) — loops sections
  blog.liquid              # blog list
  article.liquid           # a blog post
sections/                  # ONE file per block_type + header.liquid + footer.liquid
  hero_slider.liquid  promo_banner_grid.liquid  product_tabs.liquid
  deal_of_day.liquid  category_showcase.liquid  brand_strip.liquid
  rich_text.liquid  image_with_text.liquid  newsletter.liquid
  instagram_grid.liquid  testimonials.liquid  image_gallery.liquid  container.liquid
  header.liquid  footer.liquid
snippets/                  # reusable partials (product-card.liquid, resolve-tokens.liquid)
assets/
  theme.css                # the WHOLE design system — self-contained (see gotchas)
  theme.js                 # client behaviour (slider, tabs, countdown, add-to-cart…)
```

The **13 block types** (must match `BLOCK_TYPES` in the validator) are what the
page builder emits. A theme missing some degrades gracefully; a theme rendering
NONE is rejected.

---

## 3. The Liquid data contract (what your templates receive)

Built by `apps/storefront/src/modules/theme-runtime/build-context.ts` (live) and
`app/theme-render/[[...path]]/route.ts` (per-page fetch). Every template gets:

```
shop        { name, domain, currency (UPPER), locale, logo }
routes      { root_url:/<cc>, cart_url, search_url, account_url, collections_url }
request     { country_code, locale, path }
cart        { item_count, total_price, subtotal_price, items[], checkout_url }
customer    { id, first_name, email, orders_count } | null
chrome      { topbar, header, footer }   # the tenant's CMS settings.* (footer
            #   has .contact.{email,phone,app_buttons}, .column_categories,
            #   .column_links, .social[], .newsletter, .payment_image, .copyright)
settings    # merged theme setting DEFAULTS + merchant overrides ({{ settings.x }})
categories  # live product categories (header/footer nav)
```

Page-specific:
- **index / page:** `page.sections[]` — each `{ id, type, settings, css_class }`.
  Render with `{% for section in page.sections %}{% render_section section %}{% endfor %}`.
  `section.settings` is the block's data (e.g. hero `settings.slides[]`).
- **product:** `product { id, title, handle, description, available,
  featured_image{url,alt}, images[], price (MAJOR units number), compare_at_price,
  variants[{id,title,available,price,options}], options[{name,values[]}] }`.
  **Wishlist convention** (see katan-liquid 1.0.2): a heart button
  `<button data-wishlist-toggle data-product-id="{{ product.id }}">` plus theme.js
  logic that reads/writes localStorage key `ff_wishlist` (JSON array of product-id
  strings — the SAME contract as the React wishlist context), and a header link to
  `{{ root }}/wishlist` (the React wishlist page works on every themed store).
  Guard hearts with `{% if product.id %}` so they degrade gracefully.
- **collection:** `collection { title, handle, description, products_count, products[] }`
  (products use the same shape as `product`). Category pages reuse this template.
- **list-collections:** `products[]` (flat).
- **blog:** `blog.posts[{slug,title,excerpt,cover_image,published_at,reading_time,author}]`.
- **article:** `article {title, content (HTML), cover_image, published_at, author}`.

**Custom tags:** `{% render_section section %}` (renders `sections/<type>.liquid`
with `section` in scope; unknown types silently skip), `{% section 'header' %}`
(a named theme section — used in the layout for chrome).

**Filters:** `money`, `money_without_currency`, `image_url: width: N`,
`asset_url` (→ `/theme-assets/<handle>/<version>/<file>` — the asset route tries
`assets/<path>` first, Shopify convention), `product_url`, `collection_url`,
`raw` (mark HTML safe — merchant rich text only), `handleize`, `t`, plus liquidjs
built-ins (`default`, `date`, `replace`, `split`, `size`…).

**Escaping model:** `{{ x }}` HTML-escapes by default. Only `| raw` (or the
platform's `content_for_layout`/`content_for_header`) emit raw HTML. Do NOT add
`| raw` to `content_for_layout`/`content_for_header` — they are already RAW-marked
and double-wrapping prints `[object Object]`.

---

## 4. The validator (what passes / fails)

`apps/backend/src/modules/theme/lib/validator.ts` — runs at upload AND in
`mautomate theme check`. Rejects: unsafe paths (`..`, absolute, `\`), non-lowercase
paths (`^[a-z0-9][a-z0-9._/-]*$`), server-code patterns (`require(`, `process.`,
`child_process`, `eval`, `new Function`, `fs.`, `<?php`, prototype access),
inline `<script>` without `src` in templates, `fetch(`/`XMLHttpRequest`/
`sendBeacon` in templates (client JS in `assets/*.js` is fine), missing required
files, bad manifest. **The DoS gate:** a static loop-budget analysis rejects
literal ranges `(1..N)` over 10 000 and nested loops over 100 000 passes — because
a CPU-bound Liquid loop blocks Node's event loop so the render deadline never
fires. Keep this. Limits: 20 MB total, 5 MB/file, 512 KB/template, 2000 files.

Put JS in `assets/theme.js` and load with `<script src="{{ 'theme.js' | asset_url }}" defer>`.

---

## 5. Build / fix / deploy recipe (exact)

**Iterating on a theme package (theme-only change — NO storefront rebuild):**
```bash
# 1. edit files locally, BUMP "version" in theme.json (versions are immutable)
# 2. copy to VM, add preview, pack, validate, upload, restart
scp -r <local>/learts-liquid/. ratul@192.168.200.201:/tmp/learts-liquid/
ssh ratul@192.168.200.201 '
  cp /home/ratul/brandtodoor/apps/storefront/public/themes/learts/preview.png /tmp/learts-liquid/preview.png
  export NODE_PATH=/home/ratul/foreverfinds/node_modules
  node /tmp/pack.js          # zips /tmp/learts-liquid -> /tmp/learts-liquid.zip (adm-zip)
  node /tmp/validate.js      # runs the REAL validator against the zip; want 0 errors
  cd /home/ratul/brandtodoor/apps/backend
  export PATH=/home/ratul/foreverfinds/node_modules/.bin:$PATH
  node /home/ratul/foreverfinds/node_modules/@medusajs/cli/cli.js exec /tmp/upload-theme.js
  pm2 restart b2d-storefront-next --update-env   # clears the loader bundle cache
'
```
`/tmp/pack.js`, `/tmp/validate.js`, `/tmp/upload-theme.js` already exist on the VM
(the upload script mirrors `POST /admin/themes` storage and must `module.exports.default = async ({container}) => …`).
The loader caches bundles by `handle@version` with NO TTL, so a **restart** is how
a new version goes live; `?version=` is byte-identical forever.

**Storefront code change (middleware, theme-render route, editor, new API route) —
needs a full rebuild (~8 min):**
```bash
ssh ratul@192.168.200.201 '
  cd /home/ratul/brandtodoor/apps/storefront
  # NODE_PATH: brandtodoor FIRST, foreverfinds as fallback. foreverfinds-only
  # pulls react-dom from the wrong copy -> dual React -> /404 _error export
  # crashes with "Cannot read properties of null (reading useContext)".
  export NODE_PATH=/home/ratul/brandtodoor/node_modules:/home/ratul/foreverfinds/node_modules
  export PATH=/home/ratul/brandtodoor/node_modules/.bin:/home/ratul/foreverfinds/node_modules/.bin:$PATH
  export NODE_OPTIONS=--max-old-space-size=6144
  next build                # NOT "yarn build" (yarn is not on PATH); gate on exit
  /home/ratul/bin/sf-postbuild.sh
  pm2 restart b2d-storefront-next   # NO --update-env: preserve runtime NODE_PATH
'
```
⚠️ **Backend** build only: `medusa build` wipes `.medusa/server/.env` → always
`cp .env .medusa/server/.env` after, then `pm2 restart b2d-backend`. Backend boot
~20-25 s.

**Verify:**
```bash
# curl with the tenant Host (structure/errors)
curl -s -L -H "Host: dhaka-bangladesh.mautomate.ai" http://localhost:8601/us | grep -c "Liquid error"
# THEN a real browser (design/scroll/footer). Preview any store safely:
#   https://<store>.mautomate.ai/us?preview_theme=learts-liquid
```

**Apply a theme to a store (production switch — reversible):**
```sql
-- activate
update tenant set meta = jsonb_set(coalesce(meta,'{}'::jsonb),'{active_theme}','"learts-liquid"') where slug='dhaka-bangladesh';
-- ROLLBACK to React instantly
update tenant set meta = jsonb_set(meta,'{active_theme}','"learts"') where slug='dhaka-bangladesh';
```
Then `pm2 restart b2d-storefront-next --update-env` (clears the 60 s middleware
tenant cache; the backend `/tenant-config` reads the DB live, no restart needed).

---

## 6. CRITICAL GOTCHAS (read before you code)

1. **Self-contained CSS — never load a foreign global stylesheet.** The clean
   `learts-liquid` originally loaded Learts' `style.min.css` just for the footer;
   that stylesheet's `html, body { height:100% }` locked the whole page to one
   viewport height (body became a fragile scroll container) AND collapsed the
   footer to 0px — both **live on the client** and both invisible to curl. Fix:
   the theme's `theme.css` is the WHOLE design system, namespaced (`lz-`), with its
   own reset (`*{box-sizing}`, `a{text-decoration:none}`, `ul/img/button` resets,
   `html/body height:auto`, `overflow-x:hidden`). Load only fonts + FontAwesome +
   your own `theme.css`. A theme must not inherit another theme's page-level rules.

2. **liquidjs tokenizes a literal `{{` EVERYWHERE** — inside `{% %}` tags, inside
   string literals, AND inside `{% comment %}`. Writing `{% assign x = '{{store_name}}' %}`
   or a comment containing `{{` is a `TokenizationError` that 500s the page (this
   hit the live client). To build a token literal, assemble it from single braces:
   `{% assign lb = '{' | append: '{' %}{% assign tok = lb | append: 'store_name' | append: '}' | append: '}' %}`.
   See `snippets/resolve-tokens.liquid` (resolves `{{store_name}}`/`{{year}}` in
   merchant rich text — the platform never substituted these, so they render
   literally otherwise).

3. **CORS: client-side fetches to the backend fail.** The storefront origin
   fetching `${NEXT_PUBLIC_MEDUSA_BACKEND_URL}/themes-cdn/bundle` from the browser
   is cross-origin. Add a **same-origin proxy** Route Handler (see
   `app/api/theme-bundle/route.ts`) and fetch that instead.

4. **`active_theme` resolves differently in the editor.** The storefront reads
   `tenant.meta.active_theme` (= `learts-liquid`). The editor's
   `resolveEditorThemeId` DOWNGRADES an uploaded theme to the React fallback
   (`learts`) for its React canvas registry. So `/api/puck/chrome` now also returns
   `platform_theme` (the raw handle) — use THAT to detect/load an uploaded theme in
   the canvas, not `active_theme`.

5. **Middleware ownership is inverted** (theme owns all except `REACT_ONLY` +
   file-like paths). If you add a new React-only flow, add its first path segment
   to `REACT_ONLY` in `middleware.ts`. CMS content pages (`/about-us`, `/faq`…) are
   block documents rendered via `templates/page.liquid` (route fetches
   `getCmsPage(slug)`; missing → 404 like the old React catch-all).

6. **`product_tabs` products are resolved UPSTREAM, not in the theme.** The
   theme-render route (`resolveProductTabs`) fetches per-tab products; the editor
   canvas injects a shared sample (see `liquid-canvas.tsx`). A theme template only
   reads `tab.products[]`. Don't try to fetch inside Liquid.

7. **Add-to-cart** posts to the same-origin `app/api/theme-cart/route.ts` (reuses
   the real `addToCart` server action — per-tenant key/region/cart-cookie resolved
   by the SDK's Host fallback because `/api/*` is excluded from the middleware
   matcher). Out-of-stock → Medusa 500 "does not have the required inventory" (that
   is correct, not a bug; the PDP `<select>` disables sold-out variants).

8. **Deploy hygiene:** shared `node_modules` (rule 0), backend `.env` copy after
   `medusa build`, restart clears the loader cache, `--update-env` on pm2 restart
   (a bare restart strips PATH → module-not-found crash loop).

---

## 7. The editor Liquid canvas (WYSIWYG for uploaded themes)

The visual editor (`/editor/[slug]` shell + `/editor-canvas/[slug]` iframe) renders
sections as React block components with `[data-cms-idx]` selection wrappers and
streams edits via ~30 postMessage types. For an uploaded theme it now renders the
theme's OWN Liquid instead of the React fallback:

- `apps/storefront/src/modules/cms/editor/liquid-canvas.tsx` —
  `loadCanvasLiquid(handle,…)` fetches the bundle (via the same-origin proxy),
  builds a browser liquidjs engine, and `buildLiquidCanvasTheme()` returns a
  drop-in `CanvasTheme` (same shape as `getCanvasTheme`) whose `blocks` /
  `Header` / `Footer` render Liquid via `engine.parseAndRenderSync` into
  `<div style=display:contents dangerouslySetInnerHTML>`. **Sync works because the
  editor's `product_tabs` carry sample products but no async `{% render %}` path
  is hit** — if you add async tags to a section, guard the sync render.
- `editor-canvas` swaps: `canvasTheme = liquidCanvas ? buildLiquidCanvasTheme(liquidCanvas) : getCanvasTheme(activeTheme)`.
  It injects the theme's `theme.css` + fonts, neutralizes the fallback theme's
  global rules, sets `body.lz-body`. **Gated to uploaded themes — React-theme
  editors are byte-for-byte untouched.**
- **`product_tabs` in the canvas** show real products: `/api/puck/chrome` returns
  `sample_products` (fetched with a resolved region so prices are correct), the
  canvas passes them into `chrome.sample_products` → `loadCanvasLiquid(products)`
  → the `Block` injects them into every tab's `products`. Deps of the load effect
  are `[platformTheme, brandName, chrome]` — do NOT add a separate `products`
  state as a dep; carry products INSIDE `chrome` so chrome-churn re-fetches don't
  cancel the in-flight bundle load.
- **Verified working (browser):** WYSIWYG render, click-to-select (opens the field
  panel), live-edit (typing re-renders the section via Liquid), undo, reorder,
  populated product previews with prices. Publish uses the existing pipeline
  (unchanged — the canvas only renders; publish reads the `content` state).
- **⚠️ SILENT-FAILURE TRAP (cost hours):** `loadCanvasLiquid` has `catch { return null }`
  — if it returns null the canvas silently falls back to the React theme with NO
  console error. The bug was that a local→VM file transfer clobbered the
  same-origin fetch back to a cross-origin `${BACKEND}/themes-cdn/bundle` (CORS →
  reject → null → React fallback). ALWAYS keep the fetch at same-origin
  `/api/theme-bundle?handle=…`, and when a theme edit "does nothing," add a
  temporary `console.log/error` in that catch first — do not guess.
- **Element-level selection: DONE.** Every Liquid section emits `data-el="<key>"`
  on its editable elements (title/heading/kicker/text/body/button/image/content/
  tile/label/logo/sale/intro/instagram/countdown/form/input) and `data-el-item="<prop>:<i>"`
  on repeatables (slides/categories/items/brands/images) — keys MATCH the React
  blocks (extract via `grep -o data-el modules/cms/blocks/*.tsx`). Clicking an
  element selects it (orange box + font-size pill + Style tab). `forloop.index0`
  is the original array index even inside `{% unless %}`/`{% if %}` filters
  (the loop iterates the whole array), so it is the correct item index. Only
  `product_tabs` (live data) and `container` (nested widgets) have no element
  markers — the React blocks didn't either.
- **Remaining refinement:** header/footer chrome *selection* in-canvas (they
  render, but aren't click-to-edit).

---

## 8. Porting the remaining React themes

Still on React: `aurora`, `cignet`, `shofy`, `ekka`, `helendo`, `bazaro`, `exzo`,
`rokon`. For each: copy the `learts-liquid` package, keep the file structure, and
re-skin `theme.css` + the section markup to that theme's look. Reuse each theme's
own fonts/palette; keep the theme **self-contained** (gotcha #1). Validate (0
errors), upload, preview with `?preview_theme=`, verify in a browser, then it's
available in the library for any store to apply. The engine, contract, editor
canvas, add-to-cart, and CMS-page handling all work for ANY uploaded theme — you
only write markup + CSS.

---

## 9. Quick file map

| Concern | File |
|---|---|
| Middleware seam / ownership / preview | `apps/storefront/src/middleware.ts` |
| Per-page Liquid render | `apps/storefront/src/app/theme-render/[[...path]]/route.ts` |
| Engine (sandbox, filters, tags) | `apps/storefront/src/modules/theme-runtime/engine.ts` |
| Bundle loader (cache) | `…/theme-runtime/loader.ts` |
| Data contract mappers | `…/theme-runtime/build-context.ts` |
| Add-to-cart endpoint | `apps/storefront/src/app/api/theme-cart/route.ts` |
| Same-origin bundle proxy (editor) | `apps/storefront/src/app/api/theme-bundle/route.ts` |
| Editor Liquid canvas | `apps/storefront/src/modules/cms/editor/liquid-canvas.tsx` |
| Editor canvas (integration) | `apps/storefront/src/app/editor-canvas/[slug]/page.tsx` |
| Editor chrome/data endpoints | `apps/storefront/src/app/api/puck/{chrome,load}/route.ts` |
| Validator (security gate) | `apps/backend/src/modules/theme/lib/validator.ts` |
| Upload route | `apps/backend/src/api/admin/themes/route.ts` |
| Theme models/service | `apps/backend/src/modules/theme/` |
| CDN bundle/asset | `apps/backend/src/api/themes-cdn/{bundle,asset}/route.ts` |
| Reference theme package | `/tmp/learts-liquid/` (VM) · local `~/.claude/jobs/*/tmp/learts-liquid/` |

**When in doubt, read `learts-liquid` — it exercises every part of the contract.**

---

## 10. Porting-run addendum (2026-07-17 — all 8 React themes ported)

**Status:** every compiled React theme now has a published Liquid package:
`rokon-liquid` 1.0.2 (live: bhanga-faridpur2, curvex), `shofy-liquid` 1.0.1
(live: 6016-woodlands), `aurora-liquid` 1.0.2, `exzo-liquid` 1.0.1, `cignet-liquid`, `ekka-liquid`,
`helendo-liquid`, `bazaro-liquid` all 1.0.0 (library); ALL 8 browser-QAed (home full-scroll + PDP + live add-to-cart on rokon/shofy). Packages +
zips live in `/home/ratul/theme-dev/<handle>/`. Parameterized tooling:
`pack2.js` / `validate2.js` / `upload2.js` in `/home/ratul/theme-dev/` (select
theme via `THEME_DIR` / `THEME_ZIP` env vars). React sources were NOT touched —
interactive pages (account/checkout/order/payment/wishlist) stay React by design.

**Gotchas discovered by this run (every one shipped as a real bug first):**

1. **Reset-color specificity.** A namespaced element reset like
   `.rk-body h1..h5 { color: var(--ink) }` or `.sf-body a { color: inherit }`
   has specificity (0,1,1) and silently beats every single-class component color
   (0,1,0) — producing dark-on-dark headings on dark bands and white-on-white
   anchor "buttons" that look like empty pills. The learts-liquid reference
   deliberately sets NO color in its resets; do the same, and put explicit
   colors on component classes. If you must override, use
   `.xx-body a.xx-btn { color: ... }` (0,2,1).
2. **Liquid treats `""` as truthy.** Guard backgrounds and CTAs with
   `!= blank`, and guard CTAs on BOTH the resolved label and the href, or you
   render `background-image:url()` and label-less buttons.
3. **Tenant logos are often auto-generated dark-fill transparent SVGs.** On a
   dark footer they are invisible (and background photos showing through the
   transparency read as a "ghost duplicate"). Put the footer logo on a light
   chip.
4. **curl passes ≠ done.** All four visual bugs above returned HTTP 200 with
   zero Liquid errors. The browser pass is mandatory (guide rule 0.2).

**React theme code DELETED (2026-07-18):** the 8 compiled React theme dirs
(`src/themes/{aurora,cignet,shofy,ekka,helendo,bazaro,exzo,rokon}`) are GONE
(backup: `/home/ratul/backups/react-themes-retire-20260718.tar.gz`).
`COMPILED_THEMES` in middleware.ts is now empty; `RETIRED_THEMES` is a Map
retiring each old id to its `-liquid` successor. The storefront registry ships
only `base` (the React foundation for REACT_ONLY interactive pages — account/
checkout/order/payment/wishlist — which still render React and MUST stay).
The editor canvas registries (canvas-theme.tsx / canvas-views.tsx) carry only
the base fallback; uploaded themes render via the Liquid canvas. Backend:
`THEME_CATALOG` (_catalog.ts) is empty — the merchant gallery lists ONLY
uploaded Liquid themes; the super-admin theme + entitlements routes now
validate against published uploaded handles. `public/themes/*` static assets
(fonts/images/vendor CSS) are still referenced by the Liquid packages — NEVER
delete them. Section 8 above is historical.

**Liquid math gotcha (2026-07-18):** liquidjs `divided_by` is FLOAT division
(unlike Shopify's integer division on int operands). Any template doing
integer math (`divided_by: 86400` for countdowns etc.) MUST append `| floor`,
or the editor canvas — which renders Liquid but never runs theme.js — shows
raw decimals (`1262.8389…` days). Hit in learts-liquid `deal_of_day.liquid`
1.0.12–1.0.14; fixed by patching the `theme_file` rows in Postgres directly
(versions are "immutable", but this was a first-party bug fix). Note the VM
`/home/ratul/theme-dev/learts-liquid` dev copy is STALE (predates the data-el
markers and the server-side countdown) — do NOT repack from it without first
exporting the published files back from the DB.
