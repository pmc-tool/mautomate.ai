import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const KINDS = ["broadcast", "transactional", "journey", "recovery"] as const
type Kind = (typeof KINDS)[number]

/** Load a template and assert it belongs to the active tenant. */
const loadOwned = async (svc: any, id: string) => {
  const template = await svc.retrieveMarketingEmailTemplate(id).catch(() => null)
  if (!template || template.tenant_id !== TENANT_ID) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Email template ${id} was not found.`
    )
  }
  return template
}

/**
 * GET /admin/marketing/email/templates/:id
 * Response: { template }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)
    const template = await loadOwned(svc, req.params.id)
    res.json({ template })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to retrieve email template",
    })
  }
}

/**
 * POST /admin/marketing/email/templates/:id
 *
 * Update a template. Only provided fields are changed.
 * Body: { name?, subject?, preheader?, html?, kind?, from_name?, from_email? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)
    await loadOwned(svc, req.params.id)

    const update: Record<string, any> = { id: req.params.id }
    if (typeof b.name === "string") {
      const name = b.name.trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`name` cannot be empty."
        )
      }
      update.name = name
    }
    if (typeof b.subject === "string") update.subject = b.subject.trim() || null
    if (typeof b.preheader === "string")
      update.preheader = b.preheader.trim() || null
    if (typeof b.html === "string") update.html = b.html
    if (KINDS.includes(b.kind)) update.kind = b.kind
    if (typeof b.from_name === "string")
      update.from_name = b.from_name.trim() || null
    if (typeof b.from_email === "string")
      update.from_email = b.from_email.trim() || null

    const updated = await svc.updateMarketingEmailTemplates(update as any)
    const template = Array.isArray(updated) ? updated[0] : updated

    res.json({ template })
  } catch (e: any) {
    const status =
      e?.type === MedusaError.Types.NOT_FOUND
        ? 404
        : e?.type === MedusaError.Types.INVALID_DATA
        ? 400
        : 500
    res.status(status).json({
      message: e?.message ?? "Failed to update email template",
    })
  }
}

/**
 * DELETE /admin/marketing/email/templates/:id
 * Response: { id, object, deleted }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)
    await loadOwned(svc, req.params.id)

    await svc.deleteMarketingEmailTemplates(req.params.id)

    res.json({
      id: req.params.id,
      object: "email_template",
      deleted: true,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to delete email template",
    })
  }
}
