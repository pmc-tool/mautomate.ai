import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import type CmsModuleService from "../../../../modules/cms/service"
import { cmsTenantId } from "../../../../modules/cms/tenant-scope"
import { getActor } from "../settings/_helpers"
import { one, slugify } from "../pages/_helpers"

/**
 * Shared helpers for the admin Blog routes (posts / categories / authors).
 * Non-`route.ts` / `middlewares.ts` files are ignored by Medusa's file-based
 * router, so this is an import-only module (the leading underscore makes that
 * explicit). Re-uses `one` + `slugify` from the pages helpers to avoid drift.
 */

export { one, slugify }

/** Post draft relations loaded for the admin editor / detail view. */
export const BLOG_POST_RELATIONS = [
  "author",
  "categories",
  "translations",
] as const

export type BlogAuditAction =
  | "blog_post.create"
  | "blog_post.update"
  | "blog_post.delete"
  | "blog_post.publish"
  | "blog_post.unpublish"
  | "blog_post.schedule"
  | "blog_category.create"
  | "blog_category.update"
  | "blog_category.delete"
  | "author.create"
  | "author.update"
  | "author.delete"

export type BlogEntityType = "blog_post" | "blog_category" | "author"

/**
 * Write a cms_audit_log row for a blog action. Best-effort & non-blocking — an
 * audit failure must never roll back the business operation (§8.3).
 */
export async function recordBlogAudit(
  req: MedusaRequest,
  service: CmsModuleService,
  action: BlogAuditAction,
  entityType: BlogEntityType,
  entityKey: string,
  diff: { before?: unknown; after?: unknown }
): Promise<void> {
  try {
    const actor = await getActor(req)
    const tenantId = await cmsTenantId(req)
    await service.createCmsAuditLogs({
      tenant_id: tenantId,
      actor_id: actor.user_id,
      actor_email: actor.email,
      action,
      entity_type: entityType,
      entity_key: entityKey,
      before: (diff.before ?? null) as any,
      after: (diff.after ?? null) as any,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] blog audit log write failed (non-blocking):", e)
  }
}

/**
 * Resolve a unique slug for an entity within a model, deriving from `fallback`
 * (the title/name) when no explicit slug is given. Throws a friendly 422 when the
 * slug collides with another row (the DB partial-unique index is the hard guard).
 *
 * @param list    the generated `listCms*` method, returning rows with `id`+`slug`
 * @param raw     the caller-supplied slug (may be empty/undefined)
 * @param fallback the title/name to slugify when `raw` is empty
 * @param excludeId when updating, the row's own id (so it does not clash with itself)
 */
export async function resolveUniqueSlug(
  list: (filters: Record<string, unknown>) => Promise<any[]>,
  raw: string | undefined,
  fallback: string,
  excludeId?: string,
  tenantId?: string | null
): Promise<string> {
  const slug = (raw?.trim() || slugify(fallback)) || ""
  if (!slug) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Could not derive a valid slug — provide an explicit `slug`."
    )
  }
  // Pooled multi-tenant: uniqueness is per-store when a tenant is supplied.
  const clash = await list(
    tenantId ? { slug, tenant_id: tenantId } : { slug }
  )
  if (clash?.some((row: any) => row.id !== excludeId)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `A record with slug "${slug}" already exists.`
    )
  }
  return slug
}

/** Estimate reading time in minutes from rich HTML content (~200 wpm, min 1). */
export function estimateReadingTime(content: string | null | undefined): number {
  if (!content) return 1
  const text = String(content)
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/**
 * Load a blog post with its editor relations (author, categories, translations).
 * Throws NOT_FOUND if missing.
 */
export async function loadPost(
  service: CmsModuleService,
  id: string,
  tenantId: string | null
) {
  let post: any
  try {
    post = await service.retrieveCmsBlogPost(id, {
      relations: [...BLOG_POST_RELATIONS],
    })
  } catch {
    post = null
  }
  // Ownership guard (pooled multi-tenant): a post id from another store — or any
  // access without a resolvable tenant — is treated as not-found (fail-closed).
  if (!post || !tenantId || (post.tenant_id ?? null) !== tenantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Blog post with id "${id}" was not found.`
    )
  }
  return post
}
