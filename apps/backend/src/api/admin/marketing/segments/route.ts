import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/segments
 *
 * Paginated list of marketing segments, tenant-scoped.
 * Response: { segments, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const [segments, count] = await svc.listAndCountMarketingSegments(
      { tenant_id: TENANT_ID },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ segments, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list segments",
    })
  }
}

/**
 * POST /admin/marketing/segments
 *
 * Create a marketing segment. `name` is required. `kind` defaults to "dynamic".
 * Body: { name, description?, kind?, filter? }
 * Response: { segment }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    name?: string
    description?: string
    kind?: string
    filter?: Record<string, unknown> | null
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A segment `name` is required."
      )
    }

    const kind = b.kind === "static" ? "static" : "dynamic"

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingSegments({
      tenant_id: TENANT_ID,
      name,
      description: b.description?.trim() || null,
      kind,
      filter: b.filter ?? null,
      member_count: 0,
    } as any)

    const segment = Array.isArray(created) ? created[0] : created

    res.status(201).json({ segment })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create segment",
    })
  }
}
