import { model } from "@medusajs/framework/utils"
import MarketingChatbot from "./chatbot"

/**
 * marketing_chatbot_data — one knowledge source feeding a chatbot.
 *
 * Each row is a `kind` of source (faq, url, product_catalog, file, blog) with
 * its raw `content` and/or `source` pointer; `embedding_ref` links to the
 * vector representation used for retrieval.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingChatbotData = model
  .define("marketing_chatbot_data", {
    id: model.id({ prefix: "mbotd" }).primaryKey(),
    tenant_id: model.text(),
    kind: model.enum(["faq", "url", "product_catalog", "file", "blog"]),
    content: model.text().nullable(),
    source: model.text().nullable(),
    embedding_ref: model.text().nullable(),
    chatbot: model.belongsTo(() => MarketingChatbot, { mappedBy: "data" }),
  })
  .indexes([
    {
      name: "IDX_marketing_chatbot_data_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingChatbotData
