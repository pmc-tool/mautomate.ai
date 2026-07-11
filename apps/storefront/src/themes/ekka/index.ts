/* Ekka — storefront theme manifest. Multipurpose ecommerce design converted
 * from the user's licensed Ekka HTML template (demo 1): clean white layout,
 * Poppins type, primary blue accents, card-based product grids. Loads the
 * template's own CSS stack (not the Learts base); all template JS is
 * reimplemented in React inside components. Fonts are local (Poppins /
 * Montserrat / Oswald TTFs shipped under /ekka/fonts) — no Google Fonts URL. */
import type { ThemeManifest } from "../contract"
import { ekkaBlocks } from "./blocks"
import EkkaHeader from "./chrome/EkkaHeader"
import EkkaFooter from "./chrome/EkkaFooter"
import EkkaStore from "./templates/EkkaStore"
import EkkaProduct from "./templates/EkkaProduct"
import EkkaCart from "./templates/EkkaCart"
import EkkaCategory from "./templates/EkkaCategory"
import EkkaLogin from "./templates/EkkaLogin"

export const EKKA_STYLESHEETS = [
  "/ekka/css/vendor/ecicons.min.css",
  "/ekka/css/plugins/animate.css",
  "/ekka/css/plugins/swiper-bundle.min.css",
  "/ekka/css/plugins/jquery-ui.min.css",
  "/ekka/css/plugins/countdownTimer.css",
  "/ekka/css/plugins/slick.min.css",
  "/ekka/css/plugins/bootstrap.css",
  "/ekka/css/demo1.css",
  "/ekka/css/style.css",
  "/ekka/css/responsive.css",
  "/ekka/css/backgrounds/bg-4.css",
  // Bridge sheet: maps the CMS --ff-* theme vars onto Ekka-scoped vars and
  // carries React-port fixes. Loaded last; bump ?v= on every edit.
  "/themes/ekka/ekka.css?v=1",
]

export const ekkaTheme: ThemeManifest = {
  id: "ekka",
  name: "Ekka",
  description:
    "Modern multipurpose ecommerce design: crisp white layout, Poppins type, blue accents, and dense card-based product grids.",
  preview: "/themes/ekka/preview.png",
  bodyClassName: "ekka-theme body-bg-4",
  favicon: "/ekka/images/favicon/favicon.png",
  stylesheets: EKKA_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#3474d4",
      dark: "#212121",
      border: "#eeeeee",
      text: "#777777",
      heading: "#212121",
      bg: "#ffffff",
    },
    fonts: {
      // The template's compiled CSS registers its webfont under the literal
      // family name "Poppins, sans-serif"; keep it first so the local TTFs
      // resolve, with conventional fallbacks after it.
      body: '"Poppins, sans-serif", "Poppins", sans-serif',
      heading: '"Poppins, sans-serif", "Poppins", sans-serif',
    },
  },
  blocks: ekkaBlocks,
  Header: EkkaHeader,
  Footer: EkkaFooter,
  templates: {
    store: EkkaStore,
    product: EkkaProduct,
    cart: EkkaCart,
    category: EkkaCategory,
    login: EkkaLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Ekka. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/ekka/images/main-slider-banner/1.jpg",
          subtitle: "Sale offer",
          title: "New Season\nCollection",
          cta: { label: "Shop now", href: "/store" },
        },
        {
          image: "/ekka/images/main-slider-banner/2.jpg",
          subtitle: "This week only",
          title: "Deals You Will\nNot Want To Miss",
          cta: { label: "Shop deals", href: "/store" },
        },
      ],
    },
    {
      block_type: "category_showcase",
      schema_version: 1,
      sub_title: "Browse the range",
      title: "Top categories",
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
      image: "/ekka/images/offer-image/1.jpg",
      image_side: "left",
      eyebrow: "Our promise",
      title: "Quality picks,\ndelivered fast",
      body: "Every product in this store is selected for quality and backed by our support team. If something is not right, we make it right.",
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

export default ekkaTheme
