import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"
import { isLocale, DEFAULT_LOCALE, type Locale } from "../../../modules/cms/types"

/**
 * /cms/visual-autosave  (secret-gated, server-to-server) — Phase 1 draft buffer.
 *
 *   POST   { slug, locale, data }  -> upsert the (tenant,slug,locale) draft
 *   GET    ?slug=&lang=            -> { draft: { data, updated_at } | null }
 *   DELETE ?slug=&lang=            -> clear the draft
 *
 * Same auth + tenant model as /cms/visual-publish (x-cms-secret + x-tenant-pak).
 * Autosave NEVER touches the live snapshot — a merchant's in-progress work is
 * saved here and survives crashes / failed publishes.
 */
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
const localeOf = (v: unknown): Locale => (isLocale(v) ? v : DEFAULT_LOCALE)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const body = (req.body ?? {}) as { slug?: string; locale?: string; data?: unknown }
  const slug = body.slug
  if (!slug || typeof slug !== "string") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`slug` is required.")
  }
  const locale = localeOf(body.locale)
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const existing = (await (svc as any).listCmsPageDrafts({ tenant_id: tenantId, slug, locale }, { take: 1 }))?.[0]
  if (existing) {
    await (svc as any).updateCmsPageDrafts({ id: existing.id, data: body.data ?? {} })
  } else {
    await (svc as any).createCmsPageDrafts({ tenant_id: tenantId, slug, locale, data: body.data ?? {} })
  }
  res.json({ ok: true, savedAt: new Date().toISOString() })
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const slug = String(req.query.slug ?? "")
  if (!slug) throw new MedusaError(MedusaError.Types.INVALID_DATA, "`slug` is required.")
  const locale = localeOf(req.query.lang)
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const draft = (await (svc as any).listCmsPageDrafts({ tenant_id: tenantId, slug, locale }, { take: 1 }))?.[0]
  res.json({ draft: draft ? { data: draft.data, updated_at: draft.updated_at } : null })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const slug = String(req.query.slug ?? "")
  if (!slug) throw new MedusaError(MedusaError.Types.INVALID_DATA, "`slug` is required.")
  const locale = localeOf(req.query.lang)
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const draft = (await (svc as any).listCmsPageDrafts({ tenant_id: tenantId, slug, locale }, { take: 1 }))?.[0]
  if (draft) await (svc as any).deleteCmsPageDrafts(draft.id)
  res.json({ ok: true })
}
