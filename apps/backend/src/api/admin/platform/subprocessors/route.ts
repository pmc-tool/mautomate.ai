import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUBPROCESSORS } from "../../../../modules/platform/compliance/subprocessors"

/** GET /admin/platform/subprocessors — the DPA sub-processor registry. */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ subprocessors: SUBPROCESSORS })
}
