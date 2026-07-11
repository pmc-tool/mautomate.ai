/* ------------------------------------------------------------------ */
/* CMS Section Renderer                                                 */
/*                                                                     */
/* Maps a compiled snapshot section (`block_type` -> React component)  */
/* and renders the published "home" (and other CMS pages) sections in  */
/* order.                                                              */
/*                                                                     */
/* This is a SERVER component: two blocks (product_tabs,               */
/* category_showcase) are ASYNC server components that fetch their own  */
/* LIVE products / categories, so the renderer must run server-side    */
/* and forward the active region's `countryCode` (sourced from the      */
/* `[countryCode]` route). Every other block ignores `countryCode`.    */
/*                                                                     */
/* Each block renderer is individually dangling-ref safe (missing       */
/* entities -> empty / skipped, fetches wrapped in `.catch`), so a      */
/* single section degrades to null without crashing the page. Unknown   */
/* / not-yet-registered block types also render null.                   */
/* ------------------------------------------------------------------ */

import React from "react"

import type { CmsBlock } from "@lib/data/cms"
import SectionErrorBoundary from "@modules/cms/SectionErrorBoundary"
import EntranceObserver from "@modules/cms/render/EntranceObserver"
import {
  buildSectionCss,
  entranceAnimationOf,
  hasStyle,
  ENTRANCE_CSS,
  type AdvancedBag,
  type ElementStyles,
  type StyleBag,
} from "@modules/cms/render/style-engine"
import type { BlockType, ThemeBlockMap } from "@themes/contract"
import { leartsBlocks } from "@themes/learts/blocks"

/* User-authored escape-hatch values applied to the real-box section wrapper.
   Defined identically in app/editor-canvas so the editor and production wrappers
   stay byte-for-byte in parity. */
function userClasses(advanced?: AdvancedBag): string {
  const v = advanced?.cssClasses
  return typeof v === "string" ? v.trim() : ""
}
function anchorIdOf(advanced?: AdvancedBag): string | undefined {
  const v = advanced?.anchorId
  if (typeof v !== "string") {
    return undefined
  }
  const t = v.trim().replace(/^#+/, "")
  return t || undefined
}

/**
 * Render a list of compiled CMS sections through a THEME's block map. Each
 * section is keyed by its index + type and looked up in `blocks` (the active
 * theme's block_type -> renderer map; defaults to the Learts theme so the
 * renderer is usable standalone). The active region's `countryCode` is
 * forwarded to every block (the async product/category blocks need it to
 * resolve region-scoped prices / live data; the rest ignore it). Unknown /
 * theme-omitted block types and malformed entries render null.
 */
export function SectionRenderer({
  sections,
  countryCode,
  blocks = leartsBlocks,
}: {
  sections?: CmsBlock[]
  countryCode?: string
  blocks?: ThemeBlockMap
}) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null
  }

  // Entrance-on-scroll (F3): when ANY section carries an entrance animation we
  // emit the static ENTRANCE_CSS once and mount the EntranceObserver client
  // component once. Both are no-JS-safe (see ENTRANCE_CSS): without JS the
  // `ff-io` gate never flips on, so nothing is ever hidden. Pages with no
  // entrance animations render byte-identical to today.
  const hasEntrance = sections.some(
    (section) => !!entranceAnimationOf(section?.advanced as AdvancedBag | undefined)
  )

  return (
    <>
      {hasEntrance ? (
        <>
          <style dangerouslySetInnerHTML={{ __html: ENTRANCE_CSS }} />
          <EntranceObserver />
        </>
      ) : null}
      {sections.map((section, index) => {
        if (!section || typeof section.block_type !== "string") {
          return null
        }

        const Component = blocks[section.block_type as BlockType]
        if (!Component) {
          // Block type not provided by the active theme — degrade silently.
          return null
        }

        const key = `${section.block_type}-${index}`

        const rendered = (
          <SectionErrorBoundary block={section.block_type}>
            {/* `sectionScope` is the stable per-section scope ("sec-<idx>",
                the same id convention as the styled-wrapper class below). The
                `container` block needs it to scope its per-WIDGET CSS — its
                un-styled wrapper is display:contents, so `[data-scope]` is the
                only stable hook. Forwarded like countryCode; every other block
                ignores it. Passed identically by the editor canvas. */}
            <Component
              {...section}
              countryCode={countryCode}
              sectionScope={`sec-${index}`}
            />
          </SectionErrorBoundary>
        )

        // HYBRID WRAPPER (parity with editor-canvas):
        // A section carries optional `style` / `advanced` bags. When neither
        // holds a real value (`hasStyle` false — the case for EVERY section
        // today, since nothing authors them yet) we render exactly as before:
        // no wrapper box, so the Bootstrap/Learts grid is byte-identical to
        // today. Only when a section HAS style do we promote it to a real box
        // `.cms-sec-sec-<idx>` and inject its scoped CSS — using the SAME id
        // convention (`sec-<idx>`) and the SAME `buildSectionCss` output as the
        // editor iframe, so the two render paths can never drift.
        const style = section.style as StyleBag | undefined
        const advanced = section.advanced as AdvancedBag | undefined
        const elementStyles = section.elementStyles as
          | ElementStyles
          | undefined

        if (!hasStyle(style, advanced, elementStyles)) {
          return <React.Fragment key={key}>{rendered}</React.Fragment>
        }

        const id = `sec-${index}`
        const css = buildSectionCss(id, style, advanced, elementStyles)
        // Append the user's extra CSS classes and set the DOM id to their anchor
        // (for in-page anchor links) — mirrored exactly in app/editor-canvas.
        const className = [`cms-sec-${id}`, userClasses(advanced)]
          .filter(Boolean)
          .join(" ")

        return (
          <React.Fragment key={key}>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div
              data-cms-idx={index}
              id={anchorIdOf(advanced)}
              className={className}
              // Entrance-on-scroll hook: only present for a real entrance kind.
              // A section with ONLY entranceAnimation set still lands in this
              // real-box branch (hasStyle is true — its advanced bag is
              // non-empty), so the attribute always has a box to animate.
              data-anim={entranceAnimationOf(advanced)}
            >
              {rendered}
            </div>
          </React.Fragment>
        )
      })}
    </>
  )
}

export default SectionRenderer
