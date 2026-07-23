import type { MedusaContainer } from "@medusajs/framework/types"

import { CMS_MODULE } from "../modules/cms"
import type CmsModuleService from "../modules/cms/service"
import { publishBlogPost } from "../modules/cms/blog-publish-helper"
import { PLATFORM_MODULE } from "../modules/platform"
import { getAiTextProvider } from "../modules/marketing/ai/registry"
import { promptToImage } from "../modules/marketing/ai/video-generator"
import { meterAction } from "../modules/platform/integration/metering-guard"
import {
  resolveUniqueSlug,
  estimateReadingTime,
  one,
} from "../api/admin/cms/blog/_helpers"
import { fetchBytes, storeBytes, extractJson } from "../api/merchant/blog/ai/_helpers"
import { getCurrentTenantId, resolveTenantId } from "../lib/tenant-context"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * blog-autopilot-tick (scheduled sweep, hourly).
 *
 * THE BLOG AUTONOMY LOOP. Merchants configure a Blog Autopilot on their Blog
 * page (tenant.meta.blog_autopilot): standing topics, tone/length, a cadence
 * (daily or weekly at an hour, UTC), whether posts auto-publish or wait as
 * drafts, and whether each post gets an AI cover image. Every hour this job
 * finds tenants whose slot fell due, writes ONE post via the same compose
 * engine the editor's "Write with AI" uses, and creates it (draft) or
 * publishes it (auto mode — same publish pipeline, storefront revalidates).
 *
 * Dedup is slot-exact via `last_slot_key` (a day key or ISO-week key) stored
 * back onto the tenant meta, so a slot can never generate twice, and a briefly
 * dead scheduler catches up when it wakes inside the same slot window. Topics
 * rotate via `topic_index`.
 *
 * Credits: each run bills ai_text (+ ai_image when a cover is on) through the
 * normal wallet; a tenant that is out of credits is skipped silently and
 * retried at the next due slot. Failures are isolated per tenant.
 */

export type BlogAutopilotConfig = {
  enabled?: boolean
  topics?: string
  tone?: string
  length?: string
  frequency?: "daily" | "weekly"
  weekday?: number
  hour?: number
  mode?: "draft" | "publish"
  ai_cover?: boolean
  last_slot_key?: string
  topic_index?: number
  last_run_at?: string
  last_post_id?: string
  last_error?: string
}

const TONES = ["friendly", "professional", "playful", "luxury"]
const LENGTHS: Record<string, string> = {
  short: "around 250 words",
  medium: "around 500 words",
  long: "around 900 words",
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Is the configured slot due right now, and what is its dedup key? */
export function resolveSlot(
  cfg: BlogAutopilotConfig,
  now: Date
): { due: boolean; key: string } {
  const hour = Number.isInteger(cfg.hour) ? (cfg.hour as number) : 9
  if (cfg.frequency === "daily") {
    return { due: now.getUTCHours() >= hour, key: `d:${dayKey(now)}` }
  }
  // Weekly (default): due from the configured weekday+hour until week end.
  const weekday = Number.isInteger(cfg.weekday) ? (cfg.weekday as number) : 1
  const day = now.getUTCDay()
  const due = day > weekday || (day === weekday && now.getUTCHours() >= hour)
  return { due, key: `w:${isoWeekKey(now)}` }
}

async function runForTenant(
  container: MedusaContainer,
  tenantId: string
): Promise<{ generated: number; skipped: number; errors: number }> {
  const out = { generated: 0, skipped: 1, errors: 0 }
  const platform: any = container.resolve(PLATFORM_MODULE)
  const tenant = await platform.retrieveTenant(tenantId).catch(() => null)
  const cfg = ((tenant?.meta as any)?.blog_autopilot ?? null) as BlogAutopilotConfig | null
  if (!tenant || !cfg?.enabled) return out

  const now = new Date()
  const slot = resolveSlot(cfg, now)
  if (!slot.due || cfg.last_slot_key === slot.key) return out

  const provider = getAiTextProvider(tenantId)
  if (!provider || !provider.isConfigured()) return out

  const service: CmsModuleService = container.resolve(CMS_MODULE)
  const storeName = tenant.name || "our store"

  const topics = String(cfg.topics ?? "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
  const topicIndex = Number(cfg.topic_index ?? 0)
  const topic =
    topics.length > 0
      ? topics[topicIndex % topics.length]
      : `a helpful, seasonal article that ${storeName}'s customers would enjoy`

  const tone = TONES.includes(String(cfg.tone)) ? String(cfg.tone) : "friendly"
  const length = LENGTHS[String(cfg.length)] ?? LENGTHS.medium

  /** Persist meta updates against the FRESH tenant row (avoid clobbering). */
  const saveCfg = async (patch: Partial<BlogAutopilotConfig>) => {
    const fresh = await platform.retrieveTenant(tenantId).catch(() => null)
    const freshMeta = (fresh?.meta ?? {}) as Record<string, any>
    await platform
      .updateTenants({
        id: tenantId,
        meta: {
          ...freshMeta,
          blog_autopilot: { ...(freshMeta.blog_autopilot ?? {}), ...cfg, ...patch },
        },
      })
      .catch(() => undefined)
  }

  try {
    const system =
      `You are the content writer for "${storeName}", an online store. ` +
      `You write engaging, well-structured blog posts that read naturally and ` +
      `help shoppers, never sounding like an ad. Respond ONLY with a JSON object.`
    const prompt =
      `Write a blog post for the store's blog.\n` +
      `Topic / brief: ${topic}\n` +
      `Tone: ${tone}. Length: ${length}.\n\n` +
      `Return STRICT JSON with exactly these keys:\n` +
      `{"title": "...", "excerpt": "...", "content_html": "clean HTML using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>", "seo_title": "max 60 chars", "seo_description": "max 155 chars"}`

    const metered = await meterAction(container as any, tenantId, "ai_text", 1, async () => {
      const text = await provider.generate(prompt, {
        system,
        json: true,
        maxTokens: 3000,
        temperature: 0.7,
        feature: "blog-autopilot",
      })
      const parsed = extractJson(text)
      if (!parsed.title || !parsed.content_html) {
        throw new Error("incomplete draft")
      }
      return { result: parsed, actualUnits: 1 }
    })
    if (!metered.ok) {
      // Out of credits — do NOT consume the slot; retry next tick within it.
      await saveCfg({ last_error: "out_of_credits", last_run_at: now.toISOString() })
      return out
    }
    const draft: any = metered.result

    // Optional AI cover — best-effort, its failure never loses the post.
    let cover: string | null = null
    if (cfg.ai_cover && process.env.NOVITA_API_KEY) {
      const img = await meterAction(container as any, tenantId, "ai_image", 1, async () => {
        const vendorUrl = await promptToImage(
          process.env.NOVITA_API_KEY as string,
          `editorial blog cover for an article titled "${draft.title}" for ${storeName}`,
          "landscape"
        )
        const bytes = await fetchBytes(vendorUrl)
        const url = await storeBytes(container, tenantId, "blog-autopilot-cover", bytes, "image/png")
        return { result: url, actualUnits: 1 }
      }).catch(() => null)
      if (img && (img as any).ok) cover = (img as any).result as string
    }

    const slug = await resolveUniqueSlug(
      (f: any) => service.listCmsBlogPosts(f),
      undefined,
      String(draft.title),
      undefined,
      tenantId
    )
    const created = one(
      await service.createCmsBlogPosts({
        tenant_id: tenantId,
        title: String(draft.title),
        slug,
        excerpt: String(draft.excerpt ?? "") || null,
        content: String(draft.content_html),
        cover_image: cover,
        status: "draft",
        seo_title: String(draft.seo_title ?? "") || null,
        seo_description: String(draft.seo_description ?? "") || null,
        reading_time: estimateReadingTime(String(draft.content_html)),
        categories: [],
      })
    )

    if (cfg.mode === "publish") {
      await publishBlogPost(container as any, {
        postId: created.id,
        tenant_id: tenantId,
      })
    }

    await saveCfg({
      last_slot_key: slot.key,
      topic_index: topics.length ? (topicIndex + 1) % topics.length : 0,
      last_run_at: now.toISOString(),
      last_post_id: created.id,
      last_error: undefined,
    })
    out.generated = 1
    out.skipped = 0
  } catch (e: any) {
    out.errors = 1
    out.skipped = 0
    await saveCfg({
      last_run_at: now.toISOString(),
      last_error: String(e?.message ?? "generation failed").slice(0, 160),
    })
  }
  return out
}

export default async function blogAutopilotTickJob(
  container: MedusaContainer
): Promise<void> {
  try {
    const summary = await runForEachTenant(container, "blog autopilot", async (c) => {
      const tenantId =
        getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")
      return runForTenant(c, tenantId)
    })
    if ((summary as any).generated > 0 || (summary as any).errors > 0) {
      const logger: any = container.resolve("logger")
      logger.info(
        `[blog] autopilot tick: generated=${(summary as any).generated ?? 0} errors=${
          (summary as any).errors ?? 0
        }`
      )
    }
  } catch {
    // Never let the scheduler die on a sweep error.
  }
}

export const config = {
  name: "blog-autopilot-tick",
  schedule: "*/20 * * * *",
}
