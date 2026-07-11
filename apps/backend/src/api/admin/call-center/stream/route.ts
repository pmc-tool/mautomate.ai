import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")
const TICK_MS = 2000

// Live states we surface on the wire: calls that are actively moving and tasks
// still waiting to be dialed. Terminal states (completed/failed/done/...) are
// intentionally excluded so the queue only shows what needs attention.
const LIVE_CALL_STATUSES = ["queued", "dialing", "in_progress"]
const LIVE_TASK_STATUSES = ["scheduled", "claimed", "in_progress"]

/**
 * GET /admin/call-center/stream
 *
 * Server-Sent Events feed for the live call-center queue. Every ~2s it pushes a
 * tenant-scoped snapshot of in-progress/queued calls + pending tasks so the
 * admin dashboard can render a live transcript/queue view.
 *
 * WHY SSE: this endpoint deliberately bypasses request/response polling for the
 * live transcript/queue. The Medusa admin ships no built-in websocket channel,
 * and a one-shot GET can't stream; SSE (a long-lived text/event-stream) is the
 * lightest way to get server-push into the dashboard without extra infra.
 *
 * SECURITY: it lives under /admin/call-center/* so the fail-closed RBAC guard in
 * the call-center middleware already authenticates + authorizes the caller — no
 * extra auth is done here.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()

  let closed = false

  const send = (event: string, payload: unknown) => {
    if (closed) {
      return
    }
    res.write(`event: ${event}\n`)
    res.write("data: " + JSON.stringify(payload) + "\n\n")
  }

  const tick = async () => {
    if (closed) {
      return
    }
    try {
      const [calls, calls_count] = await cc.listAndCountCalls(
        { tenant_id: TENANT_ID, status: LIVE_CALL_STATUSES },
        { take: 100, order: { created_at: "DESC" } }
      )
      const [tasks, tasks_count] = await cc.listAndCountCallTasks(
        { tenant_id: TENANT_ID, status: LIVE_TASK_STATUSES },
        { take: 100, order: { scheduled_at: "ASC" } }
      )

      send("queue", {
        tenant_id: TENANT_ID,
        calls,
        calls_count,
        tasks,
        tasks_count,
        at: new Date().toISOString(),
      })
    } catch (e: any) {
      send("error", { message: e?.message ?? "Failed to read queue" })
    }
  }

  // Open the stream immediately, then keep pushing on an interval.
  send("open", { tenant_id: TENANT_ID, at: new Date().toISOString() })
  await tick()

  const interval = setInterval(tick, TICK_MS)

  req.on("close", () => {
    closed = true
    clearInterval(interval)
    res.end()
  })
}
