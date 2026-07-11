/**
 * AI Call Center — Campaigns list (Phase 4).
 *
 * Lists outbound calling campaigns with a "Create campaign" Drawer form, and
 * links each row to the campaign detail at /call-center/campaigns/:id.
 *
 * API: GET/POST /admin/call-center/campaigns (cookie-session admin auth).
 * A campaign is always created in `draft`; `name` + `playbook_id` are required.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { RocketLaunch, Plus } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  createCampaign,
  formatDate,
  listCampaigns,
  STATUS_BADGE,
  type AudienceFilter,
  type Campaign,
  type CampaignSchedule,
  type CampaignStatus,
} from "./lib"

const PAGE_SIZE = 50

const STATUS_TABS: { value: CampaignStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
]

const CampaignsListPage = () => {
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<CampaignStatus | "">("")
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      setError(null)
      const nextOffset = opts?.offset ?? 0
      try {
        const data = await listCampaigns({
          status,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setCampaigns(data.campaigns ?? [])
        setCount(data.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        setError(e?.message ?? "Unexpected error.")
        setCampaigns([])
      } finally {
        setLoading(false)
      }
    },
    [status]
  )

  useEffect(() => {
    load({ offset: 0 })
  }, [load])

  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < count
  const rangeStart = count === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, count)

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Campaigns</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Orchestrate batches of outbound AI calls — audience, pacing and
            schedule.
          </Text>
        </div>
        <Button size="small" onClick={() => setCreateOpen(true)}>
          <Plus />
          Create campaign
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-ui-border-base px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
          {STATUS_TABS.map((s) => (
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
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load({ offset })} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            hasFilter={!!status}
            onCreate={() => setCreateOpen(true)}
          />
        ) : (
          <>
            <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  onOpen={() => navigate(`/call-center/campaigns/${c.id}`)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {rangeStart}–{rangeEnd} of {count}
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

      {createOpen && (
        <CreateCampaignDrawer
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            navigate(`/call-center/campaigns/${id}`)
          }}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function CampaignRow({
  campaign,
  onOpen,
}: {
  campaign: Campaign
  onOpen: () => void
}) {
  const badge = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.draft
  const af = campaign.audience_filter
  const audienceBits = af
    ? [
        af.payment_status && `payment: ${af.payment_status}`,
        af.region && `region: ${af.region}`,
        af.limit != null && `limit: ${af.limit}`,
      ].filter(Boolean)
    : []

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-x-4 bg-ui-bg-base px-4 py-3 text-left transition-colors hover:bg-ui-bg-base-hover"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-subtle">
        <RocketLaunch />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="small" weight="plus" className="truncate">
          {campaign.name}
        </Text>
        <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
          {campaign.playbook_id ?? "no playbook"}
          {audienceBits.length ? ` · ${audienceBits.join(" · ")}` : ""}
        </Text>
      </div>
      <Text
        size="xsmall"
        className="hidden w-28 text-right text-ui-fg-muted lg:block"
      >
        {formatDate(campaign.created_at)}
      </Text>
      <Badge size="2xsmall" color={badge.color}>
        {badge.label}
      </Badge>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Create drawer                                                       */
/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  )
}

function CreateCampaignDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [playbookId, setPlaybookId] = useState("")
  const [fromNumber, setFromNumber] = useState("")
  const [concurrency, setConcurrency] = useState("5")
  const [dailyCap, setDailyCap] = useState("")

  // Audience builder.
  const [paymentStatus, setPaymentStatus] = useState("")
  const [createdAfter, setCreatedAfter] = useState("")
  const [region, setRegion] = useState("")
  const [audienceLimit, setAudienceLimit] = useState("")

  // Schedule window.
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) {
      toast.error("A campaign name is required")
      return
    }
    if (!playbookId.trim()) {
      toast.error("A playbook is required", {
        description: "Enter the playbook id that drives this campaign.",
      })
      return
    }

    const audience_filter: AudienceFilter = {
      payment_status: paymentStatus.trim() || null,
      created_after: createdAfter.trim() || null,
      region: region.trim() || null,
      limit: audienceLimit.trim() ? Number(audienceLimit) : null,
    }
    // Collapse to null when nothing was set.
    const audienceHasValues = Object.values(audience_filter).some(
      (v) => v !== null && v !== ""
    )

    const schedule: CampaignSchedule =
      startTime.trim() || endTime.trim()
        ? {
            start_time: startTime.trim() || null,
            end_time: endTime.trim() || null,
          }
        : null

    setSaving(true)
    try {
      const { campaign } = await createCampaign({
        name: name.trim(),
        playbook_id: playbookId.trim(),
        from_number: fromNumber.trim() || null,
        concurrency: concurrency.trim() ? Number(concurrency) : 5,
        daily_cap: dailyCap.trim() ? Number(dailyCap) : null,
        audience_filter: audienceHasValues ? audience_filter : null,
        schedule,
      })
      toast.success("Campaign created", { description: campaign.name })
      onCreated(campaign.id)
    } catch (e: any) {
      toast.error("Could not create campaign", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-xl">
        <Drawer.Header>
          <Drawer.Title>Create campaign</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {/* Basics */}
          <div className="flex flex-col gap-y-4">
            <Field label="Name">
              <Input
                autoFocus
                value={name}
                placeholder="COD confirmation — July batch"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field
              label="Playbook id"
              hint="The playbook that drives the conversation, e.g. cod_confirmation or wismo."
            >
              <Input
                value={playbookId}
                className="font-mono"
                placeholder="cod_confirmation"
                onChange={(e) => setPlaybookId(e.target.value)}
              />
            </Field>
            <Field
              label="Caller id (from number)"
              hint="Optional. E.164 number calls are placed from."
            >
              <Input
                value={fromNumber}
                className="font-mono"
                placeholder="+8801XXXXXXXXX"
                onChange={(e) => setFromNumber(e.target.value)}
              />
            </Field>
          </div>

          {/* Pacing */}
          <div className="flex flex-col gap-y-4 border-t border-ui-border-base pt-5">
            <Heading level="h3">Pacing</Heading>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Concurrency" hint="Simultaneous calls.">
                <Input
                  type="number"
                  min={1}
                  value={concurrency}
                  onChange={(e) => setConcurrency(e.target.value)}
                />
              </Field>
              <Field label="Daily cap" hint="Max calls/day. Blank = no cap.">
                <Input
                  type="number"
                  min={1}
                  value={dailyCap}
                  placeholder="unlimited"
                  onChange={(e) => setDailyCap(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Audience */}
          <div className="flex flex-col gap-y-4 border-t border-ui-border-base pt-5">
            <div className="flex flex-col">
              <Heading level="h3">Audience</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">
                Structured filter written to the campaign's audience_filter. All
                fields optional.
              </Text>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment status">
                <Input
                  value={paymentStatus}
                  placeholder="not_paid"
                  onChange={(e) => setPaymentStatus(e.target.value)}
                />
              </Field>
              <Field label="Region">
                <Input
                  value={region}
                  placeholder="Dhaka"
                  onChange={(e) => setRegion(e.target.value)}
                />
              </Field>
              <Field label="Created after">
                <Input
                  type="date"
                  value={createdAfter}
                  onChange={(e) => setCreatedAfter(e.target.value)}
                />
              </Field>
              <Field label="Limit">
                <Input
                  type="number"
                  min={1}
                  value={audienceLimit}
                  placeholder="500"
                  onChange={(e) => setAudienceLimit(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Schedule window */}
          <div className="flex flex-col gap-y-4 border-t border-ui-border-base pt-5">
            <div className="flex flex-col">
              <Heading level="h3">Calling window</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">
                Optional daily window (local time) calls are allowed within.
              </Text>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field label="End time">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={submit} isLoading={saving}>
            Create
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */
/* Empty / error / loading                                             */
/* ------------------------------------------------------------------ */

function EmptyState({
  hasFilter,
  onCreate,
}: {
  hasFilter: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <RocketLaunch />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">
          {hasFilter ? "No campaigns match" : "No campaigns yet"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasFilter
            ? "Try a different status filter."
            : "Create a campaign to start placing outbound AI calls."}
        </Text>
      </div>
      {!hasFilter && (
        <Button size="small" onClick={onCreate}>
          <Plus />
          Create campaign
        </Button>
      )}
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
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-error px-6 py-16 text-center">
      <Text weight="plus">Could not load campaigns</Text>
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
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-x-4 px-4 py-3">
          <div className="size-9 animate-pulse rounded-md bg-ui-bg-subtle" />
          <div className="flex flex-1 flex-col gap-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-ui-bg-subtle" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-ui-bg-subtle" />
          </div>
          <div className="h-5 w-14 animate-pulse rounded-full bg-ui-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Campaigns",
  icon: RocketLaunch,
})

export default CampaignsListPage
