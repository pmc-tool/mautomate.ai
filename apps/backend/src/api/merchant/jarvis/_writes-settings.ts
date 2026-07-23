import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ensureStorePricesInCurrency } from "../_pricing"

/**
 * Pixi P1 — SOFT WRITE tools for STORE SETTINGS (country + currency).
 *
 * Same hard wall between deciding and doing as `_writes-soft.ts`:
 *
 *   - `plan()` NEVER mutates. It normalises the merchant's words into a concrete
 *     value (a country name/code -> ISO-3166 alpha-2; a currency word/code ->
 *     ISO-4217), validates it (currency is checked against the platform's
 *     supported list), captures the current value so the change can be undone,
 *     and returns `{ human_summary, details, apply_args }` for the confirm card.
 *     Bad input comes back as `{ ok:false, error }` — a friendly sentence.
 *   - `apply()` runs ONLY the value `plan()` produced by replicating EXACTLY what
 *     the REST routes do (setup PATCH for country; store/currencies POST for
 *     currency, including the region mirror + re-pricing) and returns
 *     `{ result, undo? }`.
 *
 * Tenancy is ALWAYS taken from `ctx` (`ctx.tenant.id` / `ctx.tenant.meta`); the
 * model never supplies a tenant. Nothing here leaks an internal error.
 *
 * Undo model: both writes are self-reversing — their `undo` re-invokes the SAME
 * tool's `apply()` with the previous value captured at plan time. When there was
 * no previous value to revert to, undo declares `{ available:false }`.
 */

export type Ctx = { tenant: any; merchant: any; svc: any }

export type PlanResult =
  | {
      ok: true
      human_summary: string
      details: Record<string, unknown>
      apply_args: Record<string, any>
    }
  | { ok: false; error: string }

export type ApplyResult = {
  result: any
  undo?:
    | { action: string; apply_args: Record<string, any> }
    | { available: false; reason: string }
}

export type JarvisWrite = {
  name: string
  description: string
  parameters: Record<string, unknown>
  risk: "low" | "med" | "high"
  tier: "soft" | "hard"
  requireText?: string
  plan(req: MedusaRequest, ctx: Ctx, args: Record<string, any>): Promise<PlanResult>
  apply(
    req: MedusaRequest,
    ctx: Ctx,
    applyArgs: Record<string, any>
  ): Promise<ApplyResult>
}

/* ------------------------------- internals ------------------------------- */

const q = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.QUERY)

/** Turn any thrown error into a short, merchant-safe sentence. */
function friendly(e: any, fallback: string): string {
  const msg = String(e?.message || "")
  // Never surface stack traces, SQL, or internal ids in the message.
  if (!msg || msg.length > 160 || /\b(at |Error:|node_modules|SELECT |INSERT )/i.test(msg)) {
    return fallback
  }
  return msg
}

const normCurrency = (c: unknown): string => String(c ?? "").trim().toLowerCase()
const isCode = (c: string): boolean => /^[a-z]{3}$/.test(c)
const isCountryCode = (c: string): boolean => /^[a-z]{2}$/.test(c)

/**
 * Common country NAME -> ISO-3166 alpha-2 (lowercase). A direct 2-letter code is
 * accepted as-is by the resolver below; this map only covers the spoken names a
 * merchant is likely to type. Codes are the canonical lowercase alpha-2.
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  bangladesh: "bd",
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  "u.s.a.": "us",
  "u.s.": "us",
  america: "us",
  "united kingdom": "gb",
  uk: "gb",
  "u.k.": "gb",
  britain: "gb",
  "great britain": "gb",
  england: "gb",
  canada: "ca",
  australia: "au",
  india: "in",
  pakistan: "pk",
  nepal: "np",
  "sri lanka": "lk",
  germany: "de",
  france: "fr",
  italy: "it",
  spain: "es",
  portugal: "pt",
  netherlands: "nl",
  holland: "nl",
  belgium: "be",
  ireland: "ie",
  switzerland: "ch",
  austria: "at",
  sweden: "se",
  norway: "no",
  denmark: "dk",
  finland: "fi",
  poland: "pl",
  china: "cn",
  japan: "jp",
  "south korea": "kr",
  korea: "kr",
  "hong kong": "hk",
  taiwan: "tw",
  singapore: "sg",
  malaysia: "my",
  indonesia: "id",
  thailand: "th",
  vietnam: "vn",
  philippines: "ph",
  "new zealand": "nz",
  brazil: "br",
  mexico: "mx",
  argentina: "ar",
  "south africa": "za",
  nigeria: "ng",
  kenya: "ke",
  egypt: "eg",
  turkey: "tr",
  "united arab emirates": "ae",
  uae: "ae",
  "u.a.e.": "ae",
  "saudi arabia": "sa",
  qatar: "qa",
  kuwait: "kw",
  israel: "il",
}

/** Canonical alpha-2 -> a nice display name for the confirm summary. */
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  bd: "Bangladesh",
  us: "United States",
  gb: "United Kingdom",
  ca: "Canada",
  au: "Australia",
  in: "India",
  pk: "Pakistan",
  np: "Nepal",
  lk: "Sri Lanka",
  de: "Germany",
  fr: "France",
  it: "Italy",
  es: "Spain",
  pt: "Portugal",
  nl: "Netherlands",
  be: "Belgium",
  ie: "Ireland",
  ch: "Switzerland",
  at: "Austria",
  se: "Sweden",
  no: "Norway",
  dk: "Denmark",
  fi: "Finland",
  pl: "Poland",
  cn: "China",
  jp: "Japan",
  kr: "South Korea",
  hk: "Hong Kong",
  tw: "Taiwan",
  sg: "Singapore",
  my: "Malaysia",
  id: "Indonesia",
  th: "Thailand",
  vn: "Vietnam",
  ph: "Philippines",
  nz: "New Zealand",
  br: "Brazil",
  mx: "Mexico",
  ar: "Argentina",
  za: "South Africa",
  ng: "Nigeria",
  ke: "Kenya",
  eg: "Egypt",
  tr: "Turkey",
  ae: "United Arab Emirates",
  sa: "Saudi Arabia",
  qa: "Qatar",
  kw: "Kuwait",
  il: "Israel",
}

/**
 * Resolve a country name OR 2-letter code to a canonical ISO-3166 alpha-2
 * lowercase code, or null when it can't be understood. A direct 2-letter alpha
 * input is taken as the code (same leniency as the setup route, which only
 * checks length 2); otherwise we look the spoken name up in the map.
 */
function resolveCountryCode(input: unknown): string | null {
  const raw = String(input ?? "").trim().toLowerCase()
  if (!raw) return null
  if (isCountryCode(raw)) return raw
  const cleaned = raw.replace(/\s+/g, " ")
  if (COUNTRY_NAME_TO_CODE[cleaned]) return COUNTRY_NAME_TO_CODE[cleaned]
  const noDots = cleaned.replace(/\./g, "")
  if (COUNTRY_NAME_TO_CODE[noDots]) return COUNTRY_NAME_TO_CODE[noDots]
  return null
}

const countryName = (cc: string): string =>
  COUNTRY_CODE_TO_NAME[cc] || cc.toUpperCase()

/**
 * Common currency WORD -> ISO-4217 alpha-3 (lowercase). A direct 3-letter code is
 * accepted as-is; this only covers the spoken names.
 */
const CURRENCY_WORD_TO_CODE: Record<string, string> = {
  taka: "bdt",
  bdt: "bdt",
  dollar: "usd",
  dollars: "usd",
  "us dollar": "usd",
  "u.s. dollar": "usd",
  usd: "usd",
  euro: "eur",
  euros: "eur",
  eur: "eur",
  pound: "gbp",
  pounds: "gbp",
  sterling: "gbp",
  "pound sterling": "gbp",
  gbp: "gbp",
  rupee: "inr",
  rupees: "inr",
  inr: "inr",
  yen: "jpy",
  jpy: "jpy",
  yuan: "cny",
  rmb: "cny",
  cny: "cny",
}

/**
 * Resolve a currency word OR 3-letter code to a canonical ISO-4217 alpha-3
 * lowercase code, or null when it can't be understood.
 */
function resolveCurrencyCode(input: unknown): string | null {
  const raw = String(input ?? "").trim().toLowerCase()
  if (!raw) return null
  if (isCode(raw)) return raw
  const cleaned = raw.replace(/\s+/g, " ")
  if (CURRENCY_WORD_TO_CODE[cleaned]) return CURRENCY_WORD_TO_CODE[cleaned]
  return null
}

/**
 * The set of currency codes the GLOBAL store can price in (the platform-wide
 * union). Read-only. Same lookup the store/currencies route validates against.
 */
async function globalSupportedCurrencies(req: MedusaRequest): Promise<Set<string>> {
  const query = q(req)
  const { data: stores } = await query
    .graph({
      entity: "store",
      fields: ["id", "supported_currencies.*"],
      pagination: { take: 1, skip: 0 } as any,
    })
    .catch(() => ({ data: [] as any[] }))
  return new Set(
    (((stores || [])[0]?.supported_currencies as any[]) || [])
      .map((c: any) => normCurrency(c?.currency_code))
      .filter(isCode)
  )
}

/* ------------------------------ 1. set_store_country --------------------- */

const setStoreCountry: JarvisWrite = {
  name: "set_store_country",
  description:
    "Set your store's country — where you're based and sell from. Use for 'set my country to Bangladesh', 'my store is in the US', 'change store country to UK'. Takes a country name or 2-letter code.",
  parameters: {
    type: "object",
    properties: {
      country: {
        type: "string",
        description: "The country name or ISO 2-letter code, e.g. 'Bangladesh' or 'BD'.",
      },
    },
    required: ["country"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const cc = resolveCountryCode(args.country)
    if (!cc) {
      return { ok: false, error: "Tell me the country, e.g. Bangladesh or BD." }
    }
    const prev = String(ctx.tenant?.meta?.default_country || "").toLowerCase()
    const prevCode = isCountryCode(prev) ? prev : null
    if (prevCode === cc) {
      return {
        ok: false,
        error: `Your store country is already ${countryName(cc)} (${cc.toUpperCase()}).`,
      }
    }
    return {
      ok: true,
      human_summary: `Set your store country to ${countryName(cc)} (${cc.toUpperCase()})?`,
      details: {
        country: countryName(cc),
        country_code: cc.toUpperCase(),
        from: prevCode ? prevCode.toUpperCase() : null,
      },
      apply_args: { country_code: cc, previous_country_code: prevCode },
    }
  },

  async apply(req, ctx, applyArgs) {
    const cc = String(applyArgs.country_code || "").toLowerCase()
    if (!isCountryCode(cc)) {
      return {
        result: { ok: false, error: "That country code isn't valid." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      // Replicates setup PATCH: set default_country + mark the country as
      // explicitly confirmed, merging (not clobbering) existing meta.
      const meta = { ...((ctx.tenant.meta ?? {}) as Record<string, any>) }
      meta.default_country = cc
      meta.country_confirmed = true
      await ctx.svc.updateTenants({ id: ctx.tenant.id, meta })

      const prev = String(applyArgs.previous_country_code || "").toLowerCase()
      const undo = isCountryCode(prev)
        ? {
            action: "set_store_country",
            apply_args: { country_code: prev, previous_country_code: cc },
          }
        : {
            available: false as const,
            reason: "Your store had no country set before, so there's nothing to revert to.",
          }
      return {
        result: { ok: true, country_code: cc, country: countryName(cc) },
        undo,
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't set your store country.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* ----------------------------- 2. set_store_currency --------------------- */

const setStoreCurrency: JarvisWrite = {
  name: "set_store_currency",
  description:
    "Set your store's currency — what customers are charged in. Warning: this re-prices your products in the new currency. Use for 'switch my currency to BDT', 'sell in taka', 'change store currency to euros'. Takes a currency name or 3-letter code.",
  parameters: {
    type: "object",
    properties: {
      currency: {
        type: "string",
        description: "The currency name or ISO 3-letter code, e.g. 'taka' or 'BDT'.",
      },
    },
    required: ["currency"],
    additionalProperties: false,
  },
  risk: "low",
  tier: "soft",

  async plan(req, ctx, args) {
    const code = resolveCurrencyCode(args.currency)
    if (!code) {
      return {
        ok: false,
        error: "Tell me the currency, e.g. Taka or BDT.",
      }
    }
    // Validate against the GLOBAL store's supported currencies — the same check
    // the store/currencies route runs (only enforced when the store lists any).
    const globalCodes = await globalSupportedCurrencies(req)
    if (globalCodes.size > 0 && !globalCodes.has(code)) {
      return {
        ok: false,
        error: `${code.toUpperCase()} isn't available to price in yet — contact support to add it.`,
      }
    }
    const prev = normCurrency(ctx.tenant?.meta?.currency_code)
    const prevCode = isCode(prev) ? prev : null
    if (prevCode === code) {
      return {
        ok: false,
        error: `Your store currency is already ${code.toUpperCase()}.`,
      }
    }
    return {
      ok: true,
      human_summary: `Switch your store currency to ${code.toUpperCase()}? Your products will be re-priced in ${code.toUpperCase()}.`,
      details: {
        currency_code: code.toUpperCase(),
        from: prevCode ? prevCode.toUpperCase() : null,
        note: "Products are re-priced into the new currency.",
      },
      apply_args: { currency_code: code, previous_currency_code: prevCode },
    }
  },

  async apply(req, ctx, applyArgs) {
    const defaultCurrency = normCurrency(applyArgs.currency_code)
    if (!isCode(defaultCurrency)) {
      return {
        result: { ok: false, error: "That currency code isn't valid." },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
    try {
      // Replicates store/currencies POST exactly.
      const meta = (ctx.tenant.meta ?? {}) as Record<string, any>

      // Supported list = the new default plus whatever the tenant already had.
      const existing: string[] = (
        Array.isArray(meta.supported_currencies) ? meta.supported_currencies : []
      )
        .map(normCurrency)
        .filter(isCode)
      const supported = Array.from(new Set([defaultCurrency, ...existing]))

      // Mirror the default onto the tenant's OWN region only. Fail-closed: the
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
          supported_currencies: supported,
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

      const prev = normCurrency(applyArgs.previous_currency_code)
      const undo = isCode(prev)
        ? {
            action: "set_store_currency",
            apply_args: { currency_code: prev, previous_currency_code: defaultCurrency },
          }
        : {
            available: false as const,
            reason: "Your store had no currency set before, so there's nothing to revert to.",
          }
      return {
        result: {
          ok: true,
          currency_code: defaultCurrency,
          supported_currencies: supported,
        },
        undo,
      }
    } catch (e: any) {
      return {
        result: { ok: false, error: friendly(e, "I couldn't switch your store currency.") },
        undo: { available: false, reason: "Nothing was changed." },
      }
    }
  },
}

/* -------------------------------- registry ------------------------------- */

/**
 * The two SOFT (low-risk, one-tap-confirm) Pixi STORE SETTINGS write tools.
 * Both plan() strictly read-only; both apply() tenant-scoped from ctx.
 */
export const SETTINGS_WRITES: JarvisWrite[] = [setStoreCountry, setStoreCurrency]
