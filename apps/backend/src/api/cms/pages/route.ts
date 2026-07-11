import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../modules/cms"
import { cmsTenantId } from "../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../modules/cms/service"

/**
 * GET /cms/pages   (secret-gated, server-to-server)
 *
 * Lists CMS pages (slug + title + is_home) for the visual editor's page
 * switcher. Authenticated with x-cms-secret like the other visual endpoints.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // Pooled multi-tenant: only list the store's own pages. Fail-closed empty.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    res.json({ pages: [] })
    return
  }

  const rows = (await service.listCmsPages({ tenant_id: tenantId })) ?? []
  const pages = (rows as any[])
    .map((p) => ({ slug: p.slug, title: p.title ?? p.slug, is_home: !!p.is_home }))
    .sort((a, b) => (a.is_home ? -1 : 0) - (b.is_home ? -1 : 0) || a.slug.localeCompare(b.slug))

  res.json({ pages })
}
