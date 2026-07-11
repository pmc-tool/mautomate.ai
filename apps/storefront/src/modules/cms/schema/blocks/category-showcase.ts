import type { BlockSchema } from "../types"

export const categoryShowcaseSchema: BlockSchema = {
  type: "category_showcase",
  label: "Category Showcase",
  category: "products",
  icon: "LayoutGrid",
  fields: [
    {
      name: "sub_title",
      type: "text",
      label: "Kicker",
      help: "Small line above the heading.",
      default: "Shop by categories",
      group: "Content",
    },
    {
      name: "title",
      type: "text",
      label: "Heading",
      required: true,
      default: "Making & crafting",
      group: "Content",
    },
    {
      name: "items",
      type: "list",
      label: "Tiles",
      itemLabel: "Tile",
      maxItems: 10,
      group: "Tiles",
      fields: [
        {
          name: "category_id",
          type: "collection",
          label: "Category ID",
          help: "Live product category to count items from. Leave empty for a static tile (no count). A tile referencing a deleted category is skipped.",
        },
        {
          name: "label",
          type: "text",
          label: "Label",
          help: "Display name shown on the tile. Overrides the live category name.",
          default: "Category",
        },
        {
          name: "image",
          type: "image",
          label: "Image",
          required: true,
        },
        {
          name: "href",
          type: "url",
          label: "Link",
          required: true,
          default: "/store",
        },
      ],
    },
  ],
  defaultProps: {
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
  presets: [
    {
      name: "Three-tile row",
      props: {
        sub_title: "Browse",
        title: "Shop by category",
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
        ],
      },
    },
  ],
}

export default categoryShowcaseSchema
