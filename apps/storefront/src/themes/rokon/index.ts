/* Rokon — storefront theme manifest. Converted from the user's licensed
 * "Rokon" single-product eCommerce HTML template (Hook theme, demo 1 /
 * index.html): bold red accent on near-black ink, Rubik body, Work Sans
 * headings. Loads the template's own CSS stack (patched: the 10px-rem base
 * was converted to px so the app's 16px root and Tailwind utilities stay
 * intact); all template JS is reimplemented in React inside components. */
import type { ThemeManifest } from "../contract"
import { rokonBlocks } from "./blocks"
import RokonHeader from "./chrome/RokonHeader"
import RokonFooter from "./chrome/RokonFooter"
import RokonStore from "./templates/RokonStore"
import RokonProduct from "./templates/RokonProduct"
import RokonCart from "./templates/RokonCart"
import RokonCategory from "./templates/RokonCategory"
import RokonLogin from "./templates/RokonLogin"

export const ROKON_STYLESHEETS = [
  "https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800&family=Work+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap",
  "/rokon/css/plugins/swiper-bundle.min.css",
  "/rokon/css/style.css",
  // Bridge sheet: maps the CMS --ff-* theme vars onto Rokon's own CSS vars
  // and carries React-port fixes. Loaded last; bump ?v= on every edit.
  "/themes/rokon/rokon.css?v=1",
]

export const rokonTheme: ThemeManifest = {
  id: "rokon",
  name: "Rokon",
  description:
    "Bold product-led design: red accent on near-black ink, Rubik and Work Sans type, tech-store energy.",
  preview: "/themes/rokon/preview.png",
  bodyClassName: "rokon-theme",
  favicon: "/rokon/img/favicon.ico",
  stylesheets: ROKON_STYLESHEETS,
  tokens: {
    colors: {
      primary: "#d72323",
      dark: "#222222",
      border: "#e4e4e4",
      text: "#4a4c59",
      heading: "#222222",
      bg: "#ffffff",
    },
    fonts: {
      body: '"Rubik", sans-serif',
      heading: '"Work Sans", sans-serif',
    },
  },
  blocks: rokonBlocks,
  Header: RokonHeader,
  Footer: RokonFooter,
  templates: {
    store: RokonStore,
    product: RokonProduct,
    cart: RokonCart,
    category: RokonCategory,
    login: RokonLogin,
  },
  // No-CMS fallback homepage: brand-neutral commerce copy over the theme's
  // own imagery, so a fresh store (new tenant, nothing published yet) still
  // opens looking like Rokon. Shapes mirror the backend registry defaults.
  defaultSections: [
    {
      block_type: "hero_slider",
      schema_version: 1,
      autoplay_ms: 6000,
      slides: [
        {
          image: "/rokon/img/slider/home1-slider-thumbnail.webp",
          subtitle: "New in store",
          title: "Gear Built For\nEvery Adventure",
          cta: { label: "Shop now", href: "/store" },
        },
        {
          image: "/rokon/img/slider/home1-slider-thumbnail2.webp",
          subtitle: "Latest arrivals",
          title: "Quality You Can\nCount On",
          cta: { label: "Browse the range", href: "/store" },
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
      image: "/rokon/img/other/drone-image.webp",
      image_side: "left",
      eyebrow: "Our promise",
      title: "Chosen with care,\nbuilt to last",
      body: "Every product in this store is selected for quality and backed by our team. If something is not right, we make it right.",
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

export default rokonTheme
