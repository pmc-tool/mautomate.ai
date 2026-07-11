import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../modules/cms"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../modules/cms/service"
import { SETTING_KEYS } from "../../../../modules/cms/types"

/**
 * GET /admin/cms/settings
 * Returns all 5 singleton rows as RAW locale-maps (admin edits the unresolved
 * { en, bn } shape). Missing singletons are returned as `null` so the admin UI
 * can show "not yet created" without a separate call.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const tenantId = await cmsTenantId(req)
  const rows = tenantId
    ? await service.listCmsSettings({ tenant_id: tenantId })
    : []
  const byKey = new Map<string, any>()
  for (const row of rows ?? []) {
    byKey.set(row.key, row)
  }

  const settings = SETTING_KEYS.map((key) => byKey.get(key) ?? null)

  res.json({
    settings,
    keys: SETTING_KEYS,
    count: settings.filter(Boolean).length,
  })
}
