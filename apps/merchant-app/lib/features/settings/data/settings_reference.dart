// Static reference catalogs for the Settings feature — currency display
// metadata and the country picker list. Kept INDEPENDENT of features/setup on
// purpose (no cross-feature import): Settings owns its own copy so it can
// evolve without coupling to the wizard. The codes mirror the web merchant
// client's `CURRENCY_REFERENCE`
// (apps/storefront/src/lib/merchant-admin/api.ts) and the ISO country names the
// backend accepts (2-letter, lowercase) so every pick validates server-side.

/// ISO-4217 display metadata (name + symbol) keyed by LOWERCASE code. The
/// tenant's actual selection lives on the backend (GET/POST
/// /merchant/store/currencies); this only hydrates names/symbols for display.
class CurrencyRef {
  const CurrencyRef(this.code, this.name, this.symbol);

  /// Lowercase ISO-4217 code (e.g. "usd").
  final String code;

  /// Full display name (e.g. "US Dollar").
  final String name;

  /// Currency symbol (e.g. "$").
  final String symbol;
}

/// The currencies the app can price in, mirroring the web reference catalog.
const List<CurrencyRef> kCurrencyCatalog = [
  CurrencyRef("usd", "US Dollar", r"$"),
  CurrencyRef("eur", "Euro", "€"),
  CurrencyRef("gbp", "British Pound", "£"),
  CurrencyRef("cad", "Canadian Dollar", r"C$"),
  CurrencyRef("aud", "Australian Dollar", r"A$"),
  CurrencyRef("jpy", "Japanese Yen", "¥"),
  CurrencyRef("inr", "Indian Rupee", "₹"),
  CurrencyRef("bdt", "Bangladeshi Taka", "৳"),
  CurrencyRef("aed", "UAE Dirham", "د.إ"),
  CurrencyRef("sgd", "Singapore Dollar", r"S$"),
  CurrencyRef("chf", "Swiss Franc", "CHF"),
  CurrencyRef("sek", "Swedish Krona", "kr"),
  CurrencyRef("nok", "Norwegian Krone", "kr"),
  CurrencyRef("dkk", "Danish Krone", "kr"),
  CurrencyRef("nzd", "New Zealand Dollar", r"NZ$"),
  CurrencyRef("zar", "South African Rand", "R"),
  CurrencyRef("brl", "Brazilian Real", r"R$"),
  CurrencyRef("mxn", "Mexican Peso", r"$"),
  CurrencyRef("pln", "Polish Złoty", "zł"),
  CurrencyRef("myr", "Malaysian Ringgit", "RM"),
];

/// Resolve display metadata for any code, falling back to the uppercased code
/// for currencies outside the catalog.
CurrencyRef currencyMetaFor(String code) {
  final lower = code.toLowerCase();
  for (final c in kCurrencyCatalog) {
    if (c.code == lower) return c;
  }
  final up = code.toUpperCase();
  return CurrencyRef(lower, up, up);
}

/// A selectable store country — lowercase ISO-3166 alpha-2 + display name.
class CountryRef {
  const CountryRef(this.code, this.name);

  /// Lowercase ISO-3166 alpha-2 code (e.g. "us").
  final String code;

  /// Display name (e.g. "United States").
  final String name;
}

/// A curated country list for the store-country picker. The backend accepts
/// any 2-letter code (PATCH /merchant/setup), so this is a convenience list of
/// the common selling markets rather than an exhaustive ISO set.
const List<CountryRef> kCountryCatalog = [
  CountryRef("us", "United States"),
  CountryRef("gb", "United Kingdom"),
  CountryRef("ca", "Canada"),
  CountryRef("au", "Australia"),
  CountryRef("nz", "New Zealand"),
  CountryRef("ie", "Ireland"),
  CountryRef("de", "Germany"),
  CountryRef("fr", "France"),
  CountryRef("es", "Spain"),
  CountryRef("it", "Italy"),
  CountryRef("nl", "Netherlands"),
  CountryRef("be", "Belgium"),
  CountryRef("at", "Austria"),
  CountryRef("pt", "Portugal"),
  CountryRef("se", "Sweden"),
  CountryRef("no", "Norway"),
  CountryRef("dk", "Denmark"),
  CountryRef("fi", "Finland"),
  CountryRef("ch", "Switzerland"),
  CountryRef("pl", "Poland"),
  CountryRef("cz", "Czechia"),
  CountryRef("gr", "Greece"),
  CountryRef("in", "India"),
  CountryRef("bd", "Bangladesh"),
  CountryRef("pk", "Pakistan"),
  CountryRef("sg", "Singapore"),
  CountryRef("my", "Malaysia"),
  CountryRef("id", "Indonesia"),
  CountryRef("ph", "Philippines"),
  CountryRef("th", "Thailand"),
  CountryRef("vn", "Vietnam"),
  CountryRef("jp", "Japan"),
  CountryRef("kr", "South Korea"),
  CountryRef("cn", "China"),
  CountryRef("hk", "Hong Kong"),
  CountryRef("ae", "United Arab Emirates"),
  CountryRef("sa", "Saudi Arabia"),
  CountryRef("za", "South Africa"),
  CountryRef("ng", "Nigeria"),
  CountryRef("ke", "Kenya"),
  CountryRef("eg", "Egypt"),
  CountryRef("br", "Brazil"),
  CountryRef("mx", "Mexico"),
  CountryRef("ar", "Argentina"),
  CountryRef("cl", "Chile"),
  CountryRef("co", "Colombia"),
];

/// Display name for a country code, falling back to the uppercased code.
String countryNameFor(String? code) {
  if (code == null || code.isEmpty) return "";
  final lower = code.toLowerCase();
  for (final c in kCountryCatalog) {
    if (c.code == lower) return c.name;
  }
  return code.toUpperCase();
}
