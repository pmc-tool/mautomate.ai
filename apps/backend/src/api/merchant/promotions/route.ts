import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../_helpers"
import { namespaceCode, denamespaceCode } from "../discounts/_promo-code"
import {
  IsoDateString,
  RuleInputSchema,
  findOwnedCampaign,
  formatPromotionListItem,
  invalidRuleAttribute,
  invalidTenantRuleValue,
  refetchPromotionDetail,
  splitDisguisedRules,
  tenantCurrencies,
} from "./_shared"

const STATUSES = ["draft", "active", "inactive"] as const
const StatusSchema = z.enum(STATUSES)

const ORDERS = ["created_at", "-created_at", "updated_at", "-updated_at"]

const ListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  campaign_id: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  order: z.string().optional(),
})

function normalizeStatuses(input?: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input ? input.split(",") : []
  return raw
    .map((s) => s.trim())
    .filter((s) => (STATUSES as readonly string[]).includes(s))
}

/**
 * GET /merchant/promotions
 *
 * Promotions are GLOBAL in Medusa, so rows are tagged metadata.tenant_id at
 * creation and only this tenant's rows are returned — in-memory filter,
 * fail-closed (untagged / foreign rows are invisible). q / status /
 * campaign_id are additionally pushed into the module list where supported
 * (code is searchable; status is a model filter; campaign_id is the campaign
 * FK column) so the pre-filter fetch stays as narrow as possible.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { q, campaign_id, offset, limit } = parsed.data
  const statuses = normalizeStatuses(parsed.data.status)
  const order =
    parsed.data.order && ORDERS.includes(parsed.data.order)
      ? parsed.data.order
      : "-created_at"
  const orderField = order.replace(/^-/, "")
  const orderDir = order.startsWith("-") ? "DESC" : "ASC"

  const filters: any = {}
  if (q) filters.q = q
  if (statuses.length) filters.status = statuses
  if (campaign_id) filters.campaign_id = campaign_id

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const all = await promotionModule.listPromotions(filters, {
    take: 1000,
    skip: 0,
    order: { [orderField]: orderDir },
    relations: ["application_method", "campaign", "campaign.budget"],
  })

  let owned = (all || []).filter(
    (p: any) => p.metadata?.tenant_id === ctx.tenant.id
  )
  if (q) {
    // re-check against the DISPLAY code so the namespaced internal prefix can
    // never produce false matches
    const needle = q.toLowerCase()
    owned = owned.filter((p: any) => {
      const dc =
        p.metadata?.display_code ?? denamespaceCode(ctx.tenant.id, p.code)
      return String(dc || "").toLowerCase().includes(needle)
    })
  }

  const count = owned.length
  const page = owned.slice(offset, offset + limit)

  res.json({
    promotions: page.map((p: any) =>
      formatPromotionListItem(p, ctx.tenant.id)
    ),
    count,
    offset,
    limit,
  })
}

const ApplicationMethodSchema = z.object({
  type: z.enum(["fixed", "percentage"]),
  target_type: z.enum(["items", "shipping_methods", "order"]),
  value: z.coerce.number().min(0),
  currency_code: z.string().length(3).optional(),
  allocation: z.enum(["each", "across", "once"]).optional(),
  max_quantity: z.coerce.number().int().min(1).nullable().optional(),
  apply_to_quantity: z.coerce.number().int().min(1).nullable().optional(),
  buy_rules_min_quantity: z.coerce
    .number()
    .int()
    .min(1)
    .nullable()
    .optional(),
})

const CreatePromotionSchema = z
  .object({
    display_code: z.string().min(1).max(100),
    is_automatic: z.boolean().optional().default(false),
    type: z.enum(["standard", "buyget"]).optional().default("standard"),
    status: StatusSchema.optional().default("draft"),
    is_tax_inclusive: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).nullable().optional(),
    application_method: ApplicationMethodSchema,
    rules: z.array(RuleInputSchema).optional().default([]),
    target_rules: z.array(RuleInputSchema).optional().default([]),
    buy_rules: z.array(RuleInputSchema).optional().default([]),
    campaign_id: z.string().min(1).nullable().optional(),
    starts_at: IsoDateString.nullable().optional(),
    ends_at: IsoDateString.nullable().optional(),
  })
  .refine(
    (data) =>
      data.application_method.type !== "percentage" ||
      (data.application_method.value > 0 &&
        data.application_method.value <= 100),
    {
      message: "Percentage value must be between 0 and 100",
      path: ["application_method", "value"],
    }
  )

/**
 * POST /merchant/promotions
 *
 * Creates a promotion tagged metadata.tenant_id. The merchant-entered code is
 * stored as metadata.display_code and the actual promotion `code` is set to
 * the tenant-namespaced value so it can never collide with another tenant's
 * code. Disguised rule attributes (currency_code / apply_to_quantity /
 * buy_rules_min_quantity) are merged onto the application method. Scheduling
 * dates are persisted in metadata (the 2.17 promotion model has no
 * starts_at/ends_at columns).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = CreatePromotionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }
  const data = parsed.data

  // fail-closed attribute whitelist per rule group
  for (const [group, ruleType, targetType] of [
    ["rules", "rules", null],
    ["target_rules", "target-rules", data.application_method.target_type],
    ["buy_rules", "buy-rules", null],
  ] as const) {
    const bad = invalidRuleAttribute(
      (data as any)[group],
      ruleType,
      data.type,
      targetType
    )
    if (bad) {
      return res
        .status(400)
        .json({ message: `unknown rule attribute: ${bad}` })
    }
  }

  const displayCode = data.display_code.trim()
  const internalCode = namespaceCode(ctx.tenant.id, displayCode)

  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)

  // Per-tenant uniqueness: the namespaced code embeds this tenant's id, so an
  // existing row with the same internal code can only be THIS tenant's.
  const clash = await promotionModule.listPromotions(
    { code: internalCode },
    { take: 1 }
  )
  if ((clash || []).some((p: any) => p.code === internalCode)) {
    return res
      .status(409)
      .json({ message: "a promotion with this code already exists" })
  }

  // campaign ownership (identifier-prefix isolation; campaigns have no metadata)
  if (data.campaign_id) {
    const campaign = await findOwnedCampaign(req, ctx.tenant.id, data.campaign_id)
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" })
    }
  }

  // disguised rules -> application_method fields (defense in depth; the
  // frontend already merges them, mirroring Medusa admin)
  const { real: rules, disguised: rulesDisguised } = splitDisguisedRules(
    data.rules
  )
  const { real: targetRules, disguised: targetDisguised } =
    splitDisguisedRules(data.target_rules)
  const { real: buyRules, disguised: buyDisguised } = splitDisguisedRules(
    data.buy_rules
  )

  // LAW (fail-closed isolation): every submitted rule value must be a
  // tenant-owned entity id (products via the tenant sales-channel link,
  // everything else via metadata.tenant_id) — otherwise label hydration would
  // echo a foreign tenant's private name/title back through this promotion.
  const badValue = await invalidTenantRuleValue(req, ctx, [
    ...rules,
    ...targetRules,
    ...buyRules,
  ])
  if (badValue) {
    return res.status(400).json({
      message: `value ${badValue.value} is not available for attribute ${badValue.attribute}`,
    })
  }

  const am = data.application_method
  const { currencies, default_currency } = tenantCurrencies(ctx)

  const method: any = {
    type: am.type,
    target_type: am.target_type,
    value: am.value,
  }

  const applyToQuantity =
    am.apply_to_quantity ?? targetDisguised.apply_to_quantity
  if (applyToQuantity !== undefined) {
    method.apply_to_quantity = applyToQuantity
  }
  const buyRulesMinQuantity =
    am.buy_rules_min_quantity ?? buyDisguised.buy_rules_min_quantity
  if (buyRulesMinQuantity !== undefined) {
    method.buy_rules_min_quantity = buyRulesMinQuantity
  }

  // Allocation (required by the module for items/shipping targets): the
  // promotion module REQUIRES max_quantity for buyget and FORBIDS max_quantity
  // when allocation is "across" (verified in @medusajs/promotion
  // application-method validations), so buyget+across is impossible. When the
  // client omits allocation (the spec's buy_get template hides the field),
  // default to "each" for buyget or whenever a quantity field was provided —
  // mirroring Medusa admin's buyget defaults (allocation "each" +
  // max_quantity) — and only default to "across" for pure standard cases.
  const hasClientMaxQuantity =
    am.max_quantity !== undefined && am.max_quantity !== null
  const hasApplyToQuantity =
    applyToQuantity !== undefined && applyToQuantity !== null
  if (am.target_type !== "order") {
    const defaultAllocation =
      data.type === "buyget" || hasClientMaxQuantity || hasApplyToQuantity
        ? "each"
        : "across"
    method.allocation = am.allocation ?? defaultAllocation
  } else if (am.allocation) {
    method.allocation = am.allocation
  }

  if (method.allocation === "across") {
    // module requirement: max_quantity must be unset when allocation is across
    method.max_quantity = null
  } else if (hasClientMaxQuantity) {
    // keep the client-sent max_quantity — never silently discard it
    method.max_quantity = am.max_quantity
  } else if (data.type === "buyget") {
    // buyget requires max_quantity; default it like Medusa admin's base form,
    // satisfying the module's max_quantity >= apply_to_quantity check
    method.max_quantity = hasApplyToQuantity ? applyToQuantity : 1
  }

  // Currency: fixed values always carry a currency; default to the store's
  // currency and only ever accept tenant-enabled currencies.
  let currency = am.currency_code
    ? am.currency_code.toLowerCase()
    : rulesDisguised.currency_code
  if (am.type === "fixed" && !currency) currency = default_currency
  if (currency) {
    if (!currencies.includes(currency)) {
      return res.status(400).json({
        message: `currency ${currency} is not enabled for this store`,
      })
    }
    method.currency_code = currency
  }

  if (targetRules.length) method.target_rules = targetRules
  if (buyRules.length) method.buy_rules = buyRules

  const metadata: Record<string, any> = {
    tenant_id: ctx.tenant.id,
    display_code: displayCode,
    starts_at: data.starts_at
      ? new Date(data.starts_at).toISOString()
      : null,
    ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
  }

  const promotionData: any = {
    code: internalCode,
    type: data.type,
    status: data.status,
    is_automatic: data.is_automatic,
    application_method: method,
    metadata,
  }
  if (data.is_tax_inclusive !== undefined) {
    promotionData.is_tax_inclusive = data.is_tax_inclusive
  }
  if (data.limit !== undefined) promotionData.limit = data.limit
  if (rules.length) promotionData.rules = rules
  if (data.campaign_id) promotionData.campaign_id = data.campaign_id

  let created: any
  try {
    const { result } = await createPromotionsWorkflow(req.scope).run({
      input: { promotionsData: [promotionData] },
    })
    created = (result as any[])[0]
  } catch (e: any) {
    const message = e?.message ?? "failed to create promotion"
    // Backstop: the DB enforces a unique constraint on promotion.code, so a
    // race surfaces here as a clean 409 rather than a 500.
    if (/already exists|duplicate|unique/i.test(message)) {
      return res
        .status(409)
        .json({ message: "a promotion with this code already exists" })
    }
    return res.status(400).json({ message })
  }

  const detail = await refetchPromotionDetail(req, ctx, created.id)
  res.status(201).json({ promotion: detail })
}
