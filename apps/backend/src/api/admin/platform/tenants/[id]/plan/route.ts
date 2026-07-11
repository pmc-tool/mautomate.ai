import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../../../modules/platform/super-admin"
import { actorFromReq } from "../../../_actor"

/**
 * POST /admin/platform/tenants/:id/plan  { key, grant_included? }
 *
 * Change a tenant's subscription package. `grant_included: true` also grants the
 * new plan's included credits into the wallet now. Operator-only (audit-logged).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = (req.body ?? {}) as { key?: string; grant_included?: boolean }
  const key = String(body.key ?? "").trim()
  if (!key) return res.status(400).json({ message: "key required" })

  const admin = new SuperAdminService(req.scope)
  try {
    const out = await admin.setPackage(actorFromReq(req), id, key, {
      grantIncluded: !!body.grant_included,
    })
    res.json(out)
  } catch (e: any) {
    res.status(400).json({ message: e?.message ?? "could not change plan" })
  }
}
