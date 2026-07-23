import { MedusaError } from "@medusajs/framework/utils"
import type CmsModuleService from "../../../modules/cms/service"
import type { MerchantCtx } from "../_helpers"
import type { BlogAuditAction, BlogEntityType } from "../../admin/cms/blog/_helpers"

/**
 * Shared helpers for the MERCHANT Blog routes (/merchant/blog/*). The merchant
 * surface mirrors /admin/cms/blog but derives the tenant from the signed
 * merchant identity (resolveMerchant) instead of request headers — a merchant
 * can only ever act on their OWN store's blog. Slug/reading-time/one helpers
 * are re-used from the admin blog helpers to avoid drift.
 */

export {
  one,
  slugify,
  resolveUniqueSlug,
  estimateReadingTime,
  loadPost,
  BLOG_POST_RELATIONS,
} from "../../admin/cms/blog/_helpers"

/**
 * Write a cms_audit_log row for a merchant blog action. Best-effort &
 * non-blocking — an audit failure must never roll back the business operation.
 */
export async function recordMerchantBlogAudit(
  service: CmsModuleService,
  ctx: MerchantCtx,
  action: BlogAuditAction,
  entityType: BlogEntityType,
  entityKey: string,
  diff: { before?: unknown; after?: unknown }
): Promise<void> {
  try {
    await service.createCmsAuditLogs({
      tenant_id: ctx.tenant.id,
      actor_id: ctx.merchant.id,
      actor_email: ctx.merchant.email,
      action,
      entity_type: entityType,
      entity_key: entityKey,
      before: (diff.before ?? null) as any,
      after: (diff.after ?? null) as any,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] merchant blog audit log write failed (non-blocking):", e)
  }
}

/**
 * Load a category and assert it belongs to the merchant's tenant. A category
 * id from another store is treated as not-found (fail-closed).
 */
export async function loadCategory(
  service: CmsModuleService,
  id: string,
  tenantId: string
) {
  let category: any
  try {
    category = await service.retrieveCmsBlogCategory(id)
  } catch {
    category = null
  }
  if (!category || (category.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Blog category with id "${id}" was not found.`
    )
  }
  return category
}

/**
 * Load an author and assert it belongs to the merchant's tenant. An author id
 * from another store is treated as not-found (fail-closed).
 */
export async function loadAuthor(
  service: CmsModuleService,
  id: string,
  tenantId: string
) {
  let author: any
  try {
    author = await service.retrieveCmsAuthor(id)
  } catch {
    author = null
  }
  if (!author || (author.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Author with id "${id}" was not found.`
    )
  }
  return author
}
