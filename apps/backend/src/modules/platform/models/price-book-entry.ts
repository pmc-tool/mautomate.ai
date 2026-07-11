import { model } from "@medusajs/framework/utils"

/**
 * price_book_entry — an editable credit price for one billable action. Persists
 * what was hardcoded in PRICE_BOOK so the operator can retune rates + margins
 * from the console; the metering hooks read the effective rate from here.
 */
const PriceBookEntry = model
  .define("price_book_entry", {
    id: model.id({ prefix: "pbe" }).primaryKey(),
    action: model.text(),
    label: model.text().nullable(),
    credits: model.number().default(0),
    vendor_cost_usd: model.number().default(0),
  })
  .indexes([
    { name: "IDX_price_book_action_unique", on: ["action"], unique: true, where: "deleted_at IS NULL" },
  ])

export default PriceBookEntry
