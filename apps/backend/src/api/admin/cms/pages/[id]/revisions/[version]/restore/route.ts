import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../../../modules/cms"
import { requireWriteTenant } from "../../../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../../../modules/cms/service"
import { emitCmsPublished } from "../../../../../../../../modules/cms/publish-helper"
import { assertLocale } from "../../../../_helpers"
import { getActor } from "../../../../../settings/_helpers"

/**
 * POST /admin/cms/pages/:id/revisions/:version/restore?locale=en|bn
 *
 * ROLL BACK to a previously published revision. The history is append-only, so
 * restore does NOT mutate or delete any existing snapshot and does NOT touch the
 * DRAFT sections: it republishes the chosen version's already-compiled `data` as
 * a BRAND NEW live snapshot (version max+1), demoting the prior live row. The
 * restored copy therefore appears at the top of the history with its own version
 * number, and the original version it was copied from stays untouched below it.
 *
 * Pipeline:
 *   1. resolve page slug from id (404 if page missing),
 *   2. load the chosen snapshot by (entity_type="page", slug, locale, version)
 *      — 404 if that version is absent for this page+locale,
 *   3. service.publishSnapshot({ ..., data: chosen.data }) CONTEXT-FREE — bumps
 *      version, demotes prior live, inserts the new is_live row,
 *   4. write a "page.restore" audit row { from_version, new_version }
 *      (best-effort, non-blocking),
 *   5. emit cms.published so the storefront revalidates (best-effort).
 *
 * Response: { restored: true, from_version, snapshot: { id, version, slug,
 *   locale, is_live, published_at } }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<{ locale?: string }>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id, version: versionParam } = req.params

  const tenantId = await requireWriteTenant(req)

  const locale = assertLocale(
    (req.query.locale as string | undefined) ?? req.body?.locale ?? "en"
  )

  const fromVersion = Number(versionParam)
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid revision version "${versionParam}". Expected a positive integer.`
    )
  }

  const actor = await getActor(req)

  // 1. Resolve the page slug from its id (404 if the page does not exist).
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

  // 2. Load the chosen snapshot (404 if that version is absent for page+locale).
  const matches = (await service.listCmsSnapshots({
    tenant_id: tenantId,
    entity_type: "page",
    slug: page.slug,
    locale,
    version: fromVersion,
  })) as any[]

  const chosen = matches?.[0]
  if (!chosen) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Revision v${fromVersion} (locale "${locale}") was not found for page "${page.slug}".`
    )
  }

  // 3. Republish the chosen version's compiled payload as a NEW live snapshot.
  //    publishSnapshot MUST be invoked CONTEXT-FREE (no MedusaContext) — passing
  //    a shared transaction makes the demote invisible to the new row's
  //    partial-unique `WHERE is_live=true` index check (known gotcha).
  const snapshot: any = await service.publishSnapshot({
    tenant_id: tenantId,
    entity_type: "page",
    entity_id: page.id,
    slug: page.slug,
    locale,
    data: chosen.data,
    published_by: actor.user_id,
    note: `restore of v${fromVersion}`,
  })

  // 4. Audit (best-effort, non-blocking — must never roll back the restore).
  try {
    await service.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: actor.user_id,
      actor_email: actor.email,
      action: "page.restore",
      entity_type: "page",
      entity_key: page.id,
      before: { version: fromVersion },
      after: {
        from_version: fromVersion,
        new_version: snapshot.version,
        snapshot_id: snapshot.id,
        slug: page.slug,
        locale,
      },
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] restore audit log write failed (non-blocking):", e)
  }

  // 5. Emit cms.published so the storefront revalidates (best-effort).
  await emitCmsPublished(req.scope, {
    entity_type: "page",
    slug: page.slug,
    locale,
    tenant_id: tenantId,
  })

  res.status(200).json({
    restored: true,
    from_version: fromVersion,
    snapshot: {
      id: snapshot.id,
      version: snapshot.version,
      slug: snapshot.slug,
      locale: snapshot.locale,
      is_live: snapshot.is_live,
      published_at: snapshot.published_at,
    },
  })
}
