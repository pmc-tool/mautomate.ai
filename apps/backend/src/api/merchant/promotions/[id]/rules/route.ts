import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handleRuleBatch } from "../../_shared"

/**
 * POST /merchant/promotions/:id/rules
 *
 * Batch create/update/delete of "who can use this code" rules via
 * batchPromotionRulesWorkflow (rule_type RULES). Disguised attributes
 * (currency_code) are persisted onto the application method instead.
 * Ownership + rule-id containment enforced in handleRuleBatch (fail-closed).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  return handleRuleBatch(req, res, "rules")
}
