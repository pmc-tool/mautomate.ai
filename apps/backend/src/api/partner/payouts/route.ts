import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePartner, sumCents } from "../_helpers"

/** Minimum payout balance: $10.00. */
const MIN_PAYOUT_CENTS = 1000

/**
 * GET /partner/payouts — the partner's payout history + requestable balance.
 * Response: { payouts, requestable_cents, min_cents }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolvePartner(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { partner, svc } = ctx

  const [payouts, open] = await Promise.all([
    svc.listPartnerPayouts(
      { partner_id: partner.id },
      { take: 200, order: { created_at: "DESC" } }
    ),
    svc.listPartnerCommissions(
      { partner_id: partner.id, status: "pending", payout_id: null },
      { take: 5000 }
    ),
  ])

  res.json({
    payouts: payouts || [],
    requestable_cents: sumCents(open || []),
    min_cents: MIN_PAYOUT_CENTS,
  })
}

/**
 * POST /partner/payouts — request a payout of the FULL open pending balance.
 * Bundles every pending, not-yet-requested commission into one payout row and
 * stamps their payout_id (so they can't be double-requested). The operator
 * then marks the payout paid or rejected from the console.
 *
 * Body: { method? } — free-text payout details (bank/PayPal); also persisted
 * on the partner as their default. Response: { payout }
 */
export const POST = async (
  req: MedusaRequest<{ method?: string }>,
  res: MedusaResponse
) => {
  const ctx = await resolvePartner(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { partner, svc } = ctx

  const method =
    String(req.body?.method ?? "").trim() ||
    String(partner.payout_method ?? "").trim()
  if (!method) {
    return res.status(400).json({
      message: "Add payout details (bank / PayPal / etc.) before requesting a payout.",
    })
  }

  const open = await svc.listPartnerCommissions(
    { partner_id: partner.id, status: "pending", payout_id: null },
    { take: 5000 }
  )
  const amount = sumCents(open || [])
  if (amount < MIN_PAYOUT_CENTS) {
    return res.status(400).json({
      message: `Your open balance is below the $${(MIN_PAYOUT_CENTS / 100).toFixed(2)} payout minimum.`,
    })
  }

  const [payout] = await svc.createPartnerPayouts([
    {
      partner_id: partner.id,
      amount_cents: amount,
      status: "requested",
      method,
    },
  ])

  await svc.updatePartnerCommissions(
    (open || []).map((c: any) => ({ id: c.id, payout_id: payout.id }))
  )

  // Remember the payout details for next time.
  if (method !== partner.payout_method) {
    await svc.updatePartners({ id: partner.id, payout_method: method }).catch(() => undefined)
  }

  res.status(201).json({ payout })
}
