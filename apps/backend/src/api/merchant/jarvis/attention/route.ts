import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { computeAttention } from "../_attention"

/**
 * GET /merchant/jarvis/attention
 *
 * The "needs attention" digest for the Pixi panel: setup blockers, orders
 * waiting on the merchant, and low stock — tenant-scoped, sorted, and capped.
 * When the store is ready and nothing is pending, `items` is empty and the UI
 * shows the all-clear.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const data = await computeAttention(req, ctx as any)
  res.json(data)
}
