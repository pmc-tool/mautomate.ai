import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import AdmZip from "adm-zip"

import { THEME_MODULE } from "../../../modules/theme"
import { validateTheme, type ThemeFile } from "../../../modules/theme/lib/validator"

/* ------------------------------------------------------------------ */
/* POST /admin/themes — upload a theme package (.zip).                  */
/*                                                                     */
/* The order here is the whole security story:                          */
/*   1. unzip DEFENSIVELY (a zip can lie about its own contents)        */
/*   2. VALIDATE — nothing is written until the package passes          */
/*   3. store as an immutable version                                   */
/*                                                                     */
/* A rejected upload changes nothing: no theme row, no files, no        */
/* half-installed state for a merchant to stumble into.                 */
/* ------------------------------------------------------------------ */

/** Text we keep as text; everything else is base64. */
const TEXT_EXT = /\.(liquid|css|js|json|txt|map|svg)$/i

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
}

/** A zip entry can claim any path it likes. Trust none of it. */
function safeEntryPath(raw: string): string | null {
  const p = raw.replace(/\\/g, "/").replace(/^\.\//, "")
  if (!p || p.endsWith("/")) return null
  if (p.startsWith("/") || p.includes("..") || p.includes("\0")) return null
  // Zips made by "Compress Folder" nest everything under one directory. Strip
  // a single leading folder so both shapes work — this is the single most
  // common upload mistake, and failing on it teaches a developer nothing.
  return p
}

function stripCommonRoot(paths: string[]): (p: string) => string {
  const tops = new Set(paths.map((p) => p.split("/")[0]))
  const nested =
    tops.size === 1 &&
    !paths.some((p) => p === "theme.json") &&
    paths.some((p) => p.endsWith("/theme.json"))
  if (!nested) return (p) => p
  const root = [...tops][0] + "/"
  return (p) => (p.startsWith(root) ? p.slice(root.length) : p)
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const file = (req as any).file as
    | { buffer: Buffer; originalname: string; size: number }
    | undefined

  if (!file?.buffer) {
    return res
      .status(400)
      .json({ message: "Upload a .zip theme package (field name: file)" })
  }

  /* ---- 1. unzip, defensively ---- */
  let entries: ThemeFile[] = []
  try {
    const zip = new AdmZip(file.buffer)
    const raw = zip.getEntries().filter((e) => !e.isDirectory)
    const paths = raw
      .map((e) => safeEntryPath(e.entryName))
      .filter((p): p is string => !!p)
    const unwrap = stripCommonRoot(paths)

    for (const e of raw) {
      const p = safeEntryPath(e.entryName)
      if (!p) {
        // A path that tries to escape is not a mistake — it is an attack.
        return res.status(400).json({
          message: `Rejected: the package contains an unsafe path (${e.entryName})`,
        })
      }
      const content = e.getData()
      entries.push({ path: unwrap(p), size: content.length, content })
    }
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: `That file is not a readable .zip (${e?.message ?? e})` })
  }

  /* ---- 2. validate — nothing is written before this passes ---- */
  const { ok, manifest, violations } = validateTheme(entries)
  if (!ok || !manifest) {
    return res.status(422).json({
      message: "The theme was rejected",
      errors: violations.filter((v) => v.level === "error"),
      warnings: violations.filter((v) => v.level === "warning"),
    })
  }

  /* ---- 3. store as an immutable version ---- */
  const svc: any = req.scope.resolve(THEME_MODULE)
  const actor = (req as any).auth_context?.actor_id ?? null

  const existing = await svc.listThemes({ handle: manifest.id })
  let theme = existing?.[0]

  if (!theme) {
    theme = (
      await svc.createThemes([
        {
          handle: manifest.id,
          name: manifest.name,
          author: manifest.author ?? null,
          description: manifest.description ?? null,
          status: "draft",
          visibility: "public",
          uploaded_by: actor,
        },
      ])
    )[0]
  }

  const dupe = await svc.listThemeVersions({
    theme_id: theme.id,
    version: manifest.version,
  })
  if (dupe?.length) {
    return res.status(409).json({
      message: `${manifest.name} ${manifest.version} is already in the library. Bump the version in theme.json to upload a change.`,
    })
  }

  const previewFile = entries.find((f) => f.path === "preview.png")
  const version = (
    await svc.createThemeVersions([
      {
        theme_id: theme.id,
        version: manifest.version,
        manifest,
        warnings: violations.filter((v) => v.level === "warning"),
        preview: previewFile
          ? `data:image/png;base64,${previewFile.content.toString("base64")}`
          : null,
        size_bytes: entries.reduce((n, f) => n + f.size, 0),
        file_count: entries.length,
        uploaded_by: actor,
      },
    ])
  )[0]

  await svc.createThemeFiles(
    entries.map((f) => {
      const ext = f.path.slice(f.path.lastIndexOf("."))
      const isText = TEXT_EXT.test(f.path)
      return {
        theme_version_id: version.id,
        path: f.path,
        kind: isText ? "text" : "binary",
        content: isText
          ? f.content.toString("utf8")
          : f.content.toString("base64"),
        content_type: CONTENT_TYPES[ext] ?? "application/octet-stream",
        size_bytes: f.size,
      }
    })
  )

  // The newest upload becomes what a merchant gets when they apply the theme.
  // Stores already running an older version are NOT moved — see theme_version.
  await svc.updateThemes([
    { id: theme.id, current_version: manifest.version, name: manifest.name },
  ])

  res.status(201).json({
    theme: {
      id: theme.id,
      handle: theme.handle,
      name: manifest.name,
      version: manifest.version,
      status: theme.status,
    },
    files: entries.length,
    warnings: violations.filter((v) => v.level === "warning"),
  })
}

/* ------------------------------------------------------------------ */
/* GET /admin/themes — the library.                                     */
/* ------------------------------------------------------------------ */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const svc: any = req.scope.resolve(THEME_MODULE)
  const themes = await svc.listThemes({})
  const versions = await svc.listThemeVersions({})

  const byTheme = new Map<string, any[]>()
  for (const v of versions) {
    const list = byTheme.get(v.theme_id) ?? []
    list.push(v)
    byTheme.set(v.theme_id, list)
  }

  res.json({
    themes: themes.map((t: any) => {
      const vs = (byTheme.get(t.id) ?? []).sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      )
      const current = vs.find((v) => v.version === t.current_version) ?? vs[0]
      return {
        id: t.id,
        handle: t.handle,
        name: t.name,
        author: t.author,
        description: t.description,
        status: t.status,
        visibility: t.visibility,
        current_version: t.current_version,
        preview: current?.preview ?? null,
        settings: current?.manifest?.settings ?? [],
        versions: vs.map((v) => ({
          version: v.version,
          size_bytes: v.size_bytes,
          file_count: v.file_count,
          created_at: v.created_at,
        })),
      }
    }),
  })
}
