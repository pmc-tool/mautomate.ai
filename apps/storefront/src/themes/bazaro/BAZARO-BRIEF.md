# Bazaro theme — conversion brief (shared by all build agents)

Theme id: `bazaro` — body class `bazaro-theme`. Converted from the licensed
"Bazaro — Fashion eCommerce" HTML template (aqlova), DEFAULT demo (`index.html`,
the fashion-1 demo) ONLY.

## Template source (HTTrack mirror)

Root: `/Users/nowshidalamsayem/Desktop/CLAUDE/templates/bazaro`

Most pages in the mirror are 0-byte (HTTrack failed). The usable pages are:

- `index.html` (5705 lines) — homepage. Sections:
  - search overlay: 64-248, cartmini offcanvas: 250-474, mobile offcanvas: 1061-1121
  - header: 1484-1998
  - categories icon strip: 2006-2201
  - hero slider (`aqf-slider-area`, swiper): 2203-2268
  - text marquee (`aqf-text-slide-area`): 2270-2387
  - collection slider (`aqf-collection-area`, "Season Collection"): 2389-2525
  - product tabs (`aq-product-area`, nav-tab + `aq-product-item` cards): 2527-4399
  - deals (`aqf-deals-area`, banner + countdown + product slider): 4401-4835
  - best sellers slider (`aqf-seller-area`): 4837-5236
  - summer suits (`aqf-summer-suit-area`, image + title + mini slider): 5238-5300
  - testimonials (`aqf-testimonial-area`, swiper): 5302-5472
  - feature icons strip (`aqf-shop-feature-ptb`): 5474-5528
  - footer: 5534-5683
- `product-default.html` — the SHOP LISTING page (sidebar filters + product
  grid). Product area: 2251-4838. Use for Store/Category templates.
- `product-details-default.html` — the PRODUCT DETAIL page. Details area:
  1932-2900, related-products slider 2900-3305. Use for the Product template.
- `wishlist.html` — despite the name, contains the CART page markup
  ("cart area" lines 1788-1904). Use for the Cart template.
- `categories.html` — category banner landing page (breadcrumb area 1767-1786
  is a useful page-title reference).
- There is NO login page in the mirror — build the Login template following
  CignetLogin/ShofyLogin (contained in-flow heading inside the account layout).

## Assets (already copied + HTTrack-fixed)

- `public/bazaro/{css,fonts,img}` — reference as `/bazaro/...`.
- CSS stack (order used by the manifest): bootstrap, animate, nice-select,
  custom-animation, swiper-bundle, magnific-popup, font-awesome-pro, spacing,
  main, then the bridge `/themes/bazaro/bazaro.css?v=1` LAST.
- Fonts are LOCAL Satoshi (@font-face in main.css, already fixed to real
  .woff2/.woff/.ttf). No Google Fonts needed.
- Font Awesome 6 Pro webfonts (solid/regular/light/brands) exist under
  `/bazaro/fonts/`. Per house rules still prefer inline SVG for icons —
  copy the template's own inline SVGs (it uses them heavily).
- HTTrack mangled SOME image src in the HTML to `.html`. Known real files:
  - `slider/slider-3.html` -> `slider-3.png` (note png)
  - `card/card-3.html` -> `card-3.jpg`
  - `summer-suits/summer-3.html` -> `summer-3.jpg`
  - `categories/category-N.html` -> `category-N.jpg`
  - product front/back imgs: check `public/bazaro/img/fashion-1/product/...`
    for the real extension before using.
  Never emit an `.html` image path; verify the file exists under public/bazaro.

## Design tokens (from main.css :root)

- black `#141414` (aq-theme-1 / headings), body text `#6D6868`,
  red accent `#DE1518` (deep `#C0070A`), off-white `#F7F2ED`, gray bg
  `#FAFAFA`/`#F9F9F9`, border `#F2F2F2`, success `#079D6D`.
- Fonts: `'Satoshi-Medium', sans-serif` body, `'Satoshi-Regular'` /
  `'Satoshi-Medium'` headings, `'Satoshi-Bold'` emphasis. Utility classes:
  `ff-satoshi-reg`, `ff-satoshi-med`, `ff-satoshi-bold`.
- Buttons: `aq-btn-black`, text links `aq-btn-text aq-btn-underline`,
  section headings `aq-section-subtitle` + `aq-section-title`.

## Hard rules (playbook)

1. NO template JavaScript — all interactivity is React (swipers become React
   sliders/scrollers, countdowns are React state, tabs are React state,
   Bootstrap collapse becomes React state; keep the template's class names +
   DOM so its CSS applies).
2. `LocalizedClientLink` for internal links; plain `<a>` external.
3. Data only via `src/lib/data/*` and shared commerce components.
4. Prettier: no semicolons, double quotes, 2-space indent, no emojis.
   Strict TS: `npx tsc --noEmit` must pass for all bazaro files.
5. Mirror the Cignet reference implementation file-for-file
   (`src/themes/cignet/`), with `src/themes/shofy/` as a second reference.
6. Block prop shapes come from the backend registry defaultData:
   `apps/backend/src/modules/cms/registry/*.ts` — re-declare interfaces,
   forward `countryCode`/`sectionScope`, render null on empty, template
   content as built-in defaults.
