/**
 * Signup geolocation — the store a merchant gets should open in THEIR
 * country and currency, not a US/USD default they must discover and fix.
 *
 * Detection order (server-authoritative):
 *   1. an explicit, validated country the signup form sent (merchant choice
 *      always wins over inference)
 *   2. Cloudflare's CF-IPCountry edge header (the API is served through CF,
 *      so this is present and trustworthy on real traffic)
 *   3. "US" — the historical default, now the last resort only.
 *
 * Currency derives from country via the map below, restricted to the
 * currencies the platform store actually supports (seed-global-currencies).
 * Unmapped countries sell in USD — a correct-country store with USD pricing
 * is still strictly better than a US store.
 */

const EUROZONE = [
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
  "ME", "XK",
]

const COUNTRY_CURRENCY: Record<string, string> = {
  US: "usd",
  GB: "gbp",
  BD: "bdt",
  IN: "inr",
  PK: "pkr",
  AU: "aud",
  CA: "cad",
  SG: "sgd",
  AE: "aed",
  MY: "myr",
  JP: "jpy",
  CN: "cny",
  ZA: "zar",
  NG: "ngn",
  SA: "sar",
  NP: "npr",
  LK: "lkr",
  NZ: "nzd",
  CH: "chf",
  LI: "chf",
  SE: "sek",
  TH: "thb",
  PH: "php",
  ID: "idr",
  HK: "hkd",
  TR: "try",
  KE: "kes",
  EG: "egp",
  BR: "brl",
  MX: "mxn",
}
for (const c of EUROZONE) COUNTRY_CURRENCY[c] = "eur"

const ISO2 = /^[A-Z]{2}$/

/** The selling currency for a country (lowercase code), USD when unmapped. */
export const currencyForCountry = (
  country: string | null | undefined
): string => {
  const c = String(country ?? "").trim().toUpperCase()
  return COUNTRY_CURRENCY[c] ?? "usd"
}

/**
 * The registrant's country for a signup request. `explicit` (from the form)
 * wins when it is a real ISO-2 code; otherwise the Cloudflare edge header.
 * Returns uppercase ISO-2, or "US" when nothing credible is present.
 * CF uses "XX"/"T1" for unknown/Tor — treated as absent.
 */
export const detectSignupCountry = (
  req: { headers: Record<string, unknown> },
  explicit?: string | null
): string => {
  const fromForm = String(explicit ?? "").trim().toUpperCase()
  if (ISO2.test(fromForm)) return fromForm

  const cf = String(req.headers["cf-ipcountry"] ?? "").trim().toUpperCase()
  if (ISO2.test(cf) && cf !== "XX" && cf !== "T1") return cf

  return "US"
}
