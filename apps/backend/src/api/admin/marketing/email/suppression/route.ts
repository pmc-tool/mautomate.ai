import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const REASONS = ["unsubscribe", "bounce", "complaint", "manual"] as const
type Reason = (typeof REASONS)[number]

/**
 * GET /admin/marketing/email/suppression
 *
 * Paginated, tenant-scoped do-not-email list. Optional `q` searches by email
 * (case-insensitive substring).
 * Response: { suppression, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
    if (q) {
      filters.email = { $ilike: `%${q}%` }
    }

    const [suppression, count] = await svc.listAndCountMarketingSuppressions(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ suppression, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list suppression entries",
    })
  }
}

/**
 * POST /admin/marketing/email/suppression
 *
 * Manually suppress an address (add to do-not-email list). Idempotent: an
 * already-suppressed address is returned as-is.
 * Body: { email, reason? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as { email?: string; reason?: string }

  try {
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : ""
    if (!email || !email.includes("@")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A valid `email` is required."
      )
    }

    const reason: Reason = REASONS.includes(b.reason as Reason)
      ? (b.reason as Reason)
      : "manual"

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    // Idempotent — don't violate the (tenant_id, email) unique index.
    const existing = await svc.listMarketingSuppressions(
      { tenant_id: TENANT_ID, email },
      { take: 1 }
    )
    if (Array.isArray(existing) && existing.length) {
      res.status(200).json({ suppression: existing[0], existed: true })
      return
    }

    const created = await svc.createMarketingSuppressions({
      tenant_id: TENANT_ID,
      email,
      reason,
      source: "admin",
    } as any)

    const suppression = Array.isArray(created) ? created[0] : created

    res.status(201).json({ suppression })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to add suppression entry",
    })
  }
}

/**
 * DELETE /admin/marketing/email/suppression?id=<id>
 *
 * Remove one entry (re-subscribe the address).
 * Response: { id, object, deleted }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : ""
    if (!id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`id` query parameter is required."
      )
    }

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const entry = await svc
      .retrieveMarketingSuppression(id)
      .catch(() => null)
    if (!entry || entry.tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Suppression entry ${id} was not found.`
      )
    }

    await svc.deleteMarketingSuppressions(id)

    res.json({ id, object: "suppression", deleted: true })
  } catch (e: any) {
    const status =
      e?.type === MedusaError.Types.NOT_FOUND
        ? 404
        : e?.type === MedusaError.Types.INVALID_DATA
        ? 400
        : 500
    res.status(status).json({
      message: e?.message ?? "Failed to remove suppression entry",
    })
  }
}
