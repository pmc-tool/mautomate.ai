import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

/**
 * /merchant/store — the tenant's currency configuration.
 *
 * A Medusa region carries a SINGLE currency, so "supported currencies" is
 * modeled at the TENANT level in tenant.meta.supported_currencies (an array),
 * while tenant.meta.currency_code is the default and mirrors the tenant's
 * dedicated (country-less, metadata.tenant_id-tagged) region currency_code.
 *
 * Every operation is scoped strictly to ctx.tenant. The region is resolved ONLY
 * from tenant.meta.region_id — we never touch another tenant's region.
 */

const CURRENCY_RE = /^[a-z]{3}$/

function normalizeCodes(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== "string") return null
    const code = raw.trim().toLowerCase()
    if (!CURRENCY_RE.test(code)) return null
    if (!out.includes(code)) out.push(code)
  }
  return out
}

function shape(meta: any) {
  const defaultCode = (meta?.currency_code ?? "usd").toLowerCase()
  const supported =
    Array.isArray(meta?.supported_currencies) && meta.supported_currencies.length
      ? meta.supported_currencies
      : [defaultCode]
  return {
    default_currency_code: defaultCode,
    supported_currencies: supported,
    region_id: meta?.region_id ?? null,
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  res.json(shape(ctx.tenant.meta))
}

/**
 * PUT /merchant/store { default_currency_code?, supported_currencies? }
 * Validates lowercase ISO-4217 codes, persists to tenant.meta (merged), and
 * mirrors the new default onto the tenant's own region currency_code.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as {
    default_currency_code?: string
    supported_currencies?: string[]
  }

  const meta = ctx.tenant.meta ?? {}
  const regionId: string | undefined = meta.region_id

  if (!regionId) {
    return res.status(404).json({
      message:
        "no region configured for this tenant yet — store must be bootstrapped (or backfilled) before currencies can be changed",
    })
  }

  // resolve the new default
  let defaultCode = (meta.currency_code ?? "usd").toLowerCase()
  if (body.default_currency_code !== undefined) {
    const code = String(body.default_currency_code).trim().toLowerCase()
    if (!CURRENCY_RE.test(code)) {
      return res.status(400).json({
        message: "default_currency_code must be a lowercase ISO-4217 code",
      })
    }
    defaultCode = code
  }

  // resolve the supported set
  let supported: string[]
  if (body.supported_currencies !== undefined) {
    const normalized = normalizeCodes(body.supported_currencies)
    if (!normalized) {
      return res.status(400).json({
        message:
          "supported_currencies must be an array of lowercase ISO-4217 codes",
      })
    }
    supported = normalized
  } else {
    supported =
      Array.isArray(meta.supported_currencies) && meta.supported_currencies.length
        ? meta.supported_currencies.map((c: string) => c.toLowerCase())
        : [defaultCode]
  }

  // the default is always part of the supported set
  if (!supported.includes(defaultCode)) supported.unshift(defaultCode)

  // fail-closed ownership check: the region MUST be tagged with this tenant id
  const regionModule: any = req.scope.resolve(Modules.REGION)
  const region = await regionModule.retrieveRegion(regionId).catch(() => null)
  if (!region || region.metadata?.tenant_id !== ctx.tenant.id) {
    return res.status(404).json({
      message: "region not found for this tenant",
    })
  }

  // mirror the default currency onto the tenant's own region
  // updateRegions(id: string, data: UpdateRegionDTO): Promise<RegionDTO>
  await regionModule.updateRegions(regionId, { currency_code: defaultCode })

  // persist the currency contract onto the tenant meta (merged, not clobbered)
  await ctx.svc.updateTenants({
    id: ctx.tenant.id,
    meta: {
      ...meta,
      currency_code: defaultCode,
      supported_currencies: supported,
    },
  })

  res.json({
    default_currency_code: defaultCode,
    supported_currencies: supported,
    region_id: regionId,
  })
}
