import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { ensurePlatformEnv } from "../../../../../modules/marketing/platform-credentials"
import { setupTenantPixel } from "../../../../../modules/marketing/ads"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/signals/pixel — one-click pixel setup.
 *
 * Uses the account's existing pixel (or creates one named after the store),
 * records it, and from the next page load every storefront visit fires the
 * base pixel; purchases start flowing server-side immediately.
 *
 * Body: { pixel_id? } to pick a specific existing pixel.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    await ensurePlatformEnv(req.scope)
  } catch {
    /* non-blocking */
  }
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const pixel = await setupTenantPixel(mk, ctx.tenant.id, {
      pixelId: b.pixel_id ?? null,
      storeName: ctx.tenant.name ?? null,
    })
    res.status(201).json({
      pixel: {
        id: pixel.id,
        external_id: pixel.external_id,
        name: pixel.name,
        status: pixel.status,
        events_sent: Number(pixel.events_sent) || 0,
        last_event_at: pixel.last_event_at,
      },
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Pixel setup failed" })
  }
}
