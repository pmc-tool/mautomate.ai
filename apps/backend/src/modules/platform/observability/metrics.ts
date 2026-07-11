import { CREDIT_USD, TIERS } from "../pricing/price-book"

/**
 * Tenant statuses that count toward MRR — a store that is serving or owes
 * (billing not yet cut off). Note tenant status vocabulary ("live") differs
 * from the billing lifecycle vocabulary ("active").
 */
const BILLING_ACTIVE = new Set(["live", "past_due", "grace"])

/**
 * Platform-wide metrics aggregation (super-admin dashboard).
 *
 * Pure so it is unit-testable: given the tenant rows, the credit ledger, and
 * usage events, it computes the numbers an operator wants at a glance — how many
 * stores, MRR from subscriptions, top-up + total revenue, credits granted vs
 * spent, and usage by action.
 */
export type TenantRow = { status: string; package: string; credit_balance?: number }
export type TxnRow = { type: string; amount: number }
export type UsageRow = { action: string; units: number; credits: number; vendor_cost_usd?: number | null }

const tierPrice = (pkg: string): number =>
  TIERS.find((t) => t.key === pkg)?.price_usd ?? 0

export type PlatformMetrics = {
  tenants_total: number
  by_status: Record<string, number>
  by_package: Record<string, number>
  mrr_usd: number
  topup_revenue_usd: number
  revenue_total_usd: number
  credits_granted: number
  credits_spent: number
  credits_outstanding: number
  usage_by_action: Record<string, { units: number; credits: number; vendor_cost_usd: number }>
}

export const computeMetrics = (
  tenants: TenantRow[],
  txns: TxnRow[],
  usage: UsageRow[]
): PlatformMetrics => {
  const by_status: Record<string, number> = {}
  const by_package: Record<string, number> = {}
  let mrr = 0
  let outstanding = 0
  for (const t of tenants) {
    by_status[t.status] = (by_status[t.status] ?? 0) + 1
    by_package[t.package] = (by_package[t.package] ?? 0) + 1
    if (BILLING_ACTIVE.has(t.status)) mrr += tierPrice(t.package)
    outstanding += Number(t.credit_balance ?? 0)
  }

  let granted = 0
  let spent = 0
  let topupCredits = 0
  for (const tx of txns) {
    if (tx.type === "grant" || tx.type === "topup" || tx.type === "refund") {
      granted += tx.amount
    }
    if (tx.type === "topup") topupCredits += tx.amount
    if (tx.type === "commit") spent += Math.abs(tx.amount)
  }

  const usage_by_action: PlatformMetrics["usage_by_action"] = {}
  for (const u of usage) {
    const a = (usage_by_action[u.action] ??= { units: 0, credits: 0, vendor_cost_usd: 0 })
    a.units += u.units
    a.credits += u.credits
    a.vendor_cost_usd += u.vendor_cost_usd ?? 0
  }

  const topup_revenue_usd = round2(topupCredits * CREDIT_USD)
  return {
    tenants_total: tenants.length,
    by_status,
    by_package,
    mrr_usd: round2(mrr),
    topup_revenue_usd,
    revenue_total_usd: round2(mrr + topup_revenue_usd),
    credits_granted: round2(granted),
    credits_spent: round2(spent),
    credits_outstanding: round2(outstanding),
    usage_by_action,
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100
