import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createCampaignsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"
import {
  campaignIdentifierPrefix,
  denamespaceIdentifier,
  formatCampaignDetail,
  formatCampaignListItem,
  isOwnedIdentifier,
  namespaceIdentifier,
} from "./_campaigns"

const BudgetTypeSchema = z.enum([
  "spend",
  "usage",
  "use_by_attribute",
  "spend_by_attribute",
])

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  identifier: z.string().min(1).max(200),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  budget: z
    .object({
      type: BudgetTypeSchema,
      currency_code: z.string().min(3).max(3).optional(),
      limit: z.number().min(0).nullable().optional(),
      attribute: z.string().min(1).nullable().optional(),
    })
    .nullable()
    .optional(),
})

const normCurrency = (c: unknown): string =>
  String(c ?? "").trim().toLowerCase()

const ORDERABLE_FIELDS = new Set(["name", "created_at", "updated_at"])

/**
 * GET /merchant/campaigns
 *
 * Campaigns are GLOBAL in Medusa and (unlike promotions) the Campaign model
 * has NO metadata field in the installed promotion module, so tenant rows are
 * isolated by campaign_identifier namespacing ("<tenantId>:<identifier>", see
 * _campaigns.ts). Only rows carrying THIS tenant's prefix are returned —
 * fail-closed. Identifiers are returned DE-namespaced.
 *
 * Query params: q, offset (default 0), limit (default 20, max 100),
 * order (name | created_at | updated_at, "-" prefix for desc; default -created_at).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const q =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : ""
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0)
  const limitRaw = parseInt(String(req.query.limit ?? "20"), 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100)

  const orderRaw = typeof req.query.order === "string" ? req.query.order : "-created_at"
  let desc = orderRaw.startsWith("-")
  let orderField = desc ? orderRaw.slice(1) : orderRaw
  if (!ORDERABLE_FIELDS.has(orderField)) {
    orderField = "created_at"
    desc = true
  }

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  // Tenant filtering happens in-memory after the module list (same approach as
  // the promotions/discounts routes) because the module cannot filter on an
  // identifier PREFIX. Bounded fetch keeps this predictable.
  const all = await promotionModule.listCampaigns(
    {},
    {
      take: 1000,
      skip: 0,
      order: { created_at: "DESC" },
      relations: ["budget", "promotions"],
    }
  )

  let campaigns = (all || []).filter((c: any) =>
    isOwnedIdentifier(ctx.tenant.id, c.campaign_identifier)
  )

  if (q) {
    campaigns = campaigns.filter((c: any) => {
      const display = denamespaceIdentifier(
        ctx.tenant.id,
        c.campaign_identifier || ""
      )
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        display.toLowerCase().includes(q)
      )
    })
  }

  campaigns.sort((a: any, b: any) => {
    let cmp = 0
    if (orderField === "name") {
      cmp = String(a.name || "").localeCompare(String(b.name || ""))
    } else {
      cmp =
        new Date(a[orderField] || 0).getTime() -
        new Date(b[orderField] || 0).getTime()
    }
    return desc ? -cmp : cmp
  })

  const count = campaigns.length
  const page = campaigns.slice(offset, offset + limit)

  res.json({
    campaigns: page.map((c: any) => formatCampaignListItem(c, ctx.tenant.id)),
    count,
  })
}

/**
 * POST /merchant/campaigns
 *
 * Creates a campaign whose campaign_identifier is tenant-namespaced. The
 * merchant-entered identifier is only the display part; a clash can therefore
 * only be with THIS tenant's own campaigns (409), never cross-tenant.
 * Spend budgets default to the tenant's store currency when none is sent.
 * Budget type and currency are immutable after creation (Medusa rule).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreateCampaignSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const displayIdentifier = parsed.data.identifier.trim()
  const internalIdentifier = namespaceIdentifier(ctx.tenant.id, displayIdentifier)
  if (!internalIdentifier.startsWith(campaignIdentifierPrefix(ctx.tenant.id))) {
    return res.status(400).json({ message: "invalid identifier" })
  }

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)

  // Per-tenant uniqueness pre-check: the namespaced identifier embeds this
  // tenant's id, so an existing row with the same internal identifier can only
  // be THIS tenant's. The DB unique index backstops races below.
  const clash = await promotionModule.listCampaigns(
    { campaign_identifier: internalIdentifier },
    { take: 1 }
  )
  if ((clash || []).some((c: any) => c.campaign_identifier === internalIdentifier)) {
    return res
      .status(409)
      .json({ message: "a campaign with this identifier already exists" })
  }

  let budget: any = undefined
  if (parsed.data.budget) {
    const b = parsed.data.budget
    const isSpend = b.type === "spend" || b.type === "spend_by_attribute"
    const currency = isSpend
      ? normCurrency(b.currency_code) ||
        normCurrency(ctx.tenant.meta?.currency_code) ||
        "usd"
      : undefined
    budget = {
      type: b.type,
      limit: b.limit ?? null,
      ...(currency ? { currency_code: currency } : {}),
      ...(b.attribute ? { attribute: b.attribute } : {}),
    }
  }

  let createdId: string
  try {
    const { result } = await createCampaignsWorkflow(req.scope).run({
      input: {
        campaignsData: [
          {
            name: parsed.data.name.trim(),
            description: parsed.data.description?.trim() || null,
            campaign_identifier: internalIdentifier,
            starts_at: parsed.data.starts_at
              ? new Date(parsed.data.starts_at)
              : null,
            ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at) : null,
            ...(budget ? { budget } : {}),
          },
        ],
      },
    })
    createdId = (result as any[])[0]?.id
  } catch (e: any) {
    const message = e?.message || ""
    if (/unique|duplicate|already exists/i.test(message)) {
      return res
        .status(409)
        .json({ message: "a campaign with this identifier already exists" })
    }
    return res
      .status(400)
      .json({ message: message || "failed to create campaign" })
  }

  const [campaign] = await promotionModule.listCampaigns(
    { id: createdId },
    { take: 1, relations: ["budget"] }
  )
  if (!campaign) {
    return res.status(500).json({ message: "campaign creation failed" })
  }

  res
    .status(201)
    .json({ campaign: formatCampaignDetail(campaign, [], ctx.tenant.id) })
}
