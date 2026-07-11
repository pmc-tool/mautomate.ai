import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * Clear `is_default` on every other brand voice for the tenant, so at most one
 * default exists at a time. Pass `exceptId` to keep the just-set default.
 */
const unsetOtherDefaults = async (
  svc: MarketingModuleService,
  exceptId?: string
): Promise<void> => {
  const others = await svc.listMarketingBrandVoices(
    { tenant_id: TENANT_ID, is_default: true },
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
 * GET /admin/marketing/brand-voice
 *
 * Paginated list of brand voices, tenant-scoped.
 * Response: { brand_voices, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [brand_voices, count] = await svc.listAndCountMarketingBrandVoices(
      { tenant_id: TENANT_ID },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ brand_voices, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list brand voices",
    })
  }
}

/**
 * POST /admin/marketing/brand-voice
 *
 * Create a brand voice. `name` is required. When `is_default` is true, every
 * other brand voice for the tenant is cleared so the new one is the sole default.
 * Body: { name, tone?, do_rules?, dont_rules?, sample_copy?, language?,
 *         is_default? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
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
      tenant_id: TENANT_ID,
      name,
      tone: b.tone ?? null,
      do_rules: b.do_rules ?? null,
      dont_rules: b.dont_rules ?? null,
      sample_copy: b.sample_copy ?? null,
      language: b.language ?? "en",
      is_default: isDefault,
    })

    const brand_voice = Array.isArray(created) ? created[0] : created

    if (isDefault) {
      await unsetOtherDefaults(svc, (brand_voice as any).id)
    }

    res.status(201).json({ brand_voice })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create brand voice",
    })
  }
}
