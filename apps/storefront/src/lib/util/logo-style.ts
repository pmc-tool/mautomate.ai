import type { CSSProperties } from "react"

/**
 * Inline style for a theme header logo from the chrome Branding settings
 * (logo_max_height / logo_padding / logo_margin). Shared by every theme header
 * so the Branding controls work identically on all themes — previously only
 * the learts header consumed these settings.
 */
export function chromeLogoStyle(hd: {
  logo_max_height?: { value?: number | string; unit?: string } | number | string | null
  logo_padding?: { top?: number; right?: number; bottom?: number; left?: number; unit?: string } | null
  logo_margin?: { top?: number; right?: number; bottom?: number; left?: number; unit?: string } | null
} | null | undefined): CSSProperties {
  const s: CSSProperties = {}
  const mh: any = hd?.logo_max_height
  const v =
    typeof mh === "number"
      ? mh
      : typeof mh === "string"
      ? parseFloat(mh)
      : mh && mh.value != null
      ? parseFloat(String(mh.value))
      : NaN
  if (Number.isFinite(v) && v > 0) {
    s.height = `${v}${(mh && typeof mh === "object" && mh.unit) || "px"}`
    s.width = "auto"
  }
  const dim = (d: any): string | undefined => {
    if (!d || typeof d !== "object") return undefined
    const u = d.unit || "px"
    const p = (n: any) => (n == null || n === "" ? 0 : Number(n) || 0)
    const t = p(d.top)
    const r = p(d.right)
    const b = p(d.bottom)
    const l = p(d.left)
    if (!t && !r && !b && !l) return undefined
    return `${t}${u} ${r}${u} ${b}${u} ${l}${u}`
  }
  const pad = dim(hd?.logo_padding)
  if (pad) s.padding = pad
  const mar = dim(hd?.logo_margin)
  if (mar) s.margin = mar
  return s
}
