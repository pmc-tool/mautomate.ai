/**
 * cms/ai/patch — the changed-keys-only patch contract (ARCH-AI §3.5) and the
 * server-side guards that run BEFORE any AI result reaches a client:
 *
 *   parse set map -> resolve every path against the real node -> capture
 *   `before` -> merge -> scrubImages -> href/fact rules -> (restyle whitelist)
 *   -> registry validation. ANY failure rejects the WHOLE patch — nothing
 *   half-applied, nothing billed.
 *
 * Patches are flat path maps ("title", "items.2.quote", "style.padding.top").
 * RFC-6902 was rejected as ceremony; full-node echo as token waste.
 */

type Json = Record<string, any>

/** Path segments must be plain identifiers or array indices — this blocks
 *  prototype pollution (__proto__/constructor/prototype) by construction. */
const SEG_RE = /^[A-Za-z_][A-Za-z0-9_-]*$|^\d+$/

export function splitPath(path: string): string[] | null {
  if (typeof path !== "string" || !path || path.length > 200) return null
  const segs = path.split(".")
  if (segs.length > 10) return null
  for (const s of segs) {
    if (!SEG_RE.test(s)) return null
    if (s === "__proto__" || s === "constructor" || s === "prototype") return null
  }
  return segs
}

export function getPath(obj: unknown, segs: string[]): unknown {
  let cur: any = obj
  for (const s of segs) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = Array.isArray(cur) ? cur[Number(s)] : cur[s]
  }
  return cur
}

/** True when every segment BUT the last resolves to an object/array and any
 *  array index is in range — "paths must resolve" (§3.5.1). The leaf itself may
 *  be absent (writing an optional field is legal). */
export function pathResolves(obj: unknown, segs: string[]): boolean {
  let cur: any = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    if (cur == null || typeof cur !== "object") return false
    if (Array.isArray(cur)) {
      const idx = Number(s)
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return false
      cur = cur[idx]
    } else {
      cur = cur[s]
    }
  }
  if (cur == null || typeof cur !== "object") return false
  if (Array.isArray(cur)) {
    const idx = Number(segs[segs.length - 1])
    return Number.isInteger(idx) && idx >= 0 && idx <= cur.length
  }
  return true
}

export function setPath(obj: Json, segs: string[], value: unknown): void {
  let cur: any = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    cur = Array.isArray(cur) ? cur[Number(s)] : cur[s]
  }
  const leaf = segs[segs.length - 1]
  if (Array.isArray(cur)) cur[Number(leaf)] = value
  else cur[leaf] = value
}

export const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const deepEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/* ------------------------------------------------------------------ */
/* Content guards                                                      */
/* ------------------------------------------------------------------ */

const IMAGE_LEAF = /(^|_)(image|images|avatar|logo|photo|thumbnail|picture|poster)s?$/i
const LINK_LEAF = /(^|_)(href|url|link)s?$/i
/** Store facts AI may never alter (ARCH-AI §5.3.6). */
const FACT_LEAF =
  /(^|_)(id|ids|product_id|product_ids|handle|price|compare_at_price|discount|ends_at|starts_at)$/i

/**
 * Same rule as ai-edit's scrubImages: an AI-written EXTERNAL image URL becomes
 * "" (the editor shows a picker for empty fields). Applied to merged output.
 */
export function scrubImages(v: any, key?: string): any {
  if (typeof v === "string") {
    if (key && IMAGE_LEAF.test(key) && /^https?:\/\//i.test(v)) return ""
    return v
  }
  if (Array.isArray(v)) return v.map((x) => scrubImages(x, key))
  if (v && typeof v === "object") {
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) out[k] = scrubImages(val, k)
    return out
  }
  return v
}

/**
 * P2V F4 (cheap guard only): a restyle VALUE must never carry markup or a
 * javascript: URL — the style engine serializes values raw, so `<` or
 * `javascript:` in an AI-written value is an injection foothold. Full
 * CSS-syntax value sanitization is deliberately NOT done here (pre-existing
 * engine-wide gap, deferred to Phase 6 hardening).
 */
export function hasUnsafeStyleString(v: unknown): boolean {
  if (typeof v === "string") return v.includes("<") || /javascript:/i.test(v)
  if (Array.isArray(v)) return v.some((x) => hasUnsafeStyleString(x))
  if (v && typeof v === "object") {
    return Object.values(v).some((x) => hasUnsafeStyleString(x))
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Plain-text field guard (AI textguard)                               */
/* ------------------------------------------------------------------ */

/** Real markup only — an element tag or a comment, never a bare "<". */
const HAS_TAG = /<\/?[a-zA-Z][^>]*>|<!--/
const HAS_ENTITY = /&(amp|lt|gt|quot|apos|nbsp|#0*39|#0*160);/i

const decodeEntities = (s: string): string =>
  s.replace(/&(amp|lt|gt|quot|apos|nbsp|#0*39|#0*160);/gi, (_, name: string) => {
    const n = name.toLowerCase()
    if (n === "amp") return "&"
    if (n === "lt") return "<"
    if (n === "gt") return ">"
    if (n === "quot") return '"'
    if (n === "apos" || /^#0*39$/.test(n)) return "'"
    return " " // nbsp / #160
  })

/**
 * Unwrap markup to its text content (AI textguard): script/style elements are
 * dropped WITH their contents, every other tag and comment is unwrapped, basic
 * entities decoded, whitespace collapsed. A string carrying no markup or
 * entities is returned untouched — plain text never gets reformatted.
 */
export function stripHtmlToText(input: string): string {
  if (!HAS_TAG.test(input) && !HAS_ENTITY.test(input)) return input
  let out = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
  out = out.replace(/<!--[\s\S]*?-->/g, " ")
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, " ")
  out = decodeEntities(out)
  return out.replace(/\s+/g, " ").trim()
}

/**
 * Deep plain-text guard over an AI set map (AI textguard, runs BEFORE
 * applySetMap so merge + registry validation see exactly what the client will
 * apply): every STRING value destined for a field whose contract kind is NOT
 * html is stripped of markup. `kindAt` resolves a dot path to the block
 * contract's declared field kind (null = unknowable). Unknowable paths are
 * stripped anyway UNLESS the path's ROOT field is itself declared html —
 * plain text is the safe default. Restyle patches never reach this (the style
 * whitelist owns them).
 */
export function sanitizeSetMapText(
  set: Json,
  kindAt: (path: string) => string | null
): Json {
  const keepHtml = (path: string): boolean => {
    const kind = kindAt(path)
    if (kind) return kind === "html"
    return kindAt(path.split(".")[0]) === "html"
  }
  const walk = (v: any, path: string): any => {
    if (typeof v === "string") return keepHtml(path) ? v : stripHtmlToText(v)
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}.${i}`))
    if (v && typeof v === "object") {
      const out: Json = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val, `${path}.${k}`)
      return out
    }
    return v
  }
  const out: Json = {}
  for (const [p, v] of Object.entries(set)) out[p] = walk(v, p)
  return out
}

/**
 * Apply a changed-keys set map over a node. Returns the merged clone plus the
 * `before` values of exactly the changed paths, or the first batch of errors.
 * Enforces: path syntax, resolvability, KNOWN-FIELD roots (P2V F1 — an
 * invented field is invalid, never billed, never persisted), href rule
 * (keep / clear / relative only — never a NEW external destination), fact
 * immutability, and the style/advanced fences per action kind.
 *
 * `knownKeys` is the legal field-name set for the edit's SCOPE: the block's
 * top-level fields for node edits, or the ITEM's fields when `pathPrefix`
 * scopes the patch to one repeater item. Null/undefined = shape unknowable,
 * keep the previous permissive behavior.
 */
export function applySetMap(
  node: Json,
  set: Json,
  opts: {
    restyle?: boolean
    pathPrefix?: string
    knownKeys?: Set<string> | null
  } = {}
): { merged: Json; before: Json; errors: string[] } {
  const errors: string[] = []
  const before: Json = {}
  const merged = deepClone(node)
  const scopeIdx = opts.pathPrefix ? opts.pathPrefix.split(".").length : 0

  if (!set || typeof set !== "object" || Array.isArray(set)) {
    return { merged, before, errors: ["set must be an object of path -> value"] }
  }
  const entries = Object.entries(set)
  if (!entries.length) return { merged, before, errors: ["set is empty"] }
  if (entries.length > 40) return { merged, before, errors: ["too many changed paths"] }

  for (const [path, rawValue] of entries) {
    const segs = splitPath(path)
    if (!segs) {
      errors.push(`"${path}": invalid path`)
      continue
    }
    if (opts.pathPrefix && !(path === opts.pathPrefix || path.startsWith(opts.pathPrefix + "."))) {
      errors.push(`"${path}": outside the item being edited`)
      continue
    }
    const top = segs[0]
    if (segs.some((s) => s === "advanced" || s === "elementStyles")) {
      errors.push(`"${path}": advanced/elementStyles are never AI-writable`)
      continue
    }
    if (opts.restyle) {
      if (top !== "style") {
        errors.push(`"${path}": restyle may only change style.* paths`)
        continue
      }
    } else if (top === "style") {
      errors.push(`"${path}": copy actions may not change styling`)
      continue
    }
    if (top === "block_type" || top === "widget_type") {
      errors.push(`"${path}": type fields are immutable`)
      continue
    }
    // P2V F1: the field being written must EXIST on this block type. An
    // invented root ("nonexistent_field_zzz") previously passed every guard
    // (pathResolves treats an absent leaf as an optional field and
    // validateBlockData ignores unknown keys), got billed, and persisted junk.
    if (!opts.restyle && opts.knownKeys) {
      if (segs.length > scopeIdx) {
        const field = segs[scopeIdx]
        if (!opts.knownKeys.has(field)) {
          errors.push(
            `"${path}": unknown field "${field}" for this ${opts.pathPrefix ? "item" : "section"}`
          )
          continue
        }
      } else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        // Whole-item replacement (path === pathPrefix): the replacement
        // object's own top-level keys must all be known item fields.
        const bad = Object.keys(rawValue).filter((k) => !opts.knownKeys!.has(k))
        if (bad.length) {
          errors.push(`"${path}": unknown field "${bad[0]}" for this item`)
          continue
        }
      }
    }
    if (opts.restyle && hasUnsafeStyleString(rawValue)) {
      errors.push(`"${path}": style values may not contain markup or javascript: URLs`)
      continue
    }
    if (!pathResolves(node, segs)) {
      errors.push(`"${path}": path does not resolve on this section`)
      continue
    }
    // Bound the value payload (a patch is small by definition).
    const serialized = JSON.stringify(rawValue) ?? "null"
    if (serialized.length > 8000) {
      errors.push(`"${path}": value too large`)
      continue
    }

    const prior = getPath(node, segs)
    const leaf = segs[segs.length - 1]

    if (FACT_LEAF.test(leaf) && prior !== undefined && !deepEqual(prior, rawValue)) {
      errors.push(`"${path}": store facts (ids/prices/dates) are not AI-editable`)
      continue
    }
    if (LINK_LEAF.test(leaf) && typeof rawValue === "string") {
      const keeps = typeof prior === "string" && rawValue === prior
      const cleared = rawValue === ""
      const relative = /^[/#]/.test(rawValue)
      if (!keeps && !cleared && !relative) {
        errors.push(`"${path}": links may be kept, cleared or relative — never new external URLs`)
        continue
      }
    }

    before[path] = prior === undefined ? null : deepClone(prior)
    setPath(merged, segs, rawValue)
  }

  return { merged, before, errors }
}
