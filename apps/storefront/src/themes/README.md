# Storefront Themes

This storefront supports **multiple complete, selectable designs** ("themes"). One
set of CMS content renders through any theme — switching never loses content.

Themes are **compiled-in packages** (added by developers, shipped in the build),
selected at runtime from the admin. This is the only production-safe model for a
React/Next app: there is **no theme upload / runtime code execution** (that would
be a critical security hole and is not how any headless platform works). Users
choose from the themes that ship; we add new ones by adding code.

## How it works

```
CMS CONTENT  (pages = ordered blocks + data, per-locale, draft/publish)
     │   the BLOCK DATA CONTRACT (contract.ts) guarantees every theme
     │   renders the same content shape
     ▼
ACTIVE THEME  (a setting: `active_theme`)  ──►  THEME PACKAGE
                                                 - design tokens (CSS vars)
                                                 - a React renderer per block_type
                                                 - optional bespoke Header / Footer
                                                 - stylesheets
```

- The active theme id is the `active_theme` CMS setting (admin → Site Management →
  Storefront Themes). Activating emits `cms.published`, the storefront
  revalidates, and re-renders instantly.
- `registry.ts` is the catalog the storefront renders from; the backend keeps a
  metadata mirror in `apps/backend/src/api/admin/cms/themes/_catalog.ts` (for the
  admin gallery). Both must list the same ids.

## The contract (`contract.ts`)

- `BLOCK_TYPES` — the 11 block ids a theme may render.
- `ThemeBlockMap` — `block_type -> React component`. A theme MAY omit a block
  (it degrades to nothing). Each component receives the **resolved block data
  spread as props** plus `countryCode`; re-declare the prop interface in your
  component (copy it — don't import Learts).
- `ThemeManifest` — `{ id, name, description, preview, bodyClassName,
  stylesheets, favicon, tokens, blocks, Header?, Footer? }`.

## Add a theme (fast path)

1. Scaffold it:
   ```bash
   cd apps/storefront
   node scripts/scaffold-theme.mjs <id> "<Display Name>"
   ```
   This creates `src/themes/<id>/` starting as a clone of Learts (so it works
   immediately), then you restyle blocks one at a time.
2. Register it in `src/themes/registry.ts` (import + add to `THEMES`).
3. Mirror its metadata in `apps/backend/src/api/admin/cms/themes/_catalog.ts`.
4. Restyle: replace entries in `src/themes/<id>/blocks.ts` with your own
   components under `src/themes/<id>/blocks/*`, set `tokens`, and (optionally)
   add bespoke `Header`/`Footer` under `src/themes/<id>/chrome/*`.
5. Generate a preview thumbnail:
   ```bash
   node scripts/theme-preview.mjs <id>
   ```
   (activates the theme, screenshots the home, reverts — needs both servers up.)
6. Type-check: `npx tsc --noEmit`. Activate it from the admin gallery to verify.

## Authoring rules (learned from Aurora)

- **Tailwind `content` must include `./src/themes/**`** (already configured) —
  otherwise utility classes used only in a theme are not generated and the theme
  renders unstyled.
- If your theme keeps the Learts base stylesheets loaded (so interior commerce
  pages stay styled), any theme override CSS must **only touch what it must**
  (e.g. font-family) and must NOT use selectors more specific than a single class
  on elements that Tailwind utilities target — it will override Tailwind. See
  `public/themes/aurora/aurora.css`.
- Match the original block's interactivity (client vs server) and its empty
  guards. Async blocks (`product_tabs`, `category_showcase`) must reuse the live
  data-fetching and keep the `countryCode` prop.
- Use `LocalizedClientLink` for internal links (keeps the `/[countryCode]` prefix)
  and inline SVGs for icons (never icon fonts).

## Themes that ship today

- **learts** — original Forever Finds (warm handcrafted gift-shop).
- **aurora** — modern minimalist editorial.
