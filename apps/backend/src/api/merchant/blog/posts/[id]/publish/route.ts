import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../../../../../../modules/cms"
import type CmsModuleService from "../../../../../../modules/cms/service"
import {
  publishBlogPost,
  unpublishBlogPost,
} from "../../../../../../modules/cms/blog-publish-helper"
import { resolveMerchant } from "../../../../_helpers"
import { loadPost, recordMerchantBlogAudit } from "../../../_helpers"

/**
 * POST /merchant/blog/posts/:id/publish
 *
 * Two modes (body):
 *   - { scheduled_at: <future ISO> }  -> SCHEDULE: store scheduled_at, leave the
 *     post as draft. The `cms-scheduled-publish` job publishes it when due via
 *     the same `publishBlogPost` pipeline. Response: { scheduled: true, post }
 *   - {} or { scheduled_at in the past/null } -> PUBLISH NOW: status -> published,
 *     stamp published_at, clear scheduled_at, emit cms.published (entity_type
 *     "blog_post") so the storefront revalidates cms-blog + cms-blog-post-<slug>.
 *     Response: { published: true, post }
 */
export const POST = async (
  req: MedusaRequest<{ scheduled_at?: string | null }>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const tenantId = ctx.tenant.id as string

  // Ensure the post exists AND belongs to this store before any write.
  await loadPost(service, id, tenantId)

  const rawScheduled = req.body?.scheduled_at
  const scheduledAt = rawScheduled ? new Date(rawScheduled) : null
  const isFutureSchedule =
    scheduledAt &&
    !Number.isNaN(scheduledAt.getTime()) &&
    scheduledAt > new Date()

  if (isFutureSchedule) {
    await service.updateCmsBlogPosts({
      id,
      status: "draft",
      scheduled_at: scheduledAt,
    })

    const post = await loadPost(service, id, tenantId)

    await recordMerchantBlogAudit(
      service,
      ctx,
      "blog_post.schedule",
      "blog_post",
      id,
      { after: { scheduled_at: scheduledAt, slug: post.slug } }
    )

    res.status(200).json({ scheduled: true, scheduled_at: scheduledAt, post })
    return
  }

  // Publish now (shared pipeline emits cms.published).
  const result = await publishBlogPost(req.scope, {
    postId: id,
    tenant_id: tenantId,
  })

  await recordMerchantBlogAudit(
    service,
    ctx,
    "blog_post.publish",
    "blog_post",
    id,
    {
      after: {
        slug: result.post.slug,
        status: result.post.status,
        published_at: result.post.published_at,
        published_by: ctx.merchant.id,
      },
    }
  )

  const post = await loadPost(service, id, tenantId)
  res.status(200).json({ published: true, post })
}

/**
 * DELETE /merchant/blog/posts/:id/publish
 * Unpublish: flip status back to draft (preserving published_at) and revalidate
 * so the store drops the post. Response: { unpublished: true, post }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const service: CmsModuleService = req.scope.resolve(CMS_MODULE)
  const { id } = req.params
  const tenantId = ctx.tenant.id as string

  const before = await loadPost(service, id, tenantId)
  if (before.status !== "published") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only a published post can be unpublished."
    )
  }

  const result = await unpublishBlogPost(req.scope, {
    postId: id,
    tenant_id: tenantId,
  })

  await recordMerchantBlogAudit(
    service,
    ctx,
    "blog_post.unpublish",
    "blog_post",
    id,
    {
      before: { status: before.status },
      after: { status: result.post.status, slug: result.post.slug },
    }
  )

  const post = await loadPost(service, id, tenantId)
  res.status(200).json({ unpublished: true, post })
}
