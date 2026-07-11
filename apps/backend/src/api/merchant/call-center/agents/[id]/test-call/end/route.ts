import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../../../../modules/call-center"
import CallCenterModuleService from "../../../../../../../modules/call-center/service"
import { resolveMerchant } from "../../../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

const STOP_TIMEOUT_MS = 6000

/**
 * No-throw, timeout-bounded stop signal to the voice runtime. Never throws — a
 * failed stop must not block us from marking the call ended locally.
 */
const stopBot = async (call_id: string, tenant_id: string): Promise<boolean> => {
  const rawUrl = process.env.VOICE_AGENT_URL
  const apiKey = process.env.VOICE_AGENT_API_KEY
  if (!rawUrl) return false
  const url = `${rawUrl.replace(/\/+$/, "")}/api/pipelines/stop`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STOP_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({ call_id, tenant_id }),
      signal: controller.signal,
    })
    return res.ok
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[call-center] test-call/end: voice runtime stop failed:", e)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * POST /merchant/call-center/agents/:id/test-call/end
 *
 * End an in-progress browser test call. Tenant-scoped and fail-closed: the
 * call row must exist, belong to the caller's tenant AND to this agent. Signals
 * the voice runtime to tear down the bot (best-effort) and marks the call row
 * completed. Body: { call_id }. Response: { call_id, ended: true }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.tenant?.id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const { id } = req.params
  const call_id = (req.body as any)?.call_id
  if (!call_id || typeof call_id !== "string") {
    return res.status(400).json({ message: "`call_id` is required." })
  }

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    // Cross-tenant guard: the call must be owned by this tenant AND this agent.
    const call = await (cc as any).retrieveCall(call_id).catch(() => null)
    if (
      !call ||
      call.tenant_id !== tenant_id ||
      (call.playbook_id && call.playbook_id !== id)
    ) {
      return res.status(404).json({ message: `Call ${call_id} was not found` })
    }

    // Best-effort teardown of the bot; we still mark the call ended regardless.
    await stopBot(call_id, tenant_id)

    await (cc as any).updateCalls({
      id: call_id,
      status: "completed",
      ended_at: new Date(),
    })

    return res.json({ call_id, ended: true })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[call-center] test-call/end: failed:", e)
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to end test call",
    })
  }
}
