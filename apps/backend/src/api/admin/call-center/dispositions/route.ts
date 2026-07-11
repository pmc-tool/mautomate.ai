import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * POST /admin/call-center/dispositions
 *
 * Record the outcome of a call. `call_id` and `outcome` are required. `set_by`
 * is stamped from the authenticated actor (req.auth_context.actor_id).
 * Body: { call_id, outcome, reason?, notes?, data? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    call_id?: string
    outcome?: string
    reason?: string
    notes?: string
    data?: any
  }

  try {
    const call_id = body.call_id?.trim()
    const outcome = body.outcome?.trim()

    if (!call_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `call_id` is required to record a disposition."
      )
    }
    if (!outcome) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An `outcome` is required to record a disposition."
      )
    }

    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const created = await cc.createDispositions({
      tenant_id: TENANT_ID,
      call_id,
      outcome,
      reason: body.reason ?? null,
      notes: body.notes ?? null,
      data: body.data ?? null,
      set_by: req.auth_context?.actor_id ?? null,
    })

    const disposition = Array.isArray(created) ? created[0] : created

    res.status(201).json({ disposition })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to record disposition",
    })
  }
}
