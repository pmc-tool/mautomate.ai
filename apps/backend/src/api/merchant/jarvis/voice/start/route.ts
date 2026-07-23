import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import { resolveMerchant } from "../../../_helpers"
import { JARVIS_VOICE_PLAYBOOK_ID } from "../../_voice"

/**
 * POST /merchant/jarvis/voice/start
 *
 * Start a live VOICE conversation with the merchant's Pixi assistant in the
 * browser (Daily WebRTC), reusing the pipecat voice runtime. Mirrors the
 * call-center test-call flow but pinned to the reserved "jarvis" playbook, so
 * the runtime pulls the Pixi agent-config (Pixi brain + tools + cheap
 * providers) and every in-call tool call routes to the Pixi bridge.
 *
 * TENANT ISOLATION: the tenant is the AUTHENTICATED merchant session's, stamped
 * onto the call row here. The browser never supplies it, and tool-execute
 * re-derives it from that call row — a voice session can only ever touch this
 * merchant's store.
 *
 * Response: { call_id, room_url, token, bot_dispatched }
 */

const DAILY_API = "https://api.daily.co/v1"
const DISPATCH_TIMEOUT_MS = 6000

const dailyPost = async (
  path: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<any> => {
  const r = await fetch(`${DAILY_API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const detail = await r.text().catch(() => "")
    throw new Error(`Daily ${path} failed (${r.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`)
  }
  return r.json()
}

const dispatchBot = async (body: Record<string, unknown>): Promise<boolean> => {
  const rawUrl = process.env.VOICE_AGENT_URL
  const apiKey = process.env.VOICE_AGENT_API_KEY
  if (!rawUrl) {
    // eslint-disable-next-line no-console
    console.warn("[jarvis-voice] start: VOICE_AGENT_URL unset — room created but no bot dispatched.")
    return false
  }
  const url = `${rawUrl.replace(/\/+$/, "")}/api/pipelines/start`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(`[jarvis-voice] start: voice runtime returned ${r.status}.`)
      return false
    }
    return true
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[jarvis-voice] start: dispatch failed:", e)
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

  const dailyKey = process.env.DAILY_API_KEY
  if (!dailyKey) {
    // eslint-disable-next-line no-console
    console.error("[jarvis-voice] start: DAILY_API_KEY is not configured.")
    return res.status(503).json({
      message:
        "Voice chat isn't available right now — the voice service is not configured. Please try again later.",
    })
  }

  const locale =
    (ctx.tenant.meta?.default_locale as string) ||
    (ctx.tenant.meta?.locale as string) ||
    "en"

  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const now = Math.floor(Date.now() / 1000)

    let room: any
    try {
      room = await dailyPost("/rooms", dailyKey, {
        properties: {
          exp: now + 3600,
          max_participants: 2,
          enable_chat: false,
          start_video_off: true,
          enable_screenshare: false,
        },
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[jarvis-voice] start: room creation failed:", e)
      return res.status(503).json({
        message:
          "Couldn't start voice chat — the voice service is temporarily unavailable. Please try again in a moment.",
      })
    }

    const room_url: string = room?.url
    const room_name: string = room?.name
    if (!room_url || !room_name) {
      return res.status(503).json({
        message: "Couldn't start voice chat — the voice service returned an unexpected response.",
      })
    }

    let token: string
    try {
      const minted = await dailyPost("/meeting-tokens", dailyKey, {
        properties: { room_name, exp: now + 1800, is_owner: true },
      })
      token = minted?.token
      if (!token) throw new Error("missing token")
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[jarvis-voice] start: token minting failed:", e)
      return res.status(503).json({
        message:
          "Couldn't start voice chat — the voice service is temporarily unavailable. Please try again in a moment.",
      })
    }

    // Track the session as a call row. playbook_id "jarvis" is what routes the
    // runtime to the Pixi brain (agent-config) and the Pixi tool bridge
    // (tool-execute). tenant_id is the merchant session's — never the client's.
    const call = await cc.createCalls({
      tenant_id,
      direction: "inbound",
      status: "in_progress",
      locale,
      playbook_id: JARVIS_VOICE_PLAYBOOK_ID,
      provider_call_id: room_name,
      started_at: new Date(),
    })
    const call_id: string = call?.id

    const bot_dispatched = await dispatchBot({
      call_id,
      playbook_id: JARVIS_VOICE_PLAYBOOK_ID,
      tenant_id,
      room_url,
      room_name,
      locale,
    })

    return res.status(201).json({ call_id, room_url, token, bot_dispatched })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[jarvis-voice] start: failed:", e)
    return res.status(500).json({ message: e?.message ?? "Failed to start voice chat" })
  }
}
