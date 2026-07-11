import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { syncDomain } from "../../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../../_utils"

/**
 * POST /admin/domains/:domain/sync
 *
 * Re-sync the local domain row from the registrar.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const result = await syncDomain(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ domain: (result.data as any)?.domain ?? result.data ?? null })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Domain sync failed" })
  }
}
