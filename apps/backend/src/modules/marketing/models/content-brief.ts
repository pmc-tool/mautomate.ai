import { model } from "@medusajs/framework/utils"

/**
 * marketing_content_brief — an outline/spec for a piece of content.
 *
 * Optionally tied to a MarketingSeoProject (`seo_project_id`) and MarketingKeyword
 * (`keyword_id`), it holds the `outline` structure and a `status` lifecycle
 * (draft, ready, used). `generated_by_agent_id` records the MarketingAgent that
 * produced it.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingContentBrief = model
  .define("marketing_content_brief", {
    id: model.id({ prefix: "mbrief" }).primaryKey(),
    tenant_id: model.text(),
    seo_project_id: model.text().nullable(),
    keyword_id: model.text().nullable(),
    outline: model.json().nullable(),
    status: model.enum(["draft", "ready", "used"]).default("draft"),
    generated_by_agent_id: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_content_brief_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingContentBrief
