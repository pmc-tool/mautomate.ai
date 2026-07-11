import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { cmsTenantId } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import { assertLocale } from "../../_helpers"

/**
 * GET /admin/cms/pages/:id/revisions?locale=en|bn
 *
 * Lists the revision history for a page in one locale. Because every publish
 * writes an immutable, monotonically-versioned cms_snapshot row, the version
 * chain for (entity_type="page", slug, locale) IS the revision history — no
 * separate revisions table exists (phase-0-architecture.md §5.2).
 *
 * The page slug is resolved from the route id, then the snapshots for that
 * (page slug, locale) are returned ordered by version DESC. The heavy `data`
 * payload is intentionally omitted here — this is a cheap list; fetch a single
 * version (GET .../revisions/:version) to inspect its compiled `data`.
 *
 * Response: { page_id, slug, locale, count,
 *   revisions: [{ id, version, is_live, published_at, published_by, note }] }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const locale = assertLocale((req.query.locale as string | undefined) ?? "en")

  // Pooled multi-tenant: scope to the acting store. Fail-closed — an unresolved
  // tenant sees nothing, never another store's revision history.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${id}" was not found.`
    )
  }

  // Resolve the page slug from its id, asserting store ownership (404 otherwise).
  let page: any
  try {
    page = await service.retrieveCmsPage(id)
  } catch {
    page = null
  }
  if (!page || (page.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${id}" was not found.`
    )
  }

  const snapshots = (await service.listCmsSnapshots({
    tenant_id: tenantId,
    entity_type: "page",
    slug: page.slug,
    locale,
  })) as any[]

  const revisions = snapshots
    .map((s) => ({
      id: s.id,
      version: s.version,
      is_live: s.is_live,
      published_at: s.published_at,
      published_by: s.published_by,
      note: s.note,
    }))
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))

  res.status(200).json({
    page_id: page.id,
    slug: page.slug,
    locale,
    count: revisions.length,
    revisions,
  })
}
