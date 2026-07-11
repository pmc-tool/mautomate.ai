import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  CMS_PUBLISHED_EVENT,
  type CmsPublishedEvent,
} from "../modules/cms/publish-helper"

/**
 * cms.published -> storefront on-demand revalidation (phase-6 §1).
 *
 * On every successful publish (page snapshot) or settings upsert the CMS module
 * emits `cms.published`. This subscriber translates that into a single POST to
 * the storefront's `/api/cms/revalidate` endpoint carrying the exact Next.js
 * cache tags to invalidate. The storefront then drops just those tags, so the
 * very next request rebuilds the affected page/settings from the fresh snapshot.
 *
 * Tags (GLOBAL / cacheId-free, matching the storefront CMS fetchers):
 *   - page publish:   ["cms-page-<slug>", "cms-page-<slug>-<locale>"]
 *   - settings:       ["cms-settings"]
 *   - blog publish:   ["cms-blog-<tenantId>", "cms-blog-post-<tenantId>-<slug>"]
 *                     (GLOBAL ["cms-blog", "cms-blog-post-<slug>"] single-tenant)
 *
 * Guarantees:
 *   - NEVER throws. A storefront that is down/unreachable must not fail the
 *     publish nor poison the event bus retry loop. Failures are retried with
 *     backoff and ultimately logged.
 *   - Auth via the shared `x-cms-secret` header. If the secret is unset we log
 *     and skip (the storefront denies secret-less requests anyway).
 */

// Revalidation is a SERVER→storefront call (no browser), and in the multi-tenant
// deployment every store is rendered by the one pooled storefront — so hit its
// INTERNAL url (loopback), not a per-store public domain. STOREFRONT_INTERNAL_URL
// wins; STOREFRONT_URL is the single-tenant/legacy fallback.
// Revalidation is a SERVER→storefront call (no browser). In the multi-tenant
// deployment every store is rendered by ONE pooled storefront, so hit its
// INTERNAL loopback url — never a per-store public domain. Order:
//   1. STOREFRONT_INTERNAL_URL (explicit override)
//   2. any tenant instance (TENANT_ID set) → the pooled storefront on :8601,
//      so this works for EXISTING instances without re-injecting their env
//   3. STOREFRONT_URL (single-tenant / Forever Finds' own storefront)
const STOREFRONT_URL = (
  process.env.STOREFRONT_INTERNAL_URL ||
  (process.env.TENANT_ID
    ? process.env.POOLED_STOREFRONT_URL || "http://127.0.0.1:8601"
    : process.env.STOREFRONT_URL) ||
  "http://localhost:8000"
).replace(/\/+$/, "")
const REVALIDATE_SECRET = process.env.CMS_REVALIDATE_SECRET || ""
const REVALIDATE_PATH = "/api/cms/revalidate"

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 300
const REQUEST_TIMEOUT_MS = 5000

function buildTags(payload: CmsPublishedEvent): string[] {
  const tags = new Set<string>()
  // Pooled multi-tenant: suffix the storefront's per-tenant tags so a publish
  // purges only the publishing tenant's entries. These MUST match EXACTLY the
  // tags built in storefront lib/data/cms.ts (cmsSettingsTag / cmsPageTags).
  // Fail-safe: no tenant => legacy GLOBAL tags (single-tenant), which the
  // storefront still emits when MULTI_TENANT is off.
  const tid = payload.tenant_id || ""

  if (payload.entity_type === "global") {
    tags.add(tid ? `cms-settings-${tid}` : "cms-settings")
  }

  if (payload.slug && payload.entity_type === "page") {
    if (tid) {
      tags.add(`cms-page-${tid}-${payload.slug}`)
      if (payload.locale) {
        tags.add(`cms-page-${tid}-${payload.slug}-${payload.locale}`)
      }
    } else {
      tags.add(`cms-page-${payload.slug}`)
      if (payload.locale) {
        tags.add(`cms-page-${payload.slug}-${payload.locale}`)
      }
    }
  }

  // Blog publish/unpublish: drop the shared list tag plus the per-post tag so
  // both the listing grid and the post detail rebuild from the fresh row. Pooled
  // multi-tenant: suffix both with the publishing tenant_id so a publish purges
  // ONLY this tenant's blog entries; these MUST match the storefront blog
  // fetchers (cmsBlogTag / cmsBlogPostTag in lib/data/blog.ts) byte-for-byte.
  // Fail-safe: no tenant => legacy GLOBAL tags (single-tenant).
  if (payload.entity_type === "blog_post") {
    if (tid) {
      tags.add(`cms-blog-${tid}`)
      if (payload.slug) {
        tags.add(`cms-blog-post-${tid}-${payload.slug}`)
      }
    } else {
      tags.add("cms-blog")
      if (payload.slug) {
        tags.add(`cms-blog-post-${payload.slug}`)
      }
    }
  }

  return [...tags]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postRevalidate(tags: string[], tenantId: string): Promise<void> {
  const url = `${STOREFRONT_URL}${REVALIDATE_PATH}`

  let lastError: unknown = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cms-secret": REVALIDATE_SECRET,
        },
        body: JSON.stringify(
          tenantId ? { tags, tenant_id: tenantId } : { tags }
        ),
        signal: controller.signal,
      })

      if (res.ok) {
        // eslint-disable-next-line no-console
        console.log(
          `[cms] revalidated storefront tags ${JSON.stringify(
            tags
          )} (attempt ${attempt})`
        )
        return
      }

      // 4xx (e.g. bad secret) won't get better on retry — fail fast.
      if (res.status >= 400 && res.status < 500) {
        // eslint-disable-next-line no-console
        console.error(
          `[cms] revalidate POST rejected ${res.status} (no retry) for tags ${JSON.stringify(
            tags
          )}`
        )
        return
      }

      lastError = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastError = e
    } finally {
      clearTimeout(timer)
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
    }
  }

  // eslint-disable-next-line no-console
  console.error(
    `[cms] revalidate POST failed after ${MAX_ATTEMPTS} attempts for tags ${JSON.stringify(
      tags
    )}:`,
    lastError
  )
}

export default async function cmsPublishedHandler({
  event: { data },
}: SubscriberArgs<CmsPublishedEvent>): Promise<void> {
  try {
    if (!REVALIDATE_SECRET) {
      // eslint-disable-next-line no-console
      console.warn(
        "[cms] CMS_REVALIDATE_SECRET is not set — skipping storefront revalidation."
      )
      return
    }

    const tags = buildTags(data)
    if (!tags.length) {
      return
    }

    await postRevalidate(tags, data.tenant_id || "")
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    // eslint-disable-next-line no-console
    console.error("[cms] cms.published handler error (swallowed):", e)
  }
}

export const config: SubscriberConfig = {
  event: CMS_PUBLISHED_EVENT,
}
