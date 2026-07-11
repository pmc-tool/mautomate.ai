import type { BlockSchema } from "../types"

const INSTA = "/learts/assets/images/instagram"

export const imageGallerySchema: BlockSchema = {
  type: "image_gallery",
  label: "Image Gallery",
  category: "media",
  icon: "Image",
  fields: [
    { name: "heading", type: "text", label: "Heading", default: "Our gallery", group: "Content" },
    { name: "subheading", type: "text", label: "Sub-heading", default: "", group: "Content" },
    {
      name: "columns",
      type: "select",
      label: "Columns",
      default: "3",
      group: "Layout",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "5", value: "5" },
        { label: "6", value: "6" },
      ],
    },
    {
      name: "aspect",
      type: "select",
      label: "Image shape",
      default: "square",
      group: "Layout",
      options: [
        { label: "Square", value: "square" },
        { label: "Portrait", value: "portrait" },
        { label: "Landscape", value: "landscape" },
        { label: "Original", value: "auto" },
      ],
    },
    {
      name: "gap",
      type: "range",
      label: "Spacing",
      default: 12,
      min: 0,
      max: 40,
      unit: "px",
      group: "Layout",
    },
    {
      name: "items",
      type: "list",
      label: "Images",
      itemLabel: "Image",
      maxItems: 24,
      group: "Media",
      help: "Add as many images as you like — they tile into a collage.",
      fields: [
        { name: "image", type: "image", label: "Image", required: true },
        { name: "caption", type: "text", label: "Caption", default: "" },
        { name: "href", type: "url", label: "Link", default: "" },
      ],
    },
  ],
  defaultProps: {
    heading: "Our gallery",
    subheading: "",
    columns: "3",
    aspect: "square",
    gap: 12,
    items: [
      { image: `${INSTA}/instagram-1.webp`, caption: "", href: "" },
      { image: `${INSTA}/instagram-2.webp`, caption: "", href: "" },
      { image: `${INSTA}/instagram-3.webp`, caption: "", href: "" },
    ],
  },
}

export default imageGallerySchema
