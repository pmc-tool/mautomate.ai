import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ConsentService } from "../../../../modules/call-center/consent/consent-service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * GET /admin/call-center/dnc
 *
 * Paginated list of do-not-call entries (consents with status "dnc"),
 * tenant-scoped. Optional filter (query): phone.
 * Response: { dnc, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const service = new ConsentService(req.scope)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const { items, count } = await service.list(TENANT_ID, {
      phone: (req.query.phone as string) || undefined,
      status: "dnc",
      limit,
      offset,
    })

    res.json({ dnc: items, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list DNC entries",
    })
  }
}

/**
 * POST /admin/call-center/dnc
 *
 * Add a phone number to the do-not-call list. `actor` is stamped from the
 * authenticated actor (req.auth_context.actor_id).
 * Body: { phone, reason? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    phone?: string
    reason?: string
  }

  try {
    const phone = body.phone?.trim()

    if (!phone) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `phone` is required to add a DNC entry."
      )
    }

    const service = new ConsentService(req.scope)

    await service.addDnc(TENANT_ID, phone, {
      reason: body.reason ?? null,
      actor: req.auth_context?.actor_id ?? null,
    })

    res.status(201).json({ phone, status: "dnc", added: true })
  } catch (e: any) {
    const code = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(code).json({
      message: e?.message ?? "Failed to add DNC entry",
    })
  }
}

/**
 * DELETE /admin/call-center/dnc
 *
 * Remove a phone number from the do-not-call list (revokes its dnc rows). The
 * `phone` is read from the body or the `phone` query param.
 * Body: { phone } or query: ?phone=
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as { phone?: string }

  try {
    const phone = body.phone?.trim() || (req.query.phone as string)?.trim()

    if (!phone) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `phone` is required to remove a DNC entry."
      )
    }

    const service = new ConsentService(req.scope)

    await service.removeDnc(TENANT_ID, phone)

    res.json({ phone, status: "removed", removed: true })
  } catch (e: any) {
    const code = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(code).json({
      message: e?.message ?? "Failed to remove DNC entry",
    })
  }
}
