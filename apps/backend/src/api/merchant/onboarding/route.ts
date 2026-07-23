import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { computeSetupStatus } from "../_setup"

/**
 * GET /merchant/onboarding
 *
 * The legacy 4-tick checklist shape (products / shipping / payment / domain plus
 * context). Kept for the existing dashboard SetupChecklist. The actual work now
 * lives in computeSetupStatus() — the single source of truth shared with
 * GET /merchant/setup/status — so the two can never disagree. Every check is
 * tenant-scoped and fails to `false` (never blocks the dashboard).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const s = await computeSetupStatus(req, ctx)

  res.json({
    products: s.products,
    shipping: s.shipping,
    payment: s.payment,
    domain: s.domain,
    shipping_countries: s.shipping_countries,
    store_country: s.store_country,
    pending_domain: s.pending_domain,
  })
}
