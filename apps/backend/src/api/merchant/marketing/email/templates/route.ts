import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { resolveMerchant } from "../../../_helpers"

const KINDS = ["broadcast", "transactional", "journey", "recovery"] as const
type Kind = (typeof KINDS)[number]

/**
 * GET /merchant/marketing/email/templates
 *
 * Merchant-scoped list of email templates. Query params: kind, limit, offset.
 * Response: { templates, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

  try {
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: tenantId }
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
 * POST /merchant/marketing/email/templates
 *
 * Create a reusable email template, tagged with the caller's tenant.
 * Body: { name, subject?, preheader?, html?, kind?, from_name?, from_email? }
 * Response: { template }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const name = typeof b.name === "string" ? b.name.trim() : ""
    if (!name) {
      return res.status(400).json({ message: "A template requires a `name`." })
    }

    const kind: Kind = KINDS.includes(b.kind) ? b.kind : "broadcast"

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingEmailTemplates({
      tenant_id: tenantId,
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
    res.status(500).json({
      message: e?.message ?? "Failed to create email template",
    })
  }
}
