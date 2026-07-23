// Static reference data for the setup wizard — the country, currency, category
// and business-type option lists. Mirrors the web wizard's constants
// (apps/storefront/src/app/dashboard/setup/page.tsx) and COUNTRY_NAMES
// (apps/storefront/src/lib/merchant-admin/tax-utils.ts) so a pick always
// validates against the same sets the backend accepts.

/// ISO country code -> display name. Kept in lockstep with the web
/// COUNTRY_NAMES map so the store-country and delivery pickers match checkout.
const Map<String, String> kCountryNames = {
  "af": "Afghanistan",
  "al": "Albania",
  "dz": "Algeria",
  "ad": "Andorra",
  "ao": "Angola",
  "ar": "Argentina",
  "am": "Armenia",
  "au": "Australia",
  "at": "Austria",
  "az": "Azerbaijan",
  "bh": "Bahrain",
  "bd": "Bangladesh",
  "be": "Belgium",
  "bj": "Benin",
  "bo": "Bolivia",
  "ba": "Bosnia and Herzegovina",
  "br": "Brazil",
  "bg": "Bulgaria",
  "kh": "Cambodia",
  "cm": "Cameroon",
  "ca": "Canada",
  "cl": "Chile",
  "cn": "China",
  "co": "Colombia",
  "cr": "Costa Rica",
  "hr": "Croatia",
  "cy": "Cyprus",
  "cz": "Czechia",
  "dk": "Denmark",
  "do": "Dominican Republic",
  "ec": "Ecuador",
  "eg": "Egypt",
  "sv": "El Salvador",
  "ee": "Estonia",
  "et": "Ethiopia",
  "fi": "Finland",
  "fr": "France",
  "ge": "Georgia",
  "de": "Germany",
  "gh": "Ghana",
  "gr": "Greece",
  "gt": "Guatemala",
  "hn": "Honduras",
  "hk": "Hong Kong",
  "hu": "Hungary",
  "is": "Iceland",
  "in": "India",
  "id": "Indonesia",
  "ie": "Ireland",
  "il": "Israel",
  "it": "Italy",
  "ci": "Ivory Coast",
  "jm": "Jamaica",
  "jp": "Japan",
  "jo": "Jordan",
  "kz": "Kazakhstan",
  "ke": "Kenya",
  "kw": "Kuwait",
  "lv": "Latvia",
  "lb": "Lebanon",
  "ly": "Libya",
  "li": "Liechtenstein",
  "lt": "Lithuania",
  "lu": "Luxembourg",
  "mo": "Macao",
  "my": "Malaysia",
  "mt": "Malta",
  "mx": "Mexico",
  "md": "Moldova",
  "mc": "Monaco",
  "ma": "Morocco",
  "np": "Nepal",
  "nl": "Netherlands",
  "nz": "New Zealand",
  "ni": "Nicaragua",
  "ng": "Nigeria",
  "mk": "North Macedonia",
  "no": "Norway",
  "om": "Oman",
  "pk": "Pakistan",
  "pa": "Panama",
  "py": "Paraguay",
  "pe": "Peru",
  "ph": "Philippines",
  "pl": "Poland",
  "pt": "Portugal",
  "qa": "Qatar",
  "ro": "Romania",
  "ru": "Russia",
  "sa": "Saudi Arabia",
  "rs": "Serbia",
  "sg": "Singapore",
  "sk": "Slovakia",
  "si": "Slovenia",
  "za": "South Africa",
  "kr": "South Korea",
  "es": "Spain",
  "lk": "Sri Lanka",
  "se": "Sweden",
  "ch": "Switzerland",
  "tw": "Taiwan",
  "tz": "Tanzania",
  "th": "Thailand",
  "tn": "Tunisia",
  "tr": "Turkey",
  "ua": "Ukraine",
  "ae": "United Arab Emirates",
  "gb": "United Kingdom",
  "us": "United States",
  "uy": "Uruguay",
  "uz": "Uzbekistan",
  "ve": "Venezuela",
  "vn": "Vietnam",
};

/// Country entries sorted by display name — for the pickers.
final List<MapEntry<String, String>> kCountryEntries =
    kCountryNames.entries.toList()
      ..sort((a, b) => a.value.compareTo(b.value));

/// The display name for a country code, falling back to the upper-cased code.
String countryName(String? code) {
  if (code == null || code.isEmpty) return "—";
  return kCountryNames[code.toLowerCase()] ?? code.toUpperCase();
}

/// A selectable currency — code + human label. Kept in sync with the platform
/// global store's supported currencies so a pick always validates.
class CurrencyOption {
  const CurrencyOption(this.code, this.label);
  final String code;
  final String label;
}

const List<CurrencyOption> kCurrencies = [
  CurrencyOption("usd", "USD — US Dollar"),
  CurrencyOption("eur", "EUR — Euro"),
  CurrencyOption("gbp", "GBP — British Pound"),
  CurrencyOption("bdt", "BDT — Bangladeshi Taka"),
  CurrencyOption("inr", "INR — Indian Rupee"),
  CurrencyOption("pkr", "PKR — Pakistani Rupee"),
  CurrencyOption("aud", "AUD — Australian Dollar"),
  CurrencyOption("cad", "CAD — Canadian Dollar"),
  CurrencyOption("sgd", "SGD — Singapore Dollar"),
  CurrencyOption("aed", "AED — UAE Dirham"),
  CurrencyOption("myr", "MYR — Malaysian Ringgit"),
  CurrencyOption("jpy", "JPY — Japanese Yen"),
  CurrencyOption("cny", "CNY — Chinese Yuan"),
  CurrencyOption("zar", "ZAR — South African Rand"),
  CurrencyOption("ngn", "NGN — Nigerian Naira"),
  CurrencyOption("sar", "SAR — Saudi Riyal"),
];

/// Business type options.
class BusinessTypeOption {
  const BusinessTypeOption(this.value, this.label);
  final String value;
  final String label;
}

const List<BusinessTypeOption> kBusinessTypes = [
  BusinessTypeOption("individual", "Individual / sole trader"),
  BusinessTypeOption("company", "Registered company"),
];

/// Product category options.
const List<String> kCategories = [
  "Apparel & fashion",
  "Jewellery & accessories",
  "Health & beauty",
  "Home & living",
  "Electronics",
  "Food & drink",
  "Handmade & crafts",
  "Sports & outdoors",
  "Digital products",
  "Other",
];
