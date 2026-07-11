import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../modules/cms"
import { cmsTenantId } from "../../../../../modules/cms/tenant-scope"
import type CmsModuleService from "../../../../../modules/cms/service"
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from "../../../../../modules/cms/types"

/**
 * GET /store/cms/pages/:slug?locale=bn
 *
 * Public (reachable with the publishable key like any other /store route).
 * Serves the live published snapshot for (slug, locale) — the O(1) hot path:
 * exactly one `is_live=true` row per (entity_type, slug, locale), enforced by a
 * partial-unique index.
 *
 * Fallback chain (phase-0-architecture.md §5.3): requested locale → en → 404.
 * `page.locale` echoes the requested locale; `page.resolved_locale` is the
 * locale actually served (differs when fallback occurred), so the storefront can
 * set <html lang> / hreflang and show a "showing English" notice.
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

  // Pooled multi-tenant: resolve the store from the request. Fail-closed — an
  // unresolved tenant returns 404 rather than another store's published page.
  const tenantId = await cmsTenantId(req)
  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No published page found for slug "${slug}".`
    )
  }

  // Medusa reserves & strips the `locale` query param — read the locale from the
  // `x-medusa-locale` header (sent by the storefront SDK) and the `lang` param.
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

  // The compiled payload IS the page body; echo the requested locale and report
  // the locale actually served so the client can detect a fallback.
  const data = (snapshot.data ?? {}) as Record<string, unknown>
  const page = {
    ...data,
    slug,
    locale: requested,
    resolved_locale: snapshot.locale,
    version: snapshot.version,
  }

  res.json({ page })
}
