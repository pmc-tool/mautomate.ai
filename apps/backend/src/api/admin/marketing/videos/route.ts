import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { generateProductVideo } from "../../../../modules/marketing/studio/video-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Shape one project row for the UI (url derived from params/output). */
const toVideoDto = (p: any) => {
  const params = (p?.params ?? {}) as Record<string, any>
  return {
    id: p?.id,
    title: p?.title ?? null,
    status: p?.status ?? null,
    aspect_ratio: p?.aspect_ratio ?? null,
    provider: p?.provider ?? null,
    product_id: p?.product_id ?? null,
    output_file_id: p?.output_file_id ?? null,
    url: params.url ?? null,
    error: params.error ?? null,
    created_at: p?.created_at ?? null,
    updated_at: p?.updated_at ?? null,
  }
}

/**
 * GET /admin/marketing/videos
 *
 * Paginated list of video projects, tenant-scoped. Optional filter: product_id.
 * Response: { videos, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    if (req.query.product_id) {
      filters.product_id = req.query.product_id
    }

    const [videos, count] = await svc.listAndCountMarketingVideoProjects(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({
      videos: (videos as any[]).map(toVideoDto),
      count,
      limit,
      offset,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list videos",
    })
  }
}

/**
 * POST /admin/marketing/videos
 *
 * Render a marketing video from a product's images + optional AI voiceover.
 * Body: { product_id, aspect?, scenes?, add_voiceover?, voice?, music_url? }
 *
 * This is a synchronous admin action that can take many seconds — the response
 * is sent once the render + upload completes. Errors are mapped to a friendly
 * message (e.g. ffmpeg unavailable) rather than crashing.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const productId =
      typeof b.product_id === "string" ? b.product_id.trim() : ""
    if (!productId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`product_id` is required."
      )
    }

    const { project, url } = await generateProductVideo(req.scope, {
      tenantId: TENANT_ID,
      productId,
      aspect: typeof b.aspect === "string" ? b.aspect : undefined,
      scenes: Array.isArray(b.scenes)
        ? b.scenes.map((s: any) => ({
            imageUrl: s?.image_url ?? s?.imageUrl,
            caption: s?.caption,
            script: s?.script,
          }))
        : undefined,
      voice: typeof b.voice === "string" ? b.voice : undefined,
      addVoiceover: !!b.add_voiceover,
      musicUrl: typeof b.music_url === "string" ? b.music_url : undefined,
    })

    res.status(201).json({ project: toVideoDto(project), url })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to render video",
    })
  }
}
