import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createTaxRegionsWorkflow,
  createTaxRatesWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"

/**
 * /merchant/tax-regions — tenant-scoped tax regions.
 *
 * The tax module is shared across the pooled DB and enforces ONE region per
 * country/province (unique index). We therefore scope regions per tenant via
 * metadata.tenant_id (fail-closed on read) and let a merchant CLAIM a country
 * that no one else has configured. If the jurisdiction is already configured
 * (by another tenant or the platform), create returns 409 rather than colliding
 * on the DB constraint. A merchant can only see/manage regions it owns.
 */

const CreateSchema = z.object({
  country_code: z.string().trim().min(2).max(3),
  provider_id: z.string().trim().min(1).optional(),
  default_tax_rate: z
    .object({
      name: z.string().trim().min(1),
      code: z.string().trim().optional(),
      rate: z.number().optional(),
    })
    .optional(),
})

function defaultRateOf(rates: any[]) {
  const r = rates.find((x) => x.is_default) || null
  return r
    ? { id: r.id, name: r.name, rate: r.rate ?? 0, code: r.code ?? null }
    : null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "tax_region",
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
    pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } } as any,
  })

  // Fail-closed: only top-level regions tagged with THIS tenant id.
  const owned = (data || []).filter(
    (r: any) => r.metadata?.tenant_id === ctx.tenant.id && !r.parent_id
  )
  const ids = owned.map((r: any) => r.id)

  let ratesByRegion: Record<string, any[]> = {}
  if (ids.length) {
    const { data: rates } = await query.graph({
      entity: "tax_rate",
      filters: { tax_region_id: ids } as any,
      fields: ["id", "name", "code", "rate", "is_default", "tax_region_id"],
      pagination: { take: 2000, skip: 0 } as any,
    })
    for (const rate of rates || []) {
      const key = rate.tax_region_id
      if (!ratesByRegion[key]) ratesByRegion[key] = []
      ratesByRegion[key].push(rate)
    }
  }

  res.json({
    tax_regions: owned.map((r: any) => ({
      id: r.id,
      country_code: r.country_code,
      province_code: r.province_code ?? null,
      provider_id: r.provider_id ?? null,
      default_rate: defaultRateOf(ratesByRegion[r.id] || []),
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    count: owned.length,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { country_code, provider_id, default_tax_rate } = parsed.data
  const cc = country_code.toLowerCase()

  let region: any
  try {
    const { result } = await createTaxRegionsWorkflow(req.scope).run({
      input: [
        {
          country_code: cc,
          provider_id: provider_id || undefined,
          metadata: { tenant_id: ctx.tenant.id },
        },
      ],
    })
    region = (result as any[])[0]
  } catch (e: any) {
    const msg = String(e?.message || "")
    if (/unique|already exists|duplicate/i.test(msg)) {
      return res.status(409).json({
        message:
          "A tax region for this country is already configured on the platform and cannot be claimed.",
      })
    }
    return res.status(400).json({ message: msg || "failed to create tax region" })
  }

  if (default_tax_rate) {
    await createTaxRatesWorkflow(req.scope).run({
      input: [
        {
          tax_region_id: region.id,
          name: default_tax_rate.name,
          code: default_tax_rate.code || null,
          rate: default_tax_rate.rate ?? null,
          is_default: true,
          metadata: { tenant_id: ctx.tenant.id },
        },
      ],
    })
  }

  res.status(201).json({
    tax_region: {
      id: region.id,
      country_code: region.country_code,
      province_code: region.province_code ?? null,
      provider_id: region.provider_id ?? null,
      created_at: region.created_at,
      updated_at: region.updated_at,
    },
  })
}
