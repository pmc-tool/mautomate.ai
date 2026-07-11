import type { MedusaContainer } from "@medusajs/framework/types"

import { CALL_CENTER_MODULE } from "../modules/call-center"
import { getCommerceGateway } from "../modules/call-center/gateway"
import type { OrderFilter } from "../modules/call-center/gateway"
import { DialGate } from "../modules/call-center/dialing/dial-gate"
import { SettingsService } from "../modules/call-center/settings/settings-service"
import { getCurrentTenantId } from "../lib/tenant-context"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * call-center-campaign-runner (scheduled sweep, every 2 minutes).
 *
 * The ENROLLMENT half of the outbound engine. It turns `running` campaigns into
 * concrete CallTasks; it does NOT place calls. Each sweep, per running campaign:
 *
 *   1. Resolve the campaign's `audience_filter` (json) into a gateway
 *      `OrderFilter` and fetch matching orders (newest-first), bounded by the
 *      campaign's `daily_cap` / `concurrency`.
 *   2. For every order with a dialable phone, run the DialGate
 *      (`canDial` — call window + concurrency + consent/DNC).
 *   3. If the gate passes AND there is no already-open CallTask for that order
 *      (dedupe), create a `scheduled` outbound CallTask carrying the campaign's
 *      playbook / locale.
 *
 * The separate `call-center-dialer` job then claims these `scheduled` tasks and
 * dispatches them to the voice runtime — this runner only enqueues work.
 *
 * PACING: a per-run counter caps how many tasks a campaign may create this sweep
 * (min of remaining daily_cap headroom and concurrency). DEFERRALS from the gate
 * (window/concurrency) are skipped silently this sweep and naturally retried on
 * the next; consent/DNC denials are hard-skipped.
 *
 * MASTER SAFETY FLAG: the whole sweep is a no-op unless
 * CALL_CENTER_ENABLED === "true". Everything is no-throw.
 *
 * This job iterates over every active tenant and runs the tenant-specific
 * enrollment inside the request-scoped tenant context.
 */

/** Default locale for created tasks when a campaign does not specify one. */
const DEFAULT_LOCALE = "bn"

/** Hard ceiling on orders scanned per campaign per sweep (safety bound). */
const MAX_ORDERS_PER_SWEEP = 200

/** CallTask statuses that count as an OPEN task for a given order (dedupe). */
const OPEN_TASK_STATUSES = ["scheduled", "claimed", "in_progress"]

/**
 * Translate a campaign's free-form `audience_filter` json into the gateway's
 * typed `OrderFilter`. Unknown keys are ignored; only the fields the gateway
 * understands are forwarded. Returns an empty filter when nothing usable is set.
 */
function toOrderFilter(audienceFilter: unknown): OrderFilter {
  const filter: OrderFilter = {}
  if (!audienceFilter || typeof audienceFilter !== "object") {
    return filter
  }

  const af = audienceFilter as Record<string, unknown>

  if (typeof af.payment_status === "string") {
    filter.payment_status = af.payment_status
  }
  if (typeof af.fulfillment_status === "string") {
    filter.fulfillment_status = af.fulfillment_status
  }
  if (typeof af.status === "string") {
    filter.status = af.status
  }
  if (typeof af.created_after === "string" || typeof af.created_after === "number") {
    filter.created_after = af.created_after
  }
  if (typeof af.region_id === "string") {
    filter.region_id = af.region_id
  }
  if (typeof af.country_code === "string") {
    filter.country_code = af.country_code
  }

  return filter
}

/** Resolve the dialable phone for an order (shipping address first, then order). */
function dialablePhone(order: {
  phone: string | null
  shipping_address: { phone: string | null } | null
}): string | null {
  const raw = order.shipping_address?.phone ?? order.phone
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

export default async function callCenterCampaignRunnerJob(
  container: MedusaContainer
): Promise<void> {
  // Master kill-switch: inert unless explicitly enabled.
  if (process.env.CALL_CENTER_ENABLED !== "true") {
    return
  }

  const summary = await runForEachTenant(
    container,
    "call-center campaign-runner",
    (c) => runCampaignsForTenant(c, getCurrentTenantId()!)
  )

  // eslint-disable-next-line no-console
  console.log(
    `[call-center] campaign-runner: platform sweep complete — ${summary.totalCreated} task(s) created.`
  )
}

async function runCampaignsForTenant(
  container: MedusaContainer,
  tenantId: string
): Promise<{ totalCreated: number }> {
  // Durable ops-level kill switch: flippable without redeploy. FAIL SAFE — if
  // the setting cannot be read, treat outbound as halted and skip enrollment.
  try {
    if (await new SettingsService(container).isOutboundHalted(tenantId)) {
      return { totalCreated: 0 }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] campaign-runner: outbound-halt check failed for tenant ${tenantId} — skipping sweep (fail safe):`,
      e
    )
    return { totalCreated: 0 }
  }

  const cc: any = container.resolve(CALL_CENTER_MODULE)
  const gateway = getCommerceGateway(container)
  const gate = new DialGate(container)
  const now = new Date()

  // 1. Find running campaigns for the tenant.
  let campaigns: any[] = []
  try {
    campaigns = await cc.listCampaigns({
      tenant_id: tenantId,
      status: "running",
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] campaign-runner: failed to list running campaigns for tenant ${tenantId}:`,
      e
    )
    return { totalCreated: 0 }
  }

  if (!campaigns?.length) {
    return { totalCreated: 0 }
  }

  let totalCreated = 0

  for (const campaign of campaigns) {
    const concurrency = Number(campaign.concurrency ?? 5)
    const dailyCap =
      campaign.daily_cap === null || campaign.daily_cap === undefined
        ? Infinity
        : Number(campaign.daily_cap)

    // Per-run pacing budget: never create more than the concurrency, nor exceed
    // whatever daily headroom the campaign still has this sweep.
    const runBudget = Math.max(0, Math.min(concurrency, dailyCap))
    if (runBudget <= 0) {
      continue
    }

    let createdForCampaign = 0

    try {
      const filter = toOrderFilter(campaign.audience_filter)
      filter.limit = Math.min(MAX_ORDERS_PER_SWEEP, runBudget * 5)

      const orders = await gateway.queryOrders(tenantId, filter)
      if (!orders?.length) {
        continue
      }

      for (const order of orders) {
        if (createdForCampaign >= runBudget) {
          break
        }

        const phone = dialablePhone(order)
        if (!phone) {
          continue
        }

        // Pre-dial gate: call window + concurrency + consent/DNC.
        const verdict = await gate.canDial(tenantId, phone, "transactional", {
          cap: concurrency,
          now,
        })
        if (!verdict.ok) {
          // Deferrals (window/concurrency) retry next sweep; consent/DNC are
          // hard-skipped. Either way we simply do not enqueue this order now.
          continue
        }

        // Dedupe: skip if an OPEN CallTask already exists for this order.
        let openTasks: any[] = []
        try {
          openTasks = await cc.listCallTasks({
            tenant_id: tenantId,
            order_id: order.id,
            status: OPEN_TASK_STATUSES,
          })
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(
            `[call-center] campaign-runner: dedupe lookup failed for order ${order.id} in tenant ${tenantId}:`,
            e
          )
          continue
        }
        if (openTasks?.length) {
          continue
        }

        // Enqueue a scheduled outbound CallTask for the dialer to pick up.
        try {
          await cc.createCallTasks({
            tenant_id: tenantId,
            order_id: order.id,
            customer_id: order.customer_id ?? null,
            playbook_id: campaign.playbook_id ?? null,
            campaign_id: campaign.id,
            direction: "outbound",
            status: "scheduled",
            scheduled_at: now,
            locale: campaign.locale ?? DEFAULT_LOCALE,
          })
          createdForCampaign += 1
          totalCreated += 1
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(
            `[call-center] campaign-runner: failed to create task for order ${order.id} in tenant ${tenantId}:`,
            e
          )
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[call-center] campaign-runner: campaign ${campaign.id} sweep error in tenant ${tenantId}:`,
        e
      )
    }

    if (createdForCampaign > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[call-center] campaign-runner: campaign ${campaign.id} for tenant ${tenantId} enqueued ${createdForCampaign} task(s).`
      )
    }
  }

  return { totalCreated }
}

export const config = {
  name: "call-center-campaign-runner",
  schedule: "*/2 * * * *",
}
