import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"

/** /cms/templates (secret-gated). GET list · POST create · DELETE ?id= */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}
function checkSecret(req: MedusaRequest): void {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }
}

/** The scope enum, mirrored from models/template.ts (4C adds "preset"). */
const SCOPES = ["page", "section", "preset"] as const
type Scope = (typeof SCOPES)[number]
function asScope(v: unknown): Scope | null {
  return typeof v === "string" && (SCOPES as readonly string[]).includes(v)
    ? (v as Scope)
    : null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)
  // Optional filters (4C): ?scope=page|section|preset narrows the list;
  // ?widget_type=<block type> narrows presets to one widget's dropdown.
  // Unknown scope values are rejected rather than silently ignored.
  const rawScope = req.query.scope
  if (rawScope != null && !asScope(String(rawScope))) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid scope. Expected one of: ${SCOPES.join(", ")}.`
    )
  }
  const scope = rawScope != null ? asScope(String(rawScope)) : null
  const widgetType =
    typeof req.query.widget_type === "string" && req.query.widget_type.trim()
      ? String(req.query.widget_type).trim()
      : null
  const extra: Record<string, unknown> = {}
  if (scope) extra.scope = scope
  if (widgetType) extra.widget_type = widgetType
  // Global (curated, tenant_id NULL) templates are visible to every store,
  // alongside the tenant's own. Two scoped lists, own-first.
  const [own, globals] = await Promise.all([
    (svc as any).listCmsTemplates(
      { tenant_id: tenantId, ...extra },
      { take: 200, order: { created_at: "DESC" } }
    ),
    (svc as any).listCmsTemplates(
      { tenant_id: null, ...extra },
      { take: 200, order: { created_at: "DESC" } }
    ),
  ])
  const rows = [...(own ?? []), ...(globals ?? [])] as any[]
  res.json({
    templates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      is_global: r.tenant_id == null,
      category: r.category,
      scope: r.scope,
      widget_type: r.widget_type ?? null,
      data: r.data,
      blocks: Array.isArray((r.data as any)?.blocks) ? (r.data as any).blocks.length : 0,
      created_at: r.created_at,
    })),
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const b = (req.body ?? {}) as {
    name?: string
    category?: string
    scope?: string
    widget_type?: string
    data?: unknown
  }
  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name) throw new MedusaError(MedusaError.Types.INVALID_DATA, "`name` is required.")
  // Unknown scopes fall back to "section" (the pre-4C behavior for anything
  // that wasn't "page"), so old editor payloads keep working unchanged.
  const scope: Scope = asScope(b.scope) ?? "section"
  const widgetType =
    typeof b.widget_type === "string" && b.widget_type.trim()
      ? b.widget_type.trim()
      : null
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const created = await (svc as any).createCmsTemplates({
    tenant_id: tenantId,
    name,
    category:
      typeof b.category === "string" && b.category.trim()
        ? b.category.trim()
        : scope === "preset"
          ? "Presets"
          : "Sections",
    scope,
    widget_type: widgetType,
    data: b.data ?? { blocks: [] },
  })
  const row = Array.isArray(created) ? created[0] : created
  res.status(201).json({ id: row?.id })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const id = String(req.query.id ?? "")
  if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "`id` is required.")
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const row = await (svc as any).retrieveCmsTemplate(id).catch(() => null)
  if (row && row.tenant_id === tenantId) await (svc as any).deleteCmsTemplates(id)
  res.json({ ok: true })
}

export const GET_ONE = undefined
