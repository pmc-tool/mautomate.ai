import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const KINDS = ["broadcast", "transactional", "journey", "recovery"] as const
type Kind = (typeof KINDS)[number]

/**
 * GET /admin/marketing/email/templates
 *
 * Paginated, tenant-scoped list of email templates. Optional `kind` filter.
 * Response: { templates, count, limit, offset }
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
    if (req.query.kind && KINDS.includes(req.query.kind as Kind)) {
      filters.kind = req.query.kind
    }

    const [templates, count] = await svc.listAndCountMarketingEmailTemplates(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ templates, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list email templates",
    })
  }
}

/**
 * POST /admin/marketing/email/templates
 *
 * Create a reusable email template.
 * Body: { name, subject?, preheader?, html?, kind?, from_name?, from_email? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const name = typeof b.name === "string" ? b.name.trim() : ""
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A template requires a `name`."
      )
    }

    const kind: Kind = KINDS.includes(b.kind) ? b.kind : "broadcast"

    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingEmailTemplates({
      tenant_id: TENANT_ID,
      name,
      kind,
      subject: typeof b.subject === "string" ? b.subject.trim() : null,
      preheader: typeof b.preheader === "string" ? b.preheader.trim() : null,
      html: typeof b.html === "string" ? b.html : null,
      from_name: typeof b.from_name === "string" ? b.from_name.trim() : null,
      from_email: typeof b.from_email === "string" ? b.from_email.trim() : null,
    } as any)

    const template = Array.isArray(created) ? created[0] : created

    res.status(201).json({ template })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create email template",
    })
  }
}
