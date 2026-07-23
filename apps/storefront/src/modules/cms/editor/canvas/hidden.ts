/* ------------------------------------------------------------------ */
/* Hidden-node ghosts (3C), extracted (ARCH-CANVAS P8, seat 6C).        */
/*                                                                      */
/* The canvas monolith's two 3C walkers, moved VERBATIM:                */
/* - buildHiddenGhostCss: editor-only CSS dimming every node hidden on  */
/*   the previewed device to 40% (their display:none is suppressed by   */
/*   the editor's { hide:false } CSS pass, so the author can still see  */
/*   and select them). Never emitted in production.                     */
/* - collectHiddenBadges: rects + NodeRefs for the overlay's clickable  */
/*   "Hidden on <Device>" badges — sections, section elements, columns, */
/*   widgets (incl. nested inner sections) and chrome elements.         */
/*                                                                      */
/* Same selectors as buildColumnCss / buildWidgetCssPath target, so the */
/* ghosts can never miss. The selector helpers live here now; the       */
/* monolith imports them (one definition).                              */
/* ------------------------------------------------------------------ */

import { isHiddenOnDevice, type Device } from "@modules/cms/schema/types"
import type {
  AdvancedBag,
  ChromeRegion,
} from "@modules/cms/render/style-engine"

import type { NodeRef } from "./protocol"

type Section = { block_type: string; [k: string]: unknown }

/* Stable-enough per-section id used for the scoped CSS class + selector.
   Must match the id passed to `buildSectionCss` so `.cms-sec-<id>` lines
   up with the wrapper's className. */
export const sectionId = (idx: number): string => `sec-${idx}`

/* Re-find a column / widget in the DOM from the identity we carry in
   state. The markers are the platform container renderer's own
   ([data-col], [data-w]), so these are the exact nodes the drop code
   already targets. */
export const colSelector = (index: number, colPath: number[]): string =>
  `[data-cms-idx="${index}"] [data-col="${colPath.join("-")}"]`
export const widgetSelector = (index: number, path: number[]): string =>
  `[data-cms-idx="${index}"] [data-w="w-${path.join("-")}"]`

/* Is this section flagged hidden on `device`? 3C: dual-shape read — the
   spec `advanced.hide` bag AND the legacy hideOn<Device> booleans — via
   the shared `isHiddenOnDevice`, so a spec-shape-hidden node ghosts too. */
export function isHiddenOn(block: Section, device: Device): boolean {
  return isHiddenOnDevice(block.advanced as AdvancedBag | undefined, device)
}

const CHROME_REGIONS: ChromeRegion[] = ["topbar", "header", "footer"]

/** Editor-only ghost rules for every node hidden on `device`. */
export function buildHiddenGhostCss(
  content: Section[],
  chrome: Record<string, unknown>,
  device: Device
): string {
  const ghost: string[] = []
  const hid = (bag: unknown): boolean =>
    isHiddenOnDevice(bag as AdvancedBag | undefined, device)
  content.forEach((block, i) => {
    const id = sectionId(i)
    if (isHiddenOn(block, device)) {
      ghost.push(`.cms-sec-${id}{opacity:.4!important}`)
    }
    // Hidden section ELEMENTS — their display:none is suppressed by the
    // same { hide:false } pass, so they ghost with the same rule.
    const es = block.elementStyles as
      | Record<string, { advanced?: unknown }>
      | undefined
    if (es) {
      for (const key of Object.keys(es)) {
        if (hid(es[key]?.advanced)) {
          ghost.push(`.cms-sec-${id} [data-el="${key}"]{opacity:.4!important}`)
        }
      }
    }
    // Container columns + widgets (incl. nested inner_section levels) —
    // the EXACT selectors buildColumnCss / buildWidgetCssPath target, so
    // the ghost can never miss.
    const walk = (cols: unknown, base: number[]) => {
      if (!Array.isArray(cols)) return
      cols.forEach((col, c) => {
        if (!col || typeof col !== "object") return
        const colPath = [...base, c]
        if (hid((col as Record<string, unknown>).advanced)) {
          ghost.push(
            `[data-scope="${id}"] [data-col="${colPath.join(
              "-"
            )}"]{opacity:.4!important}`
          )
        }
        const widgets = (col as Record<string, unknown>).widgets
        if (!Array.isArray(widgets)) return
        widgets.forEach((w, wi) => {
          if (!w || typeof w !== "object") return
          const path = [...colPath, wi]
          const wr = w as Record<string, unknown>
          if (hid(wr.advanced)) {
            ghost.push(
              `[data-scope="${id}"] [data-w="w-${path.join(
                "-"
              )}"]{opacity:.4!important}`
            )
          }
          if (wr.widget_type === "inner_section") {
            walk(wr.columns, path)
          }
        })
      })
    }
    if (block.block_type === "container") {
      walk((block as Record<string, unknown>).columns, [])
    }
  })
  // Chrome ELEMENTS (a chrome REGION can never hide — engine-refused).
  CHROME_REGIONS.forEach((region) => {
    const c = (chrome as Record<string, any>)[region]
    const ces = c?.elementStyles as
      | Record<string, { advanced?: unknown }>
      | undefined
    if (!ces) return
    for (const key of Object.keys(ces)) {
      if (hid(ces[key]?.advanced)) {
        ghost.push(
          `.cms-chrome-${region} [data-el="${key}"]{opacity:.4!important}`
        )
      }
    }
  })
  return ghost.join("")
}

/** Rects + refs for every node hidden on `device`, measured against the
 *  live DOM (`outlineTarget` resolves a section wrapper's real box; the
 *  caller passes it to avoid a dnd import cycle here). */
export function collectHiddenBadges(
  content: Section[],
  chrome: Record<string, unknown>,
  device: Device,
  root: HTMLElement,
  rectOf: (el: Element) => DOMRect,
  outlineTarget: (w: Element | null | undefined) => HTMLElement | null
): { ref: NodeRef; rect: DOMRect }[] {
  const out: { ref: NodeRef; rect: DOMRect }[] = []
  const hid = (bag: unknown): boolean =>
    isHiddenOnDevice(bag as AdvancedBag | undefined, device)
  const measure = (ref: NodeRef, el: Element | null) => {
    if (el) out.push({ ref, rect: rectOf(el) })
  }
  content.forEach((block, i) => {
    if (isHiddenOn(block, device)) {
      measure(
        { t: "section", i },
        outlineTarget(root.querySelector(`[data-cms-idx="${i}"]`))
      )
    }
    const es = block.elementStyles as
      | Record<string, { advanced?: unknown }>
      | undefined
    if (es) {
      for (const key of Object.keys(es)) {
        if (hid(es[key]?.advanced)) {
          measure(
            { t: "element", i, el: key },
            root.querySelector(`[data-cms-idx="${i}"] [data-el="${key}"]`)
          )
        }
      }
    }
    const walk = (cols: unknown, base: number[]) => {
      if (!Array.isArray(cols)) return
      cols.forEach((col, c) => {
        if (!col || typeof col !== "object") return
        const colPath = [...base, c]
        if (hid((col as Record<string, unknown>).advanced)) {
          measure(
            { t: "column", i, col: colPath },
            root.querySelector(colSelector(i, colPath))
          )
        }
        const widgets = (col as Record<string, unknown>).widgets
        if (!Array.isArray(widgets)) return
        widgets.forEach((w, wi) => {
          if (!w || typeof w !== "object") return
          const path = [...colPath, wi]
          const wr = w as Record<string, unknown>
          if (hid(wr.advanced)) {
            measure(
              { t: "widget", i, path },
              root.querySelector(widgetSelector(i, path))
            )
          }
          if (wr.widget_type === "inner_section") {
            walk(wr.columns, path)
          }
        })
      })
    }
    if (block.block_type === "container") {
      walk((block as Record<string, unknown>).columns, [])
    }
  })
  CHROME_REGIONS.forEach((region) => {
    const c = (chrome as Record<string, any>)[region]
    const ces = c?.elementStyles as
      | Record<string, { advanced?: unknown }>
      | undefined
    if (!ces) return
    for (const key of Object.keys(ces)) {
      if (hid(ces[key]?.advanced)) {
        measure(
          { t: "chromeEl", region, el: key },
          document.querySelector(`.cms-chrome-${region} [data-el="${key}"]`)
        )
      }
    }
  })
  return out
}
