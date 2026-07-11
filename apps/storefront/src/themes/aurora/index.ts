/* ------------------------------------------------------------------ */
/* Aurora — Theme #2 (modern minimalist)                                */
/*                                                                     */
/* A clean, editorial, whitespace-forward design. Built with Tailwind   */
/* utilities and bespoke modern chrome. Renders the SAME CMS content    */
/* as Learts via the shared block data contract.                        */
/*                                                                     */
/* Stylesheets: the Learts base sheets are kept loaded so interior      */
/* commerce pages (store/product/cart) stay styled; aurora.css loads    */
/* last and scopes clean overrides to the `.aurora-theme` surface       */
/* (header, footer, home blocks).                                       */
/* ------------------------------------------------------------------ */

import type { ThemeManifest } from "../contract"
import { LEARTS_STYLESHEETS } from "../learts"
import { auroraBlocks } from "./blocks"
import AuroraHeader from "./chrome/AuroraHeader"
import AuroraFooter from "./chrome/AuroraFooter"
import AuroraStore from "./templates/AuroraStore"
import AuroraProduct from "./templates/AuroraProduct"
import AuroraCart from "./templates/AuroraCart"
import AuroraCategory from "./templates/AuroraCategory"
import AuroraLogin from "./templates/AuroraLogin"

export const auroraTheme: ThemeManifest = {
  id: "aurora",
  name: "Aurora",
  description:
    "A modern, minimalist editorial design — generous whitespace, clean type, monochrome palette.",
  preview: "/themes/aurora/preview.png",
  bodyClassName: "aurora-theme",
  stylesheets: [...LEARTS_STYLESHEETS, "/themes/aurora/aurora.css"],
  tokens: {
    colors: {
      primary: "#111111",
      dark: "#111111",
      border: "#e5e7eb",
      text: "#1a1a1a",
      heading: "#111111",
      bg: "#ffffff",
    },
    fonts: {
      body: "ui-sans-serif, system-ui, sans-serif",
      heading: "ui-sans-serif, system-ui, sans-serif",
    },
  },
  blocks: auroraBlocks,
  // Default home layout seeded for a fresh store (and for the visual editor
  // when no "home" page is published yet) — mirrors the other themes so
  // switching to Aurora never lands on an empty canvas. Aurora ships no image
  // assets of its own, so the hero/banner reference existing media the owner
  // replaces; the data-driven blocks (category_showcase, product_tabs) resolve
  // live categories/products.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/shofy/img/slider/slider-img-1.png",
          subtitle: "New in store",
          title: "Considered goods,\nfor everyday living",
          cta: { label: "Shop Now", href: "/store" },
        },
        {
          image: "/shofy/img/slider/slider-img-2.png",
          subtitle: "This week only",
          title: "Fresh arrivals,\nthoughtfully chosen",
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
  Header: AuroraHeader,
  Footer: AuroraFooter,
  templates: {
    store: AuroraStore,
    product: AuroraProduct,
    cart: AuroraCart,
    category: AuroraCategory,
    login: AuroraLogin,
  },
}

export default auroraTheme
