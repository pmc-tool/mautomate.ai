import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DOMAINS_MODULE } from "../../../modules/domains"
import { isResellerConfigured } from "../../../modules/domains/provider"
import { TENANT_ID } from "./_utils"

/**
 * GET /admin/domains
 *
 * Paginated list of local domain rows for the default tenant, optionally
 * filtered by `status`. `configured` tells the UI whether the registrar creds
 * are present (so it can prompt to configure).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const service: any = req.scope.resolve(DOMAINS_MODULE)

    const limit = Number(req.query.limit ?? 20)
    const offset = Number(req.query.offset ?? 0)
    const status = req.query.status as string | undefined

    const filters: any = { tenant_id: TENANT_ID }
    if (status) {
      filters.status = status
    }

    const [domains, count] = await service.listAndCountDomainModels(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({
      domains,
      count,
      limit,
      offset,
      configured: isResellerConfigured(),
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list domains" })
  }
}
