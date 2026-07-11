import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../../../modules/platform/super-admin"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"
import { getInfraExecutor } from "../../../../../../modules/platform/provider/executor"
import { actorFromReq } from "../../../_actor"

/** POST /admin/platform/tenants/:id/suspend  { reason: "billing" | "abuse" } */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const reason = ((req.body ?? {}) as { reason?: "billing" | "abuse" }).reason ?? "billing"
  const admin = new SuperAdminService(req.scope)
  const out = await admin.suspend(actorFromReq(req), id, reason)
  // Dedicated instance: also halt its process so a suspended store isn't running.
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(id).catch(() => null)
  if (tenant?.container_ref) {
    await getInfraExecutor().stopInstance?.(tenant.container_ref)
  }
  res.json(out)
}
