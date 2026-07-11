import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../../../modules/platform/super-admin"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"
import { getInfraExecutor } from "../../../../../../modules/platform/provider/executor"
import { actorFromReq } from "../../../_actor"

/** POST /admin/platform/tenants/:id/resume */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const admin = new SuperAdminService(req.scope)
  const out = await admin.resume(actorFromReq(req), id)
  // Dedicated instance: restart its process.
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(id).catch(() => null)
  if (tenant?.container_ref) {
    await getInfraExecutor().startInstance?.(tenant.container_ref)
  }
  res.json(out)
}
