import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { transferInDomain } from "../../../../modules/domains/domain-service"
import { TENANT_ID, getActorId, svcFail } from "../_utils"

/**
 * POST /admin/domains/transfer-in
 *
 * Transfer a domain IN using its EPP/auth code.
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

    const result = await transferInDomain(req.scope, {
      tenantId: TENANT_ID,
      domainName: domain_name,
      authCode: auth_code,
      years: body.years,
      nameservers: body.nameservers,
      contactId: body.contact_id,
      privacy: body.privacy,
      autoRenew: body.auto_renew,
      userId: getActorId(req),
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ ok: true, ...(result.data ?? {}) })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Domain transfer-in failed" })
  }
}
