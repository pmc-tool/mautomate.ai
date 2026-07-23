/* ------------------------------------------------------------------ */
/* Theme Contract                                                       */
/*                                                                     */
/* The single source of truth that lets ONE set of CMS content render  */
/* through MANY visual themes. The CMS stores page content as ordered   */
/* blocks (block_type + resolved data); every theme provides its OWN    */
/* React component for each block_type, all consuming the SAME data     */
/* shape. Switching the active theme therefore never breaks content.    */
/*                                                                     */
/* A theme is a pre-compiled package in the codebase (NOT an upload):   */
/* this is the only production-safe model for a React/Next app — no     */
/* runtime code execution, no sandboxing, no security surface. We add   */
/* themes by adding code + redeploying; users SELECT between the ones   */
/* that ship.                                                          */
/* ------------------------------------------------------------------ */

import type { ComponentType } from "react"

/** The canonical block vocabulary. Mirrors the backend block registry. */
export const BLOCK_TYPES = [
  "hero_slider",
  "promo_banner_grid",
  "product_tabs",
  "deal_of_day",
  "category_showcase",
  "brand_strip",
  "rich_text",
  "image_with_text",
  "newsletter",
  "instagram_grid",
  "testimonials",
  "image_gallery",
  "container",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

/**
 * A block renderer. It receives the RESOLVED block data spread as props
 * (plus the active region's `countryCode`, which the product/category blocks
 * need and the rest ignore). Kept as `any` because each block has its own
 * data interface; the data CONTRACT is enforced by the shared block data
 * shapes, not by this map's generic. NOTE (Phase 2): the React CMS block
 * renderers are deleted — every theme ships `blocks: {}` and CMS pages render
 * through the Liquid engine; this type remains for the manifest shape only.
 */
export type BlockComponent = ComponentType<any>

/** block_type -> renderer for one theme. A theme MAY omit a block (degrades). */
export type ThemeBlockMap = Partial<Record<BlockType, BlockComponent>>

/** Design tokens compiled into CSS custom properties for the theme. */
export interface ThemeTokens {
  colors?: Partial<{
    primary: string
    dark: string
    border: string
    text: string
    heading: string
    bg: string
  }>
  fonts?: { body?: string; heading?: string }
  [key: string]: unknown
}

/**
 * A complete, selectable storefront design. `blocks` is the only required
 * piece beyond identity — chrome (Header/Footer) and stylesheets are optional
 * so a theme can either ship bespoke chrome or inherit the shared defaults.
 */
export interface ThemeManifest {
  /** Stable id (kebab-case). Stored as the `active_theme` CMS setting. */
  id: string
  /** Human-facing name shown in the admin theme gallery. */
  name: string
  /** Short description for the gallery card. */
  description?: string
  /** Preview thumbnail under public/ (admin gallery). */
  preview?: string
  /** className applied to the storefront body for theme-scoped CSS. */
  bodyClassName?: string
  /** Stylesheet hrefs (under public/) this theme needs, in order. */
  stylesheets?: string[]
  /** Favicon href for this theme (optional). */
  favicon?: string
  /** Default design tokens (applied when this theme is activated). */
  tokens?: ThemeTokens
  /** block_type -> this theme's renderer. */
  blocks: ThemeBlockMap
  /** Optional bespoke chrome. When omitted the shared chrome is used. */
  Header?: ComponentType<any>
  Footer?: ComponentType<any>
  /**
   * Optional bespoke INTERIOR commerce page templates. Each receives the exact
   * same props as the default template it replaces; when omitted the default
   * (Learts-base) template renders, so interior pages always work.
   */
  templates?: ThemeTemplates
  /**
   * Optional DEFAULT homepage sections, rendered through this theme's block
   * map when the store has no published CMS "home" snapshot yet (fresh
   * tenants / new stores). Shapes must match the backend block registry
   * defaultData contracts. When omitted, the hardcoded Learts home fallback
   * renders (correct for the Learts theme; visually wrong for others).
   */
  defaultSections?: ThemeDefaultSection[]
}

/** A compiled-section-shaped literal a theme ships as its no-CMS fallback. */
export interface ThemeDefaultSection {
  block_type: BlockType
  schema_version: number
  [key: string]: unknown
}

/** Theme-provided interior page templates (all optional). */
export interface ThemeTemplates {
  /** Store listing (PLP). Props: { sortBy, page, countryCode, optionValueIds, query }. */
  store?: ComponentType<any>
  /** Product detail (PDP). Props: { product, region, countryCode, images }. */
  product?: ComponentType<any>
  /** Cart page. Props: { cart, customer }. */
  cart?: ComponentType<any>
  /** Category listing. Props: { category, sortBy, page, countryCode, ... }. */
  category?: ComponentType<any>
  /** Account login screen. Props: vary (login template). */
  login?: ComponentType<any>
}
