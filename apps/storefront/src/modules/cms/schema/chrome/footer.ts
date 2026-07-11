import type { BlockSchema } from "../types"

export const footerSchema: BlockSchema = {
  type: "footer",
  label: "Footer",
  category: "content",
  icon: "PanelBottom",
  maxInstances: 1,
  lock: "contentOnly",
  fields: [
    {
      name: "contact",
      type: "object",
      label: "Contact",
      group: "Contact",
      fields: [
        { name: "email", type: "text", label: "Email", default: "contact@foreverfinds.com" },
        { name: "phone", type: "text", label: "Phone", default: "(+88) 123 4566 6868" },
        {
          name: "app_buttons",
          type: "list",
          label: "App buttons",
          itemLabel: "Button",
          maxItems: 4,
          help: "App store badges shown in the contact column.",
          fields: [
            { name: "img", type: "image", label: "Image", default: "/learts/assets/images/others/android.webp" },
            { name: "alt", type: "text", label: "Alt text", default: "App" },
            { name: "href", type: "url", label: "Link", default: "#" },
          ],
        },
      ],
    },
    {
      name: "column_categories",
      type: "object",
      label: "Categories column",
      group: "Categories",
      help: "A column of live store categories, plus any extra manual links.",
      fields: [
        { name: "limit", type: "number", label: "Category limit", default: 5, min: 0 },
        {
          name: "extra",
          type: "list",
          label: "Extra category links",
          itemLabel: "Link",
          maxItems: 8,
          help: "Manual links appended after the live categories (e.g. Flash sale).",
          fields: [
            { name: "label", type: "text", label: "Label", required: true },
            { name: "href", type: "url", label: "Link", default: "/store" },
          ],
        },
      ],
    },
    {
      name: "column_links",
      type: "list",
      label: "Footer links",
      itemLabel: "Link",
      maxItems: 12,
      group: "Links",
      fields: [
        { name: "label", type: "text", label: "Label", required: true },
        { name: "href", type: "url", label: "Link", default: "#" },
      ],
    },
    {
      name: "social",
      type: "list",
      label: "Social links",
      itemLabel: "Social",
      maxItems: 8,
      group: "Social",
      fields: [
        { name: "icon", type: "text", label: "Icon", help: "Font Awesome class, e.g. fa-instagram." },
        { name: "href", type: "url", label: "Link", default: "#" },
      ],
    },
    {
      name: "newsletter",
      type: "object",
      label: "Newsletter",
      group: "Newsletter",
      fields: [
        { name: "title", type: "text", label: "Title", default: "Newsletter" },
        { name: "placeholder", type: "text", label: "Input placeholder", default: "Enter your e-mail address" },
        { name: "button", type: "text", label: "Button label", default: "subscibe" },
      ],
    },
    {
      name: "bottom_logo",
      type: "image",
      label: "Bottom logo",
      default: "/learts/assets/images/logo/forever-finds.png",
      help: "Logo shown in the footer bottom bar.",
      group: "Branding",
    },
    {
      name: "payment_image",
      type: "image",
      label: "Payment methods image",
      default: "/learts/assets/images/others/pay.webp",
      help: "Accepted-payments graphic shown in the footer bottom bar.",
      group: "Branding",
    },
    {
      name: "copyright",
      type: "text",
      label: "Copyright",
      default: "© {year} Forever Finds. All Rights Reserved",
      help: "Use {year} to insert the current year.",
      group: "Legal",
    },
  ],
  defaultProps: {
    contact: {
      email: "contact@foreverfinds.com",
      phone: "(+88) 123 4566 6868",
      app_buttons: [
        { img: "/learts/assets/images/others/android.webp", alt: "Android app", href: "#" },
        { img: "/learts/assets/images/others/ios.webp", alt: "iOS app", href: "#" },
      ],
    },
    column_categories: {
      source: "categories",
      limit: 5,
      extra: [{ label: "Flash sale", href: "/store" }],
    },
    column_links: [
      { label: "About us", href: "#" },
      { label: "Store location", href: "#" },
      { label: "Contact", href: "/contact" },
      { label: "Support Policy", href: "#" },
      { label: "FAQs", href: "#" },
    ],
    social: [
      { icon: "fa-twitter", href: "https://www.twitter.com/" },
      { icon: "fa-facebook-f", href: "https://www.facebook.com/" },
      { icon: "fa-instagram", href: "https://www.instagram.com/" },
      { icon: "fa-youtube", href: "https://www.youtube.com/" },
    ],
    newsletter: {
      title: "Newsletter",
      placeholder: "Enter your e-mail address",
      button: "subscibe",
    },
    bottom_logo: "/learts/assets/images/logo/forever-finds.png",
    payment_image: "/learts/assets/images/others/pay.webp",
    copyright: "© {year} Forever Finds. All Rights Reserved",
  },
}

export default footerSchema
