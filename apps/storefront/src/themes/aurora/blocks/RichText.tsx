/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) RichText block.                           */
/*                                                                      */
/* Consumes the SAME resolved block data the Learts renderer does       */
/* (spread as props via `<RichText {...block} />`), so it also carries  */
/* block_type / schema_version / countryCode which we simply ignore.    */
/*                                                                      */
/* Pure presentational, server-compatible component (no hooks, no       */
/* "use client"): it sanitizes the authored HTML defensively (via the   */
/* shared @lib/util/sanitize-html) and renders it inside a modern        */
/* editorial prose layout. `html` is the resolved, localized body;      */
/* `width` is the locale-invariant width.                                */
/* ------------------------------------------------------------------ */

import { sanitizeHtml } from "@lib/util/sanitize-html"

export type RichTextWidth = "narrow" | "normal" | "wide" | "full"

export interface RichTextData {
  html?: string
  width?: RichTextWidth
  [key: string]: unknown
}

/** Map the locale-invariant width to Tailwind container + prose width. */
function layoutFor(width: RichTextWidth | undefined): {
  container: string
  col: string
} {
  switch (width) {
    case "narrow":
      return {
        container: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
        col: "mx-auto max-w-2xl",
      }
    case "wide":
      return { container: "w-full px-4 sm:px-6 lg:px-8", col: "mx-auto max-w-5xl" }
    case "full":
      return { container: "w-full", col: "w-full" }
    case "normal":
    default:
      return {
        container: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
        col: "mx-auto max-w-3xl",
      }
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
    <section className="aurora-theme bg-white py-16 md:py-24 font-sans">
      <div className={container}>
        <div className={col}>
          <div
            className="leading-relaxed text-neutral-700 [&_h1]:text-3xl [&_h1]:md:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-neutral-900 [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-neutral-900 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-neutral-900 [&_img]:rounded-2xl [&_img]:object-cover [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-neutral-500"
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        </div>
      </div>
    </section>
  )
}

export default RichText
