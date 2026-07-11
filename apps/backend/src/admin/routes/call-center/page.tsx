/**
 * Agent Console — Live Queue (Call Center hub / landing page).
 *
 * The landing route for the AI call center. It shows a KPI strip (from
 * GET /admin/call-center) and a tabbed set of live tables:
 *   - Live               active calls on the wire (queued / dialing / in progress)
 *   - Waiting for human  active calls flagged for a human handoff (heuristic)
 *   - Callbacks due       scheduled/claimed dial tasks (GET .../tasks)
 *   - Recent              the most recent calls, any outcome
 *
 * Data is polled every ~5s via usePolling and cleared on unmount. This is
 * intentionally REST polling — a true live transcript / per-call event feed is
 * served over SSE at /admin/call-center/stream (owned by another agent);
 * subscribe there for token-by-token updates rather than shortening this poll.
 *
 * A global Kill Switch in the header halts (or resumes) outbound calling via
 * POST /admin/call-center/kill-switch after a confirm prompt.
 *
 * OWNERSHIP: this file owns only the hub/landing (Live Queue). The calls /
 * campaigns / playbooks / settings subpages are separate page.tsx routes owned
 * by other agents; the shared bits they import live in ./_components.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ArrowsPointingOut,
  Eye,
  MediaStopSolid,
  Phone,
  PlaySolid,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Table,
  Tabs,
  Text,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMemo, useState } from "react"
import StatusBadge from "./_components/StatusBadge"
import KpiStrip from "./_components/KpiStrip"
import usePolling from "./_components/usePolling"
import {
  getKillSwitch,
  getSummary,
  isActiveCall,
  isCallbackDue,
  listCalls,
  listTasks,
  needsHuman,
  setKillSwitch,
  formatDuration,
  formatRelative,
  type Call,
  type CallTask,
} from "./_components/lib"

const POLL_MS = 5000

type TabKey = "live" | "waiting" | "callbacks" | "recent"

const AgentConsolePage = () => {
  const dialog = usePrompt()
  const [tab, setTab] = useState<TabKey>("live")
  const [toggling, setToggling] = useState(false)

  const summary = usePolling(getSummary, { intervalMs: POLL_MS })
  const calls = usePolling(() => listCalls({ limit: 100 }), {
    intervalMs: POLL_MS,
  })
  const tasks = usePolling(() => listTasks({ status: "scheduled", limit: 100 }), {
    intervalMs: POLL_MS,
  })
  const kill = usePolling(getKillSwitch, { intervalMs: 10000 })

  const allCalls = calls.data?.calls ?? []
  const allTasks = tasks.data?.tasks ?? []

  const liveCalls = useMemo(
    () => allCalls.filter(isActiveCall),
    [allCalls]
  )
  const waitingCalls = useMemo(
    () => allCalls.filter((c) => needsHuman(c) && isActiveCall(c)),
    [allCalls]
  )
  const dueTasks = useMemo(() => allTasks.filter(isCallbackDue), [allTasks])

  // Escalation rate over today's total (from the summary), using the number of
  // waiting calls we can see now as the numerator when the total is known.
  const totalToday = summary.data?.calls_today.total ?? 0
  const escalationRate = totalToday > 0 ? waitingCalls.length / totalToday : 0

  const refreshAll = () => {
    summary.refetch()
    calls.refetch()
    tasks.refetch()
    kill.refetch()
  }

  const onToggleKill = async () => {
    const halted = kill.data?.outbound_halted
    const action = halted ? "resume" : "halt"
    const ok = await dialog({
      title: halted ? "Resume outbound calling?" : "Halt outbound calling?",
      description: halted
        ? "Outbound campaigns must be re-run individually. This clears the halted banner."
        : "This immediately pauses every running campaign for the tenant. In-progress calls are not cut off, but no new outbound calls will be placed.",
      confirmText: halted ? "Resume" : "Halt calling",
      cancelText: "Cancel",
      variant: halted ? "confirmation" : "danger",
    })
    if (!ok) return
    setToggling(true)
    try {
      const res = await setKillSwitch(action)
      if (action === "halt") {
        toast.success("Outbound calling halted", {
          description: `Paused ${res.paused_campaigns ?? 0} running campaign(s).`,
        })
      } else {
        toast.success("Kill switch cleared", {
          description: res.message ?? "Resume campaigns individually.",
        })
      }
      kill.refetch()
      summary.refetch()
    } catch (e: any) {
      toast.error("Could not update kill switch", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setToggling(false)
    }
  }

  const halted = kill.data?.outbound_halted ?? false

  const tabCounts: Record<TabKey, number> = {
    live: liveCalls.length,
    waiting: waitingCalls.length,
    callbacks: dueTasks.length,
    recent: allCalls.length,
  }

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Live Queue</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Real-time view of the AI call center. Monitor active calls, escalations
            and callbacks.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          {halted ? (
            <Badge size="2xsmall" color="red">
              Outbound halted
            </Badge>
          ) : (
            <Badge size="2xsmall" color="green">
              Outbound live
            </Badge>
          )}
          <Tooltip content="Refresh now">
            <IconButton
              size="small"
              variant="transparent"
              onClick={refreshAll}
              disabled={calls.refreshing || summary.refreshing}
            >
              <ArrowPath />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant={halted ? "secondary" : "danger"}
            onClick={onToggleKill}
            isLoading={toggling}
          >
            {halted ? <PlaySolid /> : <MediaStopSolid />}
            {halted ? "Resume calling" : "Kill switch"}
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="px-6 py-4">
        <KpiStrip
          summary={summary.data}
          escalations={waitingCalls.length}
          escalationRate={escalationRate}
          loading={summary.loading}
        />
        {summary.error ? (
          <Text size="xsmall" className="mt-2 text-ui-fg-error">
            Could not load summary: {summary.error.message}
          </Text>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="px-6 pb-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <Tabs.List>
            <TabTrigger value="live" label="Live" count={tabCounts.live} />
            <TabTrigger
              value="waiting"
              label="Waiting for human"
              count={tabCounts.waiting}
            />
            <TabTrigger
              value="callbacks"
              label="Callbacks due"
              count={tabCounts.callbacks}
            />
            <TabTrigger value="recent" label="Recent" count={tabCounts.recent} />
          </Tabs.List>

          <div className="mt-4">
            <Tabs.Content value="live">
              <CallsTable
                calls={liveCalls}
                loading={calls.loading}
                error={calls.error}
                emptyTitle="No live calls"
                emptyHint="Active calls will appear here as they connect."
              />
            </Tabs.Content>
            <Tabs.Content value="waiting">
              <CallsTable
                calls={waitingCalls}
                loading={calls.loading}
                error={calls.error}
                emptyTitle="Nobody waiting"
                emptyHint="Calls the AI flags for a human handoff show up here."
              />
            </Tabs.Content>
            <Tabs.Content value="callbacks">
              <TasksTable
                tasks={dueTasks}
                loading={tasks.loading}
                error={tasks.error}
              />
            </Tabs.Content>
            <Tabs.Content value="recent">
              <CallsTable
                calls={allCalls}
                loading={calls.loading}
                error={calls.error}
                emptyTitle="No calls yet"
                emptyHint="Recent calls, any outcome, will be listed here."
              />
            </Tabs.Content>
          </div>
        </Tabs>
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Tab trigger with count                                              */
/* ------------------------------------------------------------------ */

function TabTrigger({
  value,
  label,
  count,
}: {
  value: string
  label: string
  count: number
}) {
  return (
    <Tabs.Trigger value={value}>
      <span className="flex items-center gap-x-2">
        {label}
        <Badge size="2xsmall" color={count > 0 ? "blue" : "grey"}>
          {count}
        </Badge>
      </span>
    </Tabs.Trigger>
  )
}

/* ------------------------------------------------------------------ */
/* Order link + row action handlers                                    */
/* ------------------------------------------------------------------ */

function OrderLink({ orderId }: { orderId: string | null }) {
  if (!orderId) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        —
      </Text>
    )
  }
  return (
    // Deep link into the core admin order detail. Anchor (not react-router Link)
    // so it resolves against the /app admin basename regardless of this route.
    <a
      href={`/app/orders/${orderId}`}
      className="font-mono text-ui-fg-interactive hover:underline"
    >
      {orderId.slice(0, 12)}…
    </a>
  )
}

// TODO: wire "Monitor" / "Take" to the active-call view (live transcript +
// controls) once that route + the /admin/call-center/stream SSE feed land.
function monitorCall(call: Call) {
  toast.info("Monitor", {
    description: `Live monitor for ${call.id} opens once the active-call view is built.`,
  })
}

function takeCall(id: string) {
  toast.info("Take over", {
    description: `Human takeover for ${id} opens once the active-call view is built.`,
  })
}

/* ------------------------------------------------------------------ */
/* Calls table                                                         */
/* ------------------------------------------------------------------ */

function CallsTable({
  calls,
  loading,
  error,
  emptyTitle,
  emptyHint,
}: {
  calls: Call[]
  loading: boolean
  error: Error | null
  emptyTitle: string
  emptyHint: string
}) {
  if (error && calls.length === 0) {
    return <ErrorState message={error.message} />
  }
  if (loading && calls.length === 0) {
    return <TableSkeleton columns={6} />
  }
  if (calls.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ui-border-base">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Playbook</Table.HeaderCell>
            <Table.HeaderCell>Order</Table.HeaderCell>
            <Table.HeaderCell>Direction</Table.HeaderCell>
            <Table.HeaderCell>Duration</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {calls.map((c) => (
            <Table.Row key={c.id}>
              <Table.Cell>
                <div className="flex flex-col">
                  <Text size="small" weight="plus">
                    {c.playbook_id ?? "—"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {c.to_number ?? c.from_number ?? c.id.slice(0, 12)}
                  </Text>
                </div>
              </Table.Cell>
              <Table.Cell>
                <OrderLink orderId={c.order_id} />
              </Table.Cell>
              <Table.Cell>
                <Badge
                  size="2xsmall"
                  color={c.direction === "inbound" ? "purple" : "blue"}
                >
                  {c.direction}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <Text size="small" className="tabular-nums">
                  {formatDuration(c)}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge status={c.status} />
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center justify-end gap-x-1">
                  <Tooltip content="Monitor live">
                    <IconButton
                      size="small"
                      variant="transparent"
                      onClick={() => monitorCall(c)}
                    >
                      <Eye />
                    </IconButton>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => takeCall(c.id)}
                  >
                    <ArrowsPointingOut />
                    Take
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tasks table (callbacks due)                                         */
/* ------------------------------------------------------------------ */

function TasksTable({
  tasks,
  loading,
  error,
}: {
  tasks: CallTask[]
  loading: boolean
  error: Error | null
}) {
  if (error && tasks.length === 0) {
    return <ErrorState message={error.message} />
  }
  if (loading && tasks.length === 0) {
    return <TableSkeleton columns={6} />
  }
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No callbacks due"
        hint="Scheduled outbound tasks appear here as they come due."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ui-border-base">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Playbook</Table.HeaderCell>
            <Table.HeaderCell>Order</Table.HeaderCell>
            <Table.HeaderCell>Scheduled</Table.HeaderCell>
            <Table.HeaderCell>Attempts</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tasks.map((t) => (
            <Table.Row key={t.id}>
              <Table.Cell>
                <div className="flex flex-col">
                  <Text size="small" weight="plus">
                    {t.playbook_id ?? "—"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t.direction}
                  </Text>
                </div>
              </Table.Cell>
              <Table.Cell>
                <OrderLink orderId={t.order_id} />
              </Table.Cell>
              <Table.Cell>
                <Text size="small">{formatRelative(t.scheduled_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="small" className="tabular-nums">
                  {t.attempts}/{t.max_attempts}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge kind="task" status={t.status} />
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center justify-end">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => takeCall(t.id)}
                  >
                    <PlaySolid />
                    Take
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty / error / skeleton                                            */
/* ------------------------------------------------------------------ */

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <Phone />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">{title}</Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hint}
        </Text>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-2 rounded-lg border border-dashed border-ui-border-error px-6 py-16 text-center">
      <Text weight="plus" className="text-ui-fg-error">
        Could not load
      </Text>
      <Text size="small" className="text-ui-fg-subtle">
        {message}
      </Text>
    </div>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base">
      <div className="flex flex-col divide-y divide-ui-border-base">
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="flex items-center gap-x-4 px-4 py-3">
            {Array.from({ length: columns }).map((__, c) => (
              <div
                key={c}
                className="h-3 flex-1 animate-pulse rounded bg-ui-bg-subtle"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Call Center",
  icon: Phone,
})

export default AgentConsolePage
