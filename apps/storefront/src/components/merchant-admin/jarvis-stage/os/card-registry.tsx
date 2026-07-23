"use client"

/* ------------------------------------------------------------------ */
/* Pixi OS — the CARD REGISTRY (the Wave 2 extension contract).        */
/*                                                                     */
/* A registry maps a tool NAME to how its card presents: a human title,   */
/* an icon, a capability group, and an OPTIONAL bespoke Body component.     */
/* Every tool is pre-registered here with title/icon/group so the whole     */
/* toolset renders immediately via the generic KeyValueBody. Wave 2 adds     */
/* richer bodies by calling `registerCardBody(toolName, Component)` from       */
/* `os/cards/<group>/<tool>.tsx` — no edit to this file required.              */
/*                                                                            */
/* THE CONTRACT (see CARDS_CONTRACT.md):                                       */
/*   - CardBodyProps is exactly what a bespoke Body receives.                   */
/*   - registerCard / registerCardBody mutate the shared Map.                    */
/*   - getCardEntry never throws — unknown tools get a sane default.              */
/* ------------------------------------------------------------------ */

import type { ComponentType } from "react"
import type { IconName } from "./icons"
import type { CardGroup } from "./tool-catalog"
import type { CardStatus } from "./card-store"
import { READ_TOOLS, WRITE_TOOLS, HIDDEN_TOOLS } from "./tool-catalog"

/**
 * Props a card Body receives. `data` is the tool_result payload (reads) or
 * undefined (writes render via ConfirmCard, not a Body). `status` is the DATA
 * lifecycle (loading/ready/…), NOT the orb state. `send` re-enters the chat
 * loop with a prompt; `navigate` routes within the dashboard.
 */
export type CardBodyProps<D = unknown> = {
  data: D
  status: CardStatus
  toolName: string
  callId: string
  args?: Record<string, unknown>
  send: (prompt: string) => void
  navigate: (href: string) => void
}

export type CardBody<D = unknown> = ComponentType<CardBodyProps<D>>

export type RegistryEntry = {
  title: string
  icon: IconName
  group: CardGroup
  /** Optional bespoke renderer. When absent, the host renders KeyValueBody. */
  Body?: CardBody
  /** Optional accent override for this card's signal line / header. */
  accent?: string
}

const REGISTRY = new Map<string, RegistryEntry>()

/** Register (or overwrite) a tool's full entry. */
export function registerCard(tool: string, entry: RegistryEntry): void {
  REGISTRY.set(tool, entry)
}

/** Attach only a bespoke Body to an already-registered tool (Wave 2 path). */
export function registerCardBody(tool: string, Body: CardBody): void {
  const cur = REGISTRY.get(tool)
  if (cur) REGISTRY.set(tool, { ...cur, Body })
  else
    REGISTRY.set(tool, {
      title: prettify(tool),
      icon: "cube",
      group: "overview",
      Body,
    })
}

/** Look up an entry; unknown tools get a legible default. Never throws. */
export function getCardEntry(tool: string): RegistryEntry {
  return (
    REGISTRY.get(tool) ?? {
      title: prettify(tool),
      icon: "cube",
      group: "overview",
    }
  )
}

export function hasCard(tool: string): boolean {
  return REGISTRY.has(tool)
}

/** snake_case tool name -> "Title Case" fallback label. */
export function prettify(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim()
}

/* ------------------------------------------------------------------ */
/* Pre-registration — every tool, title + icon + group.                 */
/* ------------------------------------------------------------------ */

type Spec = [title: string, icon: IconName, group: CardGroup]

const SPECS: Record<string, Spec> = {
  // reads
  check_readiness: ["Store readiness", "gauge", "overview"],
  store_overview: ["Store overview", "gauge", "overview"],
  list_recent_orders: ["Recent orders", "receipt", "orders"],
  get_order: ["Order", "receipt", "orders"],
  search_products: ["Products", "boxes", "catalog"],
  needs_attention: ["Needs attention", "bell", "overview"],
  remember: ["Memory", "spark", "overview"],
  sales_summary: ["Sales", "trend", "overview"],
  low_stock: ["Low stock", "box", "catalog"],
  find_customer: ["Customer", "user", "customers"],
  inbox_status: ["Inbox", "chat", "customers"],
  domain_status: ["Domain", "globe", "settings"],
  call_center_status: ["Call center", "phone", "insights"],
  orders_to_deliver: ["To deliver", "truck", "orders"],
  delivery_issues: ["Delivery issues", "truck", "orders"],
  needs_human: ["Needs a human", "chat", "customers"],
  todays_email: ["Today's email", "mail", "settings"],
  visitor_report: ["Visitors", "chart", "insights"],
  call_topics: ["Call topics", "phone", "insights"],
  ad_report: ["Ad report", "target", "marketing"],
  compare_ads: ["Ads compared", "trend", "marketing"],
  list_blog_posts: ["Blog posts", "doc", "content"],
  list_pages: ["Pages", "page", "content"],
  list_collections: ["Collections", "folder", "catalog"],
  list_categories: ["Categories", "grid", "catalog"],
  list_discounts: ["Discounts", "percent", "marketing"],
  list_themes: ["Themes", "palette", "content"],
  list_campaigns: ["Campaigns", "megaphone", "marketing"],
  search_domain: ["Domain search", "globe", "settings"],
  // writes
  make_product_sellable: ["Make sellable", "box", "catalog"],
  setup_delivery: ["Set up delivery", "truck", "settings"],
  enable_payment_gateway: ["Enable payments", "money", "settings"],
  set_product_price: ["Set price", "tag", "catalog"],
  create_product: ["New product", "box", "catalog"],
  restock_variant: ["Restock", "box", "catalog"],
  set_store_country: ["Store country", "globe", "settings"],
  set_store_currency: ["Store currency", "money", "settings"],
  create_ad_campaign: ["New ad campaign", "target", "marketing"],
  launch_ad_campaign: ["Launch campaign", "bolt", "marketing"],
  create_social_post: ["Social post", "megaphone", "marketing"],
  reply_to_customer: ["Reply to customer", "chat", "customers"],
  hand_conversation_to_ai: ["Hand to AI", "spark", "customers"],
  fulfil_order: ["Fulfil order", "truck", "orders"],
  mark_order_paid: ["Mark paid", "money", "orders"],
  capture_payment: ["Capture payment", "money", "orders"],
  refund_order: ["Refund", "money", "orders"],
  cancel_order: ["Cancel order", "receipt", "orders"],
  create_blog_post: ["New blog post", "doc", "content"],
  update_blog_post: ["Update post", "doc", "content"],
  publish_blog_post: ["Publish post", "doc", "content"],
  create_page: ["New page", "page", "content"],
  update_page: ["Update page", "page", "content"],
  publish_page: ["Publish page", "page", "content"],
  create_collection: ["New collection", "folder", "catalog"],
  add_products_to_collection: ["Add to collection", "folder", "catalog"],
  create_category: ["New category", "grid", "catalog"],
  create_discount: ["New discount", "percent", "marketing"],
  switch_theme: ["Switch theme", "palette", "content"],
  generate_logo: ["Generate logo", "image", "content"],
  set_logo: ["Set logo", "image", "content"],
  connect_domain: ["Connect domain", "globe", "settings"],
  schedule_social_post: ["Schedule post", "calendar", "marketing"],
  create_email_campaign: ["Email campaign", "mail", "marketing"],
  // hidden (undo-only)
  cancel_fulfillment: ["Cancel fulfilment", "truck", "orders"],
  delete_product: ["Delete product", "box", "catalog"],
  queue_conversation: ["Queue conversation", "chat", "customers"],
}

// Register everything once at module load. Idempotent.
for (const tool of [...READ_TOOLS, ...WRITE_TOOLS, ...HIDDEN_TOOLS]) {
  const spec = SPECS[tool]
  if (spec) {
    registerCard(tool, { title: spec[0], icon: spec[1], group: spec[2] })
  } else {
    registerCard(tool, { title: prettify(tool), icon: "cube", group: "overview" })
  }
}

/* ------------------------------------------------------------------ */
/* Confirm previews — rich per-tool WRITE previews (additive).          */
/*                                                                     */
/* A ConfirmPreview is an OPTIONAL per-tool renderer shown ABOVE the      */
/* ConfirmCard's summary + confirm controls. It is PURELY presentational:  */
/* it reads the confirm `details` payload and the model-authored `args`,    */
/* and draws a bespoke preview (a blog draft, an ad builder, a discount      */
/* code, an irreversible-refund warning…). It NEVER touches the              */
/* confirm/apply/undo/tier machinery. When no preview is registered for a     */
/* tool, ConfirmCard keeps its generic key/value detail rendering unchanged.   */
/* ------------------------------------------------------------------ */

export type ConfirmPreviewProps = {
  /** The model-authored tool arguments (tool_call.args). */
  args: Record<string, unknown>
  /** The backend-computed confirm `details` payload. */
  details: Record<string, unknown>
  /** Confirm tier — "hard" writes require a typed word. */
  tier: "soft" | "hard"
  /** The human summary the backend produced for this write. */
  summary: string
}

export type ConfirmPreview = ComponentType<ConfirmPreviewProps>

const CONFIRM_PREVIEWS = new Map<string, ConfirmPreview>()

/** Register a rich per-tool preview rendered above the confirm controls. */
export function registerConfirmPreview(tool: string, Preview: ConfirmPreview): void {
  CONFIRM_PREVIEWS.set(tool, Preview)
}

/** Look up a tool's rich confirm preview, if any. Never throws. */
export function getConfirmPreview(tool: string): ConfirmPreview | undefined {
  return CONFIRM_PREVIEWS.get(tool)
}
