export default async ({ container }) => {
  const { ContainerRegistrationKeys } = require("@medusajs/framework/utils")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const errors = []

  // Validate every query.graph entity + field list this item relies on.
  // Walk from owning sides only (product.type_id / product.tags.id;
  // tax_rate.tax_region_id) — never filter an entity by a relation FK.
  const graphChecks = [
    ["product_sales_channel", ["product_id"]],
    ["product", ["id", "type_id", "tags.id"]],
    ["product_type", ["id", "value", "metadata", "created_at", "updated_at"]],
    ["product_tag", ["id", "value", "metadata", "created_at", "updated_at"]],
    [
      "refund_reason",
      ["id", "label", "code", "description", "metadata", "created_at", "updated_at"],
    ],
    [
      "return_reason",
      ["id", "value", "label", "description", "metadata", "created_at", "updated_at"],
    ],
    [
      "tax_region",
      [
        "id",
        "country_code",
        "province_code",
        "parent_id",
        "provider_id",
        "metadata",
        "created_at",
        "updated_at",
      ],
    ],
    [
      "tax_region",
      ["id", "children.id", "children.province_code", "children.metadata"],
    ],
    [
      "tax_rate",
      [
        "id",
        "name",
        "code",
        "rate",
        "is_default",
        "is_combinable",
        "tax_region_id",
        "metadata",
        "rules.reference",
        "rules.reference_id",
      ],
    ],
    [
      "store",
      ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
    ],
  ]

  for (const [entity, fields] of graphChecks) {
    try {
      await query.graph({ entity, fields, pagination: { take: 1, skip: 0 } })
    } catch (e) {
      errors.push(`graph ${entity} [${fields.join(",")}]: ${(e && e.message) || e}`)
    }
  }

  // Verify EVERY workflow export used by this item actually exists.
  let flows
  try {
    flows = require("@medusajs/core-flows")
  } catch (e) {
    errors.push(`cannot require @medusajs/core-flows: ${(e && e.message) || e}`)
    flows = {}
  }
  const needed = [
    "createRefundReasonsWorkflow",
    "updateRefundReasonsWorkflow",
    "deleteRefundReasonsWorkflow",
    "createReturnReasonsWorkflow",
    "updateReturnReasonsWorkflow",
    "deleteReturnReasonsWorkflow",
    "createProductTypesWorkflow",
    "updateProductTypesWorkflow",
    "deleteProductTypesWorkflow",
    "createProductTagsWorkflow",
    "updateProductTagsWorkflow",
    "deleteProductTagsWorkflow",
    "createTaxRegionsWorkflow",
    "updateTaxRegionsWorkflow",
    "deleteTaxRegionsWorkflow",
    "createTaxRatesWorkflow",
    "updateTaxRatesWorkflow",
    "deleteTaxRatesWorkflow",
  ]
  for (const n of needed) {
    if (typeof flows[n] !== "function") {
      errors.push(`missing workflow export: ${n}`)
    }
  }

  return { ok: errors.length === 0, errors }
}