/* Bazaro — storefront theme manifest. Fashion-store design converted from
 * the user's licensed Bazaro HTML template (default fashion demo): black on
 * white with red accents, local Satoshi type, airy editorial layouts. Loads
 * the template's own CSS stack (not the Learts base); all template JS is
 * reimplemented in React inside components. */
import type { ThemeManifest } from "../contract"
import { bazaroBlocks } from "./blocks"
import BazaroHeader from "./chrome/BazaroHeader"
import BazaroFooter from "./chrome/BazaroFooter"
import BazaroStore from "./templates/BazaroStore"
import BazaroProduct from "./templates/BazaroProduct"
import BazaroCart from "./templates/BazaroCart"
import BazaroCategory from "./templates/BazaroCategory"
import BazaroLogin from "./templates/BazaroLogin"

export const BAZARO_STYLESHEETS = [
  // No Google Fonts: Satoshi ships locally via main.css @font-face
  // (public/bazaro/fonts, HTTrack-mangled URLs already fixed).
  "/bazaro/css/bootstrap.css",
  "/bazaro/css/animate.css",
  "/bazaro/css/nice-select.css",
  "/bazaro/css/custom-animation.css",
  "/bazaro/css/swiper-bundle.css",
  "/bazaro/css/magnific-popup.css",
  "/bazaro/css/font-awesome-pro.css",
  "/bazaro/css/spacing.css",
  "/bazaro/css/main.css",
  // Bridge sheet: maps the CMS --ff-* theme vars onto Bazaro's --aq-* vars
  // and carries React-port fixes. Loaded last; bump ?v= on every edit.
  "/themes/bazaro/bazaro.css?v=1",
]

export const bazaroTheme: ThemeManifest = {
  id: "bazaro",
  name: "Bazaro",
  description:
    "Refined fashion-store design - black on white with red accents, Satoshi type, airy editorial layouts.",
  preview: "/themes/bazaro/preview.png",
  bodyClassName: "bazaro-theme",
  favicon: "/bazaro/img/logo/favicon.png",
  stylesheets: BAZARO_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#141414",
      dark: "#141414",
      border: "#F2F2F2",
      text: "#6D6868",
      heading: "#141414",
      bg: "#ffffff",
    },
    fonts: {
      body: '"Satoshi-Medium", sans-serif',
      heading: '"Satoshi-Medium", sans-serif',
    },
  },
  blocks: bazaroBlocks,
  Header: BazaroHeader,
  Footer: BazaroFooter,
  templates: {
    store: BazaroStore,
    product: BazaroProduct,
    cart: BazaroCart,
    category: BazaroCategory,
    login: BazaroLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Bazaro. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/bazaro/img/fashion-1/slider/slider-1.jpg",
          subtitle: "New in store",
          title: "Pieces You Will\nWear on Repeat",
          cta: { label: "Shop Collection", href: "/store" },
        },
        {
          image: "/bazaro/img/fashion-1/slider/slider-2.jpg",
          subtitle: "This week only",
          title: "Fresh Arrivals,\nTimeless Style",
          cta: { label: "Shop Collection", href: "/store" },
        },
      ],
    },
    {
      block_type: "category_showcase",
      schema_version: 1,
      sub_title: "Browse the range",
      title: "Shop by category",
      items: [],
    },
    {
      block_type: "product_tabs",
      schema_version: 1,
      tabs: [
        { label: "New arrivals", source: "all", sort: "created_at", limit: 8 },
        { label: "Best sellers", source: "all", sort: "price_desc", limit: 8 },
      ],
    },
    {
      block_type: "image_with_text",
      schema_version: 1,
      image: "/bazaro/img/fashion-1/summer-suits/summer-1.jpg",
      image_side: "left",
      eyebrow: "Our promise",
      title: "Chosen with care,\nmade to be kept",
      body: "Every piece in this store is selected for quality and made to last. If something is not right, our team makes it right.",
      cta: { label: "Shop the collection", href: "/store" },
    },
    {
      block_type: "newsletter",
      schema_version: 1,
      title: "Stay in the loop",
      subtitle: "New arrivals and offers, straight to your inbox.",
      placeholder: "Enter your e-mail address",
      button: "Subscribe",
    },
  ],
}

export default bazaroTheme
