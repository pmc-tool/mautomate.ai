import { renderThemePage, type ThemeFiles } from "./engine"

/* ------------------------------------------------------------------ */
/* Storefront-side theme loader.                                        */
/*                                                                     */
/* Fetches an uploaded theme's template bundle from the backend and     */
/* renders a page through the Liquid engine. The bundle is cached by    */
/* handle+version, which is SOUND because a version is immutable — the  */
/* same key is byte-identical forever. A new upload is a new version,   */
/* i.e. a new key, so the cache never serves stale templates.           */
/* ------------------------------------------------------------------ */

const BACKEND =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

type Bundle = { handle: string; version: string; manifest: any; files: ThemeFiles }

const cache = new Map<string, Bundle>()
// The "@current" alias is NOT immutable — a publish changes what it points
// to. Expire it quickly so new theme versions go live without a restart;
// explicit-version entries stay cached forever (those ARE immutable).
const currentAt = new Map<string, number>()
const CURRENT_TTL_MS = 60_000

/**
 * Load a theme's template bundle. Returns null when the handle isn't an
 * uploaded theme (so the caller falls back to the React registry) — an
 * uploaded theme and a built-in one coexist during the migration.
 */
export async function loadThemeBundle(
  handle: string,
  version?: string
): Promise<Bundle | null> {
  if (!handle) return null
  const cacheKey = `${handle}@${version ?? "current"}`
  const hit = cache.get(cacheKey)
  if (hit) {
    const fresh =
      version != null ||
      Date.now() - (currentAt.get(handle) ?? 0) < CURRENT_TTL_MS
    if (fresh) return hit
  }

  try {
    const url = `${BACKEND}/themes-cdn/bundle?handle=${encodeURIComponent(handle)}${
      version ? `&version=${encodeURIComponent(version)}` : ""
    }`
    const r = await fetch(url, { cache: "no-store" })
    if (!r.ok) return null
    const bundle = (await r.json()) as Bundle
    if (!bundle?.files || !bundle.files["layout/theme.liquid"]) return null

    // Cache under BOTH the request key and the resolved version, so a later
    // "current" request and an explicit-version request share one entry.
    cache.set(cacheKey, bundle)
    if (version == null) currentAt.set(handle, Date.now())
    cache.set(`${handle}@${bundle.version}`, bundle)
    return bundle
  } catch {
    return null
  }
}

/** Is this handle an uploaded Liquid theme (vs a compiled React theme)? */
export async function isUploadedTheme(handle: string): Promise<boolean> {
  return (await loadThemeBundle(handle)) !== null
}

/**
 * Render one page of an uploaded theme to an HTML string.
 *
 * `template` is the logical page — "index", "product", "collection", "cart" —
 * and `data` is the already-built theme context (see build-context). The
 * caller injects the result into the React tree with dangerouslySetInnerHTML;
 * that is safe because the engine escapes by default and only emits raw where
 * the platform or an explicit `| raw` allows.
 */
export async function renderUploadedTheme(opts: {
  handle: string
  version?: string
  template: string
  data: Record<string, unknown>
  contentForHeader?: string
  currency?: string
  locale?: string
}): Promise<string | null> {
  const bundle = await loadThemeBundle(opts.handle, opts.version)
  if (!bundle) return null
  return renderThemePage(bundle.files, {
    themeId: bundle.handle,
    version: bundle.version,
    template: opts.template,
    data: { ...opts.data, settings: settingsFrom(bundle.manifest, opts.data) },
    contentForHeader: opts.contentForHeader ?? "",
    currency: opts.currency ?? "USD",
    locale: opts.locale ?? "en",
  })
}

/**
 * Merge a theme's setting DEFAULTS with the merchant's saved overrides, so a
 * template reading `{{ settings.x }}` always gets a value — the merchant's if
 * they set one, the theme author's default otherwise.
 */
function settingsFrom(manifest: any, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of manifest?.settings ?? []) {
    if (s.type === "header" || !s.id) continue
    out[s.id] = s.default
  }
  const saved = (data.__theme_settings as Record<string, unknown>) ?? {}
  return { ...out, ...saved }
}
