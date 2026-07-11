/* ------------------------------------------------------------------ */
/* Theme CSS custom properties (--ff-*)                                 */
/*                                                                     */
/* SINGLE source of truth for the `:root{--ff-*}` block emitted by BOTH */
/* the root layout (live storefront) and the editor canvas (iframe).    */
/* Both call this exact function, so the two can never drift — the      */
/* whole store repaints identically when the active theme changes.      */
/*                                                                     */
/* Color model: the BASE palette is the ACTIVE THEME's manifest tokens  */
/* (theme.tokens.colors / .fonts). The store owner's CMS `settings.theme`*/
/* OVERRIDES the base ONLY where the owner actually customized a value —  */
/* i.e. where it differs from the Forever Finds / Learts default the CMS */
/* ships. So a fresh Bazaro/Shofy/etc. store paints in its OWN theme     */
/* colors (not inherited Learts green), while any color the owner truly  */
/* changed still wins. Client-safe: no server-only imports.             */
/* ------------------------------------------------------------------ */

import { resolveCustomTokens } from "@modules/cms/schema/chrome/theme"
import type { ThemeTokens } from "@themes/contract"

/**
 * The Forever Finds / Learts default palette — the exact values the CMS ships
 * when a store has NOT customized its colors/fonts (mirrors CMS_DEFAULTS.theme
 * and the historic buildThemeVars fallbacks). Used to detect owner
 * customizations: a CMS value equal to one of these is treated as "unset" so
 * the active theme's own base token applies instead.
 */
const FF_DEFAULT_COLORS = {
  primary: "#72a499",
  dark: "#1f1f1f",
  border: "#e5e5e5",
  text: "#333",
  heading: "#1f1f1f",
  bg: "#fff",
} as const
const FF_DEFAULT_FONTS = {
  body: "Jost, sans-serif",
  heading: "Marcellus, serif",
} as const

type ColorKey = keyof typeof FF_DEFAULT_COLORS
type FontKey = keyof typeof FF_DEFAULT_FONTS

/**
 * The owner's value wins ONLY when it is set AND differs from the FF default
 * (a real customization). Otherwise the active theme's base token applies, and
 * finally the FF default as a last resort.
 */
function pick(
  owner: string | undefined,
  base: string | undefined,
  ffDefault: string
): string {
  if (owner != null && owner !== "" && owner.trim() !== ffDefault) {
    return owner
  }
  return base ?? ffDefault
}

/** The CMS `settings.theme` slice this helper reads (owner customizations). */
export interface ThemeVarsCms {
  colors?: Partial<Record<ColorKey, string>>
  fonts?: Partial<Record<FontKey, string>>
  custom_colors?: { name?: string; value?: string }[]
  custom_fonts?: { name?: string; value?: string }[]
}

/**
 * Compile the active theme's tokens (base) + the store's CMS overrides into the
 * `:root{--ff-*}` declaration block. Owner-defined custom tokens (F2a) are
 * appended, prefixed so they never collide with the built-ins. Called from the
 * root layout AND the editor canvas — keep it the ONLY implementation.
 */
export function buildThemeVars(
  cmsTheme: ThemeVarsCms | undefined,
  themeTokens?: ThemeTokens | null
): string {
  const cmsColors = cmsTheme?.colors ?? {}
  const cmsFonts = cmsTheme?.fonts ?? {}
  const baseColors = (themeTokens?.colors ?? {}) as Partial<
    Record<ColorKey, string>
  >
  const baseFonts = (themeTokens?.fonts ?? {}) as Partial<
    Record<FontKey, string>
  >

  const custom =
    resolveCustomTokens(cmsTheme?.custom_colors)
      .map((t) => `--ff-c-${t.slug}:${t.value};`)
      .join("") +
    resolveCustomTokens(cmsTheme?.custom_fonts)
      .map((t) => `--ff-font-c-${t.slug}:${t.value};`)
      .join("")

  return (
    ":root{" +
    `--ff-primary:${pick(cmsColors.primary, baseColors.primary, FF_DEFAULT_COLORS.primary)};` +
    `--ff-dark:${pick(cmsColors.dark, baseColors.dark, FF_DEFAULT_COLORS.dark)};` +
    `--ff-border:${pick(cmsColors.border, baseColors.border, FF_DEFAULT_COLORS.border)};` +
    `--ff-text:${pick(cmsColors.text, baseColors.text, FF_DEFAULT_COLORS.text)};` +
    `--ff-heading:${pick(cmsColors.heading, baseColors.heading, FF_DEFAULT_COLORS.heading)};` +
    `--ff-bg:${pick(cmsColors.bg, baseColors.bg, FF_DEFAULT_COLORS.bg)};` +
    `--ff-font-body:${pick(cmsFonts.body, baseFonts.body, FF_DEFAULT_FONTS.body)};` +
    `--ff-font-heading:${pick(cmsFonts.heading, baseFonts.heading, FF_DEFAULT_FONTS.heading)};` +
    custom +
    "}"
  )
}
