import { model } from "@medusajs/framework/utils"
import CmsBlogPost from "./blog-post"

/**
 * cms_blog_category — a taxonomy term for blog posts (Phase 8).
 *
 * Linked to posts via the cms_blog_post_category join (manyToMany). The store
 * list endpoint filters by `slug`. Category names are locale-invariant in
 * Phase 8 (kept simple); add a translation row later if per-locale names are
 * required.
 *
 * Generated CRUD (model key CmsBlogCategory):
 *   createCmsBlogCategories / listCmsBlogCategories / listAndCountCmsBlogCategories
 *   / retrieveCmsBlogCategory / updateCmsBlogCategories / deleteCmsBlogCategories
 *   / softDeleteCmsBlogCategories / restoreCmsBlogCategories
 */
const CmsBlogCategory = model
  .define("cms_blog_category", {
    id: model.id({ prefix: "cmsblogc" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // Display name.
    name: model.text().searchable(),
    // URL-safe slug (unique). Derived from name when omitted.
    slug: model.text(),
    // Optional description (used on category landing pages / SEO).
    description: model.text().nullable(),
    // Posts in this category (manyToMany via the pivot).
    posts: model.manyToMany(() => CmsBlogPost, {
      mappedBy: "categories",
    }),
  })
  .indexes([
    {
      name: "IDX_cms_blog_category_tenant_slug_unique",
      on: ["tenant_id", "slug"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsBlogCategory
