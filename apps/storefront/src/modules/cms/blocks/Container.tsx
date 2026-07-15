/* ------------------------------------------------------------------ */
/* Container / Columns — arbitrary layout composition (Composer W1)     */
/*                                                                     */
/* The one block whose data is COMPOSED rather than fixed: it holds     */
/* `columns: Array<{ widgets: Widget[] }>` where each widget is          */
/* { widget_type, style?, advanced?, ...contentProps } (see              */
/* schema/widgets.ts). One level of nesting — widgets cannot contain     */
/* containers.                                                           */
/*                                                                       */
/* Pure presentational, server-compatible component (no hooks, no        */
/* "use client") shared VERBATIM by both render paths: production        */
/* (section-renderer) and the editor iframe (editor-canvas BLOCKS map).  */
/*                                                                       */
/* SCOPING: an un-styled section wrapper is `display:contents` (no box,  */
/* no class), so widget CSS cannot scope under `.cms-sec-<id>`. Instead   */
/* the root div carries `data-scope={sectionScope}` (the stable           */
/* "sec-<index>" BOTH render paths pass explicitly, like countryCode)     */
/* and every widget root carries `data-w="w-<col>-<wi>"`. Per-widget      */
/* style/advanced bags serialize through the shared engine's              */
/* `buildWidgetCss` — the same `buildScopedRules` as sections — into ONE  */
/* <style> tag rendered first, so editor and live can never drift.        */
/*                                                                       */
/* SECURITY: `text` / `html` widget HTML goes through the shared          */
/* @lib/util/sanitize-html before dangerouslySetInnerHTML. The `video`    */
/* widget embeds ONLY youtube / youtube-nocookie / vimeo iframes whose    */
/* src is REBUILT onto the whitelisted host from a strictly validated     */
/* video id (never the raw input), or a plain <video> for direct .mp4.    */
/* Unknown widget types and malformed columns/widgets render nothing.     */
/* ------------------------------------------------------------------ */

import React from "react"

import { sanitizeHtml } from "@lib/util/sanitize-html"
import {
  buildWidgetCssPath,
  unitNumberToCss,
  type AdvancedBag,
  type StyleBag,
} from "@modules/cms/render/style-engine"

export interface ContainerWidget {
  widget_type?: string
  style?: StyleBag
  advanced?: AdvancedBag
  [key: string]: unknown
}

export interface ContainerColumn {
  widgets?: ContainerWidget[]
  [key: string]: unknown
}

export interface ContainerData {
  /** Column count as a string ("1".."4") — informational; we render what exists. */
  layout?: string
  gap?: { value?: number; unit?: string }
  verticalAlign?: "top" | "center" | "bottom" | string
  columns?: ContainerColumn[]
  /** Stable "sec-<index>" scope passed explicitly by BOTH render paths. */
  sectionScope?: string
  [key: string]: unknown
}

/* Same character class the style-engine allows in attribute selectors, so the
   stacking @media rule below and buildWidgetCss always agree on the scope. */
function sanitizeScope(scope: unknown): string {
  return typeof scope === "string" ? scope.replace(/[^a-zA-Z0-9_-]/g, "") : ""
}

/** Map the authored vertical alignment to the flex row's align-items. */
function alignItemsFor(v: unknown): React.CSSProperties["alignItems"] {
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
    // A <video> tag cannot execute script — any https(s) .mp4 host is fine.
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

/**
 * Render ONE widget. `mark` is its `data-w="w-…"` DOM marker — a PATH, so a
 * widget inside an inner section is addressed exactly like a top-level one
 * (see buildWidgetCssPath). `path` is the same thing as numbers, needed to
 * mark the inner section's own columns and children.
 */
function renderWidget(
  w: ContainerWidget,
  mark: string,
  path: number[]
): React.ReactNode {
  // A container INSIDE a column (Elementor's Inner Section). Renders the same
  // flex row as the section-level container, one level down. Its children's
  // markers extend this widget's path, so selection, styling, drag-drop and
  // the context menu all work on them with no special cases.
  if (w.widget_type === "inner_section") {
    const cols = Array.isArray(w.columns)
      ? (w.columns as ContainerColumn[]).filter(
          (c): c is ContainerColumn => !!c && typeof c === "object"
        )
      : []
    const gap = unitNumberToCss(w.gap as any, "px") ?? "20px"
    return (
      <div
        data-w={mark}
        className="ff-inner-section"
        style={{
          display: "flex",
          width: "100%",
          minWidth: 0,
          gap,
          alignItems: alignItemsFor(w.verticalAlign),
        }}
      >
        {cols.map((col, c) => {
          const widgets = Array.isArray(col.widgets) ? col.widgets : []
          const colPath = [...path, c]
          return (
            <div
              key={c}
              className="ff-container-col ff-inner-col"
              data-col={colPath.join("-")}
              style={{ flex: 1, minWidth: 0 }}
            >
              {widgets.map((cw, i) =>
                cw && typeof cw === "object" ? (
                  <React.Fragment key={`w-${colPath.join("-")}-${i}`}>
                    {renderWidget(cw, `w-${[...colPath, i].join("-")}`, [
                      ...colPath,
                      i,
                    ])}
                  </React.Fragment>
                ) : null
              )}
            </div>
          )
        })}
      </div>
    )
  }

  switch (w.widget_type) {
    case "heading": {
      const text = typeof w.text === "string" ? w.text : ""
      const level = typeof w.level === "string" ? w.level : "h2"
      const Tag = (HEADING_TAGS.has(level) ? level : "h2") as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6"
      return <Tag data-w={mark}>{text}</Tag>
    }
    case "text":
    case "html": {
      const raw = typeof w.html === "string" ? w.html : ""
      if (!raw.trim()) {
        return null
      }
      return (
        <div
          data-w={mark}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
        />
      )
    }
    case "image": {
      const src = typeof w.src === "string" ? w.src.trim() : ""
      if (!src) {
        return null
      }
      const alt = typeof w.alt === "string" ? w.alt : ""
      const href = typeof w.href === "string" ? w.href.trim() : ""
      const img = (
        // eslint-disable-next-line @next/next/no-img-element
        <img data-w={mark} src={src} alt={alt} style={{ maxWidth: "100%" }} />
      )
      return href ? <a href={href}>{img}</a> : img
    }
    case "button": {
      const label = typeof w.label === "string" ? w.label : ""
      const href = typeof w.href === "string" && w.href.trim() ? w.href : "#"
      const className =
        w.variant === "outline"
          ? "btn btn-outline-dark btn-hover-dark"
          : "btn btn-dark btn-outline-hover-dark"
      return (
        <a data-w={mark} className={className} href={href}>
          {label}
        </a>
      )
    }
    case "spacer": {
      const height = unitNumberToCss(w.height, "px") ?? "50px"
      return <div data-w={mark} aria-hidden="true" style={{ height }} />
    }
    case "divider":
      return <hr data-w={mark} />
    case "video": {
      const video = resolveVideo(w.url)
      if (!video) {
        return null
      }
      if (video.kind === "mp4") {
        return (
          <video
            data-w={mark}
            controls
            src={video.src}
            style={{ width: "100%" }}
          />
        )
      }
      return (
        <div
          data-w={mark}
          style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}
        >
          <iframe
            src={video.src}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </div>
      )
    }
    case "icon": {
      const icon = typeof w.icon === "string" ? w.icon.trim() : ""
      if (!icon) {
        return null
      }
      const fontSize = unitNumberToCss(w.size, "px")
      return (
        <i
          data-w={mark}
          className={icon}
          aria-hidden="true"
          style={fontSize ? { fontSize } : undefined}
        />
      )
    }
    default:
      // Unknown / not-yet-registered widget type — degrade silently.
      return null
  }
}

const Container = (props: ContainerData) => {
  const scope = sanitizeScope(props.sectionScope)
  const columns = Array.isArray(props.columns)
    ? props.columns.filter((c): c is ContainerColumn => !!c && typeof c === "object")
    : []
  const gap = unitNumberToCss(props.gap, "px") ?? "30px"

  // ONE <style> tag: per-widget scoped CSS (shared engine — buildWidgetCss
  // returns "" for widgets with no style/advanced and for an empty scope) plus
  // a small stacking rule so columns wrap to a single column on mobile.
  // Walk columns → widgets, and DOWN INTO any inner section's own columns, so a
  // nested widget's style is emitted exactly like a top-level one. The path is
  // what makes that possible: it is both the CSS selector and the DOM marker.
  let css = ""
  const collect = (cols: ContainerColumn[], base: number[]) => {
    cols.forEach((col, c) => {
      const widgets = Array.isArray(col.widgets) ? col.widgets : []
      widgets.forEach((w, i) => {
        if (!w || typeof w !== "object") {
          return
        }
        const path = [...base, c, i]
        css += buildWidgetCssPath(scope, path, w.style, w.advanced)
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

  return (
    <div className="ff-container" data-scope={scope || undefined}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {/* width:100% + minWidth:0 are LOAD-BEARING, not decoration.
          A flex row with an auto width sits in a shrink-to-fit context the moment
          anything above or inside it says so — and pasted foreign markup can do
          exactly that. When it happens the row collapses to ZERO width, every
          word inside wraps one character per line, and the section becomes a
          several-hundred-pixel blank ribbon with the content invisible inside it.
          Pinning the width means no content, however badly behaved, can collapse
          the layout that holds it. */}
      <div
        className="ff-container-row"
        style={{
          display: "flex",
          width: "100%",
          minWidth: 0,
          gap,
          alignItems: alignItemsFor(props.verticalAlign),
        }}
      >
        {columns.map((col, c) => {
          const widgets = Array.isArray(col.widgets) ? col.widgets : []
          return (
            <div
              key={c}
              className="ff-container-col"
              data-col={String(c)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {widgets.map((w, i) =>
                w && typeof w === "object" ? (
                  <React.Fragment key={`w-${c}-${i}`}>
                    {renderWidget(w, `w-${c}-${i}`, [c, i])}
                  </React.Fragment>
                ) : null
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Container
