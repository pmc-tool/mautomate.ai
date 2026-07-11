import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setDomainToggle } from "../../../../../modules/domains/domain-service"
import { TENANT_ID, svcFail } from "../../_utils"

const FIELDS = ["locked", "privacy", "auto_renew"] as const
type ToggleField = (typeof FIELDS)[number]

/**
 * POST /admin/domains/:domain/toggle
 *
 * Toggle transfer-lock / privacy / auto-renew on a domain.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const body = (req.body ?? {}) as any
    const field = body.field as ToggleField
    const enabled = body.enabled

    if (!FIELDS.includes(field)) {
      return res
        .status(400)
        .json({ message: `field must be one of ${FIELDS.join(", ")}` })
    }
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled (boolean) is required" })
    }

    const result = await setDomainToggle(req.scope, {
      tenantId: TENANT_ID,
      domainName: req.params.domain,
      field,
      enabled,
    })

    if (!result.ok) {
      return svcFail(res, result)
    }

    res.json({ ok: true, ...((result.data as any) ?? {}) })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Domain toggle failed" })
  }
}
