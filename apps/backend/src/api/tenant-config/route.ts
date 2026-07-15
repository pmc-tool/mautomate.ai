import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "../../modules/platform"
import { HostResolver } from "../../modules/platform/host-resolver"
import { MARKETING_MODULE } from "../../modules/marketing"
import { themeAccent } from "../admin/platform/_themes"
import { getOrCreateTenantWebsite, umamiConfigured } from "../../lib/umami"

/**
 * The public embed key of the tenant's chatbot that is LIVE ON THE STOREFRONT,
 * or null when the tenant has none. This is what mounts the chat widget on the
 * tenant's storefront: the key is public by design (it is the same token a
 * merchant pastes into a third-party site's `widget.js` tag) and it is the ONLY
 * chatbot field that leaves here — appearance is fetched by the widget from
 * `/marketing-chat/config?public_key=…`.
 *
 * TWO conditions must BOTH hold, and the second one is the merchant's real
 * on/off switch:
 *   1. the chatbot row is `active` and has a public_key, AND
 *   2. it has an ACTIVE `marketing_chatbot_channel` binding for the "web_widget"
 *      channel — the row the studio's Channels step writes.
 *
 * FAIL-CLOSED: no binding (or an inactive one) => no widget at all. A merchant
 * who turns "My website" off gets no chat bubble, not a bubble that nobody
 * answers. Every chatbot created through the merchant API gets an active
 * web_widget binding by default, so the default experience is unchanged.
 *
 * Best-effort: any failure returns null so a chatbot problem can never break
 * storefront routing.
 */
const activeChatbotPublicKey = async (
  scope: any,
  tenantId: string
): Promise<string | null> => {
  try {
    const mk: any = scope.resolve(MARKETING_MODULE)
    const bots = await mk.listMarketingChatbots(
      { tenant_id: tenantId, active: true },
      { order: { created_at: "ASC" } }
    )
    const candidates = (Array.isArray(bots) ? bots : []).filter(
      (b: any) => typeof b?.public_key === "string" && b.public_key.length > 0
    )
    if (!candidates.length) {
      return null
    }

    // The web_widget bindings that are switched ON for this tenant.
    const bindings = await mk.listMarketingChatbotChannels(
      {
        tenant_id: tenantId,
        channel: "web_widget",
        active: true,
        chatbot_id: candidates.map((b: any) => b.id),
      },
      { take: 100 }
    )
    const live = new Set(
      (Array.isArray(bindings) ? bindings : []).map((r: any) => r.chatbot_id)
    )

    const bot = candidates.find((b: any) => live.has(b.id))
    return bot?.public_key ?? null
  } catch {
    return null
  }
}

/**
 * GET /tenant-config?host=<host> — the pooled storefront's entry point.
 *
 * A single stateless storefront fleet serves every tenant. On each request it
 * asks this endpoint "who owns this Host?" and gets back the tenant's PUBLIC
 * storefront credential (publishable key) + display info, then renders that
 * tenant's store. Publishable keys are public by design, so this route is open
 * (no key required — it is what hands out the key).
 *
 * Returns 404 for an unknown/unroutable host so the storefront can show a
 * "store not found" page instead of leaking another tenant's data.
 */

/**
 * The countries this store can ACTUALLY deliver to.
 *
 * Pooled tenants share one region that lists every country on earth, so the
 * storefront's address form happily offered all of them — including countries the
 * merchant has no delivery option for. The shopper picked one, reached Delivery,
 * saw an empty shipping list, and "Continue to payment" simply never enabled.
 * They could not buy, and nothing on the page said why.
 *
 * A country you cannot ship to should never be offered in the first place. This
 * is the list the address form is allowed to show: the geo zones of the tenant's
 * OWN locations that carry at least one live, non-return shipping option.
 *
 * Empty array = the merchant has not set up delivery anywhere yet. Never throws.
 */
const shippableCountries = async (
  scope: any,
  tenantId: string
): Promise<string[]> => {
  try {
    const pg: any = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = await pg
      .select("gz.country_code")
      .from("stock_location as sl")
      .join("location_fulfillment_set as lfs", "lfs.stock_location_id", "sl.id")
      .join("fulfillment_set as fs", "fs.id", "lfs.fulfillment_set_id")
      .join("service_zone as sz", "sz.fulfillment_set_id", "fs.id")
      .join("geo_zone as gz", "gz.service_zone_id", "sz.id")
      .join("shipping_option as so", "so.service_zone_id", "sz.id")
      .whereRaw("sl.metadata->>'tenant_id' = ?", [tenantId])
      .whereNull("sl.deleted_at")
      .whereNull("sz.deleted_at")
      .whereNull("gz.deleted_at")
      .whereNull("so.deleted_at")
      .whereNotExists(function (this: any) {
        // A return option is not a delivery option.
        this.select(pg.raw("1"))
          .from("shipping_option_rule as sor")
          .whereRaw("sor.shipping_option_id = so.id")
          .andWhere("sor.attribute", "is_return")
          .andWhereRaw("sor.value::text like '%true%'")
          .whereNull("sor.deleted_at")
      })

    return Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .map((r: any) => String(r.country_code || "").toLowerCase())
          .filter(Boolean)
      )
    ).sort()
  } catch {
    return []
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const host = String(
    (req.query.host as string) ?? req.headers["x-forwarded-host"] ?? req.headers.host ?? ""
  )
  if (!host) {
    res.status(400).json({ message: "host required" })
    return
  }

  const resolver = new HostResolver(req.scope)
  const resolved = await resolver.resolve(host)
  // A store is routable if it is pooled (has a publishable key) OR runs a
  // dedicated instance (has a backend_url). Dedicated instances get their
  // publishable key from their own Medusa, not the control plane.
  if (!resolved || (!resolved.publishable_key && !resolved.backend_url)) {
    res.status(404).json({ message: "no store for this host" })
    return
  }

  // include the tenant display name for the storefront header
  const svc = req.scope.resolve(PLATFORM_MODULE) as any
  const [tenant] = await svc.listTenants({ id: resolved.tenant_id }, { take: 1 })

  const accent = await themeAccent(req.scope, tenant?.meta?.theme_key)
  let umamiWebsiteId: string | null = null
  if (umamiConfigured() && tenant) {
    umamiWebsiteId = await getOrCreateTenantWebsite(svc, tenant).catch(() => null)
  }
  const chatbotPublicKey = await activeChatbotPublicKey(
    req.scope,
    resolved.tenant_id
  )
  const shipCountries = await shippableCountries(req.scope, resolved.tenant_id)

  res.json({
    tenant_id: resolved.tenant_id,
    // Countries the storefront may offer at checkout. Anything else dead-ends at
    // "Continue to payment" with no shipping method.
    shipping_countries: shipCountries,
    // Public embed key of the chatbot this tenant has switched ON for its own
    // storefront (its active "web_widget" channel binding). Null => no live bot
    // and the storefront renders no chat widget at all. Additive + backwards
    // compatible: older storefront builds simply ignore it.
    chatbot_public_key: chatbotPublicKey,
    name: tenant?.name ?? null,
    publishable_key: resolved.publishable_key,
    umami_website_id: umamiWebsiteId,
    status: resolved.status,
    domain: resolved.domain,
    theme_accent: accent,
    // Per-tenant active storefront theme id (the real compiled-in Next.js theme,
    // e.g. "learts" / "aurora"). Lives in tenant.meta so it is per-tenant without
    // tenant-scoping the whole CMS module. The multi-tenant storefront reads this
    // to pick which theme package renders. Null => storefront falls back to default.
    active_theme:
      typeof tenant?.meta?.active_theme === "string"
        ? tenant.meta.active_theme
        : null,
    // Dedicated-instance backend (instance-per-tenant). When set, this tenant
    // runs its OWN Medusa instance/admin at this URL; the edge routes the store
    // admin + store API there. Null => pooled tenant on the shared backend.
    backend_url: tenant?.backend_url ?? null,
    // Per-tenant region id — the region that carries THIS tenant's currency
    // (and its supported currencies). In a pooled backend /store/regions returns
    // every tenant's region, so the storefront cannot pick the right currency by
    // country code alone; it resolves this region_id directly. Lives in
    // tenant.meta (set by the merchant/currency flow). Null => storefront falls
    // back to its country-code region lookup (single-region / legacy behavior).
    region_id:
      typeof tenant?.meta?.region_id === "string"
        ? tenant.meta.region_id
        : null,
    // The tenant's currency code (informational — the authoritative currency is
    // the region_id region's currency_code, which prices are denominated in).
    currency_code:
      typeof tenant?.meta?.currency_code === "string"
        ? tenant.meta.currency_code
        : null,
  })
}
