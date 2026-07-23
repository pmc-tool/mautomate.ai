import type { NextRequest } from "next/server"

/**
 * Resolve the TENANT's backend + publishable key for the visual-editor (Puck)
 * API routes. Next middleware EXCLUDES /api, so it never injects the x-tenant-*
 * headers here — so we resolve the tenant ourselves from the request Host via
 * the control plane's /tenant-config, exactly like the middleware does. Without
 * this the editor would read/write against a single fixed backend (the control
 * plane) instead of the store being edited. Falls back to the default backend in
 * single-tenant mode or when the host can't be resolved.
 */
const DEFAULT_BACKEND = (
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
).replace(/\/+$/, "")
const DEFAULT_PUB = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
const TENANT_CONFIG_URL =
  process.env.TENANT_CONFIG_URL || `${DEFAULT_BACKEND}/tenant-config`
const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

export async function resolveEditorTenant(
  req: NextRequest
): Promise<{
  backend: string
  pubKey: string
  activeTheme: string
  name: string
  /** The tenant this HOST belongs to — editor tokens must be bound to it. */
  tenantId: string
}> {
  if (!MULTI_TENANT)
    return {
      backend: DEFAULT_BACKEND,
      pubKey: DEFAULT_PUB,
      activeTheme: "learts-liquid",
      name: "",
      tenantId: "",
    }
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
  if (!host)
    return {
      backend: DEFAULT_BACKEND,
      pubKey: DEFAULT_PUB,
      activeTheme: "learts-liquid",
      name: "",
      tenantId: "",
    }
  try {
    const r = await fetch(`${TENANT_CONFIG_URL}?host=${encodeURIComponent(host)}`, {
      cache: "no-store",
    })
    if (r.ok) {
      const d = await r.json()
      return {
        backend: (d.backend_url || DEFAULT_BACKEND).replace(/\/+$/, ""),
        pubKey: d.publishable_key || DEFAULT_PUB,
        // The tenant's platform-level theme (tenant.meta.active_theme). Used by
        // the editor-load route to seed a blank page with the theme's default
        // sections — mirrors getActiveTheme's priority in themes/registry.
        activeTheme: (d.active_theme || "").trim() || "learts-liquid",
        // The tenant's store name — used by /api/puck/chrome to rebrand the
        // editor chrome (scrub Forever Finds copy/logo) exactly like the live
        // storefront's applyTenantBranding, so the editor is WYSIWYG.
        name: (d.name || "").trim(),
        tenantId: (d.tenant_id || "").trim(),
      }
    }
  } catch {}
  return {
    backend: DEFAULT_BACKEND,
    pubKey: DEFAULT_PUB,
    activeTheme: "",
    name: "",
    tenantId: "",
  }
}

/**
 * Resolve the store's ACTIVE theme id for the editor APIs, mirroring
 * getActiveTheme in themes/registry: the tenant's platform theme (from
 * /tenant-config's `active_theme`, passed here as `platformTheme`) wins;
 * otherwise fall back to the store's own CMS `active_theme` setting; otherwise
 * "" (the caller maps that to the registry default). Never throws. Shared by
 * /api/puck/load (seed fallback) and /api/puck/chrome (canvas theme) so both
 * use one resolution order.
 */
export async function resolveEditorThemeId(
  backend: string,
  pubKey: string,
  platformTheme: string
): Promise<string> {
  if (platformTheme) {
    return platformTheme
  }
  try {
    const r = await fetch(`${backend}/store/cms/settings`, {
      headers: { "x-publishable-api-key": pubKey },
      cache: "no-store",
    })
    if (r.ok) {
      const d = await r.json()
      const local = (d?.settings?.active_theme || "").trim()
      if (local) {
        return local
      }
    }
  } catch {}
  return ""
}
