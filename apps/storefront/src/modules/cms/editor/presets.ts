"use client"

/* ------------------------------------------------------------------ */
/* Style presets — server-backed via the tenant template store (4C).   */
/*                                                                     */
/* ARCH-UX U5: "Save as preset" used to write to localStorage           */
/* (`ff_style_presets`) and the backend had zero preset code. Presets   */
/* are now rows on the EXISTING tenant-scoped /cms/templates store with */
/* scope:"preset": payload = the appearance bags only                   */
/* ({ blockType, style, advanced, elementStyles }), keyed by            */
/* `widget_type` so the apply dropdown can list per-widget presets.     */
/* NULL widget_type = applies to any type (legacy migrated entries).    */
/*                                                                     */
/* Silent migration: the presence of the `ff_style_presets` key IS the  */
/* pending-migration flag. On first load we push any local entries the  */
/* server doesn't already have (upsert by name — idempotent), then      */
/* delete the key. If the network fails the key stays and migration     */
/* retries on the next load; localStorage entries are never lost        */
/* without having landed on the server first.                           */
/*                                                                     */
/* APPLYING a preset is NOT this module's job — call sites merge the    */
/* bags through the existing style-bag write commands                   */
/* (section.setBags / widget.setBags), so apply stays undoable with no  */
/* new command types.                                                   */
/* ------------------------------------------------------------------ */

export type StylePreset = {
  /** Server row id (cmstpl_…). Absent only on not-yet-persisted values. */
  id?: string
  name: string
  /** The widget/section block type this preset was saved from; null/undefined = any. */
  blockType?: string | null
  style: Record<string, unknown>
  advanced: Record<string, unknown>
  elementStyles?: Record<string, unknown>
}

/** Legacy localStorage key — only ever READ (for migration) after 4C. */
const LS_STYLE_PRESETS = "ff_style_presets"

type TplRow = {
  id: string
  name: string
  scope?: string
  widget_type?: string | null
  is_global?: boolean
  data?: Record<string, unknown> | null
}

const api = (editorKey: string, qs = "") =>
  `/api/puck/templates?key=${encodeURIComponent(editorKey)}${qs}`

function rowToPreset(r: TplRow): StylePreset {
  const d = (r.data ?? {}) as Record<string, unknown>
  const bag = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {}
  const els = bag(d.elementStyles)
  return {
    id: r.id,
    name: r.name,
    blockType:
      r.widget_type ??
      (typeof d.blockType === "string" ? (d.blockType as string) : null),
    style: bag(d.style),
    advanced: bag(d.advanced),
    ...(Object.keys(els).length ? { elementStyles: els } : {}),
  }
}

async function fetchServerPresets(editorKey: string): Promise<StylePreset[]> {
  const r = await fetch(api(editorKey, "&scope=preset"), { cache: "no-store" })
  if (!r.ok) throw new Error(`preset list failed (${r.status})`)
  const b = await r.json().catch(() => ({}))
  const rows: TplRow[] = Array.isArray(b?.templates) ? b.templates : []
  // Belt & braces: a pre-4C backend ignores ?scope= and returns everything —
  // keep only preset rows, and never offer global rows for per-store presets.
  return rows
    .filter((row) => row.scope === "preset" && !row.is_global)
    .map(rowToPreset)
}

async function postPreset(
  editorKey: string,
  p: StylePreset
): Promise<boolean> {
  const r = await fetch(api(editorKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: p.name,
      category: "Presets",
      scope: "preset",
      widget_type: p.blockType ?? undefined,
      data: {
        blockType: p.blockType ?? null,
        style: p.style ?? {},
        advanced: p.advanced ?? {},
        elementStyles: p.elementStyles ?? {},
      },
    }),
  }).catch(() => null)
  return !!r?.ok
}

/** In-flight guard so a double-mounted shell can't run migration twice. */
let migrationPromise: Promise<void> | null = null

/**
 * One-time silent migration of the legacy localStorage preset library.
 * Idempotent: entries whose name already exists on the server are skipped;
 * the key is deleted only after every entry has landed.
 */
async function migrateLocalPresets(editorKey: string): Promise<void> {
  if (typeof window === "undefined") return
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(LS_STYLE_PRESETS)
  } catch {
    return
  }
  if (!raw) return
  let entries: StylePreset[] = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      entries = parsed
        .filter((p) => p && typeof p.name === "string" && p.name.trim())
        .map((p) => ({
          name: p.name,
          blockType:
            typeof p.blockType === "string" && p.blockType ? p.blockType : null,
          style: p.style ?? {},
          advanced: p.advanced ?? {},
        }))
    }
  } catch {
    // Malformed store: nothing recoverable — drop the key so we stop retrying.
    try {
      window.localStorage.removeItem(LS_STYLE_PRESETS)
    } catch {}
    return
  }
  if (entries.length === 0) {
    try {
      window.localStorage.removeItem(LS_STYLE_PRESETS)
    } catch {}
    return
  }
  const existing = await fetchServerPresets(editorKey)
  const have = new Set(existing.map((p) => p.name))
  let allLanded = true
  for (const p of entries) {
    if (have.has(p.name)) continue
    const ok = await postPreset(editorKey, p)
    if (!ok) allLanded = false
  }
  if (allLanded) {
    try {
      window.localStorage.removeItem(LS_STYLE_PRESETS)
    } catch {}
  }
}

/**
 * Load the preset library (runs the silent localStorage migration first).
 * Returns [] on network failure — callers can treat it like an empty library.
 */
export async function loadPresets(editorKey: string): Promise<StylePreset[]> {
  try {
    if (!migrationPromise) migrationPromise = migrateLocalPresets(editorKey)
    await migrationPromise
  } catch {
    migrationPromise = null // retry migration on the next load
  }
  try {
    return await fetchServerPresets(editorKey)
  } catch {
    return []
  }
}

/**
 * Save (upsert by name) a preset and return the refreshed library.
 * Mirrors the old localStorage behavior: saving under an existing name
 * replaces that preset.
 */
export async function savePreset(
  editorKey: string,
  entry: StylePreset
): Promise<StylePreset[]> {
  const list = await loadPresets(editorKey)
  const dupe = list.find((p) => p.name === entry.name)
  if (dupe?.id) await deletePresetRow(editorKey, dupe.id)
  await postPreset(editorKey, entry)
  return fetchServerPresets(editorKey).catch(() => [])
}

/** Delete one preset row by server id. */
export async function deletePresetRow(
  editorKey: string,
  id: string
): Promise<void> {
  await fetch(api(editorKey, `&id=${encodeURIComponent(id)}`), {
    method: "DELETE",
  }).catch(() => {})
}

/**
 * The presets offered for one block type: exact widget matches first, then
 * any-type presets (legacy migrated entries with no recorded block type).
 */
export function presetsForType(
  list: StylePreset[],
  blockType: string | null | undefined
): StylePreset[] {
  const anyType = list.filter((p) => !p.blockType)
  if (!blockType) return anyType
  return [...list.filter((p) => p.blockType === blockType), ...anyType]
}
