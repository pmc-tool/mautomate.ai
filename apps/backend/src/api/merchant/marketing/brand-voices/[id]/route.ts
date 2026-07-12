import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** Load a brand voice and assert tenant ownership. Fail-closed: 404 otherwise. */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const brand_voice = await (svc as any)
    .retrieveMarketingBrandVoice(id)
    .catch(() => null)
  if (!brand_voice || brand_voice.tenant_id !== tenantId) {
    res.status(404).json({ message: `Brand voice ${id} was not found` })
    return null
  }
  return brand_voice
}

/** Clear `is_default` on every other brand voice of this tenant. */
const unsetOtherDefaults = async (
  svc: MarketingModuleService,
  tenantId: string,
  exceptId: string
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
 * GET /merchant/marketing/brand-voices/:id
 * Tenant-scoped. Response: { brand_voice }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const brand_voice = await loadOwned(svc, req.params.id, ctx.tenant.id, res)
    if (!brand_voice) return
    res.json({ brand_voice })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve brand voice",
    })
  }
}

/**
 * PUT /merchant/marketing/brand-voices/:id
 *
 * Update a brand voice (tenant-scoped). Only provided fields change. Setting
 * `is_default` true clears the flag on the tenant's other brand voices.
 * Body: { name?, tone?, do_rules?, dont_rules?, sample_copy?, language?,
 *         is_default? }
 * Response: { brand_voice }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const current = await loadOwned(svc, id, ctx.tenant.id, res)
    if (!current) return

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.tone !== undefined) data.tone = b.tone ?? null
    if (b.do_rules !== undefined) data.do_rules = b.do_rules ?? null
    if (b.dont_rules !== undefined) data.dont_rules = b.dont_rules ?? null
    if (b.sample_copy !== undefined) {
      data.sample_copy =
        typeof b.sample_copy === "string" ? b.sample_copy : null
    }
    if (b.language !== undefined) {
      data.language =
        typeof b.language === "string" && b.language.trim()
          ? b.language.trim()
          : "en"
    }
    if (b.is_default !== undefined) data.is_default = b.is_default === true

    const updated = await (svc as any).updateMarketingBrandVoices({
      id,
      ...data,
    })
    const brand_voice = Array.isArray(updated) ? updated[0] : updated

    if (data.is_default === true) {
      await unsetOtherDefaults(svc, ctx.tenant.id, id)
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
 * DELETE /merchant/marketing/brand-voices/:id
 * Tenant-scoped. Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const current = await loadOwned(svc, id, ctx.tenant.id, res)
    if (!current) return

    await (svc as any).deleteMarketingBrandVoices(id)

    res.json({ id, object: "marketing_brand_voice", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete brand voice",
    })
  }
}
