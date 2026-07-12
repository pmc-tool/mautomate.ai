import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { getRuleAttributes } from "../_shared"

const QuerySchema = z.object({
  rule_type: z.enum(["rules", "target-rules", "buy-rules"]),
  promotion_type: z.enum(["standard", "buyget"]).optional(),
  application_method_type: z.enum(["fixed", "percentage"]).optional(),
  application_method_target_type: z
    .enum(["items", "shipping_methods", "order"])
    .optional(),
})

/**
 * GET /merchant/promotions/rule-attributes?rule_type=&promotion_type=
 *      [&application_method_type=&application_method_target_type=]
 *
 * Server-defined attribute catalog per rule type + promotion type, mirroring
 * Medusa admin's rule-attribute-options lists MINUS region / country /
 * sales-channel / shipping-option-type attributes (single region + single
 * channel per tenant). Each attribute carries its allowed operators; disguised
 * attributes (currency_code, apply_to_quantity, buy_rules_min_quantity) are
 * flagged so the client persists them onto the application method.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = QuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const attributes = getRuleAttributes({
    ruleType: parsed.data.rule_type,
    promotionType: parsed.data.promotion_type ?? "standard",
    applicationMethodType: parsed.data.application_method_type ?? null,
    targetType: parsed.data.application_method_target_type ?? null,
  })

  res.json({
    attributes: attributes.map((a) => ({
      id: a.id,
      value: a.value,
      label: a.label,
      field_type: a.field_type,
      required: a.required,
      disguised: a.disguised,
      operators: a.operators.map((o) => ({
        id: o.id,
        value: o.value,
        label: o.label,
      })),
    })),
  })
}
