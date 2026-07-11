import type { BlockSchema } from "../types"

export const topbarSchema: BlockSchema = {
  type: "topbar",
  label: "Top bar",
  category: "content",
  icon: "PanelTop",
  maxInstances: 1,
  lock: "contentOnly",
  fields: [
    {
      name: "enabled",
      type: "boolean",
      label: "Show top bar",
      default: true,
      help: "Toggle the announcement bar above the header.",
      group: "General",
    },
    {
      name: "message",
      type: "text",
      label: "Announcement message",
      default: "Free shipping for orders over $59 !",
      group: "General",
    },
    {
      name: "currency_label",
      type: "text",
      label: "Currency label",
      default: "BDT",
      group: "Locale",
    },
    {
      name: "language_label",
      type: "text",
      label: "Language label",
      default: "English",
      group: "Locale",
    },
    {
      name: "links",
      type: "list",
      label: "Links",
      itemLabel: "Link",
      maxItems: 6,
      group: "Links",
      fields: [
        { name: "icon", type: "text", label: "Icon", help: "Font Awesome class, e.g. fa-truck." },
        { name: "label", type: "text", label: "Label", required: true },
        { name: "href", type: "url", label: "Link", default: "#" },
      ],
    },
  ],
  defaultProps: {
    enabled: true,
    message: "Free shipping for orders over $59 !",
    currency_label: "BDT",
    language_label: "English",
    links: [
      { icon: "fa-map-marker-alt", label: "Store Location", href: "#" },
      { icon: "fa-truck", label: "Order Status", href: "/account" },
    ],
  },
}

export default topbarSchema
