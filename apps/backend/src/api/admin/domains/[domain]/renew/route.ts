import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { renewDomain } from "../../../../../modules/domains/domain-service"
import { TENANT_ID, getActorId, svcFail } from "../../_utils"

/**
 * POST /admin/domains/:domain/renew
 *
 * Renew (or restore) a domain for a number of `years`.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const years = Number(body.years)

    if (!years || Number.isNaN(years) || years < 1) {
      return res.status(400).json({ message: "years is required" })
    }

    const result = await renewDomain(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
      years,
      isRestore: body.is_restore,
      userId: getActorId(req),
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ ok: true, ...((result.data as any) ?? {}) })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Domain renewal failed" })
  }
}
