/* Shofy — storefront theme manifest. Multipurpose electronics-store design
 * converted from the user's licensed Shofy HTML template (default demo):
 * vivid blue (#0989FF) on white, Jost type, dense product grids. Loads the
 * template's own CSS stack (not the Learts base); all template JS is
 * reimplemented in React inside components. */
import type { ThemeManifest } from "../contract"
import { shofyBlocks } from "./blocks"
import ShofyHeader from "./chrome/ShofyHeader"
import ShofyFooter from "./chrome/ShofyFooter"
import ShofyStore from "./templates/ShofyStore"
import ShofyProduct from "./templates/ShofyProduct"
import ShofyCart from "./templates/ShofyCart"
import ShofyCategory from "./templates/ShofyCategory"
import ShofyLogin from "./templates/ShofyLogin"

export const SHOFY_STYLESHEETS = [
  // The template's Google families (main.css also @imports this URL; listing
  // it here keeps the fonts loading even if the import is ever stripped).
  "https://fonts.googleapis.com/css2?family=Charm:wght@400;700&family=Jost:wght@300;400;500;600;700&family=Oregano&family=Roboto:wght@300;400;500;700;900&display=swap",
  "/shofy/css/bootstrap.css",
  "/shofy/css/animate.css",
  "/shofy/css/swiper-bundle.css",
  "/shofy/css/font-awesome-pro.css",
  "/shofy/css/spacing.css",
  "/shofy/css/main.css",
  // flaticon_shofy.css is intentionally NOT loaded: its webfonts are missing
  // from the template mirror and no component uses flaticon-* classes.
  // Bridge sheet: maps the CMS --ff-* theme vars onto Shofy's --tp-* vars
  // and carries React-port fixes. Loaded last; bump ?v= on every edit.
  "/themes/shofy/shofy.css?v=2",
]

export const shofyTheme: ThemeManifest = {
  id: "shofy",
  name: "Shofy",
  description:
    "Bright multipurpose electronics-store design - vivid blue accents, Jost type, dense product grids.",
  preview: "/themes/shofy/preview.png",
  bodyClassName: "shofy-theme",
  favicon: "/shofy/img/logo/favicon.png",
  stylesheets: SHOFY_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#0989FF",
      dark: "#010F1C",
      border: "#EAEBED",
      text: "#55585B",
      heading: "#010F1C",
      bg: "#ffffff",
    },
    fonts: {
      body: '"Jost", sans-serif',
      heading: '"Jost", sans-serif',
    },
  },
  blocks: shofyBlocks,
  Header: ShofyHeader,
  Footer: ShofyFooter,
  templates: {
    store: ShofyStore,
    product: ShofyProduct,
    cart: ShofyCart,
    category: ShofyCategory,
    login: ShofyLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Shofy. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/shofy/img/slider/slider-img-1.png",
          subtitle: "New in store",
          title: "Everything You Need,\nAll in One Place",
          cta: { label: "Shop Now", href: "/store" },
        },
        {
          image: "/shofy/img/slider/slider-img-2.png",
          subtitle: "This week only",
          title: "Fresh Arrivals,\nUnbeatable Prices",
          cta: { label: "Shop Now", href: "/store" },
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
      image: "/shofy/img/product/banner/product-banner-1.jpg",
      image_side: "left",
      eyebrow: "Our promise",
      title: "Chosen with care,\nbuilt to last",
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

export default shofyTheme
