import type { BlockSchema } from "../types"

const BRAND = "/learts/assets/images/brands"

export const brandStripSchema: BlockSchema = {
  type: "brand_strip",
  label: "Brand Strip",
  category: "media",
  icon: "Award",
  fields: [
    {
      name: "title",
      type: "text",
      label: "Heading",
      help: "Optional — leave empty to hide the heading.",
      group: "Content",
    },
    {
      name: "brands",
      type: "list",
      label: "Brands",
      itemLabel: "Brand",
      maxItems: 12,
      group: "Content",
      fields: [
        { name: "image", type: "image", label: "Logo", required: true },
        { name: "href", type: "url", label: "Link", default: "#", required: true },
      ],
    },
  ],
  defaultProps: {
    title: "Shop by brands",
    brands: [7, 8, 1, 2, 3, 4, 5, 6].map((n) => ({
      image: `${BRAND}/brand-${n}.webp`,
      href: "#",
    })),
  },
  presets: [
    {
      name: "Heading + four logos",
      props: {
        title: "Featured brands",
        brands: [1, 2, 3, 4].map((n) => ({
          image: `${BRAND}/brand-${n}.webp`,
          href: "#",
        })),
      },
    },
  ],
}

export default brandStripSchema
