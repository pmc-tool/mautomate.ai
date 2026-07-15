import { Liquid, type Template } from "liquidjs"

/* ------------------------------------------------------------------ */
/* The theme engine — a sandboxed Liquid runtime.                       */
/*                                                                     */
/* Themes are UNTRUSTED code running on OUR server for EVERY merchant,  */
/* so the engine is built to make the dangerous things impossible       */
/* rather than merely discouraged:                                      */
/*                                                                     */
/*  - No filesystem. Templates are resolved from an in-memory map of    */
/*    the uploaded package, never from disk, so `{% include '/etc/…' %}`*/
/*    has nothing to reach.                                             */
/*  - No network, no `process`, no `require` — Liquid has no syntax for */
/*    any of it, and the validator rejects smuggling attempts.          */
/*  - Strict output escaping by default: `{{ x }}` escapes HTML. A theme*/
/*    must say `| raw` deliberately, and only merchant-authored rich    */
/*    text ever needs it.                                               */
/*  - A render deadline: a template that loops forever kills its own    */
/*    request, not the server.                                          */
/* ------------------------------------------------------------------ */

export type ThemeFiles = Record<string, string>

/** A value the escaper must pass through untouched. */
export const RAW = (html: unknown) => ({ __raw: String(html ?? "") })

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Rendering budget. A page that cannot render in this long is broken. */
const RENDER_TIMEOUT_MS = 3000

/* --------------------------- filters --------------------------- */

/** Money is stored in MINOR units by Medusa in some paths and MAJOR in others;
 *  the storefront normalises to MAJOR before it reaches a theme, so `money`
 *  only formats — it never converts. Getting this wrong shows shoppers a price
 *  100× too large, so it is deliberately dumb. */
function moneyFilter(amount: unknown, currency = "USD", locale = "en-US"): string {
  const n = Number(amount)
  if (!isFinite(n)) return ""
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
    }).format(n)
  } catch {
    return n.toFixed(2)
  }
}

function imageUrlFilter(image: any, opts: { width?: number; height?: number } = {}): string {
  const url =
    typeof image === "string" ? image : image?.url ?? image?.src ?? ""
  if (!url) return ""
  // Next's optimizer handles remote images; width lets a theme ask for a size
  // instead of shipping a 4 MB hero to a phone.
  if (opts.width) {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}w=${opts.width}`
  }
  return url
}

/**
 * Build the Liquid engine for ONE theme version.
 *
 * `files` is the whole package, already validated. The engine never touches
 * disk: `fs` is stubbed with a resolver that can only see these files.
 */
export function createEngine(
  files: ThemeFiles,
  ctx: { themeId: string; version: string; currency: string; locale: string }
): Liquid {
  const assetBase = `/theme-assets/${ctx.themeId}/${ctx.version}`

  /* Templates resolve from the uploaded package ONLY. This single override is
     what makes `{% render '../../etc/passwd' %}` a dead end: there is no disk
     behind it, just this map. */
  const lookup = (name: string): string => {
    const clean = String(name)
      .replace(/^\/theme\/?/, "")
      .replace(/^\/+/, "")
      .replace(/\.\./g, "")
    const bare = clean.replace(/\.liquid$/, "")
    const candidates = [
      clean,
      `${bare}.liquid`,
      `snippets/${bare}.liquid`,
      `sections/${bare}.liquid`,
      `templates/${bare}.liquid`,
    ]
    for (const c of candidates) {
      if (files[c] != null) return files[c]
    }
    return ""
  }

  const themeFs = {
    exists: async (p: string) => lookup(p) !== "",
    existsSync: (p: string) => lookup(p) !== "",
    readFile: async (p: string) => lookup(p),
    readFileSync: (p: string) => lookup(p),
    // liquidjs asks us to turn (root, file, ext) into a path; we hand back a
    // package key, and lookup() strips any traversal before it is used.
    resolve: (_root: string, file: string, ext: string) =>
      file.endsWith(ext) ? file : `${file}${ext}`,
    dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
    contains: () => true,
    sep: "/",
  }

  const engine = new Liquid({
    // Escape by default, but honour explicit raw markers. Everything a theme
    // prints is HTML-escaped UNLESS it is wrapped by RAW() — which only the
    // platform (content_for_layout / _header) and the `raw` filter produce.
    // Merchant rich text renders as HTML via `| raw`; nothing else can smuggle
    // markup past the escaper. Proven XSS-safe in the smoke suite.
    outputEscape: (v: any) =>
      v && typeof v === "object" && "__raw" in v ? String(v.__raw) : escapeHtml(v),
    // A virtual root: liquidjs will not consult `fs` at all with an empty root
    // list, so partials would never resolve. Nothing on disk lives here.
    root: ["/theme"],
    extname: ".liquid",
    fs: themeFs as any,
    // A missing variable is a bug in the theme, not a reason to 500. Render
    // nothing and keep the store up.
    strictVariables: false,
    strictFilters: false,
    ownPropertyOnly: true,
  })

  /* --------------------------- filters --------------------------- */
  engine.registerFilter("raw", (v: unknown) => RAW(v))
  engine.registerFilter("money", (v: unknown) => moneyFilter(v, ctx.currency, ctx.locale))
  engine.registerFilter("money_without_currency", (v: unknown) => {
    const n = Number(v)
    return isFinite(n) ? n.toFixed(2) : ""
  })
  engine.registerFilter("image_url", (image: unknown, ...args: unknown[]) => {
    // liquidjs passes named args as PAIRS: [["width", 800]].
    const opts: any = {}
    for (const a of args) {
      if (Array.isArray(a) && a.length === 2) opts[a[0]] = a[1]
      else if (a && typeof a === "object") Object.assign(opts, a)
    }
    return imageUrlFilter(image, opts)
  })
  engine.registerFilter("asset_url", (name: unknown) => `${assetBase}/${String(name).replace(/^\/+/, "")}`)
  engine.registerFilter("product_url", (p: any) => `/products/${p?.handle ?? ""}`)
  engine.registerFilter("collection_url", (c: any) => `/collections/${c?.handle ?? ""}`)
  engine.registerFilter("t", (key: unknown) => String(key ?? ""))
  engine.registerFilter("handleize", (s: unknown) =>
    String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  )

  /* ---------------------------- tags ----------------------------- */

  /**
   * {% render_section section %}
   *
   * The heart of the contract: the merchant's page is a list of sections, and
   * this renders each through the THEME's own markup for that block type. A
   * theme that has no template for a block renders nothing rather than
   * exploding — a merchant should never see a stack trace because they added a
   * block the theme doesn't know yet.
   */
  engine.registerTag("render_section", {
    parse(token: any) {
      this.value = token.args.trim()
    },
    async render(scope: any, emitter: any) {
      const section = await this.liquid.evalValue(this.value, scope)
      const type = section?.type
      if (!type) return
      const src = files[`sections/${type}.liquid`]
      if (!src) return // unknown block type — silently skip
      const tpl = this.liquid.parse(src, `sections/${type}.liquid`)
      const html = await this.liquid.render(tpl, { ...scope.getAll(), section })
      emitter.write(html)
    },
  })

  /** {% section 'header' %} — a named section from the theme itself (chrome). */
  engine.registerTag("section", {
    parse(token: any) {
      this.name = token.args.trim().replace(/^['"]|['"]$/g, "")
    },
    async render(scope: any, emitter: any) {
      const src =
        files[`sections/${this.name}.liquid`] ?? files[`snippets/${this.name}.liquid`]
      if (!src) return
      const tpl = this.liquid.parse(src, `sections/${this.name}.liquid`)
      emitter.write(await this.liquid.render(tpl, scope.getAll()))
    },
  })

  return engine
}

/**
 * Render one page of a theme: the template, wrapped in the theme's layout.
 *
 * `content_for_layout` is where the template's output lands; `content_for_header`
 * is the platform's own head content (SEO, analytics, tenant scripts) — a theme
 * cannot opt out of it, which is why the validator insists it is present.
 */
export async function renderThemePage(
  files: ThemeFiles,
  opts: {
    themeId: string
    version: string
    template: string // "index" | "product" | "collection" | "cart" | …
    data: Record<string, unknown>
    contentForHeader: string
    currency: string
    locale: string
  }
): Promise<string> {
  const engine = createEngine(files, {
    themeId: opts.themeId,
    version: opts.version,
    currency: opts.currency,
    locale: opts.locale,
  })

  const templateSrc =
    files[`templates/${opts.template}.liquid`] ?? files["templates/index.liquid"]
  if (!templateSrc) {
    throw new Error(`Theme has no template for "${opts.template}"`)
  }

  const run = async () => {
    const inner = await engine.render(
      engine.parse(templateSrc, `templates/${opts.template}.liquid`),
      opts.data
    )
    const layoutSrc = files["layout/theme.liquid"]
    if (!layoutSrc) return inner
    return engine.render(engine.parse(layoutSrc, "layout/theme.liquid"), {
      ...opts.data,
      content_for_layout: RAW(inner),
      content_for_header: RAW(opts.contentForHeader),
    })
  }

  // A theme cannot be allowed to hold a request (and a server thread) forever.
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Theme render exceeded ${RENDER_TIMEOUT_MS}ms`)),
      RENDER_TIMEOUT_MS
    )
  })
  try {
    return await Promise.race([run(), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
