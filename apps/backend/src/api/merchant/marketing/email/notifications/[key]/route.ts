import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import { resolveMerchant } from "../../../../_helpers"
import {
  getCatalogTemplate,
  type CatalogToken,
} from "../../../../../../modules/marketing/email/catalog"
import {
  getOverride,
  resolveCatalogEmail,
} from "../../../../../../modules/marketing/email/catalog-resolver"

/** Build a sample token context from a catalog template's declared tokens. */
const sampleContext = (tokens: CatalogToken[]): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const t of tokens) out[t.token] = t.sample
  return out
}

/**
 * GET /merchant/marketing/email/notifications/:key
 *
 * Everything the editor needs for one template: the catalog metadata + tokens,
 * the current (possibly customized) subject/body, the code default subject/body
 * (for "reset"), the enabled flag, and a fully-rendered HTML preview.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { key } = req.params
  const tpl = getCatalogTemplate(key)
  if (!tpl) return res.status(404).json({ message: "unknown template" })

  const tenantId = ctx.tenant.id
  const override = await getOverride(req.scope, tenantId, key)
  const preview = await resolveCatalogEmail(
    req.scope,
    tenantId,
    key,
    sampleContext(tpl.tokens)
  )

  res.json({
    key: tpl.key,
    title: tpl.title,
    description: tpl.description,
    category: tpl.category,
    trigger: tpl.trigger,
    tokens: tpl.tokens,
    // Editable values (override if present, else code default).
    subject: override?.subject ?? tpl.defaultSubject,
    body: override?.html ?? tpl.defaultBody,
    enabled: !override || (override.meta as any)?.enabled !== false,
    customized: !!override,
    // Code defaults, for the "reset to default" affordance.
    defaultSubject: tpl.defaultSubject,
    defaultBody: tpl.defaultBody,
    // Server-rendered preview (subject + full branded HTML).
    previewSubject: preview?.subject ?? "",
    previewHtml: preview?.html ?? "",
  })
}

/**
 * PUT /merchant/marketing/email/notifications/:key
 * Body: { subject?, body?, enabled? } — upserts this shop's override.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { key } = req.params
  const tpl = getCatalogTemplate(key)
  if (!tpl) return res.status(404).json({ message: "unknown template" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as Record<string, any>
  const svc: any = req.scope.resolve(MARKETING_MODULE)

  try {
    const existing = await getOverride(req.scope, tenantId, key)
    const meta = {
      ...((existing?.meta as any) ?? {}),
      ...(typeof b.enabled === "boolean" ? { enabled: b.enabled } : {}),
    }
    const patch = {
      subject:
        typeof b.subject === "string" ? b.subject.trim() : existing?.subject ?? tpl.defaultSubject,
      html: typeof b.body === "string" ? b.body : existing?.html ?? tpl.defaultBody,
      meta,
    }

    let row: any
    if (existing) {
      row = await svc.updateMarketingEmailTemplates({ id: existing.id, ...patch })
    } else {
      row = await svc.createMarketingEmailTemplates({
        tenant_id: tenantId,
        key,
        name: tpl.title,
        kind: tpl.kind,
        ...patch,
      })
    }
    const saved = Array.isArray(row) ? row[0] : row
    res.json({ ok: true, id: saved?.id })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to save template" })
  }
}

/**
 * DELETE /merchant/marketing/email/notifications/:key
 * Removes this shop's override — the template falls back to the code default.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { key } = req.params
  if (!getCatalogTemplate(key)) {
    return res.status(404).json({ message: "unknown template" })
  }

  const svc: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const existing = await getOverride(req.scope, ctx.tenant.id, key)
    if (existing) await svc.deleteMarketingEmailTemplates(existing.id)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to reset template" })
  }
}
