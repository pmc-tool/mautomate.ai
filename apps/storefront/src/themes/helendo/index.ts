/* Helendo — storefront theme manifest. Minimalist furniture-store design
 * converted from the user's licensed Helendo HTML template: white canvas,
 * black type, gold (#dcb14a) accents, Roboto throughout. Loads the
 * template's own CSS stack (not the Learts base); all template JS is
 * reimplemented in React inside components. */
import type { ThemeManifest } from "../contract"
import { helendoBlocks } from "./blocks"
import HelendoHeader from "./chrome/HelendoHeader"
import HelendoFooter from "./chrome/HelendoFooter"
import HelendoStore from "./templates/HelendoStore"
import HelendoProduct from "./templates/HelendoProduct"
import HelendoCart from "./templates/HelendoCart"
import HelendoCategory from "./templates/HelendoCategory"
import HelendoLogin from "./templates/HelendoLogin"

export const HELENDO_STYLESHEETS = [
  // The template's own Google Fonts set (its HTTrack-mangled @import was
  // removed from the copied style.css; loaded here instead).
  "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Mr+De+Haviland&family=Prata&family=Roboto:wght@100;300;400;500;700;900&display=swap",
  "/helendo/css/vendor/vendor.min.css",
  "/helendo/css/plugins/plugins.min.css",
  "/helendo/css/style.css",
  // Bridge sheet: maps the CMS --ff-* theme vars onto Helendo-scoped vars
  // and carries React-port fixes + skins for shared learts-classed markup.
  // Loaded last; bump ?v= on every edit.
  "/themes/helendo/helendo.css?v=1",
]

export const helendoTheme: ThemeManifest = {
  id: "helendo",
  name: "Helendo",
  description:
    "Minimalist furniture-store design: airy white layouts, black type with gold accents, editorial featured-product sections.",
  preview: "/themes/helendo/preview.png",
  bodyClassName: "helendo-theme",
  favicon: "/helendo/images/favicon.ico",
  stylesheets: HELENDO_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#dcb14a",
      dark: "#000000",
      border: "#ededed",
      text: "#666666",
      heading: "#111111",
      bg: "#ffffff",
    },
    fonts: {
      body: '"Roboto", sans-serif',
      heading: '"Roboto", sans-serif',
    },
  },
  blocks: helendoBlocks,
  Header: HelendoHeader,
  Footer: HelendoFooter,
  templates: {
    store: HelendoStore,
    product: HelendoProduct,
    cart: HelendoCart,
    category: HelendoCategory,
    login: HelendoLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Helendo. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/helendo/images/hero/home-default-1.jpg",
          subtitle: "New in store",
          title: "Welcome To\nOur Store",
          cta: { label: "Shop now", href: "/store" },
        },
        {
          image: "/helendo/images/hero/home-default-2.jpg",
          subtitle: "This season",
          title: "Made For\nModern Living",
          cta: { label: "Browse products", href: "/store" },
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
      image: "/helendo/images/featured-product/df-1.png",
      image_side: "left",
      eyebrow: "Our promise",
      title: "Chosen with care,\nmade to be kept",
      body: "Every piece in this store is selected for quality and made to last. If something is not right, our team makes it right.",
      cta: { label: "Shop the collection", href: "/store" },
    },
    {
      block_type: "newsletter",
      schema_version: 1,
      title: "Our Newsletter",
      subtitle: "New arrivals and offers, straight to your inbox.",
      placeholder: "Your email address",
      button: "Subscribe",
    },
  ],
}

export default helendoTheme
