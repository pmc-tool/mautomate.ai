import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../modules/platform/super-admin"
import { actorFromReq } from "../_actor"

/** GET /admin/platform/metrics — platform-wide operator metrics. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const admin = new SuperAdminService(req.scope)
  const metrics = await admin.metrics(actorFromReq(req))
  res.json({ metrics })
}
