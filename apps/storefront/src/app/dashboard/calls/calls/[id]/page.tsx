"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallCenterCall,
  fetchCallRecordingObjectUrl,
  type CallDetail,
} from "@lib/merchant-admin/api"
import { StatusBadge } from "@components/merchant-admin/status-badge"

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
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function sentimentTone(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (["positive", "happy", "satisfied", "good"].some((k) => v.includes(k)))
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (["negative", "angry", "frustrated", "bad", "upset"].some((k) => v.includes(k)))
    return "bg-red-50 text-red-700 border-red-200"
  return "bg-grey-10 text-grey-70 border-grey-20"
}

/* ------------------------------------------------------------------- pieces */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="border-b border-grey-10 px-4 py-3">
        <h2 className="text-sm font-semibold text-grey-90">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-grey-50">{label}</span>
      <span className="text-right font-medium text-grey-90">{value ?? "—"}</span>
    </div>
  )
}

/* --------------------------------------------------------------------- page */

export default function CallDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const router = useRouter()
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

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.push("/dashboard/calls/calls")}
        className="inline-flex items-center gap-1.5 text-sm text-grey-50 hover:text-grey-90"
      >
        <ArrowLeft className="h-4 w-4" /> Back to calls
      </button>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50">
          Loading call…
        </div>
      )}

      {call && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-grey-90">
                  {call.direction === "inbound" ? "Inbound call" : "Outbound call"}
                </h1>
                <StatusBadge status={call.status} />
                {call.disposition && (
                  <span className="rounded-full border border-grey-20 bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                    {call.disposition.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-grey-50">
                {formatDateTime(call.started_at || call.created_at)} ·{" "}
                {formatDuration(call.started_at, call.ended_at)} · agent{" "}
                {data?.agent?.name ?? "—"}
              </p>
            </div>
            {data?.order && (
              <Link
                href={`/dashboard/orders/${data.order.id}`}
                className="rounded-base border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                View order #{data.order.display_id}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Transcript */}
            <div className="lg:col-span-2 space-y-5">
              <Panel title={`Transcript${transcript.length ? ` (${transcript.length})` : ""}`}>
                {transcript.length === 0 ? (
                  <p className="text-sm text-grey-50">
                    No transcript was captured for this call.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {transcript.map((turn, i) => {
                      const isAgent = turn.role === "assistant"
                      return (
                        <div
                          key={i}
                          className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
                        >
                          <div className="max-w-[80%]">
                            <p
                              className={`mb-0.5 text-[11px] font-medium uppercase tracking-wide ${
                                isAgent ? "text-grey-40" : "text-blue-500 text-right"
                              }`}
                            >
                              {isAgent ? "Agent" : "Customer"}
                            </p>
                            <div
                              className={`rounded-large px-3.5 py-2 text-sm ${
                                isAgent
                                  ? "bg-grey-10 text-grey-90"
                                  : "bg-blue-500 text-white"
                              }`}
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

            {/* Side: analysis + recording + details */}
            <div className="space-y-5">
              <Panel title="Analysis">
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-grey-40">
                      Summary
                    </p>
                    <p className="text-sm text-grey-90">
                      {call.summary || (
                        <span className="text-grey-50">No summary generated for this call.</span>
                      )}
                    </p>
                  </div>
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
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-grey-40">
                        Outcomes
                      </p>
                      <ul className="space-y-1">
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
                  <p className="text-sm text-grey-50">Loading recording…</p>
                ) : (
                  <p className="text-sm text-grey-50">
                    No recording is available for this call.
                  </p>
                )}
              </Panel>

              <Panel title="Details">
                <div className="divide-y divide-grey-10">
                  <Field label="Duration" value={formatDuration(call.started_at, call.ended_at)} />
                  <Field
                    label="Cost"
                    value={`$${(call.cost_total ?? 0).toFixed(2)}`}
                  />
                  <Field label="Direction" value={<span className="capitalize">{call.direction}</span>} />
                  <Field label="From" value={call.from_number || "—"} />
                  <Field label="To" value={call.to_number || "—"} />
                  <Field label="Language" value={call.locale || "—"} />
                  <Field label="Agent" value={data?.agent?.name || "—"} />
                  <Field label="Started" value={formatDateTime(call.started_at)} />
                  <Field label="Ended" value={formatDateTime(call.ended_at)} />
                  <Field
                    label="Call ID"
                    value={<span className="font-mono text-xs">{call.id}</span>}
                  />
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
