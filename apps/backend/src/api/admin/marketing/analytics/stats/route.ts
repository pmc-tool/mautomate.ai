/**
 * POST /admin/marketing/analytics/stats
 *
 * The stats ingestion endpoint. Persists a single captured metric datapoint
 * (impressions / reach / clicks / conversions / revenue / ...) into
 * `marketing_stat`. This is what a future platform-insights puller or the
 * publish runner calls to store readings that then power the dashboard's
 * engagement section.
 *
 * Body: {
 *   subject_type: "post_target" | "conversation" | "campaign" | "agent" | "post",
 *   subject_id: string,
 *   platform?: string,
 *   metric: "impressions" | "reach" | "likes" | "comments" | "shares"
 *         | "clicks" | "replies" | "conversions" | "revenue",
 *   value: number,
 *   captured_at?: string (ISO)
 * }
 *
 * Response: { ok: true } (no-throw ingestion — a failed write returns ok:false).
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  recordStat,
  type StatMetric,
  type StatSubjectType,
} from "../../../../../modules/marketing/analytics/stats-service"

const SUBJECT_TYPES: StatSubjectType[] = [
  "post_target",
  "conversation",
  "campaign",
  "agent",
  "post",
]

const METRICS: StatMetric[] = [
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "clicks",
  "replies",
  "conversions",
  "revenue",
]

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as Record<string, any>

  const subject_type = body.subject_type
  const subject_id = body.subject_id
  const metric = body.metric
  const value = Number(body.value)

  if (!SUBJECT_TYPES.includes(subject_type)) {
    res.status(400).json({
      message: `Invalid subject_type. Expected one of: ${SUBJECT_TYPES.join(
        ", "
      )}`,
    })
    return
  }
  if (typeof subject_id !== "string" || subject_id.trim().length === 0) {
    res.status(400).json({ message: "subject_id is required" })
    return
  }
  if (!METRICS.includes(metric)) {
    res.status(400).json({
      message: `Invalid metric. Expected one of: ${METRICS.join(", ")}`,
    })
    return
  }
  if (!isFinite(value)) {
    res.status(400).json({ message: "value must be a number" })
    return
  }

  const row = await recordStat(req.scope, {
    subjectType: subject_type,
    subjectId: subject_id.trim(),
    platform:
      typeof body.platform === "string" && body.platform.trim().length > 0
        ? body.platform.trim()
        : null,
    metric,
    value,
    capturedAt:
      typeof body.captured_at === "string" ? body.captured_at : null,
  })

  res.json({ ok: Boolean(row), id: row?.id ?? null })
}
