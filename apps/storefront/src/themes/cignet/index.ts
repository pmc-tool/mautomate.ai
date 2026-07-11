/* Cignet — storefront theme manifest. Jewellery-store design converted from
 * the user's licensed Cignet HTML template: deep green + ivory, Playfair
 * Display headings, Roboto body. Loads the template's own CSS stack (not the
 * Learts base); all template JS is reimplemented in React inside components. */
import type { ThemeManifest } from "../contract"
import { cignetBlocks } from "./blocks"
import CignetHeader from "./chrome/CignetHeader"
import CignetFooter from "./chrome/CignetFooter"
import CignetStore from "./templates/CignetStore"
import CignetProduct from "./templates/CignetProduct"
import CignetCart from "./templates/CignetCart"
import CignetCategory from "./templates/CignetCategory"
import CignetLogin from "./templates/CignetLogin"

export const CIGNET_STYLESHEETS = [
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap",
  "/cignet/css/bootstrap.min.css",
  "/cignet/css/slicknav.min.css",
  "/cignet/css/swiper-bundle.min.css",
  "/cignet/css/all.min.css",
  "/cignet/css/custom.css",
  // Bridge sheet: maps the CMS --ff-* theme vars onto Cignet's own CSS vars
  // and carries React-port fixes. Loaded last; bump ?v= on every edit.
  "/themes/cignet/cignet.css?v=6",
]

export const cignetTheme: ThemeManifest = {
  id: "cignet",
  name: "Cignet",
  description:
    "Elegant jewellery-store design: deep green and ivory, Playfair Display serifs, editorial product layouts.",
  preview: "/themes/cignet/preview.png",
  bodyClassName: "cignet-theme",
  favicon: "/cignet/images/favicon.png",
  stylesheets: CIGNET_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#2F3D38",
      dark: "#304038",
      border: "#e3e6e4",
      text: "#596460",
      heading: "#2F3D38",
      bg: "#ffffff",
    },
    fonts: {
      body: '"Roboto", sans-serif',
      heading: '"Playfair Display", serif',
    },
  },
  blocks: cignetBlocks,
  Header: CignetHeader,
  Footer: CignetFooter,
  templates: {
    store: CignetStore,
    product: CignetProduct,
    cart: CignetCart,
    category: CignetCategory,
    login: CignetLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Cignet. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/cignet/images/hero-bg-image.jpg",
          subtitle: "New in store",
          title: "Pieces You Will\nKeep Forever",
          cta: { label: "Shop now", href: "/store" },
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
      image: "/cignet/images/collection-item-image-1.jpg",
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

export default cignetTheme
