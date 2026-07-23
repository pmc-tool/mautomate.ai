"use client"

/* ------------------------------------------------------------------ */
/* Liquid canvas — render an UPLOADED (Liquid) theme inside the visual  */
/* editor so the canvas is a true WYSIWYG of the published storefront.  */
/*                                                                      */
/* The editor's selection / message / outline system all operate on the */
/* [data-cms-idx] wrappers the canvas already draws — this only swaps    */
/* what renders INSIDE each wrapper: the theme's own Liquid section      */
/* markup. Rendering is SYNCHRONOUS (parseAndRenderSync): editor         */
/* product_tabs carry no products, so no async {% render %} ever         */
/* executes.                                                             */
/*                                                                      */
/* PIPELINE CONSOLIDATION (ARCH-CORE Phase 2): every render decision     */
/* here — the collapse rule, flat-vs-container, the container widget     */
/* renderer — comes from the SHARED document composer                    */
/* (@modules/cms/render/document), the same code the live               */
/* `render_section` tag consumes. There is no React fallback theme:      */
/* when the bundle cannot load, the canvas shows an explicit error       */
/* state (see editor-canvas page) instead of silently rendering a        */
/* different theme.                                                      */
/* ------------------------------------------------------------------ */

import React, { type ComponentType } from "react"
import { createEngine, type ThemeFiles } from "@modules/theme-runtime/engine"
import {
  injectTabProducts,
  renderContainerHtml,
} from "@modules/cms/render/container-html"
import {
  makeWidgetRenderer,
  planSection,
} from "@modules/cms/render/document"
import { renderSliderHtml } from "@modules/cms/render/slider-html"
import { placementForTheme } from "@modules/cms/slider/defaults"

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || ""

/** The canvas-renderable pieces of a theme. Formerly the shape of the React
 *  fallback registry (canvas-theme.tsx, DELETED in Phase 2) — now produced
 *  ONLY by `buildLiquidCanvasTheme` from a loaded Liquid bundle. */
export interface CanvasTheme {
  /** The theme's client Header. */
  Header: ComponentType<any>
  /** The theme's client-safe Footer view. */
  Footer: ComponentType<any>
  /** The `<body>` wrapper className the live storefront uses. */
  bodyClassName: string
  /** block_type -> client-safe renderer. */
  blocks: Record<string, ComponentType<any>>
}

export type CanvasLiquid = {
  handle: string
  version: string
  engine: any
  files: ThemeFiles
  ctx: Record<string, any>
  products: any[]
}

export async function loadCanvasLiquid(
  handle: string,
  opts: { shopName?: string; countryCode?: string; chrome?: any; categories?: any[]; themeSettings?: any; products?: any[] }
): Promise<CanvasLiquid | null> {
  if (!handle) return null
  try {
    const r = await fetch(`/api/theme-bundle?handle=${encodeURIComponent(handle)}`, { cache: "no-store" })
    if (!r.ok) return null
    const b = await r.json()
    if (!b?.files?.["layout/theme.liquid"]) return null
    const engine = createEngine(b.files, { themeId: b.handle, version: b.version, currency: "USD", locale: "en" })
    const cc = opts.countryCode || "us"
    const ctx = {
      template: "index",
      shop: { name: opts.shopName || "Store", currency: "USD", locale: "en", logo: opts.chrome?.header?.logo ?? null },
      routes: { root_url: `/${cc}`, cart_url: `/${cc}/cart`, search_url: `/${cc}/search`, account_url: `/${cc}/account`, collections_url: `/${cc}/store` },
      request: { country_code: cc, locale: "en", path: `/${cc}` },
      cart: { item_count: 0, total_price: 0, subtotal_price: 0, items: [] },
      customer: null,
      chrome: opts.chrome ?? {},
      settings: opts.themeSettings ?? {},
      categories: opts.categories ?? [],
    }
    return { handle: b.handle, version: b.version, engine, files: b.files, ctx, products: opts.products ?? [] }
  } catch {
    return null
  }
}

const META = new Set(["id", "block_type", "type", "schema_version", "style", "advanced", "elementStyles", "sectionScope"])
function sectionOf(block: any, idx: number) {
  const settings: any = {}
  for (const k of Object.keys(block || {})) if (!META.has(k)) settings[k] = block[k]
  return { id: `sec-${idx}`, type: block.block_type, settings, css_class: block?.advanced?.cssClasses ?? "" }
}
function idxOf(scope: unknown): number {
  const m = /sec-(\d+)/.exec(typeof scope === "string" ? scope : "")
  return m ? Number(m[1]) : 0
}

function renderSync(cl: CanvasLiquid, src: string, extra: Record<string, any>): string {
  try {
    return cl.engine.parseAndRenderSync(src, { ...cl.ctx, ...extra })
  } catch (e: any) {
    return `<div style="padding:14px;color:#b4553f;font:12px ui-monospace,monospace">Preview unavailable: ${String(e?.message || e).replace(/[<>]/g, "")}</div>`
  }
}

const ALL_TYPES = [
  "hero_slider", "promo_banner_grid", "product_tabs", "deal_of_day", "category_showcase",
  "brand_strip", "rich_text", "image_with_text", "newsletter", "instagram_grid",
  "testimonials", "image_gallery", "container",
]

export function buildLiquidCanvasTheme(cl: CanvasLiquid): CanvasTheme {
  const Block = (props: any) => {
    const idx = idxOf(props.sectionScope)
    const sec = sectionOf(props, idx)

    // ONE decision, made by the SHARED document composer — the same
    // planSection the live `render_section` tag consumes, so the canvas and
    // the published page can never disagree about a section:
    //  - THE COLLAPSE RULE (Phase 1): the normalizer's facade wrapper
    //    (flush + 1 column + 1 commerce widget, no widget-level bags) renders
    //    EXACTLY like the flat themed section did, with no container
    //    scaffolding — the canvas stays a true WYSIWYG of the published page.
    //    The section stays selectable through its [data-cms-idx] wrapper; the
    //    first insertion INTO a facade goes through the shell's section-level
    //    affordances (which clear `flush`), after which the container path and
    //    its data-col / data-w drop targets take over.
    //  - EDITOR-ONLY divergence, encoded in the composer: a facade whose
    //    widget type has no template in this theme falls back to the
    //    container path so the merchant sees the selectable placeholder,
    //    not a void (`facadeFallsBackToContainer`).
    const plan = planSection(sec, cl.files, { facadeFallsBackToContainer: true })

    if (plan.kind === "slider") {
      // 5A — a LAYERED hero_slider renders through the SAME platform
      // renderer as the live page (slider-html via the shared composer),
      // with `editor: true`: no runtime script tag is emitted (the stage,
      // 5B, drives slide visibility — and innerHTML-spliced scripts never
      // execute anyway), so the canvas shows slide 0 with no autoplay.
      const html = renderSliderHtml(plan.settings, {
        scope: `sec-${idx}`,
        editor: true,
        // 5C: same placement hint as the live engine, so a mixed slider's
        // render-time upgrades preview exactly as they will publish.
        placement: placementForTheme(cl.handle),
      })
      return (
        <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
      )
    }

    if (plan.kind === "container") {
      // The container/columns block is rendered by the PLATFORM in BOTH
      // paths, with `editor: true` placeholders for empty widgets/columns
      // (the theme's own sections/container.liquid does not understand the
      // widget vocabulary and emits no data-col / data-w markers, without
      // which the canvas cannot drop a widget into a column or select one).
      // Commerce widgets inside a column delegate to the THEME's own section
      // template via the SHARED makeWidgetRenderer — the same template
      // lookup, product injection and `in_column` handling as the live
      // engine, with the editor's sample products and its "Preview
      // unavailable" error strip as the render primitive.
      const html = renderContainerHtml(plan.settings, {
        scope: `sec-${idx}`,
        editor: true,
        renderSection: makeWidgetRenderer({
          files: cl.files,
          tabProducts: cl.products,
          widgetId: (t) => `w-${t}`,
          // 5A: layered slider WIDGETS render editor-shaped (no runtime tag).
          editor: true,
          render: (src, sectionCtx) => renderSync(cl, src, { section: sectionCtx }),
        }),
      })
      return (
        <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
      )
    }

    if (plan.kind === "flat" && plan.src) {
      // Same product feeding as the live path: editor product_tabs render the
      // chrome-supplied sample products when any exist.
      let flat = plan.section
      if (
        plan.type === "product_tabs" &&
        Array.isArray((flat.settings as any)?.tabs) &&
        cl.products.length
      ) {
        flat = { ...flat, settings: injectTabProducts(flat.settings, cl.products) }
      }
      const html = renderSync(cl, plan.src, { section: flat })
      return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
    }

    // No template for this type in the theme (or no type at all).
    return <div style={{ padding: 20, color: "#999", font: "14px sans-serif" }}>No preview for {String(sec.type ?? "this block")}</div>
  }
  const blocks: Record<string, any> = {}
  for (const t of ALL_TYPES) blocks[t] = Block

  const Header = () => {
    const src = cl.files["sections/header.liquid"]
    if (!src) return null
    return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: renderSync(cl, src, {}) }} />
  }
  const Footer = () => {
    const src = cl.files["sections/footer.liquid"]
    if (!src) return null
    return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: renderSync(cl, src, {}) }} />
  }

  return { Header, Footer, bodyClassName: "lz-body", blocks }
}

export function canvasThemeCssHref(cl: CanvasLiquid): string {
  return `/theme-assets/${cl.handle}/${cl.version}/theme.css`
}
