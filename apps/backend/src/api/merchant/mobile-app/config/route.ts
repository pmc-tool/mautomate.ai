import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { resolveBrandAccent } from "../../../../modules/marketing/brand"
import { bundleIdForSlug, isHexColor } from "../../../../modules/platform/mobile-app/prices"

/**
 * GET/POST/PUT /merchant/mobile-app/config
 *
 * The tenant's white-label shopper-app branding. Persisted on
 * `tenant.meta.app_config` (one config per store), tenant-scoped and
 * fail-closed via resolveMerchant. The bundle ids are IDENTITY-CRITICAL and are
 * always derived server-side from the immutable slug — never accepted from the
 * client. The icon is uploaded via the existing POST /merchant/setup/logo (or
 * any media upload); this route only stores the resulting URL.
 */

type AppConfig = {
  app_name: string
  icon_url: string | null
  accent_color: string | null
  android_bundle_id: string
  ios_bundle_id: string
  status: string
}

/**
 * The merchant's REAL store branding — the single source of truth reused here
 * so an un-customised app inherits the STORE's own identity, never the
 * mAutomate platform's. These are the exact same per-tenant sources the
 * dashboard chrome (GET /merchant/me) and the storefront/tenant-config resolve:
 *   name   -> tenant.name           (store name; sidebar + storefront header)
 *   logo   -> tenant.meta.logo_url  (store logo; storefront chrome renders it)
 *   accent -> resolveBrandAccent()  (per-tenant brand accent; marketing settings)
 *
 * CRITICAL: the logo default is the store's own logo or null when unset — it is
 * NEVER the mAutomate platform logo/wordmark. A store with no logo returns null
 * so the UI shows a neutral placeholder, not a platform asset.
 */
async function resolveStoreBrand(
  scope: any,
  tenant: any
): Promise<{ name: string | null; logo_url: string | null; accent_color: string | null }> {
  const name = String(tenant.name ?? "").trim() || null
  const logoRaw = ((tenant.meta ?? {}) as any).logo_url
  const logo_url =
    typeof logoRaw === "string" && logoRaw.trim() ? logoRaw.trim() : null
  const accent_color =
    (await resolveBrandAccent(scope, tenant.id).catch(() => "")) || null
  return { name, logo_url, accent_color }
}

/** Latest build order for this tenant (for status + a ready download url). */
async function latestBuild(platform: any, tenantId: string) {
  const rows = await platform
    .listMobileAppOrders(
      { tenant_id: tenantId, kind: "build" },
      { take: 1, order: { created_at: "DESC" } }
    )
    .catch(() => [])
  return rows?.[0] ?? null
}

/**
 * Derive the config's display status from stored state:
 *   draft           no app name yet
 *   built           a build artifact is ready to download
 *   build_requested a build has been requested (not yet ready)
 *   configured      branding saved, no build requested
 */
async function deriveStatus(platform: any, tenantId: string, appName?: string): Promise<string> {
  if (!appName) return "draft"
  const build = await latestBuild(platform, tenantId)
  if (build?.download_url) return "built"
  if (build) return "build_requested"
  return "configured"
}

function readConfig(tenant: any): Partial<AppConfig> {
  return ((tenant.meta ?? {}) as any).app_config ?? {}
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  const stored = readConfig(ctx.tenant)
  const bundleId = bundleIdForSlug(ctx.tenant.slug)
  const build = await latestBuild(platform, ctx.tenant.id)

  // Defaults mirror the merchant's own store branding (see resolveStoreBrand);
  // a saved override in tenant.meta.app_config always wins over the default.
  const brand = await resolveStoreBrand(req.scope, ctx.tenant)

  const config: AppConfig = {
    app_name: stored.app_name ?? brand.name ?? "",
    icon_url: stored.icon_url ?? brand.logo_url,
    accent_color: stored.accent_color ?? brand.accent_color,
    android_bundle_id: bundleId,
    ios_bundle_id: stored.ios_bundle_id ?? bundleId,
    status: await deriveStatus(platform, ctx.tenant.id, stored.app_name),
  }

  res.json({
    config,
    download_url: build?.download_url ?? null,
    has_build: !!build,
  })
}

async function upsert(req: MedusaRequest, res: MedusaResponse) {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const stored = readConfig(ctx.tenant)

  // Validate app_name (required once set; 1..60 chars). Defaults to the store name.
  const appNameRaw = body.app_name ?? stored.app_name ?? ctx.tenant.name
  const app_name = String(appNameRaw ?? "").trim()
  if (!app_name || app_name.length > 60) {
    return res.status(400).json({ message: "app_name is required (1-60 characters)" })
  }

  // accent_color optional, must be a hex color if present.
  let accent_color = stored.accent_color ?? null
  if (body.accent_color !== undefined && body.accent_color !== null && body.accent_color !== "") {
    if (!isHexColor(body.accent_color)) {
      return res.status(400).json({ message: "accent_color must be a hex color, e.g. #72a499" })
    }
    accent_color = body.accent_color
  }

  // icon_url optional; only accept a stored upload URL (string). The upload
  // itself is done via POST /merchant/setup/logo — we just record the result.
  let icon_url = stored.icon_url ?? null
  if (body.icon_url !== undefined && body.icon_url !== null && body.icon_url !== "") {
    const url = String(body.icon_url)
    if (!/^https?:\/\//.test(url) && !url.startsWith("/")) {
      return res.status(400).json({ message: "icon_url must be a valid URL" })
    }
    icon_url = url
  }

  // Bundle ids are ALWAYS server-derived from the slug (identity-critical) — the
  // client cannot set the Android id; iOS defaults to it but may be an explicit
  // reverse-DNS override.
  const android_bundle_id = bundleIdForSlug(ctx.tenant.slug)
  let ios_bundle_id = stored.ios_bundle_id ?? android_bundle_id
  if (typeof body.ios_bundle_id === "string" && body.ios_bundle_id.trim()) {
    const v = body.ios_bundle_id.trim()
    if (!/^[a-zA-Z0-9.-]{3,155}$/.test(v)) {
      return res.status(400).json({ message: "ios_bundle_id must be a valid reverse-DNS id" })
    }
    ios_bundle_id = v
  }

  const app_config = { app_name, icon_url, accent_color, android_bundle_id, ios_bundle_id }
  const meta = { ...((ctx.tenant.meta ?? {}) as Record<string, any>), app_config }
  await ctx.svc.updateTenants({ id: ctx.tenant.id, meta })

  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  res.json({
    config: {
      ...app_config,
      status: await deriveStatus(platform, ctx.tenant.id, app_name),
    },
  })
}

export const POST = upsert
export const PUT = upsert
