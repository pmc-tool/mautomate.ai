import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../../modules/cms"
import { requireWriteTenant } from "../../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../../modules/cms/service"
import { recordPageAudit, sortByRank } from "../../../_helpers"

type ReorderBody = {
  // Section ids in their new top-to-bottom order.
  orderedIds?: string[]
  // Alias accepted for the doc's `{ order: [...] }` shape.
  order?: string[]
}

/**
 * POST /admin/cms/pages/:id/sections/reorder
 * Set each section's `rank` to its index in `orderedIds`. The list must be a
 * permutation of exactly the page's current section ids (reorder is
 * locale-invariant structure — it affects every locale). Response: { sections }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<ReorderBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id: pageId } = req.params
  const body = req.body ?? {}

  // Pooled multi-tenant: writes require a trusted store identity. Fail-closed.
  const tenantId = await requireWriteTenant(req)

  // Ensure the page exists AND belongs to this store (fail-closed 404 otherwise).
  let page: any
  try {
    page = await service.retrieveCmsPage(pageId)
  } catch {
    page = null
  }
  if (!page || (page.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Page with id "${pageId}" was not found.`
    )
  }

  const orderedIds = body.orderedIds ?? body.order
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`orderedIds` must be a non-empty array of section ids."
    )
  }

  // Only this store's sections for the page — a cross-tenant id can never be in
  // the permutation set, so it can never be reranked.
  const current = await service.listCmsSections({
    tenant_id: tenantId,
    page_id: pageId,
  })
  const currentIds = new Set(current.map((s: any) => s.id))

  // Must be a permutation of the page's sections — no missing/extra/duplicate.
  const incoming = new Set(orderedIds)
  if (
    incoming.size !== orderedIds.length ||
    incoming.size !== currentIds.size ||
    orderedIds.some((sid) => !currentIds.has(sid))
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`orderedIds` must be a permutation of the page's current section ids."
    )
  }

  // Persist new ranks (index = rank).
  await Promise.all(
    orderedIds.map((sid, index) =>
      service.updateCmsSections({ id: sid, rank: index })
    )
  )

  const sections = sortByRank(
    await service.listCmsSections({ tenant_id: tenantId, page_id: pageId })
  )

  await recordPageAudit(req, service, "section.reorder", "page", pageId, {
    before: current.map((s: any) => ({ id: s.id, rank: s.rank })),
    after: orderedIds.map((id, rank) => ({ id, rank })),
  })

  res.json({ sections })
}
