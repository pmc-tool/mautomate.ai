import { model } from "@medusajs/framework/utils"

/**
 * storefront_theme — a catalog storefront design. The pooled storefront reads
 * the tenant's assigned theme (tenant.meta.theme_key → this row) and applies its
 * accent color, so assigning a theme visibly restyles the merchant's store.
 */
const StorefrontTheme = model
  .define("storefront_theme", {
    id: model.id({ prefix: "thm" }).primaryKey(),
    key: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    accent_color: model.text().default("#0e7490"),
    active: model.boolean().default(true),
    sort: model.number().default(0),
  })
  .indexes([
    { name: "IDX_storefront_theme_key_unique", on: ["key"], unique: true, where: "deleted_at IS NULL" },
  ])

export default StorefrontTheme
