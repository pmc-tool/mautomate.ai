import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { CMS_MODULE } from "../../../modules/cms"
import { requireWriteTenant } from "../../../modules/cms/tenant-scope"
import { getLedger } from "../../../modules/platform/credits/metering"
import { checkVideoQuota } from "../../../modules/platform/billing/plan-gate"
import { creditsFor } from "../../../modules/platform/pricing/price-book"
import {
  animateImage,
  promptToVideo,
  type Orientation,
} from "../../../modules/marketing/ai/video-generator"

/**
 * POST /cms/ai-video — AI motion clips that drop straight into a video block.
 *
 * The canvas already turns a prompt into a logo or a hero image; this does the
 * same for VIDEO. Two modes, both ending in a stored .mp4 the storefront's
 * <video> tag plays natively:
 *
 *   animate  — an existing still (product photo, library image, generated hero)
 *              is brought to life with Stable Video Diffusion (SVD-XT, ~4s).
 *   prompt   — a text prompt first becomes a premium SDXL still, which is then
 *              animated. A great frame animated well beats raw text-to-video.
 *
 * We STORE ON GENERATE (a clip is one result, not four previews): the returned
 * url is already permanent and catalogued in the media library, so it survives
 * the provider's temporary-url expiry and can be reused on another page.
 *
 * Metered as `ai_video` (our priciest action): reserve before the vendor call,
 * commit on success, release on any throw — a zero balance blocks the clip and a
 * crash never strands credits. Trials get a small video cap on top.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(Uint8Array.from(ha), Uint8Array.from(hb))
}

const UA = "mautomate-editor/1.0"

const ORIENTATIONS: Orientation[] = ["landscape", "portrait", "square"]
const asOrientation = (v: unknown): Orientation =>
  ORIENTATIONS.includes(v as Orientation) ? (v as Orientation) : "landscape"

async function fetchBytes(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": UA } })
  if (!r.ok) throw new Error(`could not fetch the clip (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

/**
 * Store bytes in the tenant's bucket AND catalogue them in the media library
 * (cms_media). Cataloguing is best-effort: a clip the merchant paid credits for
 * must never be lost just because its library row failed to write.
 */
async function store(
  scope: any,
  tenantId: string,
  name: string,
  buf: Buffer,
  mime: string,
  width: number | null,
  height: number | null
): Promise<string> {
  const { result } = await uploadFilesWorkflow(scope).run({
    input: {
      files: [
        {
          filename: `${tenantId}/${name}`,
          mimeType: mime,
          content: buf.toString("base64"),
          access: "public",
        },
      ],
    },
  })
  const file = (result as any)?.[0]
  const url = file?.url
  if (!url) throw new Error("Could not store the clip.")

  try {
    const cms: any = scope.resolve(CMS_MODULE)
    await cms.createCmsMedias([
      {
        tenant_id: tenantId,
        file_id: file.id ?? null,
        url,
        original_filename: name,
        filename: name,
        mime_type: mime,
        size: buf.length,
        width,
        height,
        checksum: crypto.createHash("sha256").update(buf).digest("hex"),
        alt: null,
        title: null,
        folder_id: null,
        created_by: "ai",
      },
    ])
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`[ai-video] stored ${name} but could not catalogue it: ${e?.message ?? e}`)
  }
  return url
}

const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1024, h: 576 },
  portrait: { w: 576, h: 1024 },
  square: { w: 768, h: 768 },
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const provided = req.headers["x-cms-secret"]
  const expected = process.env.CMS_REVALIDATE_SECRET
  if (!expected || typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid secret.")
  }
  if (process.env.AI_EDITOR_ENABLED === "0") {
    return res.status(503).json({ error: "AI is disabled." })
  }
  const tenantId = await requireWriteTenant(req)
  const key = process.env.NOVITA_API_KEY
  if (!key) return res.status(503).json({ error: "Video generation is not configured." })

  const b = (req.body ?? {}) as Record<string, any>
  const mode = b.mode === "prompt" ? "prompt" : "animate"
  const orientation = asOrientation(b.orientation)
  const motion = Number.isFinite(b.motion) ? Number(b.motion) : undefined

  // Validate inputs before spending a credit or a second of vendor time.
  if (mode === "animate") {
    const img = typeof b.image === "string" ? b.image.trim() : ""
    if (!img) return res.status(400).json({ error: "Pick an image to animate first." })
  } else {
    const prompt = typeof b.prompt === "string" ? b.prompt.trim() : ""
    if (prompt.length < 3) {
      return res.status(400).json({ error: "Describe the video you want in a few words." })
    }
  }

  // Trials get a taste; then it's an upgrade, not a silent failure.
  const quota = await checkVideoQuota(req.scope, tenantId)
  if (!quota.allowed) {
    return res.status(402).json({ error: quota.reason, upgrade_to: quota.upgrade_to })
  }

  // ---- credit metering: reserve -> run -> commit / release ----
  const ledger = getLedger(req.scope)
  const rid = `cres_vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const reservation = await ledger.reserve(tenantId, "ai_video", 1, { reservationId: rid })
  if (!reservation.ok) {
    return res.status(402).json({
      error: `You're out of AI credits (a video needs ${creditsFor("ai_video")}). Top up in Billing.`,
    })
  }

  try {
    let videoUrl: string
    let posterUrl: string | null = null

    if (mode === "animate") {
      videoUrl = await animateImage(key, String(b.image).trim(), orientation, { motion })
    } else {
      const out = await promptToVideo(key, String(b.prompt).trim(), orientation, { motion })
      videoUrl = out.video
      posterUrl = out.poster
    }

    const { w, h } = DIMS[orientation]
    const stamp = Date.now()
    const url = await store(
      req.scope,
      tenantId,
      `ai-video-${stamp}.mp4`,
      await fetchBytes(videoUrl),
      "video/mp4",
      w,
      h
    )

    // Keep the poster too, so the block can show a still before the clip plays.
    let poster: string | null = null
    if (posterUrl) {
      try {
        poster = await store(
          req.scope,
          tenantId,
          `ai-video-${stamp}-poster.png`,
          await fetchBytes(posterUrl),
          "image/png",
          w,
          h
        )
      } catch {
        /* poster is a nicety; never fail the clip over it */
      }
    }

    const committed = await ledger.commit(rid)
    return res.json({ url, poster, credits: committed.committed })
  } catch (e: any) {
    await ledger.release(rid).catch(() => {})
    return res.status(502).json({ error: e?.message || "Video generation failed." })
  }
}
