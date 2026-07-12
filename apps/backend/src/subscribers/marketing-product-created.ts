import {
  logUnresolvedTenant,
  tenantForProduct,
} from "../lib/marketing-event-tenant"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { MARKETING_MODULE } from "../modules/marketing"
import { getCommerceGateway } from "../modules/marketing/gateway"
import { SettingsService } from "../modules/marketing/settings/settings-service"

/**
 * product.created -> auto-draft a "new arrival" marketing post (automation layer).
 *
 * When a new product is created in the catalog this subscriber loads the
 * normalized product via the commerce gateway and creates a DRAFT marketing
 * post (source "automation") announcing the arrival. It is a DRAFT on purpose:
 * a human reviews, polishes and schedules it in the Post Hub — nothing is
 * published automatically.
 *
 * Event name: `product.created` — this is the workflow event emitted by
 * core-flows `createProductsWorkflow` (ProductWorkflowEvents.CREATED), payload
 * `{ id }`. Verified against @medusajs/utils core-flows events.
 *
 * DOUBLE GATE (inert by default — this deploys to a LIVE store):
 *   1. Master flag: no-op unless MARKETING_ENABLED === "1".
 *   2. Per-automation toggle: no-op unless the durable setting
 *      `automation_new_product` is explicitly enabled (defaults OFF).
 *
 * Guarantees (mirrors call-center-order-placed.ts / cms-published.ts):
 *   - NEVER throws. A marketing hiccup must not fail product creation nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged via
 *     the container logger.
 *
 * TENANT ATTRIBUTION (A-6): the owning tenant is derived PER EVENT from the
 * entity's sales channel (lib/marketing-event-tenant.ts), never pinned at module
 * load. In the pooled backend a module-load `resolveTenantId()` has no request
 * context and collapses to the shared "default" tenant, which would attribute
 * every store's events to one tenant. FAIL-CLOSED: if the tenant cannot be
 * proven, the handler does nothing and says so in the log.
 */
const AUTOMATION_KEY = "automation_new_product"
const MAX_DESCRIPTION_CHARS = 160

/** Trim a description down to a short, single-line announcement fragment. */
const shortDescription = (raw: string | null | undefined): string => {
  const text = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!text) {
    return ""
  }
  if (text.length <= MAX_DESCRIPTION_CHARS) {
    return text
  }
  return `${text.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd()}…`
}

export default async function marketingProductCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Gate 1 — master kill-switch: inert unless explicitly enabled.
  if (process.env.MARKETING_ENABLED !== "1") {
    return
  }

  const productId = data?.id
  if (!productId) {
    return
  }

  try {
    const logger: any = container.resolve("logger")

    // Gate 2 — the owning tenant, derived from the product's sales channel.
    const tenantId = await tenantForProduct(container, productId)
    if (!tenantId) {
      logUnresolvedTenant(container, "product.created", "product", productId)
      return
    }

    // Gate 3 — per-automation toggle (durable setting, defaults OFF, per tenant).
    const settings = new SettingsService(container)
    const enabled = await settings.get<boolean>(tenantId, AUTOMATION_KEY, false)
    if (enabled !== true) {
      return
    }

    const gateway = getCommerceGateway(container)
    const product = await gateway.getProduct(tenantId, productId)
    if (!product) {
      logger?.warn?.(
        `[marketing] product.created: product ${productId} not found — skipping draft.`
      )
      return
    }

    const title = (product.title ?? "").trim() || "New product"
    const short = shortDescription(product.description)
    const body = short
      ? `New arrival: ${title}. ${short}`
      : `New arrival: ${title}.`

    const svc: any = container.resolve(MARKETING_MODULE)
    await svc.createMarketingPosts({
      tenant_id: tenantId,
      status: "draft",
      source: "automation",
      title: `New arrival: ${title}`,
      body,
      product_ids: [productId],
    })

    logger?.info?.(
      `[marketing] product.created: drafted new-arrival post for product ${productId} (tenant ${tenantId})`
    )
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] product.created handler error (swallowed) for product ${productId}: ${
          (e as any)?.message ?? e
        }`
      )
    } catch {
      // ignore — logging must not throw either.
    }
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
