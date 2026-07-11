import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import CallCenterModuleService from "../../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * GET /admin/call-center/calls/:id
 *
 * One call with its dispositions and dial attempts. The call itself is fetched
 * with `retrieveCall`; dispositions and attempts are listed by `call_id`, all
 * tenant-scoped.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const call = await cc.retrieveCall(id)

    // Belt-and-suspenders tenant check: never leak a row from another tenant.
    if ((call as any).tenant_id !== TENANT_ID) {
      res.status(404).json({ message: `Call ${id} was not found` })
      return
    }

    const dispositions = await cc.listDispositions(
      { tenant_id: TENANT_ID, call_id: id },
      { order: { created_at: "DESC" } }
    )

    const attempts = await cc.listCallAttempts(
      { tenant_id: TENANT_ID, call_id: id },
      { order: { attempt_number: "ASC" } }
    )

    res.json({ call, dispositions, attempts })
  } catch (e: any) {
    const notFound =
      e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")
    res.status(notFound ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve call",
    })
  }
}
