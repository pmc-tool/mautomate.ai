import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { DOMAINS_MODULE } from "../../../../../modules/domains"

/**
 * POST /admin/domains/:domain/approve
 *
 * Approve a manual-approval domain purchase. The platform operator calls this
 * after registering the domain at the registrar and setting the DNS records.
 * It moves the local domain row to active and the domain order to success.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const domainName = decodeURIComponent(req.params.domain as string)
      .trim()
      .toLowerCase()
    if (!domainName) {
      return res.status(400).json({ message: "domain is required" })
    }

    const domainsModule: any = req.scope.resolve(DOMAINS_MODULE)

    const [domainRow] = await domainsModule.listDomainModels(
      { domain_name: domainName },
      { take: 1 }
    )
    if (!domainRow) {
      return res.status(404).json({ message: "domain not found" })
    }

    const [updatedDomain] = await domainsModule.updateDomainModels([
      {
        id: domainRow.id,
        status: "active",
        meta: { ...(domainRow.meta ?? {}), approved_at: new Date().toISOString() },
      },
    ] as any)

    const [latestOrder] = await domainsModule.listDomainOrders(
      {
        tenant_id: domainRow.tenant_id,
        domain_name: domainName,
        status: "processing",
      },
      { take: 1, order: { created_at: "DESC" } }
    )

    let order = latestOrder
    if (latestOrder) {
      const [updatedOrder] = await domainsModule.updateDomainOrders([
        {
          id: latestOrder.id,
          status: "success",
          meta: {
            ...(latestOrder.meta ?? {}),
            approved_at: new Date().toISOString(),
            approved_by: (req as any).auth_context?.actor_id,
          },
        },
      ] as any)
      order = updatedOrder
    }

    res.json({ ok: true, domain: updatedDomain, order })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "approval failed" })
  }
}
