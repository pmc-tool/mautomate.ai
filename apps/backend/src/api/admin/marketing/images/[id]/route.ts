import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * DELETE /admin/marketing/images/:id
 *
 * Delete a generated studio image row (tenant-checked). Response:
 * { id, deleted: true }.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const [existing] = await svc.listMarketingGeneratedImages(
      { id, tenant_id: TENANT_ID },
      { take: 1 }
    )
    if (!existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Generated image with id "${id}" was not found`
      )
    }

    await svc.deleteMarketingGeneratedImages([id])

    res.json({ id, deleted: true })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_FOUND ? 404 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to delete generated image",
    })
  }
}
