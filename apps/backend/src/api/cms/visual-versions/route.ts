import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"
import { isLocale, DEFAULT_LOCALE, type Locale } from "../../../modules/cms/types"

/**
 * /cms/visual-versions  (secret-gated) — Phase 2 revision history.
 *
 *   GET ?slug=&lang=            -> { versions: [{version, is_live, published_by, created_at}] }
 *   GET ?slug=&lang=&version=N  -> { version: N, sections: [...] }   (for Preview / Restore)
 *
 * Reads the immutable, already-versioned cms_snapshot rows for (tenant, page,
 * slug, locale). Newest first. `sections` are the compiled blocks in the exact
 * shape the editor loads, so the storefront can Preview or Restore any version.
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

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  checkSecret(req)
  const slug = String(req.query.slug ?? "")
  if (!slug) throw new MedusaError(MedusaError.Types.INVALID_DATA, "`slug` is required.")
  const locale = localeOf(req.query.lang)
  const tenantId = await requireWriteTenant(req)
  const svc: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const rows = (await (svc as any).listCmsSnapshots(
    { tenant_id: tenantId, entity_type: "page", slug, locale },
    { take: 50, order: { version: "DESC" } }
  )) as any[]

  const wanted = req.query.version ? Number(req.query.version) : null
  if (wanted != null && Number.isFinite(wanted)) {
    const row = rows.find((r) => r.version === wanted)
    if (!row) throw new MedusaError(MedusaError.Types.NOT_FOUND, "version not found")
    const sections = Array.isArray((row.data as any)?.sections) ? (row.data as any).sections : []
    return res.json({ version: row.version, sections })
  }

  res.json({
    versions: rows.map((r) => ({
      version: r.version,
      is_live: !!r.is_live,
      published_by: r.published_by ?? null,
      created_at: r.created_at,
    })),
  })
}
