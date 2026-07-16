import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { getCommerceGateway } from "../gateway"
import { PLATFORM_MODULE } from "../../platform"
import { requireMetaAccountContext } from "./pixel"
import type { AdsCredentials } from "./types"

/**
 * Product catalog feed + Meta Commerce catalog sync — the data behind dynamic
 * / catalog ads (and, in later phases, Google Merchant Center feeds from the
 * same builder).
 *
 * The feed is built from the commerce gateway's TENANT-SCOPED product reads
 * (sales-channel scoped, fail-closed), so one store's products can never leak
 * into another store's catalog. Items missing what Meta requires (price or
 * image) are SKIPPED and counted honestly instead of failing the whole sync
 * or pushing broken items.
 */

const GRAPH = "https://graph.facebook.com/v25.0"
const BATCH_SIZE = 100

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const graphJson = async (res: Response): Promise<any> => {
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      data?.error?.message ?? `Meta request failed (${res.status})`
    )
  }
  return data
}

const stripHtml = (s: string): string =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** The public base URL of a tenant's storefront: primary/verified custom
 *  domain first, else the free <slug>.mautomate.ai subdomain. */
export const storeBaseUrl = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string | null> => {
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const domains: any[] = await svc.listTenantDomains(
      { tenant_id: tenantId },
      { take: 20 }
    )
    const custom = (domains ?? [])
      .filter(
        (d) => d.type === "custom" && d.verification_status === "verified"
      )
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]
    if (custom?.domain) return `https://${custom.domain}`
    const free = (domains ?? []).find((d) => d.type === "free")
    if (free?.domain) return `https://${free.domain}`
    const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
    return tenant?.slug ? `https://${tenant.slug}.mautomate.ai` : null
  } catch {
    return null
  }
}

export type CatalogItem = Record<string, any>

export type CatalogFeed = {
  items: CatalogItem[]
  eligible: number
  skipped: number
  skipped_reasons: Record<string, number>
}

/**
 * product_id -> { price, currency } straight from the variants' price sets.
 * The commerce gateway's representative price relies on `calculated_price`,
 * which needs a pricing context the marketing graph never passes — so for the
 * feed (where price is REQUIRED) prices are read directly: the tenant's own
 * currency wins, else the variant's first price. Amounts are MAJOR units
 * (repo-wide money rule).
 */
const productPriceMap = async (
  container: MedusaContainer,
  tenantId: string,
  productIds: string[]
): Promise<Map<string, { price: number; currency: string }>> => {
  const map = new Map<string, { price: number; currency: string }>()
  if (!productIds.length) return map

  let tenantCurrency: string | null = null
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
    tenantCurrency =
      typeof tenant?.meta?.currency_code === "string"
        ? tenant.meta.currency_code.toLowerCase()
        : null
  } catch {
    tenantCurrency = null
  }

  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      filters: { id: productIds },
      fields: [
        "id",
        "variants.id",
        "variants.prices.amount",
        "variants.prices.currency_code",
      ],
      pagination: { take: productIds.length, skip: 0 },
    })
    for (const p of data ?? []) {
      const prices = (p.variants ?? []).flatMap((v: any) => v?.prices ?? [])
      const inTenantCurrency = tenantCurrency
        ? prices.find(
            (pr: any) =>
              String(pr?.currency_code ?? "").toLowerCase() === tenantCurrency &&
              Number(pr?.amount) > 0
          )
        : null
      const chosen =
        inTenantCurrency ?? prices.find((pr: any) => Number(pr?.amount) > 0)
      if (chosen) {
        map.set(p.id, {
          price: Number(chosen.amount),
          currency: String(chosen.currency_code).toLowerCase(),
        })
      }
    }
  } catch {
    // Price graph unavailable: the feed will honestly skip these as "no price".
  }
  return map
}

/** Build Meta Catalog Batch items from the tenant's PUBLISHED products. */
export const buildCatalogFeed = async (
  container: MedusaContainer,
  tenantId: string,
  opts: { limit?: number; storeName?: string | null } = {}
): Promise<CatalogFeed> => {
  const gateway = getCommerceGateway(container)
  const products = await gateway.queryProducts(tenantId, {
    status: "published",
    limit: opts.limit ?? 500,
  })
  const base = await storeBaseUrl(container, tenantId)
  const priceMap = await productPriceMap(
    container,
    tenantId,
    (products ?? []).map((p) => p.id)
  )

  const items: CatalogItem[] = []
  const reasons: Record<string, number> = {}
  const skip = (why: string) => {
    reasons[why] = (reasons[why] ?? 0) + 1
  }

  for (const p of products ?? []) {
    const image = p.thumbnail ?? p.images?.[0] ?? null
    if (!image) {
      skip("no image")
      continue
    }
    // Gateway representative price when present, else the direct price-set read.
    const direct = priceMap.get(p.id)
    const price = p.price != null && p.currency_code ? Number(p.price) : direct?.price
    const currency =
      p.price != null && p.currency_code ? p.currency_code : direct?.currency
    if (price == null || !currency) {
      skip("no price")
      continue
    }
    if (!base || !p.handle) {
      skip("no product link")
      continue
    }
    items.push({
      id: p.id,
      title: p.title ?? "(untitled product)",
      description: stripHtml(p.description ?? p.subtitle ?? p.title ?? ""),
      availability: "in stock",
      condition: "new",
      // Money rule: prices are MAJOR units; Meta wants "9.99 USD".
      price: `${price.toFixed(2)} ${currency.toUpperCase()}`,
      link: `${base}/products/${p.handle}`,
      image_link: image,
      brand: opts.storeName ?? "Store",
    })
  }

  return {
    items,
    eligible: items.length,
    skipped: Object.values(reasons).reduce((a, b) => a + b, 0),
    skipped_reasons: reasons,
  }
}

/** Find-or-create the tenant's Meta Commerce catalog; returns the ads_catalog row. */
const ensureMetaCatalog = async (
  mk: any,
  creds: AdsCredentials,
  tenantId: string,
  connectionId: string,
  storeName: string
): Promise<any> => {
  const existing = first(
    await mk.listAdsCatalogs({ tenant_id: tenantId, platform: "meta" })
  )
  if (existing?.external_id) return existing

  const bizRes = await fetch(
    `${GRAPH}/me/businesses?fields=id,name&limit=10&access_token=${encodeURIComponent(
      creds.accessToken
    )}`
  )
  const bizData = await graphJson(bizRes)
  const business = bizData?.data?.[0]
  if (!business?.id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Your Meta account has no Business Manager. Create one at business.facebook.com (free), then try again — Meta requires it to own a product catalog."
    )
  }

  const createRes = await fetch(
    `${GRAPH}/${business.id}/owned_product_catalogs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: `${storeName} catalog`,
        access_token: creds.accessToken,
      }).toString(),
    }
  )
  const created = await graphJson(createRes)

  return first(
    await mk.createAdsCatalogs({
      tenant_id: tenantId,
      connection_id: connectionId,
      platform: "meta",
      external_id: String(created.id),
      business_id: String(business.id),
      name: `${storeName} catalog`,
      status: "active",
    } as any)
  )
}

export type CatalogSyncResult = {
  catalog_id: string
  pushed: number
  skipped: number
  skipped_reasons: Record<string, number>
}

/**
 * Sync the tenant's products into its Meta catalog (find-or-create) via the
 * Catalog Batch API. Idempotent: items are UPDATE-upserted by retailer id
 * (the product id), so re-syncs refresh rather than duplicate.
 */
export const syncTenantCatalog = async (
  mk: any,
  container: MedusaContainer,
  tenantId: string,
  opts: { storeName?: string | null } = {}
): Promise<CatalogSyncResult> => {
  const { connection, creds, platform } = await requireMetaAccountContext(
    mk,
    tenantId
  )
  const storeName = opts.storeName ?? "Store"

  const feed = await buildCatalogFeed(container, tenantId, { storeName })
  if (feed.items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      feed.skipped > 0
        ? `No products are ready for the catalog yet — ${feed.skipped} were skipped (${Object.entries(
            feed.skipped_reasons
          )
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}). Products need a photo and a price.`
        : "This store has no published products to sync yet."
    )
  }

  // Demo platform: the feed is built from the store's REAL products (so the
  // counts and skip reasons are truthful), but nothing leaves the platform —
  // no Business Manager, no Graph calls.
  if (platform === "mock") {
    const existingDemo = first(
      await mk.listAdsCatalogs({ tenant_id: tenantId, platform: "mock" })
    )
    const demo = existingDemo?.id
      ? existingDemo
      : first(
          await mk.createAdsCatalogs({
            tenant_id: tenantId,
            connection_id: connection.id,
            platform: "mock",
            external_id: "demo-catalog-1",
            business_id: "demo-business",
            name: `${storeName} catalog (demo)`,
            status: "active",
          } as any)
        )
    await mk.updateAdsCatalogs({
      id: demo.id,
      item_count: feed.items.length,
      skipped_count: feed.skipped,
      status: "active",
      last_synced_at: new Date(),
      meta: { skipped_reasons: feed.skipped_reasons },
    } as any)
    await mk.createAdsActionLogs({
      tenant_id: tenantId,
      actor: "merchant",
      action: "catalog.synced",
      level: "catalog",
      object_id: demo.id,
      external_id: demo.external_id,
      reason: `${feed.items.length} products prepared for the demo catalog${
        feed.skipped ? ` (${feed.skipped} skipped — need photo/price)` : ""
      }`,
    } as any)
    return {
      catalog_id: demo.external_id,
      pushed: feed.items.length,
      skipped: feed.skipped,
      skipped_reasons: feed.skipped_reasons,
    }
  }

  const catalog = await ensureMetaCatalog(
    mk,
    creds,
    tenantId,
    connection.id,
    storeName
  )

  for (let i = 0; i < feed.items.length; i += BATCH_SIZE) {
    const chunk = feed.items.slice(i, i + BATCH_SIZE)
    const res = await fetch(`${GRAPH}/${catalog.external_id}/items_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        item_type: "PRODUCT_ITEM",
        requests: JSON.stringify(
          chunk.map((data) => ({ method: "UPDATE", data }))
        ),
        access_token: creds.accessToken,
      }).toString(),
    })
    await graphJson(res)
  }

  await mk.updateAdsCatalogs({
    id: catalog.id,
    item_count: feed.items.length,
    skipped_count: feed.skipped,
    status: "active",
    last_synced_at: new Date(),
    meta: { skipped_reasons: feed.skipped_reasons },
  } as any)

  await mk.createAdsActionLogs({
    tenant_id: tenantId,
    actor: "merchant",
    action: "catalog.synced",
    level: "catalog",
    object_id: catalog.id,
    external_id: catalog.external_id,
    reason: `${feed.items.length} products synced to the Meta catalog${
      feed.skipped ? ` (${feed.skipped} skipped — need photo/price)` : ""
    }`,
  } as any)

  return {
    catalog_id: catalog.external_id,
    pushed: feed.items.length,
    skipped: feed.skipped,
    skipped_reasons: feed.skipped_reasons,
  }
}
