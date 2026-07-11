import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../../modules/call-center"
import CallCenterModuleService from "../../../../../../modules/call-center/service"
import { resolveMerchant } from "../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

const DAILY_API = "https://api.daily.co/v1"
const DISPATCH_TIMEOUT_MS = 6000

/**
 * Load an agent (playbook) and assert tenant ownership. Fail-closed: a missing
 * row OR any tenant_id not STRICTLY equal to the caller's tenant 404s. This is
 * the cross-tenant guard.
 */
const loadOwnedAgent = async (
  cc: CallCenterModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const agent = await (cc as any).retrievePlaybook(id).catch(() => null)
  if (!agent || agent.tenant_id !== tenantId) {
    res.status(404).json({ message: `Agent ${id} was not found` })
    return null
  }
  return agent
}

/** Resolve the agent's live PlaybookVersion (its current definition), if any. */
const loadCurrentVersion = async (
  cc: CallCenterModuleService,
  agent: any
): Promise<any | null> => {
  if (agent.current_version_id) {
    const v = await (cc as any)
      .retrievePlaybookVersion(agent.current_version_id)
      .catch(() => null)
    if (v) return v
  }
  const versions = await (cc as any).listPlaybookVersions(
    { playbook_id: agent.id, tenant_id: agent.tenant_id },
    { take: 1, order: { version: "DESC" } }
  )
  return Array.isArray(versions) && versions.length ? versions[0] : null
}

/** Pull the agent's spoken language out of its definition, defaulting to "en". */
const resolveLocale = (definition: Record<string, any> | undefined): string => {
  const d = definition ?? {}
  return d?.voice?.language || d?.persona?.language || d?.language || "en"
}

/**
 * Authenticated POST to the Daily REST API. Throws a clean Error on any
 * non-2xx so the caller can surface a friendly 503.
 */
const dailyPost = async (
  path: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<any> => {
  const res = await fetch(`${DAILY_API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      `Daily ${path} failed (${res.status})${
        detail ? `: ${detail.slice(0, 300)}` : ""
      }`
    )
  }
  return res.json()
}

/**
 * No-throw, timeout-bounded dispatch to the voice runtime. Returns true on a
 * 2xx, false on any non-2xx / network / timeout / missing-config (never throws).
 */
const dispatchBot = async (body: Record<string, unknown>): Promise<boolean> => {
  const rawUrl = process.env.VOICE_AGENT_URL
  const apiKey = process.env.VOICE_AGENT_API_KEY
  if (!rawUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      "[call-center] test-call: VOICE_AGENT_URL unset — room created but no bot dispatched."
    )
    return false
  }
  const url = `${rawUrl.replace(/\/+$/, "")}/api/pipelines/start`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[call-center] test-call: voice runtime start returned ${res.status}.`
      )
      return false
    }
    return true
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[call-center] test-call: voice runtime dispatch failed:", e)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * POST /merchant/call-center/agents/:id/test-call
 *
 * Start a browser-based test call: the merchant TALKS to their AI voice agent
 * live in the browser (Daily WebRTC). This:
 *   1. Loads the agent (tenant-scoped, fail-closed) and requires a saved
 *      (published or current) version to drive the conversation.
 *   2. Creates a short-lived, 2-participant Daily room + an owner meeting token.
 *   3. Inserts a `call_center_call` row (direction "inbound", in_progress) so
 *      the test call is tracked like any other call.
 *   4. Best-effort dispatches the voice-runtime bot into the room.
 *
 * Response: { call_id, room_url, token, bot_dispatched }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.tenant?.id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const { id } = req.params

  const dailyKey = process.env.DAILY_API_KEY
  if (!dailyKey) {
    // eslint-disable-next-line no-console
    console.error("[call-center] test-call: DAILY_API_KEY is not configured.")
    return res.status(503).json({
      message:
        "Live test calls are not available right now — the voice service is not configured. Please try again later.",
    })
  }

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const agent = await loadOwnedAgent(cc, id, tenant_id, res)
    if (!agent) return

    const version = await loadCurrentVersion(cc, agent)
    if (!version || !version.definition) {
      return res.status(400).json({
        message:
          "This agent has no saved training yet. Save (or publish) the agent before starting a test call.",
      })
    }

    const locale = resolveLocale(version.definition)
    const now = Math.floor(Date.now() / 1000)

    // 1. Create a short-lived, 2-participant, audio-only Daily room.
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
      console.error("[call-center] test-call: room creation failed:", e)
      return res.status(503).json({
        message:
          "Could not start the test call — the voice service is temporarily unavailable. Please try again in a moment.",
      })
    }

    const room_url: string = room?.url
    const room_name: string = room?.name
    if (!room_url || !room_name) {
      return res.status(503).json({
        message:
          "Could not start the test call — the voice service returned an unexpected response.",
      })
    }

    // 2. Mint an owner meeting token for the merchant's browser.
    let token: string
    try {
      const minted = await dailyPost("/meeting-tokens", dailyKey, {
        properties: {
          room_name,
          exp: now + 1800,
          is_owner: true,
        },
      })
      token = minted?.token
      if (!token) throw new Error("missing token")
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[call-center] test-call: token minting failed:", e)
      return res.status(503).json({
        message:
          "Could not start the test call — the voice service is temporarily unavailable. Please try again in a moment.",
      })
    }

    // 3. Track the call. provider_call_id = the Daily room name (its coord).
    const call = await (cc as any).createCalls({
      tenant_id,
      direction: "inbound",
      status: "in_progress",
      locale,
      playbook_id: id,
      playbook_version:
        version?.version != null ? String(version.version) : null,
      provider_call_id: room_name,
      started_at: new Date(),
    })
    const call_id: string = call?.id

    // 4. Best-effort: dispatch the bot into the room.
    const bot_dispatched = await dispatchBot({
      call_id,
      playbook_id: id,
      tenant_id,
      room_url,
      room_name,
      locale,
    })

    return res.status(201).json({ call_id, room_url, token, bot_dispatched })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[call-center] test-call: failed:", e)
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to start test call",
    })
  }
}
