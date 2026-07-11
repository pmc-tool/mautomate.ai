import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { requireWriteTenant } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import { publishPageSnapshot } from "../../../../../../modules/cms/publish-helper"
import { assertLocale } from "../../_helpers"
import { getActor } from "../../../settings/_helpers"

/**
 * POST /admin/cms/pages/:id/publish?locale=en   (locale may also be in the body)
 *
 * Compiles the page DRAFT (page meta + enabled sections in rank order, each
 * deep-merged with its locale translation) into ONE immutable cms_snapshot row
 * and promotes it to live for (slug, locale).
 *
 * Compile + validate + publishSnapshot live in the SHARED `publishPageSnapshot`
 * helper (reused verbatim by the `cms-scheduled-publish` job). This handler only
 * adds HTTP concerns: locale resolution, the 422 validation body, the actor
 * audit row, and — via the helper — the `cms.published` domain event that drives
 * storefront on-demand revalidation.
 *
 * Response: { snapshot: { id, version, slug, locale, is_live, published_at }, published: true }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<{ locale?: string; note?: string }>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  const tenantId = await requireWriteTenant(req)

  const rawLocale =
    (req.query.locale as string | undefined) ?? req.body?.locale ?? "en"
  const locale = assertLocale(rawLocale)
  const note = req.body?.note ?? null

  const actor = await getActor(req)

  // Compile + validate + publish + emit cms.published (shared with the job).
  // NOT_FOUND / NOT_ALLOWED surface as MedusaError -> framework HTTP mapping.
  const result = await publishPageSnapshot(req.scope, {
    pageId: id,
    tenant_id: tenantId,
    locale,
    note,
    published_by: actor.user_id,
  })

  if (!result.ok) {
    res.status(422).json({
      type: "invalid_data",
      message: `Cannot publish: ${result.errors.length} block validation error(s). No snapshot was written.`,
      errors: result.errors,
    })
    return
  }

  const { snapshot, page } = result

  // Audit (best-effort, non-blocking — must never roll back the publish).
  try {
    await service.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: actor.user_id,
      actor_email: actor.email,
      action: "page.publish",
      entity_type: "page",
      entity_key: page.id,
      before: null,
      after: {
        snapshot_id: snapshot.id,
        version: snapshot.version,
        slug: page.slug,
        locale,
      },
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] publish audit log write failed (non-blocking):", e)
  }

  res.status(200).json({
    snapshot: {
      id: snapshot.id,
      version: snapshot.version,
      slug: snapshot.slug,
      locale: snapshot.locale,
      is_live: snapshot.is_live,
      published_at: snapshot.published_at,
    },
    published: true,
  })
}
