/* ------------------------------------------------------------------ */
/* Theme Registry                                                       */
/*                                                                     */
/* Compiled-in catalog of selectable themes. The active theme id is a   */
/* CMS setting (`active_theme`); resolution always falls back to the    */
/* default so the store can never render themeless. Adding a theme =    */
/* import it + add it to THEMES (then redeploy).                        */
/* ------------------------------------------------------------------ */

import type { ThemeManifest } from "./contract"
import { leartsTheme } from "./learts"
import { auroraTheme } from "./aurora"
import { cignetTheme } from "./cignet"
import { shofyTheme } from "./shofy"
import { ekkaTheme } from "./ekka"
import { helendoTheme } from "./helendo"
import { bazaroTheme } from "./bazaro"
import { exzoTheme } from "./exzo"
import { rokonTheme } from "./rokon"

/** Every theme that ships with the storefront. */
export const THEMES: Record<string, ThemeManifest> = {
  [leartsTheme.id]: leartsTheme,
  [auroraTheme.id]: auroraTheme,
  [cignetTheme.id]: cignetTheme,
  [shofyTheme.id]: shofyTheme,
  [ekkaTheme.id]: ekkaTheme,
  [helendoTheme.id]: helendoTheme,
  [bazaroTheme.id]: bazaroTheme,
  [exzoTheme.id]: exzoTheme,
  [rokonTheme.id]: rokonTheme,
}

/** The theme used when no `active_theme` setting exists or it is unknown. */
export const DEFAULT_THEME_ID = leartsTheme.id

/** Resolve a theme by id, falling back to the default for unknown ids. */
export function getThemeById(id?: string | null): ThemeManifest {
  if (id && THEMES[id]) {
    return THEMES[id]
  }
  return THEMES[DEFAULT_THEME_ID]
}

/** All themes, for the admin gallery / theme switcher. */
export function listThemes(): ThemeManifest[] {
  return Object.values(THEMES)
}

/**
 * Resolve the ACTIVE theme from CMS settings. Server-only (reads the settings
 * fetcher). Never throws — any failure resolves to the default theme so the
 * storefront chrome and content always render.
 *
 * Imported lazily to keep this module importable from non-server contexts that
 * only need the pure helpers above (getThemeById / listThemes).
 */
export async function getActiveTheme(): Promise<ThemeManifest> {
  try {
    // Dev-only escape hatch: force a theme regardless of settings, so a new
    // theme can be previewed against any backend without changing the
    // store's real active_theme. Server env only — never user-controllable.
    if (process.env.THEME_PREVIEW_ID) {
      return getThemeById(process.env.THEME_PREVIEW_ID)
    }
    // Multi-tenant: the active theme is the TENANT's, injected by middleware from
    // the control plane (tenant.meta.active_theme) — not the global CMS setting.
    if (
      process.env.MULTI_TENANT === "1" ||
      process.env.MULTI_TENANT === "true"
    ) {
      try {
        const { headers } = await import("next/headers")
        const themeId = (await headers()).get("x-tenant-theme")
        if (themeId) return getThemeById(themeId)
      } catch {}
      // The platform-level theme (tenant.meta.active_theme, set via the merchant
      // portal) is unset -> fall back to the STORE'S OWN active theme, which the
      // owner set in their /app admin (Design). getCmsSettings reads it from the
      // tenant's own backend, so an /app theme change takes effect here too.
      try {
        const { getCmsSettings } = await import("@lib/data/cms")
        const local = (await getCmsSettings())?.active_theme
        if (local) return getThemeById(local)
      } catch {}
      return THEMES[DEFAULT_THEME_ID]
    }
    const { getCmsSettings } = await import("@lib/data/cms")
    const settings = await getCmsSettings()
    return getThemeById((settings as { active_theme?: string }).active_theme)
  } catch {
    return THEMES[DEFAULT_THEME_ID]
  }
}
