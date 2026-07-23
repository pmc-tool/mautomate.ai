import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import { resolveMerchant } from "../../../_helpers"
import { JARVIS_VOICE_PLAYBOOK_ID } from "../../_voice"

/**
 * POST /merchant/jarvis/voice/stop — end an in-progress Pixi voice session.
 *
 * Tenant-scoped, fail-closed: the call row must exist, belong to the caller's
 * tenant, and be a "jarvis" session. Signals the voice runtime to tear down the
 * bot (best-effort) and marks the call completed. Body: { call_id }.
 */

const STOP_TIMEOUT_MS = 6000

const stopBot = async (call_id: string, tenant_id: string): Promise<boolean> => {
  const rawUrl = process.env.VOICE_AGENT_URL
  const apiKey = process.env.VOICE_AGENT_API_KEY
  if (!rawUrl) return false
  const url = `${rawUrl.replace(/\/+$/, "")}/api/pipelines/stop`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STOP_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({ call_id, tenant_id }),
      signal: controller.signal,
    })
    return r.ok
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[jarvis-voice] stop: voice runtime stop failed:", e)
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.tenant?.id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const call_id = (req.body as any)?.call_id
  if (!call_id || typeof call_id !== "string") {
    return res.status(400).json({ message: "`call_id` is required." })
  }

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const call = await cc.retrieveCall(call_id).catch(() => null)
    if (
      !call ||
      call.tenant_id !== tenant_id ||
      call.playbook_id !== JARVIS_VOICE_PLAYBOOK_ID
    ) {
      return res.status(404).json({ message: `Voice session ${call_id} was not found` })
    }

    await stopBot(call_id, tenant_id)
    await cc.updateCalls({ id: call_id, status: "completed", ended_at: new Date() })

    return res.json({ call_id, ended: true })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[jarvis-voice] stop: failed:", e)
    return res.status(500).json({ message: e?.message ?? "Failed to end voice chat" })
  }
}
