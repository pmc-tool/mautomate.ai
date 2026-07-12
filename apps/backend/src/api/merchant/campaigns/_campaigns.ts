import { MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { denamespaceCode } from "../discounts/_promo-code"

/**
 * Per-tenant campaign isolation (pooled multi-tenant safety).
 *
 * The installed @medusajs/promotion (2.17) Campaign model has NO metadata
 * field (verified against dist/models/campaign.js), so campaigns CANNOT be
 * tagged metadata.tenant_id like promotions are. Instead we namespace the
 * unique campaign_identifier column:
 *
 *   internal identifier  =  "<tenantId>:<merchant-entered identifier>"
 *
 * The merchant only ever sees/edits the plain DISPLAY identifier (the part
 * after "<tenantId>:"). Every read filters campaigns to those whose
 * campaign_identifier carries THIS tenant's prefix — untagged / foreign rows
 * are invisible (fail-closed). Cross-tenant identifier collisions are
 * impossible because the prefix embeds the full tenant id and the column has
 * a unique index.
 */

/** The unique per-tenant prefix every namespaced campaign identifier carries. */
export function campaignIdentifierPrefix(tenantId: string): string {
  return `${tenantId}:`
}

/**
 * Merchant-entered DISPLAY identifier -> globally-unique internal identifier.
 * Idempotent: passing an already-namespaced identifier returns it unchanged.
 */
export function namespaceIdentifier(tenantId: string, input: string): string {
  const trimmed = (input || "").trim()
  if (!trimmed) return trimmed
  const prefix = campaignIdentifierPrefix(tenantId)
  if (trimmed.startsWith(prefix)) return trimmed
  return `${prefix}${trimmed}`
}

/** Internal identifier -> DISPLAY identifier for THIS tenant. */
export function denamespaceIdentifier(tenantId: string, identifier: string): string {
  const prefix = campaignIdentifierPrefix(tenantId)
  return identifier && identifier.startsWith(prefix)
    ? identifier.slice(prefix.length)
    : identifier
}

/** Whether an internal campaign_identifier belongs to THIS tenant. */
export function isOwnedIdentifier(tenantId: string, identifier: unknown): boolean {
  return (
    typeof identifier === "string" &&
    identifier.startsWith(campaignIdentifierPrefix(tenantId))
  )
}

/**
 * Defensive numeric coercion for bigNumber-backed columns (budget.limit,
 * budget.used). The serialized DTO normally carries plain numbers, but raw
 * BigNumber shapes ({ value }) and numeric strings are handled too.
 */
export function num(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === "object") {
    if ("value" in v) return num(v.value)
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Budget sub-object for merchant responses (used/limit reporting). */
export function formatBudget(budget: any) {
  if (!budget) return null
  return {
    type: budget.type ?? null,
    currency_code: budget.currency_code ?? null,
    limit: num(budget.limit),
    used: num(budget.used) ?? 0,
    attribute: budget.attribute ?? null,
  }
}

/** Campaign -> merchant-facing list item (identifier shown DE-namespaced). */
export function formatCampaignListItem(campaign: any, tenantId: string) {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? null,
    campaign_identifier_display: denamespaceIdentifier(
      tenantId,
      campaign.campaign_identifier || ""
    ),
    starts_at: campaign.starts_at ?? null,
    ends_at: campaign.ends_at ?? null,
    budget: formatBudget(campaign.budget),
    promotions_count: Array.isArray(campaign.promotions)
      ? campaign.promotions.length
      : 0,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  }
}

/**
 * Promotion -> merchant-facing PromotionListItem (same shape the promotions
 * routes return). The internal namespaced code is never exposed — only
 * metadata.display_code (falling back to stripping the tenant prefix).
 */
export function formatPromotionListItem(
  promotion: any,
  tenantId: string,
  campaign: { id: string; name: string } | null
) {
  const method = promotion.application_method || {}
  return {
    id: promotion.id,
    display_code:
      promotion.metadata?.display_code ??
      denamespaceCode(tenantId, promotion.code || ""),
    is_automatic: promotion.is_automatic ?? false,
    type: promotion.type ?? "standard",
    status: promotion.status ?? "draft",
    method: promotion.is_automatic ? "automatic" : "code",
    value_type: method.type ?? null,
    value: num(method.value) ?? 0,
    currency_code: method.currency_code ?? null,
    campaign: campaign ? { id: campaign.id, name: campaign.name } : null,
    starts_at: promotion.starts_at ?? null,
    ends_at: promotion.ends_at ?? null,
    created_at: promotion.created_at,
  }
}

/** Campaign + its promotions -> merchant-facing detail. */
export function formatCampaignDetail(
  campaign: any,
  promotions: any[],
  tenantId: string
) {
  return {
    ...formatCampaignListItem(campaign, tenantId),
    promotions_count: promotions.length,
    promotions: promotions.map((p) =>
      formatPromotionListItem(p, tenantId, {
        id: campaign.id,
        name: campaign.name,
      })
    ),
  }
}

/**
 * Load a campaign only if its campaign_identifier carries THIS tenant's
 * prefix. Foreign / legacy rows resolve to null (fail-closed).
 */
export async function findOwnedCampaign(
  req: MedusaRequest,
  tenantId: string,
  id: string
): Promise<any | null> {
  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const [campaign] = await promotionModule.listCampaigns(
    { id },
    { take: 1, relations: ["budget"] }
  )
  if (!campaign || !isOwnedIdentifier(tenantId, campaign.campaign_identifier)) {
    return null
  }
  return campaign
}

/**
 * The tenant's OWN promotions attached to a campaign, ready for the detail
 * payload. Foreign rows (impossible unless data was tampered with) are
 * filtered out — fail-closed.
 */
export async function listCampaignPromotions(
  req: MedusaRequest,
  tenantId: string,
  campaignId: string
): Promise<any[]> {
  const promotionModule: any = req.scope.resolve(Modules.PROMOTION)
  const promotions = await promotionModule.listPromotions(
    { campaign_id: campaignId },
    {
      take: 500,
      skip: 0,
      order: { created_at: "DESC" },
      relations: ["application_method"],
    }
  )
  return (promotions || []).filter(
    (p: any) => p.metadata?.tenant_id === tenantId
  )
}
