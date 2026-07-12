import { model } from "@medusajs/framework/utils"

/**
 * marketing_canned_response — a saved reply a human agent can insert by shortcut.
 *
 * `shortcut` is what the agent types in the composer (e.g. "/greeting"), `title`
 * names it in the picker, `content` is the text that gets inserted, `category`
 * groups them. The unique (tenant_id, shortcut) index makes a shortcut resolve to
 * exactly one response within a tenant.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingCannedResponse = model
  .define("marketing_canned_response", {
    id: model.id({ prefix: "mcanned" }).primaryKey(),
    tenant_id: model.text(),
    shortcut: model.text(),
    title: model.text(),
    content: model.text(),
    category: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_canned_response_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_marketing_canned_response_tenant_shortcut_unique",
      on: ["tenant_id", "shortcut"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingCannedResponse
