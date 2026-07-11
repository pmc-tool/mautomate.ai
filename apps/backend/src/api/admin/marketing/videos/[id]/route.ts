import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

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

/** Shape one scene row for the UI. */
const toSceneDto = (s: any) => ({
  id: s?.id,
  position: s?.position ?? 0,
  script: s?.script ?? null,
  image_file_id: s?.image_file_id ?? null,
  voiceover_file_id: s?.voiceover_file_id ?? null,
  duration: s?.duration ?? null,
})

/**
 * GET /admin/marketing/videos/:id
 *
 * One video project (tenant-scoped) plus its ordered scenes.
 * Response: { video, scenes }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const project = await svc.retrieveMarketingVideoProject(id)
    if (!project || (project as any).tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Video ${id} was not found.`
      )
    }

    const scenes = await svc.listMarketingVideoScenes(
      { tenant_id: TENANT_ID, project_id: id },
      { order: { position: "ASC" } }
    )

    res.json({
      video: toVideoDto(project),
      scenes: (scenes as any[]).map(toSceneDto),
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to load video",
    })
  }
}

/**
 * DELETE /admin/marketing/videos/:id
 *
 * Soft-delete a video project (tenant-scoped). Its scenes are left in place
 * (they belong to the project and are filtered by it on read).
 * Response: { id, object: "video", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const project = await svc.retrieveMarketingVideoProject(id)
    if (!project || (project as any).tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Video ${id} was not found.`
      )
    }

    await svc.deleteMarketingVideoProjects(id)

    res.json({ id, object: "video", deleted: true })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to delete video",
    })
  }
}
