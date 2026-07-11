import { model } from "@medusajs/framework/utils"
/** blog_post — a post on the mautomate.ai marketing blog. */
const BlogPost = model.define("blog_post", {
  id: model.id({ prefix: "post" }).primaryKey(),
  slug: model.text(),
  title: model.text(),
  excerpt: model.text().nullable(),
  body: model.text().default(""),
  status: model.enum(["draft", "published"]).default("draft"),
  published_at: model.dateTime().nullable(),
}).indexes([{ name: "IDX_blog_slug_unique", on: ["slug"], unique: true, where: "deleted_at IS NULL" }])
export default BlogPost
