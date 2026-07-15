import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { THEME_MODULE } from "../../../modules/theme"

/* ------------------------------------------------------------------ */
/* GET /store/theme-bundle?handle=aurora[&version=1.2.0]                 */
/*                                                                     */
/* The storefront's Liquid engine needs the theme's TEMPLATES (text) to */
/* render a page. It fetches them here, once, and caches by version —   */
/* which is safe precisely because a version is immutable: the same     */
/* handle+version is byte-identical forever, so it can be cached hard.   */
/*                                                                     */
/* Binaries (images, fonts) are NOT in this payload — those are served  */
/* one-by-one from /theme-assets so a 4 MB font never rides along with  */
/* every page render.                                                  */
/* ------------------------------------------------------------------ */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const handle = String(req.query.handle ?? "").trim()
  if (!handle) {
    return res.status(400).json({ message: "handle is required" })
  }

  const svc: any = req.scope.resolve(THEME_MODULE)
  const themes = await svc.listThemes({ handle })
  const theme = themes?.[0]
  if (!theme) {
    return res.status(404).json({ message: `No theme "${handle}"` })
  }

  const wanted = String(req.query.version ?? "").trim() || theme.current_version
  const versions = await svc.listThemeVersions({
    theme_id: theme.id,
    version: wanted,
  })
  const version = versions?.[0]
  if (!version) {
    return res.status(404).json({ message: `No version ${wanted} of ${handle}` })
  }

  // Only TEXT files (templates, snippets, layout, CSS/JS the layout inlines).
  // Binaries stay out of the render bundle.
  const files = await svc.listThemeFiles({
    theme_version_id: version.id,
    kind: "text",
  })

  const bundle: Record<string, string> = {}
  for (const f of files) {
    bundle[f.path] = f.content
  }

  // Immutable — cache it hard. The version is the cache key.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
  res.json({
    handle,
    version: version.version,
    manifest: version.manifest,
    files: bundle,
  })
}
