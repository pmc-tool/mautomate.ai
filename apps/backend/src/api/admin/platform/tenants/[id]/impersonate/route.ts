import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../../../modules/platform/super-admin"
import { actorFromReq } from "../../../_actor"

/** POST /admin/platform/tenants/:id/impersonate — logged; returns a scoped grant. */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const admin = new SuperAdminService(req.scope)
  const out = await admin.impersonate(actorFromReq(req), id)
  res.json(out)
}
