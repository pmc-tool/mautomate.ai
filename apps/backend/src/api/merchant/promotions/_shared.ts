import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
  RuleType,
} from "@medusajs/framework/utils"
import {
  batchPromotionRulesWorkflow,
  updatePromotionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { MerchantCtx, resolveMerchant } from "../_helpers"
import { denamespaceCode } from "../discounts/_promo-code"

/**
 * Shared helpers for the /merchant/promotions routes.
 *
 * ISOLATION MODEL (LAW — mirrors /merchant/discounts, which stays untouched and
 * keeps serving until the frontend flips):
 * - Every promotion row is tagged metadata.tenant_id at creation; every read
 *   filters on it in memory, fail-closed (untagged / foreign rows are invisible).
 * - The real promotion `code` is tenant-namespaced (../discounts/_promo-code);
 *   merchants only ever see metadata.display_code. The internal code is NEVER
 *   returned by any /merchant/promotions response.
 * - Rule VALUES are tenant-scoped end to end: writes reject any entity id that
 *   is not tenant-owned (products via the tenant sales-channel link, everything
 *   else via metadata.tenant_id), and label hydration only ever resolves
 *   tenant-owned rows — foreign ids fall back to the raw id, never a label.
 *   Fail-closed in both directions.
 * - Campaigns carry NO metadata column in @medusajs/promotion 2.17 (verified
 *   against the installed dist model), so campaign ownership is proven via the
 *   "<tenantId>:" prefix on campaign_identifier.
 * - The promotion model has no starts_at/ends_at columns in 2.17; promotion
 *   scheduling dates round-trip through metadata.starts_at / metadata.ends_at.
 */

export type RuleTypePath = "rules" | "target-rules" | "buy-rules"

export const RULE_TYPE_MAP: Record<RuleTypePath, RuleType> = {
  rules: RuleType.RULES,
  "target-rules": RuleType.TARGET_RULES,
  "buy-rules": RuleType.BUY_RULES,
}

/** Relations loaded whenever a full promotion detail (incl. rules) is needed. */
export const PROMOTION_DETAIL_RELATIONS = [
  "application_method",
  "application_method.target_rules",
  "application_method.target_rules.values",
  "application_method.buy_rules",
  "application_method.buy_rules.values",
  "rules",
  "rules.values",
  "campaign",
  "campaign.budget",
]

export type OperatorOption = { id: string; value: string; label: string }

export const OPERATORS: OperatorOption[] = [
  { id: "in", value: "in", label: "In" },
  { id: "eq", value: "eq", label: "Equals" },
  { id: "ne", value: "ne", label: "Not In" },
]

const EQ_ONLY: OperatorOption[] = [{ id: "eq", value: "eq", label: "Equals" }]

export type RuleAttribute = {
  id: string
  value: string
  label: string
  field_type: "multiselect" | "select" | "number"
  required: boolean
  disguised: boolean
  operators: OperatorOption[]
}

/**
 * Attribute catalog. Mirrors Medusa admin's rule-attribute lists MINUS region,
 * country, sales-channel and shipping-option-type attributes — tenants have a
 * single region + single sales channel, so those rules are meaningless here
 * (tenancy adaptation per brief).
 */
const customerAttributes = (): RuleAttribute[] => [
  {
    id: "customer_group",
    value: "customer.groups.id",
    label: "Customer Group",
    field_type: "multiselect",
    required: false,
    disguised: false,
    operators: [...OPERATORS],
  },
]

const itemAttributes = (): RuleAttribute[] => [
  {
    id: "product",
    value: "items.product.id",
    label: "Product",
    field_type: "multiselect",
    required: false,
    disguised: false,
    operators: [...OPERATORS],
  },
  {
    id: "product_category",
    value: "items.product.categories.id",
    label: "Product Category",
    field_type: "multiselect",
    required: false,
    disguised: false,
    operators: [...OPERATORS],
  },
  {
    id: "product_collection",
    value: "items.product.collection_id",
    label: "Product Collection",
    field_type: "multiselect",
    required: false,
    disguised: false,
    operators: [...OPERATORS],
  },
  {
    id: "product_type",
    value: "items.product.type_id",
    label: "Product Type",
    field_type: "multiselect",
    required: false,
    disguised: false,
    operators: [...OPERATORS],
  },
  {
    id: "product_tag",
    value: "items.product.tags.id",
    label: "Product Tag",
    field_type: "multiselect",
    required: false,
    disguised: false,
    operators: [...OPERATORS],
  },
]

const currencyAttribute = (required: boolean): RuleAttribute => ({
  id: "currency_code",
  value: "currency_code",
  label: "Currency Code",
  field_type: "select",
  required,
  disguised: true,
  operators: EQ_ONLY,
})

const buyRulesMinQuantityAttribute = (): RuleAttribute => ({
  id: "buy_rules_min_quantity",
  value: "buy_rules_min_quantity",
  label: "Minimum quantity of items",
  field_type: "number",
  required: true,
  disguised: true,
  operators: EQ_ONLY,
})

const applyToQuantityAttribute = (): RuleAttribute => ({
  id: "apply_to_quantity",
  value: "apply_to_quantity",
  label: "Quantity of items promotion will apply to",
  field_type: "number",
  required: true,
  disguised: true,
  operators: EQ_ONLY,
})

export function getRuleAttributes(opts: {
  ruleType: RuleTypePath
  promotionType?: string | null
  applicationMethodType?: string | null
  targetType?: string | null
}): RuleAttribute[] {
  const { ruleType, promotionType, applicationMethodType, targetType } = opts

  if (ruleType === "rules") {
    return [
      ...customerAttributes(),
      currencyAttribute(applicationMethodType === "fixed"),
    ]
  }

  // Tenancy adaptation: shipping-method target rules have no offerable
  // attributes (shipping_option_type is omitted alongside region/channel).
  if (targetType === "shipping_methods") {
    return []
  }

  const attrs = itemAttributes()
  if (promotionType === "buyget") {
    if (ruleType === "buy-rules") {
      attrs.push(buyRulesMinQuantityAttribute())
    }
    if (ruleType === "target-rules") {
      attrs.push(applyToQuantityAttribute())
    }
  }
  return attrs
}

export function allRuleAttributes(): RuleAttribute[] {
  return [
    ...customerAttributes(),
    ...itemAttributes(),
    currencyAttribute(false),
    buyRulesMinQuantityAttribute(),
    applyToQuantityAttribute(),
  ]
}

export function findAttribute(idOrValue: string): RuleAttribute | undefined {
  return allRuleAttributes().find(
    (a) => a.id === idOrValue || a.value === idOrValue
  )
}

/** query.graph sources used to hydrate value labels server-side. */
export const RULE_VALUE_SOURCES: Record<
  string,
  { entity: string; labelField: string }
> = {
  customer_group: { entity: "customer_group", labelField: "name" },
  product: { entity: "product", labelField: "title" },
  product_category: { entity: "product_category", labelField: "name" },
  product_collection: { entity: "product_collection", labelField: "title" },
  product_type: { entity: "product_type", labelField: "value" },
  product_tag: { entity: "product_tag", labelField: "value" },
}

const CURRENCY_RE = /^[a-z]{3}$/

const normCurrency = (c: unknown): string =>
  typeof c === "string" ? c.trim().toLowerCase() : ""

/** The tenant's currency settings (same source of truth as /merchant/store). */
export function tenantCurrencies(ctx: MerchantCtx): {
  currencies: string[]
  default_currency: string
} {
  const def = normCurrency(ctx.tenant.meta?.currency_code)
  const default_currency = CURRENCY_RE.test(def) ? def : "usd"
  const supported: string[] = Array.isArray(
    ctx.tenant.meta?.supported_currencies
  )
    ? ctx.tenant.meta.supported_currencies
        .map(normCurrency)
        .filter((c: string) => CURRENCY_RE.test(c))
    : []
  return {
    currencies: Array.from(new Set([...supported, default_currency])),
    default_currency,
  }
}

/**
 * Campaign ownership: @medusajs/promotion 2.17 campaigns have NO metadata, so
 * isolation is via campaign_identifier = "<tenantId>:<identifier>". The display
 * identifier the merchant sees is the part after the prefix.
 */
export function isCampaignOwned(campaign: any, tenantId: string): boolean {
  return (
    !!campaign &&
    typeof campaign.campaign_identifier === "string" &&
    campaign.campaign_identifier.startsWith(`${tenantId}:`)
  )
}

export function campaignIdentifierDisplay(
  tenantId: string,
  identifier?: string | null
): string | null {
  if (!identifier) return null
  const prefix = `${tenantId}:`
  return identifier.startsWith(prefix)
    ? identifier.slice(prefix.length)
    : identifier
}

export function formatCampaign(campaign: any, tenantId: string) {
  if (!campaign || !isCampaignOwned(campaign, tenantId)) return null
  const budget = campaign.budget
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? null,
    campaign_identifier_display: campaignIdentifierDisplay(
      tenantId,
      campaign.campaign_identifier
    ),
    starts_at: campaign.starts_at ?? null,
    ends_at: campaign.ends_at ?? null,
    budget: budget
      ? {
          id: budget.id,
          type: budget.type ?? null,
          currency_code: budget.currency_code ?? null,
          limit: budget.limit !== undefined && budget.limit !== null ? Number(budget.limit) : null,
          used: budget.used !== undefined && budget.used !== null ? Number(budget.used) : 0,
        }
      : null,
  }
}

/**
 * Map a stored promotion to the merchant-facing list-item shape. The merchant
 * only ever sees the DISPLAY code (metadata.display_code, falling back to
 * stripping the tenant prefix off the internal namespaced code).
 */
export function formatPromotionListItem(promotion: any, tenantId: string) {
  const method = promotion.application_method || {}
  const display_code =
    promotion.metadata?.display_code ??
    denamespaceCode(tenantId, promotion.code)
  return {
    id: promotion.id,
    display_code,
    // legacy-friendly alias — same DISPLAY code, never the internal one
    code: display_code,
    is_automatic: !!promotion.is_automatic,
    type: promotion.type ?? "standard",
    status: promotion.status ?? "draft",
    method: promotion.is_automatic ? "automatic" : "code",
    value_type: method.type ?? null,
    value:
      method.value !== undefined && method.value !== null
        ? Number(method.value)
        : null,
    currency_code: method.currency_code ?? null,
    allocation: method.allocation ?? null,
    target_type: method.target_type ?? null,
    campaign: formatCampaign(promotion.campaign, tenantId),
    limit: promotion.limit ?? null,
    used: promotion.used !== undefined && promotion.used !== null ? Number(promotion.used) : 0,
    starts_at: promotion.metadata?.starts_at ?? null,
    ends_at: promotion.metadata?.ends_at ?? null,
    created_at: promotion.created_at,
    updated_at: promotion.updated_at,
  }
}

/**
 * Load a promotion only if it is tagged with this tenant's metadata.tenant_id.
 * Untagged / foreign rows resolve to null (fail-closed).
 */
export async function findOwnedPromotion(
  req: MedusaRequest,
  tenantId: string,
  id: string,
  relations: string[] = PROMOTION_DETAIL_RELATIONS
) {
  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const [promotion] = await promotionModule.listPromotions(
    { id },
    { take: 1, relations }
  )
  if (!promotion || promotion.metadata?.tenant_id !== tenantId) return null
  return promotion
}

/**
 * Load a campaign only if its campaign_identifier carries this tenant's
 * prefix. Foreign / unprefixed campaigns resolve to null (fail-closed).
 */
export async function findOwnedCampaign(
  req: MedusaRequest,
  tenantId: string,
  id: string
) {
  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const [campaign] = await promotionModule.listCampaigns(
    { id },
    { take: 1, relations: ["budget"] }
  )
  if (!campaign || !isCampaignOwned(campaign, tenantId)) return null
  return campaign
}

/**
 * Tenant-owned id -> label map for a rule-value entity. Ownership uses the
 * SAME tenant-scoped sources the rule-values route offers as options:
 * - product: linked to the tenant sales channel (product_sales_channel link)
 * - everything else: metadata.tenant_id === this tenant
 * Foreign / untagged rows are NEVER returned — fail-closed. Callers use this
 * both to hydrate labels (foreign ids fall back to the raw id, so no foreign
 * name/title can ever be disclosed) and to validate submitted rule values on
 * write (invalidTenantRuleValue).
 */
export async function loadValueLabels(
  req: MedusaRequest,
  ctx: MerchantCtx,
  attributeId: string,
  values: string[]
): Promise<Map<string, string>> {
  const source = RULE_VALUE_SOURCES[attributeId]
  if (!source || !values.length) return new Map()
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    if (attributeId === "product") {
      const scId = ctx.tenant.meta?.sales_channel_id
      if (!scId) return new Map()
      const { data: links } = await query.graph({
        entity: "product_sales_channel",
        filters: { sales_channel_id: scId, product_id: values } as any,
        fields: ["product_id"],
      })
      const ownedIds = Array.from(
        new Set((links || []).map((l: any) => l.product_id).filter(Boolean))
      )
      if (!ownedIds.length) return new Map()
      const { data } = await query.graph({
        entity: "product",
        filters: { id: ownedIds } as any,
        fields: ["id", source.labelField],
      })
      return new Map(
        (data || []).map((row: any) => [
          row.id,
          row[source.labelField] ?? row.id,
        ])
      )
    }

    const { data } = await query.graph({
      entity: source.entity,
      filters: { id: values } as any,
      fields: ["id", source.labelField, "metadata"],
    })
    return new Map(
      (data || [])
        .filter((row: any) => row.metadata?.tenant_id === ctx.tenant.id)
        .map((row: any) => [row.id, row[source.labelField] ?? row.id])
    )
  } catch {
    // fail-closed: on error nothing is treated as owned — hydration falls
    // back to raw ids and write-validation rejects
    return new Map()
  }
}

/**
 * First submitted rule value that is NOT tenant-owned, or null when every
 * value checks out. LAW: fail-closed — accepting a foreign entity id would let
 * label hydration echo the foreign tenant's private name/title back through
 * this tenant's promotion detail. Disguised / number attributes carry no
 * entity ids and are skipped; unknown attributes are rejected outright.
 */
export async function invalidTenantRuleValue(
  req: MedusaRequest,
  ctx: MerchantCtx,
  rules: { attribute: string; values: string[] }[]
): Promise<{ attribute: string; value: string } | null> {
  const valuesByAttrId = new Map<string, Set<string>>()
  for (const rule of rules) {
    const attr = findAttribute(rule.attribute)
    if (!attr) {
      return { attribute: rule.attribute, value: rule.values[0] ?? "" }
    }
    if (attr.disguised || !RULE_VALUE_SOURCES[attr.id]) continue
    const set = valuesByAttrId.get(attr.id) ?? new Set<string>()
    for (const v of rule.values) set.add(v)
    valuesByAttrId.set(attr.id, set)
  }
  for (const [attrId, set] of valuesByAttrId) {
    const owned = await loadValueLabels(req, ctx, attrId, Array.from(set))
    for (const v of set) {
      if (!owned.has(v)) return { attribute: attrId, value: v }
    }
  }
  return null
}

/**
 * Serialize one rule group of a promotion into the contract shape:
 * { id, attribute, attribute_label, operator, operator_label, field_type,
 *   required, disguised, values: [{ value, label }] | number }.
 * Disguised attributes (currency_code / apply_to_quantity /
 * buy_rules_min_quantity) live on the application method and are surfaced as
 * synthetic rules, exactly like Medusa admin's rule endpoints do. Value labels
 * only resolve for tenant-owned rows (loadValueLabels is tenant-scoped);
 * anything else renders as its raw id.
 */
export async function serializeRules(
  req: MedusaRequest,
  ctx: MerchantCtx,
  promotion: any,
  ruleTypePath: RuleTypePath
): Promise<any[]> {
  const method = promotion.application_method || {}
  const attrs = getRuleAttributes({
    ruleType: ruleTypePath,
    promotionType: promotion.type,
    applicationMethodType: method.type,
    targetType: method.target_type,
  })
  const rawRules: any[] =
    ruleTypePath === "rules"
      ? promotion.rules || []
      : ruleTypePath === "target-rules"
      ? method.target_rules || []
      : method.buy_rules || []

  const out: any[] = []

  for (const attr of attrs.filter((a) => a.disguised)) {
    const raw = method[attr.id]
    if (!attr.required && (raw === null || raw === undefined)) continue
    let values: any = []
    if (attr.field_type === "number") {
      values = raw ?? null
    } else if (raw !== null && raw !== undefined) {
      const v = String(raw)
      values = [
        { value: v, label: attr.id === "currency_code" ? v.toUpperCase() : v },
      ]
    }
    out.push({
      id: null,
      attribute: attr.id,
      attribute_label: attr.label,
      field_type: attr.field_type,
      operator: "eq",
      operator_label: "Equals",
      required: attr.required,
      disguised: true,
      values,
    })
  }

  // batch label lookups per attribute kind (no N+1)
  const valuesByAttrId = new Map<string, Set<string>>()
  for (const rule of rawRules) {
    const attr = findAttribute(rule.attribute)
    if (!attr || !RULE_VALUE_SOURCES[attr.id]) continue
    const set = valuesByAttrId.get(attr.id) ?? new Set<string>()
    for (const v of rule.values || []) {
      const value = typeof v === "string" ? v : v?.value
      if (value) set.add(value)
    }
    valuesByAttrId.set(attr.id, set)
  }
  const labelMaps = new Map<string, Map<string, string>>()
  for (const [attrId, set] of valuesByAttrId) {
    labelMaps.set(
      attrId,
      await loadValueLabels(req, ctx, attrId, Array.from(set))
    )
  }

  for (const rule of rawRules) {
    const attr = findAttribute(rule.attribute)
    const labels = attr ? labelMaps.get(attr.id) : undefined
    const ruleValues: string[] = (rule.values || [])
      .map((v: any) => (typeof v === "string" ? v : v?.value))
      .filter((v: any) => v !== null && v !== undefined)
    out.push({
      id: rule.id,
      attribute: rule.attribute,
      attribute_label: attr?.label ?? rule.attribute,
      field_type: attr?.field_type ?? "multiselect",
      operator: rule.operator,
      operator_label:
        OPERATORS.find((o) => o.id === rule.operator)?.label ?? rule.operator,
      required: false,
      disguised: false,
      values: ruleValues.map((v) => ({ value: v, label: labels?.get(v) ?? v })),
    })
  }

  return out
}

/** PromotionDetail = list item + application_method + labeled rule groups. */
export async function buildPromotionDetail(
  req: MedusaRequest,
  ctx: MerchantCtx,
  promotion: any
) {
  const method = promotion.application_method || null
  const [rules, target_rules, buy_rules] = await Promise.all([
    serializeRules(req, ctx, promotion, "rules"),
    serializeRules(req, ctx, promotion, "target-rules"),
    promotion.type === "buyget"
      ? serializeRules(req, ctx, promotion, "buy-rules")
      : Promise.resolve([]),
  ])
  return {
    ...formatPromotionListItem(promotion, ctx.tenant.id),
    is_tax_inclusive: !!promotion.is_tax_inclusive,
    application_method: method
      ? {
          id: method.id,
          type: method.type ?? null,
          target_type: method.target_type ?? null,
          allocation: method.allocation ?? null,
          value:
            method.value !== undefined && method.value !== null
              ? Number(method.value)
              : null,
          currency_code: method.currency_code ?? null,
          max_quantity: method.max_quantity ?? null,
          apply_to_quantity: method.apply_to_quantity ?? null,
          buy_rules_min_quantity: method.buy_rules_min_quantity ?? null,
        }
      : null,
    rules,
    target_rules,
    buy_rules,
    metadata: promotion.metadata ?? null,
  }
}

export async function refetchPromotionDetail(
  req: MedusaRequest,
  ctx: MerchantCtx,
  id: string
) {
  const promotion = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!promotion) return null
  return buildPromotionDetail(req, ctx, promotion)
}

/* ------------------------------------------------------------------ */
/* Shared zod pieces                                                    */
/* ------------------------------------------------------------------ */

export const RuleInputSchema = z.object({
  attribute: z.string().min(1),
  operator: z.enum(["in", "eq", "ne"]),
  values: z.array(z.string().min(1)).min(1),
})
export type RuleInput = z.infer<typeof RuleInputSchema>

export const IsoDateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "invalid date" })

export type DisguisedValues = {
  currency_code?: string
  apply_to_quantity?: number
  buy_rules_min_quantity?: number
}

/**
 * Split disguised rules out of a rule-input list. Disguised attributes are
 * persisted onto the application method (mirroring Medusa admin), never as
 * promotion_rule rows.
 */
export function splitDisguisedRules(rules: RuleInput[]): {
  real: RuleInput[]
  disguised: DisguisedValues
} {
  const real: RuleInput[] = []
  const disguised: DisguisedValues = {}
  for (const rule of rules) {
    if (rule.attribute === "currency_code") {
      const code = normCurrency(rule.values[0])
      if (CURRENCY_RE.test(code)) disguised.currency_code = code
    } else if (rule.attribute === "apply_to_quantity") {
      const n = Number(rule.values[0])
      if (Number.isFinite(n)) disguised.apply_to_quantity = n
    } else if (rule.attribute === "buy_rules_min_quantity") {
      const n = Number(rule.values[0])
      if (Number.isFinite(n)) disguised.buy_rules_min_quantity = n
    } else {
      real.push(rule)
    }
  }
  return { real, disguised }
}

/** First rule attribute not present in the server catalog, or null if all ok. */
export function invalidRuleAttribute(
  rules: RuleInput[],
  ruleType: RuleTypePath,
  promotionType?: string | null,
  targetType?: string | null
): string | null {
  const allowed = new Set(
    getRuleAttributes({
      ruleType,
      promotionType,
      applicationMethodType: "fixed",
      targetType,
    }).map((a) => a.value)
  )
  allowed.add("currency_code")
  allowed.add("apply_to_quantity")
  allowed.add("buy_rules_min_quantity")
  for (const rule of rules) {
    if (!allowed.has(rule.attribute)) return rule.attribute
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Shared rules-batch handler (POST .../rules|target-rules|buy-rules)  */
/* ------------------------------------------------------------------ */

const RuleUpdateSchema = z.object({
  id: z.string().min(1),
  attribute: z.string().min(1).optional(),
  operator: z.enum(["in", "eq", "ne"]).optional(),
  values: z.array(z.string().min(1)).min(1).optional(),
})

const RuleBatchSchema = z.object({
  create: z.array(RuleInputSchema).optional().default([]),
  update: z.array(RuleUpdateSchema).optional().default([]),
  delete: z.array(z.string().min(1)).optional().default([]),
})

export async function handleRuleBatch(
  req: MedusaRequest,
  res: MedusaResponse,
  ruleTypePath: RuleTypePath
) {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const parsed = RuleBatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "invalid input", issues: parsed.error.issues })
  }

  const { id } = req.params
  const promotion = await findOwnedPromotion(req, ctx.tenant.id, id)
  if (!promotion) {
    return res.status(404).json({ message: "promotion not found" })
  }

  if (ruleTypePath === "buy-rules" && promotion.type !== "buyget") {
    return res
      .status(400)
      .json({ message: "buy rules are only available on buyget promotions" })
  }

  const method = promotion.application_method || {}

  const badAttribute = invalidRuleAttribute(
    parsed.data.create,
    ruleTypePath,
    promotion.type,
    method.target_type
  )
  if (badAttribute) {
    return res
      .status(400)
      .json({ message: `unknown rule attribute: ${badAttribute}` })
  }

  // update/delete may only touch THIS promotion's rules of THIS rule type —
  // never accept foreign rule ids (cross-tenant rule tampering is impossible)
  const ownRules: any[] =
    ruleTypePath === "rules"
      ? promotion.rules || []
      : ruleTypePath === "target-rules"
      ? method.target_rules || []
      : method.buy_rules || []
  const ownIds = new Set(ownRules.map((r: any) => r.id))
  for (const ruleId of [
    ...parsed.data.delete,
    ...parsed.data.update.map((u) => u.id),
  ]) {
    if (!ownIds.has(ruleId)) {
      return res
        .status(400)
        .json({ message: `rule ${ruleId} does not belong to this promotion` })
    }
  }

  // Disguised attributes are application-method fields, not rule rows.
  const { real, disguised } = splitDisguisedRules(parsed.data.create)

  // LAW (fail-closed isolation): every submitted entity id — created or
  // updated — must be tenant-owned, checked against the same tenant-scoped
  // sources the rule-values route offers. A foreign id would otherwise be
  // echoed back with the foreign tenant's private label via detail hydration.
  const valueChecks: { attribute: string; values: string[] }[] = real.map(
    (r) => ({ attribute: r.attribute, values: r.values })
  )
  for (const u of parsed.data.update) {
    if (!u.values?.length) continue
    const attribute =
      u.attribute ?? ownRules.find((r: any) => r.id === u.id)?.attribute
    if (!attribute) {
      return res
        .status(400)
        .json({ message: `rule ${u.id} has no resolvable attribute` })
    }
    valueChecks.push({ attribute, values: u.values })
  }
  const badValue = await invalidTenantRuleValue(req, ctx, valueChecks)
  if (badValue) {
    return res.status(400).json({
      message: `value ${badValue.value} is not available for attribute ${badValue.attribute}`,
    })
  }

  try {
    if (Object.keys(disguised).length) {
      if (disguised.currency_code) {
        const { currencies } = tenantCurrencies(ctx)
        if (!currencies.includes(disguised.currency_code)) {
          return res.status(400).json({
            message: `currency ${disguised.currency_code} is not enabled for this store`,
          })
        }
      }
      await updatePromotionsWorkflow(req.scope).run({
        input: {
          promotionsData: [
            { id, application_method: { ...disguised } } as any,
          ],
        },
      })
    }

    if (
      real.length ||
      parsed.data.update.length ||
      parsed.data.delete.length
    ) {
      await batchPromotionRulesWorkflow(req.scope).run({
        input: {
          id,
          rule_type: RULE_TYPE_MAP[ruleTypePath],
          create: real.map((r) => ({
            attribute: r.attribute,
            operator: r.operator,
            values: r.values,
          })),
          update: parsed.data.update,
          delete: parsed.data.delete,
        } as any,
      })
    }
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message ?? "failed to update promotion rules" })
  }

  const detail = await refetchPromotionDetail(req, ctx, id)
  res.json({ promotion: detail })
}
