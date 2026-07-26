import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLedger } from "../../../../modules/platform/credits/metering"
import { resolveMerchant } from "../../_helpers"

/**
 * POST /merchant/credits/transfer  { to_store_id, credits }
 *
 * Move PURCHASED credits from the ACTIVE store (the session's store context)
 * to another store the SAME login owns (multi-store M3). Plan/trial
 * allowances never move — only never-expiring topup credits. Both sides of
 * the ownership are validated here; the ledger does the atomic money work.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const b = (req.body ?? {}) as Record<string, any>

  const toStoreId = String(b.to_store_id ?? "").trim()
  const credits = Math.round(Number(b.credits) || 0)

  try {
    if (!toStoreId || toStoreId === ctx.tenant.id) {
      return res
        .status(400)
        .json({ message: "Pick a different store of yours to move credits to." })
    }
    if (credits < 1 || credits > 1_000_000) {
      return res.status(400).json({ message: "Enter a credit amount to move." })
    }

    // The destination must be a store THIS login owns (same iron rule as
    // store context — the link table is the sole grant).
    const grants = await ctx.svc
      .listMerchantStores(
        { merchant_id: ctx.merchant.id, tenant_id: toStoreId },
        { take: 1 }
      )
      .catch(() => [])
    if (!(Array.isArray(grants) ? grants : [grants]).filter(Boolean).length) {
      console.warn(
        `[credit-transfer] DENIED merchant=${ctx.merchant.id} to=${toStoreId}`
      )
      return res.status(403).json({ message: "That store is not yours." })
    }
    const toTenant = await ctx.svc.retrieveTenant(toStoreId).catch(() => null)
    if (!toTenant || ["purged", "failed"].includes(toTenant.status)) {
      return res.status(404).json({ message: "That store no longer exists." })
    }

    const ledger = getLedger(req.scope)
    const out = await ledger.transfer(ctx.tenant.id, toStoreId, credits, {
      idempotencyKey: b.idempotency_key
        ? `xfer_${String(b.idempotency_key).slice(0, 40)}`
        : undefined,
    })
    if (!out.ok) {
      return res.status(400).json({
        message:
          out.reason === "insufficient_purchased"
            ? "Only purchased credits can move between stores - this store does not have that many purchased credits."
            : "Not enough available credits (some may be reserved by running jobs).",
        reason: out.reason,
      })
    }

    res.json({
      transferred: credits,
      from: { store_id: ctx.tenant.id, balance: out.from_balance },
      to: { store_id: toStoreId, balance: out.to_balance },
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Transfer failed" })
  }
}
