import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handleRuleBatch } from "../../_shared"

/**
 * POST /merchant/promotions/:id/buy-rules
 *
 * Batch create/update/delete of buyget buy rules via
 * batchPromotionRulesWorkflow (rule_type BUY_RULES). Only available on buyget
 * promotions. Disguised attributes (buy_rules_min_quantity) are persisted
 * onto the application method instead. Ownership + rule-id containment
 * enforced in handleRuleBatch (fail-closed).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  return handleRuleBatch(req, res, "buy-rules")
}
