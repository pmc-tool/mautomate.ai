# Cignet theme — conversion brief (working notes for the build)

Cignet is the user's licensed jewellery-store HTML template being converted
into a storefront theme, exactly the way Aurora was built. Deep green
(#2F3D38) + ivory, Playfair Display headings, Roboto body.

## Sources of truth (read these first)

- `src/themes/README.md` — the theme-system how-to. Follow it.
- `src/themes/contract.ts` — ThemeManifest / block prop types.
- `src/themes/aurora/` — the precedent theme. For every file you build, read
  the Aurora counterpart FIRST and mirror its structure, props, data access,
  and export shape exactly.
- Backend block data shapes: `apps/backend/src/modules/cms/registry/<block>.ts`
  (defaultData = the props your block receives, spread by SectionRenderer).
- Template markup: `/Users/nowshidalamsayem/Desktop/CLAUDE/cignet/*.html`.
  Find sections via their `<!-- ... Section Start -->` comments.

## Hard rules

1. NO template JavaScript. Never import or reference `/cignet/js/*`. All
   interactivity (sliders, tabs, accordions, sticky header, mobile menu,
   quantity steppers) is reimplemented in React. `"use client"` only on
   components that need state/effects; data-fetching blocks stay server
   components (see Aurora's ProductTabs/CategoryShowcase).
2. KEEP the template's class names and DOM structure. The theme loads the
   template's own CSS (`/cignet/css/custom.css`, bootstrap, swiper, slicknav,
   Font Awesome) via the manifest, so faithful markup = faithful design.
   Font Awesome `fa-*` classes ARE allowed in this theme (its own stylesheet
   stack loads them; the README inline-SVG rule is for cross-theme code).
3. Strip `wow`/`animate` JS-dependent attributes are harmless to keep as
   classes (a bridge rule forces visibility), but drop `data-wow-delay`
   noise and never rely on animation for content visibility. Drop the
   preloader, magnific-popup, mouse-cursor, and YTPlayer features entirely.
4. Internal links: `LocalizedClientLink` from
   `@modules/common/components/localized-client-link` (keeps /[countryCode]).
5. Images: prefer CMS/block-provided media; where the block data has no
   image, default to the template's own files under `/cignet/images/...`
   (they are copied into `public/cignet/images/`, same filenames as the
   template's `images/` dir).
6. Data comes from the standard helpers in `src/lib/data/*` and shared
   commerce widgets (`LeartsActionsWrapper` for add-to-cart, `ImageGallery`,
   `RefinementList`, `Pagination`, etc.) — copy Aurora's choices.
7. Blocks must render null (not crash) when their data is empty, and accept
   `countryCode` + `sectionScope` like the Learts/Aurora versions.
8. TypeScript strict; Prettier: no semicolons, double quotes, 2-space indent.
   No emojis anywhere.
9. Wrap each block's outermost element in the template's section classes AND
   keep it inside the page's `cignet-theme` scope (pages add that class; do
   not add <body>-level wrappers inside blocks).

## Template page -> theme file map

- index.html: Hero -> blocks/HeroSlider; Our Best Sellers + Our Products ->
  blocks/ProductTabs; Limited Offer -> blocks/DealOfDay; Our Collection ->
  blocks/CategoryShowcase; Intro Video + Our Promise -> blocks/ImageWithText;
  Our Testimonials (+ google-rating box) -> blocks/Testimonials and
  blocks/BrandStrip; Our FAQ -> blocks/RichText (accordion variant); Our
  Blog -> blocks/InstagramGrid (media grid) ; footer newsletter + CTA ->
  blocks/Newsletter; collection banners -> blocks/PromoBannerGrid.
- Header/topbar/mobile menu (any page's shared chrome) -> chrome/CignetHeader.
- Footer -> chrome/CignetFooter.
- products.html -> templates/CignetStore + templates/CignetCategory.
- product-single.html -> templates/CignetProduct.
- cart.html -> templates/CignetCart.
- login.html -> templates/CignetLogin.

Each block's PROPS come from the backend registry defaultData for its block
type — the Cignet section content (headings, images, items) becomes the
DEFAULTS when props are missing, so the theme looks complete out of the box
but stays fully CMS-editable.
