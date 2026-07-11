import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { validateTransferIn } from "../../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../../_utils"

/**
 * POST /admin/domains/transfer-in/validate
 *
 * Validate a transfer-in (auth code + eligibility) without committing.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const domain_name = body.domain_name
    const auth_code = body.auth_code

    if (!domain_name || typeof domain_name !== "string") {
      return res.status(400).json({ message: "domain_name is required" })
    }
    if (!auth_code || typeof auth_code !== "string") {
      return res.status(400).json({ message: "auth_code is required" })
    }

    const result = await validateTransferIn(req.scope, {
      tenantId: TENANT_ID,
      domainName: domain_name,
      authCode: auth_code,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    const data = (result.data ?? {}) as any
    res.json({
      valid: data.valid ?? false,
      eligible: data.eligible ?? false,
      message: data.message ?? null,
    })
  } catch (e: any) {
    res
      .status(500)
      .json({ message: e?.message ?? "Transfer-in validation failed" })
  }
}
