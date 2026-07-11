/**
 * KpiStrip — the top KPI strip of the Agent Console.
 *
 * Pure presentational: it takes the dashboard summary (GET /admin/call-center)
 * plus a couple of client-derived figures (escalations waiting, escalation rate)
 * and renders a responsive row of stat tiles. Exported for reuse by sibling
 * subpages that want the same at-a-glance header.
 */
import { Text, Tooltip } from "@medusajs/ui"
import {
  BoltSolid,
  CheckCircleSolid,
  Clock,
  ExclamationCircle,
  Phone,
  Users,
} from "@medusajs/icons"
import type { DashboardSummary } from "./lib"

export type KpiStripProps = {
  summary: DashboardSummary | null
  /** Calls currently flagged as waiting for a human (client-derived). */
  escalations?: number
  /** 0..1 share of today's calls that needed a human. */
  escalationRate?: number
  loading?: boolean
}

type Tile = {
  key: string
  label: string
  value: string
  hint?: string
  icon: any
  accent: string
}

const pct = (n: number): string => `${Math.round(n * 100)}%`

export const KpiStrip = ({
  summary,
  escalations = 0,
  escalationRate = 0,
  loading = false,
}: KpiStripProps) => {
  const by = summary?.calls_today.by_status ?? {}
  const live = (by.dialing ?? 0) + (by.in_progress ?? 0)
  const queued = by.queued ?? 0
  const handled = by.completed ?? 0

  const tiles: Tile[] = [
    {
      key: "live",
      label: "Live now",
      value: String(live),
      hint: `${queued} queued`,
      icon: Phone,
      accent: "text-ui-fg-interactive",
    },
    {
      key: "queued",
      label: "Queued",
      value: String(queued),
      hint: "Waiting to dial",
      icon: Clock,
      accent: "text-ui-tag-blue-icon",
    },
    {
      key: "handled",
      label: "AI-handled today",
      value: String(handled),
      hint: `${summary?.calls_today.total ?? 0} total today`,
      icon: CheckCircleSolid,
      accent: "text-ui-tag-green-icon",
    },
    {
      key: "escalations",
      label: "Waiting for human",
      value: String(escalations),
      hint: `${pct(escalationRate)} escalation rate`,
      icon: ExclamationCircle,
      accent: "text-ui-tag-orange-icon",
    },
    {
      key: "tasks",
      label: "Callbacks scheduled",
      value: String(summary?.tasks_scheduled ?? 0),
      hint: "Due tasks",
      icon: Users,
      accent: "text-ui-tag-purple-icon",
    },
    {
      key: "campaigns",
      label: "Campaigns running",
      value: String(summary?.campaigns_running ?? 0),
      hint: "Active outbound",
      icon: BoltSolid,
      accent: "text-ui-fg-interactive",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ui-border-base bg-ui-border-base sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => {
        const Icon = t.icon
        return (
          <div
            key={t.key}
            className="flex flex-col gap-y-1 bg-ui-bg-subtle px-4 py-3"
          >
            <div className="flex items-center gap-x-1.5 text-ui-fg-muted">
              <Icon className={t.accent} />
              <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                {t.label}
              </Text>
            </div>
            <Text className="text-2xl font-semibold leading-none text-ui-fg-base">
              {loading && !summary ? "—" : t.value}
            </Text>
            {t.hint ? (
              <Tooltip content={t.hint}>
                <Text
                  size="xsmall"
                  className="truncate text-ui-fg-muted"
                >
                  {t.hint}
                </Text>
              </Tooltip>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default KpiStrip
