// Static helpers for the merchant tax-region pages. No external deps so the
// dashboard stays self-contained (Medusa admin uses react-country-flag +
// country-states data; we ship a compact map + icon avatars instead).

const COUNTRY_NAMES: Record<string, string> = {
  af: "Afghanistan",
  al: "Albania",
  dz: "Algeria",
  ad: "Andorra",
  ao: "Angola",
  ar: "Argentina",
  am: "Armenia",
  au: "Australia",
  at: "Austria",
  az: "Azerbaijan",
  bh: "Bahrain",
  bd: "Bangladesh",
  be: "Belgium",
  bj: "Benin",
  bo: "Bolivia",
  ba: "Bosnia and Herzegovina",
  br: "Brazil",
  bg: "Bulgaria",
  kh: "Cambodia",
  cm: "Cameroon",
  ca: "Canada",
  cl: "Chile",
  cn: "China",
  co: "Colombia",
  cr: "Costa Rica",
  hr: "Croatia",
  cy: "Cyprus",
  cz: "Czechia",
  dk: "Denmark",
  do: "Dominican Republic",
  ec: "Ecuador",
  eg: "Egypt",
  sv: "El Salvador",
  ee: "Estonia",
  et: "Ethiopia",
  fi: "Finland",
  fr: "France",
  ge: "Georgia",
  de: "Germany",
  gh: "Ghana",
  gr: "Greece",
  gt: "Guatemala",
  hn: "Honduras",
  hk: "Hong Kong",
  hu: "Hungary",
  is: "Iceland",
  in: "India",
  id: "Indonesia",
  ie: "Ireland",
  il: "Israel",
  it: "Italy",
  ci: "Ivory Coast",
  jm: "Jamaica",
  jp: "Japan",
  jo: "Jordan",
  kz: "Kazakhstan",
  ke: "Kenya",
  kw: "Kuwait",
  lv: "Latvia",
  lb: "Lebanon",
  ly: "Libya",
  li: "Liechtenstein",
  lt: "Lithuania",
  lu: "Luxembourg",
  mo: "Macao",
  my: "Malaysia",
  mt: "Malta",
  mx: "Mexico",
  md: "Moldova",
  mc: "Monaco",
  ma: "Morocco",
  np: "Nepal",
  nl: "Netherlands",
  nz: "New Zealand",
  ni: "Nicaragua",
  ng: "Nigeria",
  mk: "North Macedonia",
  no: "Norway",
  om: "Oman",
  pk: "Pakistan",
  pa: "Panama",
  py: "Paraguay",
  pe: "Peru",
  ph: "Philippines",
  pl: "Poland",
  pt: "Portugal",
  qa: "Qatar",
  ro: "Romania",
  ru: "Russia",
  sa: "Saudi Arabia",
  rs: "Serbia",
  sg: "Singapore",
  sk: "Slovakia",
  si: "Slovenia",
  za: "South Africa",
  kr: "South Korea",
  es: "Spain",
  lk: "Sri Lanka",
  se: "Sweden",
  ch: "Switzerland",
  tw: "Taiwan",
  tz: "Tanzania",
  th: "Thailand",
  tn: "Tunisia",
  tr: "Turkey",
  ua: "Ukraine",
  ae: "United Arab Emirates",
  gb: "United Kingdom",
  us: "United States",
  uy: "Uruguay",
  uz: "Uzbekistan",
  ve: "Venezuela",
  vn: "Vietnam",
}

export function getCountryName(code?: string | null): string {
  if (!code) return "—"
  return COUNTRY_NAMES[code.toLowerCase()] ?? code.toUpperCase()
}

type SublevelType = {
  // Heading of the create-sublevel modal, e.g. "Create State Tax Region".
  createHeading: string
  // Section heading, e.g. "States".
  plural: string
  // Field label, e.g. "State".
  singular: string
}

// Which countries use which sublevel vocabulary. Falls back to "Province".
const SUBLEVEL_BY_COUNTRY: Record<string, SublevelType> = {
  us: { createHeading: "Create State Tax Region", plural: "States", singular: "State" },
  ca: {
    createHeading: "Create Province Tax Region",
    plural: "Provinces",
    singular: "Province",
  },
  au: {
    createHeading: "Create State or Territory Tax Region",
    plural: "States or Territories",
    singular: "State or Territory",
  },
  gb: {
    createHeading: "Create Region Tax Region",
    plural: "Regions",
    singular: "Region",
  },
  ie: {
    createHeading: "Create County Tax Region",
    plural: "Counties",
    singular: "County",
  },
  fr: {
    createHeading: "Create Department Tax Region",
    plural: "Departments",
    singular: "Department",
  },
  jp: {
    createHeading: "Create Prefecture Tax Region",
    plural: "Prefectures",
    singular: "Prefecture",
  },
  ch: {
    createHeading: "Create Canton Tax Region",
    plural: "Cantons",
    singular: "Canton",
  },
  ae: {
    createHeading: "Create Emirate Tax Region",
    plural: "Emirates",
    singular: "Emirate",
  },
}

export function getSublevelType(countryCode?: string | null): SublevelType {
  const fallback: SublevelType = {
    createHeading: "Create Province Tax Region",
    plural: "Provinces",
    singular: "Province",
  }
  if (!countryCode) return fallback
  return SUBLEVEL_BY_COUNTRY[countryCode.toLowerCase()] ?? fallback
}

// Format a tax rate percentage with up to 4 decimals, trailing zeros stripped.
export function formatTaxRate(rate?: number | null): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "—"
  const rounded = Math.round(rate * 10000) / 10000
  return `${rounded.toString()}%`
}

// Human label for a tax-rate rule reference type.
export function targetTypeLabel(reference: string): string {
  switch (reference) {
    case "product":
      return "Product"
    case "product_type":
      return "Product type"
    case "shipping_option":
      return "Shipping option"
    default:
      return reference
  }
}
