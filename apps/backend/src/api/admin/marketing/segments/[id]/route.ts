import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/segments/:id
 *
 * Retrieve a single tenant-scoped segment.
 * Response: { segment }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)
    const segment = await svc.retrieveMarketingSegment(req.params.id)

    if (!segment || segment.tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Segment ${req.params.id} was not found.`
      )
    }

    res.json({ segment })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to load segment",
    })
  }
}

/**
 * POST /admin/marketing/segments/:id
 *
 * Update a segment. Any of name/description/kind/filter may be provided.
 * Body: { name?, description?, kind?, filter? }
 * Response: { segment }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    name?: string
    description?: string | null
    kind?: string
    filter?: Record<string, unknown> | null
  }

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const existing = await svc.retrieveMarketingSegment(req.params.id)
    if (!existing || existing.tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Segment ${req.params.id} was not found.`
      )
    }

    const update: Record<string, unknown> = { id: req.params.id }

    if (b.name !== undefined) {
      const name = b.name?.trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "A segment `name` cannot be empty."
        )
      }
      update.name = name
    }
    if (b.description !== undefined) {
      update.description = b.description?.trim() || null
    }
    if (b.kind !== undefined) {
      update.kind = b.kind === "static" ? "static" : "dynamic"
    }
    if (b.filter !== undefined) {
      update.filter = b.filter ?? null
    }

    const updated = await svc.updateMarketingSegments(update as any)
    const segment = Array.isArray(updated) ? updated[0] : updated

    res.json({ segment })
  } catch (e: any) {
    const status =
      e?.type === MedusaError.Types.NOT_FOUND
        ? 404
        : e?.type === MedusaError.Types.INVALID_DATA
          ? 400
          : 500
    res.status(status).json({
      message: e?.message ?? "Failed to update segment",
    })
  }
}

/**
 * DELETE /admin/marketing/segments/:id
 *
 * Delete a segment and its materialized members.
 * Response: { id, object: "segment", deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const existing = await svc.retrieveMarketingSegment(req.params.id)
    if (!existing || existing.tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Segment ${req.params.id} was not found.`
      )
    }

    // Best-effort cleanup of materialized members before removing the segment.
    try {
      const members = await svc.listMarketingSegmentMembers(
        { tenant_id: TENANT_ID, segment_id: req.params.id },
        { take: 100000 }
      )
      const memberIds = (Array.isArray(members) ? members : [])
        .map((m: any) => m?.id)
        .filter(Boolean)
      if (memberIds.length) {
        await svc.deleteMarketingSegmentMembers(memberIds)
      }
    } catch {
      // Non-fatal — proceed with segment deletion regardless.
    }

    await svc.deleteMarketingSegments(req.params.id)

    res.json({ id: req.params.id, object: "segment", deleted: true })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to delete segment",
    })
  }
}
