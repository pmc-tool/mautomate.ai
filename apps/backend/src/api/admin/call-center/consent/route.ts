import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  ConsentService,
  ConsentStatus,
  Purpose,
} from "../../../../modules/call-center/consent/consent-service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

const PURPOSES: Purpose[] = ["transactional", "marketing"]
const STATUSES: ConsentStatus[] = ["granted", "revoked", "dnc"]

/**
 * GET /admin/call-center/consent
 *
 * Paginated list of consent rows, tenant-scoped. Optional filters (query):
 * phone, purpose, status.
 * Response: { consents, count, limit, offset }
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
      purpose: (req.query.purpose as Purpose) || undefined,
      status: (req.query.status as ConsentStatus) || undefined,
      limit,
      offset,
    })

    res.json({ consents: items, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list consents",
    })
  }
}

/**
 * POST /admin/call-center/consent
 *
 * Record a consent decision for a phone number. `actor` is stamped from the
 * authenticated actor (req.auth_context.actor_id).
 * Body: { phone, purpose, status, source?, jurisdiction?, proof? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    phone?: string
    purpose?: string
    status?: string
    source?: string
    jurisdiction?: string
    proof?: string
  }

  try {
    const phone = body.phone?.trim()
    const purpose = body.purpose?.trim() as Purpose | undefined
    const status = body.status?.trim() as ConsentStatus | undefined

    if (!phone) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `phone` is required to record a consent."
      )
    }
    if (!purpose || !PURPOSES.includes(purpose)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A valid \`purpose\` is required (one of: ${PURPOSES.join(", ")}).`
      )
    }
    if (!status || !STATUSES.includes(status)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A valid \`status\` is required (one of: ${STATUSES.join(", ")}).`
      )
    }

    const service = new ConsentService(req.scope)

    await service.recordConsent(TENANT_ID, phone, purpose, status, {
      source: body.source ?? null,
      jurisdiction: body.jurisdiction ?? null,
      proof: body.proof ?? null,
      actor: req.auth_context?.actor_id ?? null,
    })

    res.status(201).json({ phone, purpose, status, recorded: true })
  } catch (e: any) {
    const code = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(code).json({
      message: e?.message ?? "Failed to record consent",
    })
  }
}
