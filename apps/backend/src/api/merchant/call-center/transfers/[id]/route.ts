import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import { resolveMerchant } from "../../../_helpers"

/**
 * POST /merchant/call-center/transfers/:id  { action: "answer" | "decline" }
 *
 * Answer: for a WEB call the human joins the caller's EXISTING Daily room —
 * we mint a short-lived meeting token and flip the row to answered (the voice
 * runtime sees that on its next poll, tells the caller "you're connected",
 * and bows out). First-answer-wins: only a `ringing` row can be answered, so
 * two staff clicking simultaneously can't double-join by accident (the loser
 * gets a 409).
 *
 * Phone-channel rows return 501 until the live phone rollout — the browser
 * answer path for phone legs needs the carrier media bridge.
 */

const DAILY_API = "https://api.daily.co/v1"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params
  const action = String((req.body as any)?.action ?? "")

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const row = await cc.retrieveTransfer(id).catch(() => null)
    if (!row || row.tenant_id !== ctx.merchant.tenant_id) {
      return res.status(404).json({ message: "Transfer not found" })
    }

    if (action === "decline") {
      if (row.status === "ringing") {
        await cc.updateTransfers({
          id,
          status: "declined",
          answered_by: ctx.merchant.id,
        })
      }
      return res.json({ transfer_id: id, status: "declined" })
    }

    if (action !== "answer") {
      return res.status(400).json({ message: "action must be answer or decline" })
    }

    if (row.status !== "ringing") {
      return res.status(409).json({
        message:
          row.status === "answered"
            ? "Someone on your team already answered this call."
            : "This call is no longer ringing.",
      })
    }

    if (row.channel !== "web" || !row.room_name) {
      return res.status(501).json({
        message:
          "Answering phone calls in the browser arrives with the live phone rollout — this call can't be picked up here yet.",
      })
    }

    const dailyKey = process.env.DAILY_API_KEY
    if (!dailyKey) {
      return res.status(503).json({ message: "Voice service unavailable." })
    }

    // Resolve the live room URL from Daily — doubles as a liveness check (a
    // deleted/expired room means the caller already hung up).
    let roomUrl = row.room_url ?? ""
    if (!roomUrl) {
      try {
        const rr = await fetch(DAILY_API + "/rooms/" + encodeURIComponent(row.room_name), {
          headers: { Authorization: "Bearer " + dailyKey },
          signal: AbortSignal.timeout(8000),
        })
        if (rr.status === 404) {
          await cc.updateTransfers({ id, status: "canceled" })
          return res.status(410).json({ message: "The caller already hung up." })
        }
        const rj: any = await rr.json().catch(() => ({}))
        roomUrl = rj?.url ?? ""
      } catch {
        /* fall through to the missing-room error below */
      }
      if (!roomUrl) {
        return res.status(503).json({ message: "Could not join the call — please try again." })
      }
    }
    let token = ""
    try {
      const r = await fetch(`${DAILY_API}/meeting-tokens`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dailyKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            room_name: row.room_name,
            exp: Math.floor(Date.now() / 1000) + 3600,
            is_owner: true,
          },
        }),
        signal: AbortSignal.timeout(8000),
      })
      const json: any = await r.json().catch(() => ({}))
      token = json?.token ?? ""
      if (!r.ok || !token) throw new Error(`daily ${r.status}`)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[call-center] transfer answer: token mint failed:", e)
      return res.status(503).json({
        message: "Could not join the call — please try again.",
      })
    }

    await cc.updateTransfers({
      id,
      status: "answered",
      answered_by: ctx.merchant.id,
    })

    res.json({
      transfer_id: id,
      status: "answered",
      room_url: roomUrl,
      token,
      caller_number: row.caller_number,
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to update transfer" })
  }
}
