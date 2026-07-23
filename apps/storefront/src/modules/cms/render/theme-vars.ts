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
/* OVERRIDES the base only where the owner actually customized a value.  */
/* Client-safe: no server-only imports.                                  */
/*                                                                      */
/* Override model (ARCH-UX U7 — explicit null-inherit, dual-read):       */
/*   NEW shape   : every built-in token key present; `null` = inherit    */
/*                 the theme manifest token, any string = explicit       */
/*                 merchant override (wins verbatim).                    */
/*   LEGACY shape: the backend resolver deep-merges the historic Forever */
/*                 Finds defaults into absent keys, so an uncustomized   */
/*                 token reaches us as the CONCRETE FF default string    */
/*                 (a sentinel). `pick()` detects those sentinels and    */
/*                 treats them as inherit.                               */
/* `pick()` reads BOTH shapes (standing invariant: the storefront must   */
/* accept both for at least one release). Tenants migrate LAZILY: the    */
/* editor converts in memory on load (normalizeThemeTokenOverrides) and  */
/* the explicit shape is persisted only on that tenant's next explicit   */
/* settings save — no bulk migration ever. Once every tenant stores the  */
/* explicit shape, the sentinel comparison in pick() can retire (at      */
/* which point a merchant may deliberately choose an FF-default color).  */
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
export const FF_DEFAULT_COLORS = {
  primary: "#72a499",
  dark: "#1f1f1f",
  border: "#e5e5e5",
  text: "#333",
  heading: "#1f1f1f",
  bg: "#fff",
} as const
export const FF_DEFAULT_FONTS = {
  body: "Jost, sans-serif",
  heading: "Marcellus, serif",
} as const

export type ColorKey = keyof typeof FF_DEFAULT_COLORS
export type FontKey = keyof typeof FF_DEFAULT_FONTS

const COLOR_KEYS = Object.keys(FF_DEFAULT_COLORS) as ColorKey[]
const FONT_KEYS = Object.keys(FF_DEFAULT_FONTS) as FontKey[]

/**
 * DUAL-READ (U7). The owner's value wins ONLY when it is an explicit string
 * that differs from the legacy FF default:
 *   - `null` / absent / ""            → inherit (NEW explicit shape)
 *   - string equal to the FF default  → inherit (LEGACY sentinel shape)
 *   - any other string                → merchant override, wins verbatim
 * Otherwise the active theme's base token applies, and finally the FF default
 * as a last resort. The sentinel branch retires only after every tenant has
 * been lazily migrated to the explicit shape (see normalizeThemeTokenOverrides).
 */
function pick(
  owner: string | null | undefined,
  base: string | undefined,
  ffDefault: string
): string {
  if (owner != null && owner !== "" && owner.trim() !== ffDefault) {
    return owner
  }
  return base ?? ffDefault
}

/** The CMS `settings.theme` slice this helper reads (owner customizations).
 *  `null` = explicit inherit (U7); the legacy shape carries only strings. */
export interface ThemeVarsCms {
  colors?: Partial<Record<ColorKey, string | null>>
  fonts?: Partial<Record<FontKey, string | null>>
  custom_colors?: { name?: string; value?: string }[]
  custom_fonts?: { name?: string; value?: string }[]
}

/**
 * U7 lazy migration (pure, in-memory). Convert a theme-settings slice from the
 * legacy sentinel shape to the explicit null-inherit shape:
 *   - every built-in token key becomes PRESENT: `null` when it is absent or
 *     carries the legacy FF-default sentinel (which pick() strips), else the
 *     stored value verbatim;
 *   - `""` is preserved verbatim (deliberately NOT collapsed to null): it
 *     renders as inherit under pick() either way, but the secondary readers'
 *     `|| fallback` chains historically resolved "" to THEIR OWN fallback,
 *     not the FF default — preserving "" keeps those bytes stable too;
 *   - custom tokens, logo and component defaults ride along untouched.
 * RENDER-IDENTICAL BY CONSTRUCTION: for every token,
 *   pick(normalized, base, ff) === pick(original, base, ff)
 * — both sides land in the same branch of pick(). Callers convert on editor
 * load and persist ONLY on the tenant's next explicit settings save.
 */
export function normalizeThemeTokenOverrides<T extends object>(cmsTheme: T): T {
  const slice = cmsTheme as ThemeVarsCms
  const colors = (slice.colors ?? {}) as Partial<Record<ColorKey, string | null>>
  const fonts = (slice.fonts ?? {}) as Partial<Record<FontKey, string | null>>
  const toExplicit = (v: string | null | undefined, ffDefault: string) =>
    v == null || (v !== "" && v.trim() === ffDefault) ? null : v
  const nextColors: Record<string, string | null> = { ...colors }
  for (const k of COLOR_KEYS) {
    nextColors[k] = toExplicit(colors[k], FF_DEFAULT_COLORS[k])
  }
  const nextFonts: Record<string, string | null> = { ...fonts }
  for (const k of FONT_KEYS) {
    nextFonts[k] = toExplicit(fonts[k], FF_DEFAULT_FONTS[k])
  }
  return { ...cmsTheme, colors: nextColors, fonts: nextFonts } as T
}

/**
 * U7 dual-read shim for the SECONDARY readers of `settings.theme.colors`
 * (PWA theme color, manifest background, pwa-icon, theme-render head) that
 * historically consumed the resolver's sentinel-laden wire directly. Returns
 * the exact bytes that wire used to carry: the stored string, or the FF
 * default when the token is an explicit `null` (new shape). When the theme
 * slice itself is missing the caller's own fallback chain applies unchanged
 * (returns undefined).
 */
export function legacyThemeColor(
  cmsTheme: ThemeVarsCms | null | undefined,
  key: ColorKey
): string | undefined {
  const colors = cmsTheme?.colors
  if (!colors) return undefined
  return colors[key] ?? FF_DEFAULT_COLORS[key]
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
