/* ------------------------------------------------------------------ */
/* Editor theme tokens (ARCH-CANVAS P8, seat 6C — composition root).    */
/*                                                                      */
/* The shell's themeTokens memo body, moved VERBATIM: global theme      */
/* tokens (colors + fonts) surfaced to linkable color/font controls in  */
/* the Style/Advanced tabs (P5 — link-to-global-token). Sourced from    */
/* the editable chrome.theme; fallbacks mirror the storefront's         */
/* buildThemeVars defaults so a swatch/label always resolves to         */
/* something. A linked value stores `{ ref: <id> }`; the style engine   */
/* maps it to the live CSS var (--ff-<id> / --ff-font-<id>), so         */
/* editing the theme cascades here.                                     */
/* ------------------------------------------------------------------ */

import type { Tokens } from "@modules/cms/editor/style-controls"
import { resolveCustomTokens } from "@modules/cms/schema/chrome/theme"

export function buildEditorThemeTokens(chromeTheme: unknown): Tokens {
  const theme = (chromeTheme ?? {}) as {
    colors?: Record<string, string>
    fonts?: Record<string, string>
    custom_colors?: unknown
    custom_fonts?: unknown
  }
  const c = theme.colors ?? {}
  const f = theme.fonts ?? {}
  // Owner-defined custom tokens (F2a) — refs are "c-<slug>", resolving to
  // the prefixed vars --ff-c-<slug> / --ff-font-c-<slug>.
  const customColors = resolveCustomTokens(theme.custom_colors).map((t) => ({
    id: `c-${t.slug}`,
    name: t.name,
    value: t.value,
  }))
  const customFonts = resolveCustomTokens(theme.custom_fonts).map((t) => ({
    id: `c-${t.slug}`,
    name: t.name,
    value: t.value,
  }))
  return {
    colors: [
      { id: "primary", name: "Primary", value: c.primary ?? "#72a499" },
      { id: "heading", name: "Heading", value: c.heading ?? "#1f1f1f" },
      { id: "text", name: "Text", value: c.text ?? "#333" },
      { id: "dark", name: "Dark", value: c.dark ?? "#1f1f1f" },
      { id: "border", name: "Border", value: c.border ?? "#e5e5e5" },
      { id: "bg", name: "Background", value: c.bg ?? "#fff" },
      ...customColors,
    ],
    fonts: [
      { id: "body", name: "Body", value: f.body ?? "Jost, sans-serif" },
      { id: "heading", name: "Heading", value: f.heading ?? "Marcellus, serif" },
      ...customFonts,
    ],
  }
}
