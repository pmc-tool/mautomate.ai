/* Exzo — storefront theme manifest. Electronics/gadget-store design converted
 * from the user's licensed Exzo HTML template (demo 1, index1.html): lime
 * green #b8cd06 on white, Questrial body, Raleway 700/900 uppercase headings,
 * pill buttons and rounded imagery. Loads the template's own CSS stack (not
 * the Learts base); all template JS is reimplemented in React. */
import type { ThemeManifest } from "../contract"
import { exzoBlocks } from "./blocks"
import ExzoHeader from "./chrome/ExzoHeader"
import ExzoFooter from "./chrome/ExzoFooter"
import ExzoStore from "./templates/ExzoStore"
import ExzoProduct from "./templates/ExzoProduct"
import ExzoCart from "./templates/ExzoCart"
import ExzoCategory from "./templates/ExzoCategory"
import ExzoLogin from "./templates/ExzoLogin"

export const EXZO_STYLESHEETS = [
  "https://fonts.googleapis.com/css2?family=Questrial&family=Raleway:wght@700;900&display=swap",
  "/exzo/css/bootstrap.min.css",
  "/exzo/css/bootstrap.extension.css",
  "/exzo/css/style.css",
  "/exzo/css/swiper.css",
  "/exzo/css/sumoselect.css",
  "/exzo/css/font-awesome.min.css",
  // Bridge sheet: maps the CMS --ff-* theme vars onto Exzo's palette and
  // carries React-port fixes. Loaded last; bump ?v= on every edit.
  "/themes/exzo/exzo.css?v=1",
]

export const exzoTheme: ThemeManifest = {
  id: "exzo",
  name: "Exzo",
  description:
    "Energetic electronics-store design: lime green on white, bold uppercase Raleway headlines, pill buttons and full-height product heroes.",
  preview: "/themes/exzo/preview.png",
  bodyClassName: "exzo-theme",
  favicon: "/exzo/img/favicon.ico",
  stylesheets: EXZO_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#b8cd06",
      dark: "#343434",
      border: "#eeeeee",
      text: "#888888",
      heading: "#343434",
      bg: "#ffffff",
    },
    fonts: {
      body: '"Questrial", sans-serif',
      heading: '"Raleway", sans-serif',
    },
  },
  blocks: exzoBlocks,
  Header: ExzoHeader,
  Footer: ExzoFooter,
  templates: {
    store: ExzoStore,
    product: ExzoProduct,
    cart: ExzoCart,
    category: ExzoCategory,
    login: ExzoLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Exzo. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/exzo/img/background-1.jpg",
          subtitle: "New in store",
          title: "Gear You Will\nActually Use",
          cta: { label: "Shop now", href: "/store" },
        },
        {
          image: "/exzo/img/background-2.jpg",
          subtitle: "This season",
          title: "Big Sound,\nSmall Prices",
          cta: { label: "Browse deals", href: "/store" },
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
      image: "/exzo/img/thumbnail-24.jpg",
      image_side: "left",
      eyebrow: "Our promise",
      title: "Tested by us,\nloved by you",
      body: "Every product in this store is hand-picked and quality checked before it ships. If something is not right, our team makes it right.",
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

export default exzoTheme
