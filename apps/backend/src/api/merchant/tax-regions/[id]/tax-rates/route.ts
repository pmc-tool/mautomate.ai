import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTaxRatesWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

/**
 * POST /merchant/tax-regions/:id/tax-rates — create a tax rate on a tenant-owned
 * region. Handles BOTH default rates (is_default: true) and overrides
 * (is_default: false with targeting rules). Rule references are validated to
 * belong to this tenant (fail-closed) so a merchant cannot target another
 * tenant's products/types.
 */

const RuleSchema = z.object({
  reference: z.enum(["product", "product_type", "shipping_option"]),
  reference_id: z.string().trim().min(1),
})

const CreateSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().nullable().optional(),
  rate: z.number().nullable().optional(),
  is_default: z.boolean().optional().default(false),
  is_combinable: z.boolean().optional().default(false),
  rules: z.array(RuleSchema).optional().default([]),
})

async function ownedRegion(req: MedusaRequest, tenantId: string, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "tax_region",
    filters: { id } as any,
    fields: ["id", "metadata"],
  })
  const r = (data || [])[0]
  if (!r || r.metadata?.tenant_id !== tenantId) return null
  return r
}

async function tenantProductIds(query: any, scId?: string): Promise<string[]> {
  if (!scId) return []
  const { data } = await query.graph({
    entity: "product_sales_channel",
    filters: { sales_channel_id: scId } as any,
    fields: ["product_id"],
    pagination: { take: 10000, skip: 0 } as any,
  })
  return (data || []).map((l: any) => l.product_id).filter(Boolean)
}

export async function validateRules(
  req: MedusaRequest,
  tenantId: string,
  scId: string | undefined,
  rules: { reference: string; reference_id: string }[]
): Promise<string | null> {
  if (!rules.length) return null
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const productRefs = rules
    .filter((r) => r.reference === "product")
    .map((r) => r.reference_id)
  if (productRefs.length) {
    const owned = new Set(await tenantProductIds(query, scId))
    for (const id of productRefs) {
      if (!owned.has(id)) return `product ${id} is not part of your store`
    }
  }

  const typeRefs = rules
    .filter((r) => r.reference === "product_type")
    .map((r) => r.reference_id)
  if (typeRefs.length) {
    const { data } = await query.graph({
      entity: "product_type",
      filters: { id: typeRefs } as any,
      fields: ["id", "metadata"],
    })
    const ownedT = new Set(
      (data || [])
        .filter((t: any) => t.metadata?.tenant_id === tenantId)
        .map((t: any) => t.id)
    )
    for (const id of typeRefs) {
      if (!ownedT.has(id)) return `product type ${id} is not part of your store`
    }
  }

  return null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const region = await ownedRegion(req, ctx.tenant.id, id)
  if (!region) return res.status(404).json({ message: "tax region not found" })

  const parsed = CreateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { name, code, rate, is_default, is_combinable, rules } = parsed.data

  const ruleError = await validateRules(
    req,
    ctx.tenant.id,
    ctx.tenant.meta?.sales_channel_id,
    rules
  )
  if (ruleError) return res.status(400).json({ message: ruleError })

  let rateRow: any
  try {
    const { result } = await createTaxRatesWorkflow(req.scope).run({
      input: [
        {
          tax_region_id: id,
          name,
          code: code ?? null,
          rate: rate ?? null,
          is_default,
          is_combinable,
          rules: rules.map((r) => ({
            reference: r.reference,
            reference_id: r.reference_id,
          })),
          metadata: { tenant_id: ctx.tenant.id },
        },
      ],
    })
    rateRow = (result as any[])[0]
  } catch (e: any) {
    const msg = String(e?.message || "")
    if (is_default && /unique|already|duplicate|default/i.test(msg)) {
      return res.status(409).json({
        message: "This region already has a default tax rate.",
      })
    }
    return res.status(400).json({ message: msg || "failed to create tax rate" })
  }

  res.status(201).json({
    tax_rate: {
      id: rateRow.id,
      name: rateRow.name,
      code: rateRow.code ?? null,
      rate: rateRow.rate ?? null,
      is_default: !!rateRow.is_default,
      is_combinable: !!rateRow.is_combinable,
    },
  })
}
