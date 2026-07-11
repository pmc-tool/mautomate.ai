import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getNameservers,
  setNameservers,
} from "../../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../../_utils"

/**
 * GET /admin/domains/:domain/nameservers
 *
 * Current nameservers read live from the registrar.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const result = await getNameservers(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ nameservers: (result.data as any)?.nameservers ?? [] })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load nameservers" })
  }
}

/**
 * POST /admin/domains/:domain/nameservers
 *
 * Replace the domain's nameservers.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const nameservers = body.nameservers

    if (!Array.isArray(nameservers) || nameservers.length === 0) {
      return res
        .status(400)
        .json({ message: "nameservers (non-empty array) is required" })
    }

    const result = await setNameservers(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
      nameservers,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ ok: true, ...((result.data as any) ?? {}) })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to set nameservers" })
  }
}
