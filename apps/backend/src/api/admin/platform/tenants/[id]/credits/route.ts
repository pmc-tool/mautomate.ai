import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../../../modules/platform/super-admin"
import { actorFromReq } from "../../../_actor"

/** POST /admin/platform/tenants/:id/credits  { amount } — grant credits. */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const amount = Number((req.body as { amount?: number })?.amount ?? 0)
  const admin = new SuperAdminService(req.scope)
  const out = await admin.grantCredits(actorFromReq(req), id, amount)
  res.json(out)
}
