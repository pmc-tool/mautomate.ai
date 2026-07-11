/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend rich_text resolved schema).     */
/* Received as the spread prop bag from the storefront SectionRenderer  */
/* (`<RichText {...block} />`), so it also carries block_type /          */
/* schema_version which we simply ignore.                               */
/*                                                                      */
/* This is a pure presentational, server-compatible component (no       */
/* hooks, no "use client"): it sanitizes the authored HTML defensively  */
/* (via the shared @lib/util/sanitize-html) and renders it inside a      */
/* Learts section. `html` is the resolved, localized body; `width` is    */
/* the locale-invariant container width.                                 */
/* ------------------------------------------------------------------ */

import { sanitizeHtml } from "@lib/util/sanitize-html"

export type RichTextWidth = "narrow" | "normal" | "wide" | "full"

export interface RichTextData {
  html?: string
  width?: RichTextWidth
  [key: string]: unknown
}

/** Map the locale-invariant width to Learts container + column classes. */
function layoutFor(width: RichTextWidth | undefined): {
  container: string
  col: string
} {
  switch (width) {
    case "narrow":
      return { container: "container", col: "col-xxl-8 col-xl-10 col-12" }
    case "wide":
      return { container: "container-fluid", col: "col-12" }
    case "full":
      return { container: "container-fluid px-0", col: "col-12" }
    case "normal":
    default:
      return { container: "container", col: "col-12" }
  }
}

const RichText = (props: RichTextData) => {
  const raw = typeof props.html === "string" ? props.html : ""
  if (!raw.trim()) {
    return null
  }

  const safe = sanitizeHtml(raw)
  const { container, col } = layoutFor(props.width)

  return (
    <div className="section section-padding bg-white learts-theme">
      <div className={container}>
        <div className="row justify-content-center">
          <div className={col}>
            <div
              className="learts-rich-text"
              data-el="content"
              dangerouslySetInnerHTML={{ __html: safe }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RichText
