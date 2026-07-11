import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"
import { ccError, ccLog } from "../../../../modules/call-center/observability/logger"
import {
  spendBurnRate,
  spendToday,
  stuckCalls,
  turnLatencyBudgetMs,
  type AggregatableCall,
} from "../../../../modules/call-center/observability/slo"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * A call is "stuck" once it has been non-terminal for this long. Kept modest so
 * a wedged media session or crashed worker surfaces on the dashboard quickly.
 */
const STUCK_THRESHOLD_MIN = 15

/** Trailing window for the spend burn-rate signal. */
const BURN_WINDOW_MIN = 60

/** Safety cap so a backlog can never load an unbounded set into memory. */
const PAGE_SIZE = 1000
const MAX_CALLS = 20_000

/**
 * Non-terminal statuses — these are the only calls that can be "live" or
 * "stuck", so the health snapshot only needs to scan these plus today's rows.
 */
const NON_TERMINAL_STATUSES = ["queued", "dialing", "in_progress"]

type HealthCheck = boolean

type HealthResponse = {
  status: "ok" | "degraded" | "down"
  checks: {
    redis: HealthCheck
    voice_runtime: HealthCheck
    telephony: HealthCheck
    llm: HealthCheck
    stt: HealthCheck
    tts: HealthCheck
  }
  live: {
    in_progress: number
    queued: number
  }
  stuck_calls: number
  spend_today: number
  spend_burn_rate: { window_min: number; spend: number; per_min: number }
  slo: {
    turn_latency_budget_ms: number
  }
}

const hasEnv = (name: string): boolean => !!process.env[name]?.trim()

/**
 * Page through calls matching `filters` up to MAX_CALLS. Mirrors the analytics
 * route so a large backlog can never exhaust memory.
 */
const loadCalls = async (
  cc: CallCenterModuleService,
  filters: Record<string, any>
): Promise<AggregatableCall[]> => {
  const calls: AggregatableCall[] = []
  let offset = 0
  while (offset < MAX_CALLS) {
    const [page, count] = await cc.listAndCountCalls(filters, {
      take: PAGE_SIZE,
      skip: offset,
      order: { started_at: "ASC" },
    })
    calls.push(...(page as AggregatableCall[]))
    offset += PAGE_SIZE
    if (offset >= count || page.length < PAGE_SIZE) {
      break
    }
  }
  return calls
}

/**
 * GET /admin/call-center/health
 *
 * Tenant-scoped system-health snapshot for the AI call center. Reports which
 * integrations are configured, how many calls are live, how many look stuck,
 * today's spend + burn rate, and the turn-latency SLO target.
 *
 * status:
 *   "degraded"  any stuck call OR any required integration env missing
 *   "ok"        everything wired and no stuck calls
 *   "down"      reserved for a hard failure (the catch below returns 500)
 *
 * OPS: dashboards and alerts consume this endpoint. Wire a scheduled probe
 * (Slack/email on non-"ok") to it in the ops layer — that alerting is out of
 * scope for this module.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<HealthResponse | { message: string }>
) => {
  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)
    const now = new Date()

    const checks: HealthResponse["checks"] = {
      redis: hasEnv("REDIS_URL"),
      voice_runtime: hasEnv("VOICE_AGENT_URL"),
      telephony: hasEnv("TWILIO_ACCOUNT_SID") && hasEnv("TWILIO_AUTH_TOKEN"),
      llm: hasEnv("OPENAI_API_KEY"),
      stt: hasEnv("DEEPGRAM_API_KEY"),
      tts: hasEnv("ELEVENLABS_API_KEY"),
    }

    // Live + potentially-stuck calls: only non-terminal rows qualify.
    const liveCalls = await loadCalls(cc, {
      tenant_id: TENANT_ID,
      status: NON_TERMINAL_STATUSES,
    })

    // Today's calls (UTC) for spend + burn rate.
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )
    const todaysCalls = await loadCalls(cc, {
      tenant_id: TENANT_ID,
      started_at: { $gte: startOfDay },
    })

    const in_progress = liveCalls.filter(
      (c) => c.status === "in_progress"
    ).length
    const queued = liveCalls.filter((c) => c.status === "queued").length
    const stuck = stuckCalls(liveCalls, STUCK_THRESHOLD_MIN, now).length

    const requiredMissing = Object.values(checks).some((ok) => !ok)
    const status: HealthResponse["status"] =
      stuck > 0 || requiredMissing ? "degraded" : "ok"

    const response: HealthResponse = {
      status,
      checks,
      live: { in_progress, queued },
      stuck_calls: stuck,
      spend_today: spendToday(todaysCalls, now),
      spend_burn_rate: spendBurnRate(todaysCalls, BURN_WINDOW_MIN, now),
      slo: { turn_latency_budget_ms: turnLatencyBudgetMs },
    }

    ccLog("health", "health.snapshot", {
      tenant_id: TENANT_ID,
      status,
      in_progress,
      queued,
      stuck_calls: stuck,
    })

    res.json(response)
  } catch (e: any) {
    ccError("health", "health.error", {
      tenant_id: TENANT_ID,
      message: e?.message,
    })
    res.status(500).json({
      message: e?.message ?? "Failed to compute call-center health",
    })
  }
}
