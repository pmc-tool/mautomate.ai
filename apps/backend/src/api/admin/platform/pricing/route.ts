import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPricing } from "../_pricing"

/** GET /admin/platform/pricing — persisted packages + credit price book. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await readPricing(req.scope))
}
