import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../modules/cms"
import {
  cmsTenantId,
  requireWriteTenant,
} from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import {
  DEFAULT_SETTINGS,
  type LocaleMap,
  type SettingDataMap,
} from "../../../../../modules/cms/types"
import {
  assertSettingKey,
  findSetting,
  upsertSettingWithAudit,
} from "../_helpers"

type SettingBody<K extends keyof SettingDataMap = keyof SettingDataMap> = {
  // The full locale-map ({ en, bn? }) OR a bare `en` object (auto-wrapped).
  data?: LocaleMap<SettingDataMap[K]> | SettingDataMap[K]
}

/**
 * GET /admin/cms/settings/:key
 * Returns the RAW locale-map for one singleton. If the row does not exist yet,
 * returns a seeded default wrapped as { en: DEFAULT_SETTINGS[key] } and
 * `exists:false` so the editor can start from sensible values.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const key = assertSettingKey(req.params.key)
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const tenantId = await cmsTenantId(req)
  const existing = await findSetting(service, key, tenantId)

  if (existing) {
    res.json({ setting: existing, exists: true })
    return
  }

  res.json({
    setting: {
      key,
      data: { en: DEFAULT_SETTINGS[key] } as LocaleMap<SettingDataMap[typeof key]>,
      published_at: null,
    },
    exists: false,
  })
}

/**
 * Normalize an incoming body into a stored locale-map. Accepts either a full
 * { en, bn? } map or a bare default-locale object (auto-wrapped as { en }).
 */
function normalizeData(
  key: keyof SettingDataMap,
  raw: unknown
): LocaleMap<SettingDataMap[typeof key]> {
  if (raw === undefined || raw === null || typeof raw !== "object") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`data` is required and must be an object."
    )
  }
  const obj = raw as Record<string, unknown>
  // Already a locale-map if it has an `en` key whose value is an object.
  if (obj.en && typeof obj.en === "object") {
    return obj as unknown as LocaleMap<SettingDataMap[typeof key]>
  }
  // Otherwise treat the whole object as the default-locale (en) slice.
  return { en: obj } as unknown as LocaleMap<SettingDataMap[typeof key]>
}

const upsert = async (
  req: AuthenticatedMedusaRequest<SettingBody>,
  res: MedusaResponse
) => {
  const key = assertSettingKey(req.params.key)
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  const tenantId = await requireWriteTenant(req)

  const nextData = normalizeData(key, req.body?.data)

  const setting = await upsertSettingWithAudit(
    req,
    service,
    key,
    nextData,
    tenantId
  )

  res.status(200).json({ setting })
}

/**
 * POST /admin/cms/settings/:key — upsert the singleton draft (locale-map).
 * Writes a cms_audit_log row. (Publish is a later phase.)
 */
export const POST = upsert

/**
 * PUT /admin/cms/settings/:key — alias of POST (idempotent upsert).
 */
export const PUT = upsert
