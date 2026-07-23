"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowDownLeftMini,
  ArrowLeftMini,
  ArrowUpRightMini,
  ArrowUpRightOnBox,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallCenterCall,
  fetchCallRecordingObjectUrl,
  type CallDetail,
} from "@lib/merchant-admin/api"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { cn } from "@lib/util/cn"

/* ------------------------------------------------------------------ helpers */

function formatDateTime(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—"
  const secs = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function sentimentTone(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (["positive", "happy", "satisfied", "good"].some((k) => v.includes(k)))
    return "bg-emerald-50 text-emerald-800 border-emerald-200"
  if (["negative", "angry", "frustrated", "bad", "upset"].some((k) => v.includes(k)))
    return "bg-rose-50 text-rose-800 border-rose-200"
  return "bg-grey-10 text-grey-70 border-grey-20"
}

/* ------------------------------------------------------------------- pieces */

function DirectionPill({ direction }: { direction?: string | null }) {
  const inbound = direction === "inbound"
  const Icon = inbound ? ArrowDownLeftMini : ArrowUpRightMini
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        inbound ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {direction || "outbound"}
    </span>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="border-b border-grey-10 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-grey-90">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-grey-50">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-grey-50">{label}</span>
      <span className="min-w-0 text-right font-medium text-grey-90">{value ?? "—"}</span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-base bg-grey-10" />
        <div className="h-4 w-80 animate-pulse rounded-base bg-grey-10" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
            >
              <div className="mb-4 h-4 w-32 animate-pulse rounded-base bg-grey-10" />
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded-base bg-grey-10" />
                <div className="h-4 w-5/6 animate-pulse rounded-base bg-grey-10" />
                <div className="h-4 w-2/3 animate-pulse rounded-base bg-grey-10" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
            >
              <div className="mb-4 h-4 w-24 animate-pulse rounded-base bg-grey-10" />
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded-base bg-grey-10" />
                <div className="h-4 w-4/5 animate-pulse rounded-base bg-grey-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- page */

export default function CallDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const { token } = useMerchantAuth()
  const [data, setData] = useState<CallDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    getCallCenterCall(token, id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load call"))
      .finally(() => setLoading(false))
  }, [token, id])

  // Fetch the WAV recording as an authenticated blob (only when one exists).
  useEffect(() => {
    if (!token || !id || !data?.has_recording) return
    let alive = true
    let url: string | null = null
    fetchCallRecordingObjectUrl(token, id)
      .then((u) => {
        url = u
        if (alive) setRecordingUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [token, id, data?.has_recording])

  const call = data?.call
  // Only show what was actually SPOKEN. The raw transcript also contains the
  // model's tool-call stubs (assistant turns with no text) and tool results
  // (role "tool" — the JSON blobs), which are internal, not conversation.
  const transcript = (Array.isArray(call?.transcript) ? call!.transcript! : []).filter(
    (t) =>
      (t.role === "assistant" || t.role === "user") &&
      typeof t.content === "string" &&
      t.content.trim().length > 0
  )

  const counterpartNumber = call
    ? call.direction === "inbound"
      ? call.from_number || call.to_number
      : call.to_number || call.from_number
    : null

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/calls/calls"
        className="inline-flex items-center gap-1.5 text-sm text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" /> Back to calls
      </Link>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data && <DetailSkeleton />}

      {call && (
        <>
          {/* Case header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-mono text-xl font-semibold tracking-tight text-grey-90">
                  {counterpartNumber || "Unknown number"}
                </h1>
                <DirectionPill direction={call.direction} />
                <StatusBadge status={call.status} />
                {call.disposition && (
                  <span className="rounded-full border border-grey-20 bg-grey-10 px-2 py-0.5 text-xs font-medium capitalize text-grey-70">
                    {call.disposition.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-grey-50">
                Started {formatDateTime(call.started_at || call.created_at)}
                <span className="mx-1.5 text-grey-30">·</span>
                {formatDuration(call.started_at, call.ended_at)} duration
                <span className="mx-1.5 text-grey-30">·</span>
                Agent {data?.agent?.name ?? "—"}
              </p>
            </div>
            {data?.order && (
              <Link
                href={`/dashboard/orders/${data.order.id}`}
                className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 shadow-borders-base transition-colors hover:bg-grey-5"
              >
                View order #{data.order.display_id}
                <ArrowUpRightOnBox className="h-4 w-4 text-grey-50" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Main: summary + transcript */}
            <div className="space-y-5 lg:col-span-2">
              <Panel title="Summary" description="AI-generated recap of the conversation.">
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-grey-90">
                    {call.summary || (
                      <span className="text-grey-50">No summary generated for this call.</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-grey-40">
                      Sentiment
                    </p>
                    {call.sentiment ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${sentimentTone(
                          call.sentiment
                        )}`}
                      >
                        {call.sentiment}
                      </span>
                    ) : (
                      <span className="text-xs text-grey-50">Not analyzed</span>
                    )}
                  </div>
                  {(data?.dispositions?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-grey-40">
                        Outcomes
                      </p>
                      <ul className="space-y-1.5">
                        {data!.dispositions.map((d) => (
                          <li key={d.id} className="text-sm text-grey-90">
                            <span className="font-medium capitalize">
                              {d.outcome.replace(/_/g, " ")}
                            </span>
                            {d.notes ? <span className="text-grey-50"> — {d.notes}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title={`Transcript${transcript.length ? ` (${transcript.length} turns)` : ""}`}
                description="What was spoken on the call, in order."
              >
                {transcript.length === 0 ? (
                  <p className="text-sm text-grey-50">
                    No transcript was captured for this call.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {transcript.map((turn, i) => {
                      const isAgent = turn.role === "assistant"
                      return (
                        <div
                          key={i}
                          className={cn("flex", isAgent ? "justify-start" : "justify-end")}
                        >
                          <div className="max-w-[80%]">
                            <p
                              className={cn(
                                "mb-1 text-[11px] font-medium uppercase tracking-wide",
                                isAgent ? "text-grey-40" : "text-right text-grey-40"
                              )}
                            >
                              {isAgent ? "Agent" : "Customer"}
                            </p>
                            <div
                              className={cn(
                                "rounded-large px-3.5 py-2 text-sm leading-relaxed",
                                isAgent
                                  ? "bg-grey-10 text-grey-90"
                                  : "bg-grey-90 text-white"
                              )}
                            >
                              {turn.content}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            </div>

            {/* Side: recording + metadata */}
            <div className="space-y-5">
              <Panel title="Recording">
                {recordingUrl || call.recording_url ? (
                  <audio
                    controls
                    className="w-full"
                    src={recordingUrl || call.recording_url || undefined}
                  >
                    Your browser does not support audio playback.
                  </audio>
                ) : data?.has_recording ? (
                  <div className="h-10 w-full animate-pulse rounded-base bg-grey-10" />
                ) : (
                  <p className="text-sm text-grey-50">
                    No recording is available for this call.
                  </p>
                )}
              </Panel>

              <Panel title="Details">
                <div className="divide-y divide-grey-10">
                  <Field
                    label="Duration"
                    value={
                      <span className="tabular-nums">
                        {formatDuration(call.started_at, call.ended_at)}
                      </span>
                    }
                  />
                  <Field
                    label="Direction"
                    value={<span className="capitalize">{call.direction}</span>}
                  />
                  <Field
                    label="From"
                    value={
                      call.from_number ? (
                        <span className="font-mono text-[13px]">{call.from_number}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="To"
                    value={
                      call.to_number ? (
                        <span className="font-mono text-[13px]">{call.to_number}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label="Language" value={call.locale || "—"} />
                  <Field label="Agent" value={data?.agent?.name || "—"} />
                  <Field
                    label="Campaign"
                    value={
                      call.campaign_id ? (
                        <span className="break-all font-mono text-xs">{call.campaign_id}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field
                    label="Disposition"
                    value={
                      call.disposition ? (
                        <span className="capitalize">{call.disposition.replace(/_/g, " ")}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label="Started" value={formatDateTime(call.started_at)} />
                  <Field label="Ended" value={formatDateTime(call.ended_at)} />
                  <Field
                    label="Call ID"
                    value={<span className="break-all font-mono text-xs">{call.id}</span>}
                  />
                  {data?.order && (
                    <Field
                      label="Order"
                      value={
                        <Link
                          href={`/dashboard/orders/${data.order.id}`}
                          className="inline-flex items-center gap-1 font-medium text-grey-90 underline decoration-grey-30 underline-offset-2 hover:decoration-grey-90"
                        >
                          #{data.order.display_id}
                        </Link>
                      }
                    />
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
