import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import { assertLocale, one, recordPageAudit } from "../../pages/_helpers"

/**
 * Load a section with its translations and assert it belongs to `tenantId`, or
 * throw NOT_FOUND. Pooled multi-tenant: a section id from another store — or any
 * access without a resolvable tenant — is treated as not-found (fail-closed, no
 * cross-tenant read or mutation).
 */
async function loadSection(
  service: CmsModuleService,
  id: string,
  tenantId: string | null
) {
  let section: any
  try {
    section = await service.retrieveCmsSection(id, {
      relations: ["translations"],
    })
  } catch {
    section = null
  }
  if (!section || !tenantId || (section.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Section with id "${id}" was not found.`
    )
  }
  return section
}

/**
 * GET /admin/cms/sections/:id
 * Retrieve one section + its translation rows. Response: { section }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const tenantId = await cmsTenantId(req)
  const section = await loadSection(service, req.params.id, tenantId)
  res.json({ section })
}

type UpdateBody = {
  // Default-locale (en) block data — replaces section.data wholesale.
  data?: Record<string, unknown>
  enabled?: boolean
  label?: string | null
  // Per-locale sparse overrides: { bn: { heading?, ... } }.
  translations?: Record<string, Record<string, unknown>>
}

/**
 * Upsert section translation rows for non-default locales. The default locale
 * (en) lives in section.data and is rejected here.
 */
async function upsertSectionTranslations(
  service: CmsModuleService,
  sectionId: string,
  translations: Record<string, Record<string, unknown>>
) {
  for (const [rawLocale, data] of Object.entries(translations)) {
    const locale = assertLocale(rawLocale)
    if (locale === "en") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The default locale (en) is edited in section.data, not as a translation."
      )
    }
    const existing = (
      await service.listCmsSectionTranslations({
        section_id: sectionId,
        locale,
      })
    )?.[0]

    if (existing) {
      await service.updateCmsSectionTranslations({
        id: existing.id,
        data: data ?? {},
      })
    } else {
      await service.createCmsSectionTranslations({
        section_id: sectionId,
        locale,
        data: data ?? {},
      })
    }
  }
}

/**
 * PUT /admin/cms/sections/:id
 * Update a section's en data / enabled / label and/or per-locale translation
 * overrides. `type` and `rank` are NOT editable here (type is fixed at create;
 * rank is set via the reorder route). Response: { section }
 */
const update = async (
  req: AuthenticatedMedusaRequest<UpdateBody>,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const body = req.body ?? {}

  // Pooled multi-tenant: writes require a trusted store identity + ownership.
  const tenantId = await requireWriteTenant(req)
  const before = await loadSection(service, id, tenantId)

  const patch: Record<string, unknown> = { id }
  if ("data" in body) {
    patch.data = body.data ?? {}
  }
  if ("enabled" in body) {
    patch.enabled = body.enabled
  }
  if ("label" in body) {
    patch.label = body.label ?? null
  }

  if (Object.keys(patch).length > 1) {
    await service.updateCmsSections(patch)
  }

  if (body.translations && typeof body.translations === "object") {
    await upsertSectionTranslations(service, id, body.translations)
  }

  const section = await loadSection(service, id, tenantId)

  await recordPageAudit(req, service, "section.update", "section", id, {
    before,
    after: section,
  })

  res.json({ section })
}

export const PUT = update
export const PATCH = update

/**
 * DELETE /admin/cms/sections/:id
 * Soft-delete the section and its translation rows. Response:
 * { id, object: "section", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params

  // Pooled multi-tenant: writes require a trusted store identity + ownership.
  const tenantId = await requireWriteTenant(req)
  const before = await loadSection(service, id, tenantId)

  // Soft-delete translation rows first (keyed off the stable section_id), then
  // the section itself.
  const translationIds = (before.translations ?? [])
    .map((t: any) => t.id)
    .filter(Boolean)
  if (translationIds.length) {
    await service.softDeleteCmsSectionTranslations(translationIds)
  }
  await service.softDeleteCmsSections(id)

  await recordPageAudit(req, service, "section.delete", "section", id, {
    before,
  })

  res.json({ id, object: "section", deleted: true })
}
