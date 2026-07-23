import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { THEME_CATALOG, catalogWithPreviewUrls } from "../../admin/cms/themes/_catalog"
import { THEME_MODULE } from "../../../modules/theme"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { searchDomains } from "../../../modules/domains/domain-service"
import { isResellerConfigured } from "../../../modules/domains/provider"
import { applyMarkup, markupPrice } from "../domains/_shared"

/**
 * Pixi — BRAND/MARKETING READ tools (themes, campaigns, domain availability).
 *
 * Same contract as _tools.ts / _tools-connect.ts: every handler is tenant-scoped
 * through the authenticated merchant context (`ctx`) — the tenant is NEVER read
 * from the model's arguments — and NEVER throws. A failure returns `{ error }`
 * (or a degraded payload) the model can read and explain, so a broken tool
 * degrades the answer instead of breaking the run. Nothing here mutates.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"
const DEFAULT_TLDS = ["com", "net", "org", "io", "co", "shop", "store", "xyz"]
const FALLBACK_PRICE_USD = Number(process.env.DOMAIN_FALLBACK_PRICE_USD ?? "12")

/* -------------------------------- list_themes ---------------------------- */

/**
 * The storefront theme gallery this store can apply — the entitlement-filtered
 * compiled catalog PLUS the published uploaded (Liquid) library — and which one
 * is currently active. Mirrors GET /merchant/themes.
 */
export async function listThemes(req: MedusaRequest, ctx: Ctx) {
  try {
    const catalogIds = THEME_CATALOG.map((t) => t.id)
    const allowed: string[] = Array.isArray(ctx.tenant.meta?.allowed_themes)
      ? ctx.tenant.meta.allowed_themes.filter((i: string) => catalogIds.includes(i))
      : catalogIds

    const storefrontUrl =
      process.env.STOREFRONT_PREVIEW_URL ||
      process.env.STOREFRONT_URL ||
      "https://storefront.mautomate.ai"

    const compiled = catalogWithPreviewUrls(storefrontUrl)
      .filter((t) => allowed.includes(t.id))
      .map((t) => ({ id: t.id, name: t.name, engine: "react" as const }))

    let uploaded: any[] = []
    try {
      const svc: any = req.scope.resolve(THEME_MODULE)
      const themes = await svc.listThemes({ status: "published", visibility: "public" })
      uploaded = (themes || []).map((t: any) => ({ id: t.handle, name: t.name, engine: "liquid" as const }))
    } catch {
      // Theme module unavailable — compiled catalog stands alone.
    }

    const all = [...compiled, ...uploaded]
    const ids = all.map((t) => t.id)
    let active = ctx.tenant.meta?.active_theme
    if (!active || !ids.includes(active)) {
      active = ids.includes("learts-liquid") ? "learts-liquid" : uploaded[0]?.id ?? compiled[0]?.id ?? ids[0] ?? null
    }

    return { count: all.length, active_theme: active, themes: all }
  } catch (e: any) {
    return { error: e?.message || "could not read themes" }
  }
}

/* ------------------------------ list_campaigns --------------------------- */

/** The store's marketing campaigns (newest first). Mirrors GET /marketing/campaigns. */
export async function listCampaigns(req: MedusaRequest, ctx: Ctx, args: Record<string, any>) {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)
    const limit = Math.max(1, Math.min(50, Number(args.limit) || 20))
    const filters: Record<string, any> = { tenant_id: ctx.tenant.id }
    if (typeof args.status === "string" && args.status.trim()) filters.status = args.status.trim()

    const [campaigns, count] = await svc.listAndCountMarketingCampaigns(filters, {
      take: limit,
      skip: 0,
      order: { created_at: "DESC" },
    })

    return {
      count,
      campaigns: (Array.isArray(campaigns) ? campaigns : []).map((c: any) => ({
        name: c.name,
        objective: c.objective ?? null,
        status: c.status,
        starts_at: c.starts_at ?? null,
        ends_at: c.ends_at ?? null,
        created_at: c.created_at ?? null,
      })),
    }
  } catch (e: any) {
    return { error: e?.message || "could not read campaigns" }
  }
}

/* ------------------------------- search_domain --------------------------- */

const normalizeQuery = (raw: unknown): string =>
  String(raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "")

const extractSld = (query: string): string => (query.includes(".") ? query.split(".")[0] : query)

function normalizeResult(r: any) {
  const sld = String(r?.domain ?? "")
  const tld = String(r?.tld ?? "")
  const full = sld.includes(".") || !tld ? sld : `${sld}.${tld}`
  return { domain: full, tld, available: r?.available ?? r?.status === "available", price: markupPrice(r?.price) }
}

function fallbackResults(query: string, tlds: string[]) {
  const sld = extractSld(query)
  const price = applyMarkup(FALLBACK_PRICE_USD)
  return tlds.map((tld) => ({
    domain: `${sld}.${tld}`,
    tld,
    available: true,
    price: { register: price, renew: price, transfer: price, currency: "USD" },
  }))
}

/**
 * Check custom-domain availability across TLDs for a name the merchant is
 * considering. Read-only. Mirrors POST /merchant/domains/search (registrar when
 * configured, transparent fallback pricing otherwise).
 */
export async function searchDomain(req: MedusaRequest, ctx: Ctx, args: Record<string, any>) {
  const query = normalizeQuery(args.query ?? args.name ?? args.domain)
  const tlds = Array.isArray(args.tlds) && args.tlds.length ? args.tlds.map(String) : DEFAULT_TLDS

  if (!query || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(extractSld(query))) {
    return { error: "enter a valid domain name, e.g. mystore" }
  }
  try {
    if (!isResellerConfigured()) {
      return {
        query,
        configured: false,
        results: fallbackResults(query, tlds),
        note: "The registrar isn't configured, so these are transparent fallback prices — purchases are handled as manual approvals.",
      }
    }
    const result = await searchDomains(req.scope, { tenantId: ctx.tenant.id, query, tlds })
    if (!result.ok) return { error: result.error ?? "availability lookup failed" }
    return {
      query: result.data?.query ?? query,
      configured: true,
      results: (result.data?.results ?? []).map(normalizeResult),
      note: `Connecting a domain you already own is free — use connect_domain. Buying a new one goes through Settings → Domains.`,
    }
  } catch (e: any) {
    return { error: e?.message || "could not check domain availability" }
  }
}

/* ----------------------- tool catalog + dispatcher ----------------------- */

export const BRAND_READ_DEFS: AiToolDefinition[] = [
  {
    name: "list_themes",
    description:
      "List the storefront themes the store can apply and which one is currently active. Use for 'what themes can I use', 'which theme am I on', 'show me theme options' — and before switch_theme, to resolve the exact theme name.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_campaigns",
    description:
      "List the store's marketing campaigns with their status (draft/active/paused/completed). Use for 'show my campaigns', 'what marketing do I have running', 'any active promotions'.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Optional status filter: draft, active, paused or completed." },
        limit: { type: "number", description: "Max results (1-50, default 20)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_domain",
    description:
      "Check whether a custom domain name is available to register, across common extensions (.com, .shop, etc.), with pricing. Use for 'is mystore.com available', 'find me a domain', 'check domain availability for brandname'.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The domain name or word to check, e.g. 'mystore' or 'mystore.com'." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
]

/** Short human label for the live "Pixi is doing X" stream event. */
export const BRAND_READ_LABELS: Record<string, string> = {
  list_themes: "Looking at your theme options",
  list_campaigns: "Checking your marketing campaigns",
  search_domain: "Checking domain availability",
}

/** Dispatch one BRAND read tool call to its JSON-serialisable result. Never throws. */
export async function runBrandReadTool(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  try {
    switch (name) {
      case "list_themes":
        return await listThemes(req, ctx)
      case "list_campaigns":
        return await listCampaigns(req, ctx, args)
      case "search_domain":
        return await searchDomain(req, ctx, args)
      default:
        return { error: "unknown" }
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" }
  }
}
