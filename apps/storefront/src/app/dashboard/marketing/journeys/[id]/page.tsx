"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowUpMini,
  ArrowDownMini,
  Trash,
  Plus,
  Clock,
  Bolt,
  CommandLine,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Textarea, Select } from "@components/merchant-admin/form-field"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getMarketingJourney,
  updateMarketingJourney,
  deleteMarketingJourney,
  MarketingJourney,
  JourneyStep,
  JourneyCondition,
  JourneyConditionOp,
  JourneyAction,
  ApiError,
} from "@lib/merchant-admin/api"

// ---------------------------------------------------------------------------
// Editor step model. Flat/string-backed for form inputs; serialized to the
// exact backend zod shape in `fromEditorStep`.
// ---------------------------------------------------------------------------

type StepType = "wait" | "condition" | "action"
type DelayUnit = "seconds" | "minutes" | "hours" | "days"
type ActionType = JourneyAction["type"]

type EditorStep = {
  _uid: string
  type: StepType
  label: string
  // wait
  delayValue: string
  delayUnit: DelayUnit
  // condition
  condField: string
  condOp: JourneyConditionOp
  condValue: string
  condOnFail: "exit" | "skip"
  // action
  actionType: ActionType
  a_template_id: string
  a_subject: string
  a_html: string
  a_brief: string
  a_brand_voice_id: string
  a_channel: string
  a_text: string
  a_tag: string
  a_points: string
  a_percentage: string
  a_amount: string
  a_expires_hours: string
  a_url: string
}

const UNIT_SECONDS: Record<DelayUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
}

const CONDITION_OPS: { value: JourneyConditionOp; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: "send_email", label: "Send email" },
  { value: "send_dm", label: "Send DM" },
  { value: "add_tag", label: "Add tag" },
  { value: "remove_tag", label: "Remove tag" },
  { value: "add_score", label: "Add score" },
  { value: "discount", label: "Create discount" },
  { value: "webhook", label: "Call webhook" },
]

let uidCounter = 0
const nextUid = () => `s_${Date.now()}_${uidCounter++}`

function blankStep(type: StepType): EditorStep {
  return {
    _uid: nextUid(),
    type,
    label: "",
    delayValue: "1",
    delayUnit: "hours",
    condField: "",
    condOp: "eq",
    condValue: "",
    condOnFail: "exit",
    actionType: "send_email",
    a_template_id: "",
    a_subject: "",
    a_html: "",
    a_brief: "",
    a_brand_voice_id: "",
    a_channel: "",
    a_text: "",
    a_tag: "",
    a_points: "10",
    a_percentage: "",
    a_amount: "",
    a_expires_hours: "",
    a_url: "",
  }
}

function coerceValue(raw: string): unknown {
  const s = raw.trim()
  if (s === "") return ""
  if (s === "true") return true
  if (s === "false") return false
  const n = Number(s)
  if (!Number.isNaN(n) && /^-?\d*\.?\d+$/.test(s)) return n
  return raw
}

// Backend step -> editor step
function toEditorStep(step: JourneyStep): EditorStep {
  const base = blankStep(step.type)
  base.label = (step as any).label || ""
  if (step.type === "wait") {
    const secs = step.delay_seconds || 0
    let unit: DelayUnit = "seconds"
    if (secs !== 0 && secs % 86400 === 0) unit = "days"
    else if (secs !== 0 && secs % 3600 === 0) unit = "hours"
    else if (secs !== 0 && secs % 60 === 0) unit = "minutes"
    base.delayUnit = unit
    base.delayValue = String(secs / UNIT_SECONDS[unit])
  } else if (step.type === "condition") {
    base.condField = step.condition?.field || ""
    base.condOp = step.condition?.op || "eq"
    base.condValue =
      step.condition?.value === undefined || step.condition?.value === null
        ? ""
        : String(step.condition.value)
    base.condOnFail = step.on_fail || "exit"
  } else if (step.type === "action") {
    const a = step.action as any
    base.actionType = a?.type || "send_email"
    base.a_template_id = a?.template_id ?? ""
    base.a_subject = a?.subject ?? ""
    base.a_html = a?.html ?? ""
    base.a_brief = a?.brief ?? ""
    base.a_brand_voice_id = a?.brand_voice_id ?? ""
    base.a_channel = a?.channel ?? ""
    base.a_text = a?.text ?? ""
    base.a_tag = a?.tag ?? ""
    base.a_points = a?.points !== undefined ? String(a.points) : "10"
    base.a_percentage = a?.percentage !== undefined ? String(a.percentage) : ""
    base.a_amount = a?.amount !== undefined ? String(a.amount) : ""
    base.a_expires_hours =
      a?.expires_hours !== undefined ? String(a.expires_hours) : ""
    base.a_url = a?.url ?? ""
  }
  return base
}

function buildAction(s: EditorStep): JourneyAction {
  switch (s.actionType) {
    case "send_email": {
      const a: any = { type: "send_email" }
      if (s.a_template_id.trim()) a.template_id = s.a_template_id.trim()
      if (s.a_subject.trim()) a.subject = s.a_subject.trim()
      if (s.a_html.trim()) a.html = s.a_html
      if (s.a_brief.trim()) a.brief = s.a_brief.trim()
      if (s.a_brand_voice_id.trim()) a.brand_voice_id = s.a_brand_voice_id.trim()
      return a
    }
    case "send_dm":
      return { type: "send_dm", channel: s.a_channel.trim(), text: s.a_text.trim() }
    case "add_tag":
      return { type: "add_tag", tag: s.a_tag.trim() }
    case "remove_tag":
      return { type: "remove_tag", tag: s.a_tag.trim() }
    case "add_score":
      return { type: "add_score", points: Number(s.a_points || "0") }
    case "discount": {
      const a: any = { type: "discount" }
      if (s.a_percentage.trim() !== "") a.percentage = Number(s.a_percentage)
      if (s.a_amount.trim() !== "") a.amount = Number(s.a_amount)
      if (s.a_expires_hours.trim() !== "")
        a.expires_hours = Number(s.a_expires_hours)
      return a
    }
    case "webhook":
      return { type: "webhook", url: s.a_url.trim() }
  }
}

// Editor step -> backend step (exact zod shape)
function fromEditorStep(s: EditorStep): JourneyStep {
  const label = s.label.trim()
  if (s.type === "wait") {
    const secs = Math.max(
      0,
      Math.round(Number(s.delayValue || "0") * UNIT_SECONDS[s.delayUnit])
    )
    return { type: "wait", delay_seconds: secs, ...(label ? { label } : {}) }
  }
  if (s.type === "condition") {
    const condition: JourneyCondition = { field: s.condField.trim(), op: s.condOp }
    if (s.condOp !== "exists" && s.condOp !== "not_exists") {
      condition.value = coerceValue(s.condValue)
    }
    return {
      type: "condition",
      condition,
      on_fail: s.condOnFail,
      ...(label ? { label } : {}),
    }
  }
  return { type: "action", action: buildAction(s), ...(label ? { label } : {}) }
}

// Client-side guard so we never POST a shape zod will reject.
function validateStep(s: EditorStep): string | null {
  if (s.type === "wait") {
    if (Number.isNaN(Number(s.delayValue))) return "Wait delay must be a number."
    return null
  }
  if (s.type === "condition") {
    if (!s.condField.trim()) return "Condition needs a field."
    return null
  }
  // action
  switch (s.actionType) {
    case "send_dm":
      if (!s.a_channel.trim() || !s.a_text.trim())
        return "Send DM needs a channel and text."
      return null
    case "add_tag":
    case "remove_tag":
      if (!s.a_tag.trim()) return "Tag action needs a tag."
      return null
    case "add_score":
      if (Number.isNaN(Number(s.a_points || "")) || s.a_points.trim() === "")
        return "Add score needs a numeric points value."
      return null
    case "webhook":
      if (!s.a_url.trim()) return "Webhook needs a URL."
      return null
    default:
      return null
  }
}

const TRIGGERS = [
  "order.placed",
  "order.completed",
  "cart.updated",
  "customer.created",
  "manual",
  "segment",
]

const STEP_ICON: Record<StepType, React.ComponentType<{ className?: string }>> = {
  wait: Clock,
  condition: CommandLine,
  action: Bolt,
}

export default function EditJourneyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [journey, setJourney] = useState<MarketingJourney | null>(null)
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerEvent, setTriggerEvent] = useState("manual")
  const [status, setStatus] = useState<"draft" | "active" | "paused" | "archived">(
    "draft"
  )
  const [allowReenroll, setAllowReenroll] = useState(false)
  const [steps, setSteps] = useState<EditorStep[]>([])

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    getMarketingJourney(token, id)
      .then((res) => {
        const j = res.journey
        setJourney(j)
        setEnrollmentCounts(res.enrollment_counts || {})
        setName(j.name)
        setDescription(j.description || "")
        setTriggerEvent(j.trigger_event)
        setStatus((j.status as any) || "draft")
        setAllowReenroll(!!j.allow_reenroll)
        setSteps((Array.isArray(j.steps) ? j.steps : []).map(toEditorStep))
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load journey")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  const addStep = (type: StepType) => setSteps((s) => [...s, blankStep(type)])

  const updateStep = (uid: string, patch: Partial<EditorStep>) =>
    setSteps((s) => s.map((st) => (st._uid === uid ? { ...st, ...patch } : st)))

  const removeStep = (uid: string) =>
    setSteps((s) => s.filter((st) => st._uid !== uid))

  const moveStep = (index: number, dir: -1 | 1) =>
    setSteps((s) => {
      const next = [...s]
      const target = index + dir
      if (target < 0 || target >= next.length) return s
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const persist = async (overrideStatus?: typeof status) => {
    if (!token || !journey) return
    // Validate steps first.
    for (let i = 0; i < steps.length; i++) {
      const err = validateStep(steps[i])
      if (err) {
        setError(`Step ${i + 1}: ${err}`)
        return
      }
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await updateMarketingJourney(token, journey.id, {
        name: name.trim(),
        description: description.trim() || null,
        trigger_event: triggerEvent,
        status: overrideStatus ?? status,
        allow_reenroll: allowReenroll,
        steps: steps.map(fromEditorStep),
      })
      const j = res.journey
      setJourney(j)
      setStatus((j.status as any) || "draft")
      setSteps((Array.isArray(j.steps) ? j.steps : []).map(toEditorStep))
      setMessage("Journey saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save journey")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !journey) return
    if (!window.confirm(`Delete journey "${journey.name}"? This cannot be undone.`))
      return
    try {
      await deleteMarketingJourney(token, journey.id)
      router.push("/dashboard/marketing/journeys")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete journey")
    }
  }

  const toggleActive = () => {
    const nextStatus = status === "active" ? "paused" : "active"
    setStatus(nextStatus)
    persist(nextStatus)
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-grey-50">Loading journey…</div>
  }

  if (!journey) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/marketing/journeys"
          className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to journeys
        </Link>
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Journey not found."}
        </div>
      </div>
    )
  }

  const totalEnrolled = Object.values(enrollmentCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/marketing/journeys"
        className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to journeys
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <PageHeader title={journey.name} description="Build and activate this journey." />
          <StatusBadge status={status} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleActive}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            {status === "active" ? "Pause" : "Activate"}
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-base border border-grey-20 px-4 py-2 text-sm font-medium text-grey-70 hover:bg-grey-5 hover:text-red-600"
          >
            <Trash className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-base border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <SectionCard title="Journey settings">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Trigger event">
            <Select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this journey does"
            />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-grey-70">
            <input
              type="checkbox"
              checked={allowReenroll}
              onChange={(e) => setAllowReenroll(e.target.checked)}
              className="h-4 w-4 rounded border-grey-30"
            />
            Allow re-enrollment
          </label>
          <div className="text-sm text-grey-50">
            Enrolled contacts:{" "}
            <span className="font-medium text-grey-90">{totalEnrolled}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Steps"
        description="Runs top to bottom. Wait pauses; condition gates; action does work."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addStep("wait")}
              className="inline-flex items-center gap-1 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
            >
              <Clock className="h-3.5 w-3.5" /> Wait
            </button>
            <button
              type="button"
              onClick={() => addStep("condition")}
              className="inline-flex items-center gap-1 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
            >
              <CommandLine className="h-3.5 w-3.5" /> Condition
            </button>
            <button
              type="button"
              onClick={() => addStep("action")}
              className="inline-flex items-center gap-1 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
            >
              <Bolt className="h-3.5 w-3.5" /> Action
            </button>
          </div>
        }
      >
        {steps.length === 0 ? (
          <div className="rounded-base border border-dashed border-grey-20 p-8 text-center text-sm text-grey-50">
            No steps yet. Add a wait, condition, or action to build your journey.
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, index) => {
              const Icon = STEP_ICON[step.type]
              return (
                <li
                  key={step._uid}
                  className="rounded-base border border-grey-20 bg-grey-5 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-grey-90 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize text-grey-90">
                        <Icon className="h-4 w-4 text-grey-50" />
                        {step.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                        className="rounded-base border border-grey-20 bg-white p-1.5 text-grey-50 hover:bg-grey-5 disabled:opacity-40"
                        aria-label="Move up"
                      >
                        <ArrowUpMini className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === steps.length - 1}
                        className="rounded-base border border-grey-20 bg-white p-1.5 text-grey-50 hover:bg-grey-5 disabled:opacity-40"
                        aria-label="Move down"
                      >
                        <ArrowDownMini className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(step._uid)}
                        className="rounded-base border border-grey-20 bg-white p-1.5 text-grey-50 hover:bg-white hover:text-red-600"
                        aria-label="Remove step"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {step.type === "wait" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField label="Delay">
                        <Input
                          type="number"
                          min="0"
                          value={step.delayValue}
                          onChange={(e) =>
                            updateStep(step._uid, { delayValue: e.target.value })
                          }
                        />
                      </FormField>
                      <FormField label="Unit">
                        <Select
                          value={step.delayUnit}
                          onChange={(e) =>
                            updateStep(step._uid, {
                              delayUnit: e.target.value as DelayUnit,
                            })
                          }
                        >
                          <option value="seconds">Seconds</option>
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </Select>
                      </FormField>
                      <FormField label="Label (optional)">
                        <Input
                          value={step.label}
                          onChange={(e) =>
                            updateStep(step._uid, { label: e.target.value })
                          }
                        />
                      </FormField>
                    </div>
                  )}

                  {step.type === "condition" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <FormField label="Field">
                          <Input
                            value={step.condField}
                            onChange={(e) =>
                              updateStep(step._uid, { condField: e.target.value })
                            }
                            placeholder="contact.score"
                          />
                        </FormField>
                        <FormField label="Operator">
                          <Select
                            value={step.condOp}
                            onChange={(e) =>
                              updateStep(step._uid, {
                                condOp: e.target.value as JourneyConditionOp,
                              })
                            }
                          >
                            {CONDITION_OPS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        {step.condOp !== "exists" && step.condOp !== "not_exists" && (
                          <FormField label="Value">
                            <Input
                              value={step.condValue}
                              onChange={(e) =>
                                updateStep(step._uid, { condValue: e.target.value })
                              }
                              placeholder="e.g. 100"
                            />
                          </FormField>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField label="On fail">
                          <Select
                            value={step.condOnFail}
                            onChange={(e) =>
                              updateStep(step._uid, {
                                condOnFail: e.target.value as "exit" | "skip",
                              })
                            }
                          >
                            <option value="exit">Exit journey</option>
                            <option value="skip">Skip this step</option>
                          </Select>
                        </FormField>
                        <FormField label="Label (optional)">
                          <Input
                            value={step.label}
                            onChange={(e) =>
                              updateStep(step._uid, { label: e.target.value })
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  )}

                  {step.type === "action" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField label="Action type">
                          <Select
                            value={step.actionType}
                            onChange={(e) =>
                              updateStep(step._uid, {
                                actionType: e.target.value as ActionType,
                              })
                            }
                          >
                            {ACTION_TYPES.map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Label (optional)">
                          <Input
                            value={step.label}
                            onChange={(e) =>
                              updateStep(step._uid, { label: e.target.value })
                            }
                          />
                        </FormField>
                      </div>

                      {step.actionType === "send_email" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FormField label="Template ID (optional)">
                              <Input
                                value={step.a_template_id}
                                onChange={(e) =>
                                  updateStep(step._uid, {
                                    a_template_id: e.target.value,
                                  })
                                }
                              />
                            </FormField>
                            <FormField label="Subject (optional)">
                              <Input
                                value={step.a_subject}
                                onChange={(e) =>
                                  updateStep(step._uid, { a_subject: e.target.value })
                                }
                              />
                            </FormField>
                          </div>
                          <FormField label="Brief for AI copy (optional)">
                            <Input
                              value={step.a_brief}
                              onChange={(e) =>
                                updateStep(step._uid, { a_brief: e.target.value })
                              }
                              placeholder="Tone / what to say"
                            />
                          </FormField>
                          <FormField label="HTML body (optional)">
                            <Textarea
                              value={step.a_html}
                              onChange={(e) =>
                                updateStep(step._uid, { a_html: e.target.value })
                              }
                            />
                          </FormField>
                        </div>
                      )}

                      {step.actionType === "send_dm" && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <FormField label="Channel">
                            <Input
                              value={step.a_channel}
                              onChange={(e) =>
                                updateStep(step._uid, { a_channel: e.target.value })
                              }
                              placeholder="instagram"
                            />
                          </FormField>
                          <FormField label="Text">
                            <Input
                              value={step.a_text}
                              onChange={(e) =>
                                updateStep(step._uid, { a_text: e.target.value })
                              }
                            />
                          </FormField>
                        </div>
                      )}

                      {(step.actionType === "add_tag" ||
                        step.actionType === "remove_tag") && (
                        <FormField label="Tag">
                          <Input
                            value={step.a_tag}
                            onChange={(e) =>
                              updateStep(step._uid, { a_tag: e.target.value })
                            }
                            placeholder="vip"
                          />
                        </FormField>
                      )}

                      {step.actionType === "add_score" && (
                        <FormField label="Points">
                          <Input
                            type="number"
                            value={step.a_points}
                            onChange={(e) =>
                              updateStep(step._uid, { a_points: e.target.value })
                            }
                          />
                        </FormField>
                      )}

                      {step.actionType === "discount" && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <FormField label="Percentage (optional)">
                            <Input
                              type="number"
                              value={step.a_percentage}
                              onChange={(e) =>
                                updateStep(step._uid, {
                                  a_percentage: e.target.value,
                                })
                              }
                            />
                          </FormField>
                          <FormField label="Amount (optional)">
                            <Input
                              type="number"
                              value={step.a_amount}
                              onChange={(e) =>
                                updateStep(step._uid, { a_amount: e.target.value })
                              }
                            />
                          </FormField>
                          <FormField label="Expires (hours, optional)">
                            <Input
                              type="number"
                              value={step.a_expires_hours}
                              onChange={(e) =>
                                updateStep(step._uid, {
                                  a_expires_hours: e.target.value,
                                })
                              }
                            />
                          </FormField>
                        </div>
                      )}

                      {step.actionType === "webhook" && (
                        <FormField label="URL">
                          <Input
                            value={step.a_url}
                            onChange={(e) =>
                              updateStep(step._uid, { a_url: e.target.value })
                            }
                            placeholder="https://example.com/hook"
                          />
                        </FormField>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-grey-50">
            {steps.length} step{steps.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => persist()}
            disabled={saving || !name.trim()}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save journey"}
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
