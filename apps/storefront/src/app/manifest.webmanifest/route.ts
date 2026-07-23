import { NextResponse } from "next/server"
import { getCmsSettings } from "@lib/data/cms"
import { legacyThemeColor } from "@modules/cms/render/theme-vars"
import { resolvePwaBrand } from "@lib/data/pwa-brand"

/**
 * Per-tenant PWA web manifest.
 *
 * Served at the origin root (`/manifest.webmanifest`) so its `scope`/`start_url`
 * cover the whole store. The middleware `next()` bypass renders this route at
 * its own path (no /:country redirect). Tenant identity is resolved from the
 * request Host via `resolvePwaBrand` (the middleware header forwarding does not
 * reach a same-origin route), layered over the store's CMS settings:
 *   - name / short_name  ← tenant name (tenant-config, else CMS title)
 *   - theme_color        ← tenant brand accent (tenant-config), else CMS primary
 *   - background_color   ← the store's page background (theme.colors.bg)
 *   - icons              ← generated per-tenant PNGs (see app/pwa-icon)
 *
 * Rendered dynamically per request and never cached (Cache-Control: no-store):
 * on the pooled multi-tenant server a cached manifest could otherwise be served
 * to the wrong store.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const [settings, brand] = await Promise.all([
    getCmsSettings().catch(() => null),
    resolvePwaBrand(),
  ])

  const name = (
    brand.name ||
    settings?.seo_defaults?.title ||
    "Store"
  ).trim()
  const shortName = (name.split(/\s+/)[0] || name).slice(0, 12) || "Store"
  // U7 dual-read: on the explicit null-inherit token shape a null token maps
  // back (via legacyThemeColor) to the exact bytes the sentinel wire carried,
  // so these values are unchanged for every tenant, before and after saving.
  const themeColor =
    brand.accent || legacyThemeColor(settings?.theme, "primary") || "#111111"
  const backgroundColor = legacyThemeColor(settings?.theme, "bg") || "#ffffff"
  const description =
    brand.name
      ? `${name} — shop online.`
      : settings?.seo_defaults?.description || `${name} — shop online.`

  const manifest = {
    name,
    short_name: shortName,
    description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: "/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon?size=512&mask=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
