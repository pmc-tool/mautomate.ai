import { model } from "@medusajs/framework/utils"

/**
 * platform_package — an editable subscription package (plan). Persists what was
 * hardcoded in price-book.ts TIERS so packages can be created/edited from the
 * operator console (one source of truth: landing, signup, MRR all read it).
 */
const PlatformPackage = model
  .define("platform_package", {
    id: model.id({ prefix: "pkg" }).primaryKey(),
    key: model.text(),
    name: model.text(),
    price_usd: model.number().default(0),
    included_credits: model.number().default(0),
    fixed_infra_usd: model.number().default(0),
    products_limit: model.number().nullable(),
    seats_limit: model.number().nullable(),
    domains_limit: model.number().nullable(),
    features: model.json().nullable(),
    active: model.boolean().default(true),
    sort: model.number().default(0),
  })
  .indexes([
    { name: "IDX_platform_package_key_unique", on: ["key"], unique: true, where: "deleted_at IS NULL" },
  ])

export default PlatformPackage
