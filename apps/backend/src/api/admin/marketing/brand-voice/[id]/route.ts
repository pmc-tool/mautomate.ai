import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * Clear `is_default` on every other brand voice for the tenant, keeping `exceptId`.
 */
const unsetOtherDefaults = async (
  svc: MarketingModuleService,
  exceptId: string
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
 * GET /admin/marketing/brand-voice/:id
 *
 * Retrieve a single brand voice, tenant-scoped.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const brand_voice = await svc.retrieveMarketingBrandVoice(id)
    if (
      (brand_voice as any)?.tenant_id &&
      (brand_voice as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Brand voice ${id} was not found` })
      return
    }

    res.json({ brand_voice })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve brand voice",
    })
  }
}

/**
 * POST /admin/marketing/brand-voice/:id
 *
 * Update a brand voice. Setting `is_default` true clears the default flag on
 * every other brand voice for the tenant.
 * Body: { name?, tone?, do_rules?, dont_rules?, sample_copy?, language?,
 *         is_default? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
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
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingBrandVoice(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Brand voice ${id} was not found` })
      return
    }

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      data.name = b.name
    }
    if (b.tone !== undefined) {
      data.tone = b.tone
    }
    if (b.do_rules !== undefined) {
      data.do_rules = b.do_rules
    }
    if (b.dont_rules !== undefined) {
      data.dont_rules = b.dont_rules
    }
    if (b.sample_copy !== undefined) {
      data.sample_copy = b.sample_copy
    }
    if (b.language !== undefined) {
      data.language = b.language
    }
    if (b.is_default !== undefined) {
      data.is_default = b.is_default === true
    }

    const updated = await svc.updateMarketingBrandVoices({ id, ...data })
    const brand_voice = Array.isArray(updated) ? updated[0] : updated

    if (data.is_default === true) {
      await unsetOtherDefaults(svc, id)
    }

    res.json({ brand_voice })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update brand voice",
    })
  }
}

/**
 * DELETE /admin/marketing/brand-voice/:id
 *
 * Delete a brand voice (tenant-scoped).
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingBrandVoice(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Brand voice ${id} was not found` })
      return
    }

    await svc.deleteMarketingBrandVoices(id)

    res.json({ id, object: "marketing_brand_voice", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete brand voice",
    })
  }
}
