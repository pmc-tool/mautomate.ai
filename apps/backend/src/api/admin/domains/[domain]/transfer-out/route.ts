import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getTransferOut } from "../../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../../_utils"

/**
 * POST /admin/domains/:domain/transfer-out
 *
 * Prepare a transfer OUT: unlock if needed and return the lock state + auth code.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const result = await getTransferOut(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    const data = (result.data ?? {}) as any
    res.json({
      locked: data.locked ?? false,
      auth_code: data.authCode ?? null,
    })
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "Transfer-out preparation failed" })
  }
}
