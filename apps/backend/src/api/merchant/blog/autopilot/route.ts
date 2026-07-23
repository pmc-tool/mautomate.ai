import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { resolveMerchant } from "../../_helpers"
import type { BlogAutopilotConfig } from "../../../../jobs/blog-autopilot-tick"

const TONES = ["friendly", "professional", "playful", "luxury"]
const LENGTHS = ["short", "medium", "long"]

const publicCfg = (cfg: BlogAutopilotConfig | null | undefined) => ({
  enabled: !!cfg?.enabled,
  topics: String(cfg?.topics ?? ""),
  tone: TONES.includes(String(cfg?.tone)) ? String(cfg?.tone) : "friendly",
  length: LENGTHS.includes(String(cfg?.length)) ? String(cfg?.length) : "medium",
  frequency: cfg?.frequency === "daily" ? "daily" : "weekly",
  weekday: Number.isInteger(cfg?.weekday) ? (cfg?.weekday as number) : 1,
  hour: Number.isInteger(cfg?.hour) ? (cfg?.hour as number) : 9,
  mode: cfg?.mode === "publish" ? "publish" : "draft",
  ai_cover: !!cfg?.ai_cover,
  last_run_at: cfg?.last_run_at ?? null,
  last_post_id: cfg?.last_post_id ?? null,
  last_error: cfg?.last_error ?? null,
})

/**
 * GET /merchant/blog/autopilot — the tenant's Blog Autopilot configuration.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const cfg = ((ctx.tenant.meta as any)?.blog_autopilot ?? null) as
    | BlogAutopilotConfig
    | null
  res.json({ autopilot: publicCfg(cfg) })
}

/**
 * PUT /merchant/blog/autopilot — update the Blog Autopilot.
 *
 * Body: { enabled?, topics?, tone?, length?, frequency? ("daily"|"weekly"),
 *         weekday? (0-6, weekly only), hour? (0-23 UTC), mode?
 *         ("draft"|"publish"), ai_cover? }
 *
 * The hourly tick (blog-autopilot-tick) writes one post per due slot using
 * the same AI compose engine as the editor; "publish" mode pushes it live
 * through the normal publish pipeline. Bookkeeping fields (last_slot_key,
 * topic_index, ...) are preserved across edits.
 */
export const PUT = async (
  req: MedusaRequest<Record<string, any>>,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const b = (req.body ?? {}) as Record<string, any>

  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const fresh = await svc.retrieveTenant(ctx.tenant.id)
  const meta = (fresh.meta ?? {}) as Record<string, any>
  const prev = (meta.blog_autopilot ?? {}) as BlogAutopilotConfig

  const next: BlogAutopilotConfig = { ...prev }
  if ("enabled" in b) next.enabled = !!b.enabled
  if ("topics" in b) next.topics = String(b.topics ?? "").slice(0, 2000)
  if ("tone" in b && TONES.includes(String(b.tone))) next.tone = String(b.tone)
  if ("length" in b && LENGTHS.includes(String(b.length))) next.length = String(b.length)
  if ("frequency" in b) next.frequency = b.frequency === "daily" ? "daily" : "weekly"
  if ("weekday" in b) {
    const w = Number(b.weekday)
    if (Number.isInteger(w) && w >= 0 && w <= 6) next.weekday = w
  }
  if ("hour" in b) {
    const h = Number(b.hour)
    if (Number.isInteger(h) && h >= 0 && h <= 23) next.hour = h
  }
  if ("mode" in b) next.mode = b.mode === "publish" ? "publish" : "draft"
  if ("ai_cover" in b) next.ai_cover = !!b.ai_cover

  await svc.updateTenants({
    id: ctx.tenant.id,
    meta: { ...meta, blog_autopilot: next },
  })

  res.json({ autopilot: publicCfg(next) })
}
