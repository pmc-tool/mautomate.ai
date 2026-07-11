import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DOMAINS_MODULE } from "../../../../modules/domains"
import { TENANT_ID } from "../_utils"

/**
 * GET /admin/domains/:domain
 *
 * The local domain row (looked up by full domain name, e.g. "foo.com") plus its
 * recent registrar action orders. 404 when the domain is not tracked locally.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const domainName = req.params.domain
    const service: any = req.scope.resolve(DOMAINS_MODULE)

    const [domain] = await service.listDomainModels(
      { tenant_id: TENANT_ID, domain_name: domainName },
      { take: 1 }
    )

    if (!domain) {
      return res
        .status(404)
        .json({ message: `Domain ${domainName} was not found` })
    }

    const [orders] = await service.listAndCountDomainOrders(
      { tenant_id: TENANT_ID, domain_name: domainName },
      { take: 20, order: { created_at: "DESC" } }
    )

    res.json({ domain, orders })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load domain" })
  }
}
