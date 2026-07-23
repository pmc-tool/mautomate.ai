/* ------------------------------------------------------------------ */
/* THE DOCUMENT COMPOSER (ARCH-CORE §3.2, Phase 2).                     */
/*                                                                     */
/* Exactly two render paths survive the pipeline consolidation — the    */
/* live route (theme-render → engine.ts `render_section`) and the       */
/* editor canvas (liquid-canvas.tsx) — and BOTH consume this file for   */
/* every decision they used to make separately:                        */
/*                                                                     */
/*   - the per-section CONTEXT entry (settings flattening, style scope, */
/*     wrap_class / wrap_css)            → buildSectionEntry            */
/*   - theme brand-token head CSS        → buildDocumentHeadCss         */
/*   - the collapse rule (facade → flat) → collapseFlushContainer       */
/*   - flat-vs-container branch          → planSection                  */
/*   - the container widget renderer     → makeWidgetRenderer           */
/*   - the styled-section wrap emission  → wrapSectionHtml              */
/*   - product-tab resolution walks      → collectProductTabBags /      */
/*                                          harvestTabProducts          */
/*                                                                     */
/* This is where the brand-token / wrap-emission bug class (fixed twice */
/* in one day, in the route and the previews separately) becomes        */
/* structurally impossible: each of these is emitted from ONE place.    */
/*                                                                     */
/* Division of labor with build-context.ts (deliberate): build-context  */
/* remains the THEME DATA CONTRACT — the mapping of Medusa data (shop,  */
/* cart, product, collection) to the shapes the developer guide          */
/* promises a theme. Section COMPOSITION — the part the editor canvas   */
/* must agree with byte-for-byte — lives here, and homeContext           */
/* delegates to buildDocumentSections. Two files, two change cadences,   */
/* one composer.                                                        */
/*                                                                     */
/* ISOMORPHIC ON PURPOSE: no React, no server imports, no engine        */
/* import — the editor canvas is a "use client" module and the truth    */
/* harness bundles the live path from source. Everything here is pure   */
/* data/string work.                                                    */
/* ------------------------------------------------------------------ */

import {
  buildSectionCss,
  hasStyle,
  type AdvancedBag,
  type ElementStyles,
  type StyleBag,
} from "@modules/cms/render/style-engine"
// 3E — link value contract: SECTION-path settings hand Liquid plain href
// strings; the object link form (target/rel extras) never reaches a theme.
import { flattenLinkValues } from "@modules/cms/schema/types"
import {
  commerceWidgetSettings,
  injectTabProducts,
} from "@modules/cms/render/container-html"
import { isCommerceWidget } from "@modules/cms/schema/widgets"
import { buildThemeVars } from "@modules/cms/render/theme-vars"
// 5A — layered slider (ARCH-SLIDER S1): the ONE predicate + platform
// renderer both paths route through. A hero_slider whose settings carry a
// `layers` array on ANY slide is platform-rendered (slider-html); every
// fields-shaped hero keeps routing to the theme's own Liquid, untouched.
import { isLayeredSlider } from "@modules/cms/slider/model"
import { renderSliderHtml } from "@modules/cms/render/slider-html"

/* ------------------------- context entries ------------------------- */

/** A section's context entry — the shape `render_section` and the editor
 *  canvas both consume. Loosely typed on purpose: the values flow from
 *  merchant-authored documents and straight into Liquid. */
export interface SectionEntry {
  id: unknown
  type: unknown
  settings: Record<string, unknown>
  css_class: unknown
  scope: string
  wrap_class: string
  wrap_css: string
}

/** A section's settings are everything except our internal bookkeeping. */
function stripMeta(section: any): any {
  const { id, block_type, type, schema_version, style, advanced, elementStyles, ...rest } =
    section ?? {}
  return rest
}

/**
 * ONE section → its context entry. Merchant appearance (the editor's Style /
 * Advanced tabs + per-element overrides) is serialized by the SAME
 * style-engine under the SAME "sec-<idx>" scope convention everywhere, so
 * what the merchant sees in the editor is exactly what a Liquid-rendered page
 * shows. `render_section` (engine.ts) consumes `wrap_class` / `wrap_css` via
 * `wrapSectionHtml` below. Un-styled sections carry empty strings and render
 * byte-identical to before.
 */
export function buildSectionEntry(s: any, i: number): SectionEntry {
  const style = s?.style as StyleBag | undefined
  const advanced = s?.advanced as AdvancedBag | undefined
  const elementStyles = s?.elementStyles as ElementStyles | undefined
  const styled = hasStyle(style, advanced, elementStyles)
  const scope = `sec-${i}`
  return {
    id: s.id ?? `section-${i}`,
    type: s.block_type ?? s.type,
    settings: flattenLinkValues(stripMeta(s)) as Record<string, unknown>, // 3E: strings-only for Liquid
    css_class: s.advanced?.cssClasses ?? "",
    // The stable style scope, stamped on EVERY section (styled or not).
    // `wrap_class` only exists when the section is styled, but the
    // platform-rendered container block needs the scope regardless — it
    // is what its own per-widget CSS and [data-scope] marker key off.
    scope,
    wrap_class: styled ? `cms-sec-${scope}` : "",
    wrap_css: styled
      ? buildSectionCss(scope, style, advanced, elementStyles)
      : "",
  }
}

/** The whole document's section entries, in order. */
export function buildDocumentSections(sections: any[]): SectionEntry[] {
  return (sections ?? []).map(buildSectionEntry)
}

/**
 * Head CSS for a document: the brand design tokens (--ff-*). The style engine
 * compiles a "link to global token" style value to var(--ff-<id>), so every
 * consumer of the composer — the live route's <head>, the editor canvas, the
 * template previews — MUST emit this or tokenized styles silently drop. One
 * seam, one emission.
 */
export function buildDocumentHeadCss(
  cmsTheme: unknown,
  manifestTokens: unknown
): string {
  return buildThemeVars(cmsTheme as any, manifestTokens as any)
}

/* --------------------------- collapse rule --------------------------- */

/** True when the value is an object carrying at least one own key. */
function hasOwnKeys(v: unknown): boolean {
  return !!v && typeof v === "object" && Object.keys(v as object).length > 0
}

/**
 * THE COLLAPSE RULE (Phase 1, ARCH-CORE §1.4).
 *
 * The editor normalizes every flat themed section into a facade wrapper — a
 * FLUSH single-column container holding that section as its one commerce
 * widget. This function detects exactly that shape in a container's settings
 * bag and hands back the widget so the caller can render it as if the section
 * were still flat: `sections/<widget_type>.liquid` with the widget's props as
 * `section.settings`, the section-level wrap_class / wrap_css applied as
 * always, and NO container markup — no `.ff-container`, no `data-col` /
 * `data-w` wrappers, no layout-guard CSS, no `in_column` flag. That makes a
 * normalized page's published output BYTE-IDENTICAL to its pre-normalization
 * output, which is the Phase 1 gate.
 *
 * The predicate is deliberately narrow — EVERY condition is load-bearing:
 *  - `flush === true` (strict): the normalizer's facade marker. Real
 *    merchant-built containers never carry it — live drafts already hold
 *    1-col single-commerce-widget containers WITHOUT flush, and those must
 *    keep rendering with the container scaffolding they were built with.
 *  - exactly ONE object column and exactly ONE object widget: a second
 *    column or widget means the merchant composed something; the container
 *    path owns it.
 *  - the widget is a COMMERCE widget (theme-rendered): a basic widget
 *    (heading, text, spacer…) has no `sections/<type>.liquid` to collapse to
 *    — its markup is the platform's, so it stays on the container path.
 *    `inner_section` is not a commerce widget and never collapses.
 *  - the widget carries NO style / advanced / elementStyles bags of its own:
 *    widget-level appearance is emitted by the container path
 *    (buildWidgetCssPath); collapsing would silently drop it. The facade
 *    wrapper keeps all three bags at SECTION level, so a normalized-unedited
 *    page always passes this check; only a genuinely widget-styled node ever
 *    fails it, and that is merchant intent — it renders as the container it
 *    now is.
 *
 * Pure and shared: `render_section` (live) and the editor's liquid-canvas
 * container branch both consume it (via `planSection`), so the canvas and the
 * published page can never disagree about what collapses.
 */
export function collapseFlushContainer(
  data: unknown
): { type: string; settings: Record<string, unknown> } | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.flush !== true) return null
  const columns = Array.isArray(d.columns)
    ? (d.columns as unknown[]).filter((c) => !!c && typeof c === "object")
    : []
  if (columns.length !== 1) return null
  const col = columns[0] as Record<string, unknown>
  const widgets = Array.isArray(col.widgets)
    ? (col.widgets as unknown[]).filter((w) => !!w && typeof w === "object")
    : []
  if (widgets.length !== 1) return null
  const w = widgets[0] as Record<string, unknown>
  if (!isCommerceWidget(w.widget_type)) return null
  if (hasOwnKeys(w.style) || hasOwnKeys(w.advanced) || hasOwnKeys(w.elementStyles)) {
    return null
  }
  // A column carrying its own appearance bags (2E) cannot collapse — the
  // flat path has nowhere to emit column CSS, so collapsing would silently
  // drop merchant-visible styling. Same rationale as the widget-bag check.
  if (hasOwnKeys(col.style) || hasOwnKeys(col.advanced)) return null
  return {
    type: String(w.widget_type),
    settings: commerceWidgetSettings(w as Record<string, unknown>),
  }
}

/* --------------------------- section plan --------------------------- */

/**
 * The flat-vs-container decision, made ONCE for both render paths.
 *
 * - `skip`: no type — render nothing (and emit no wrap).
 * - `flat`: an ordinary themed section, OR a collapsed facade (the collapse
 *   rule rewrote `type` + `settings`; `section` is the context entry with
 *   both swapped, everything else — id / css_class / scope / wrap_* — kept).
 *   `src` is the theme's template source, or null when the theme has no
 *   template for this type (live: render nothing, wrap included — exactly
 *   the old `if (!src) return`).
 * - `container`: the platform-rendered container/columns path.
 *
 * `facadeFallsBackToContainer` (EDITOR ONLY): a facade whose widget type has
 * no template in this theme falls back to the container path so the merchant
 * sees the selectable placeholder, not a void. The live path keeps the flat
 * plan (renders nothing) — same behavior it has always had.
 */
export type SectionPlan =
  | { kind: "skip" }
  | { kind: "flat"; type: string; section: any; src: string | null }
  | { kind: "container"; settings: any }
  /** 5A: a LAYERED hero_slider — platform-rendered by slider-html. */
  | { kind: "slider"; settings: any }

export function planSection(
  section: any,
  files: Record<string, string>,
  opts?: { facadeFallsBackToContainer?: boolean }
): SectionPlan {
  const type = section?.type
  if (!type) return { kind: "skip" }
  // 5A — THE SLIDER BRANCH (ARCH-SLIDER §2.1/§5): strict by construction.
  // `isLayeredSlider` requires a `layers` ARRAY on at least one slide — a
  // key no fields-shaped hero has ever stored — so every existing hero
  // falls through to the theme's own sections/hero_slider.liquid with
  // byte-identical output. That single guard IS the migration policy.
  if (type === "hero_slider" && isLayeredSlider(section?.settings)) {
    return { kind: "slider", settings: section?.settings }
  }
  if (type === "container") {
    const collapsed = collapseFlushContainer(section?.settings)
    if (collapsed) {
      // 6C (P0 fix): the collapse rule must not bypass the 5A slider branch.
      // A facade hosting a LAYERED hero_slider is platform-rendered
      // (slider-html), exactly like the flat shape above — the theme's own
      // fields template cannot render layered slides and emits no
      // [data-slide]/[data-layer] markers, which degraded the stage to its
      // ghost surface right after "Convert to layered slide" on a
      // normalized (facade) hero. Fields-shaped facades are untouched:
      // isLayeredSlider requires a `layers` array no fields hero stores.
      if (
        collapsed.type === "hero_slider" &&
        isLayeredSlider(collapsed.settings)
      ) {
        return { kind: "slider", settings: collapsed.settings }
      }
      const src = files[`sections/${collapsed.type}.liquid`] ?? null
      if (src == null && opts?.facadeFallsBackToContainer) {
        return { kind: "container", settings: section?.settings }
      }
      // The facade keeps id / css_class / scope / wrap_class / wrap_css at
      // section level, so spreading the container's context entry and
      // swapping type + settings reproduces the flat section's context
      // object. `in_column` is never set — this is a full-bleed section.
      return {
        kind: "flat",
        type: collapsed.type,
        section: { ...section, type: collapsed.type, settings: collapsed.settings },
        src,
      }
    }
    return { kind: "container", settings: section?.settings }
  }
  return {
    kind: "flat",
    type: String(type),
    section,
    src: files[`sections/${type}.liquid`] ?? null,
  }
}

/**
 * The stable per-section style scope, "sec-<index>". `buildSectionEntry`
 * stamps it on every section; older/other contexts only carry `wrap_class`
 * ("cms-sec-sec-3"), so derive it from there as a fallback. An unstyled
 * section under an older context yields "" — the container still renders, it
 * just carries no scoped per-widget CSS (there is none to carry:
 * buildWidgetCssPath returns "" for an empty scope anyway).
 */
export function containerScopeOf(section: any): string {
  const direct = String(section?.scope ?? "").trim()
  if (direct) return direct
  // wrap_class is `cms-sec-${scope}` — i.e. "cms-sec-" + "sec-3".
  const m = /^cms-sec-(sec-\d+)$/.exec(String(section?.wrap_class ?? "").trim())
  return m ? m[1] : ""
}

/* ------------------------ container widgets ------------------------ */

export type ContainerWidgetRenderer = (
  widgetType: string,
  settings: Record<string, unknown>,
  rsOpts?: { inColumn?: boolean }
) => string

/**
 * The ONE implementation of "render a commerce widget inside a container
 * column through the theme's own section template". Both paths used to
 * hand-roll this closure (template lookup, product injection, `in_column`,
 * the widget section id) — now they only supply their Liquid primitive and
 * their error policy through `render`:
 *
 *  - live (engine.ts): render = parseAndRenderSync over the tag's full outer
 *    scope, try/catch → "" (a widget never 500s a page), widgetId
 *    "container-widget", injectEmptyTabProducts TRUE (the live path has
 *    always replaced a widget's tab products with the page harvest, even an
 *    empty one — preserved byte-for-byte; see harvestTabProducts).
 *  - editor (liquid-canvas / TemplateLibrary): render = the canvas
 *    renderSync (its catch shows the "Preview unavailable" strip), widgetId
 *    "w-<type>", injectEmptyTabProducts false (sample products only when
 *    they exist).
 *
 * Returning "" (no template for the type) MUST render nothing — a merchant
 * never sees a stack trace because a theme is missing a section.
 */
export function makeWidgetRenderer(deps: {
  files: Record<string, string>
  render: (src: string, sectionCtx: Record<string, unknown>) => string
  tabProducts: unknown[]
  widgetId: (widgetType: string) => string
  injectEmptyTabProducts?: boolean
  /** 5A: editor-canvas callers pass true so a layered slider WIDGET renders
   *  without the live runtime script (the stage drives slide visibility). */
  editor?: boolean
}): ContainerWidgetRenderer {
  return (widgetType, settings, rsOpts) => {
    // 5A — a layered hero_slider used as a WIDGET inside a column routes
    // through the same platform renderer as the section path (the §2.1
    // renderSection-delegation branch), so layered sliders work in columns
    // too. Fields-shaped widget heroes keep the theme's Liquid, untouched.
    if (widgetType === "hero_slider" && isLayeredSlider(settings)) {
      try {
        return renderSliderHtml(settings, { editor: deps.editor === true })
      } catch {
        return ""
      }
    }
    const src = deps.files[`sections/${widgetType}.liquid`]
    if (!src) {
      return "" // theme has no markup for this type — render nothing
    }
    const resolved =
      widgetType === "product_tabs" &&
      (deps.injectEmptyTabProducts === true || deps.tabProducts.length > 0)
        ? injectTabProducts(settings, deps.tabProducts)
        : settings
    return deps.render(src, {
      id: deps.widgetId(widgetType),
      type: widgetType,
      settings: resolved,
      // True only in a MULTI-column container, where the widget is
      // genuinely narrow, so the theme can offer a compact variant. A
      // 1-column container is full-bleed and keeps the normal design.
      in_column: rsOpts?.inColumn === true,
    })
  }
}

/* -------------------------- wrap emission -------------------------- */

/**
 * CMS style wrapper — the ONE place a styled section's scoped CSS + scope div
 * are emitted around its markup (string paths: the live `render_section` tag
 * and the template previews; the editor canvas mounts the same class/CSS
 * through its live DOM wrapper instead). When the merchant styled this
 * section (or an element inside it) in the visual editor,
 * `buildSectionEntry` precomputes `wrap_class` (".cms-sec-sec-<idx>" scope
 * class) and `wrap_css` (the style-engine output whose selectors target that
 * class + the section's [data-el] descendants). Un-styled sections take
 * neither key, so their markup is byte-identical to before. Both values are
 * defensively sanitized here — everything reaching a renderer is treated as
 * untrusted: the class can never break out of its attribute, the CSS can
 * never close the <style> (a "<" is never legitimate CSS, so stripping it
 * cannot corrupt one).
 */
export function wrapSectionHtml(section: any, html: string): string {
  const wrapClass = String(section?.wrap_class ?? "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
  if (!wrapClass) {
    return html
  }
  const css = String(section?.wrap_css ?? "")
    .replace(/<\s*\/\s*style/gi, "")
    .replace(/</g, "")
  return (
    (css ? `<style>${css}</style>` : "") +
    `<div class="${wrapClass}">` +
    html +
    "</div>"
  )
}

/* ---------------------- product-tab resolution ---------------------- */

/**
 * Collect every product_tabs settings bag on a page — top-level sections AND
 * product_tabs used as a WIDGET inside a container column (including one
 * level of inner_section). Walking only the top level left a widget's tabs
 * empty on the live site, since the theme never fetches for itself. The live
 * route feeds each returned bag's tabs with fetched product cards (mutating
 * `tab.products` in place — the bags are references into the page context).
 */
export function collectProductTabBags(sections: any[]): any[] {
  const tabBags: any[] = []
  const collectFromWidgets = (widgets: any): void => {
    if (!Array.isArray(widgets)) return
    for (const w of widgets) {
      if (!w || typeof w !== "object") continue
      if (w.widget_type === "product_tabs" && Array.isArray(w.tabs)) {
        tabBags.push(w)
      }
      if (Array.isArray(w.columns)) {
        for (const col of w.columns) collectFromWidgets(col?.widgets)
      }
    }
  }
  for (const sec of sections ?? []) {
    if (sec?.type === "product_tabs" && Array.isArray(sec?.settings?.tabs)) {
      tabBags.push(sec.settings)
    }
    const cols = sec?.settings?.columns
    if (Array.isArray(cols)) {
      for (const col of cols) collectFromWidgets(col?.widgets)
    }
  }
  return tabBags
}

/**
 * Products for a `product_tabs` WIDGET living inside a container column, on
 * the LIVE path: the same page's already-resolved product cards, reused for
 * the widget (the render tag cannot fetch). On a page whose only
 * product_tabs is the widget itself there is nothing to harvest and the tabs
 * render empty rather than broken. NOTE (pre-existing, preserved for byte
 * identity): the live container path injects this harvest UNCONDITIONALLY,
 * so a widget's route-resolved products are overwritten by the harvest —
 * empty when no top-level product_tabs section exists on the page.
 */
export function harvestTabProducts(all: Record<string, any>): unknown[] {
  const sections = all?.page?.sections
  if (!Array.isArray(sections)) {
    return []
  }
  for (const sec of sections) {
    const tabs = sec?.settings?.tabs
    if (sec?.type !== "product_tabs" || !Array.isArray(tabs)) {
      continue
    }
    for (const tab of tabs) {
      if (Array.isArray(tab?.products) && tab.products.length) {
        return tab.products as unknown[]
      }
    }
  }
  return []
}
