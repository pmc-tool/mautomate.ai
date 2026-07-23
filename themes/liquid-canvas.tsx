"use client"

/* ------------------------------------------------------------------ */
/* Liquid canvas — render an UPLOADED (Liquid) theme inside the visual  */
/* editor so the canvas is a true WYSIWYG of the published storefront.  */
/*                                                                      */
/* The editor's selection / message / outline system all operate on the */
/* [data-cms-idx] wrappers the canvas already draws — this only swaps    */
/* what renders INSIDE each wrapper: the theme's own Liquid section      */
/* markup instead of the fallback React block. Rendering is SYNCHRONOUS  */
/* (parseAndRenderSync): editor product_tabs carry no products, so no    */
/* async {% render %} ever executes. Gated to uploaded themes; React     */
/* themes are untouched.                                                 */
/* ------------------------------------------------------------------ */

import React from "react"
import { createEngine, type ThemeFiles } from "@modules/theme-runtime/engine"
import type { CanvasTheme } from "./canvas-theme"

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || ""

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
    const type = props.block_type
    const src = cl.files[`sections/${type}.liquid`]
    if (!src) {
      return <div style={{ padding: 20, color: "#999", font: "14px sans-serif" }}>No preview for {type}</div>
    }
    const idx = idxOf(props.sectionScope)
    const sec = sectionOf(props, idx)
    if (type === "product_tabs" && Array.isArray((sec.settings as any).tabs) && cl.products.length) {
      ;(sec.settings as any).tabs = (sec.settings as any).tabs.map((t: any) => ({ ...t, products: cl.products }))
    }
    const html = renderSync(cl, src, { section: sec })
    return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
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
