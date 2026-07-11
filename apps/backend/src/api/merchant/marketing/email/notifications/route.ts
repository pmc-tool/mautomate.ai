import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../_helpers"
import { getCatalogStatus } from "../../../../../modules/marketing/email/catalog-resolver"

/**
 * GET /merchant/marketing/email/notifications
 *
 * The fixed catalog of store notification emails (order confirmation, shipping,
 * welcome, ...) with this shop's per-template status: whether it's been
 * customized and whether it's switched on. Every shop has all of them by
 * default; a merchant only creates a row when they edit one.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const templates = await getCatalogStatus(req.scope, ctx.tenant.id)
    res.json({ templates })
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "Failed to load notification templates" })
  }
}
