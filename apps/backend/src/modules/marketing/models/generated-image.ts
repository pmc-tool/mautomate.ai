import { model } from "@medusajs/framework/utils"

/**
 * marketing_generated_image — a record of an AI-generated image.
 *
 * `prompt`/`params` capture how it was made, `provider` which service produced
 * it, `file_id`/`url` where it lives, `product_id` an optional subject binding,
 * and `agent_id` the MarketingAgent that requested it.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingGeneratedImage = model
  .define("marketing_generated_image", {
    id: model.id({ prefix: "mgimg" }).primaryKey(),
    tenant_id: model.text(),
    prompt: model.text().nullable(),
    provider: model.text().nullable(),
    file_id: model.text().nullable(),
    url: model.text().nullable(),
    product_id: model.text().nullable(),
    params: model.json().nullable(),
    agent_id: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_generated_image_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingGeneratedImage
