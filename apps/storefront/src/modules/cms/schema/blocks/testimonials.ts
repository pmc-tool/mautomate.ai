import type { BlockSchema } from "../types"

const TESTIMONIAL = "/learts/assets/images/testimonial"

export const testimonialsSchema: BlockSchema = {
  type: "testimonials",
  label: "Testimonials",
  category: "social",
  icon: "Quote",
  fields: [
    {
      name: "title",
      type: "text",
      label: "Heading",
      default: "What our customers say",
      help: "Leave empty to hide the section heading.",
      group: "Content",
    },
    {
      name: "items",
      type: "list",
      label: "Testimonials",
      itemLabel: "Testimonial",
      maxItems: 12,
      group: "Content",
      fields: [
        {
          name: "quote",
          type: "textarea",
          label: "Quote",
          required: true,
          help: "The testimonial body.",
        },
        { name: "author", type: "text", label: "Author", required: true },
        {
          name: "role",
          type: "text",
          label: "Role",
          help: "Their role or company line, e.g. \"Verified buyer\".",
        },
        { name: "avatar", type: "image", label: "Avatar" },
      ],
    },
  ],
  defaultProps: {
    title: "What our customers say",
    items: [
      {
        quote:
          "Absolutely in love with my purchase. The craftsmanship is beautiful and it arrived even quicker than I expected. I'll definitely be shopping here again.",
        author: "Amelia Hart",
        role: "Verified buyer",
        avatar: `${TESTIMONIAL}/testimonial-1.webp`,
      },
      {
        quote:
          "Every piece feels unique and made with care. Forever Finds has become my go-to for thoughtful, one-of-a-kind gifts.",
        author: "Daniel Brooks",
        role: "Verified buyer",
        avatar: `${TESTIMONIAL}/testimonial-2.webp`,
      },
      {
        quote:
          "Wonderful quality and friendly service. The little handwritten note in my package made my whole day — highly recommended!",
        author: "Sofia Nguyen",
        role: "Verified buyer",
        avatar: `${TESTIMONIAL}/testimonial-3.webp`,
      },
    ],
  },
  presets: [
    {
      name: "Single quote",
      props: {
        title: "",
        items: [
          {
            quote:
              "Wonderful quality and friendly service. The little handwritten note in my package made my whole day — highly recommended!",
            author: "Sofia Nguyen",
            role: "Verified buyer",
            avatar: `${TESTIMONIAL}/testimonial-3.webp`,
          },
        ],
      },
    },
  ],
}

export default testimonialsSchema
