import type { BlockSchema } from "../types"

const BANNER = "/learts/assets/images/banner"

export const promoBannerGridSchema: BlockSchema = {
  type: "promo_banner_grid",
  label: "Promo Banner Grid",
  category: "content",
  icon: "LayoutGrid",
  fields: [
    {
      name: "intro",
      type: "object",
      label: "Intro blockquote",
      group: "Intro",
      help: "Left-hand blockquote. Leave the title empty to hide this area.",
      fields: [
        { name: "title", type: "textarea", label: "Title", required: true },
        { name: "body", type: "textarea", label: "Body" },
        { name: "link_label", type: "text", label: "Link label", default: "ABOUT US" },
        { name: "href", type: "url", label: "Link", required: true, default: "/store" },
      ],
    },
    {
      name: "sale",
      type: "object",
      label: "Sale banner",
      group: "Sale",
      help: "The promotional sale tile.",
      fields: [
        { name: "image", type: "image", label: "Background image", required: true },
        { name: "special_title", type: "text", label: "Kicker", default: "Spring sale" },
        { name: "title", type: "text", label: "Title", required: true },
        { name: "link_label", type: "text", label: "Link label", default: "SHOP NOW" },
        { name: "href", type: "url", label: "Link", required: true, default: "/store" },
      ],
    },
    {
      name: "categories",
      type: "list",
      label: "Category tiles",
      itemLabel: "Tile",
      maxItems: 8,
      group: "Categories",
      fields: [
        { name: "image", type: "image", label: "Image", required: true },
        { name: "title", type: "text", label: "Title", required: true },
        { name: "count_label", type: "text", label: "Count label", help: "e.g. \"16 items\"." },
        { name: "href", type: "url", label: "Link", required: true, default: "/store" },
        {
          name: "wide",
          type: "boolean",
          label: "Wide tile",
          default: false,
          help: "Spans two columns.",
        },
        {
          name: "height",
          type: "number",
          label: "Image height (px)",
          default: 0,
          min: 0,
          max: 700,
          step: 10,
          unit: "px",
          help: "0 = use the image's natural height. Set a value (e.g. 220) to make the tile shorter.",
        },
        {
          name: "fit",
          type: "select",
          label: "Image fit",
          default: "cover",
          options: [
            { label: "Cover (fill & crop)", value: "cover" },
            { label: "Contain (show whole image)", value: "contain" },
          ],
          help: "Only applies when a height is set. Cover fills the tile; Contain shows the whole image.",
        },
      ],
    },
    {
      name: "instagram",
      type: "object",
      label: "Instagram tile",
      group: "Instagram",
      help: "The Instagram follow tile.",
      fields: [
        { name: "image", type: "image", label: "Image", required: true },
        { name: "sub_title", type: "text", label: "Kicker", default: "Follow us on instagram" },
        { name: "handle", type: "text", label: "Handle", required: true, default: "@forever_finds" },
        { name: "href", type: "url", label: "Link", required: true, default: "#" },
      ],
    },
  ],
  defaultProps: {
    intro: {
      title:
        "Forever Finds is an online shop for handicrafts and arts' works based in the US.",
      body: "Crafting beautiful stuff with our own hands and the help from useful tools is a wonderful process, where you can enjoy yourself while pulling out some ideas and busy perfecting your work. We provide high-end unique vases, wall arts, home accessories, and furniture pieces.",
      link_label: "ABOUT US",
      href: "/store",
    },
    sale: {
      image: `${BANNER}/sale/sale-banner3-1.webp`,
      special_title: "Spring sale",
      title: "Sale up to 10% all",
      link_label: "SHOP NOW",
      href: "/store",
    },
    categories: [
      {
        image: `${BANNER}/category/banner-s2-7.webp`,
        title: "Home Decor",
        count_label: "16 items",
        href: "/store",
        wide: false,
      },
      {
        image: `${BANNER}/category/banner-s2-8.webp`,
        title: "Gift Ideas",
        count_label: "16 items",
        href: "/store",
        wide: false,
      },
      {
        image: `${BANNER}/category/banner-s2-9.webp`,
        title: "Toys",
        count_label: "6 items",
        href: "/store",
        wide: true,
      },
    ],
    instagram: {
      image: `${BANNER}/instagram-1.webp`,
      sub_title: "Follow us on instagram",
      handle: "@forever_finds",
      href: "#",
    },
  },
  presets: [
    {
      name: "Categories only",
      props: {
        categories: [
          {
            image: `${BANNER}/category/banner-s2-7.webp`,
            title: "Home Decor",
            count_label: "16 items",
            href: "/store",
            wide: false,
          },
          {
            image: `${BANNER}/category/banner-s2-8.webp`,
            title: "Gift Ideas",
            count_label: "16 items",
            href: "/store",
            wide: false,
          },
        ],
      },
    },
  ],
}

export default promoBannerGridSchema
