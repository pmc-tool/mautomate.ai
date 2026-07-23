import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import type { JarvisWrite } from "./_writes-money"
import { MONEY_WRITES } from "./_writes-money"
import { SOFT_WRITES, cancelFulfillment } from "./_writes-soft"
import { EXTRA_WRITES, deleteProduct } from "./_writes-extra"
import { SETTINGS_WRITES } from "./_writes-settings"
import { ADS_WRITES } from "./_writes-ads"
import { SOCIAL_WRITES, queueConversation } from "./_writes-social"
import { CONTENT_WRITES } from "./_writes-content"
import { CATALOG_WRITES } from "./_writes-catalog"
import { BRAND_WRITES } from "./_writes-brand"
import { MARKETING_WRITES } from "./_writes-marketing"

export type { JarvisWrite } from "./_writes-money"

/**
 * Hidden executors — runnable by the confirm gate (as an Undo) but NOT exposed
 * to the model, so it can't invoke them directly. `cancel_fulfillment` is the
 * reverse of fulfil_order (undo carries the fresh fulfillment id).
 */
const HIDDEN_WRITES: JarvisWrite[] = [
  {
    name: "cancel_fulfillment",
    description: "internal — undo a fulfilment (dispatched only as an Undo)",
    parameters: { type: "object", properties: {}, additionalProperties: true },
    risk: "low",
    tier: "soft",
    plan: async () => ({ ok: false, error: "not directly callable" }),
    apply: (req, ctx, applyArgs) =>
      cancelFulfillment(req, ctx as any, applyArgs as any),
  },
  {
    name: "delete_product",
    description: "internal — undo a product creation (dispatched only as an Undo)",
    parameters: { type: "object", properties: {}, additionalProperties: true },
    risk: "low",
    tier: "soft",
    plan: async () => ({ ok: false, error: "not directly callable" }),
    apply: (req, ctx, applyArgs) =>
      deleteProduct(req, ctx as any, applyArgs as any),
  },
  {
    name: "queue_conversation",
    description: "internal — undo handing a conversation to AI (dispatched only as an Undo)",
    parameters: { type: "object", properties: {}, additionalProperties: true },
    risk: "low",
    tier: "soft",
    plan: async () => ({ ok: false, error: "not directly callable" }),
    apply: (req, ctx, applyArgs) =>
      queueConversation(req, ctx as any, applyArgs as any),
  },
]

/**
 * Pixi P1 — the write-tool registry.
 *
 * Soft tools are one-tap (low risk, easily reversible); hard tools move money or
 * are irreversible and require the merchant to type a confirm word. Both are
 * PROPOSED during a streaming run (plan(), no mutation) and only executed by
 * `/merchant/jarvis/apply` after the merchant confirms. Tenant is always the
 * live session's — the model never supplies ids or tenant.
 */
export const WRITES: JarvisWrite[] = [
  ...SOFT_WRITES,
  ...EXTRA_WRITES,
  ...SETTINGS_WRITES,
  ...ADS_WRITES,
  ...SOCIAL_WRITES,
  ...MONEY_WRITES,
  ...CONTENT_WRITES,
  ...CATALOG_WRITES,
  ...BRAND_WRITES,
  ...MARKETING_WRITES,
]

export const WRITE_BY_NAME: Record<string, JarvisWrite> = Object.fromEntries(
  [...WRITES, ...HIDDEN_WRITES].map((w) => [w.name, w])
)

export const isWriteTool = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(WRITE_BY_NAME, name)

export const WRITE_DEFINITIONS: AiToolDefinition[] = WRITES.map((w) => ({
  name: w.name,
  description: w.description,
  parameters: w.parameters as any,
}))

/** Live "Pixi is doing X" labels for the propose stream. */
export const WRITE_LABELS: Record<string, string> = {
  make_product_sellable: "Getting that product ready to sell",
  setup_delivery: "Setting up delivery",
  enable_payment_gateway: "Turning on that payment method",
  set_product_price: "Updating the price",
  create_product: "Creating that product",
  restock_variant: "Updating stock",
  set_store_country: "Updating your store country",
  set_store_currency: "Switching your store currency",
  create_ad_campaign: "Setting up your ad campaign",
  launch_ad_campaign: "Launching your ad campaign",
  create_social_post: "Creating your social post",
  reply_to_customer: "Sending your reply",
  hand_conversation_to_ai: "Handing the chat back to AI",
  fulfil_order: "Fulfilling that order",
  mark_order_paid: "Marking the order paid",
  capture_payment: "Capturing payment",
  refund_order: "Preparing the refund",
  cancel_order: "Cancelling the order",
  create_blog_post: "Drafting your blog post",
  update_blog_post: "Updating your blog post",
  publish_blog_post: "Publishing your blog post",
  create_page: "Creating your page",
  update_page: "Updating your page",
  publish_page: "Publishing your page",
  create_collection: "Creating that collection",
  add_products_to_collection: "Adding products to that collection",
  create_category: "Creating that category",
  create_discount: "Creating your discount code",
  switch_theme: "Switching your storefront theme",
  generate_logo: "Designing logo options with AI",
  set_logo: "Setting your store logo",
  connect_domain: "Connecting your custom domain",
  schedule_social_post: "Scheduling your social post",
  create_email_campaign: "Preparing your email campaign",
}
