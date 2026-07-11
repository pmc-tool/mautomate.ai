import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { MARKETING_MODULE } from "../../../../modules/marketing"
import { generateProductImages } from "../../../../modules/marketing/studio/image-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/images
 *
 * List generated studio images for the tenant, newest-first, paginated. Optional
 * `product_id` filter. Response: { images, count }.
 * Query: { product_id?, limit?, offset? }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const q = (req.query ?? {}) as Record<string, string | undefined>
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
    const offset = Math.max(Number(q.offset) || 0, 0)

    const filters: Record<string, unknown> = { tenant_id: TENANT_ID }
    if (q.product_id) {
      filters.product_id = q.product_id
    }

    const [images, count] = await svc.listAndCountMarketingGeneratedImages(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ images: images ?? [], count: count ?? 0 })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list generated images",
    })
  }
}

/**
 * POST /admin/marketing/images
 *
 * Generate on-brand marketing images of the store's OWN product at exact
 * platform sizes. Body: { product_id, preset_keys, mode, headline?, subtext?,
 * prompt? }. Response: { images }.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    product_id?: string
    preset_keys?: string[]
    mode?: "composite" | "ai"
    headline?: string
    subtext?: string
    prompt?: string
  }

  try {
    const productId = b.product_id?.trim()
    if (!productId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `product_id` is required."
      )
    }

    const presetKeys = Array.isArray(b.preset_keys)
      ? b.preset_keys.filter((k) => typeof k === "string" && k.trim().length > 0)
      : []
    if (presetKeys.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "At least one preset key is required in `preset_keys`."
      )
    }

    const mode: "composite" | "ai" = b.mode === "ai" ? "ai" : "composite"

    const images = await generateProductImages(req.scope, {
      tenantId: TENANT_ID,
      productId,
      presetKeys,
      mode,
      headline: b.headline,
      subtext: b.subtext,
      prompt: b.prompt,
    })

    res.json({ images })
  } catch (e: any) {
    const status =
      e?.type === MedusaError.Types.INVALID_DATA
        ? 400
        : e?.type === MedusaError.Types.NOT_FOUND
        ? 404
        : 500
    res.status(status).json({
      message: e?.message ?? "Failed to generate marketing images",
    })
  }
}
