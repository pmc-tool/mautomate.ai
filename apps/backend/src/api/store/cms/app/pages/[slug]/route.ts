import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"
import { cmsTenantId } from "../../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../../modules/cms/service"
import {
  DEFAULT_LOCALE,
  DEFAULT_SETTINGS,
  isLocale,
  resolveSetting,
  SETTING_KEYS,
  type Locale,
  type ResolvedSettings,
} from "../../../../../../modules/cms/types"
import { interpolateTokens } from "../../../../../../modules/cms/interpolate"
import { resolveBrandAccent } from "../../../../../../modules/marketing/brand"

/**
 * GET /store/cms/app/pages/:slug?lang=bn   (SHOPPER MOBILE APP contract, Wave 1)
 *
 * Server-driven-UI endpoint: returns EVERYTHING a native (Flutter) shopper app
 * needs to render one store page in ONE call — the compiled block tree, the
 * store's design tokens (theme), the per-tenant branding, and the store chrome
 * (header/topbar/footer) — all resolved server-side for the tenant + locale.
 *
 * This is ADDITIVE. The existing web consumer keeps using
 * `GET /store/cms/pages/:slug` (unchanged, still returns just `{ page }`). This
 * route composes the SAME live snapshot with the same settings the web
 * storefront already reads, so web and app render byte-identical content.
 *
 * Tenant + sales channel are resolved server-side from the request's publishable
 * key (`x-publishable-api-key`) — NEVER from a client argument. Fail-closed: an
 * unresolved tenant 404s rather than leaking another store's page.
 *
 * Locale: Medusa reserves/strips `?locale=`; read it from `x-medusa-locale`
 * header or the non-reserved `?lang=` / `?locale=` query (mirrors the web route).
 *
 * Response shape (all keys always present):
 *   {
 *     page: {                     // the block tree — feed straight to the renderer
 *       slug, locale, resolved_locale, version,
 *       sections: [ { block_type, schema_version, ...blockProps }, ... ],
 *       seo:  { title, description, keywords, og_image, canonical_url },
 *       meta: { entity_type, entity_id, title, is_home, compiled_at }
 *     },
 *     design: {                   // DESIGN TOKENS (the theme setting, resolved)
 *       colors: { primary, dark, border, text, heading, bg },
 *       fonts:  { body, heading },
 *       logo
 *     },
 *     branding: {                 // per-tenant brand identity
 *       name, logo_url, accent, active_theme
 *     },
 *     chrome: { topbar, header, footer },   // resolved store chrome settings
 *     locale, resolved_locale
 *   }
 */

async function findLiveSnapshot(
  service: CmsModuleService,
  tenantId: string,
  slug: string,
  locale: Locale
) {
  const rows = await service.listCmsSnapshots(
    { tenant_id: tenantId, entity_type: "page", slug, locale, is_live: true },
    { take: 1 }
  )
  return rows?.[0] ?? null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const slug = req.params.slug

  // Pooled multi-tenant: resolve the store from the request (publishable key).
  // Fail-closed — an unresolved tenant 404s rather than leaking another store.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No published page found for slug "${slug}".`
    )
  }

  const requestedRaw =
    (req.headers["x-medusa-locale"] as string) ??
    (req.query.lang as string) ??
    (req.query.locale as string) ??
    DEFAULT_LOCALE
  const requested: Locale = isLocale(requestedRaw)
    ? requestedRaw
    : DEFAULT_LOCALE

  // Requested locale first, then fall back to the default locale (en).
  let snapshot = await findLiveSnapshot(service, tenantId, slug, requested)
  if (!snapshot && requested !== DEFAULT_LOCALE) {
    snapshot = await findLiveSnapshot(service, tenantId, slug, DEFAULT_LOCALE)
  }
  if (!snapshot) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No published page found for slug "${slug}".`
    )
  }

  // Resolve the tenant record once — used for {{store_name}} interpolation,
  // branding (name / logo_url / active_theme) and the accent lookup.
  let tenant: any = null
  try {
    const platform: any = req.scope.resolve(PLATFORM_MODULE)
    tenant = await platform.retrieveTenant(tenantId).catch(() => null)
  } catch {
    tenant = null
  }
  const storeName = String(tenant?.name ?? "").trim()

  // Interpolate {{store_name}} (and any future tokens) so no raw placeholder
  // leaks — identical to the web page route.
  const rawData = (snapshot.data ?? {}) as Record<string, unknown>
  const data = storeName
    ? (interpolateTokens(rawData, { store_name: storeName }) as Record<
        string,
        unknown
      >)
    : rawData

  const page = {
    ...data,
    slug,
    locale: requested,
    resolved_locale: snapshot.locale,
    version: snapshot.version,
  }

  // ---- Store chrome + design tokens: resolve the same settings the web
  // storefront reads (theme = design tokens; header/topbar/footer = chrome).
  const settingRows = await service
    .listCmsSettings({ tenant_id: tenantId })
    .catch(() => [] as any[])
  const byKey = new Map<string, any>()
  for (const row of settingRows ?? []) {
    byKey.set(row.key, row)
  }
  const settings = {} as ResolvedSettings
  for (const key of SETTING_KEYS) {
    settings[key] = resolveSetting(key, byKey.get(key)?.data, requested) as any
  }

  const theme = settings.theme
  // U7 dual-read (explicit null-inherit brand tokens): a tenant that saved
  // its theme settings through the editor stores `null` = "inherit" per token.
  // The app contract has always carried concrete strings (the resolver's
  // legacy defaults), so map null back to the exact default the wire used to
  // carry — the app payload is byte-identical before and after a save.
  const fillTokens = (
    stored: Record<string, string | null> | null | undefined,
    defaults: Record<string, string>
  ): Record<string, string> | null => {
    if (!stored) return null
    const out: Record<string, string> = {}
    for (const k of Object.keys({ ...defaults, ...stored })) {
      out[k] = stored[k] ?? defaults[k] ?? ""
    }
    return out
  }
  const design = {
    colors: fillTokens(
      theme?.colors as unknown as Record<string, string | null> | undefined,
      DEFAULT_SETTINGS.theme.colors as unknown as Record<string, string>
    ),
    fonts: fillTokens(
      theme?.fonts as unknown as Record<string, string | null> | undefined,
      DEFAULT_SETTINGS.theme.fonts as unknown as Record<string, string>
    ),
    logo: theme?.logo ?? null,
  }

  // ---- Per-tenant branding (reuse the exact fields surfaced by /merchant/me
  // and /tenant-config): tenant.meta.logo_url + the durable brand accent.
  const brandAccent =
    (await resolveBrandAccent(req.scope, tenantId).catch(() => "")) || null
  const activeTheme =
    (byKey.get("active_theme")?.data as { value?: string } | undefined)
      ?.value ??
    (typeof tenant?.meta?.active_theme === "string"
      ? tenant.meta.active_theme
      : null) ??
    "learts-liquid"
  const branding = {
    name: storeName || null,
    logo_url:
      typeof tenant?.meta?.logo_url === "string"
        ? tenant.meta.logo_url
        : theme?.logo ?? null,
    accent: brandAccent,
    active_theme: activeTheme,
  }

  res.json({
    page,
    design,
    branding,
    chrome: {
      topbar: settings.topbar,
      header: settings.header,
      footer: settings.footer,
    },
    locale: requested,
    resolved_locale: snapshot.locale,
  })
}
