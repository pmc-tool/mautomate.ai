import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor } from "../_helpers"

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/**
 * GET /merchant/ads/signals
 *
 * The Tracking & catalog status for this store: the active pixel (with its
 * CAPI heartbeat), the synced product catalog, and whether the prerequisites
 * (connected Meta + selected ad account) are met — drives the guided setup UI.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    // Any signal-capable platform counts (meta in production; the demo
    // platform when it is enabled) — the same resolution setup/sync use.
    const [connection, account, pixel, catalog] = await Promise.all([
      mk
        .listAdsConnections(
          { tenant_id: ctx.tenant.id, status: "connected" },
          { take: 1 }
        )
        .then(first),
      mk
        .listAdsAccounts(
          { tenant_id: ctx.tenant.id, selected: true, status: "active" },
          { take: 1 }
        )
        .then(first),
      mk
        .listAdsPixels(
          { tenant_id: ctx.tenant.id, status: "active" },
          { take: 1 }
        )
        .then(first),
      mk
        .listAdsCatalogs({ tenant_id: ctx.tenant.id }, { take: 1 })
        .then(first),
    ])

    res.json({
      requirements: {
        connected: Boolean(connection),
        account_selected: Boolean(account),
      },
      pixel: pixel
        ? {
            id: pixel.id,
            external_id: pixel.external_id,
            name: pixel.name,
            status: pixel.status,
            events_sent: Number(pixel.events_sent) || 0,
            last_event_at: pixel.last_event_at,
          }
        : null,
      catalog: catalog
        ? {
            id: catalog.id,
            external_id: catalog.external_id,
            name: catalog.name,
            status: catalog.status,
            item_count: Number(catalog.item_count) || 0,
            skipped_count: Number(catalog.skipped_count) || 0,
            skipped_reasons: catalog.meta?.skipped_reasons ?? null,
            last_synced_at: catalog.last_synced_at,
          }
        : null,
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to load tracking status" })
  }
}
