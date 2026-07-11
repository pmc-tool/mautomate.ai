import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { requireWriteTenant } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import { assertBlockType, one, recordPageAudit } from "../../_helpers"
import { getBlockDefinition } from "../../../../../../modules/cms/registry"

type AddSectionBody = {
  type?: string
  // Optional explicit rank; defaults to end-of-list.
  rank?: number
  // Default-locale (en) block data. The registry's defaultData() is supplied by
  // the admin editor; the API stores whatever it is given (defaults to {}).
  data?: Record<string, unknown>
  enabled?: boolean
  label?: string | null
}

/**
 * POST /admin/cms/pages/:id/sections
 * Append a new section to the page (rank = current max + 1 unless an explicit
 * rank is given). The block `type` is validated against BLOCK_TYPES; `data` is
 * the en payload (the editor passes the registry default).
 *
 * Body: { type, data?, rank?, enabled?, label? }  Response: { section }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AddSectionBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id: pageId } = req.params
  const body = req.body ?? {}

  const type = assertBlockType(body.type)

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

  // Compute the next rank (append to end) unless an explicit rank is provided.
  let rank = body.rank
  if (typeof rank !== "number") {
    const siblings = await service.listCmsSections({
      tenant_id: tenantId,
      page_id: pageId,
    })
    rank = siblings.reduce(
      (max: number, s: any) => Math.max(max, (s.rank ?? 0) + 1),
      0
    )
  }

  // Default to the registry's defaultData() when no data is supplied, so a
  // section added via any caller (admin UI or raw API) starts valid/publishable.
  let data = body.data
  if (data == null) {
    const def = getBlockDefinition(type)
    data = def ? (def.defaultData() as Record<string, unknown>) : {}
  }

  const section = one(
    await service.createCmsSections({
      tenant_id: tenantId,
      page_id: pageId,
      type,
      rank,
      data,
      enabled: body.enabled ?? true,
      label: body.label ?? null,
    })
  )

  await recordPageAudit(req, service, "section.create", "section", section.id, {
    after: section,
  })

  res.status(201).json({ section })
}
