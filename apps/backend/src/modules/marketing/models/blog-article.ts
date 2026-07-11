import { model } from "@medusajs/framework/utils"

/**
 * marketing_blog_article — a generated/managed blog article.
 *
 * `cms_blog_post_id` links to the published CMS post (once created), `brief_id`
 * to the MarketingContentBrief it was written from. `status` tracks its editorial
 * lifecycle (draft, review, published) and `seo_score` its optimization grade.
 *
 * MULTI-TENANT: `tenant_id` scopes every row; indexed on tenant_id.
 */
const MarketingBlogArticle = model
  .define("marketing_blog_article", {
    id: model.id({ prefix: "mbart" }).primaryKey(),
    tenant_id: model.text(),
    cms_blog_post_id: model.text().nullable(),
    brief_id: model.text().nullable(),
    title: model.text().nullable(),
    status: model.enum(["draft", "review", "published"]).default("draft"),
    seo_score: model.number().nullable(),
  })
  .indexes([
    {
      name: "IDX_marketing_blog_article_tenant_id",
      on: ["tenant_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default MarketingBlogArticle
