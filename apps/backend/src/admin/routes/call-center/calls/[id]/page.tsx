/**
 * AI Call Center — Call Review screen.
 *
 * The single-call detail view at /call-center/calls/:id. Nested detail route, so
 * it has no `defineRouteConfig` and does not appear in the sidebar.
 *
 * Layout:
 *   - header    : direction, status, disposition, sentiment, cost, recording player
 *   - summary   : the AI-generated call summary
 *   - transcript: turn-by-turn AI/customer conversation (call.transcript)
 *   - outcomes  : dispositions + prior dial attempts
 *   - side rail : Customer-360 composed from the linked order + customer
 *
 * API: GET /admin/call-center/calls/:id → { call, dispositions, attempts }
 */
import {
  ArrowLeft,
  ArrowPath,
  ChatBubbleLeftRight,
  Clock,
  CurrencyDollar,
  ListCheckbox,
  Phone,
  Sparkles,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Text,
  Tooltip,
} from "@medusajs/ui"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Customer360 } from "../_components/Customer360"
import { RecordingPlayer } from "../_components/RecordingPlayer"
import { TranscriptView } from "../_components/TranscriptView"
import {
  CALL_STATUS_BADGE,
  SENTIMENT_BADGE,
  formatCost,
  formatDateTime,
  formatDuration,
  getCall,
  humanize,
  type CallAttempt,
  type CallDetail,
  type CallDisposition,
} from "../_components/lib"

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

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return null
  const cfg = SENTIMENT_BADGE[sentiment] || {
    label: humanize(sentiment),
    color: "grey" as const,
  }
  return (
    <Badge size="2xsmall" color={cfg.color}>
      {cfg.label} sentiment
    </Badge>
  )
}

/* Small labeled metric for the header strip. */
function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-x-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2">
      <span className="text-ui-fg-muted">{icon}</span>
      <div className="flex flex-col">
        <Text size="xsmall" className="text-ui-fg-muted">
          {label}
        </Text>
        <Text size="small" weight="plus" className="tabular-nums">
          {value}
        </Text>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dispositions + attempts                                             */
/* ------------------------------------------------------------------ */

function dispositionLabel(d: CallDisposition): string {
  if (typeof d === "string") return humanize(d)
  return humanize(d.label ?? d.code ?? d.value ?? d.id ?? "")
}

function DispositionsList({
  dispositions,
  current,
}: {
  dispositions: CallDisposition[]
  current?: string | null
}) {
  if (!dispositions?.length) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        {current
          ? `Disposition: ${humanize(current)}`
          : "No disposition recorded."}
      </Text>
    )
  }
  return (
    <div className="flex flex-col gap-y-2">
      {dispositions.map((d, i) => {
        const isObject = typeof d !== "string"
        const note = isObject ? d.note : null
        const when = isObject ? d.created_at : null
        return (
          <div
            key={(isObject && d.id) || i}
            className="flex items-start justify-between gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2"
          >
            <div className="flex min-w-0 flex-col gap-y-0.5">
              <Badge size="2xsmall" color="grey" className="w-fit">
                {dispositionLabel(d)}
              </Badge>
              {note && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {note}
                </Text>
              )}
            </div>
            {when && (
              <Text size="xsmall" className="shrink-0 text-ui-fg-muted">
                {formatDateTime(when)}
              </Text>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AttemptsList({ attempts }: { attempts: CallAttempt[] }) {
  if (!attempts?.length) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        No prior attempts recorded.
      </Text>
    )
  }
  return (
    <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
      {attempts.map((a, i) => (
        <div
          key={a.id ?? i}
          className="flex items-center justify-between gap-x-3 bg-ui-bg-base px-3 py-2"
        >
          <div className="flex items-center gap-x-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-subtle">
              <Text size="xsmall">{a.attempt_number ?? i + 1}</Text>
            </div>
            {a.status && <StatusBadge status={a.status} />}
            {a.disposition && (
              <Badge size="2xsmall" color="grey">
                {humanize(a.disposition)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-x-3">
            <Text size="xsmall" className="text-ui-fg-muted">
              {formatDuration(a.started_at, a.ended_at)}
            </Text>
            <Text size="xsmall" className="whitespace-nowrap text-ui-fg-muted">
              {formatDateTime(a.started_at ?? a.created_at)}
            </Text>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section card                                                        */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <Container className="flex flex-col gap-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <span className="text-ui-fg-subtle">{icon}</span>
          <Heading level="h3">{title}</Heading>
        </div>
        {action}
      </div>
      {children}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const CallReviewPage = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState<CallDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCall(id)
      setData(res)
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <Container className="p-0">
        <div className="px-6 py-12">
          <Text className="text-ui-fg-subtle">Loading call…</Text>
        </div>
      </Container>
    )
  }

  if (error || !data) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text className="text-ui-fg-error">
            {error ?? "Call not found."}
          </Text>
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => navigate("/call-center/calls")}
            >
              <ArrowLeft />
              Back to calls
            </Button>
            <Button size="small" variant="secondary" onClick={load}>
              <ArrowPath />
              Retry
            </Button>
          </div>
        </div>
      </Container>
    )
  }

  const { call, dispositions, attempts } = data
  const contactNumber =
    call.direction === "inbound" ? call.from_number : call.to_number

  return (
    <div className="flex flex-col gap-y-4">
      {/* Header */}
      <Container className="flex flex-col gap-y-4 p-0">
        <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/call-center/calls")}
            className="flex w-fit items-center gap-x-1 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
          >
            <ArrowLeft />
            <Text size="small">Calls</Text>
          </button>

          <div className="flex flex-col gap-y-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-col gap-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Heading level="h2">
                  {call.direction === "inbound" ? "Inbound" : "Outbound"} call
                </Heading>
                <StatusBadge status={call.status} />
                {call.disposition && (
                  <Badge size="2xsmall" color="blue">
                    {humanize(call.disposition)}
                  </Badge>
                )}
                <SentimentBadge sentiment={call.sentiment} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {contactNumber && (
                  <div className="flex items-center gap-x-1 text-ui-fg-subtle">
                    <Phone className="text-ui-fg-muted" />
                    <Text size="small" className="font-mono">
                      {contactNumber}
                    </Text>
                  </div>
                )}
                {call.locale && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Locale {call.locale}
                  </Text>
                )}
                {call.provider_call_id && (
                  <Text size="xsmall" className="font-mono text-ui-fg-muted">
                    {call.provider_call_id}
                  </Text>
                )}
              </div>
            </div>
            <Tooltip content="Refresh call data">
              <IconButton size="small" variant="transparent" onClick={load}>
                <ArrowPath />
              </IconButton>
            </Tooltip>
          </div>

          {/* Metric strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Metric
              icon={<Clock />}
              label="Duration"
              value={formatDuration(call.started_at, call.ended_at)}
            />
            <Metric
              icon={<CurrencyDollar />}
              label="Cost"
              value={formatCost(call.cost_total)}
            />
            <Metric
              icon={<Phone />}
              label="Started"
              value={formatDateTime(call.started_at)}
            />
            <Metric
              icon={<Phone />}
              label="Ended"
              value={formatDateTime(call.ended_at)}
            />
          </div>

          {/* Recording */}
          <RecordingPlayer url={call.recording_url} />
        </div>
      </Container>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-y-4 lg:col-span-2">
          {/* AI summary */}
          <Section icon={<Sparkles />} title="AI summary">
            {call.summary ? (
              <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
                <Text size="small" className="whitespace-pre-wrap">
                  {call.summary}
                </Text>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                No AI summary was generated for this call.
              </Text>
            )}
          </Section>

          {/* Transcript */}
          <Section
            icon={<ChatBubbleLeftRight />}
            title="Transcript"
            action={
              <Text size="xsmall" className="text-ui-fg-muted">
                {Array.isArray(call.transcript) ? call.transcript.length : 0}{" "}
                turns
              </Text>
            }
          >
            <TranscriptView transcript={call.transcript} />
          </Section>

          {/* Outcomes */}
          <Section icon={<ListCheckbox />} title="Outcome">
            <div className="flex flex-col gap-y-5">
              <div className="flex flex-col gap-y-2">
                <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                  Dispositions
                </Text>
                <DispositionsList
                  dispositions={dispositions}
                  current={call.disposition}
                />
              </div>
              <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-4">
                <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                  Attempts ({attempts?.length ?? 0})
                </Text>
                <AttemptsList attempts={attempts ?? []} />
              </div>
            </div>
          </Section>
        </div>

        {/* Customer-360 side rail */}
        <div className="lg:col-span-1">
          <Customer360
            orderId={call.order_id}
            customerId={call.customer_id}
            fromNumber={call.from_number}
            toNumber={call.to_number}
            direction={call.direction}
          />
        </div>
      </div>
    </div>
  )
}

export default CallReviewPage
