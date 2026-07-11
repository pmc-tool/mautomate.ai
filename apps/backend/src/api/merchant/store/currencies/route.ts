import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"

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
