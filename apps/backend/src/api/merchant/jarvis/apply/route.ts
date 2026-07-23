import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"
import { verifyPlan, planNonce, signPlan } from "../_plan-token"
import { WRITE_BY_NAME } from "../_writes"

/**
 * POST /merchant/jarvis/apply — execute a confirmed Pixi write.
 *
 * The streaming run proposed the action and handed the browser a signed plan
 * token; the merchant confirmed and the panel posts it here. No LLM runs on this
 * path — the args were frozen at propose time, so the model can't change what
 * executes between "you approved this" and "this ran".
 *
 * Safety layers, in order:
 *   1. verifyPlan  — HMAC + expiry; a tampered/expired token is rejected.
 *   2. tenant bind — plan.tid must equal the live session tenant (no cross-store
 *      replay, the same hole we closed on editor tokens).
 *   3. hard tier   — money/destructive actions require the typed confirm word.
 *   4. single use  — the plan nonce is claimed atomically in jarvis_audit BEFORE
 *      the action runs; a replay inserts 0 rows and is refused, so a refund can
 *      never fire twice off one confirmation.
 * Every attempt is recorded in jarvis_audit (the row IS the audit trail).
 */

const friendly = (e: any): string => {
  const m = String(e?.message ?? e ?? "")
  if (/insufficient|not allowed|cannot|invalid/i.test(m)) return m.slice(0, 200)
  return "That didn't go through. Nothing was changed — try again in a moment."
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ ok: false, message: "not authorized" })

  const body = (req.body ?? {}) as { token?: string; confirm_text?: string }
  const token = String(body.token ?? "")
  const confirmText = String(body.confirm_text ?? "").trim()

  const v = verifyPlan(token)
  if (!v.ok) return res.status(400).json({ ok: false, message: v.error })
  const plan = v.plan

  // Tenant-bound: a token minted for one store cannot be applied against another.
  if (plan.tid !== ctx.tenant.id) {
    return res
      .status(403)
      .json({ ok: false, message: "This confirmation belongs to a different store." })
  }

  const write = WRITE_BY_NAME[plan.action]
  if (!write) {
    return res.status(400).json({ ok: false, message: "That action isn't available." })
  }

  // Hard tier requires the typed confirm word (e.g. REFUND).
  if (plan.tier === "hard") {
    const need = String(plan.requireText || write.requireText || "").toUpperCase()
    if (!need || confirmText.toUpperCase() !== need) {
      return res.status(400).json({
        ok: false,
        message: need ? `Type ${need} to confirm.` : "Confirmation required.",
      })
    }
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const nonce = planNonce(token)

  // (4) Atomic single-use claim. onConflict.ignore().returning() yields one row
  // on a fresh claim and zero on a replay — so a double-submit is refused here,
  // before the action ever runs.
  let claimed = false
  try {
    const rows = await pg("jarvis_audit")
      .insert({
        nonce,
        tenant_id: ctx.tenant.id,
        action: plan.action,
        tier: plan.tier,
        args: JSON.stringify(plan.args ?? {}),
        summary: plan.summary ?? "",
      })
      .onConflict("nonce")
      .ignore()
      .returning("nonce")
    claimed = Array.isArray(rows) && rows.length > 0
  } catch (e: any) {
    // Never run a money action if we couldn't record it.
    // eslint-disable-next-line no-console
    console.error("[jarvis:apply] audit claim failed:", e?.message ?? e)
    return res
      .status(500)
      .json({ ok: false, message: "Couldn't start that safely. Try again." })
  }
  if (!claimed) {
    return res
      .status(409)
      .json({ ok: false, message: "That was already done." })
  }

  try {
    const out = await write.apply(req, ctx as any, plan.args as any)

    let resultJson: string | null = null
    try {
      resultJson = JSON.stringify(out?.result ?? null)
    } catch {
      resultJson = null
    }
    await pg("jarvis_audit")
      .where({ nonce })
      .update({ ok: true, result: resultJson })
      .catch(() => {})

    // Offer an Undo when the tool exposes a reversible compensation: mint a fresh
    // SOFT (one-tap) plan token for the undo action and hand it back, so undo
    // flows through the exact same confirm gate.
    let undo: { token: string; label: string } | null = null
    const u = out?.undo as any
    if (u && u.action && u.apply_args && WRITE_BY_NAME[u.action]) {
      try {
        const { token: ut } = signPlan({
          tid: ctx.tenant.id,
          action: u.action,
          args: u.apply_args,
          tier: "soft",
          summary: `Undo: ${plan.summary}`,
        })
        undo = { token: ut, label: "Undo" }
      } catch {
        undo = null
      }
    }

    return res.status(200).json({
      ok: true,
      action: plan.action,
      message: plan.summary,
      undo,
    })
  } catch (e: any) {
    await pg("jarvis_audit")
      .where({ nonce })
      .update({ ok: false, error: String(e?.message ?? e).slice(0, 500) })
      .catch(() => {})
    // eslint-disable-next-line no-console
    console.error("[jarvis:apply] action failed:", plan.action, e?.message ?? e)
    return res.status(200).json({ ok: false, message: friendly(e) })
  }
}
