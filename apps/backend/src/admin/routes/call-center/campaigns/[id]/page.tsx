/**
 * AI Call Center — Campaign detail (Phase 4).
 *
 * Shows a single campaign with its lifecycle controls (Start / Pause / Resume /
 * Complete / Cancel — each a validated status transition), its audience summary
 * and pacing, and live outcome counters tallied from the calls placed under this
 * campaign (fetched with ?campaign_id= and grouped by disposition).
 *
 * This route has no `defineRouteConfig`, so it is reachable at
 * /call-center/campaigns/:id but does not appear in the sidebar.
 *
 * API: GET/POST /admin/call-center/campaigns/:id, GET /admin/call-center/calls.
 */
import {
  ArrowLeft,
  ArrowPath,
  PauseSolid,
  PlaySolid,
  RocketLaunch,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ALLOWED_TRANSITIONS,
  formatDate,
  getCampaign,
  listCallsForCampaign,
  STATUS_BADGE,
  TRANSITION_ACTION,
  updateCampaign,
  type Campaign,
  type CallRow,
  type CampaignStatus,
} from "../lib"

const CampaignDetailPage = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const dialog = usePrompt()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState<CampaignStatus | null>(null)

  const [calls, setCalls] = useState<CallRow[] | null>(null)
  const [callsError, setCallsError] = useState<string | null>(null)
  const [callsLoading, setCallsLoading] = useState(true)

  const loadCampaign = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const { campaign } = await getCampaign(id)
      setCampaign(campaign)
    } catch (e: any) {
      if (e?.status === 404) {
        setNotFound(true)
      } else {
        setError(e?.message ?? "Unexpected error.")
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadCalls = useCallback(async () => {
    setCallsLoading(true)
    setCallsError(null)
    try {
      const { calls } = await listCallsForCampaign(id)
      setCalls(calls ?? [])
    } catch (e: any) {
      setCallsError(e?.message ?? "Unexpected error.")
      setCalls([])
    } finally {
      setCallsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadCampaign()
    loadCalls()
  }, [loadCampaign, loadCalls])

  const transition = async (to: CampaignStatus) => {
    if (!campaign) return
    if (to === "canceled") {
      const ok = await dialog({
        title: "Cancel campaign",
        description:
          "Canceling is terminal — the campaign cannot be resumed afterwards. Any queued calls will not be placed.",
        confirmText: "Cancel campaign",
        cancelText: "Keep",
        variant: "danger",
      })
      if (!ok) return
    }
    setTransitioning(to)
    try {
      const { campaign: updated } = await updateCampaign(id, { status: to })
      setCampaign(updated)
      toast.success(`Campaign ${STATUS_BADGE[to].label.toLowerCase()}`)
      // Outcomes may change once running/paused — refresh counters.
      loadCalls()
    } catch (e: any) {
      toast.error("Could not update status", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setTransitioning(null)
    }
  }

  /* ---- render guards ---- */

  if (loading) {
    return (
      <Container className="p-0">
        <div className="px-6 py-12">
          <Text className="text-ui-fg-subtle">Loading campaign…</Text>
        </div>
      </Container>
    )
  }

  if (notFound) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text className="text-ui-fg-subtle">Campaign not found.</Text>
          <Button
            size="small"
            variant="secondary"
            onClick={() => navigate("/call-center/campaigns")}
          >
            <ArrowLeft />
            Back to campaigns
          </Button>
        </div>
      </Container>
    )
  }

  if (error || !campaign) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text weight="plus">Could not load campaign</Text>
          <Text size="small" className="text-ui-fg-subtle">
            {error ?? "Unexpected error."}
          </Text>
          <Button size="small" variant="secondary" onClick={loadCampaign}>
            <ArrowPath />
            Retry
          </Button>
        </div>
      </Container>
    )
  }

  const badge = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.draft
  const available = ALLOWED_TRANSITIONS[campaign.status] ?? []

  return (
    <Container className="p-0">
      {/* Top bar */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4">
        <button
          type="button"
          onClick={() => navigate("/call-center/campaigns")}
          className="flex w-fit items-center gap-x-1 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ArrowLeft />
          <Text size="small">Campaigns</Text>
        </button>

        <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-y-1">
            <div className="flex items-center gap-x-2">
              <Heading level="h2" className="truncate">
                {campaign.name}
              </Heading>
              <Badge size="2xsmall" color={badge.color}>
                {badge.label}
              </Badge>
            </div>
            <Text size="small" className="font-mono text-ui-fg-subtle">
              {campaign.playbook_id ?? "no playbook"} · {campaign.id}
            </Text>
          </div>

          {/* Lifecycle controls */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {available.length === 0 ? (
              <Text size="small" className="text-ui-fg-muted">
                Terminal state — no further actions.
              </Text>
            ) : (
              available.map((to) => {
                const action = TRANSITION_ACTION[to]
                const Icon =
                  to === "running"
                    ? PlaySolid
                    : to === "paused"
                      ? PauseSolid
                      : RocketLaunch
                return (
                  <Button
                    key={to}
                    size="small"
                    variant={action.variant}
                    isLoading={transitioning === to}
                    disabled={!!transitioning && transitioning !== to}
                    onClick={() => transition(to)}
                  >
                    {to === "canceled" ? null : <Icon />}
                    {action.label}
                  </Button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-y-6 px-6 py-6">
        <OutcomeCounters
          loading={callsLoading}
          error={callsError}
          calls={calls}
          onRefresh={loadCalls}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AudienceCard campaign={campaign} />
          <PacingCard campaign={campaign} />
        </div>

        <RecentCalls loading={callsLoading} calls={calls} />
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Outcome counters (tally calls by disposition)                       */
/* ------------------------------------------------------------------ */

function OutcomeCounters({
  loading,
  error,
  calls,
  onRefresh,
}: {
  loading: boolean
  error: string | null
  calls: CallRow[] | null
  onRefresh: () => void
}) {
  const stats = useMemo(() => {
    const list = calls ?? []
    const byDisposition = list.reduce((acc: Record<string, number>, c) => {
      const key = c.disposition ?? "(none)"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    const byStatus = list.reduce((acc: Record<string, number>, c) => {
      const key = c.status ?? "unknown"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    const totalAttempts = list.reduce(
      (sum, c) => sum + (c.attempts?.length ?? 0),
      0
    )
    return {
      total: list.length,
      byDisposition,
      byStatus,
      totalAttempts,
    }
  }, [calls])

  return (
    <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <Heading level="h3">Outcomes</Heading>
          <Text size="xsmall" className="text-ui-fg-muted">
            Live tally of calls placed under this campaign, grouped by
            disposition.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={onRefresh}
          isLoading={loading}
        >
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {error ? (
        <Text size="small" className="text-ui-fg-error">
          Could not load calls: {error}
        </Text>
      ) : loading && !calls ? (
        <Text size="small" className="text-ui-fg-subtle">
          Loading calls…
        </Text>
      ) : stats.total === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          No calls placed under this campaign yet.
        </Text>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total calls" value={stats.total} />
            <Stat label="Attempts" value={stats.totalAttempts} />
            <Stat
              label="Completed"
              value={stats.byStatus["completed"] ?? 0}
            />
            <Stat
              label="Dispositioned"
              value={stats.total - (stats.byDisposition["(none)"] ?? 0)}
            />
          </div>

          <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
            <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
              By disposition
            </Text>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byDisposition)
                .sort((a, b) => b[1] - a[1])
                .map(([disp, n]) => (
                  <div
                    key={disp}
                    className="flex items-center gap-x-2 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-1.5"
                  >
                    <Text size="xsmall" className="font-mono">
                      {disp}
                    </Text>
                    <Badge size="2xsmall" color="grey">
                      {n}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-y-0.5 rounded-lg bg-ui-bg-subtle px-3 py-2.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="large" weight="plus">
        {value}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Audience / pacing cards                                             */
/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-x-4 py-1.5">
      <Text size="small" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="small" className="truncate text-right">
        {value ?? "—"}
      </Text>
    </div>
  )
}

function AudienceCard({ campaign }: { campaign: Campaign }) {
  const af = campaign.audience_filter
  const sched = campaign.schedule
  return (
    <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-4">
      <Heading level="h3">Audience &amp; schedule</Heading>
      <div className="flex flex-col divide-y divide-ui-border-base">
        <Row label="Payment status" value={af?.payment_status || "any"} />
        <Row label="Region" value={af?.region || "any"} />
        <Row label="Created after" value={af?.created_after || "—"} />
        <Row
          label="Audience limit"
          value={af?.limit != null ? String(af.limit) : "no limit"}
        />
        <Row
          label="Calling window"
          value={
            sched?.start_time || sched?.end_time
              ? `${sched?.start_time ?? "—"} → ${sched?.end_time ?? "—"}`
              : "any time"
          }
        />
      </div>
    </div>
  )
}

function PacingCard({ campaign }: { campaign: Campaign }) {
  return (
    <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-4">
      <Heading level="h3">Pacing &amp; caller</Heading>
      <div className="flex flex-col divide-y divide-ui-border-base">
        <Row label="Concurrency" value={campaign.concurrency} />
        <Row
          label="Daily cap"
          value={campaign.daily_cap != null ? campaign.daily_cap : "unlimited"}
        />
        <Row
          label="From number"
          value={
            campaign.from_number ? (
              <span className="font-mono">{campaign.from_number}</span>
            ) : (
              "default"
            )
          }
        />
        <Row label="Created" value={formatDate(campaign.created_at)} />
        <Row label="Updated" value={formatDate(campaign.updated_at)} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Recent calls                                                        */
/* ------------------------------------------------------------------ */

function RecentCalls({
  loading,
  calls,
}: {
  loading: boolean
  calls: CallRow[] | null
}) {
  const recent = (calls ?? []).slice(0, 15)
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
      <Heading level="h3">Recent calls</Heading>
      {loading && !calls ? (
        <Text size="small" className="text-ui-fg-subtle">
          Loading…
        </Text>
      ) : recent.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          No calls yet.
        </Text>
      ) : (
        <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
          {recent.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-x-4 bg-ui-bg-base px-4 py-2.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Text size="small" className="truncate font-mono">
                  {c.to_number ?? c.id}
                </Text>
                {c.summary && (
                  <Text
                    size="xsmall"
                    className="truncate text-ui-fg-subtle"
                  >
                    {c.summary}
                  </Text>
                )}
              </div>
              {c.disposition && (
                <Badge size="2xsmall" color="grey">
                  {c.disposition}
                </Badge>
              )}
              <Badge size="2xsmall" color="blue">
                {c.status}
              </Badge>
              <Text
                size="xsmall"
                className="hidden w-28 text-right text-ui-fg-muted lg:block"
              >
                {formatDate(c.created_at)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CampaignDetailPage
