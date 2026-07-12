import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { resolveMerchant } from "../../_helpers"

/**
 * Clear `is_default` on every OTHER brand voice of this tenant, so at most one
 * default exists per tenant. Tenant-scoped (the admin route's equivalent runs on
 * the single admin tenant; this one is bounded by the caller's tenant).
 */
const unsetOtherDefaults = async (
  svc: MarketingModuleService,
  tenantId: string,
  exceptId?: string
): Promise<void> => {
  const others = await svc.listMarketingBrandVoices(
    { tenant_id: tenantId, is_default: true },
    { take: 1000 }
  )
  const toUnset = (Array.isArray(others) ? others : []).filter(
    (v: any) => v.id !== exceptId
  )
  if (toUnset.length) {
    await svc.updateMarketingBrandVoices(
      toUnset.map((v: any) => ({ id: v.id, is_default: false }))
    )
  }
}

/**
 * GET /merchant/marketing/brand-voices
 *
 * Paginated list of the tenant's brand voices. Query: limit, offset.
 * Response: { brand_voices, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [brand_voices, count] = await svc.listAndCountMarketingBrandVoices(
      { tenant_id: ctx.tenant.id },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ brand_voices, count, limit, offset })
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "Failed to list brand voices" })
  }
}

/**
 * POST /merchant/marketing/brand-voices
 *
 * Create a brand voice for the caller's tenant. `name` is required. When
 * `is_default` is true every other brand voice of the tenant is cleared.
 * Body: { name, tone?, do_rules?, dont_rules?, sample_copy?, language?,
 *         is_default? }
 * Response: { brand_voice }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as {
    name?: string
    tone?: any
    do_rules?: any
    dont_rules?: any
    sample_copy?: string
    language?: string
    is_default?: boolean
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A brand voice `name` is required."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const isDefault = b.is_default === true

    const created = await svc.createMarketingBrandVoices({
      tenant_id: ctx.tenant.id,
      name,
      tone: b.tone ?? null,
      do_rules: b.do_rules ?? null,
      dont_rules: b.dont_rules ?? null,
      sample_copy: b.sample_copy ?? null,
      language: b.language ?? "en",
      is_default: isDefault,
    } as any)

    const brand_voice = Array.isArray(created) ? created[0] : created

    if (isDefault) {
      await unsetOtherDefaults(svc, ctx.tenant.id, (brand_voice as any).id)
    }

    res.status(201).json({ brand_voice })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res
      .status(status)
      .json({ message: e?.message ?? "Failed to create brand voice" })
  }
}
