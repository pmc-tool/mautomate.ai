import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  tenantForOrder,
  logUnresolvedTenant,
} from "../lib/marketing-event-tenant"

/**
 * order.placed -> per-store order number.
 *
 * Medusa's display_id is ONE global sequence for the whole pooled database:
 * stores see interleaved numbers (#7, #12, ...) and can infer platform-wide
 * order volume from the gaps. Every tenant instead gets its own 1, 2, 3, ...
 * from an atomic per-tenant counter, stored as order.metadata.store_order_no.
 * Display surfaces (merchant orders API, store emails) read it with a
 * display_id fallback for legacy/unattributable orders.
 *
 * FAIL-CLOSED + idempotent: unattributable orders are skipped (they keep the
 * global display_id), and an order that already has a number keeps it.
 */
export default async function orderNumberSubscriber({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data?.id
  if (!orderId) return

  try {
    const orderModule: any = container.resolve(Modules.ORDER)
    const order = await orderModule
      .retrieveOrder(orderId, { select: ["id", "metadata"] })
      .catch(() => null)
    if (!order || order.metadata?.store_order_no != null) return

    const tenantId = await tenantForOrder(container, orderId)
    if (!tenantId) {
      logUnresolvedTenant(container, "order.placed (numbering)", "order", orderId)
      return
    }

    const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const { rows } = await pg.raw(
      `INSERT INTO tenant_order_counter (tenant_id, n) VALUES (?, 1)
       ON CONFLICT (tenant_id) DO UPDATE SET n = tenant_order_counter.n + 1
       RETURNING n`,
      [tenantId]
    )
    const n = Number(rows?.[0]?.n)
    if (!Number.isFinite(n) || n < 1) return

    await orderModule.updateOrders([
      {
        id: orderId,
        metadata: {
          ...(order.metadata ?? {}),
          store_order_no: n,
          tenant_id: tenantId,
        },
      },
    ])
  } catch (e) {
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.("[tenancy] order numbering failed:", e as any)
    } catch {
      /* logging must never throw */
    }
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
