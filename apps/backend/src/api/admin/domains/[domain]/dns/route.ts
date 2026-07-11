import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDnsRecords,
  mutateDnsRecord,
} from "../../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../../_utils"

const OPS = ["add", "update", "delete"] as const
type DnsOp = (typeof OPS)[number]

/**
 * GET /admin/domains/:domain/dns
 *
 * DNS records read live from the registrar.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const result = await getDnsRecords(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    const data = result.data as any
    res.json({ records: data?.records ?? data ?? [] })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load DNS records" })
  }
}

/**
 * POST /admin/domains/:domain/dns
 *
 * Add / update / delete a single DNS record.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const op = body.op as DnsOp
    const record = body.record

    if (!OPS.includes(op)) {
      return res.status(400).json({ message: `op must be one of ${OPS.join(", ")}` })
    }
    if (!record || typeof record !== "object") {
      return res.status(400).json({ message: "record is required" })
    }

    const result = await mutateDnsRecord(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
      op,
      record,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ ok: true, ...((result.data as any) ?? {}) })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "DNS mutation failed" })
  }
}
