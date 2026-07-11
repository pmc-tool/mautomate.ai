import type { BlockSchema } from "../types"

const INSTA = "/learts/assets/images/instagram"

export const instagramGridSchema: BlockSchema = {
  type: "instagram_grid",
  label: "Instagram Grid",
  category: "social",
  icon: "Instagram",
  fields: [
    {
      name: "handle",
      type: "text",
      label: "Instagram handle",
      required: true,
      default: "@forever_finds",
      help: "Shown as the section title, e.g. \"@forever_finds\".",
      group: "Content",
    },
    {
      name: "heading",
      type: "text",
      label: "Heading",
      default: "Follow us on instagram",
      help: "Small sub-title shown above the handle.",
      group: "Content",
    },
    {
      name: "images",
      type: "list",
      label: "Tiles",
      itemLabel: "Tile",
      maxItems: 8,
      group: "Media",
      help: "6-8 square tiles look best.",
      fields: [
        { name: "image", type: "image", label: "Image", required: true },
        { name: "href", type: "url", label: "Link", required: true, default: "#" },
      ],
    },
  ],
  defaultProps: {
    handle: "@forever_finds",
    heading: "Follow us on instagram",
    images: [
      { image: `${INSTA}/instagram-1.webp`, href: "#" },
      { image: `${INSTA}/instagram-2.webp`, href: "#" },
      { image: `${INSTA}/instagram-3.webp`, href: "#" },
      { image: `${INSTA}/instagram-4.webp`, href: "#" },
      { image: `${INSTA}/instagram-1.webp`, href: "#" },
      { image: `${INSTA}/instagram-2.webp`, href: "#" },
    ],
  },
  presets: [
    {
      name: "Four-tile row",
      props: {
        handle: "@forever_finds",
        heading: "Follow us on instagram",
        images: [
          { image: `${INSTA}/instagram-1.webp`, href: "#" },
          { image: `${INSTA}/instagram-2.webp`, href: "#" },
          { image: `${INSTA}/instagram-3.webp`, href: "#" },
          { image: `${INSTA}/instagram-4.webp`, href: "#" },
        ],
      },
    },
  ],
}

export default instagramGridSchema
