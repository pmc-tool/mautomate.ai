import type { BlockSchema } from "../types"

export const dealOfDaySchema: BlockSchema = {
  type: "deal_of_day",
  label: "Deal of the Day",
  category: "commerce",
  icon: "Timer",
  maxInstances: 1,
  fields: [
    {
      name: "title",
      type: "text",
      label: "Title",
      required: true,
      default: "Deal of the day",
      group: "Content",
    },
    {
      name: "description",
      type: "textarea",
      label: "Description",
      help: "Supporting paragraph shown under the title.",
      group: "Content",
    },
    {
      name: "image",
      type: "image",
      label: "Product image",
      required: true,
      group: "Media",
    },
    {
      name: "countdown_to",
      type: "text",
      label: "Countdown to",
      required: true,
      help: "End date/time (ISO)",
      group: "Behavior",
    },
    {
      name: "cta",
      type: "object",
      label: "Button",
      group: "CTA",
      fields: [
        { name: "label", type: "text", label: "Label", default: "Shop Now" },
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
    image: "/learts/assets/images/product/deal-product-1.webp",
    title: "Deal of the day",
    description:
      "Years of experience brought about by our skilled craftsmen could ensure that every piece produced is a work of art. Our focus is always the best quality possible.",
    countdown_to: "2026-07-10T00:00:00.000Z",
    cta: { label: "Shop Now", href: "/store" },
  },
  presets: [
    {
      name: "Weekend flash sale",
      props: {
        image: "/learts/assets/images/product/deal-product-1.webp",
        title: "Weekend flash sale",
        description: "Limited-time offer — don't miss out.",
        countdown_to: "2026-07-10T00:00:00.000Z",
        cta: { label: "Shop the sale", href: "/store" },
      },
    },
  ],
}

export default dealOfDaySchema
