import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

const PLATFORM_MANAGED_MESSAGE =
  "Tax regions are managed by the platform operator and cannot be changed from the merchant dashboard."

function formatTaxRegion(region: any, rates: any[]) {
  const defaultRate = rates.find((r) => r.is_default) || rates[0] || null
  return {
    id: region.id,
    country_code: region.country_code,
    province_code: region.province_code ?? null,
    default_rate: defaultRate
      ? {
          id: defaultRate.id,
          name: defaultRate.name,
          rate: defaultRate.rate ?? 0,
          code: defaultRate.code ?? null,
        }
      : null,
    created_at: region.created_at,
    updated_at: region.updated_at,
  }
}

/**
 * GET /merchant/tax-regions
 *
 * Tax regions are PLATFORM-SCOPED. Because a Medusa instance enforces a single
 * tax region per country/province, tax config is a shared jurisdiction/compliance
 * concern owned by the platform operator — not something each pooled tenant
 * creates. This endpoint is READ-ONLY and lists the instance's tax regions so a
 * merchant can SEE the applicable tax configuration. Only non-sensitive fields
 * (country/province + default rate) are exposed via formatTaxRegion; metadata is
 * never returned, so no per-tenant id or secret leaks through this shared read.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const taxModule: any = req.scope.resolve(Modules.TAX)
  const regions = await taxModule.listTaxRegions(
    {},
    { take: 500, skip: 0, order: { created_at: "DESC" } }
  )

  const ids = (regions || []).map((r: any) => r.id)
  let ratesByRegion: Record<string, any[]> = {}
  if (ids.length) {
    const rates = await taxModule.listTaxRates(
      { tax_region_id: ids },
      { take: 1000 }
    )
    for (const rate of rates || []) {
      const key = rate.tax_region_id
      if (!ratesByRegion[key]) ratesByRegion[key] = []
      ratesByRegion[key].push(rate)
    }
  }

  res.json({
    tax_regions: (regions || []).map((r: any) =>
      formatTaxRegion(r, ratesByRegion[r.id] || [])
    ),
    count: (regions || []).length,
  })
}

/**
 * POST /merchant/tax-regions
 *
 * Disabled. Tax regions are platform-scoped: allowing a pooled merchant to
 * create one would either collide with another tenant's country/province claim
 * or block every other tenant from that jurisdiction. Creation is reserved for
 * the platform operator (super-admin console — future phase).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  return res.status(403).json({ message: PLATFORM_MANAGED_MESSAGE })
}

/**
 * PUT /merchant/tax-regions
 *
 * Disabled — same rationale as POST. Tax regions are managed by the operator.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  return res.status(403).json({ message: PLATFORM_MANAGED_MESSAGE })
}
