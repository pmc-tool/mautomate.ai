import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../../_helpers"

const KINDS = ["broadcast", "transactional", "journey", "recovery"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * Load a template and assert tenant ownership. Fail-closed and null-safe: a
 * missing row OR a tenant_id not strictly equal to the caller's tenant (incl.
 * null/undefined) 404s and returns null.
 */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const template = await (svc as any)
    .retrieveMarketingEmailTemplate(id)
    .catch(() => null)
  if (!template || template.tenant_id !== tenantId) {
    res.status(404).json({ message: `Email template ${id} was not found` })
    return null
  }
  return template
}

/**
 * GET /merchant/marketing/email/templates/:id
 * Tenant-scoped. Response: { template }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const template = await loadOwned(svc, id, tenantId, res)
    if (!template) return
    res.json({ template })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve email template",
    })
  }
}

/**
 * PUT /merchant/marketing/email/templates/:id
 *
 * Update a template (tenant-scoped). Only provided fields change.
 * Body: { name?, subject?, preheader?, html?, kind?, from_name?, from_email? }
 * Response: { template }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    const update: Record<string, any> = { id }
    if (typeof b.name === "string") {
      const name = b.name.trim()
      if (!name) {
        return res.status(400).json({ message: "`name` cannot be empty." })
      }
      update.name = name
    }
    if (typeof b.subject === "string") update.subject = b.subject.trim() || null
    if (typeof b.preheader === "string") {
      update.preheader = b.preheader.trim() || null
    }
    if (typeof b.html === "string") update.html = b.html
    if (KINDS.includes(b.kind)) update.kind = b.kind
    if (typeof b.from_name === "string") {
      update.from_name = b.from_name.trim() || null
    }
    if (typeof b.from_email === "string") {
      update.from_email = b.from_email.trim() || null
    }

    const updated = await (svc as any).updateMarketingEmailTemplates(update)
    const template = Array.isArray(updated) ? updated[0] : updated

    res.json({ template })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to update email template",
    })
  }
}

/**
 * DELETE /merchant/marketing/email/templates/:id
 * Tenant-scoped. Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await loadOwned(svc, id, tenantId, res)
    if (!current) return

    await (svc as any).deleteMarketingEmailTemplates(id)

    res.json({ id, object: "marketing_email_template", deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete email template",
    })
  }
}
