import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../_helpers"
import { CMS_MODULE } from "../../../modules/cms"
import type CmsModuleService from "../../../modules/cms/service"
import { emitCmsPublished } from "../../../modules/cms/publish-helper"

/**
 * GET/PUT /merchant/theme-settings — the merchant's values for the ACTIVE
 * theme's settings schema (theme.json `settings`), including the Checkout
 * branding section. Tenant-scoped through the merchant auth context like
 * every /merchant route.
 *
 * Storage: cms_setting key "theme_settings", locale-invariant shape
 * { value: { [themeHandle]: { [settingId]: value } } } — values for other
 * themes are preserved, so switching themes back keeps earlier tweaks.
 */

/* Mirrors the storefront middleware's effectiveTheme(): null/"" falls back
 * to the platform default; retired compiled ids map to Liquid successors. */
const DEFAULT_THEME = "learts-liquid"
const RETIRED_THEMES: Record<string, string> = {
  learts: "learts-liquid",
  aurora: "aurora-liquid",
  cignet: "cignet-liquid",
  shofy: "shofy-liquid",
  ekka: "ekka-liquid",
  helendo: "helendo-liquid",
  bazaro: "bazaro-liquid",
  exzo: "exzo-liquid",
  rokon: "rokon-liquid",
}
const effectiveTheme = (raw: unknown): string => {
  const a = typeof raw === "string" ? raw.trim() : ""
  if (!a) return DEFAULT_THEME
  return RETIRED_THEMES[a] ?? a
}

type SchemaEntry = {
  id?: string
  type?: string
  label?: string
  default?: unknown
  min?: number
  max?: number
  options?: { value: string }[] | string[]
}

async function activeThemeSchema(
  scope: any,
  tenant: any
): Promise<{ handle: string; schema: SchemaEntry[] } | null> {
  const handle = effectiveTheme(tenant?.meta?.active_theme)
  try {
    const themeSvc: any = scope.resolve("theme")
    const [theme] = await themeSvc.listThemes({ handle }, { take: 1 })
    if (!theme?.id || !theme?.current_version) return { handle, schema: [] }
    const [version] = await themeSvc.listThemeVersions(
      { theme_id: theme.id, version: theme.current_version },
      { take: 1 }
    )
    const schema = Array.isArray(version?.manifest?.settings)
      ? (version.manifest.settings as SchemaEntry[])
      : []
    return { handle, schema }
  } catch {
    return { handle, schema: [] }
  }
}

async function savedRow(service: CmsModuleService, tenantId: string) {
  const rows = await (service as any).listCmsSettings({
    tenant_id: tenantId,
    key: "theme_settings",
  })
  return rows?.[0] ?? null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  const active = await activeThemeSchema(req.scope, ctx.tenant)
  if (!active) {
    res.status(404).json({ message: "No active theme" })
    return
  }
  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const row = await savedRow(service, ctx.tenant.id)
  const all = ((row?.data as any)?.value ?? {}) as Record<string, unknown>
  const values = (all[active.handle] ?? {}) as Record<string, unknown>
  res.json({ handle: active.handle, schema: active.schema, values })
}

/** Coerce + validate one value against its schema entry. Returns undefined
 * when the value is invalid — invalid entries are simply dropped, so a stale
 * client can never poison the row. */
function sanitize(entry: SchemaEntry, raw: unknown): unknown {
  switch (entry.type) {
    case "color": {
      const v = typeof raw === "string" ? raw.trim() : ""
      return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : undefined
    }
    case "checkbox":
      return typeof raw === "boolean" ? raw : undefined
    case "range": {
      const n = Number(raw)
      if (!Number.isFinite(n)) return undefined
      const min = typeof entry.min === "number" ? entry.min : -Infinity
      const max = typeof entry.max === "number" ? entry.max : Infinity
      return Math.min(max, Math.max(min, n))
    }
    case "select": {
      const v = typeof raw === "string" ? raw : ""
      const opts = (entry.options ?? []).map((o: any) =>
        typeof o === "string" ? o : o?.value
      )
      return opts.includes(v) ? v : undefined
    }
    case "text":
    case "textarea": {
      if (typeof raw !== "string") return undefined
      return raw.slice(0, 2000)
    }
    default:
      // Unknown setting type — accept short strings only.
      return typeof raw === "string" ? raw.slice(0, 500) : undefined
  }
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  const body = (req.body ?? {}) as { values?: Record<string, unknown> }
  if (!body.values || typeof body.values !== "object") {
    res.status(400).json({ message: "values object required" })
    return
  }
  const active = await activeThemeSchema(req.scope, ctx.tenant)
  if (!active) {
    res.status(404).json({ message: "No active theme" })
    return
  }
  // Only ids the ACTIVE theme's schema declares are storable.
  const byId = new Map(
    active.schema.filter((s) => s.id && s.type !== "header").map((s) => [s.id!, s])
  )
  const clean: Record<string, unknown> = {}
  for (const [id, raw] of Object.entries(body.values)) {
    const entry = byId.get(id)
    if (!entry) continue
    const v = sanitize(entry, raw)
    if (v !== undefined) clean[id] = v
  }

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const row = await savedRow(service, ctx.tenant.id)
  const all = ((row?.data as any)?.value ?? {}) as Record<string, unknown>
  const data = { value: { ...all, [active.handle]: clean } }
  if (row) {
    await (service as any).updateCmsSettings({ id: row.id, data })
  } else {
    await (service as any).createCmsSettings({
      tenant_id: ctx.tenant.id,
      key: "theme_settings",
      data,
    })
  }

  // Nudge the storefront cache like every settings publish (non-blocking).
  await emitCmsPublished(req.scope, {
    entity_type: "global",
    slug: "theme_settings",
    locale: null,
    tenant_id: ctx.tenant.id,
  } as any)

  res.json({ handle: active.handle, values: clean })
}
