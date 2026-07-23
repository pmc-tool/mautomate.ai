/* ------------------------------------------------------------------ */
/* Container / Columns — PLATFORM-LEVEL HTML renderer.                   */
/*                                                                      */
/* Every store now renders through an UPLOADED Liquid theme, and no      */
/* theme can be trusted to know the composer's widget vocabulary: each   */
/* theme shipped its own `sections/container.liquid` that guessed at     */
/* field names (`title`, `cta`, `image`) that do not exist, so heading / */
/* image / button / spacer / divider / video / icon rendered as NOTHING, */
/* and no `data-col` / `data-w` markers were emitted at all — which also */
/* broke drag-drop and selection in the editor (columnAt() needs         */
/* [data-col]).                                                          */
/*                                                                      */
/* Patching 10+ published themes would not fix the NEXT uploaded theme.  */
/* So the container block is rendered by the PLATFORM, once, here — and  */
/* both Liquid render paths (theme-runtime/engine.ts `render_section`    */
/* and the editor's liquid-canvas) emit this instead of the theme's own  */
/* container template.                                                   */
/*                                                                      */
/* This is a framework-free STRING mirror of                             */
/* `@modules/cms/blocks/Container.tsx` (the React render path): the same */
/* DOM structure, the same class names, the same `data-scope` /          */
/* `data-col` / `data-w` markers, the same widget-type dispatch, the     */
/* same sanitization and video whitelisting, the same per-widget CSS via */
/* `buildWidgetCssPath`, and the same one level of `inner_section`       */
/* nesting. If you change one, change the other — they are two encodings */
/* of ONE contract, and the editor canvas and the live page must never   */
/* disagree about it.                                                    */
/*                                                                      */
/* SECURITY: every authored string is HTML-escaped on the way out. The   */
/* ONLY raw HTML is the `text` / `html` widget body, and only after the  */
/* shared @lib/util/sanitize-html. The `video` widget embeds ONLY        */
/* youtube / youtube-nocookie / vimeo iframes whose src is REBUILT onto  */
/* the whitelisted host from a strictly validated id (never the raw      */
/* input), or a plain <video> for a direct .mp4.                         */
/* ------------------------------------------------------------------ */

import { sanitizeHtml } from "@lib/util/sanitize-html"
import {
  buildColumnCss,
  buildWidgetCssPath,
  unitNumberToCss,
  type AdvancedBag,
  type StyleBag,
} from "@modules/cms/render/style-engine"
import { font, grey, radius } from "@modules/cms/editor/design"
import { isCommerceWidget } from "@modules/cms/schema/widgets"
// 3E — link value contract: themes and Liquid sections only ever see plain
// href STRINGS (flattenLinkValues); platform widgets read the object form's
// extras (new tab / nofollow) through linkAttrs.
import { flattenLinkValues, linkAttrs } from "@modules/cms/schema/types"

export interface ContainerWidget {
  widget_type?: string
  style?: StyleBag
  advanced?: AdvancedBag
  [key: string]: unknown
}

export interface ContainerColumn {
  widgets?: ContainerWidget[]
  /**
   * Column appearance bags (2E — ARCH-UX U3): the SAME diff-only
   * UNIVERSAL_STYLE vocabulary as sections/widgets, serialized by
   * buildColumnCss onto `[data-scope] [data-col="…"]`. Absent bags emit
   * NOTHING — an un-styled column renders byte-identical to before they
   * existed. `advanced` additionally drives markup-side identity
   * (anchorId → id attribute, cssClasses → extra classes) via
   * columnIdentity below.
   */
  style?: StyleBag
  advanced?: AdvancedBag
  [key: string]: unknown
}

export interface ContainerData {
  /** Column count as a string ("1".."4") — informational; we render what exists. */
  layout?: string
  gap?: { value?: number; unit?: string }
  verticalAlign?: "top" | "center" | "bottom" | string
  columns?: ContainerColumn[]
  [key: string]: unknown
}

export interface RenderContainerOptions {
  /** Stable "sec-<index>" scope — the SAME one build-context.ts uses for wrap_class. */
  scope?: string
  /**
   * EDITOR-ONLY. When true, a widget with no meaningful content (an image with
   * no src, an empty heading…) renders a visible, sized, SELECTABLE placeholder
   * instead of nothing, and an empty column renders a drop target — so a
   * merchant who just added an element sees an obvious "fill me in" box rather
   * than an invisible void. The LIVE storefront leaves this falsy and keeps
   * rendering nothing for empty widgets, exactly like Container.tsx.
   */
  editor?: boolean
  /**
   * THEME DELEGATION (Elementor structure, theme-owned rendering).
   *
   * The 12 commerce blocks (hero_slider, testimonials, product_tabs, …) are now
   * ALSO widget types, so a merchant can drop "Testimonials" straight into a
   * column instead of only as a fixed full-width section. Their markup is NOT
   * hand-written here — that would fork every theme's design. Instead the caller
   * injects a renderer that renders the THEME's own `sections/<type>.liquid`
   * with `{ section: { type, settings } }` and hands back the HTML, which we
   * splice into the column under the widget's `data-w` marker.
   *
   * Both Liquid paths supply it — theme-runtime/engine.ts (`render_section`) and
   * the editor's liquid-canvas — so the canvas and the live page agree. It is
   * OPTIONAL on purpose: this file stays framework-free and engine-free, and a
   * caller with no engine (a node script, a test) simply renders nothing for a
   * commerce widget rather than throwing.
   *
   * Returning "" (no template for that type, or a render error) MUST render
   * nothing — a merchant never sees a stack trace because a theme is missing a
   * section.
   *
   * The returned string is spliced RAW. That is the same trust level the theme
   * already has on every other section of the page: theme packages are uploaded,
   * validated and rendered by the sandboxed engine, whose default output escaping
   * already covers the merchant-authored settings that flow into them.
   */
  renderSection?: (
    type: string,
    settings: Record<string, unknown>,
    opts?: { inColumn?: boolean }
  ) => string
}

/** Widget keys that are NOT section settings (they are meta / appearance). */
const WIDGET_META_KEYS = new Set([
  "widget_type",
  "style",
  "advanced",
  "elementStyles",
  "id",
])

/**
 * A commerce widget's content props, shaped like a section's `settings` bag —
 * i.e. everything except the widget meta keys. Because the widget's fields are
 * DERIVED from the block schema (schema/widgets.ts), these keys are exactly the
 * ones the theme's `sections/<type>.liquid` already reads.
 */
export function commerceWidgetSettings(
  w: ContainerWidget
): Record<string, unknown> {
  const settings: Record<string, unknown> = {}
  for (const k of Object.keys(w)) {
    if (!WIDGET_META_KEYS.has(k)) {
      settings[k] = w[k]
    }
  }
  // 3E: hand the theme plain href strings — a LinkObject never reaches
  // Liquid. Same-reference when nothing changes, so the overwhelmingly
  // common all-string case is byte-identical.
  return flattenLinkValues(settings) as Record<string, unknown>
}

/**
 * Give a `product_tabs` settings bag its `products`, the same way the SECTION
 * path does (theme-render route for the live page, `cl.products` for the editor
 * canvas): every tab gets the resolved product cards, because the theme contract
 * promises a section never fetches. Shared by both call sites so a product_tabs
 * WIDGET is fed exactly like a product_tabs SECTION. Non-mutating.
 */
export function injectTabProducts(
  settings: Record<string, unknown>,
  products: unknown[]
): Record<string, unknown> {
  const tabs = (settings as { tabs?: unknown }).tabs
  if (!Array.isArray(tabs)) {
    return settings
  }
  return {
    ...settings,
    tabs: tabs.map((t) =>
      t && typeof t === "object" ? { ...(t as object), products } : t
    ),
  }
}

/* ------------------------------ escaping ------------------------------ */

/** Same escaper as the theme engine / theme-render route. */
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Escape a URL for an attribute AND refuse the script-bearing schemes. React
 * (Container.tsx) escapes the attribute for us but would still hand a
 * `javascript:` href to the DOM; emitting raw HTML gives us the chance to close
 * that, and dropping such a URL can never break a legitimate link.
 */
function escapeUrl(raw: unknown): string {
  const s = String(raw ?? "").trim()
  // Strip HTML entities / control chars before testing the scheme so
  // "jav&#x09;ascript:" style bypasses cannot sneak through.
  const probe = s
    .replace(/&#(\d+);?/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[\u0000-\u0020]/g, "")
    .toLowerCase()
  if (/^(javascript|vbscript|data):/.test(probe)) {
    return ""
  }
  return escapeHtml(s)
}

/** Attribute-safe class token list (mirrors what React would render verbatim). */
function escapeAttr(s: unknown): string {
  return escapeHtml(s)
}

/* ------------------------------ helpers ------------------------------ */

/* Same character class the style-engine allows in attribute selectors, so the
   stacking @media rule below and buildWidgetCssPath always agree on the scope. */
function sanitizeScope(scope: unknown): string {
  return typeof scope === "string" ? scope.replace(/[^a-zA-Z0-9_-]/g, "") : ""
}

/** Map the authored vertical alignment to the flex row's align-items. */
function alignItemsFor(v: unknown): string {
  switch (v) {
    case "center":
      return "center"
    case "bottom":
      return "flex-end"
    case "top":
    default:
      return "flex-start"
  }
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/**
 * EDITOR-ONLY (CANVAS P6 / seat 3B): the inline-editing field marker.
 * `data-edit="<field>"` names the widget prop the node's text IS;
 * `data-edit-mode` tells the canvas how to read it back ("plain" =
 * visible text, markup can never enter; "rich" = innerHTML through the
 * shared sanitizer). Emitted ONLY on the editor branch — the live
 * storefront output stays byte-identical (the storefront leaves
 * `opts.editor` falsy, exactly like the placeholder affordances).
 */
function editMarker(
  editor: boolean,
  field: string,
  mode: "plain" | "rich"
): string {
  return editor ? ` data-edit="${field}" data-edit-mode="${mode}"` : ""
}

/**
 * Markup-side column identity from the column's `advanced` bag (2E):
 * `cssClasses` → extra class tokens appended to the column div's class list
 * (leading space included), `anchorId` → an ` id="…"` attribute. Both return
 * "" when unset, so a column without them renders BYTE-IDENTICAL markup to
 * today. Values are attribute-escaped; class tokens are whitespace-collapsed.
 */
function columnIdentity(col: ContainerColumn): { cls: string; idAttr: string } {
  const a = col.advanced
  let cls = ""
  let idAttr = ""
  if (a && typeof a === "object" && !Array.isArray(a)) {
    const rawCls = (a as Record<string, unknown>).cssClasses
    if (typeof rawCls === "string" && rawCls.trim()) {
      cls = ` ${escapeAttr(rawCls.trim().replace(/\s+/g, " "))}`
    }
    const rawId = (a as Record<string, unknown>).anchorId
    if (typeof rawId === "string" && rawId.trim()) {
      idAttr = ` id="${escapeAttr(rawId.trim())}"`
    }
  }
  return { cls, idAttr }
}

/**
 * Resolve a video widget URL to a safe render target. Whitelist per the W1
 * contract: youtube.com / youtube-nocookie.com / player.vimeo.com iframe
 * embeds (the emitted src is REBUILT from the validated id, never the raw
 * input) or a plain <video> for a direct .mp4 file. Everything else → null.
 */
function resolveVideo(
  raw: unknown
): { kind: "iframe" | "mp4"; src: string } | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null
  }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (url.pathname.toLowerCase().endsWith(".mp4")) {
    // A <video> tag cannot execute script — any http(s) .mp4 host is fine.
    return { kind: "mp4", src: url.href }
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const path = url.pathname
    const id = (
      path.startsWith("/embed/")
        ? path.slice("/embed/".length)
        : path === "/watch"
        ? url.searchParams.get("v") ?? ""
        : ""
    ).split("/")[0]
    if (!/^[a-zA-Z0-9_-]{5,20}$/.test(id)) {
      return null
    }
    const base =
      host === "youtube-nocookie.com"
        ? "https://www.youtube-nocookie.com"
        : "https://www.youtube.com"
    return { kind: "iframe", src: `${base}/embed/${id}` }
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0]
    if (!/^[a-zA-Z0-9_-]{5,20}$/.test(id)) {
      return null
    }
    return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.replace(/^\/(?:video\/)?/, "").split("/")[0]
    if (!/^\d{3,15}$/.test(id)) {
      return null
    }
    return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` }
  }
  return null
}

/* ---------------------------- placeholders ---------------------------- */

const PLACEHOLDER_ICON_IMAGE =
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${grey[40]}" ` +
  `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<rect x="3" y="3" width="18" height="18" rx="2"></rect>` +
  `<circle cx="8.5" cy="8.5" r="1.6"></circle>` +
  `<path d="M21 15l-5-5L5 21"></path></svg>`

const PLACEHOLDER_ICON_GENERIC =
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${grey[40]}" ` +
  `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<rect x="3" y="3" width="18" height="18" rx="2"></rect>` +
  `<path d="M12 8v8M8 12h8"></path></svg>`

/**
 * EDITOR-ONLY visible placeholder for an empty widget. Carries the widget's own
 * `data-w` marker so it is selectable / draggable exactly like the real widget.
 */
function emptyWidgetPlaceholder(
  mark: string,
  label: string,
  minHeight: number,
  variant: "image" | "generic"
): string {
  const style =
    `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
    `gap:8px;width:100%;min-height:${minHeight}px;padding:16px 12px;box-sizing:border-box;` +
    `border:1px dashed ${grey[30]};border-radius:${radius.md}px;background:${grey[5]};` +
    `color:${grey[50]};font-family:${font};font-size:12px;font-weight:500;` +
    `text-align:center;cursor:pointer`
  const icon =
    variant === "image" ? PLACEHOLDER_ICON_IMAGE : PLACEHOLDER_ICON_GENERIC
  return (
    `<div data-w="${escapeAttr(mark)}" style="${style}">` +
    icon +
    `<span>${escapeHtml(label)}</span>` +
    `</div>`
  )
}

/**
 * EDITOR-ONLY drop target for a column with no widgets yet. Carries NO `data-w`
 * marker on purpose: it must not count as a drop sibling in the column's
 * insert-position math (an empty column always appends at index 0).
 */
function emptyColumnPlaceholder(): string {
  // Just the empty drop area — deliberately NO plus badge and NO caption. The
  // canvas paints its own permanent "+ Add widget" pill dead-centre on every
  // empty column, so a badge and caption here landed underneath it and the
  // three affordances visibly collided. The dashed box alone gives the column
  // presence; the canvas owns the call to action.
  const style =
    `display:flex;align-items:center;justify-content:center;` +
    `width:100%;min-height:110px;padding:20px 12px;box-sizing:border-box;` +
    `border:2px dashed ${grey[20]};border-radius:${radius.lg}px;background:${grey[0]}`
  return `<div style="${style}"></div>`
}

/* ------------------------------- widgets ------------------------------- */

/**
 * Render ONE widget. `mark` is its `data-w="w-…"` DOM marker — a PATH, so a
 * widget inside an inner section is addressed exactly like a top-level one
 * (see buildWidgetCssPath). `path` is the same thing as numbers, needed to
 * mark the inner section's own columns and children.
 */
interface RenderCtx {
  editor: boolean
  renderSection?: (
    type: string,
    settings: Record<string, unknown>,
    opts?: { inColumn?: boolean }
  ) => string
  /** Set by renderWidget when a commerce widget ACTUALLY produced theme markup —
   *  the layout-guard CSS is then worth emitting, and not before. */
  commerceRendered: boolean
  /** True only when the container has MORE THAN ONE column, i.e. the widget is
   *  genuinely narrow. A single-column container is full-bleed, so a theme must
   *  NOT switch to its compact in-column variant there. */
  narrow: boolean
}

function renderWidget(
  w: ContainerWidget,
  mark: string,
  path: number[],
  ctx: RenderCtx
): string {
  const editor = ctx.editor
  // A container INSIDE a column (Elementor's Inner Section). Renders the same
  // flex row as the section-level container, one level down. Its children's
  // markers extend this widget's path, so selection, styling, drag-drop and the
  // context menu all work on them with no special cases.
  if (w.widget_type === "inner_section") {
    const cols = Array.isArray(w.columns)
      ? (w.columns as ContainerColumn[]).filter(
          (c): c is ContainerColumn => !!c && typeof c === "object"
        )
      : []
    const gap = unitNumberToCss(w.gap as any, "px") ?? "20px"
    const rowStyle =
      `display:flex;width:100%;min-width:0;gap:${gap};` +
      `align-items:${alignItemsFor(w.verticalAlign)}`
    let out =
      `<div data-w="${escapeAttr(mark)}" class="ff-inner-section" style="${rowStyle}">`
    cols.forEach((col, c) => {
      const widgets = Array.isArray(col.widgets) ? col.widgets : []
      const colPath = [...path, c]
      const ident = columnIdentity(col)
      out +=
        `<div class="ff-container-col ff-inner-col${ident.cls}" ` +
        `data-col="${escapeAttr(colPath.join("-"))}"${ident.idAttr} style="flex:1;min-width:0">`
      if (widgets.some((cw) => cw && typeof cw === "object")) {
        widgets.forEach((cw, i) => {
          if (cw && typeof cw === "object") {
            out += renderWidget(
              cw,
              `w-${[...colPath, i].join("-")}`,
              [...colPath, i],
              ctx
            )
          }
        })
      } else if (editor) {
        out += emptyColumnPlaceholder()
      }
      out += `</div>`
    })
    out += `</div>`
    return out
  }

  switch (w.widget_type) {
    case "heading": {
      const text = typeof w.text === "string" ? w.text : ""
      const level = typeof w.level === "string" ? w.level : "h2"
      const tag = HEADING_TAGS.has(level) ? level : "h2"
      if (editor && !text.trim()) {
        return emptyWidgetPlaceholder(mark, "Empty heading", 48, "generic")
      }
      return (
        `<${tag} data-w="${escapeAttr(mark)}"` +
        `${editMarker(editor, "text", "plain")}>${escapeHtml(text)}</${tag}>`
      )
    }
    case "text":
    case "html": {
      const raw = typeof w.html === "string" ? w.html : ""
      if (!raw.trim()) {
        return editor
          ? emptyWidgetPlaceholder(mark, "Empty text", 56, "generic")
          : ""
      }
      return (
        `<div data-w="${escapeAttr(mark)}"` +
        `${editMarker(editor, "html", "rich")}>${sanitizeHtml(raw)}</div>`
      )
    }
    case "image": {
      const src = typeof w.src === "string" ? w.src.trim() : ""
      if (!src) {
        return editor
          ? emptyWidgetPlaceholder(mark, "Choose an image", 140, "image")
          : ""
      }
      const alt = typeof w.alt === "string" ? w.alt : ""
      // 3E: read through linkAttrs — a plain string stays href-only
      // (byte-identical markup); the object form adds target/rel.
      const a = linkAttrs(w.href)
      const href = a.href.trim()
      const img =
        `<img data-w="${escapeAttr(mark)}" src="${escapeUrl(src)}" ` +
        `alt="${escapeHtml(alt)}" style="max-width:100%">`
      return href
        ? `<a href="${escapeUrl(href)}"` +
            (a.target ? ` target="_blank"` : "") +
            (a.rel ? ` rel="${escapeAttr(a.rel)}"` : "") +
            `>${img}</a>`
        : img
    }
    case "button": {
      const label = typeof w.label === "string" ? w.label : ""
      if (editor && !label.trim()) {
        return emptyWidgetPlaceholder(mark, "Empty button", 44, "generic")
      }
      // 3E: same linkAttrs read as the image widget — string-valued hrefs
      // emit exactly the previous markup.
      const a = linkAttrs(w.href)
      const href = a.href.trim() ? a.href : "#"
      const className =
        w.variant === "outline"
          ? "btn btn-outline-dark btn-hover-dark"
          : "btn btn-dark btn-outline-hover-dark"
      const safeHref = escapeUrl(href) || "#"
      return (
        `<a data-w="${escapeAttr(mark)}"${editMarker(editor, "label", "plain")}` +
        ` class="${className}" href="${safeHref}"` +
        (a.target ? ` target="_blank"` : "") +
        (a.rel ? ` rel="${escapeAttr(a.rel)}"` : "") +
        `>${escapeHtml(label)}</a>`
      )
    }
    case "spacer": {
      const height = unitNumberToCss(w.height, "px") ?? "50px"
      return (
        `<div data-w="${escapeAttr(mark)}" aria-hidden="true" ` +
        `style="height:${height}"></div>`
      )
    }
    case "divider":
      return `<hr data-w="${escapeAttr(mark)}">`
    case "video": {
      const video = resolveVideo(w.url)
      if (!video) {
        return editor
          ? emptyWidgetPlaceholder(mark, "Choose a video", 120, "image")
          : ""
      }
      if (video.kind === "mp4") {
        return (
          `<video data-w="${escapeAttr(mark)}" controls ` +
          `src="${escapeUrl(video.src)}" style="width:100%"></video>`
        )
      }
      return (
        `<div data-w="${escapeAttr(mark)}" ` +
        `style="position:relative;width:100%;padding-top:56.25%">` +
        `<iframe src="${escapeUrl(video.src)}" title="Video" ` +
        `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
        `allowfullscreen ` +
        `style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>` +
        `</div>`
      )
    }
    case "icon": {
      const icon = typeof w.icon === "string" ? w.icon.trim() : ""
      if (!icon) {
        return editor
          ? emptyWidgetPlaceholder(mark, "Choose an icon", 56, "generic")
          : ""
      }
      const fontSize = unitNumberToCss(w.size, "px")
      return (
        `<i data-w="${escapeAttr(mark)}" class="${escapeAttr(icon)}" aria-hidden="true"` +
        (fontSize ? ` style="font-size:${fontSize}"` : "") +
        `></i>`
      )
    }
    default: {
      // A COMMERCE widget (hero_slider, testimonials, product_tabs, …): the
      // markup belongs to the THEME, so delegate to the injected renderer,
      // which renders `sections/<type>.liquid` for this store's active theme.
      // The structure is Elementor's; the rendering stays theme-owned, so the
      // widget automatically matches the merchant's design.
      if (isCommerceWidget(w.widget_type)) {
        const type = String(w.widget_type)
        let inner = ""
        if (ctx.renderSection) {
          try {
            inner =
              ctx.renderSection(type, commerceWidgetSettings(w), {
                inColumn: ctx.narrow,
              }) || ""
          } catch {
            // A broken/async theme template must never take the page down.
            inner = ""
          }
        }
        if (!inner.trim()) {
          // No template for this type in this theme, a render error, or no
          // renderer at all (framework-free caller) — render NOTHING live, and
          // a selectable placeholder in the editor so the merchant sees why.
          return editor
            ? emptyWidgetPlaceholder(mark, `No theme markup for ${type}`, 120, "generic")
            : ""
        }
        // Commerce sections are authored FULL-WIDTH. Inside a column they are
        // boxed: `width:100%;min-width:0` makes them inherit the column width
        // instead of forcing the flex row wider, and the scoped CSS emitted by
        // renderContainerHtml caps their media at the box. See the report /
        // ff-commerce-widget rule below for the types that still read cramped.
        ctx.commerceRendered = true
        return (
          `<div data-w="${escapeAttr(mark)}" class="ff-commerce-widget" ` +
          `data-widget-type="${escapeAttr(type)}">${inner}</div>`
        )
      }
      // Unknown / not-yet-registered widget type — degrade silently.
      return ""
    }
  }
}

/* -------------------------------- root -------------------------------- */

/**
 * Render a `container` section to HTML. Framework-free: safe to call from the
 * Liquid engine (server), from the editor canvas (browser) and from a node
 * script.
 */
export function renderContainerHtml(
  data: ContainerData | null | undefined,
  opts: RenderContainerOptions = {}
): string {
  const props: ContainerData = data && typeof data === "object" ? data : {}
  const editor = opts.editor === true
  const scope = sanitizeScope(opts.scope)
  const columns = Array.isArray(props.columns)
    ? props.columns.filter(
        (c): c is ContainerColumn => !!c && typeof c === "object"
      )
    : []
  const ctx: RenderCtx = {
    editor,
    renderSection: opts.renderSection,
    commerceRendered: false,
    // A 1-column container spans the page, so a commerce widget in it is NOT
    // narrow and must keep its full-width design. Only 2+ columns are cramped.
    narrow: columns.length > 1,
  }
  const gap = unitNumberToCss(props.gap, "px") ?? "30px"

  // ONE <style> tag: per-widget scoped CSS (shared engine — buildWidgetCssPath
  // returns "" for widgets with no style/advanced and for an empty scope) plus
  // a small stacking rule so columns wrap to a single column on mobile. Walk
  // columns → widgets, and DOWN INTO any inner section's own columns, so a
  // nested widget's style is emitted exactly like a top-level one. The path is
  // what makes that possible: it is both the CSS selector and the DOM marker.
  /* MARKUP FIRST, then CSS. The two are assembled in the opposite order (the
     <style> precedes the row), but the layout-guard rules below must only be
     emitted when a commerce widget ACTUALLY rendered theme markup — which is
     only knowable after the walk. Rendering into a local and concatenating at
     the end keeps the output for a container with no commerce widget
     byte-identical to before this change. */
  let row =
    `<div class="ff-container-row" style="display:flex;width:100%;min-width:0;` +
    `gap:${gap};align-items:${alignItemsFor(props.verticalAlign)}">`
  columns.forEach((col, c) => {
    const widgets = Array.isArray(col.widgets) ? col.widgets : []
    const ident = columnIdentity(col)
    row += `<div class="ff-container-col${ident.cls}" data-col="${c}"${ident.idAttr} style="flex:1;min-width:0">`
    if (widgets.some((w) => w && typeof w === "object")) {
      widgets.forEach((w, i) => {
        if (w && typeof w === "object") {
          row += renderWidget(w, `w-${c}-${i}`, [c, i], ctx)
        }
      })
    } else if (editor) {
      row += emptyColumnPlaceholder()
    }
    row += `</div>`
  })
  row += `</div>`

  let css = ""
  const collect = (cols: ContainerColumn[], base: number[]) => {
    cols.forEach((col, c) => {
      // Column bags (2E) — emitted BEFORE the column's widgets so the cascade
      // reads outer-to-inner. buildColumnCss returns "" for bag-less columns
      // and for an empty scope, keeping today's output byte-identical.
      /* 3C: in the EDITOR, suppress hide emission (opts.hide=false) so hidden
         columns/widgets ghost at 40% instead of vanishing. Production passes
         undefined — byte-identical output. */
      css += buildColumnCss(
        scope,
        [...base, c],
        col.style,
        col.advanced,
        ctx.editor ? { hide: false } : undefined
      )
      const widgets = Array.isArray(col.widgets) ? col.widgets : []
      widgets.forEach((w, i) => {
        if (!w || typeof w !== "object") {
          return
        }
        const path = [...base, c, i]
        css += buildWidgetCssPath(
          scope,
          path,
          w.style,
          w.advanced,
          ctx.editor ? { hide: false } : undefined
        )
        if (w.widget_type === "inner_section" && Array.isArray(w.columns)) {
          collect(
            (w.columns as ContainerColumn[]).filter(
              (x): x is ContainerColumn => !!x && typeof x === "object"
            ),
            path
          )
        }
      })
    })
  }
  collect(columns, [])

  if (scope && columns.length > 1) {
    css += `@media (max-width:767px){[data-scope="${scope}"] .ff-container-row{flex-direction:column}}`
  }
  // Inner sections stack on mobile too — a 2-column inner section inside an
  // already-narrow column is unreadable otherwise.
  if (scope) {
    css += `@media (max-width:767px){[data-scope="${scope}"] .ff-inner-section{flex-direction:column}}`
  }

  /* A commerce widget is a FULL-WIDTH section's markup living inside a column
     box. Two things must hold or it visibly breaks the layout:
       - the box itself must not push the flex row wider than its share
         (width:100%;min-width:0), and
       - the section's own media must cap at the box rather than overflow it.
     Themes universally wrap a section's body in a centring wrapper with a fixed
     max-width and side gutters — `.container` (bootstrap), `.lz-container`
     (learts-liquid), `.aq-container` (bazaro) — sized for a FULL-WIDTH section.
     Inside a 400px column those gutters eat most of the box and the max-width is
     meaningless, so we neutralise them for any such wrapper INSIDE the widget.
     The [class*="container"] match is deliberately name-agnostic: theme authors
     pick their own prefix, and this must work for the NEXT uploaded theme too.
     Nothing here touches a FLAT section — every selector is under
     .ff-commerce-widget, which only the widget path ever emits. */
  if (ctx.commerceRendered) {
    // Scoped when we have a scope; otherwise the bare class — these are layout
    // guards, not styling, and they must not depend on a section being styled.
    const sel = scope
      ? `[data-scope="${scope}"] .ff-commerce-widget`
      : `.ff-commerce-widget`
    css +=
      `${sel}{width:100%;min-width:0;overflow-x:clip}` +
      `${sel} img,${sel} video,${sel} iframe{max-width:100%}` +
      `${sel} [class*="container"]{width:auto;max-width:100%;padding-left:0;padding-right:0;margin-left:0;margin-right:0}`
  }

  let out = `<div class="ff-container"${scope ? ` data-scope="${scope}"` : ""}>`
  if (css) {
    // A "<" is never legitimate CSS, so stripping it cannot corrupt a rule but
    // makes closing the <style> element impossible.
    out += `<style>${css.replace(/</g, "")}</style>`
  }
  /* width:100% + min-width:0 (on `row`, built above) are LOAD-BEARING, not
     decoration. A flex row with an auto width sits in a shrink-to-fit context
     the moment anything above or inside it says so — and pasted foreign markup
     can do exactly that. When it happens the row collapses to ZERO width, every
     word inside wraps one character per line, and the section becomes a
     several-hundred-pixel blank ribbon with the content invisible inside it. */
  out += row
  out += `</div>`
  return out
}

export default renderContainerHtml
