/**
 * AI Call Center — Calls list.
 *
 * Paginated, filterable table of AI call-center calls (by status, direction and
 * date), each row linking to the Call Review screen at /call-center/calls/:id.
 * Shows a status badge, playbook, disposition, duration and cost.
 *
 * API: GET /admin/call-center/calls?status=&direction=&order_id=&campaign_id=&limit=&offset=
 * (cookie-session, behind the /admin/call-center/* admin guard).
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowDownLeft,
  ArrowUpRightMini,
  Phone,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Text,
  clx,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  CALL_STATUS_BADGE,
  formatCost,
  formatDateTime,
  formatDuration,
  humanize,
  listCalls,
  type CallRow,
} from "./_components/lib"

const PAGE_SIZE = 50

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "failed", label: "Failed" },
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Voicemail" },
]

const DIRECTION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "outbound", label: "Outbound" },
  { value: "inbound", label: "Inbound" },
]

/** Colored status pill from the shared map, with a title-cased fallback. */
function StatusBadge({ status }: { status?: string | null }) {
  const cfg = (status && CALL_STATUS_BADGE[status]) || {
    label: humanize(status),
    color: "grey" as const,
  }
  return (
    <Badge size="2xsmall" color={cfg.color}>
      {cfg.label}
    </Badge>
  )
}

function DirectionCell({ direction }: { direction?: string | null }) {
  const inbound = direction === "inbound"
  return (
    <div className="flex items-center gap-x-1.5">
      <div
        className={clx(
          "flex size-6 items-center justify-center rounded-md",
          inbound
            ? "bg-ui-tag-green-bg text-ui-tag-green-icon"
            : "bg-ui-tag-blue-bg text-ui-tag-blue-icon"
        )}
      >
        {inbound ? <ArrowDownLeft /> : <ArrowUpRightMini />}
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {inbound ? "Inbound" : "Outbound"}
      </Text>
    </div>
  )
}

const CallsListPage = () => {
  const navigate = useNavigate()

  const [calls, setCalls] = useState<CallRow[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState("")
  const [direction, setDirection] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      setError(null)
      const nextOffset = opts?.offset ?? 0
      try {
        const data = await listCalls({
          status: status || undefined,
          direction: direction || undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setCalls(data.calls ?? [])
        setCount(data.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        setError(e?.message ?? "Unexpected error.")
        toast.error("Could not load calls", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setLoading(false)
      }
    },
    [status, direction]
  )

  useEffect(() => {
    load({ offset: 0 })
  }, [load])

  // Date filtering is applied client-side (the list API filters by status /
  // direction only) so operators can still narrow a page of results by day.
  const visibleCalls = calls.filter((c) => {
    if (!dateFrom && !dateTo) return true
    const started = c.started_at ? new Date(c.started_at).getTime() : null
    if (started == null) return false
    if (dateFrom && started < new Date(dateFrom).getTime()) return false
    if (dateTo) {
      // Inclusive of the whole "to" day.
      const end = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000
      if (started >= end) return false
    }
    return true
  })

  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < count
  const rangeStart = count === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, count)
  const hasFilters = !!status || !!direction || !!dateFrom || !!dateTo

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-1 border-b border-ui-border-base px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Phone className="text-ui-fg-subtle" />
          <Heading level="h2">Calls</Heading>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Review AI call-center calls, transcripts and outcomes.
        </Text>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-y-3 border-b border-ui-border-base px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s.value || "all"}
                size="small"
                variant={status === s.value ? "primary" : "transparent"}
                onClick={() => setStatus(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
            {DIRECTION_FILTERS.map((d) => (
              <Button
                key={d.value || "all"}
                size="small"
                variant={direction === d.value ? "primary" : "transparent"}
                onClick={() => setDirection(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <div className="flex items-center gap-x-1.5">
            <Text size="xsmall" className="text-ui-fg-muted">
              From
            </Text>
            <Input
              type="date"
              size="small"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-x-1.5">
            <Text size="xsmall" className="text-ui-fg-muted">
              To
            </Text>
            <Input
              type="date"
              size="small"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          {hasFilters && (
            <Button
              size="small"
              variant="transparent"
              onClick={() => {
                setStatus("")
                setDirection("")
                setDateFrom("")
                setDateTo("")
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load({ offset })} />
        ) : visibleCalls.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-ui-border-base">
              <table className="min-w-full divide-y divide-ui-border-base">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <Th>Direction</Th>
                    <Th>Status</Th>
                    <Th>Contact</Th>
                    <Th>Playbook</Th>
                    <Th>Disposition</Th>
                    <Th className="text-right">Duration</Th>
                    <Th className="text-right">Cost</Th>
                    <Th className="text-right">Started</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-base">
                  {visibleCalls.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/call-center/calls/${c.id}`)}
                      className="cursor-pointer bg-ui-bg-base transition-colors hover:bg-ui-bg-base-hover"
                    >
                      <Td>
                        <DirectionCell direction={c.direction} />
                      </Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td>
                        <Text
                          size="xsmall"
                          className="font-mono text-ui-fg-subtle"
                        >
                          {c.direction === "inbound"
                            ? c.from_number ?? "—"
                            : c.to_number ?? "—"}
                        </Text>
                      </Td>
                      <Td>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {c.playbook_id ? (
                            <span className="font-mono">{c.playbook_id}</span>
                          ) : (
                            "—"
                          )}
                        </Text>
                      </Td>
                      <Td>
                        {c.disposition ? (
                          <Badge size="2xsmall" color="grey">
                            {humanize(c.disposition)}
                          </Badge>
                        ) : (
                          <Text size="xsmall" className="text-ui-fg-muted">
                            —
                          </Text>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Text size="xsmall" className="tabular-nums">
                          {formatDuration(c.started_at, c.ended_at)}
                        </Text>
                      </Td>
                      <Td className="text-right">
                        <Text size="xsmall" className="tabular-nums">
                          {formatCost(c.cost_total)}
                        </Text>
                      </Td>
                      <Td className="text-right">
                        <Text
                          size="xsmall"
                          className="whitespace-nowrap text-ui-fg-muted"
                        >
                          {formatDateTime(c.started_at)}
                        </Text>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {dateFrom || dateTo
                  ? `${visibleCalls.length} shown · ${rangeStart}–${rangeEnd} of ${count}`
                  : `${rangeStart}–${rangeEnd} of ${count}`}
              </Text>
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasPrev}
                  onClick={() => load({ offset: offset - PAGE_SIZE })}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasNext}
                  onClick={() => load({ offset: offset + PAGE_SIZE })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Table cells                                                         */
/* ------------------------------------------------------------------ */

function Th({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <th
      className={clx(
        "px-4 py-2.5 text-left text-ui-fg-muted",
        className
      )}
    >
      <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
        {children}
      </Text>
    </th>
  )
}

function Td({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={clx("px-4 py-3 align-middle", className)}>{children}</td>
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <Phone />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">{hasFilters ? "No calls match" : "No calls yet"}</Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasFilters
            ? "Try a different status, direction or date range."
            : "Calls will appear here once the AI call center starts dialing."}
        </Text>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-ui-border-error px-6 py-16 text-center">
      <Text weight="plus" className="text-ui-fg-error">
        Could not load calls
      </Text>
      <Text size="small" className="text-ui-fg-subtle">
        {message}
      </Text>
      <Button size="small" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-x-4 px-4 py-3">
          <div className="size-6 animate-pulse rounded-md bg-ui-bg-subtle" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-ui-bg-subtle" />
          <div className="h-3 w-32 flex-1 animate-pulse rounded bg-ui-bg-subtle" />
          <div className="h-3 w-16 animate-pulse rounded bg-ui-bg-subtle" />
          <div className="h-3 w-12 animate-pulse rounded bg-ui-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Calls",
  icon: Phone,
})

export default CallsListPage
