/* ------------------------------------------------------------------ */
/* Learts — Theme #1 (the original Forever Finds design)                */
/*                                                                     */
/* The current handcrafted gift-shop look, expressed as a theme         */
/* manifest. Its stylesheets and tokens reproduce the pre-theme         */
/* storefront exactly, so activating it is a no-op visually.            */
/* ------------------------------------------------------------------ */

import type { ThemeManifest } from "../contract"
import { leartsBlocks } from "./blocks"

/** The Learts vendor + theme stylesheets, in load order. */
export const LEARTS_STYLESHEETS = [
  "/learts/assets/css/vendor/bootstrap.min.css",
  "/learts/assets/css/vendor/fontawesome.min.css",
  "/learts/assets/css/vendor/themify-icons.css",
  "/learts/assets/css/vendor/customFonts.css",
  "/learts/assets/css/plugins/swiper.min.css",
  "/learts/assets/css/plugins/slick.css",
  "/learts/assets/css/plugins/nice-select.css",
  "/learts/assets/css/style.min.css",
  // Version query busts the browser/CDN cache when this file changes — iOS
  // Safari otherwise holds the old stylesheet for hours (max-age). Bump on edit.
  "/learts/theme-overrides.css?v=20260702b",
]

export const leartsTheme: ThemeManifest = {
  id: "learts",
  name: "Learts",
  description:
    "The original Forever Finds design — a warm, handcrafted gift-shop look.",
  preview: "/themes/learts/preview.png",
  bodyClassName: "learts-theme",
  stylesheets: LEARTS_STYLESHEETS,
  favicon: "/learts/assets/images/favicon.webp",
  tokens: {
    colors: {
      primary: "#72a499",
      dark: "#1f1f1f",
      border: "#e5e5e5",
      text: "#333",
      heading: "#1f1f1f",
      bg: "#fff",
    },
    fonts: { body: "Jost, sans-serif", heading: "Marcellus, serif" },
  },
  blocks: leartsBlocks,
  // No-CMS fallback homepage for Learts (the DEFAULT theme every new store
  // starts on). These sections reproduce the original hardcoded Learts home —
  // same hero, category banners, product tabs, deal-of-day, shop categories,
  // brands — so both the visual editor's seeded page and the storefront render
  // CMS-editable sections that look identical to the pre-CMS home. Shapes match
  // the backend block registry defaultData contracts (see modules/cms/schema).
  defaultSections: [
    // 1) Hero slider — the three Learts home3 slides (HeroSlider.tsx).
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 5000,
      slides: [
        {
          image: "/learts/assets/images/slider/home3/slide-1.webp",
          subtitle: "Handicraft shop",
          title: "Inspired by Your\nSweetest Dreams",
          cta: { label: "shop now", href: "/store" },
        },
        {
          image: "/learts/assets/images/slider/home3/slide-2.webp",
          subtitle: "Handicraft shop",
          title: "Daily Recipes\nfor Your Health",
          cta: { label: "shop now", href: "/store" },
        },
        {
          image: "/learts/assets/images/slider/home3/slide-3.webp",
          subtitle: "Handicraft shop",
          title: "Decorative Box\nfor New Aspiration",
          cta: { label: "shop now", href: "/store" },
        },
      ],
    },
    // 2) Promo banner grid — the CategoryBanners collage (intro blockquote,
    //    spring-sale tile, Home Decor / Gift Ideas tiles, Instagram tile, wide
    //    Toys tile). Copy pulled from category-banners.tsx (brand-neutral).
    {
      block_type: "promo_banner_grid",
      schema_version: 1,
      intro: {
        title: "Handcrafted goods and thoughtful gifts, delivered.",
        body: "Crafting beautiful stuff with our own hands and the help from useful tools is a wonderful process, where you can enjoy yourself while pulling out some ideas and busy perfecting your work. We provide high-end unique vases, wall arts, home accessories, and furniture pieces.",
        link_label: "ABOUT US",
        href: "/store",
      },
      sale: {
        image: "/learts/assets/images/banner/sale/sale-banner3-1.webp",
        special_title: "Spring sale",
        title: "Sale up to 10% all",
        link_label: "SHOP NOW",
        href: "/store",
      },
      categories: [
        {
          image: "/learts/assets/images/banner/category/banner-s2-7.webp",
          title: "Home Decor",
          count_label: "16 items",
          href: "/store",
          wide: false,
        },
        {
          image: "/learts/assets/images/banner/category/banner-s2-8.webp",
          title: "Gift Ideas",
          count_label: "16 items",
          href: "/store",
          wide: false,
        },
        {
          image: "/learts/assets/images/banner/category/banner-s2-9.webp",
          title: "Toys",
          count_label: "6 items",
          href: "/store",
          wide: true,
        },
      ],
      instagram: {
        image: "/learts/assets/images/banner/instagram-1.webp",
        sub_title: "Follow us on instagram",
        handle: "@forever_finds",
        href: "#",
      },
    },
    // 3) Product tabs — New arrivals / Sale items / Best sellers. Products are
    //    fetched live from the store; only labels/sources/limits are config.
    {
      block_type: "product_tabs",
      schema_version: 1,
      tabs: [
        { label: "New arrivals", source: "all", sort: "created_at", limit: 10 },
        { label: "Sale items", source: "all", sort: "created_at", limit: 10 },
        { label: "Best sellers", source: "all", sort: "price_desc", limit: 10 },
      ],
    },
    // 4) Deal of the day — matches deal-of-day.tsx copy/image. countdown_to is
    //    far-future so the timer always reads positive on a fresh store.
    {
      block_type: "deal_of_day",
      schema_version: 1,
      title: "Deal of the day",
      description:
        "Years of experience brought about by our skilled craftsmen could ensure that every piece produced is a work of art. Our focus is always the best quality possible.",
      image: "/learts/assets/images/product/deal-product-1.webp",
      countdown_to: "2030-01-01T00:00:00.000Z",
      cta: { label: "Shop Now", href: "/store" },
    },
    // 5) Category showcase — the "Making & crafting" shop-by-categories grid
    //    (shop-categories.tsx). Static tiles (no live category link/count).
    {
      block_type: "category_showcase",
      schema_version: 1,
      sub_title: "Shop by categories",
      title: "Making & crafting",
      items: [
        {
          category_id: "",
          label: "Gift ideas",
          image: "/learts/assets/images/banner/category/banner-s5-1.webp",
          href: "/store",
        },
        {
          category_id: "",
          label: "Home Decor",
          image: "/learts/assets/images/banner/category/banner-s5-2.webp",
          href: "/store",
        },
        {
          category_id: "",
          label: "Toys",
          image: "/learts/assets/images/banner/category/banner-s5-3.webp",
          href: "/store",
        },
        {
          category_id: "",
          label: "Pots",
          image: "/learts/assets/images/banner/category/banner-s5-4.webp",
          href: "/store",
        },
        {
          category_id: "",
          label: "Kniting & Sewing",
          image: "/learts/assets/images/banner/category/banner-s5-5.webp",
          href: "/store",
        },
      ],
    },
    // 6) Brand strip — the "Shop by brands" carousel (brands.tsx: brand-7,8,1..6).
    {
      block_type: "brand_strip",
      schema_version: 1,
      title: "Shop by brands",
      brands: [7, 8, 1, 2, 3, 4, 5, 6].map((n) => ({
        image: `/learts/assets/images/brands/brand-${n}.webp`,
        href: "#",
      })),
    },
    // 7) Newsletter — closing signup band (registry default copy).
    {
      block_type: "newsletter",
      schema_version: 1,
      title: "Sign up to Newsletter",
      subtitle: "...and receive $20 coupon for your first shopping.",
      placeholder: "Enter your email address",
      button: "Subscribe",
      provider_note: "We respect your privacy. Unsubscribe at any time.",
    },
  ],
}

export default leartsTheme
