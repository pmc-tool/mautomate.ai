import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"

// Manual outbound-call trigger from the Order/Customer widgets or the console.
// Creates a scheduled CallTask; the claim-first dialer job picks it up and
// dispatches it to the voice runtime. Tenant-scoped.
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    order_id?: string
    customer_id?: string
    playbook_id?: string
    locale?: string
  }

  if (!body.playbook_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "playbook_id is required"
    )
  }

  const tenant_id = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")
  const cc: any = req.scope.resolve(CALL_CENTER_MODULE)

  const created = await cc.createCallTasks({
    tenant_id,
    order_id: body.order_id ?? null,
    customer_id: body.customer_id ?? null,
    playbook_id: body.playbook_id,
    direction: "outbound",
    status: "scheduled",
    scheduled_at: new Date(),
    locale: body.locale ?? "bn",
    max_attempts: 3,
  })

  const call_task = Array.isArray(created) ? created[0] : created
  res.status(201).json({ call_task })
}
