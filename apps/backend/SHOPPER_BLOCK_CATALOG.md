# Shopper App — Puck / CMS Block Catalog (Wave 1 render contract)

The spec the native (Flutter) renderers are built against. Every page returned by
the app-render endpoint (`GET /store/cms/app/pages/:slug`) carries a
`page.sections[]` array — **this is the block tree**. Each entry is one block:

```jsonc
{
  "block_type": "hero_slider",   // discriminator — pick the native renderer off this
  "schema_version": 1,           // renderer contract version for this block type
  ...blockProps                  // the resolved, locale-merged props (see below)
}
```

> NOTE ON NAMING: internally the CMS calls these "sections" (from the
> `cms_section` model + block registry). The task brief called them "Puck blocks".
> They are the same thing — a discriminated list of `{block_type, ...props}`.
> There is **no** `{root, content}` Puck wrapper in the live data; the tree is the
> flat, rank-ordered `page.sections[]` array. Render them top-to-bottom in order.

## Renderer rules (read first)

- **Dispatch on `block_type`.** Build one native widget per type below.
- **Forward-compat / graceful degrade.** If `block_type` is unknown, or
  `schema_version` is higher than you support, render **nothing** (skip the
  block) — never crash. The web storefront does exactly this. New block types can
  ship server-side before the app supports them.
- **Optional fields.** Many fields are optional (marked `?`). Absent group ⇒ that
  visual area is simply not drawn.
- **`image` is always a URL string.** Absolute (`https://api.mautomate.ai/static/...`)
  or root-relative (`/learts/assets/...`). Prefix root-relative URLs with the
  store origin before loading.
- **`href` is an in-app route or URL.** Values like `/store`, `/store?q=`,
  `/cart`, `/account`, `/contact`, `#`, or an external `https://…`. Map the
  known internal paths to native screens.
- **`title` may contain `\n`.** The web renders it as a line break — do the same.
- **Data-bound blocks fetch live.** `product_tabs`, `deal_of_day` (optional) and
  `category_showcase` reference live catalog entities by id
  (`category_id` / `collection_id` / `product_ids`). The block gives you the
  *binding*; you fetch the actual products from the Store API
  (see `SHOPPER_STORE_API.md`) and degrade gracefully if a ref 404s.
- **`elementStyles` (optional, per-block).** Some blocks carry an
  `elementStyles` object with visual overrides authored in the editor
  (e.g. `{ "title": { "style": { "typography": { "fontSize": {"value":30,"unit":"px"} } } } }`).
  It is **advisory** — honor what you can, ignore the rest. Never fail on it.

## Registry summary

**13 registered block types.** Source of truth:
`src/modules/cms/registry/*` (one file per block) + `BLOCK_REGISTRY` in
`src/modules/cms/registry/index.ts`. `BLOCK_TYPES` also lists
`announcement_bar`, but that is **not a page block** — it is the global topbar
setting (delivered under `chrome.topbar`, see bottom).

Ordered by importance / frequency on a typical store home page:

| # | `block_type` | Renderer | Data-bound? |
|---|--------------|----------|-------------|
| 1 | `hero_slider` | Full-bleed image carousel | no |
| 2 | `product_tabs` | Tabbed live product grids | **yes** (catalog) |
| 3 | `promo_banner_grid` | Mixed promo/category/instagram tile grid | no |
| 4 | `category_showcase` | "Shop by category" tile grid | optional (category) |
| 5 | `image_with_text` | Two-column image + copy banner | no |
| 6 | `rich_text` | Free-form sanitized HTML block | no |
| 7 | `deal_of_day` | Single promo + countdown timer | optional (product) |
| 8 | `brand_strip` | Row of brand logos | no |
| 9 | `testimonials` | Customer quote cards | no |
| 10 | `instagram_grid` | Row of square instagram tiles | no |
| 11 | `image_gallery` | Collage / lookbook grid | no |
| 12 | `newsletter` | Email-signup section | no |
| 13 | `container` | Free-form column layout of atomic widgets | no (nested) |

---

## 1. `hero_slider` — full-width slide carousel
```ts
{
  autoplay_ms?: number          // 0 = no autoplay (default 5000)
  slides: Array<{
    image: string               // media URL (required)
    subtitle?: string           // short kicker line
    title: string               // headline; "\n" => line break (required)
    cta: { label?: string; href: string }   // button (href required)
  }>
}
```

## 2. `product_tabs` — tabbed live product grids  *(data-bound)*
```ts
{
  tabs: Array<{
    label: string               // tab button text (required)
    source: "all" | "category" | "collection" | "manual"
    category_id?: string        // when source="category"
    collection_id?: string      // when source="collection"
    product_ids?: string[]      // when source="manual" (explicit, ordered)
    sort?: "created_at" | "price_asc" | "price_desc"
    limit?: number              // max products (default 10)
  }>
}
```
Per tab, fetch products from the Store API:
- `all` → latest products of the store (`GET /store/products?limit=…&order=…`)
- `category` → `?category_id[]=…`
- `collection` → `?collection_id[]=…`
- `manual` → `?id[]=…` (preserve the given order client-side)

## 3. `promo_banner_grid` — mixed promo / category / instagram tiles
```ts
{
  intro?:   { title: string; body: string; link_label: string; href: string }
  sale?:    { image: string; special_title: string; title: string; link_label: string; href: string }
  categories: Array<{           // always an array (may be empty)
    image: string; title: string; count_label?: string; href: string
    wide?: boolean              // spans two columns
  }>
  instagram?: { image: string; sub_title: string; handle: string; href: string }
}
```
`intro` / `sale` / `instagram` are optional groups — omit ⇒ don't render that area.

## 4. `category_showcase` — "Shop by categories" tile grid
```ts
{
  sub_title?: string            // small kicker
  title: string                 // section heading (required)
  items: Array<{
    category_id?: string        // live ref; skip tile if category gone; drives item count
    label: string               // display name
    image: string               // media URL (required)
    href: string                // link target (required)
  }>
}
```
A tile with `category_id` may show a live product count (from the resolved
category); a tile without one is static (no count).

## 5. `image_with_text` — image + copy banner (media object)
```ts
{
  image: string                 // media URL (required)
  image_side: "left" | "right"  // default "left"
  eyebrow?: string              // small kicker above title
  title: string                 // headline; "\n" => line break (required)
  body?: string                 // paragraph copy
  cta?: { label?: string; href: string }   // omit => no button
}
```

## 6. `rich_text` — free-form HTML content block
```ts
{
  html: string                  // sanitized HTML fragment (required)
  width?: "narrow" | "normal" | "wide" | "full"   // container width (default "normal")
}
```
`html` is authored HTML (headings, paragraphs, lists, links, emphasis). No
`<script>`/`<style>`/inline handlers (stripped server + client). Render with a
native HTML widget (e.g. `flutter_html`). `width` is a layout hint.

## 7. `deal_of_day` — single promo with live countdown  *(optional product ref)*
```ts
{
  image: string                 // media URL (required)
  title: string                 // "Deal of the day" (required)
  description?: string
  countdown_to: string          // ISO 8601 datetime the timer counts down to (required)
  cta: { label?: string; href: string }   // href required
}
```
`countdown_to` is an ISO string; tick down to it client-side.

## 8. `brand_strip` — brand logo strip
```ts
{
  title?: string                // section heading (omit => no heading)
  brands: Array<{ image: string; href: string }>   // always an array
}
```

## 9. `testimonials` — customer quote cards
```ts
{
  title?: string                // section heading
  items: Array<{
    quote: string               // testimonial body (required)
    author: string              // person's name (required)
    role?: string               // role / company line
    avatar?: string             // media URL (round avatar)
  }>
}
```

## 10. `instagram_grid` — row of square instagram tiles
```ts
{
  handle: string                // "@store_handle" (required)
  heading?: string              // section sub-title
  images: Array<{ image: string; href: string }>   // always an array (6–8 typical)
}
```

## 11. `image_gallery` — collage / lookbook grid
```ts
{
  heading?: string
  subheading?: string
  columns?: string              // "2".."6" as a string (default "3")
  gap?: string                  // px gap as a string (default "12")
  aspect?: string               // "square" | "portrait" | "landscape" | "auto"
  items: Array<{ image: string; caption?: string; href?: string }>
}
```

## 12. `newsletter` — email-signup section
```ts
{
  title: string                 // headline (required)
  subtitle?: string
  placeholder: string           // email input placeholder (required)
  button: string                // submit label (required)
  provider_note?: string        // small print under the form
}
```
Submission wiring is app-side (POST to the store's newsletter/subscribe flow).

## 13. `container` — free-form column layout of atomic widgets  *(advanced)*
```ts
{
  layout: "1" | "2" | "3" | "4"              // column count as a string
  gap?: { value: number; unit: string }
  verticalAlign?: "top" | "center" | "bottom"
  columns: Array<{ widgets: Widget[] }>      // one entry per column
}
// Widget = { widget_type: string, style?, advanced?, ...contentProps }
```
The **widget vocabulary is owned by the storefront**
(`heading` / `text` / `image` / `button` / `spacer` / `divider` / `video` /
`icon` / `html`), and the backend is intentionally permissive (any object with a
string `widget_type` passes through). Build a secondary dispatch on
`widget_type`; sanitize `html` widgets and whitelist `video` hosts at render
time. This is the lowest-priority block for Wave 1 — many stores won't use it.

---

## Store chrome (NOT page blocks) — `chrome` key on the same response

The app-render response also returns the resolved store chrome so the native app
can draw the header/topbar/footer without a second call. These are **global
settings** (`cms_setting`), not page blocks, and are the same objects the web
storefront reads from `GET /store/cms/settings`.

- `chrome.topbar` — announcement bar: `{ message, enabled, language_label, currency_label, links[] }`
- `chrome.header` — `{ logo, logo_alt, search{enabled,placeholder,action}, icons{account,wishlist,cart}, menu[], mobile_menu_categories }`
  - `menu[]` items: `{ label, href?, children_dynamic?, source?, limit? }`.
    A sentinel item with `label === "__dynamic_categories__"` expands to live
    top-level category links (respect `limit`); an item with `children_dynamic`
    renders a dynamic-category submenu.
- `chrome.footer` — `{ contact, column_categories, column_links[], social[], newsletter, bottom_logo, payment_image, copyright }`.
  `copyright` may contain a `{year}` token — substitute the current year.

## Design tokens — `design` key

```ts
design: {
  colors: { primary, dark, border, text, heading, bg },   // hex strings
  fonts:  { body, heading },                               // CSS font stacks
  logo:   string
}
```
Use these as the app's theme (primary/accent color, text/heading colors,
background, and the two font families). Falls back to the platform defaults when
a store hasn't customized its theme.

## Branding — `branding` key

```ts
branding: {
  name: string | null,          // store display name
  logo_url: string | null,      // tenant.meta.logo_url (falls back to theme.logo)
  accent: string | null,        // durable per-tenant brand accent hex (may be null)
  active_theme: string          // active theme id, e.g. "learts-liquid"
}
```
