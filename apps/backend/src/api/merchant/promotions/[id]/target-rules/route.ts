import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handleRuleBatch } from "../../_shared"

/**
 * POST /merchant/promotions/:id/target-rules
 *
 * Batch create/update/delete of item/shipping target rules via
 * batchPromotionRulesWorkflow (rule_type TARGET_RULES). Disguised attributes
 * (apply_to_quantity) are persisted onto the application method instead.
 * Ownership + rule-id containment enforced in handleRuleBatch (fail-closed).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  return handleRuleBatch(req, res, "target-rules")
}
