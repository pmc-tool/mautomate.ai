import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateTaxRatesWorkflow,
  deleteTaxRatesWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../../_helpers"

const RuleSchema = z.object({
  reference: z.enum(["product", "product_type", "shipping_option"]),
  reference_id: z.string().trim().min(1),
})

const UpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().nullable().optional(),
  rate: z.number().nullable().optional(),
  is_combinable: z.boolean().optional(),
  rules: z.array(RuleSchema).optional(),
})

async function ownedRateInRegion(
  req: MedusaRequest,
  tenantId: string,
  regionId: string,
  rateId: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regs } = await query.graph({
    entity: "tax_region",
    filters: { id: regionId } as any,
    fields: ["id", "metadata"],
  })
  const region = (regs || [])[0]
  if (!region || region.metadata?.tenant_id !== tenantId) return null

  const { data: rates } = await query.graph({
    entity: "tax_rate",
    filters: { id: rateId } as any,
    fields: ["id", "tax_region_id", "is_default"],
  })
  const rate = (rates || [])[0]
  if (!rate || rate.tax_region_id !== regionId) return null
  return rate
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

async function validateRules(
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

const update = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id, rateId } = req.params
  const rate = await ownedRateInRegion(req, ctx.tenant.id, id, rateId)
  if (!rate) return res.status(404).json({ message: "tax rate not found" })

  const parsed = UpdateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  if (parsed.data.rules) {
    const ruleError = await validateRules(
      req,
      ctx.tenant.id,
      ctx.tenant.meta?.sales_channel_id,
      parsed.data.rules
    )
    if (ruleError) return res.status(400).json({ message: ruleError })
  }

  const patch: Record<string, any> = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.code !== undefined) patch.code = parsed.data.code
  if (parsed.data.rate !== undefined) patch.rate = parsed.data.rate
  if (parsed.data.is_combinable !== undefined) {
    patch.is_combinable = parsed.data.is_combinable
  }
  // Passing rules to the update workflow reconciles (creates/deletes) rules.
  if (parsed.data.rules !== undefined) {
    patch.rules = parsed.data.rules.map((r) => ({
      reference: r.reference,
      reference_id: r.reference_id,
    }))
  }

  const { result } = await updateTaxRatesWorkflow(req.scope).run({
    input: { selector: { id: rateId }, update: patch },
  })

  const row = (result as any[])[0]
  res.json({
    tax_rate: {
      id: row.id,
      name: row.name,
      code: row.code ?? null,
      rate: row.rate ?? null,
      is_default: !!row.is_default,
      is_combinable: !!row.is_combinable,
    },
  })
}

export const POST = update
export const PUT = update

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id, rateId } = req.params
  const rate = await ownedRateInRegion(req, ctx.tenant.id, id, rateId)
  if (!rate) return res.status(404).json({ message: "tax rate not found" })

  await deleteTaxRatesWorkflow(req.scope).run({ input: { ids: [rateId] } })

  res.json({ id: rateId, object: "tax_rate", deleted: true })
}
