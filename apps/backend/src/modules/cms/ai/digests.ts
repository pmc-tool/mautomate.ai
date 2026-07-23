import crypto from "crypto"
import { BLOCK_REGISTRY } from "../registry"
import {
  CONTRACT_FIELDS,
  type ContractField,
  type ContractFieldKind,
} from "../registry/generated/contract.gen"

/**
 * cms/ai/digests — server-compiled, versioned per-block prompt digests
 * (ARCH-AI §3.1). THE single schema view any CMS AI prompt may contain.
 *
 * Compiled ONCE per process from the first-party contract (Phase 4B: the
 * shared cms-contract catalog, via the generated CONTRACT_FIELDS — richer
 * field metadata than the old defaultData()-only derivation: declared kinds,
 * enum choices, html/date/id awareness), never from anything the client
 * sends — the client-built schema catalog is dead as a prompt input.
 * defaultData() derivation remains only as the fallback for registered types
 * the contract does not describe. Each digest is a dense ~40-80 token LINE
 * FORMAT, not JSON:
 *
 *   testimonials — customer quotes strip.
 *   fields: title:text; items[]{quote:text, author:text, role:text, avatar:img}
 *   notes: avatar may be ""; quote <= 220 chars renders best
 *
 * Digests carry only what a WRITER needs (field names, collapsed types, list
 * shapes, render hints) — never editor metadata, groups or human labels.
 *
 * A `version` (hash of the whole compiled set) stamps every AI response and
 * every cache key, so a registry change invalidates cached generations.
 */

/* ------------------------------------------------------------------ */
/* Field-kind inference (from each block's defaultData() payload)       */
/* — FALLBACK ONLY, for registered types without contract metadata.     */
/* ------------------------------------------------------------------ */

const IMG_KEY =
  /(^|_)(image|images|avatar|logo|photo|thumbnail|picture|poster|icon|background_image)s?$/i
const URL_KEY = /(^|_)(href|url|link)s?$/i

const kindOf = (key: string, v: unknown): string => {
  if (typeof v === "number") return "num"
  if (typeof v === "boolean") return "bool"
  if (IMG_KEY.test(key)) return "img"
  if (URL_KEY.test(key)) return "url"
  return "text"
}

/** Keys that never belong in a writer's view of a block. */
const STRIP_KEYS = new Set([
  "style",
  "advanced",
  "elementStyles",
  "block_type",
  "schema_version",
  "id",
])

/**
 * Derive the compact field spec line from a default payload.
 * `namesOnly` yields the Tier-3 TYPE TABLE variant (about half the tokens).
 */
function specOf(
  obj: Record<string, unknown>,
  namesOnly: boolean,
  depth = 0
): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_KEYS.has(k)) continue
    if (Array.isArray(v)) {
      const first = v.find((x) => x && typeof x === "object" && !Array.isArray(x))
      if (first && depth < 2) {
        parts.push(
          `${k}[]{${specOf(first as Record<string, unknown>, namesOnly, depth + 1)}}`
        )
      } else {
        parts.push(namesOnly ? `${k}[]` : `${k}[]:${kindOf(k, v[0])}`)
      }
    } else if (v && typeof v === "object") {
      if (depth < 2) {
        parts.push(
          `${k}{${specOf(v as Record<string, unknown>, namesOnly, depth + 1)}}`
        )
      }
    } else {
      parts.push(namesOnly ? k : `${k}:${kindOf(k, v)}`)
    }
  }
  return parts.join(depth === 0 ? "; " : ", ")
}

/* ------------------------------------------------------------------ */
/* Field-spec derivation from the contract (Phase 4B — primary path)    */
/* ------------------------------------------------------------------ */

/**
 * Same line format as `specOf`, but driven by the contract's DECLARED field
 * metadata: real kinds (html/date/id/color), enum choices rendered as
 * `choice(a|b|c)`, and complete repeater item shapes even where defaults
 * under-describe them (e.g. promo category tiles' wide/height/fit).
 */
function specFromContract(
  fields: ContractField[],
  namesOnly: boolean,
  depth = 0
): string {
  const parts: string[] = []
  for (const f of fields) {
    if (STRIP_KEYS.has(f.name)) continue
    if (f.kind === "list") {
      if (f.fields?.length && depth < 2) {
        parts.push(`${f.name}[]{${specFromContract(f.fields, namesOnly, depth + 1)}}`)
      } else {
        parts.push(`${f.name}[]`)
      }
    } else if (f.kind === "obj") {
      if (f.fields?.length && depth < 2) {
        parts.push(`${f.name}{${specFromContract(f.fields, namesOnly, depth + 1)}}`)
      }
    } else if (f.kind === "choice") {
      parts.push(
        namesOnly
          ? f.name
          : `${f.name}:${f.values?.length ? `choice(${f.values.join("|")})` : "text"}`
      )
    } else {
      parts.push(namesOnly ? f.name : `${f.name}:${f.kind}`)
    }
  }
  return parts.join(depth === 0 ? "; " : ", ")
}

/* ------------------------------------------------------------------ */
/* First-party overlays (static, never client-influenced)               */
/* ------------------------------------------------------------------ */

/** One-line, writer-facing description per type. */
const DESC: Record<string, string> = {
  hero_slider: "full-width hero slideshow",
  promo_banner_grid: "promo banner grid (intro, sale, category tiles, instagram card)",
  product_tabs: "tabbed product carousel fed by live store products",
  deal_of_day: "countdown deal spotlight for one product",
  category_showcase: "category cards row",
  brand_strip: "brand logo strip",
  rich_text: "free rich-text section",
  image_with_text: "image beside heading/copy/CTA",
  newsletter: "email signup section",
  instagram_grid: "instagram photo grid",
  testimonials: "customer quotes strip",
  image_gallery: "image gallery / collage",
  container: "free-form columns of widgets",
}

/** Render hints a writer needs (kept terse — every char is a token). */
const NOTES: Record<string, string> = {
  testimonials: 'avatar may be ""; quote <= 220 chars renders best',
  product_tabs: "products come from the store — never invent product ids or prices",
  deal_of_day: "prices and end dates are store facts — never change or invent them",
  hero_slider: "keep headings short (<= 60 chars); ctas need label + href",
  rich_text: "body is sanitized HTML — keep existing tag structure",
  newsletter: "no real email addresses; placeholder copy only",
  container:
    "widget_type in heading,text,image,button,spacer,divider,video,icon,html; edit text via columns.N.widgets.M.<prop>; never add/remove columns or change layout",
}

/** Full digest override for types whose defaults under-describe them. */
const OVERRIDE: Record<string, string> = {
  container:
    "container — free-form columns of widgets.\n" +
    "fields: layout:choice(1|2|3|4); gap{value:num, unit:text}; verticalAlign:choice(top|center|bottom); columns[]{widgets[]{widget_type:text, ...props}}",
}

/* ------------------------------------------------------------------ */
/* Style digest + whitelist (ARCH-AI §3.4 — the ONLY styling AI sees)   */
/* ------------------------------------------------------------------ */

/**
 * What Restyle may write, described to the model in ~60 tokens. Shapes match
 * what the storefront's buildSectionCss already understands (style-controls
 * emitted value shapes).
 */
export const STYLE_DIGEST =
  'STYLE (paths under "style." only): background{type:color|gradient, color, gradientFrom, gradientTo, gradientAngle:num}; ' +
  "typography{fontSize{value:num,unit}, fontWeight, textAlign, lineHeight, letterSpacing{value:num,unit}, textTransform}; " +
  "padding/margin{top,right,bottom,left,unit}; gap{value:num,unit}; radius{value:num,unit}; border{style, width{value,unit}, color}; color:text. " +
  "Prefer brand tokens var(--ff-*) for colors. Base values only — never device overrides, never advanced/custom CSS/z-index/position."

/** Segments that instantly reject a style path (defense in depth). */
const STYLE_FORBIDDEN_SEG =
  /^(advanced|elementStyles|zIndex|z|position|display|visibility|hide|hidden|custom|css|code|html|desktop|tablet|mobile|sm|md|lg|xl)$/

/** Property names a style path may END on (or pass through). */
const STYLE_ALLOWED_LEAF =
  /^(background|backgroundColor|color|textColor|overlay|overlayColor|overlayOpacity|typography|fontSize|fontWeight|fontFamily|textAlign|lineHeight|letterSpacing|textTransform|padding|margin|gap|radius|borderRadius|border|boxShadow|top|right|bottom|left|unit|value|type|gradient|gradientFrom|gradientTo|gradientAngle|width|style|inset|blur|spread|x|y|align)$/

/**
 * Validate Restyle patch paths against the whitelist. Returns human-readable
 * errors (empty = pass). ANY error rejects the WHOLE patch upstream.
 */
export function styleWhitelistErrors(paths: string[]): string[] {
  const errors: string[] = []
  for (const p of paths) {
    const segs = p.split(".")
    if (segs[0] !== "style") {
      errors.push(`"${p}": restyle may only write style.* paths`)
      continue
    }
    if (segs.length < 2) {
      errors.push(`"${p}": write a specific style property, never the whole style bag`)
      continue
    }
    if (segs.some((s) => STYLE_FORBIDDEN_SEG.test(s))) {
      errors.push(`"${p}": forbidden style key`)
      continue
    }
    // P2V F1: the ROOT property inside the bag must itself be whitelisted —
    // an invented sub-bag ("style.junk.color") must not ride in on a valid
    // LEAF name. "hover" is the one legal pass-through sub-bag (3E hover
    // state), and the property under it must be whitelisted again.
    const rootIdx = segs[1] === "hover" ? 2 : 1
    const root = segs[rootIdx]
    if (!root || !STYLE_ALLOWED_LEAF.test(root)) {
      errors.push(`"${p}": "${root ?? segs[1]}" is not a whitelisted style property`)
      continue
    }
    const leaf = segs[segs.length - 1]
    if (!STYLE_ALLOWED_LEAF.test(leaf) && !/^\d+$/.test(leaf)) {
      errors.push(`"${p}": "${leaf}" is not a whitelisted style property`)
    }
  }
  return errors
}

/* ------------------------------------------------------------------ */
/* Known-key derivation (P2V F1 — unknown/impossible fields must 422)   */
/* ------------------------------------------------------------------ */

/**
 * Validator-known OPTIONAL keys that defaultData() does not carry. Keep in
 * sync with the registry validators — today only container validates keys
 * (`gap`, `verticalAlign`) that its defaults omit.
 */
const EXTRA_ROOT_KEYS: Record<string, string[]> = {
  container: ["gap", "verticalAlign"],
}

/**
 * The set of legal TOP-LEVEL fields an AI patch may root at for a block type:
 * the registry's defaultData() keys UNIONED with the contract's declared root
 * fields (Phase 4B — the contract knows editable fields the defaults omit,
 * e.g. image_gallery layout controls; the union only ever WIDENS the set, so
 * no previously-legal patch can start failing). `style` is included because
 * restyle roots there (its interior is guarded by styleWhitelistErrors);
 * advanced/elementStyles/block_type stay excluded — applySetMap's own fences
 * reject those explicitly. Returns null for unregistered types (pass-through,
 * mirroring validateBlockData).
 */
export function knownRootKeys(type: string): Set<string> | null {
  const def = (BLOCK_REGISTRY as Record<string, any>)[type]
  if (!def) return null
  let defaults: Record<string, unknown>
  try {
    defaults = (def.defaultData() ?? {}) as Record<string, unknown>
  } catch {
    return null
  }
  const keys = new Set<string>(Object.keys(defaults))
  for (const f of CONTRACT_FIELDS[type] ?? []) keys.add(f.name)
  for (const k of EXTRA_ROOT_KEYS[type] ?? []) keys.add(k)
  keys.add("style")
  return keys
}

/**
 * The contract-declared kind of the field at a dot path on `type` (AI
 * textguard). Numeric segments skip — a list's item fields are described at
 * the list field itself. Returns null when the type or path is not described
 * by the contract; callers treat unknown as plain text (the safe default).
 */
export function contractFieldKindAt(
  type: string,
  path: string
): ContractFieldKind | null {
  let fields: ContractField[] | undefined = CONTRACT_FIELDS[type]
  if (!fields?.length) return null
  let cur: ContractField | undefined
  for (const seg of path.split(".")) {
    if (/^\d+$/.test(seg)) continue
    cur = fields?.find((f) => f.name === seg)
    if (!cur) return null
    fields = cur.fields
  }
  return cur?.kind ?? null
}

/** Contract-declared keys of the repeater item at `itemPath` (null = unknown). */
function contractItemKeys(type: string, itemPath: string): Set<string> | null {
  let fields: ContractField[] | undefined = CONTRACT_FIELDS[type]
  if (!fields) return null
  for (const seg of itemPath.split(".")) {
    if (/^\d+$/.test(seg)) continue // list index — already descended at the name
    const f: ContractField | undefined = fields.find((x) => x.name === seg)
    if (!f || (f.kind !== "list" && f.kind !== "obj") || !f.fields) return null
    fields = f.fields
  }
  return new Set(fields.map((f) => f.name))
}

/**
 * Known keys of the repeater ITEM at `itemPath` (e.g. "items.2"), derived by
 * walking defaultData() — an array segment descends into the FIRST object
 * element as the representative item shape (repeater items are homogeneous) —
 * UNIONED with the contract's declared item fields (Phase 4B: defaults often
 * under-describe items, e.g. a promo category tile's optional `wide`; the
 * union only ever widens, never rejects more). Returns null when the shape is
 * unknowable from the DEFAULTS — empty defaults list, a heterogeneous widget
 * item (container widgets carry `widget_type` and differ per widget), or a
 * path off the schema — in which case callers keep the current permissive
 * behavior (the contract never converts permissive into strict).
 */
export function knownItemKeys(type: string, itemPath: string): Set<string> | null {
  const def = (BLOCK_REGISTRY as Record<string, any>)[type]
  if (!def) return null
  let cur: any
  try {
    cur = def.defaultData() ?? {}
  } catch {
    return null
  }
  for (const seg of itemPath.split(".")) {
    if (cur == null || typeof cur !== "object") return null
    if (Array.isArray(cur)) {
      cur = cur.find((x) => x && typeof x === "object" && !Array.isArray(x))
    } else {
      cur = cur[seg]
    }
  }
  if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return null
  if ("widget_type" in cur) return null // heterogeneous widget — unknowable
  const keys = new Set<string>(Object.keys(cur))
  const fromContract = contractItemKeys(type, itemPath)
  if (fromContract) {
    for (const k of fromContract) keys.add(k)
  }
  return keys
}

/* ------------------------------------------------------------------ */
/* Compilation + cache                                                  */
/* ------------------------------------------------------------------ */

export type CompiledDigests = {
  /** Hash of the whole compiled set — stamps responses + cache keys. */
  version: string
  /** type -> digest text (2-3 lines each, ~40-80 tokens). */
  digests: Record<string, string>
  /** Tier-3 stage-1 TYPE TABLE: one names-only line per type. */
  typeTable: string
  /** The Restyle style digest (compiled in so `version` covers it). */
  styleDigest: string
}

let cache: CompiledDigests | null = null

/** Compile every registered block into its digest. Pure; call rarely. */
export function compileDigests(): CompiledDigests {
  const digests: Record<string, string> = {}
  const tableLines: string[] = []

  for (const [type, def] of Object.entries(BLOCK_REGISTRY)) {
    if (!def) continue
    // Phase 4B: contract metadata is the primary field-spec source; the
    // defaultData() shape derivation survives only as the fallback. OVERRIDE
    // types (container) keep the defaults-derived TYPE-TABLE line too — the
    // contract deliberately omits container's structural `columns`.
    const contract = OVERRIDE[type] ? undefined : CONTRACT_FIELDS[type]
    let fieldsLine: string
    let tableLine: string
    if (contract?.length) {
      fieldsLine = specFromContract(contract, false)
      tableLine = specFromContract(contract, true)
    } else {
      let defaults: Record<string, unknown> = {}
      try {
        defaults = (def.defaultData() ?? {}) as Record<string, unknown>
      } catch {
        defaults = {}
      }
      fieldsLine = specOf(defaults, false)
      tableLine = specOf(defaults, true)
    }
    const head =
      OVERRIDE[type] ??
      `${type} — ${DESC[type] ?? def.label.toLowerCase()}.\nfields: ${fieldsLine}`
    const note = NOTES[type]
    digests[type] = note ? `${head}\nnotes: ${note}` : head
    tableLines.push(`${type}: ${tableLine || "(no fields)"}`)
  }

  const typeTable = tableLines.join("\n")
  const version = crypto
    .createHash("sha256")
    .update(Object.values(digests).join("\n") + typeTable + STYLE_DIGEST, "utf8")
    .digest("hex")
    .slice(0, 12)

  return { version, digests, typeTable, styleDigest: STYLE_DIGEST }
}

/** The process-cached compiled set (compiled on first use). */
export function getDigests(): CompiledDigests {
  if (!cache) cache = compileDigests()
  return cache
}

/** Digest text for one block type (undefined for unregistered types). */
export function digestFor(type: string): string | undefined {
  return getDigests().digests[type]
}

/** The compiled-set version (for responses and cache keys). */
export function digestVersion(): string {
  return getDigests().version
}
