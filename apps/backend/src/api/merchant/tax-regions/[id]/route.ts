import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateTaxRegionsWorkflow,
  deleteTaxRegionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"

const UpdateSchema = z.object({
  provider_id: z.string().trim().min(1).nullable().optional(),
})

async function ownedRegion(req: MedusaRequest, tenantId: string, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "tax_region",
    filters: { id } as any,
    fields: [
      "id",
      "country_code",
      "province_code",
      "parent_id",
      "provider_id",
      "metadata",
      "created_at",
      "updated_at",
    ],
  })
  const r = (data || [])[0]
  if (!r || r.metadata?.tenant_id !== tenantId) return null
  return r
}

function shapeRate(r: any) {
  return {
    id: r.id,
    name: r.name,
    code: r.code ?? null,
    rate: r.rate ?? null,
    is_default: !!r.is_default,
    is_combinable: !!r.is_combinable,
    rules: (r.rules || [])
      .filter((x: any) => x?.reference && x?.reference_id)
      .map((x: any) => ({ reference: x.reference, reference_id: x.reference_id })),
  }
}

/**
 * GET /merchant/tax-regions/:id — widened detail: default rates, overrides
 * (non-default rates with targeting rules), and provinces (child regions with
 * their default rate). Works for both country and province regions.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const region = await ownedRegion(req, ctx.tenant.id, id)
  if (!region) return res.status(404).json({ message: "tax region not found" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Rates for this region (default + overrides).
  const { data: rates } = await query.graph({
    entity: "tax_rate",
    filters: { tax_region_id: id } as any,
    fields: [
      "id",
      "name",
      "code",
      "rate",
      "is_default",
      "is_combinable",
      "tax_region_id",
      "rules.reference",
      "rules.reference_id",
    ],
    pagination: { take: 1000, skip: 0 } as any,
  })

  // Provinces: read from the OWNING region's children relation.
  const { data: withChildren } = await query.graph({
    entity: "tax_region",
    filters: { id } as any,
    fields: [
      "id",
      "children.id",
      "children.province_code",
      "children.metadata",
    ],
  })
  const children = ((withChildren || [])[0]?.children || []).filter(
    (c: any) => c?.id
  )
  const childIds = children.map((c: any) => c.id)

  let childRates: Record<string, any[]> = {}
  if (childIds.length) {
    const { data: cr } = await query.graph({
      entity: "tax_rate",
      filters: { tax_region_id: childIds } as any,
      fields: ["id", "name", "code", "rate", "is_default", "tax_region_id"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    for (const r of cr || []) {
      const k = r.tax_region_id
      if (!childRates[k]) childRates[k] = []
      childRates[k].push(r)
    }
  }

  const defaultRates = (rates || [])
    .filter((r: any) => r.is_default)
    .map(shapeRate)
  const overrides = (rates || [])
    .filter((r: any) => !r.is_default)
    .map(shapeRate)

  const provinces = children.map((c: any) => {
    const dr = (childRates[c.id] || []).find((r: any) => r.is_default) || null
    return {
      id: c.id,
      province_code: c.province_code ?? null,
      default_rate: dr
        ? { id: dr.id, name: dr.name, rate: dr.rate ?? 0, code: dr.code ?? null }
        : null,
    }
  })

  res.json({
    tax_region: {
      id: region.id,
      country_code: region.country_code,
      province_code: region.province_code ?? null,
      parent_id: region.parent_id ?? null,
      provider_id: region.provider_id ?? null,
      default_rates: defaultRates,
      overrides,
      provinces,
      created_at: region.created_at,
      updated_at: region.updated_at,
    },
  })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const region = await ownedRegion(req, ctx.tenant.id, id)
  if (!region) return res.status(404).json({ message: "tax region not found" })
  if (region.parent_id) {
    return res
      .status(400)
      .json({ message: "only top-level (country) tax regions can be updated" })
  }

  const parsed = UpdateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  await updateTaxRegionsWorkflow(req.scope).run({
    input: [{ id, provider_id: parsed.data.provider_id ?? null }],
  })

  res.json({ id, object: "tax_region", updated: true })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const region = await ownedRegion(req, ctx.tenant.id, id)
  if (!region) return res.status(404).json({ message: "tax region not found" })

  // Cascade deletes children (provinces) + rates via the module cascade config.
  await deleteTaxRegionsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "tax_region", deleted: true })
}
