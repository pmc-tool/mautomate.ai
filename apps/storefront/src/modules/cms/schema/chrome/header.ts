import type { BlockSchema } from "../types"

export const headerSchema: BlockSchema = {
  type: "header",
  label: "Header",
  category: "content",
  icon: "LayoutPanelTop",
  maxInstances: 1,
  lock: "contentOnly",
  fields: [
    {
      name: "logo",
      type: "image",
      label: "Logo",
      default: "/learts/assets/images/logo/forever-finds.png",
      group: "Branding",
    },
    {
      name: "logo_alt",
      type: "text",
      label: "Logo alt text",
      default: "Forever Finds",
      group: "Branding",
    },
    {
      name: "logo_max_height",
      type: "unitNumber",
      label: "Logo height",
      units: ["px"],
      min: 12,
      max: 160,
      group: "Branding",
      help: "Height of the logo image (default 34px).",
    },
    {
      name: "logo_padding",
      type: "dimensions",
      label: "Logo padding",
      units: ["px"],
      group: "Branding",
      help: "Inner spacing around the logo.",
    },
    {
      name: "logo_margin",
      type: "dimensions",
      label: "Logo margin",
      units: ["px"],
      group: "Branding",
      help: "Outer spacing around the logo.",
    },
    {
      name: "search",
      type: "object",
      label: "Search",
      group: "Search",
      fields: [
        { name: "enabled", type: "boolean", label: "Show search", default: true },
        { name: "placeholder", type: "text", label: "Placeholder", default: "Search products…" },
        {
          name: "action",
          type: "text",
          label: "Search URL",
          default: "/store?q=",
          help: "Where the search form submits. The typed term is appended.",
        },
      ],
    },
    {
      name: "icons",
      type: "object",
      label: "Icon links",
      group: "Icons",
      fields: [
        { name: "account", type: "url", label: "Account link", default: "/account" },
        { name: "wishlist", type: "url", label: "Wishlist link", default: "/wishlist" },
        { name: "cart", type: "url", label: "Cart link", default: "/cart" },
      ],
    },
    {
      name: "menu",
      type: "list",
      label: "Menu",
      itemLabel: "Menu item",
      maxItems: 8,
      group: "Navigation",
      fields: [
        { name: "label", type: "text", label: "Label", required: true },
        { name: "href", type: "url", label: "Link", default: "/" },
        {
          name: "limit",
          type: "number",
          label: "Category limit",
          min: 0,
          help: "For a category menu item: how many store categories to list.",
        },
        {
          name: "children_dynamic",
          type: "object",
          label: "Category submenu",
          help: "Adds a dropdown of live store categories under this item.",
          fields: [
            { name: "limit", type: "number", label: "Categories in submenu", default: 8, min: 0 },
          ],
        },
      ],
    },
    {
      name: "mobile_menu_categories",
      type: "object",
      label: "Mobile menu categories",
      group: "Navigation",
      fields: [
        {
          name: "limit",
          type: "number",
          label: "Category limit",
          min: 0,
          help: "How many store categories to list in the mobile menu. Leave empty for all.",
        },
      ],
    },
  ],
  defaultProps: {
    logo: "/learts/assets/images/logo/forever-finds.png",
    logo_alt: "Forever Finds",
    search: {
      enabled: true,
      placeholder: "Search products…",
      action: "/store?q=",
    },
    icons: { account: "/account", wishlist: "/account", cart: "/cart" },
    menu: [
      { label: "Home", href: "/" },
      {
        label: "Shop",
        href: "/store",
        children_dynamic: { source: "categories", limit: 8 },
      },
      { label: "__dynamic_categories__", source: "categories", limit: 3 },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
    mobile_menu_categories: { source: "categories", limit: null },
  },
}

export default headerSchema
