/* ------------------------------------------------------------------ */
/* Theme component defaults (F2b)                                       */
/*                                                                      */
/* The `theme` singleton can carry optional site-wide COMPONENT         */
/* defaults (theme.button / theme.headings — see schema/chrome/theme).  */
/* `buildThemeDefaultsCss` compiles them into a low-specificity base    */
/* layer scoped to the storefront content (`.learts-theme …`), so they  */
/* restyle every button / heading at once while still losing to any     */
/* section- or element-level override the style engine emits.           */
/*                                                                      */
/* Diff-only by contract: only keys the owner actually set are emitted; */
/* an empty / absent theme yields "" (today's behavior, byte-identical).*/
/* Serialization is shared with the style engine (resolveTokenRef /     */
/* unitNumberToCss / dimensionDecls) so token refs ({ ref:"primary" } → */
/* var(--ff-primary)) and unit handling stay consistent everywhere.     */
/* ------------------------------------------------------------------ */

import {
  dimensionDecls,
  resolveTokenRef,
  unitNumberToCss,
} from "./style-engine"

/** A single CSS declaration as a `[property, value]` pair. */
type Decl = [string, string]

/** Narrow an unknown to a plain object (not array), else undefined. */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

/**
 * Every button-ish control inside the storefront content. `.btn` covers the
 * Learts theme's buttons (sections, hero CTAs, forms); `button[type=submit]`
 * catches bare submit buttons (e.g. newsletter forms) that skip the class.
 */
const BUTTON_SELECTOR = ".learts-theme .btn,.learts-theme button[type=submit]"

/** All heading levels inside the storefront content. */
const HEADINGS_SELECTOR = (["h1", "h2", "h3", "h4", "h5", "h6"] as const)
  .map((h) => `.learts-theme ${h}`)
  .join(",")

/** Serialize decls into a rule, or "" when there is nothing to emit. */
function rule(selector: string, decls: Decl[]): string {
  if (!decls.length) {
    return ""
  }
  return `${selector}{${decls.map(([p, v]) => `${p}:${v}`).join(";")}}`
}

/** `theme.button` → declarations for the site-wide button base layer. */
function buttonDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const out: Decl[] = []
  const background = resolveTokenRef(rec.background, "color")
  if (background) {
    out.push(["background-color", background])
  }
  const textColor = resolveTokenRef(rec.textColor, "color")
  if (textColor) {
    out.push(["color", textColor])
  }
  const radius = unitNumberToCss(rec.radius)
  if (radius !== undefined) {
    out.push(["border-radius", radius])
  }
  out.push(...dimensionDecls("padding", rec.padding))
  return out
}

/** `theme.headings` → declarations for the site-wide heading base layer. */
function headingsDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const out: Decl[] = []
  const color = resolveTokenRef(rec.color, "color")
  if (color) {
    out.push(["color", color])
  }
  const fontFamily = resolveTokenRef(rec.fontFamily, "font")
  if (fontFamily) {
    out.push(["font-family", fontFamily])
  }
  const letterSpacing = unitNumberToCss(rec.letterSpacing)
  if (letterSpacing !== undefined) {
    out.push(["letter-spacing", letterSpacing])
  }
  return out
}

/**
 * Compile the theme's optional component defaults into CSS. Emits one rule
 * per component group, ONLY for the keys the owner set; an empty / absent /
 * malformed theme yields "" so pre-F2b data renders byte-identical to today.
 *
 * Injected as a `<style>` right next to the theme CSS vars — by the root
 * layout (production) and the editor canvas — so both stay identical.
 */
export function buildThemeDefaultsCss(theme: unknown): string {
  const t = asRecord(theme)
  if (!t) {
    return ""
  }
  return [
    rule(BUTTON_SELECTOR, buttonDecls(t.button)),
    rule(HEADINGS_SELECTOR, headingsDecls(t.headings)),
  ]
    .filter(Boolean)
    .join("\n")
}

export default buildThemeDefaultsCss
