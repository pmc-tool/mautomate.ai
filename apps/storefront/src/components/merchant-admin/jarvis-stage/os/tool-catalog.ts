/* ------------------------------------------------------------------ */
/* Pixi OS — the tool catalogue.                                      */
/*                                                                     */
/* The authoritative list of every Pixi tool (from JARVIS_OS_SPEC.md    */
/* appendices), grouped into capability FAMILIES. The bottom family strip  */
/* renders from FAMILIES; the card registry pre-registers every name here.  */
/* Keep this in sync with the backend `_tools.ts` / `_writes.ts` registries. */
/* ------------------------------------------------------------------ */

import type { IconName } from "./icons"

export type CardGroup =
  | "overview"
  | "orders"
  | "catalog"
  | "customers"
  | "marketing"
  | "content"
  | "insights"
  | "operations"
  | "settings"

/** The 29 read tools. */
export const READ_TOOLS = [
  "check_readiness",
  "store_overview",
  "list_recent_orders",
  "get_order",
  "search_products",
  "needs_attention",
  "remember",
  "sales_summary",
  "low_stock",
  "find_customer",
  "inbox_status",
  "domain_status",
  "call_center_status",
  "orders_to_deliver",
  "delivery_issues",
  "needs_human",
  "todays_email",
  "visitor_report",
  "call_topics",
  "ad_report",
  "compare_ads",
  "list_blog_posts",
  "list_pages",
  "list_collections",
  "list_categories",
  "list_discounts",
  "list_themes",
  "list_campaigns",
  "search_domain",
] as const

/** The 34 write tools (model-callable). */
export const WRITE_TOOLS = [
  "make_product_sellable",
  "setup_delivery",
  "enable_payment_gateway",
  "set_product_price",
  "create_product",
  "restock_variant",
  "set_store_country",
  "set_store_currency",
  "create_ad_campaign",
  "launch_ad_campaign",
  "create_social_post",
  "reply_to_customer",
  "hand_conversation_to_ai",
  "fulfil_order",
  "mark_order_paid",
  "capture_payment",
  "refund_order",
  "cancel_order",
  "create_blog_post",
  "update_blog_post",
  "publish_blog_post",
  "create_page",
  "update_page",
  "publish_page",
  "create_collection",
  "add_products_to_collection",
  "create_category",
  "create_discount",
  "switch_theme",
  "generate_logo",
  "set_logo",
  "connect_domain",
  "schedule_social_post",
  "create_email_campaign",
] as const

/** Undo-only, never model-callable — registered so an undo card still renders. */
export const HIDDEN_TOOLS = [
  "cancel_fulfillment",
  "delete_product",
  "queue_conversation",
] as const

export type CardFamily = {
  key: CardGroup
  label: string
  icon: IconName
  /** A short prompt seeded when the merchant taps this family in the strip. */
  prompt: string
  tools: string[]
}

/**
 * Capability families for the bottom strip. Tapping a family seeds the ask bar
 * with a representative prompt. Grouping mirrors the card groups so a family's
 * cards visually cohere.
 */
export const FAMILIES: CardFamily[] = [
  {
    key: "overview",
    label: "Overview",
    icon: "gauge",
    prompt: "How is my store doing? What needs my attention?",
    tools: [
      "check_readiness",
      "store_overview",
      "needs_attention",
      "sales_summary",
    ],
  },
  {
    key: "orders",
    label: "Orders",
    icon: "receipt",
    prompt: "Show me my recent orders.",
    tools: [
      "list_recent_orders",
      "get_order",
      "orders_to_deliver",
      "delivery_issues",
      "fulfil_order",
      "mark_order_paid",
      "capture_payment",
      "refund_order",
      "cancel_order",
    ],
  },
  {
    key: "catalog",
    label: "Catalog",
    icon: "boxes",
    prompt: "Show me my products and anything low on stock.",
    tools: [
      "search_products",
      "low_stock",
      "make_product_sellable",
      "set_product_price",
      "create_product",
      "restock_variant",
      "list_collections",
      "list_categories",
      "create_collection",
      "add_products_to_collection",
      "create_category",
    ],
  },
  {
    key: "customers",
    label: "Customers",
    icon: "users",
    prompt: "Who are my recent customers, and does anyone need a human?",
    tools: [
      "find_customer",
      "inbox_status",
      "needs_human",
      "reply_to_customer",
      "hand_conversation_to_ai",
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: "megaphone",
    prompt: "How are my ads doing? Show campaign performance.",
    tools: [
      "ad_report",
      "compare_ads",
      "list_campaigns",
      "create_ad_campaign",
      "launch_ad_campaign",
      "create_social_post",
      "schedule_social_post",
      "list_discounts",
      "create_discount",
      "create_email_campaign",
    ],
  },
  {
    key: "content",
    label: "Content",
    icon: "doc",
    prompt: "Show my blog posts and pages.",
    tools: [
      "list_blog_posts",
      "list_pages",
      "list_themes",
      "create_blog_post",
      "update_blog_post",
      "publish_blog_post",
      "create_page",
      "update_page",
      "publish_page",
      "switch_theme",
      "generate_logo",
      "set_logo",
    ],
  },
  {
    key: "insights",
    label: "Insights",
    icon: "chart",
    prompt: "Give me my visitor report for the last 7 days.",
    tools: [
      "visitor_report",
      "call_topics",
      "call_center_status",
    ],
  },
  {
    key: "settings",
    label: "Store",
    icon: "gear",
    prompt: "What is my store set up with — country, currency, domain?",
    tools: [
      "domain_status",
      "search_domain",
      "connect_domain",
      "set_store_country",
      "set_store_currency",
      "setup_delivery",
      "enable_payment_gateway",
      "todays_email",
    ],
  },
]

/** Default suggestion chips shown under the ask bar when idle. */
export const SUGGESTIONS: string[] = [
  "What needs my attention?",
  "Show recent orders",
  "What's low on stock?",
  "How are sales this week?",
  "Any customers waiting?",
]
