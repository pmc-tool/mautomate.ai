import { PLATFORM_MODULE } from ".."

export type CommissionSource = "subscription" | "renewal" | "topup" | "manual"

/**
 * accruePartnerCommission — the single place partner earnings are created.
 *
 * Called (best-effort, never throwing into the caller) wherever real money
 * comes in for a tenant. Resolves the tenant's referral -> active partner ->
 * commission_pct, and appends a pending partner_commission row. Idempotent on
 * `sourceRef` (partial unique index): a retried Stripe webhook can never
 * double-accrue. All amounts are integer CENTS.
 *
 * Returns the created row, or null when the tenant was not referred, the
 * partner is inactive/zero-pct, the base is zero, or the accrual already exists.
 */
export async function accruePartnerCommission(
  scope: { resolve: (key: string) => any },
  args: {
    tenantId: string
    source: CommissionSource
    sourceRef?: string | null
    baseCents: number
    meta?: Record<string, unknown> | null
  }
): Promise<any | null> {
  const baseCents = Math.round(Number(args.baseCents) || 0)
  if (!args.tenantId || baseCents <= 0) return null

  const svc: any = scope.resolve(PLATFORM_MODULE)

  const [referral] = await svc
    .listPartnerReferrals({ tenant_id: args.tenantId }, { take: 1 })
    .catch(() => [])
  if (!referral) return null

  const partner = await svc.retrievePartner(referral.partner_id).catch(() => null)
  if (!partner || partner.status !== "active") return null

  const pct = Math.round(Number(partner.commission_pct) || 0)
  if (pct <= 0) return null

  const amountCents = Math.round((baseCents * pct) / 100)
  if (amountCents <= 0) return null

  try {
    const [row] = await svc.createPartnerCommissions([
      {
        partner_id: partner.id,
        tenant_id: args.tenantId,
        source: args.source,
        source_ref: args.sourceRef ?? null,
        base_cents: baseCents,
        pct,
        amount_cents: amountCents,
        status: "pending",
        meta: (args.meta ?? null) as any,
      },
    ])
    return row
  } catch {
    // Unique violation on source_ref -> this event already accrued. Fine.
    return null
  }
}
