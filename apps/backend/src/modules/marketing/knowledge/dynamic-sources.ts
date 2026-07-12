/**
 * DYNAMIC knowledge sources — knowledge that is GENERATED at train time instead
 * of being pasted once and left to rot.
 *
 * A `marketing_chatbot_data` row normally carries its own literal text
 * (`content`), which the RAG pipeline embeds verbatim. That is right for an FAQ
 * a merchant typed, but wrong for knowledge the STORE already owns and keeps
 * changing — its catalog and its policy pages. A snapshot of those taken at
 * create time starts drifting the moment a price changes or a page is edited,
 * and the bot then confidently answers with yesterday's store.
 *
 * So two source shapes are resolved LIVE, every time the bot is trained:
 *
 *   kind = "product_catalog"        -> the tenant's live, in-channel catalog
 *   source = "store-page:<slug>"    -> the tenant's live CMS page (that slug)
 *
 * The row's stored `content` is refreshed with whatever was rendered (so the
 * training studio shows the merchant exactly what the bot learned) and doubles
 * as the fallback if a render fails. Pressing "Train" therefore RE-SYNCS the bot
 * with the store — no separate sync job, no stale snapshot.
 *
 * TENANT ISOLATION: the catalog is read through the CALL-CENTER commerce gateway,
 * whose product reads are scoped to the tenant's own sales channel
 * (product_sales_channel link, fail-closed when the tenant has no channel). The
 * marketing gateway's `queryProducts` is deliberately NOT used here: it carries a
 * `TODO(tenancy)` and applies no sales-channel filter, so on the pooled backend it
 * would hand one tenant's bot another tenant's products. CMS reads are filtered by
 * `tenant_id` + slug for the same reason.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { getCommerceGateway } from "../../call-center/gateway"
import { CMS_MODULE } from "../../cms"
import { STORE_NAME_TOKEN } from "../../cms/starter-pages"
import { PLATFORM_MODULE } from "../../platform"

/** `source` prefix that marks a row as "the store's CMS page with this slug". */
export const STORE_PAGE_PREFIX = "store-page:"

/** `source` value stored on the generated product-catalog row (human-readable). */
export const PRODUCT_CATALOG_SOURCE = "Live product catalog (this store)"

/**
 * Max products rendered into one catalog source. A catalog is embedded as text,
 * so this bounds both the embedding bill and the retrievable chunk set. Note the
 * commerce gateway scans at most 100 in-channel products per call, so today this
 * is the effective ceiling; the cap is stated in the rendered text so a merchant
 * with a bigger catalog can see that it was truncated.
 */
export const CATALOG_PRODUCT_CAP = 200

/** Description text kept per product (enough to answer "what is it?"). */
const MAX_DESCRIPTION = 600

/** Hard ceiling on any rendered source (mirrors the data route's paste cap). */
export const MAX_RENDERED_CONTENT = 200_000

const collapse = (s: string): string => s.replace(/[ \t]+/g, " ").trim()

/** Strip an HTML fragment down to readable plain text (block tags -> newlines). */
export const htmlToText = (html: string): string => {
  if (!html) {
    return ""
  }
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|section)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  return text
    .split("\n")
    .map((line) => collapse(line))
    .filter((line) => line.length > 0)
    .join("\n")
}

/** The tenant's display name (used to de-tokenise starter CMS copy). */
const tenantName = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string> => {
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const tenant = await svc.retrieveTenant(tenantId)
    const name = typeof tenant?.name === "string" ? tenant.name.trim() : ""
    return name || "this store"
  } catch {
    return "this store"
  }
}

/** Replace the CMS store-name token the way the store read API does. */
export const applyStoreName = (text: string, storeName: string): string =>
  text.split(STORE_NAME_TOKEN).join(storeName)

const priceLine = (
  min: number | null,
  currency: string | null
): string | null => {
  if (min === null || min === undefined || !Number.isFinite(min)) {
    return null
  }
  const cur = (currency ?? "").toUpperCase()
  return cur ? `Price: from ${min} ${cur}` : `Price: from ${min}`
}

/**
 * Render the tenant's live catalog as embeddable text — one block per product,
 * projected exactly like the voice agent's product summary (title, description,
 * price + currency, availability), so the chat bot and the call-center agent
 * describe the same store the same way.
 *
 * Returns "" when the tenant has no in-channel, published products (the caller
 * then marks the source as having nothing to embed rather than embedding a lie).
 */
export const renderProductCatalog = async (
  container: MedusaContainer,
  tenantId: string
): Promise<string> => {
  const gateway = getCommerceGateway(container)
  // Empty query = every in-channel published product, tenant-scoped by the gateway.
  const products = await gateway
    .searchProducts(tenantId, "", CATALOG_PRODUCT_CAP)
    .catch(() => [])

  if (!products.length) {
    return ""
  }

  const capped = products.slice(0, CATALOG_PRODUCT_CAP)
  const blocks = capped.map((p) => {
    const inStock = (p.variants ?? []).some((v) => v.in_stock)
    const quantity = (p.variants ?? []).reduce(
      (n, v) => n + (Number(v.inventory_quantity) || 0),
      0
    )
    const description = collapse(
      htmlToText(p.description ?? "").replace(/\n+/g, " ")
    ).slice(0, MAX_DESCRIPTION)

    const lines = [
      `Product: ${p.title ?? "Untitled product"}`,
      priceLine(p.min_price, p.currency_code),
      inStock
        ? `Availability: in stock${quantity > 0 ? ` (${quantity} available)` : ""}`
        : "Availability: out of stock",
      p.handle ? `Product page: /products/${p.handle}` : null,
      description ? `Description: ${description}` : null,
    ].filter((l): l is string => Boolean(l))

    return lines.join("\n")
  })

  const header = [
    "This store's product catalog. These are the only products this store sells.",
    `Products listed: ${capped.length}${
      products.length >= CATALOG_PRODUCT_CAP
        ? ` (capped at ${CATALOG_PRODUCT_CAP}; the store may sell more)`
        : ""
    }.`,
    "Prices and availability are as of the last time this assistant was trained.",
  ].join(" ")

  return [header, ...blocks].join("\n\n").slice(0, MAX_RENDERED_CONTENT)
}

/**
 * Render one of the tenant's OWN CMS pages (by slug) as embeddable text: the
 * page title plus the readable text of its enabled blocks, in rank order, with
 * the {{store_name}} token resolved.
 *
 * Returns NULL when the tenant has no (live) page with that slug. That is NOT
 * the same as "nothing to say": during signup the store bootstrap runs BEFORE
 * the CMS seed step, so the default assistant is trained while its pages are
 * still a few seconds from existing. Null tells the caller to keep the text the
 * row was seeded with (which is exactly the copy those pages are created with)
 * instead of discarding the source; the next training run reads the merchant's
 * live page and replaces it.
 *
 * Returns "" when the page exists but carries no readable text.
 */
export const renderStorePage = async (
  container: MedusaContainer,
  tenantId: string,
  slug: string
): Promise<string | null> => {
  if (!slug) {
    return null
  }

  const cms: any = container.resolve(CMS_MODULE)

  const pages = await cms
    .listCmsPages({ tenant_id: tenantId, slug }, { take: 1 })
    .catch(() => [])
  const page = Array.isArray(pages) ? pages[0] : null
  if (!page || page.status === "archived") {
    return null
  }

  const sections = await cms
    .listCmsSections(
      { tenant_id: tenantId, page_id: page.id },
      { take: 100, order: { rank: "ASC" } }
    )
    .catch(() => [])

  const parts: string[] = []
  for (const section of Array.isArray(sections) ? sections : []) {
    if (section?.enabled === false) {
      continue
    }
    const data = section?.data ?? {}
    // Text-bearing block payloads keep their copy in string fields; take them all
    // rather than special-casing one block type, so a merchant who swaps the
    // rich_text block for another text block still feeds the bot.
    for (const value of Object.values(data)) {
      if (typeof value !== "string") {
        continue
      }
      const text = htmlToText(value)
      if (text.length > 1) {
        parts.push(text)
      }
    }
  }

  const body = parts.join("\n\n").trim()
  if (!body) {
    return ""
  }

  const storeName = await tenantName(container, tenantId)
  const rendered = [
    `Store page: ${page.title ?? slug} (/${slug})`,
    body,
  ].join("\n\n")

  return applyStoreName(rendered, storeName).slice(0, MAX_RENDERED_CONTENT)
}

/**
 * Resolve a knowledge row to freshly generated text, or null when the row is a
 * plain literal source (FAQ, fetched URL, ...) that the caller should embed as-is.
 *
 * An empty string is a MEANINGFUL result: the row IS dynamic but the store has
 * nothing to say for it yet (no products, no such page). The caller must not
 * fall back to a stale snapshot in that case.
 */
export const resolveDynamicSourceText = async (
  container: MedusaContainer,
  tenantId: string,
  row: { kind?: string | null; source?: string | null; content?: string | null }
): Promise<string | null> => {
  if (row?.kind === "product_catalog") {
    return await renderProductCatalog(container, tenantId)
  }

  const source = typeof row?.source === "string" ? row.source.trim() : ""
  if (source.startsWith(STORE_PAGE_PREFIX)) {
    const slug = source.slice(STORE_PAGE_PREFIX.length).trim()
    const rendered = await renderStorePage(container, tenantId, slug)
    // Page not (yet) published: keep the text this row already carries.
    return rendered === null ? (row.content ?? "").trim() : rendered
  }

  return null
}
