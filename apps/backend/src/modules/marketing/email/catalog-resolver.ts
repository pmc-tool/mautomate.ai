/**
 * email/catalog-resolver — turn a catalog key + tokens into a ready-to-send
 * email for a specific tenant.
 *
 * Resolution: a per-tenant override row in `marketing_email_template`
 * (keyed by tenant_id + key) wins; otherwise the code default from the catalog.
 * Either way the body is wrapped in the shared branded layout, and {{tokens}}
 * are filled. `store_name` / `store_url` are always injected from the tenant's
 * brand settings, so every email is on-brand even if the merchant never edits it.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from ".."
import { PLATFORM_MODULE } from "../../platform"
import { resolveBrandAccent, resolveBrandName, resolveStoreUrl } from "../brand"
import { EMAIL_CATALOG, getCatalogTemplate } from "./catalog"
import { renderHandlebars } from "./templates"
import { renderEmailLayout } from "./templates/layout"

/**
 * The authoritative per-shop brand for emails. The tenant record's own name +
 * subdomain are the source of truth (so shop A's email never says shop B's or a
 * global env name); the marketing brand settings are only a fallback.
 */
const resolveTenantBrand = async (
  container: MedusaContainer,
  tenantId: string
): Promise<{ brandName: string; storeUrl: string }> => {
  let tenant: any = null
  try {
    const platform: any = container.resolve(PLATFORM_MODULE)
    tenant = await platform.retrieveTenant(tenantId).catch(() => null)
  } catch {
    tenant = null
  }
  const brandName =
    (typeof tenant?.name === "string" && tenant.name.trim()) ||
    (await resolveBrandName(container, tenantId))
  const storeUrl =
    (typeof tenant?.slug === "string" && tenant.slug.trim()
      ? `https://${tenant.slug.trim()}.mautomate.ai`
      : null) || (await resolveStoreUrl(container, tenantId))
  return { brandName, storeUrl: storeUrl.replace(/\/+$/, "") }
}

/** A tenant's saved override for a catalog key (subset of the model row). */
type OverrideRow = {
  id: string
  subject: string | null
  html: string | null
  meta: Record<string, unknown> | null
}

/** Find the tenant's override row for a catalog key, if any. */
export const getOverride = async (
  container: MedusaContainer,
  tenantId: string,
  key: string
): Promise<OverrideRow | null> => {
  const svc: any = container.resolve(MARKETING_MODULE)
  const rows = await svc
    .listMarketingEmailTemplates(
      { tenant_id: tenantId, key },
      { take: 1, order: { created_at: "DESC" } }
    )
    .catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

/** True unless the override explicitly disabled this email. */
const isEnabled = (row: OverrideRow | null): boolean =>
  !row || (row.meta as any)?.enabled !== false

export type ResolvedEmail = {
  subject: string
  html: string
  /** False when the merchant switched this email off. */
  enabled: boolean
  source: "override" | "default"
}

/**
 * Resolve a catalog email for a tenant, fully rendered. Returns null if `key`
 * is not a known catalog template.
 */
export const resolveCatalogEmail = async (
  container: MedusaContainer,
  tenantId: string,
  key: string,
  tokens: Record<string, unknown> = {}
): Promise<ResolvedEmail | null> => {
  const tpl = getCatalogTemplate(key)
  if (!tpl) return null

  const [{ brandName, storeUrl }, accent, override] = await Promise.all([
    resolveTenantBrand(container, tenantId),
    resolveBrandAccent(container, tenantId),
    getOverride(container, tenantId, key),
  ])

  const ctx: Record<string, unknown> = {
    store_name: brandName,
    store_url: storeUrl,
    order_url: `${storeUrl}/account/orders`,
    ...tokens,
  }

  const rawSubject = override?.subject?.trim() || tpl.defaultSubject
  const rawBody = override?.html?.trim() || tpl.defaultBody

  const subject = renderHandlebars(rawSubject, ctx)
  const bodyHtml = renderHandlebars(rawBody, ctx)

  const ctaUrl = tpl.cta ? renderHandlebars(tpl.cta.url, ctx) : undefined
  const html = renderEmailLayout({
    brandName,
    accent: accent || undefined,
    preheader: subject,
    heading: tpl.defaultHeading,
    bodyHtml,
    // Only render the CTA when its URL actually resolved to something.
    ctaText: ctaUrl ? tpl.cta?.text : undefined,
    ctaUrl: ctaUrl || undefined,
  })

  return {
    subject,
    html,
    enabled: isEnabled(override),
    source: override ? "override" : "default",
  }
}

/**
 * Per-tenant status of every catalog template — for the dashboard list. Marks
 * which are customized and which are switched off.
 */
export const getCatalogStatus = async (
  container: MedusaContainer,
  tenantId: string
): Promise<
  {
    key: string
    title: string
    description: string
    category: string
    trigger: string | null
    customized: boolean
    enabled: boolean
  }[]
> => {
  const svc: any = container.resolve(MARKETING_MODULE)
  const rows: any[] = await svc
    .listMarketingEmailTemplates({ tenant_id: tenantId }, { take: 500 })
    .catch(() => [])
  const byKey = new Map<string, any>()
  for (const r of rows) {
    if (r.key) byKey.set(r.key, r)
  }

  return EMAIL_CATALOG.map((t) => {
    const row = byKey.get(t.key)
    return {
      key: t.key,
      title: t.title,
      description: t.description,
      category: t.category,
      trigger: t.trigger,
      customized: !!row,
      enabled: !row || (row.meta as any)?.enabled !== false,
    }
  })
}
