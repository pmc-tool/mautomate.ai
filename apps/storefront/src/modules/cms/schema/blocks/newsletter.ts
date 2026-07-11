import type { BlockSchema } from "../types"

export const newsletterSchema: BlockSchema = {
  type: "newsletter",
  label: "Newsletter",
  category: "content",
  icon: "Mail",
  fields: [
    {
      name: "title",
      type: "text",
      label: "Title",
      required: true,
      help: "Headline above the signup form.",
      group: "Content",
    },
    {
      name: "subtitle",
      type: "textarea",
      label: "Subtitle",
      help: "Supporting copy under the title. Leave empty to hide.",
      group: "Content",
    },
    {
      name: "provider_note",
      type: "textarea",
      label: "Provider note",
      help: "Small print under the form. Leave empty to hide.",
      group: "Content",
    },
    {
      name: "placeholder",
      type: "text",
      label: "Input placeholder",
      group: "Form",
    },
    {
      name: "button",
      type: "text",
      label: "Button label",
      group: "Form",
    },
  ],
  defaultProps: {
    title: "Sign up to Newsletter",
    subtitle: "...and receive $20 coupon for your first shopping.",
    placeholder: "Enter your email address",
    button: "Subscribe",
    provider_note: "We respect your privacy. Unsubscribe at any time.",
  },
  presets: [
    {
      name: "Minimal (no fine print)",
      props: {
        title: "Join our newsletter",
        subtitle: "Be the first to know about new arrivals and offers.",
        placeholder: "Enter your email address",
        button: "Subscribe",
        provider_note: "",
      },
    },
  ],
}

export default newsletterSchema
