import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { searchDomains } from "../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../_utils"

/**
 * POST /admin/domains/search
 *
 * Availability + pricing search across TLDs for a query string.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const query = body.query
    const tlds = body.tlds

    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "query is required" })
    }

    const result = await searchDomains(req.scope, {
      tenantId: TENANT_ID,
      query,
      tlds,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ query, results: result.data })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Domain search failed" })
  }
}
