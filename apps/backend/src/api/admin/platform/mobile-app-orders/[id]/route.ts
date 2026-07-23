import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../../../../modules/platform"
import { actorFromReq } from "../../_actor"

/**
 * Valid lifecycle statuses per order kind. Kept in sync with the
 * mobile_app_order model comment. `set_status` may only move an order to one of
 * these values for its kind — anything else is rejected (fail-closed).
 */
const VALID_STATUS: Record<"build" | "publish", string[]> = {
  build: ["queued", "building", "ready", "failed"],
  publish: ["paid", "in_progress", "published", "cancelled"],
}

const isHttpUrl = (v: unknown): v is string => {
  if (typeof v !== "string" || !v.trim()) return false
  try {
    const u = new URL(v.trim())
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * GET /admin/platform/mobile-app-orders/:id
 *
 * The full single mobile-app order, including config_snapshot (app_name,
 * icon_url, accent) and meta. Super-admin gated via /admin/platform/*.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  const order = await platform
    .retrieveMobileAppOrder(req.params.id)
    .catch(() => null)
  if (!order) return res.status(404).json({ message: "order not found" })

  let store_name = order.tenant_id
  if (order.tenant_id) {
    const t = await platform.retrieveTenant(order.tenant_id).catch(() => null)
    if (t) store_name = t.name ?? t.slug ?? t.id
  }

  res.json({
    order: {
      id: order.id,
      tenant_id: order.tenant_id,
      store_name,
      kind: order.kind,
      tier: order.tier ?? null,
      regular_price_usd: order.regular_price_usd ?? null,
      expected_amount_usd: order.expected_amount_usd ?? null,
      amount_paid_usd: order.amount_paid_usd ?? null,
      status: order.status,
      download_url: order.download_url ?? null,
      stripe_event_id: order.stripe_event_id ?? null,
      config_snapshot: order.config_snapshot ?? null,
      meta: order.meta ?? null,
      created_at: order.created_at,
      updated_at: order.updated_at,
    },
  })
}

/**
 * POST /admin/platform/mobile-app-orders/:id  { action, download_url?, status? }
 *
 * Fulfilment actions for the ops queue. Every change writes an audit_log row
 * (actor = verified operator email). Super-admin gated via /admin/platform/*.
 *
 *   action: "set_download"  set download_url (must be http(s)); for a BUILD
 *                           order this also advances status -> "ready" so the
 *                           merchant's Download button appears.
 *   action: "set_status"    move the order to a valid status for its kind
 *                           (build:   queued|building|ready|failed;
 *                            publish: paid|in_progress|published|cancelled).
 *
 * This surface does NOT touch the Stripe-verified money trail
 * (expected/paid/stripe_event_id) — those are only ever written by the verified
 * webhook fulfilment path.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  const actor = actorFromReq(req)

  const order = await platform
    .retrieveMobileAppOrder(req.params.id)
    .catch(() => null)
  if (!order) return res.status(404).json({ message: "order not found" })

  const body = (req.body ?? {}) as {
    action?: string
    download_url?: string
    status?: string
  }
  const action = String(body.action ?? "").trim()

  const audit = async (changed: Record<string, unknown>) => {
    await platform
      .createAuditLogs([
        {
          actor: actor.id,
          action: "mobile_app.order.update",
          tenant_id: order.tenant_id ?? null,
          ip: actor.ip ?? null,
          outcome: "success",
          meta: {
            order_id: order.id,
            kind: order.kind,
            fulfil_action: action,
            ...changed,
          },
        },
      ])
      .catch(() => undefined)
  }

  if (action === "set_download") {
    if (!isHttpUrl(body.download_url)) {
      return res
        .status(400)
        .json({ message: "download_url must be a valid http(s) URL" })
    }
    const url = String(body.download_url).trim()
    const update: Record<string, unknown> = { id: order.id, download_url: url }
    // A ready artifact makes the merchant's Download button appear.
    if (order.kind === "build") update.status = "ready"
    await platform.updateMobileAppOrders(update)
    await audit({ download_url: url, status: update.status ?? order.status })
    return res.json({
      id: order.id,
      download_url: url,
      status: update.status ?? order.status,
    })
  }

  if (action === "set_status") {
    const next = String(body.status ?? "").trim()
    const allowed = VALID_STATUS[order.kind as "build" | "publish"] ?? []
    if (!next || !allowed.includes(next)) {
      return res.status(400).json({
        message: `status must be one of: ${allowed.join(", ")} for a ${order.kind} order`,
      })
    }
    await platform.updateMobileAppOrders({ id: order.id, status: next })
    await audit({ status: next })
    return res.json({ id: order.id, status: next })
  }

  return res
    .status(400)
    .json({ message: "action must be set_download or set_status" })
}
