import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { buyDomain } from "../../../../modules/domains/domain-service"
import { TENANT_ID, getActorId, svcFail } from "../_utils"

/**
 * POST /admin/domains/buy
 *
 * Register a new domain. `years` defaults to 1; the acting admin id is recorded
 * as `userId` for the resulting order.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const domain_name = body.domain_name

    if (!domain_name || typeof domain_name !== "string") {
      return res.status(400).json({ message: "domain_name is required" })
    }

    const result = await buyDomain(req.scope, {
      tenantId: TENANT_ID,
      domainName: domain_name,
      years: body.years ?? 1,
      nameservers: body.nameservers,
      contactId: body.contact_id,
      privacy: body.privacy,
      autoRenew: body.auto_renew,
      userId: getActorId(req),
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({
      ok: true,
      order: result.data?.order ?? null,
      domain: result.data?.domain ?? null,
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Domain registration failed" })
  }
}
