/* ------------------------------------------------------------------ */
/* Theme package validator — the gate every upload must pass.           */
/*                                                                     */
/* A theme runs on OUR servers for EVERY merchant, so this file is a    */
/* security boundary, not a linter. It is deliberately paranoid: it     */
/* refuses anything it does not positively understand, because the cost */
/* of a false accept (one tenant reading another's data, or the whole   */
/* platform going down) is unbounded, while the cost of a false reject  */
/* is a developer reading an error message.                            */
/*                                                                     */
/* Runs identically in the upload route and in `mautomate theme check`, */
/* so a developer never discovers a rejection only at upload time.      */
/* ------------------------------------------------------------------ */

export type ThemeFile = { path: string; size: number; content: Buffer }

export type Violation = {
  /** "error" blocks the upload; "warning" is advisory. */
  level: "error" | "warning"
  path?: string
  line?: number
  message: string
}

export type ThemeManifest = {
  id: string
  name: string
  version: string
  engine?: string
  author?: string
  description?: string
  tokens?: {
    colors?: Record<string, string>
    fonts?: Record<string, string>
  }
  settings?: ThemeSetting[]
}

export type ThemeSetting = {
  id?: string
  type: string
  label?: string
  default?: unknown
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  unit?: string
}

/* ---------------- Limits ---------------- */
export const LIMITS = {
  maxTotalBytes: 20 * 1024 * 1024, // 20 MB
  maxFiles: 2000,
  maxFileBytes: 5 * 1024 * 1024,
  maxTemplateBytes: 512 * 1024,
}

/** Files a theme cannot render without. */
const REQUIRED = [
  "theme.json",
  "preview.png",
  "layout/theme.liquid",
  "templates/index.liquid",
  "templates/product.liquid",
  "templates/collection.liquid",
  "templates/list-collections.liquid",
  "templates/cart.liquid",
]

/** The 13 block types the page builder can emit. A theme that renders none of
 *  them is not a storefront theme; a theme missing some degrades gracefully. */
export const BLOCK_TYPES = [
  "hero_slider",
  "promo_banner_grid",
  "product_tabs",
  "deal_of_day",
  "category_showcase",
  "brand_strip",
  "rich_text",
  "image_with_text",
  "newsletter",
  "instagram_grid",
  "testimonials",
  "image_gallery",
  "container",
]

const SETTING_TYPES = new Set([
  "text", "textarea", "richtext", "number", "range", "checkbox",
  "select", "color", "font", "image", "url", "header",
])

const ASSET_EXT = new Set([
  ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".ico", ".json", ".txt", ".map",
])

const SAFE_PATH = /^[a-z0-9][a-z0-9._/-]*$/

/**
 * Server-side execution attempts. Liquid itself cannot execute code, so these
 * patterns are looking for a theme trying to smuggle code into a context that
 * DOES execute — our Node process, or another engine we might add later.
 */
const CODE_PATTERNS: { re: RegExp; message: string }[] = [
  { re: /<\?php|<\?=/i, message: "PHP tags are not allowed" },
  { re: /\brequire\s*\(/, message: "`require()` is not allowed in a template" },
  { re: /\bprocess\s*\.\s*(env|exit|binding)/, message: "Access to `process` is not allowed" },
  { re: /\bchild_process\b|\bexecSync\b|\bspawnSync\b/, message: "Process execution is not allowed" },
  { re: /\bglobalThis\b|\b__proto__\b|\bconstructor\s*\[/, message: "Prototype / global access is not allowed" },
  { re: /\beval\s*\(|\bnew\s+Function\s*\(/, message: "Dynamic code evaluation is not allowed" },
  { re: /\bfs\s*\.\s*(read|write|unlink|append)/, message: "Filesystem access is not allowed" },
]


/* ------------------------------------------------------------------ *
 * The loop budget.
 *
 * A CPU-bound Liquid loop BLOCKS Node's event loop, so a render timeout can
 * never fire — one theme with `{% for i in (1..100000000) %}` would hang the
 * server for every tenant. (Proven: an early test hung for two minutes, then
 * died of an out-of-memory abort.)
 *
 * Reimplementing `for` with a runtime cap was tried and rejected — it broke
 * six correct Liquid behaviours. Instead we close the door where it opens:
 * Liquid has no `while`, so iteration comes only from (a) a literal range the
 * author typed — statically visible, checked here — or (b) a collection WE
 * pass in, which the platform already bounds.
 * ------------------------------------------------------------------ */

const MAX_TEMPLATE_ITERATIONS = 100_000
const MAX_SINGLE_RANGE = 10_000

const FOR_TAG = /\{%-?\s*for\s+([\s\S]*?)-?%\}/g
const END_FOR = /\{%-?\s*endfor\s*-?%\}/g
const RANGE = /\(\s*(\d+)\s*\.\.\s*(\d+)\s*\)/

function analyseLoops(src: string): { worst: number; problems: { line?: number; message: string }[] } {
  type Ev = { at: number; kind: "for" | "endfor"; args?: string }
  const events: Ev[] = []
  let m: RegExpExecArray | null

  FOR_TAG.lastIndex = 0
  while ((m = FOR_TAG.exec(src))) events.push({ at: m.index, kind: "for", args: m[1] })
  END_FOR.lastIndex = 0
  while ((m = END_FOR.exec(src))) events.push({ at: m.index, kind: "endfor" })
  events.sort((a, b) => a.at - b.at)

  const problems: { line?: number; message: string }[] = []
  const stack: number[] = []
  let worst = 1

  for (const ev of events) {
    if (ev.kind === "for") {
      const r = RANGE.exec(ev.args ?? "")
      let span = 1
      if (r) {
        span = Math.max(0, Number(r[2]) - Number(r[1]) + 1)
        if (span > MAX_SINGLE_RANGE) {
          problems.push({
            line: src.slice(0, ev.at).split("\n").length,
            message: `Loop over ${span.toLocaleString()} items (max ${MAX_SINGLE_RANGE.toLocaleString()}). On a shared server a loop this size takes every other store down with it.`,
          })
        }
      }
      stack.push(span)
      worst = Math.max(worst, stack.reduce((a, b) => a * b, 1))
    } else {
      stack.pop()
    }
  }

  if (worst > MAX_TEMPLATE_ITERATIONS) {
    problems.push({
      message: `Nested loops can produce ${worst.toLocaleString()} passes (max ${MAX_TEMPLATE_ITERATIONS.toLocaleString()}). Reduce the ranges or flatten the loops.`,
    })
  }
  return { worst, problems }
}

/** Inline <script> in a TEMPLATE (assets/*.js is where JavaScript belongs). */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>/i

/** Network calls made from a TEMPLATE (client JS in assets/ is fine). */
const TEMPLATE_NETWORK = /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/;

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length
}

/**
 * Validate a decompressed theme package.
 *
 * Returns every violation found — not just the first — because a developer
 * fixing one problem at a time is a developer who stops using the platform.
 */
export function validateTheme(files: ThemeFile[]): {
  ok: boolean
  manifest: ThemeManifest | null
  violations: Violation[]
} {
  const v: Violation[] = []
  const err = (message: string, path?: string, line?: number) =>
    v.push({ level: "error", message, path, line })
  const warn = (message: string, path?: string) =>
    v.push({ level: "warning", message, path })

  /* ---- shape of the package ---- */
  if (files.length > LIMITS.maxFiles) {
    err(`Too many files: ${files.length} (max ${LIMITS.maxFiles})`)
  }
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > LIMITS.maxTotalBytes) {
    err(`Package is ${(total / 1048576).toFixed(1)} MB (max ${LIMITS.maxTotalBytes / 1048576} MB)`)
  }

  const byPath = new Map<string, ThemeFile>()
  for (const f of files) {
    // Path safety FIRST — a traversal is a break-in attempt, not a typo.
    if (f.path.includes("..") || f.path.startsWith("/") || f.path.includes("\\")) {
      err("Path escapes the package root", f.path)
      continue
    }
    if (!SAFE_PATH.test(f.path)) {
      err("Illegal characters in path (use lowercase a-z 0-9 . _ - /)", f.path)
      continue
    }
    if (f.size > LIMITS.maxFileBytes) {
      err(`File is ${(f.size / 1048576).toFixed(1)} MB (max ${LIMITS.maxFileBytes / 1048576} MB)`, f.path)
    }
    byPath.set(f.path, f)
  }

  /* ---- required files ---- */
  for (const req of REQUIRED) {
    if (!byPath.has(req)) {
      err(`Missing required file: ${req}`)
    }
  }

  /* ---- manifest ---- */
  let manifest: ThemeManifest | null = null
  const manifestFile = byPath.get("theme.json")
  if (manifestFile) {
    try {
      manifest = JSON.parse(manifestFile.content.toString("utf8"))
    } catch (e: any) {
      err(`theme.json is not valid JSON: ${e?.message ?? e}`, "theme.json")
    }
  }

  if (manifest) {
    if (!/^[a-z][a-z0-9-]{1,38}$/.test(manifest.id ?? "")) {
      err("`id` must be lowercase, 2-39 chars, a-z 0-9 and dashes — and must never change between versions", "theme.json")
    }
    if (!manifest.name?.trim()) {
      err("`name` is required", "theme.json")
    }
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
      err("`version` must be semver, e.g. 1.2.0", "theme.json")
    }
    if (manifest.engine && manifest.engine !== "1") {
      err(`Unsupported engine "${manifest.engine}" — this platform speaks engine 1`, "theme.json")
    }

    for (const [i, s] of (manifest.settings ?? []).entries()) {
      if (!SETTING_TYPES.has(s.type)) {
        err(`settings[${i}]: unknown type "${s.type}"`, "theme.json")
      }
      if (s.type !== "header" && !s.id) {
        err(`settings[${i}]: an \`id\` is required (it is how the theme reads the value)`, "theme.json")
      }
      if (s.type === "select" && !(s.options?.length)) {
        err(`settings[${i}]: a select needs \`options\``, "theme.json")
      }
    }
  }

  /* ---- templates: the security scan ---- */
  for (const f of files) {
    const isTemplate = /\.liquid$/.test(f.path)
    const isAsset = f.path.startsWith("assets/")

    if (isTemplate) {
      if (f.size > LIMITS.maxTemplateBytes) {
        err(`Template is over ${LIMITS.maxTemplateBytes / 1024} KB — split it into snippets`, f.path)
      }
      const text = f.content.toString("utf8")

      for (const { re, message } of CODE_PATTERNS) {
        const m = re.exec(text)
        if (m) {
          err(message, f.path, lineOf(text, m.index))
        }
      }
      const s = INLINE_SCRIPT.exec(text)
      if (s) {
        err(
          "Inline <script> in a template — put JavaScript in assets/ and load it with a src",
          f.path,
          lineOf(text, s.index)
        )
      }
      const n = TEMPLATE_NETWORK.exec(text)
      if (n) {
        err(
          "Network calls are not allowed from a template (client-side fetch in assets/*.js is fine)",
          f.path,
          lineOf(text, n.index)
        )
      }

      // The loop budget — see analyseLoops(). This is the DoS gate.
      for (const p of analyseLoops(text).problems) {
        err(p.message, f.path, p.line)
      }
      continue
    }

    if (isAsset) {
      const ext = f.path.slice(f.path.lastIndexOf("."))
      if (!ASSET_EXT.has(ext)) {
        err(`Asset type "${ext}" is not allowed`, f.path)
      }
      continue
    }

    // Anything that is neither a template, an asset, nor a known root file.
    if (!["theme.json", "preview.png"].includes(f.path)) {
      warn("File is outside templates/, sections/, snippets/, layout/ and assets/ — it will be ignored", f.path)
    }
  }

  /* ---- the two hooks the platform cannot live without ---- */
  const layout = byPath.get("layout/theme.liquid")
  if (layout) {
    const text = layout.content.toString("utf8")
    if (!text.includes("content_for_layout")) {
      err("layout/theme.liquid must output {{ content_for_layout }} — that is where the page renders", "layout/theme.liquid")
    }
    if (!text.includes("content_for_header")) {
      err("layout/theme.liquid must output {{ content_for_header }} — it carries SEO, analytics and store scripts", "layout/theme.liquid")
    }
  }

  /* ---- sections: advisory, because themes may ship progressively ---- */
  const missingSections = BLOCK_TYPES.filter(
    (t) => !byPath.has(`sections/${t}.liquid`)
  )
  if (missingSections.length === BLOCK_TYPES.length) {
    err("No section templates found — a theme must render at least one block type from sections/")
  } else if (missingSections.length) {
    warn(
      `No template for: ${missingSections.join(", ")}. A merchant who adds one of these blocks will see nothing.`
    )
  }

  return {
    ok: !v.some((x) => x.level === "error"),
    manifest,
    violations: v,
  }
}
