import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../_helpers"
import { listPendingVoiceActions } from "../../_voice"

/**
 * GET /merchant/jarvis/voice/pending
 *
 * List the actions Pixi PROPOSED over voice that are still awaiting the
 * merchant's confirmation — the voice half of the confirm gate. Voice never
 * executes a write; it queues a signed, tenant-bound plan token here, and the
 * merchant applies it with a tap (soft) or a typed confirm word (hard) via the
 * existing POST /merchant/jarvis/apply. Tenant-scoped: only THIS store's
 * proposals, unexpired and not yet applied.
 *
 * Response: { pending: [{ id, action, tier, require_text, summary, token, exp,
 *             call_id, created_at }] }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.tenant?.id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  try {
    const rows = await listPendingVoiceActions(req.scope, tenant_id)
    const pending = rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      tier: r.tier,
      require_text: r.require_text ?? null,
      summary: r.summary,
      token: r.token,
      exp: Number(r.exp),
      call_id: r.call_id ?? null,
      created_at: r.created_at,
    }))
    return res.json({ pending })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[jarvis-voice] pending: failed:", e)
    return res.json({ pending: [] })
  }
}
