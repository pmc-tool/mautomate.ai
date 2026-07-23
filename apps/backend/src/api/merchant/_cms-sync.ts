import { CMS_MODULE } from "../../modules/cms"
import { emitCmsPublished } from "../../modules/cms/publish-helper"

/**
 * Mirror setup-wizard branding into the CMS settings the STOREFRONT actually
 * renders.
 *
 * The wizard writes the logo to tenant.meta.logo_url (for the setup checklist)
 * and the currency to the tenant's region + meta (for checkout). But the Liquid
 * storefront chrome reads neither of those — it reads the per-tenant CMS
 * `header`/`theme` settings for the logo. So a logo saved in the wizard never
 * appeared on the store. This syncs the logo into those settings (every present
 * locale) and emits `cms.published` so the storefront's cached settings are
 * revalidated immediately. Best-effort — never blocks the wizard write.
 */
export async function syncStoreLogoToCms(
  scope: any,
  tenantId: string,
  logoUrl: string
): Promise<void> {
  if (!logoUrl) return
  try {
    const service: any = scope.resolve(CMS_MODULE)
    for (const key of ["header", "theme"] as const) {
      const rows = await service
        .listCmsSettings({ key, tenant_id: tenantId })
        .catch(() => [])
      const existing = rows?.[0]
      const data = (existing?.data ?? {}) as Record<string, any>
      const locales = Object.keys(data).length ? Object.keys(data) : ["en"]
      const next: Record<string, any> = { ...data }
      for (const loc of locales) {
        next[loc] = { ...(next[loc] ?? {}), logo: logoUrl }
      }
      if (!next.en) next.en = { logo: logoUrl }

      if (existing) {
        await service.updateCmsSettings({ id: existing.id, data: next })
      } else {
        await service.createCmsSettings({ key, data: next, tenant_id: tenantId })
      }
    }
    // Bust the storefront's cached settings so the new logo shows immediately.
    await emitCmsPublished(scope, {
      entity_type: "global",
      slug: "header",
      locale: null,
      tenant_id: tenantId,
    }).catch(() => {})
    await emitCmsPublished(scope, {
      entity_type: "global",
      slug: "theme",
      locale: null,
      tenant_id: tenantId,
    }).catch(() => {})
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[setup] logo CMS sync failed (non-blocking):", e?.message ?? e)
  }
}
