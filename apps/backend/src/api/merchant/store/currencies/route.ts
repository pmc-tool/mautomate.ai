import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"
import { ensureStorePricesInCurrency } from "../../_pricing"

const DEFAULT_CURRENCY = "usd"
const normCurrency = (c: unknown): string => String(c ?? "").trim().toLowerCase()
const isCode = (c: string): boolean => /^[a-z]{3}$/.test(c)

/**
 * GET /merchant/store/currencies — the currency codes the merchant can price
 * products in, plus the default.
 *
 * Tenancy adaptation: in the shared-pooled model the single Medusa store's
 * supported_currencies is the UNION across every tenant, so the tenant's own
 * currency contract (tenant.meta.currency_code + tenant.meta.supported_currencies,
 * maintained by /merchant/store) wins when present. The store entity is only
 * the fallback for tenants that predate the meta contract.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const metaDefault = normCurrency(ctx.tenant.meta?.currency_code)
  const metaSupported: string[] = (
    Array.isArray(ctx.tenant.meta?.supported_currencies)
      ? ctx.tenant.meta.supported_currencies
      : []
  )
    .map(normCurrency)
    .filter(isCode)

  if (isCode(metaDefault) || metaSupported.length) {
    const defaultCurrency = isCode(metaDefault) ? metaDefault : metaSupported[0]
    const currencies = Array.from(new Set([defaultCurrency, ...metaSupported]))
    return res.json({ currencies, default_currency: defaultCurrency })
  }

  // Fallback: the store entity's supported currencies.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.*"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const store = (stores || [])[0]
  const supported = ((store?.supported_currencies as any[]) || [])
    .map((c: any) => ({
      code: normCurrency(c?.currency_code),
      is_default: !!c?.is_default,
    }))
    .filter((c) => isCode(c.code))

  const defaultCurrency =
    supported.find((c) => c.is_default)?.code ||
    supported[0]?.code ||
    DEFAULT_CURRENCY
  const currencies = supported.length
    ? Array.from(new Set([defaultCurrency, ...supported.map((c) => c.code)]))
    : [DEFAULT_CURRENCY]

  res.json({ currencies, default_currency: defaultCurrency })
}

/**
 * POST /merchant/store/currencies { currencies: string[], default_currency: string }
 *
 * Persists the TENANT's currency selection. Tenancy constraints (LAW):
 * - The store entity is GLOBAL and shared across tenants — this route NEVER
 *   mutates store.supported_currencies. The selection lives in tenant meta
 *   (tenant.meta.supported_currencies + tenant.meta.currency_code), the same
 *   contract PUT /merchant/store maintains and GET above reads.
 * - Every submitted code is validated against the global store's supported
 *   list (the union of currencies the platform can price in).
 * - default_currency must be one of the submitted currencies.
 * - The default is mirrored onto the tenant's OWN region only (fail-closed
 *   ownership check via region.metadata.tenant_id); tenants on the shared
 *   Platform region skip the mirror rather than mutating a shared region.
 *
 * Responds with the persisted { currencies, default_currency } in the same
 * shape/ordering as GET (default first).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as {
    currencies?: unknown
    default_currency?: unknown
  }

  if (!Array.isArray(body.currencies) || body.currencies.length === 0) {
    return res.status(400).json({
      message: "currencies must be a non-empty array of ISO-4217 codes",
    })
  }

  const currencies: string[] = []
  for (const raw of body.currencies) {
    const code = normCurrency(raw)
    if (!isCode(code)) {
      return res.status(400).json({
        message: `invalid currency code: ${String(raw)}`,
      })
    }
    if (!currencies.includes(code)) currencies.push(code)
  }

  const defaultCurrency = normCurrency(body.default_currency)
  if (!isCode(defaultCurrency)) {
    return res.status(400).json({
      message: "default_currency must be a lowercase ISO-4217 code",
    })
  }
  if (!currencies.includes(defaultCurrency)) {
    return res.status(400).json({
      message: "default_currency must be included in currencies",
    })
  }

  // Validate every code against the GLOBAL store's supported list (read-only).
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.*"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const globalCodes = new Set(
    (((stores || [])[0]?.supported_currencies as any[]) || [])
      .map((c: any) => normCurrency(c?.currency_code))
      .filter(isCode)
  )
  if (globalCodes.size > 0) {
    const unsupported = currencies.filter((c) => !globalCodes.has(c))
    if (unsupported.length) {
      return res.status(400).json({
        message: `unsupported currency codes: ${unsupported
          .map((c) => c.toUpperCase())
          .join(", ")}`,
      })
    }
  }

  const meta = ctx.tenant.meta ?? {}

  // Mirror the default onto the tenant's own region only. Fail-closed: the
  // region must be tagged with THIS tenant's id — a shared Platform region is
  // never mutated, and a missing/foreign region never blocks the meta write.
  const regionId: string | undefined = meta.region_id
  if (regionId) {
    const regionModule: any = req.scope.resolve(Modules.REGION)
    const region = await regionModule.retrieveRegion(regionId).catch(() => null)
    if (
      region &&
      region.metadata?.tenant_id === ctx.tenant.id &&
      normCurrency(region.currency_code) !== defaultCurrency
    ) {
      await regionModule.updateRegions(regionId, {
        currency_code: defaultCurrency,
      })
    }
  }

  // Persist the currency contract onto the tenant meta (merged, not clobbered).
  await ctx.svc.updateTenants({
    id: ctx.tenant.id,
    meta: {
      ...meta,
      currency_code: defaultCurrency,
      supported_currencies: currencies,
    },
  })

  // Products store prices PER currency; without one in the new default the
  // storefront shows no amount. Fill the gap (copying the amount from the old
  // price) so the store stays functional after a currency switch.
  await ensureStorePricesInCurrency(
    req.scope,
    meta.sales_channel_id,
    defaultCurrency,
    normCurrency(meta.currency_code)
  ).catch(() => {})

  const ordered = Array.from(new Set([defaultCurrency, ...currencies]))
  res.json({ currencies: ordered, default_currency: defaultCurrency })
}
