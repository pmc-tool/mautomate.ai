/**
 * email/dispatch — send a catalog (store notification) email in response to a
 * commerce event. Used by the transactional subscribers.
 *
 * SAFETY: inert unless STORE_EMAILS_ENABLED === "1" (this deploys to a LIVE
 * store, so auto-emails stay OFF until a merchant/operator turns them on).
 * Per-template on/off is also honored via the resolved `enabled` flag, and the
 * send-service checks the tenant suppression list. NEVER throws — a store email
 * failure must not break order/fulfilment flows or poison the event retry loop.
 *
 * Multi-tenant: the tenant is derived from the ORDER's sales channel, never a
 * global default — so shop A's confirmation can't go out under shop B's brand.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "../../platform"
import { resolveCatalogEmail } from "./catalog-resolver"
import { sendEmail } from "./send-service"

export const storeEmailsEnabled = (): boolean =>
  process.env.STORE_EMAILS_ENABLED === "1"

const safeLogger = (container: MedusaContainer): any => {
  try {
    return container.resolve("logger")
  } catch {
    return null
  }
}

const money = (amount: unknown, currency?: string | null): string => {
  const n = Number(amount ?? 0)
  const val = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const cur = (currency || "").toUpperCase()
  return cur ? `${cur} ${val}` : `$${val}`
}

/** Resolve the tenant that owns a sales channel (via tenant.meta). */
const tenantIdForSalesChannel = async (
  container: MedusaContainer,
  scId?: string | null
): Promise<string | null> => {
  if (!scId) return null
  const platform: any = container.resolve(PLATFORM_MODULE)
  const tenants = await platform.listTenants({}, { take: 5000 }).catch(() => [])
  const t = (tenants || []).find(
    (x: any) => x?.meta?.sales_channel_id === scId
  )
  return t?.id ?? null
}

/**
 * Send a catalog email for an order. `extraTokens` supplies template-specific
 * values (e.g. tracking_url for order_shipped, refund_amount for refund_issued).
 */
export const dispatchOrderEmail = async (
  container: MedusaContainer,
  orderId: string,
  key: string,
  extraTokens: Record<string, unknown> = {}
): Promise<void> => {
  if (!storeEmailsEnabled() || !orderId) return
  const logger = safeLogger(container)
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      filters: { id: orderId },
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "sales_channel_id",
        "items.title",
        "items.quantity",
        "shipping_address.first_name",
        "customer.first_name",
      ],
      pagination: { take: 1, skip: 0 } as any,
    })
    const order: any = data?.[0]
    if (!order || !order.email) return

    const tenantId = await tenantIdForSalesChannel(
      container,
      order.sales_channel_id
    )
    if (!tenantId) return

    const firstName =
      order.shipping_address?.first_name ||
      order.customer?.first_name ||
      "there"
    const items = (order.items || [])
      .map((i: any) => `${i.quantity}x ${i.title}`)
      .join(", ")

    const tokens: Record<string, unknown> = {
      first_name: firstName,
      order_number: order.display_id,
      order_total: money(order.total, order.currency_code),
      order_items: items,
      ...extraTokens,
    }

    const email = await resolveCatalogEmail(container, tenantId, key, tokens)
    if (!email || !email.enabled) return

    await sendEmail(container, {
      tenantId,
      to: order.email,
      toName: firstName,
      subject: email.subject,
      html: email.html,
    })
    logger?.info?.(
      `[store-email] sent "${key}" for order ${orderId} (tenant ${tenantId})`
    )
  } catch (e: any) {
    logger?.error?.(
      `[store-email] "${key}" failed for order ${orderId} (swallowed): ${
        e?.message ?? e
      }`
    )
  }
}

/**
 * Resolve the order id + tracking info a fulfillment (shipment/delivery) belongs
 * to, then send the given catalog email for that order.
 */
export const dispatchFulfillmentEmail = async (
  container: MedusaContainer,
  fulfillmentId: string,
  key: string
): Promise<void> => {
  if (!storeEmailsEnabled() || !fulfillmentId) return
  const logger = safeLogger(container)
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "fulfillment",
      filters: { id: fulfillmentId },
      fields: [
        "id",
        "order.id",
        "labels.tracking_number",
        "labels.tracking_url",
      ],
      pagination: { take: 1, skip: 0 } as any,
    })
    const f: any = data?.[0]
    const orderId = f?.order?.id
    if (!orderId) return

    const label = (f.labels || [])[0] || {}
    await dispatchOrderEmail(container, orderId, key, {
      tracking_number: label.tracking_number || "",
      tracking_url: label.tracking_url || "",
    })
  } catch (e: any) {
    logger?.error?.(
      `[store-email] "${key}" fulfillment ${fulfillmentId} failed (swallowed): ${
        e?.message ?? e
      }`
    )
  }
}
