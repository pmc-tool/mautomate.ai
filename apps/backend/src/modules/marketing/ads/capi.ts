import crypto from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../index"
import { openAdsConnectionCredentials } from "./credentials"

/**
 * Meta Conversions API sender — server-side purchase events, the signal that
 * separates a working ad account from a blind one (pixel-only setups miss a
 * third of conversions; CAPI recovers them).
 *
 * Runs on the event-bus path (order.placed subscriber), so it NEVER throws:
 * every outcome is a returned summary, failures land in ads_action_log where
 * the merchant can see them. PII is normalized + SHA-256 hashed exactly as
 * Meta's user_data spec requires — raw email/phone never leaves the backend.
 *
 * Dedup: the browser pixel sends only PageView (see the storefront layout);
 * Purchase is EXCLUSIVELY server-side, so no event_id collision handling is
 * needed yet. When a browser Purchase is added later, both sides must share
 * event_id = order id (already set here).
 */

const GRAPH = "https://graph.facebook.com/v25.0"

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/** Normalize per Meta's spec (trim, lowercase; digits-only for phones), then sha256 hex. */
export const hashPii = (value: string, kind: "email" | "phone"): string => {
  let v = String(value).trim().toLowerCase()
  if (kind === "phone") {
    v = v.replace(/[^0-9]/g, "")
  }
  return crypto.createHash("sha256").update(v).digest("hex")
}

export type CapiPurchaseResult = {
  sent: boolean
  reason: string
  order_id: string
  value?: number
  events_received?: number
}

/** Build the CAPI Purchase payload from an order graph row. Exported for tests. */
export const buildPurchaseEvent = (order: any): Record<string, any> => {
  const userData: Record<string, any> = {}
  if (order.email) userData.em = [hashPii(order.email, "email")]
  const phone = order.shipping_address?.phone
  if (phone) userData.ph = [hashPii(phone, "phone")]

  const items = Array.isArray(order.items) ? order.items : []
  const contents = items
    .filter((i: any) => i?.product_id)
    .map((i: any) => ({
      id: String(i.product_id),
      quantity: Number(i.quantity) || 1,
      item_price: Number(i.unit_price) || 0,
    }))

  return {
    event_name: "Purchase",
    event_time: Math.floor(
      new Date(order.created_at ?? Date.now()).getTime() / 1000
    ),
    // Shared with any future browser-side Purchase so Meta dedups the pair.
    event_id: String(order.id),
    action_source: "website",
    user_data: userData,
    custom_data: {
      currency: String(order.currency_code ?? "usd").toUpperCase(),
      value: Number(order.total) || 0,
      content_type: "product",
      content_ids: contents.map((c: any) => c.id),
      contents,
      order_id: String(order.display_id ?? order.id),
    },
  }
}

/**
 * Send the Purchase event for one order. Resolves the tenant's active pixel +
 * connected meta connection; missing pieces mean an honest skip, not an error.
 */
export const sendPurchaseEvent = async (
  container: MedusaContainer,
  tenantId: string,
  orderId: string
): Promise<CapiPurchaseResult> => {
  const mk: any = container.resolve(MARKETING_MODULE)

  const pixel = first(
    await mk.listAdsPixels({
      tenant_id: tenantId,
      platform: "meta",
      status: "active",
    })
  )
  if (!pixel) {
    return { sent: false, reason: "no active pixel", order_id: orderId }
  }

  const connection = first(
    await mk.listAdsConnections({
      tenant_id: tenantId,
      platform: "meta",
      status: "connected",
    })
  )
  const creds = connection ? openAdsConnectionCredentials(connection) : null
  if (!creds) {
    return { sent: false, reason: "meta connection unavailable", order_id: orderId }
  }

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
      "created_at",
      "items.product_id",
      "items.quantity",
      "items.unit_price",
      "shipping_address.phone",
    ],
    pagination: { take: 1, skip: 0 },
  })
  const order = data?.[0]
  if (!order) {
    return { sent: false, reason: "order not found", order_id: orderId }
  }

  const event = buildPurchaseEvent(order)
  const body: Record<string, string> = {
    data: JSON.stringify([event]),
    access_token: creds.accessToken,
  }
  if (pixel.test_event_code) {
    body.test_event_code = pixel.test_event_code
  }

  let res: Response
  let resData: any = null
  try {
    res = await fetch(`${GRAPH}/${pixel.external_id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    })
    try {
      resData = await res.json()
    } catch {
      resData = null
    }
  } catch (e: any) {
    await mk.createAdsActionLogs({
      tenant_id: tenantId,
      actor: "system",
      action: "capi.error",
      level: "pixel",
      object_id: pixel.id,
      external_id: pixel.external_id,
      reason: `Purchase event for order ${order.display_id ?? orderId} could not reach Meta: ${e?.message ?? "network error"}`,
    } as any)
    return { sent: false, reason: "network error", order_id: orderId }
  }

  if (!res.ok) {
    const msg = resData?.error?.message ?? `status ${res.status}`
    await mk.createAdsActionLogs({
      tenant_id: tenantId,
      actor: "system",
      action: "capi.error",
      level: "pixel",
      object_id: pixel.id,
      external_id: pixel.external_id,
      reason: `Meta rejected the Purchase event for order ${order.display_id ?? orderId}: ${msg}`,
    } as any)
    return { sent: false, reason: msg, order_id: orderId }
  }

  await mk.updateAdsPixels({
    id: pixel.id,
    events_sent: (Number(pixel.events_sent) || 0) + 1,
    last_event_at: new Date(),
  } as any)
  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor: "system",
    action: "capi.purchase_sent",
    level: "pixel",
    object_id: pixel.id,
    external_id: pixel.external_id,
    reason: `Purchase for order ${order.display_id ?? orderId} sent to Meta (${event.custom_data.currency} ${event.custom_data.value})`,
    meta: { order_id: orderId, value: event.custom_data.value },
  } as any)

  return {
    sent: true,
    reason: "ok",
    order_id: orderId,
    value: event.custom_data.value,
    events_received: resData?.events_received ?? null,
  }
}
