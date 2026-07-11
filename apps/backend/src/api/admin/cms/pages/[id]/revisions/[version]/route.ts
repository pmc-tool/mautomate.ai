import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../../modules/cms"
import { cmsTenantId } from "../../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../../modules/cms/service"
import { assertLocale } from "../../../_helpers"

/**
 * GET /admin/cms/pages/:id/revisions/:version?locale=en|bn
 *
 * Returns ONE revision in full — including the compiled, locale-resolved `data`
 * payload (the same shape the storefront read returns) — for view / diff in the
 * admin History panel.
 *
 * `version` is the monotonic snapshot version (not the snapshot id). The page
 * slug is resolved from the route id, then the single snapshot matching
 * (entity_type="page", slug, locale, version) is loaded. 404 when the page does
 * not exist OR no snapshot exists at that version for this page+locale.
 *
 * Response: { revision: { id, version, is_live, slug, locale, data,
 *   published_at, published_by, note } }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id, version: versionParam } = req.params
  const locale = assertLocale((req.query.locale as string | undefined) ?? "en")

  const version = Number(versionParam)
  if (!Number.isInteger(version) || version < 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid revision version "${versionParam}". Expected a positive integer.`
    )
  }

  // Pooled multi-tenant: scope to the acting store. Fail-closed — an unresolved
  // tenant sees nothing, never another store's compiled snapshot payload.
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

  const matches = (await service.listCmsSnapshots({
    tenant_id: tenantId,
    entity_type: "page",
    slug: page.slug,
    locale,
    version,
  })) as any[]

  const snapshot = matches?.[0]
  if (!snapshot) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Revision v${version} (locale "${locale}") was not found for page "${page.slug}".`
    )
  }

  res.status(200).json({
    revision: {
      id: snapshot.id,
      version: snapshot.version,
      is_live: snapshot.is_live,
      slug: snapshot.slug,
      locale: snapshot.locale,
      data: snapshot.data,
      published_at: snapshot.published_at,
      published_by: snapshot.published_by,
      note: snapshot.note,
    },
  })
}
