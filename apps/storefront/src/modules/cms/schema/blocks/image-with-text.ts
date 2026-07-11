import type { BlockSchema } from "../types"

export const imageWithTextSchema: BlockSchema = {
  type: "image_with_text",
  label: "Image with Text",
  category: "content",
  icon: "Image",
  fields: [
    {
      name: "image",
      type: "image",
      label: "Image",
      required: true,
      help: "Media URL shown beside the copy.",
      group: "Media",
    },
    {
      name: "image_side",
      type: "select",
      label: "Image side",
      default: "left",
      help: "Which side the image sits on.",
      group: "Media",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    {
      name: "eyebrow",
      type: "text",
      label: "Eyebrow",
      help: "Small kicker line above the title.",
      group: "Content",
    },
    {
      name: "title",
      type: "textarea",
      label: "Title",
      required: true,
      help: "Headline. Use a line break for a two-line headline.",
      group: "Content",
    },
    {
      name: "body",
      type: "textarea",
      label: "Body",
      help: "Paragraph copy.",
      group: "Content",
    },
    {
      name: "cta",
      type: "object",
      label: "Button",
      group: "CTA",
      help: "Optional button. Leave the link empty for no button.",
      fields: [
        { name: "label", type: "text", label: "Label", default: "shop now" },
        { name: "href", type: "url", label: "Link", default: "/store" },
      ],
    },
  ],
  defaultProps: {
    image: "/learts/assets/images/product/deal-product-1.webp",
    image_side: "left",
    eyebrow: "Handicraft shop",
    title: "Crafted with care,\nmade to be found",
    body: "Years of experience brought about by our skilled craftsmen could ensure that every piece produced is a work of art. Our focus is always the best quality possible.",
    cta: { label: "shop now", href: "/store" },
  },
  presets: [
    {
      name: "Image on the right",
      props: {
        image: "/learts/assets/images/product/deal-product-1.webp",
        image_side: "right",
        eyebrow: "New collection",
        title: "Discover our\nlatest arrivals",
        body: "Hand-picked pieces crafted to bring warmth and character to every corner of your home.",
        cta: { label: "shop now", href: "/store" },
      },
    },
  ],
}

export default imageWithTextSchema
