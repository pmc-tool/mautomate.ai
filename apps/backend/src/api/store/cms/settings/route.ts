import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CMS_MODULE } from "../../../../modules/cms"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../modules/cms/service"
import {
  DEFAULT_LOCALE,
  isLocale,
  resolveSetting,
  SETTING_KEYS,
  type Locale,
  type ResolvedSettings,
} from "../../../../modules/cms/types"

/**
 * GET /store/cms/settings?locale=bn
 *
 * Public (reachable with the publishable key like any other /store route).
 * Returns all 5 global singletons with their locale-maps RESOLVED to the
 * requested locale (per-field fallback: defaults -> en -> requested locale).
 *
 * If a singleton row is missing the inline DEFAULT_SETTINGS is used, so this
 * endpoint never 500s and the storefront chrome always renders.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)

  // NOTE: Medusa reserves the `locale` query param (consumed by its built-in
  // i18n and stripped before reaching handlers). Read the locale from the
  // `x-medusa-locale` header (the storefront SDK sends it) and the non-reserved
  // `lang` query param instead.
  const requested =
    (req.headers["x-medusa-locale"] as string) ??
    (req.query.lang as string) ??
    (req.query.locale as string) ??
    DEFAULT_LOCALE
  const locale: Locale = isLocale(requested) ? requested : DEFAULT_LOCALE
  const resolvedLocale: Locale = locale

  const tenantId = await cmsTenantId(req)
  const rows = tenantId
    ? await service.listCmsSettings({ tenant_id: tenantId })
    : []
  const byKey = new Map<string, any>()
  for (const row of rows ?? []) {
    byKey.set(row.key, row)
  }

  const settings = {} as ResolvedSettings
  for (const key of SETTING_KEYS) {
    const row = byKey.get(key)
    settings[key] = resolveSetting(key, row?.data, locale) as any
  }

  // active_theme is a locale-invariant global string (its own setting row),
  // not one of the per-locale SETTING_KEYS. Default to "learts" when unset.
  const activeThemeRow = byKey.get("active_theme")
  ;(settings as any).active_theme =
    (activeThemeRow?.data as { value?: string } | undefined)?.value ?? "learts-liquid"

  res.json({
    settings,
    locale,
    resolved_locale: resolvedLocale,
  })
}
