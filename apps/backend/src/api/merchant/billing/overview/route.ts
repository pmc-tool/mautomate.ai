import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { getLedger } from "../../../../modules/platform/credits/metering"
import { gatewayForCountry } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import {
  CREDIT_USD,
  creditsFor,
  BillableAction,
} from "../../../../modules/platform/pricing/price-book"

/**
 * GET /merchant/billing/overview
 *
 * The single payload the merchant Billing page loads: the current subscription
 * package + all available packages, the credit wallet (authoritative ledger
 * balance), the monthly included-credit allowance and how much has been used
 * this cycle, a per-feature usage breakdown, purchasable credit packs, and
 * whether a live payment gateway is configured (drives honest degraded copy).
 *
 * Everything here reuses the existing control-plane engine (CreditLedgerService,
 * platform_package, usage_event, billing gateways) — no new billing primitives.
 */

// Credit packs offered to merchants. Credits are USD-pegged (1 credit = $0.01);
// larger packs include a bonus. Checkout itself reuses POST /merchant/credits.
const PACKS = [
  { credits: 1000, amount_usd: 10, bonus_pct: 0 },
  { credits: 2750, amount_usd: 25, bonus_pct: 10 },
  { credits: 6000, amount_usd: 50, bonus_pct: 20 },
  { credits: 13000, amount_usd: 100, bonus_pct: 30 },
]

const ACTION_LABEL: Record<string, string> = {
  ai_call_minute: "AI calls (web)",
  ai_call_phone_minute: "AI calls (phone)",
  phone_number_month: "Phone number rental",
  sms_segment: "SMS / WhatsApp",
  ai_text: "AI text & chatbot",
  ai_page_edit: "AI page edits",
  ai_content: "AI content & blogs",
  ai_image: "AI images",
  ai_logo: "AI logos",
  ai_image_basic: "AI images (basic)",
  social_publish: "Social publishing",
  email_batch: "Emails",
  email: "Emails",
  domain_purchase_usd: "Domains",
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenantId = ctx.tenant.id

  // Wallet — authoritative balance from the ledger (WalletState { balance, reserved }).
  const wallet = await getLedger(req.scope)
    .balance(tenantId)
    .catch(() => ({ balance: 0, reserved: 0 }) as any)
  const balance =
    typeof wallet === "number" ? wallet : Number(wallet?.balance ?? 0)
  // Two buckets, because they behave differently: PLAN credits expire at the end
  // of the period; PURCHASED credits never do. Merchants must see the difference.
  const buckets = await getLedger(req.scope)
    .balanceBreakdown(tenantId)
    .catch(() => ({ total: balance, expiring: 0, permanent: balance, next_expiry: null }) as any)
  const reserved =
    typeof wallet === "number" ? 0 : Number(wallet?.reserved ?? 0)

  // Plans — the editable platform packages (one source of truth with landing/signup).
  const plans = await ctx.svc
    .listPlatformPackages({ active: true }, { order: { sort: "ASC" } })
    .catch(() => [])
  const current =
    (
      await ctx.svc
        .listPlatformPackages({ key: ctx.tenant.package }, { take: 1 })
        .catch(() => [])
    )[0] || null

  // Usage this billing cycle (calendar month) — aggregated per action from the
  // credit ledger. `commit` rows are the metered spends (usage_event is not
  // populated by the metering path, so the ledger is the source of truth).
  // Units are derived from credits via the price book (e.g. call minutes).
  const now = new Date()
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const txns = await ctx.svc
    .listCreditTransactions(
      { tenant_id: tenantId },
      { take: 5000, order: { created_at: "DESC" } }
    )
    .catch(() => [])
  const byAction: Record<
    string,
    { action: string; label: string; units: number; credits: number }
  > = {}
  let usedThisCycle = 0
  for (const t of txns as any[]) {
    if (t.type !== "commit" || !t.action) continue
    const created = t.created_at ? new Date(t.created_at) : null
    if (created && created < cycleStart) continue
    const a = t.action
    const credits = Math.abs(Number(t.amount ?? 0))
    let perUnit = 1
    try {
      perUnit = creditsFor(a as BillableAction, 1) || 1
    } catch {
      perUnit = 1
    }
    if (!byAction[a]) {
      byAction[a] = { action: a, label: ACTION_LABEL[a] || a, units: 0, credits: 0 }
    }
    byAction[a].units += perUnit > 0 ? credits / perUnit : 1
    byAction[a].credits += credits
    usedThisCycle += credits
  }

  // Live gateway? Drives the honest "billing is being set up" banner + top-up.
  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry(ctx.tenant.billing_country || "US", cfg)
  let gatewayConfigured = false
  try {
    gatewayConfigured = !!gateway && !!(await gateway.isConfigured())
  } catch {
    gatewayConfigured = false
  }

  const num = (v: any) => Number(v ?? 0)

  res.json({
    credit_usd: CREDIT_USD,
    plan_status: ctx.tenant.status,
    trial_ends_at: ctx.tenant.trial_ends_at ?? null,
    credits: {
      total: buckets.total,
      expiring: buckets.expiring,
      purchased: buckets.permanent,
      next_expiry: buckets.next_expiry,
    },
    wallet: { balance, reserved },
    current_plan: current
      ? {
          key: current.key,
          name: current.name,
          price_usd: num(current.price_usd),
          included_credits: num(current.included_credits),
        }
      : null,
    plans: (plans as any[]).map((p) => ({
      key: p.key,
      name: p.name,
      price_usd: num(p.price_usd),
      included_credits: num(p.included_credits),
      products_limit: p.products_limit ?? null,
      seats_limit: p.seats_limit ?? null,
      domains_limit: p.domains_limit ?? null,
      features: p.features ?? null,
      sort: num(p.sort),
    })),
    allowance: {
      included: num(current?.included_credits),
      used_this_cycle: usedThisCycle,
      cycle_start: cycleStart.toISOString(),
    },
    usage: Object.values(byAction).sort((a, b) => b.credits - a.credits),
    packs: PACKS,
    gateway: { configured: gatewayConfigured, name: gateway?.name ?? null },
  })
}
