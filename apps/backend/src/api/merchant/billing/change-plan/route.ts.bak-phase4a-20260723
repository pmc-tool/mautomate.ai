import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { getLedger } from "../../../../modules/platform/credits/metering"

/**
 * POST /merchant/billing/change-plan  { key }
 *
 * Self-serve subscription change. Card-based recurring checkout is not wired
 * yet, so (per the operator's decision) an upgrade/downgrade is APPLIED
 * IMMEDIATELY at no charge: the tenant's package switches on the spot, and when
 * moving to a plan with a larger monthly allowance the extra included credits
 * are granted to the wallet (never removed on a downgrade). The grant is
 * idempotent per (plan, calendar-month), so re-picking a plan can't farm
 * credits. When Stripe subscription checkout lands, gate this behind payment
 * (return a `checkout_url` and only apply on webhook confirmation).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const key = String((req.body as any)?.key ?? "").trim()
  if (!key) return res.status(400).json({ message: "plan key required" })

  const plan = (
    await ctx.svc.listPlatformPackages({ key }, { take: 1 }).catch(() => [])
  )[0]
  if (!plan) return res.status(400).json({ message: "unknown plan" })

  if (plan.key === ctx.tenant.package) {
    return res.status(400).json({ message: "You are already on this plan." })
  }

  const current = (
    await ctx.svc
      .listPlatformPackages({ key: ctx.tenant.package }, { take: 1 })
      .catch(() => [])
  )[0]

  const newIncluded = Number(plan.included_credits ?? 0)
  const oldIncluded = Number(current?.included_credits ?? 0)
  // Only ever add credits (the increase in monthly allowance); never claw back
  // on a downgrade.
  const grant = Math.max(0, newIncluded - oldIncluded)

  // 1) Apply the package switch immediately. Clear any stale "requested_*" hints
  //    from the old request-only flow and stamp when/what changed.
  const meta: Record<string, unknown> = {
    ...((ctx.tenant.meta as Record<string, unknown>) || {}),
    package_changed_at: new Date().toISOString(),
    package_changed_from: ctx.tenant.package,
  }
  delete meta.requested_package
  delete meta.requested_package_at
  await ctx.svc.updateTenants({ id: ctx.tenant.id, package: key, meta })

  // 2) Top up the wallet to the higher allowance (upgrade only). One grant per
  //    (plan, month) via the idempotency key so double-clicks / re-picks can't
  //    farm credits. Keep the denormalized tenant.credit_balance in sync, as
  //    the super-admin setPackage path does.
  let balance: number | undefined
  if (grant > 0) {
    const cycle = new Date().toISOString().slice(0, 7) // YYYY-MM
    balance = await getLedger(req.scope)
      .credit(ctx.tenant.id, grant, {
        type: "grant",
        idempotencyKey: `plan-allowance:${ctx.tenant.id}:${key}:${cycle}`,
        meta: { reason: "plan_upgrade_allowance", plan: key },
      })
      .catch(() => undefined)
    if (typeof balance === "number") {
      await ctx.svc
        .updateTenants({ id: ctx.tenant.id, credit_balance: balance })
        .catch(() => {})
    }
  }

  return res.status(200).json({
    ok: true,
    plan: {
      key: plan.key,
      name: plan.name,
      price_usd: Number(plan.price_usd ?? 0),
      included_credits: newIncluded,
    },
    credits_granted: grant,
    balance,
    message:
      grant > 0
        ? `You're now on ${plan.name}. ${grant.toLocaleString()} credits were added for the new monthly allowance.`
        : `You're now on ${plan.name}.`,
  })
}
