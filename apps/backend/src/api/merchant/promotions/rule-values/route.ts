import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "zod"
import { MerchantCtx, resolveMerchant } from "../../_helpers"
import {
  RULE_VALUE_SOURCES,
  findAttribute,
  tenantCurrencies,
} from "../_shared"

const QuerySchema = z.object({
  rule_type: z.enum(["rules", "target-rules", "buy-rules"]).optional(),
  attribute: z.string().min(1),
  q: z.string().optional(),
})

const MAX_OPTIONS = 100

/**
 * Products are tenant-scoped via the tenant sales channel link (same pattern
 * as /merchant/products).
 */
async function listTenantProductOptions(
  req: MedusaRequest,
  ctx: MerchantCtx
): Promise<{ value: string; label: string }[]> {
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return []
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
  })
  const ids = (links || []).map((l: any) => l.product_id).filter(Boolean)
  if (!ids.length) return []
  const { data } = await query.graph({
    entity: "product",
    filters: { id: ids } as any,
    fields: ["id", "title"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  return (data || []).map((p: any) => ({
    value: p.id,
    label: p.title ?? p.id,
  }))
}

/**
 * Customer groups / categories / collections / types / tags are tenant-scoped
 * via metadata.tenant_id, fail-closed (same pattern as /merchant/product-tags
 * and /merchant/product-types).
 */
async function listTenantMetadataOptions(
  req: MedusaRequest,
  ctx: MerchantCtx,
  attributeId: string
): Promise<{ value: string; label: string }[]> {
  const source = RULE_VALUE_SOURCES[attributeId]
  if (!source) return []
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: source.entity,
    fields: ["id", source.labelField, "metadata"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  return (data || [])
    .filter((row: any) => row.metadata?.tenant_id === ctx.tenant.id)
    .map((row: any) => ({
      value: row.id,
      label: row[source.labelField] ?? row.id,
    }))
}

/**
 * GET /merchant/promotions/rule-values?rule_type=&attribute=&q=
 *
 * Tenant-scoped value options for a rule attribute:
 * - customer_group: the tenant's own groups (metadata.tenant_id)
 * - product: products linked to the tenant sales channel
 * - product_category / product_collection / product_type / product_tag:
 *   tenant-owned catalog entities (metadata.tenant_id)
 * - currency_code: the tenant store's enabled currencies
 * Number attributes (apply_to_quantity, buy_rules_min_quantity) have no
 * options. Everything is fail-closed — foreign rows are never offered.
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

  const attr = findAttribute(parsed.data.attribute)
  if (!attr) {
    return res.status(400).json({ message: "unknown attribute" })
  }
  if (attr.field_type === "number") {
    return res.json({ values: [] })
  }

  try {
    let values: { value: string; label: string }[] = []

    if (attr.id === "currency_code") {
      const { currencies } = tenantCurrencies(ctx)
      values = currencies.map((c) => ({ value: c, label: c.toUpperCase() }))
    } else if (attr.id === "product") {
      values = await listTenantProductOptions(req, ctx)
    } else {
      values = await listTenantMetadataOptions(req, ctx, attr.id)
    }

    const q = (parsed.data.q || "").trim().toLowerCase()
    if (q) {
      values = values.filter((v) => v.label.toLowerCase().includes(q))
    }

    res.json({ values: values.slice(0, MAX_OPTIONS) })
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "failed to load rule values" })
  }
}
