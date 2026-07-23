import { ImageResponse } from "next/og"
import { getCmsSettings } from "@lib/data/cms"
import { legacyThemeColor } from "@modules/cms/render/theme-vars"
import { resolvePwaBrand } from "@lib/data/pwa-brand"

/**
 * Per-tenant PWA app icon, generated as a PNG on the fly.
 *
 * No native image tooling (sharp) is installed, so icons are rendered with
 * Next's built-in `next/og` (Satori + resvg → PNG). The icon is a full-bleed
 * square in the store's accent color with the store's initial centered in a
 * readable contrasting color — a clean, always-available app icon that works
 * even for stores with no uploaded logo, and is safe for maskable cropping.
 *
 *   /pwa-icon?size=192          → 192x192 any
 *   /pwa-icon?size=512          → 512x512 any
 *   /pwa-icon?size=512&mask=1   → 512x512 maskable (letter kept in the safe zone)
 *   /pwa-icon?size=180          → apple-touch-icon
 *
 * Tenant identity resolved from the request Host via `resolvePwaBrand`; never
 * cached (Cache-Control: no-store) so one store's icon is never served for
 * another on the pooled server.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Pick black or white text for readable contrast on the given hex color. */
function contrastText(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return "#ffffff"
  const int = parseInt(m[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  // Relative luminance (sRGB) — light backgrounds get dark text and vice versa.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? "#111111" : "#ffffff"
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const size = Math.max(
    48,
    Math.min(512, parseInt(searchParams.get("size") || "512", 10) || 512)
  )
  const maskable = searchParams.get("mask") === "1"

  const [settings, brand] = await Promise.all([
    getCmsSettings().catch(() => null),
    resolvePwaBrand(),
  ])

  const name = (
    brand.name ||
    settings?.seo_defaults?.title ||
    "Store"
  ).trim()
  // U7 dual-read: null token (explicit-inherit shape) maps back to the exact
  // bytes the legacy sentinel wire carried — output unchanged for all tenants.
  const accentRaw =
    brand.accent || legacyThemeColor(settings?.theme, "primary") || "#0e7490"
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(accentRaw) ? accentRaw : "#0e7490"
  const fg = contrastText(accent)
  const initial = (name.replace(/[^A-Za-z0-9]/g, "").charAt(0) || "S").toUpperCase()

  // Maskable icons are cropped to a circle/rounded-square by the OS: keep the
  // glyph smaller so it stays inside the ~80% safe zone.
  const fontSize = Math.round(size * (maskable ? 0.42 : 0.52))

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
          color: fg,
          fontSize,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {initial}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
