# Theme Conversion Playbook

How to convert one of the user's licensed HTML templates (in
`~/Desktop/CLAUDE/templates/<name>`) into a complete, switchable storefront
theme. This generalizes the Cignet build (see `cignet/` for the reference
implementation of every file type) and encodes every defect found in its QA.

## Read first, always

1. `src/themes/README.md` — the theme system.
2. `src/themes/contract.ts` — ThemeManifest (incl. `defaultSections`).
3. `src/themes/cignet/` — the REFERENCE conversion. For each file you write,
   read the Cignet counterpart first and mirror its structure exactly.
4. Backend block shapes: `apps/backend/src/modules/cms/registry/<block>.ts`
   (defaultData = the props your block receives).

## The deliverable (per theme, ~25 files)

- `src/themes/<id>/index.ts` — manifest: stylesheets (template's own CSS
  stack + Google Fonts css2 URL + `/themes/<id>/<id>.css?v=1` bridge LAST),
  tokens, blocks, Header/Footer, 5 templates, `defaultSections` (fallback
  homepage for stores with no CMS content: hero + category_showcase +
  product_tabs + image_with_text + newsletter, brand-neutral copy, template
  imagery — copy Cignet's shapes exactly).
- `blocks.ts` + `blocks/` — bespoke renderers for ALL 11 visual block types
  (hero_slider, promo_banner_grid, product_tabs, deal_of_day,
  category_showcase, brand_strip, rich_text (+accordion items variant),
  image_with_text, newsletter, instagram_grid, testimonials); `container`
  imports the shared `@modules/cms/blocks/Container`.
- `chrome/` — Header (topbar if template has one, CMS-driven nav like
  CignetHeader with the same FALLBACK shapes, live cart count, search,
  sticky-on-scroll, React mobile menu) + Footer (live categories +
  getCmsSettings, same data flow as CignetFooter).
- `templates/` — Store, Category, Product (+ client Tabs sub-component),
  Cart, Login. Mirror the Cignet versions' props and shared-component reuse
  EXACTLY (LeartsActionsWrapper, ImageGallery, RelatedProducts,
  RefinementList, Pagination, CartTotals, DiscountCode, login/signup actions).
- `public/<id>/` — template css/images (+ fonts if local). Bridge sheet at
  `public/themes/<id>/<id>.css`.
- Registration: `src/themes/registry.ts` + backend
  `apps/backend/src/api/admin/cms/themes/_catalog.ts` (same id both).

## Hard rules (violations were real bugs)

1. NO template JavaScript, ever. All interactivity in React.
2. Keep the template's class names + DOM so its own CSS styles it.
3. Multi-demo templates: convert `index.html` (demo 1) only, plus the shop /
   product-detail / cart / login pages that match it.
4. `LocalizedClientLink` for internal links; plain `<a>` for external.
5. Blocks: props from registry defaultData; `countryCode`/`sectionScope`
   forwarded; render null on empty; template content as built-in defaults.
6. Data ONLY via `src/lib/data/*` and shared commerce components.
7. Login renders INSIDE the shared account layout's container — NO full-bleed
   page-header banner there; use a contained in-flow heading (see
   CignetLogin). Style breadcrumb links (UA blue otherwise).
8. Product template MUST fall back to a placeholder image when the product
   has no photos (empty gallery collapses the layout) — see PLACEHOLDER_IMAGES
   in CignetProduct.
9. Hero must stay legible on light CMS images: scoped scrim like Cignet's
   `.cignet-theme .hero::before` gradient.
10. Prettier: no semicolons, double quotes, 2-space indent. No emojis.
    Strict TS: `npx tsc --noEmit` must pass.

## HTTrack-mirror gotchas (check EVERY template)

- Google Fonts links are mangled (`../../fonts.googleapis.com/...`) — load
  fonts via a real `https://fonts.googleapis.com/css2?...` URL in the
  manifest stylesheets (identify families from the mangled URL / CSS).
- Icon webfonts may be missing: if CSS references `../webfonts/` or
  `../fonts/` files that don't exist, fetch the real files (Font Awesome from
  the `@fortawesome/fontawesome-free` npm tarball; template-custom icon fonts
  from wherever the template ships them) into `public/<id>/webfonts/`.
- `grep -c "url(" **/*.css` for `.html` extensions inside `url()` — HTTrack
  rewrites image/font URLs to `.html` (e.g. `bg-image.html` for `bg-image.jpg`)
  and rewrites STRING literals too (Bootstrap's breadcrumb divider fallback
  became the mirror's URL). Patch the css copies under `public/<id>/`.
- Delete `*.tmp`, `*.delayed`, `robots.txt`, HTTrack junk from copied assets.

## CSS clash traps

- Tailwind's `.collapse` utility (visibility: collapse) beats Bootstrap's
  `.collapse` class — if the template uses Bootstrap navbars, add
  `.<id>-theme .navbar-collapse { visibility: visible }` to the bridge.
- Templates often hide nav/elements until their JS runs (visibility patterns,
  preloaders, wow.js). Bridge sheet forces: preloader display none, `.wow`
  visible, sticky header non-fixed at rest.
- The shared add-to-cart widget (LeartsActionsWrapper) emits Learts-era
  classes (`.product-summery`, `.product-variations`, `.qty-btn`,
  `.product-buttons` etc.) that have NO styling outside Learts — every theme's
  bridge sheet MUST carry a scoped skin for them (copy Cignet's block in
  `public/themes/cignet/cignet.css` and restyle to the theme's tokens).
- Account inner pages + CMS contact page render shared learts-classed markup;
  give them a scoped neutral skin in the bridge sheet too.
- No universal `*` rules; nothing more specific than needed; never fight
  Tailwind utilities on non-themed pages (checkout must stay intact).

## Verification bar (nothing ships without ALL of these)

1. `npx tsc --noEmit` clean.
2. Desktop screenshots: home (top + every section), store, product, cart,
   login — via local storefront against the prod backend:
   `THEME_PREVIEW_ID=<id> NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.foreverfinds.shop NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<prod key> npm run dev`
   (CORS errors on client-side fetches are expected in this setup; visual
   only. Headless Chrome via playwright-core channel "chrome".)
3. Mobile 390px: zero horizontal overflow (scrollWidth == innerWidth) on
   home/store/product/cart; mobile menu opens/closes.
4. Interactions: quantity stepper, variant pills, product tabs, nav dropdown
   hover, hero slider advance.
5. Unknown product URL returns 404 (not 500).
6. preview.png (1280x800 home screenshot) at `public/themes/<id>/preview.png`.

## Contact link rule (added after starter-pages work)

Fallback nav/footer "Contact" links MUST point to `/contact-us` (the seeded,
tenant-aware CMS page), NOT `/contact` (a hardcoded storefront route with
Forever Finds boilerplate that only suits the single-tenant FF store).

## Icon-font weight rule (added after Shofy QA)

Templates using Font Awesome PRO request family "Font Awesome 6 Pro" at
weights 100/300/400. The freely-licensed set only fully covers solid (900);
the free regular face has ~160 glyphs and misses common ones (fa-angle-*),
rendering boxes. Fix in the bridge sheet (loads last, wins): re-declare
@font-face for that family at weights 100/300/400 pointing at the free
fa-solid-900.woff2. Also swap any `fa-regular fa-angle-*` / pro-only class
usages in JSX to `fa-solid`. VERIFY icons visually — boxes next to dropdown
labels are this bug.
