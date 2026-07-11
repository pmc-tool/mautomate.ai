import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CMS_MODULE } from "."
import type CmsModuleService from "./service"
import { emitCmsPublished } from "./publish-helper"

/**
 * Shared blog publish pipeline (Phase 8).
 *
 * Unlike pages (which compile an immutable snapshot per locale), blog posts are
 * published status-based: the store read API serves rows with status="published"
 * directly, resolved to the requested locale at read time. So "publishing" a post
 * is just: flip status -> "published", stamp published_at (first time only),
 * clear any scheduled_at, then emit cms.published (entity_type "blog_post") so the
 * storefront revalidates the `cms-blog` + `cms-blog-post-<slug>` tags.
 *
 * This logic lives here ONCE so the admin publish ROUTE and the
 * `cms-scheduled-publish` JOB produce identical results. The module layer never
 * imports from api/.
 */

export type PublishBlogPostInput = {
  /** Provide a pre-loaded post row OR a postId to load it here. */
  post?: any
  postId?: string
  /**
   * Publishing tenant (pooled multi-tenant). Threaded into the emitted
   * cms.published event so only THIS tenant's blog cache tags are purged on the
   * shared storefront. May be null only for legacy single-tenant callers.
   */
  tenant_id: string | null
  /** Skip emitting the domain event (rarely needed; default emits). */
  skipEvent?: boolean
}

export type PublishBlogPostResult = {
  post: any
  /** True when this call transitioned the post into the published state. */
  publishedNow: boolean
}

/**
 * Publish a blog post:
 *   1. load the row (if only an id was given) — NOT_FOUND otherwise,
 *   2. set status="published"; stamp published_at on first publish (preserved on
 *      re-publish so the original go-live date is stable),
 *   3. clear scheduled_at (a manual publish supersedes any pending schedule),
 *   4. emit cms.published (best-effort).
 *
 * Idempotent: re-publishing an already-published post just re-emits the
 * revalidation event (handy after a content edit).
 */
export async function publishBlogPost(
  container: MedusaContainer,
  input: PublishBlogPostInput
): Promise<PublishBlogPostResult> {
  const service: CmsModuleService = container.resolve(CMS_MODULE)

  let post = input.post
  if (!post) {
    if (!input.postId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "publishBlogPost requires either `post` or `postId`."
      )
    }
    try {
      post = await service.retrieveCmsBlogPost(input.postId)
    } catch {
      post = null
    }
    if (!post) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Blog post with id "${input.postId}" was not found.`
      )
    }
  }

  const wasPublished = post.status === "published" && !!post.published_at

  const updated: any = await service.updateCmsBlogPosts({
    id: post.id,
    status: "published",
    published_at: post.published_at ?? new Date(),
    scheduled_at: null,
  })
  const saved = Array.isArray(updated) ? updated[0] : updated

  if (!input.skipEvent) {
    await emitCmsPublished(container, {
      entity_type: "blog_post",
      slug: saved.slug,
      locale: null,
      tenant_id: input.tenant_id ?? null,
    })
  }

  return { post: saved, publishedNow: !wasPublished }
}

/**
 * Unpublish a blog post: flip status back to "draft" (preserving published_at as
 * the historical go-live date) and revalidate so the store drops it. Emits
 * cms.published with the post slug — the subscriber invalidates the same blog
 * tags, so the listing/detail rebuild and the now-draft post 404s on the store.
 */
export async function unpublishBlogPost(
  container: MedusaContainer,
  input: PublishBlogPostInput
): Promise<PublishBlogPostResult> {
  const service: CmsModuleService = container.resolve(CMS_MODULE)

  let post = input.post
  if (!post) {
    if (!input.postId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "unpublishBlogPost requires either `post` or `postId`."
      )
    }
    try {
      post = await service.retrieveCmsBlogPost(input.postId)
    } catch {
      post = null
    }
    if (!post) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Blog post with id "${input.postId}" was not found.`
      )
    }
  }

  const updated: any = await service.updateCmsBlogPosts({
    id: post.id,
    status: "draft",
  })
  const saved = Array.isArray(updated) ? updated[0] : updated

  if (!input.skipEvent) {
    await emitCmsPublished(container, {
      entity_type: "blog_post",
      slug: saved.slug,
      locale: null,
      tenant_id: input.tenant_id ?? null,
    })
  }

  return { post: saved, publishedNow: false }
}
