import { model } from "@medusajs/framework/utils"

/**
 * marketing_brand_voice — a reusable tone-of-voice profile that guides how
 * marketing copy is written for a tenant.
 *
 * Captures the desired `tone`, explicit `do_rules` / `dont_rules`, a
 * `sample_copy` exemplar, and the target `language`. At most one profile per
 * tenant is typically flagged `is_default` and applied when a post does not
 * pick one explicitly.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingBrandVoice = model
  .define("marketing_brand_voice", {
    id: model.id({ prefix: "mbv" }).primaryKey(),
    tenant_id: model.text(),
    name: model.text(),
    tone: model.json().nullable(),
    do_rules: model.json().nullable(),
    dont_rules: model.json().nullable(),
    sample_copy: model.text().nullable(),
    language: model.text().default("en"),
    is_default: model.boolean().default(false),
  })
  .indexes([
    {
      name: "IDX_marketing_brand_voice_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingBrandVoice
