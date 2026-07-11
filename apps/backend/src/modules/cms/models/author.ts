import { model } from "@medusajs/framework/utils"
import CmsBlogPost from "./blog-post"

/**
 * cms_author — a blog author byline (Phase 8).
 *
 * Locale-invariant author profile referenced by cms_blog_post.author_id.
 * `name`/`bio` are intentionally NOT translated in Phase 8 (single byline string);
 * per-locale author bios can join later via a translation row if needed.
 *
 * Generated CRUD (model key CmsAuthor):
 *   createCmsAuthors / listCmsAuthors / listAndCountCmsAuthors /
 *   retrieveCmsAuthor / updateCmsAuthors / deleteCmsAuthors /
 *   softDeleteCmsAuthors / restoreCmsAuthors
 */
const CmsAuthor = model
  .define("cms_author", {
    id: model.id({ prefix: "cmsauth" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // Display name (byline).
    name: model.text().searchable(),
    // URL-safe slug (unique). Derived from name when omitted.
    slug: model.text(),
    // Short author biography (plain text / light HTML).
    bio: model.text().nullable(),
    // Avatar image URL (cms_media URL or any absolute URL).
    avatar: model.text().nullable(),
    // Posts written by this author (inverse of CmsBlogPost.author).
    posts: model.hasMany(() => CmsBlogPost, { mappedBy: "author" }),
  })
  .indexes([
    {
      name: "IDX_cms_author_tenant_slug_unique",
      on: ["tenant_id", "slug"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsAuthor
