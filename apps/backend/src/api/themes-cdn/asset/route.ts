import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { THEME_MODULE } from "../../../modules/theme"

/* GET /store/theme-asset?handle=&version=&path=  — one theme file, by path.
   Path is a query param (not a route wildcard) so multi-segment asset paths
   like "assets/fonts/x.woff2" work without a catch-all route. The storefront
   proxies `/theme-assets/:h/:v/*` here so the browser sees a clean URL. */

const TEXT_CT: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const handle = String(req.query.handle ?? "").trim()
  const version = String(req.query.version ?? "").trim()
  const path = String(req.query.path ?? "")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")

  if (!handle || !version || !path) {
    return res.status(404).send("Not found")
  }

  const svc: any = req.scope.resolve(THEME_MODULE)
  const theme = (await svc.listThemes({ handle }))?.[0]
  if (!theme) return res.status(404).send("Not found")
  const tv = (await svc.listThemeVersions({ theme_id: theme.id, version }))?.[0]
  if (!tv) return res.status(404).send("Not found")
  // asset_url references the assets/ folder by bare name (Shopify convention),
  // so try assets/<path> first, then the literal path (e.g. a snippet .liquid).
  let file = (await svc.listThemeFiles({ theme_version_id: tv.id, path: `assets/${path}` }))?.[0]
  if (!file) {
    file = (await svc.listThemeFiles({ theme_version_id: tv.id, path }))?.[0]
  }
  if (!file) return res.status(404).send("Not found")

  res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
  const ext = path.slice(path.lastIndexOf("."))
  if (file.kind === "binary") {
    res.setHeader("Content-Type", file.content_type ?? "application/octet-stream")
    return res.send(Buffer.from(file.content, "base64"))
  }
  res.setHeader("Content-Type", file.content_type ?? TEXT_CT[ext] ?? "text/plain; charset=utf-8")
  res.send(file.content)
}
