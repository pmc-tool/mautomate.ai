import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { CMS_MODULE } from "../modules/cms"
import type CmsModuleService from "../modules/cms/service"
import {
  publishPageSnapshot,
  type PublishPageResult,
} from "../modules/cms/publish-helper"
import { publishBlogPost } from "../modules/cms/blog-publish-helper"
import { isLocale, type Locale } from "../modules/cms/types"

/**
 * cms-scheduled-publish (phase-6 §3).
 *
 * Runs every minute. Finds cms_page rows whose `scheduled_at` is due
 * (<= now) and publishes each by REUSING the exact same compile + validate +
 * publishSnapshot pipeline as the admin route (`publishPageSnapshot`), then
 * clears `scheduled_at`. The shared helper also emits `cms.published`, so a
 * scheduled publish triggers storefront revalidation identically to a manual one.
 *
 * Idempotency / version-guard:
 *   - Each due page is CLAIMED first by clearing `scheduled_at` to null BEFORE
 *     publishing. A concurrent or overlapping sweep then sees null and skips it,
 *     so a page is never double-published.
 *   - `publishSnapshot` is itself monotonic (version = max + 1, demote-then-
 *     insert), so even a retried publish stays internally consistent.
 *   - TERMINAL failures (archived/not-found via MedusaError, or block validation
 *     errors) leave `scheduled_at` cleared and are logged — retrying them every
 *     minute would loop forever with no chance of success.
 *   - TRANSIENT failures (DB/event-bus/etc.) RESTORE `scheduled_at` so the next
 *     sweep retries.
 *
 * NOTE: the in-memory workflow/event engine is not durable across restarts — a
 * process crash mid-sweep can drop an in-flight claim (acceptable for dev). For
 * production, back the event bus + locking with Redis so claims survive restarts.
 */

const DEFAULT_LOCALE: Locale = "en"

function resolvePublishLocale(page: any): Locale {
  const candidate = page?.default_locale
  return isLocale(candidate) ? candidate : DEFAULT_LOCALE
}

export default async function cmsScheduledPublishJob(
  container: MedusaContainer
): Promise<void> {
  await publishDuePages(container)
  await publishDueBlogPosts(container)
}

async function publishDuePages(container: MedusaContainer): Promise<void> {
  const service: CmsModuleService = container.resolve(CMS_MODULE)
  const now = new Date()

  let duePages: any[] = []
  try {
    duePages = await service.listCmsPages({
      // Only rows with a due, non-null trigger. ($lte excludes nulls.)
      scheduled_at: { $lte: now },
    } as any)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cms] scheduled-publish: failed to list due pages:", e)
    return
  }

  if (!duePages?.length) {
    return
  }

  for (const page of duePages) {
    const scheduledAt = page.scheduled_at
    const locale = resolvePublishLocale(page)

    // 1. Claim the page: clear scheduled_at FIRST so a concurrent sweep skips it.
    try {
      await service.updateCmsPages({ id: page.id, scheduled_at: null })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[cms] scheduled-publish: failed to claim page ${page.id} (will retry next sweep):`,
        e
      )
      continue
    }

    // 2. Publish via the shared pipeline (loads the full draft tree by id).
    let result: PublishPageResult
    try {
      result = await publishPageSnapshot(container, {
        pageId: page.id,
        tenant_id: page.tenant_id ?? null,
        locale,
        note: `scheduled publish @ ${scheduledAt?.toISOString?.() ?? String(
          scheduledAt
        )}`,
        published_by: null,
      })
    } catch (e) {
      if (e instanceof MedusaError) {
        // Terminal (archived / not found): leave cleared, do not reschedule.
        // eslint-disable-next-line no-console
        console.error(
          `[cms] scheduled-publish: page ${page.id} terminal error (not rescheduled):`,
          e.message
        )
      } else {
        // Transient: restore the schedule so the next sweep retries.
        await restoreSchedule(service, page.id, scheduledAt)
        // eslint-disable-next-line no-console
        console.error(
          `[cms] scheduled-publish: page ${page.id} transient error (rescheduled):`,
          e
        )
      }
      continue
    }

    if (!result.ok) {
      // Block validation failed — terminal, leave cleared and log.
      // eslint-disable-next-line no-console
      console.error(
        `[cms] scheduled-publish: page ${page.id} (${page.slug}) failed validation, not published:`,
        result.errors
      )
      continue
    }

    // eslint-disable-next-line no-console
    console.log(
      `[cms] scheduled-publish: published page ${page.slug} (${locale}) v${result.snapshot.version}`
    )
  }
}

/**
 * Sweep cms_blog_post rows whose `scheduled_at` is due and publish each via the
 * shared `publishBlogPost` pipeline (status -> published + published_at + emit
 * cms.published). Same claim-first idempotency as the page sweep: clear
 * scheduled_at BEFORE publishing so a concurrent sweep skips it; restore it on a
 * transient failure so the next sweep retries.
 */
async function publishDueBlogPosts(container: MedusaContainer): Promise<void> {
  const service: CmsModuleService = container.resolve(CMS_MODULE)
  const now = new Date()

  let duePosts: any[] = []
  try {
    duePosts = await service.listCmsBlogPosts({
      scheduled_at: { $lte: now },
    } as any)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[cms] scheduled-publish: failed to list due blog posts:",
      e
    )
    return
  }

  if (!duePosts?.length) {
    return
  }

  for (const post of duePosts) {
    const scheduledAt = post.scheduled_at

    // 1. Claim: clear scheduled_at first so a concurrent sweep skips it.
    try {
      await service.updateCmsBlogPosts({ id: post.id, scheduled_at: null })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[cms] scheduled-publish: failed to claim blog post ${post.id} (will retry next sweep):`,
        e
      )
      continue
    }

    // 2. Publish via the shared pipeline.
    try {
      const result = await publishBlogPost(container, {
        postId: post.id,
        tenant_id: post.tenant_id ?? null,
      })
      // eslint-disable-next-line no-console
      console.log(
        `[cms] scheduled-publish: published blog post ${result.post.slug}`
      )
    } catch (e) {
      if (e instanceof MedusaError) {
        // Terminal (not found): leave cleared, do not reschedule.
        // eslint-disable-next-line no-console
        console.error(
          `[cms] scheduled-publish: blog post ${post.id} terminal error (not rescheduled):`,
          e.message
        )
      } else {
        // Transient: restore the schedule so the next sweep retries.
        await restoreBlogSchedule(service, post.id, scheduledAt)
        // eslint-disable-next-line no-console
        console.error(
          `[cms] scheduled-publish: blog post ${post.id} transient error (rescheduled):`,
          e
        )
      }
    }
  }
}

async function restoreBlogSchedule(
  service: CmsModuleService,
  id: string,
  scheduledAt: Date | null
): Promise<void> {
  try {
    await service.updateCmsBlogPosts({ id, scheduled_at: scheduledAt })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[cms] scheduled-publish: failed to restore scheduled_at for blog post ${id}:`,
      e
    )
  }
}

async function restoreSchedule(
  service: CmsModuleService,
  id: string,
  scheduledAt: Date | null
): Promise<void> {
  try {
    await service.updateCmsPages({ id, scheduled_at: scheduledAt })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[cms] scheduled-publish: failed to restore scheduled_at for page ${id}:`,
      e
    )
  }
}

export const config = {
  name: "cms-scheduled-publish",
  schedule: "* * * * *",
}
