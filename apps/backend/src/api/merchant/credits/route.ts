import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../_helpers"
import { getLedger } from "../../../modules/platform/credits/metering"
import { allGateways, gatewayForCountry } from "../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../modules/platform/secure-config"

/**
 * GET /merchant/credits
 *
 * Returns the merchant's tenant credit balance and recent ledger transactions.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const ledger = getLedger(req.scope)
  const balance = await ledger.balance(ctx.tenant.id).catch(() => 0)
  // Raw ledger rows are internals: every AI action writes reserve+commit pairs,
  // which read as duplicated noise. A merchant's history is (a) credits ARRIVING
  // (top-ups, plan grants, refunds, expiry) shown individually, and (b) SPEND
  // aggregated per day+feature ("AI images · 3 uses · −36").
  const raw = await ctx.svc.listCreditTransactions(
    { tenant_id: ctx.tenant.id },
    { take: 2000, order: { created_at: "DESC" } }
  )

  const LABELS: Record<string, string> = {
    ai_call_minute: "AI calls (web)",
    ai_call_phone_minute: "AI calls (phone)",
    phone_number_month: "Phone number rental",
    sms_segment: "SMS",
    ai_text: "AI text & chatbot",
    ai_page_edit: "AI page edits",
    ai_content: "AI content & blogs",
    ai_image: "AI images",
    ai_logo: "AI logos",
    ai_image_basic: "AI images (basic)",
    email_batch: "Emails",
    email: "Emails",
    domain_purchase_usd: "Domains",
  }

  type Row = { id: string; kind: "in" | "out"; label: string; amount: number; created_at: string }
  const rows: Row[] = []
  const spendByDayAction = new Map<string, { credits: number; uses: number; last: string; action: string }>()

  for (const t of raw || []) {
    const amt = Number(t.amount ?? 0)
    if (t.type === "grant" || t.type === "topup" || t.type === "refund") {
      const src = (t.meta as any)?.reason === "plan_allowance" ? "Monthly plan credits" :
        t.type === "topup" ? "Credits purchased" :
        t.type === "refund" ? "Refund" : "Credits granted"
      rows.push({ id: t.id, kind: "in", label: src, amount: amt, created_at: t.created_at })
    } else if (t.type === "adjust" && (t.meta as any)?.reason === "credit_expiry") {
      rows.push({ id: t.id, kind: "out", label: "Plan credits expired", amount: amt, created_at: t.created_at })
    } else if (t.type === "commit" || t.type === "clawback") {
      const action = t.action || "usage"
      const day = String(t.created_at).slice(0, 10)
      const key = `${day}:${action}`
      const agg = spendByDayAction.get(key) ?? { credits: 0, uses: 0, last: t.created_at, action }
      agg.credits += Math.abs(amt)
      agg.uses += 1
      spendByDayAction.set(key, agg)
    }
    // reserve/release pairs are invisible on purpose: they cancel out.
  }

  for (const [key, agg] of spendByDayAction) {
    rows.push({
      id: `spend_${key}`,
      kind: "out",
      label: `${LABELS[agg.action] ?? agg.action} · ${agg.uses} use${agg.uses === 1 ? "" : "s"}`,
      amount: -agg.credits,
      created_at: agg.last,
    })
  }

  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  // Pagination — a busy merchant generates a lot of activity.
  const limit = Math.min(100, Math.max(5, Number((req.query as any).limit) || 20))
  const offset = Math.max(0, Number((req.query as any).offset) || 0)
  const transactions = rows.slice(offset, offset + limit)

  res.json({
    tenant_id: ctx.tenant.id,
    balance: Number(balance),
    trial_ends_at: ctx.tenant.trial_ends_at ?? null,
    transactions,
    count: rows.length,
    limit,
    offset,
    has_more: offset + limit < rows.length,
  })
}

/**
 * POST /merchant/credits  { credits, amount_usd }
 *
 * Create a checkout session to buy more credits. Returns a redirect URL for the
 * gateway configured for the tenant's billing country (Stripe global, SSLCommerz
 * for Bangladesh). The gateway is fully wired only when its env keys are set.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const credits = Math.max(1, Math.min(1000000, Math.floor(Number(body.credits) || 0)))
  const amountUsd = Math.max(1, Math.min(10000, Number(body.amount_usd) || Math.ceil(credits / 100)))

  if (!credits) return res.status(400).json({ message: "credits required" })

  const country = ctx.tenant.billing_country || "US"
  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry(country, cfg)
  const configured = await gateway.isConfigured()
  if (!gateway || !configured) {
    return res.status(503).json({
      message: "No payment gateway is configured for your region",
      gateway: gateway?.name,
      configured,
    })
  }

  const slug = ctx.tenant.slug
  const base = `https://${slug}.mautomate.ai`
  const result = await gateway.createTopupCheckout({
    tenant_id: ctx.tenant.id,
    credits,
    amount_usd: amountUsd,
    success_url: `${base}/merchant/credits?topup=success`,
    cancel_url: `${base}/merchant/credits?topup=cancel`,
  })

  if (!result.ok) {
    return res.status(500).json({ message: result.error || "checkout_failed" })
  }

  res.status(201).json({
    checkout_url: result.data?.url,
    checkout_id: result.data?.id,
    provider: result.data?.provider,
    credits,
    amount_usd: amountUsd,
  })
}
