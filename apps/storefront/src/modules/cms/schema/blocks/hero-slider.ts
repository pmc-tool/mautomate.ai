import type { BlockSchema } from "../types"

export const heroSliderSchema: BlockSchema = {
  type: "hero_slider",
  label: "Hero Slider",
  category: "hero",
  icon: "Images",
  maxInstances: 1,
  fields: [
    {
      name: "autoplay_ms",
      type: "range",
      label: "Autoplay speed",
      min: 0,
      max: 12000,
      step: 500,
      unit: "ms",
      default: 5000,
      help: "0 disables autoplay.",
      group: "Behavior",
    },
    {
      name: "slides",
      type: "list",
      label: "Slides",
      itemLabel: "Slide",
      maxItems: 8,
      fields: [
        { name: "image", type: "image", label: "Background image" },
        { name: "subtitle", type: "text", label: "Kicker", help: "Small line above the title." },
        { name: "title", type: "textarea", label: "Title", required: true, help: "Use a line break for a two-line headline." },
        {
          name: "cta",
          type: "object",
          label: "Button",
          fields: [
            { name: "label", type: "text", label: "Label", default: "Shop now" },
            { name: "href", type: "url", label: "Link", default: "/store" },
          ],
        },
      ],
    },
  ],
  defaultProps: {
    autoplay_ms: 5000,
    slides: [
      {
        image: "/learts/assets/images/slider/home3/slide-1.webp",
        subtitle: "Handicraft shop",
        title: "Inspired by Your\nSweetest Dreams",
        cta: { label: "Shop now", href: "/store" },
      },
    ],
  },
  presets: [
    {
      name: "Single full-width slide",
      props: {
        autoplay_ms: 0,
        slides: [
          {
            image: "/learts/assets/images/slider/home3/slide-1.webp",
            subtitle: "New collection",
            title: "Discover our latest arrivals",
            cta: { label: "Shop now", href: "/store" },
          },
        ],
      },
    },
  ],
}

export default heroSliderSchema
