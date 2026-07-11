/**
 * Marketing — Journey Flow (visual builder).
 *
 * A visual alternative to the form-based Journeys editor: it renders a journey
 * as a clean vertical node graph — a trigger node at the top, each step as a
 * color-accented node card connected by an inline-SVG vertical connector with
 * "+" insert buttons between them, and an exit node at the bottom. Clicking a
 * node expands its field editor in place. The assembled `steps` array is
 * serialized to exactly the same JourneyStep union the runner parses, so it is
 * fully interchangeable with the classic editor.
 *
 * Self-contained: inline fetch helper + types + step shapes, built on the
 * shared marketing ui-kit. No graph/drag libraries — plain React + CSS + SVG.
 *
 * APIs (all under /admin/marketing):
 *   GET    /journeys?status=&trigger_event=   → { journeys, count }
 *   POST   /journeys                          → { journey }  (create)
 *   GET    /journeys/:id                       → { journey, enrollment_counts }
 *   POST   /journeys/:id                       → { journey }  (partial update)
 *   POST   /journeys/:id/activate  { status }  → { journey }
 *   DELETE /journeys/:id
 *   GET    /brand-voice                        → { brand_voices }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  CodeBranch,
  Plus,
  PlusMini,
  Trash,
  ArrowUpMini,
  ArrowDownMini,
  Clock,
  Bolt,
  Envelope,
  Tag,
  Hashtag,
  Sparkles,
  ChatBubble,
  ReceiptPercent,
  PlaySolid,
  Pause,
  RocketLaunch,
  CheckCircle,
  XMarkMini,
  Link as LinkIcon,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  IconButton,
  Input,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
  usePrompt,
  clx,
} from "@medusajs/ui"
import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import {
  AccentIcon,
  ACCENTS,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatusDot,
  type AccentKey,
} from "../_components/ui-kit"

/* ------------------------------------------------------------------ *
 * Types — mirror journey/types.ts exactly
 * ------------------------------------------------------------------ */

type Trigger =
  | "order.placed"
  | "order.completed"
  | "cart.updated"
  | "customer.created"
  | "manual"
  | "segment"

type JourneyStatus = "draft" | "active" | "paused"

type ConditionOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "contains"

type JourneyAction =
  | {
      type: "send_email"
      template_id?: string
      subject?: string
      html?: string
      brief?: string
      brand_voice_id?: string
    }
  | { type: "send_dm"; channel: string; text: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "add_score"; points: number }
  | { type: "discount"; percentage?: number; expires_hours?: number }
  | { type: "webhook"; url: string }

type WaitStep = { type: "wait"; delay_seconds: number; label?: string }
type ConditionStep = {
  type: "condition"
  condition: { field: string; op: ConditionOp; value?: string }
  on_fail?: "exit" | "skip"
  label?: string
}
type ActionStep = { type: "action"; action: JourneyAction; label?: string }

type JourneyStep = WaitStep | ConditionStep | ActionStep
type StepType = JourneyStep["type"]

type Journey = {
  id: string
  name: string
  description?: string
  trigger_event: Trigger
  steps: JourneyStep[]
  status: JourneyStatus
  allow_reenroll: boolean
  created_at?: string
}

type EnrollmentCounts = {
  active?: number
  completed?: number
  failed?: number
  [k: string]: number | undefined
}

type BrandVoice = { id: string; name: string }

/* ------------------------------------------------------------------ *
 * Fetch helper
 * ------------------------------------------------------------------ */

const api = async <T = any,>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> => {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(`/admin/marketing${path}`, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      (payload as any)?.message ||
      (payload as any)?.error ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return payload as T
}

/* ------------------------------------------------------------------ *
 * Constants + small helpers
 * ------------------------------------------------------------------ */

const TRIGGERS: { value: Trigger; label: string }[] = [
  { value: "order.placed", label: "Order placed" },
  { value: "order.completed", label: "Order completed" },
  { value: "cart.updated", label: "Cart updated" },
  { value: "customer.created", label: "Customer created" },
  { value: "manual", label: "Manual" },
  { value: "segment", label: "Segment" },
]

const triggerLabel = (t: Trigger): string =>
  TRIGGERS.find((x) => x.value === t)?.label ?? t

const OPS: { value: ConditionOp; label: string; symbol: string }[] = [
  { value: "eq", label: "= equals", symbol: "=" },
  { value: "neq", label: "≠ not equals", symbol: "≠" },
  { value: "gt", label: "> greater than", symbol: ">" },
  { value: "gte", label: "≥ greater/equal", symbol: "≥" },
  { value: "lt", label: "< less than", symbol: "<" },
  { value: "lte", label: "≤ less/equal", symbol: "≤" },
  { value: "exists", label: "exists", symbol: "exists" },
  { value: "not_exists", label: "does not exist", symbol: "is missing" },
  { value: "contains", label: "contains", symbol: "contains" },
]

const opSymbol = (op: ConditionOp): string =>
  OPS.find((o) => o.value === op)?.symbol ?? op

const opNeedsValue = (op: ConditionOp): boolean =>
  op !== "exists" && op !== "not_exists"

const ACTION_TYPES: { value: JourneyAction["type"]; label: string }[] = [
  { value: "send_email", label: "Send email" },
  { value: "send_dm", label: "Send DM" },
  { value: "add_tag", label: "Add tag" },
  { value: "remove_tag", label: "Remove tag" },
  { value: "add_score", label: "Add score" },
  { value: "discount", label: "Give discount" },
  { value: "webhook", label: "Call webhook" },
]

const STATUS_TONE: Record<
  JourneyStatus,
  "green" | "amber" | "rose" | "blue" | "violet" | "slate"
> = {
  draft: "slate",
  active: "green",
  paused: "amber",
}

const STATUS_LABEL: Record<JourneyStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
}

/* wait decompose / compose (mirrors the classic editor) */
type WaitUnit = "minutes" | "hours" | "days"
const decomposeWait = (secs: number): { value: number; unit: WaitUnit } => {
  const s = Math.max(0, Number(secs) || 0)
  if (s && s % 86400 === 0) {
    return { value: s / 86400, unit: "days" }
  }
  if (s && s % 3600 === 0) {
    return { value: s / 3600, unit: "hours" }
  }
  return { value: Math.round(s / 60) || 0, unit: "minutes" }
}
const composeWait = (value: number, unit: WaitUnit): number => {
  const m = unit === "days" ? 86400 : unit === "hours" ? 3600 : 60
  return (Number(value) || 0) * m
}
const humanWait = (secs: number): string => {
  const { value, unit } = decomposeWait(secs)
  const u = value === 1 ? unit.replace(/s$/, "") : unit
  return `${value} ${u}`
}

/* Node meta — flow accents: wait=blue, condition=amber, action=violet */
const STEP_META: Record<StepType, { icon: any; accent: AccentKey; label: string }> =
  {
    wait: { icon: Clock, accent: "blue", label: "Wait" },
    condition: { icon: CodeBranch, accent: "amber", label: "Condition" },
    action: { icon: Bolt, accent: "violet", label: "Action" },
  }

const ACTION_ICON: Record<JourneyAction["type"], any> = {
  send_email: Envelope,
  send_dm: ChatBubble,
  add_tag: Tag,
  remove_tag: Tag,
  add_score: Hashtag,
  discount: ReceiptPercent,
  webhook: LinkIcon,
}

const defaultAction = (t: JourneyAction["type"]): JourneyAction => {
  switch (t) {
    case "send_email":
      return { type: "send_email", subject: "", html: "" }
    case "send_dm":
      return { type: "send_dm", channel: "email", text: "" }
    case "add_tag":
      return { type: "add_tag", tag: "" }
    case "remove_tag":
      return { type: "remove_tag", tag: "" }
    case "add_score":
      return { type: "add_score", points: 10 }
    case "discount":
      return { type: "discount", percentage: 10, expires_hours: 72 }
    case "webhook":
      return { type: "webhook", url: "" }
  }
}

const newStep = (t: StepType): JourneyStep => {
  if (t === "wait") {
    return { type: "wait", delay_seconds: 3600 }
  }
  if (t === "condition") {
    return {
      type: "condition",
      condition: { field: "", op: "gte", value: "" },
      on_fail: "exit",
    }
  }
  return { type: "action", action: defaultAction("send_email") }
}

/* Node icon: actions get an action-type icon */
const nodeIcon = (step: JourneyStep): any =>
  step.type === "action" ? ACTION_ICON[step.action.type] : STEP_META[step.type].icon

/* One-line human summary for a node card. */
const nodeSummary = (step: JourneyStep): string => {
  if (step.type === "wait") {
    return `Wait ${humanWait(step.delay_seconds)}`
  }
  if (step.type === "condition") {
    const c = step.condition
    const field = c.field || "field"
    const tail = opNeedsValue(c.op) ? `${opSymbol(c.op)} ${c.value ?? ""}` : opSymbol(c.op)
    const onFail = step.on_fail === "skip" ? "skip" : "exit"
    return `If ${field} ${tail} · else ${onFail}`.replace(/\s+/g, " ").trim()
  }
  const a = step.action
  switch (a.type) {
    case "send_email":
      return `Send email: ${a.subject || a.brief || "(no subject)"}`
    case "send_dm":
      return `DM via ${a.channel || "channel"}`
    case "add_tag":
      return `Add tag "${a.tag || "…"}"`
    case "remove_tag":
      return `Remove tag "${a.tag || "…"}"`
    case "add_score":
      return `Add ${a.points} points`
    case "discount":
      return `Give ${a.percentage ?? "?"}% discount`
    case "webhook":
      return `Call webhook`
  }
}

/* Client-side templates */
const TEMPLATES: {
  key: string
  name: string
  description: string
  trigger: Trigger
  steps: JourneyStep[]
}[] = [
  {
    key: "welcome",
    name: "Welcome series",
    description: "Greet new customers and tag them once onboarded.",
    trigger: "customer.created",
    steps: [
      { type: "wait", delay_seconds: 3600 },
      {
        type: "action",
        action: {
          type: "send_email",
          subject: "Welcome to the family",
          brief: "Warm welcome, introduce the brand, invite first purchase.",
        },
      },
      { type: "action", action: { type: "add_tag", tag: "welcomed" } },
    ],
  },
  {
    key: "winback",
    name: "Win-back",
    description: "Re-engage lapsed customers with an escalating incentive.",
    trigger: "segment",
    steps: [
      {
        type: "action",
        action: {
          type: "send_email",
          subject: "We miss you",
          brief: "Gentle re-engagement, remind them what they loved.",
        },
      },
      { type: "wait", delay_seconds: 259200 },
      {
        type: "action",
        action: { type: "discount", percentage: 15, expires_hours: 72 },
      },
    ],
  },
  {
    key: "postpurchase",
    name: "Post-purchase",
    description: "Thank buyers, wait, then ask for a review.",
    trigger: "order.completed",
    steps: [
      {
        type: "action",
        action: {
          type: "send_email",
          subject: "Thanks for your order",
          brief: "Thank the customer and set delivery expectations.",
        },
      },
      { type: "wait", delay_seconds: 604800 },
      {
        type: "action",
        action: {
          type: "send_email",
          subject: "How did we do?",
          brief: "Ask for a product review, keep it short and friendly.",
        },
      },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * Editor form shape
 * ------------------------------------------------------------------ */

type EditorForm = {
  id: string | null
  name: string
  description: string
  trigger_event: Trigger
  status: JourneyStatus
  allow_reenroll: boolean
  steps: JourneyStep[]
}

const blankForm = (): EditorForm => ({
  id: null,
  name: "",
  description: "",
  trigger_event: "customer.created",
  status: "draft",
  allow_reenroll: false,
  steps: [],
})

const formFromJourney = (j: Journey): EditorForm => ({
  id: j.id,
  name: j.name ?? "",
  description: j.description ?? "",
  trigger_event: j.trigger_event,
  status: j.status ?? "draft",
  allow_reenroll: !!j.allow_reenroll,
  steps: Array.isArray(j.steps) ? j.steps : [],
})

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const FlowPage = () => {
  const prompt = usePrompt()

  const [journeys, setJourneys] = useState<Journey[]>([])
  const [count, setCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [form, setForm] = useState<EditorForm | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)

  const [counts, setCounts] = useState<EnrollmentCounts | null>(null)
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([])

  /* ---- loaders ---- */
  const loadList = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const qs = new URLSearchParams()
      if (statusFilter !== "all") {
        qs.set("status", statusFilter)
      }
      const q = qs.toString()
      const data = await api<{ journeys: Journey[]; count: number }>(
        `/journeys${q ? `?${q}` : ""}`
      )
      setJourneys(Array.isArray(data.journeys) ? data.journeys : [])
      setCount(Number(data.count ?? 0))
    } catch (e: any) {
      setListError(e?.message ?? "Failed to load journeys.")
    } finally {
      setListLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    api<{ brand_voices: BrandVoice[] }>("/brand-voice")
      .then((d) =>
        setBrandVoices(Array.isArray(d.brand_voices) ? d.brand_voices : [])
      )
      .catch(() => setBrandVoices([]))
  }, [])

  const openJourney = useCallback(async (id: string) => {
    setDetailLoading(true)
    setCounts(null)
    try {
      const d = await api<{
        journey: Journey
        enrollment_counts: EnrollmentCounts
      }>(`/journeys/${id}`)
      setForm(formFromJourney(d.journey))
      setCounts(d.enrollment_counts ?? null)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open journey.")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const startNew = useCallback((seed?: EditorForm) => {
    setForm(seed ?? blankForm())
    setCounts(null)
  }, [])

  /* ---- form mutators ---- */
  const patch = useCallback((p: Partial<EditorForm>) => {
    setForm((f) => (f ? { ...f, ...p } : f))
  }, [])

  const setStep = useCallback((index: number, next: JourneyStep) => {
    setForm((f) =>
      f ? { ...f, steps: f.steps.map((s, i) => (i === index ? next : s)) } : f
    )
  }, [])

  const insertStep = useCallback((index: number, t: StepType) => {
    setForm((f) => {
      if (!f) {
        return f
      }
      const steps = [...f.steps]
      const at = Math.max(0, Math.min(index, steps.length))
      steps.splice(at, 0, newStep(t))
      return { ...f, steps }
    })
  }, [])

  const removeStep = useCallback((index: number) => {
    setForm((f) =>
      f ? { ...f, steps: f.steps.filter((_, i) => i !== index) } : f
    )
  }, [])

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setForm((f) => {
      if (!f) {
        return f
      }
      const to = index + dir
      if (to < 0 || to >= f.steps.length) {
        return f
      }
      const steps = [...f.steps]
      const [moved] = steps.splice(index, 1)
      steps.splice(to, 0, moved)
      return { ...f, steps }
    })
  }, [])

  /* ---- save ---- */
  const onSave = useCallback(async () => {
    if (!form) {
      return
    }
    if (!form.name.trim()) {
      toast.error("Give the journey a name first.")
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        trigger_event: form.trigger_event,
        steps: form.steps,
        allow_reenroll: form.allow_reenroll,
      }
      const path = form.id ? `/journeys/${form.id}` : "/journeys"
      const d = await api<{ journey: Journey }>(path, {
        method: "POST",
        json: body,
      })
      setForm(formFromJourney(d.journey))
      toast.success(form.id ? "Journey saved." : "Journey created.")
      loadList()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save the journey.")
    } finally {
      setSaving(false)
    }
  }, [form, loadList])

  /* ---- status control ---- */
  const onSetStatus = useCallback(
    async (status: JourneyStatus) => {
      if (!form?.id) {
        toast.error("Save the journey before changing its status.")
        return
      }
      setStatusSaving(true)
      try {
        const d = await api<{ journey: Journey }>(
          `/journeys/${form.id}/activate`,
          { method: "POST", json: { status } }
        )
        patch({ status: d.journey?.status ?? status })
        toast.success(`Journey ${STATUS_LABEL[status].toLowerCase()}.`)
        loadList()
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to change status.")
      } finally {
        setStatusSaving(false)
      }
    },
    [form?.id, patch, loadList]
  )

  /* ---- delete ---- */
  const onDelete = useCallback(async () => {
    if (!form?.id) {
      setForm(null)
      return
    }
    const ok = await prompt({
      title: "Delete journey",
      description: `"${
        form.name || "Untitled"
      }" and its enrollments will be removed. This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (!ok) {
      return
    }
    try {
      await api(`/journeys/${form.id}`, { method: "DELETE" })
      toast.success("Journey deleted.")
      setForm(null)
      setCounts(null)
      loadList()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete the journey.")
    }
  }, [form, prompt, loadList])

  const selectedId = form?.id ?? null

  return (
    <Container className="p-0">
      <PageHeader
        icon={CodeBranch}
        accent="violet"
        title="Journey Flow"
        subtitle="Build lifecycle automations as a visual node graph — trigger, steps, exit."
        actions={
          <Button size="small" variant="primary" onClick={() => startNew()}>
            <Plus />
            New journey
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-6 pb-10 lg:grid-cols-[320px_1fr]">
        {/* ---------------- LEFT: list ---------------- */}
        <div className="flex flex-col gap-y-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <Select.Trigger>
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              <Select.Item value="draft">Draft</Select.Item>
              <Select.Item value="active">Active</Select.Item>
              <Select.Item value="paused">Paused</Select.Item>
            </Select.Content>
          </Select>

          <SectionLabel count={count}>Journeys</SectionLabel>

          <div className="flex flex-col gap-y-2">
            {listLoading ? (
              <Text size="small" className="px-1 text-ui-fg-muted">
                Loading…
              </Text>
            ) : listError ? (
              <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
                <EmptyState
                  icon={CodeBranch}
                  accent="rose"
                  title="Couldn't load journeys"
                  description={listError}
                  action={
                    <Button size="small" variant="secondary" onClick={loadList}>
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : journeys.length === 0 ? (
              <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
                <EmptyState
                  icon={CodeBranch}
                  accent="violet"
                  title="No journeys yet"
                  description="Create one from scratch or start from a template."
                  action={
                    <Button size="small" onClick={() => startNew()}>
                      <Plus />
                      New journey
                    </Button>
                  }
                />
              </div>
            ) : (
              journeys.map((j) => {
                const active = j.id === selectedId
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => openJourney(j.id)}
                    className={clx(
                      "w-full rounded-xl border bg-ui-bg-base px-3 py-3 text-left transition-colors",
                      active
                        ? "border-ui-border-interactive ring-1 ring-ui-border-interactive"
                        : "border-ui-border-base hover:bg-ui-bg-base-hover"
                    )}
                  >
                    <div className="flex items-start justify-between gap-x-2">
                      <Text
                        weight="plus"
                        size="small"
                        className="truncate text-ui-fg-base"
                      >
                        {j.name || "Untitled"}
                      </Text>
                      <StatusDot tone={STATUS_TONE[j.status] ?? "slate"}>
                        {STATUS_LABEL[j.status] ?? j.status}
                      </StatusDot>
                    </div>
                    <div className="mt-2 flex items-center gap-x-2">
                      <Badge size="2xsmall" color="grey">
                        {triggerLabel(j.trigger_event)}
                      </Badge>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {j.steps?.length ?? 0} step
                        {(j.steps?.length ?? 0) === 1 ? "" : "s"}
                      </Text>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Templates */}
          <div className="mt-2">
            <SectionLabel>Start from a template</SectionLabel>
            <div className="flex flex-col gap-y-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() =>
                    startNew({
                      id: null,
                      name: tpl.name,
                      description: tpl.description,
                      trigger_event: tpl.trigger,
                      status: "draft",
                      allow_reenroll: false,
                      steps: tpl.steps.map((s) => ({ ...s })),
                    })
                  }
                  className="flex items-start gap-x-2.5 rounded-xl border border-dashed border-ui-border-strong bg-ui-bg-subtle px-3 py-2.5 text-left hover:bg-ui-bg-base-hover"
                >
                  <AccentIcon icon={Sparkles} accent="teal" size={28} />
                  <div className="flex flex-col">
                    <Text size="small" weight="plus" className="text-ui-fg-base">
                      {tpl.name}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {tpl.description}
                    </Text>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT: flow canvas ---------------- */}
        <div>
          {!form ? (
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
              <EmptyState
                icon={CodeBranch}
                accent="violet"
                title="Select a journey to edit"
                description="Pick a journey on the left, create a new one, or start from a template."
                action={
                  <Button size="small" onClick={() => startNew()}>
                    <Plus />
                    New journey
                  </Button>
                }
              />
            </div>
          ) : detailLoading ? (
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base px-6 py-10">
              <Text size="small" className="text-ui-fg-muted">
                Loading journey…
              </Text>
            </div>
          ) : (
            <FlowCanvas
              form={form}
              saving={saving}
              statusSaving={statusSaving}
              counts={counts}
              brandVoices={brandVoices}
              onPatch={patch}
              onSetStep={setStep}
              onInsertStep={insertStep}
              onRemoveStep={removeStep}
              onMoveStep={moveStep}
              onSave={onSave}
              onSetStatus={onSetStatus}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ *
 * Flow canvas
 * ------------------------------------------------------------------ */

const FlowCanvas = ({
  form,
  saving,
  statusSaving,
  counts,
  brandVoices,
  onPatch,
  onSetStep,
  onInsertStep,
  onRemoveStep,
  onMoveStep,
  onSave,
  onSetStatus,
  onDelete,
}: {
  form: EditorForm
  saving: boolean
  statusSaving: boolean
  counts: EnrollmentCounts | null
  brandVoices: BrandVoice[]
  onPatch: (p: Partial<EditorForm>) => void
  onSetStep: (i: number, next: JourneyStep) => void
  onInsertStep: (i: number, t: StepType) => void
  onRemoveStep: (i: number) => void
  onMoveStep: (i: number, dir: -1 | 1) => void
  onSave: () => void
  onSetStatus: (s: JourneyStatus) => void
  onDelete: () => void
}) => {
  const saved = !!form.id
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [addAt, setAddAt] = useState<number | null>(null)

  const insert = (index: number, t: StepType) => {
    onInsertStep(index, t)
    setAddAt(null)
    // open the newly inserted node
    setOpenIndex(index)
  }

  return (
    <div className="flex flex-col gap-y-5">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            value={form.name}
            placeholder="Untitled journey"
            className="text-base font-semibold"
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-x-2">
          {(["draft", "active", "paused"] as JourneyStatus[]).map((s) => {
            const on = form.status === s
            return (
              <Button
                key={s}
                size="small"
                variant={on ? "primary" : "secondary"}
                disabled={!saved || statusSaving}
                onClick={() => onSetStatus(s)}
              >
                {s === "active" ? (
                  <PlaySolid />
                ) : s === "paused" ? (
                  <Pause />
                ) : null}
                {STATUS_LABEL[s]}
              </Button>
            )
          })}
          <IconButton
            size="small"
            variant="transparent"
            onClick={onDelete}
            aria-label="Delete journey"
          >
            <Trash />
          </IconButton>
          <Button
            size="small"
            variant="primary"
            onClick={onSave}
            isLoading={saving}
          >
            {saved ? "Save" : "Create"}
          </Button>
        </div>
      </div>

      {/* Stats chip row */}
      {saved && (
        <div className="flex flex-wrap items-center gap-2">
          <StatChip
            label="Active"
            value={counts?.active ?? 0}
            accent="blue"
          />
          <StatChip
            label="Completed"
            value={counts?.completed ?? 0}
            accent="green"
          />
          <StatChip label="Failed" value={counts?.failed ?? 0} accent="rose" />
        </div>
      )}

      {/* The canvas */}
      <div className="rounded-2xl border border-ui-border-base bg-ui-bg-subtle p-6">
        <div className="mx-auto flex max-w-[560px] flex-col items-stretch">
          {/* Trigger node */}
          <TriggerNode
            triggerEvent={form.trigger_event}
            allowReenroll={form.allow_reenroll}
            description={form.description}
            onChangeTrigger={(t) => onPatch({ trigger_event: t })}
            onChangeReenroll={(v) => onPatch({ allow_reenroll: v })}
            onChangeDescription={(v) => onPatch({ description: v })}
          />

          {/* Connector + insert at 0 */}
          <Connector
            open={addAt === 0}
            onToggle={() => setAddAt((v) => (v === 0 ? null : 0))}
            onPick={(t) => insert(0, t)}
          />

          {/* Step nodes */}
          {form.steps.map((step, i) => (
            <div key={i} className="flex flex-col items-stretch">
              <StepNode
                index={i}
                total={form.steps.length}
                step={step}
                open={openIndex === i}
                brandVoices={brandVoices}
                onToggle={() =>
                  setOpenIndex((v) => (v === i ? null : i))
                }
                onChange={(next) => onSetStep(i, next)}
                onRemove={() => {
                  onRemoveStep(i)
                  setOpenIndex(null)
                }}
                onMove={(dir) => onMoveStep(i, dir)}
              />
              <Connector
                open={addAt === i + 1}
                onToggle={() =>
                  setAddAt((v) => (v === i + 1 ? null : i + 1))
                }
                onPick={(t) => insert(i + 1, t)}
              />
            </div>
          ))}

          {/* Exit node */}
          <ExitNode empty={form.steps.length === 0} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Canvas pieces
 * ------------------------------------------------------------------ */

const StatChip = ({
  label,
  value,
  accent,
}: {
  label: string
  value: ReactNode
  accent: AccentKey
}) => {
  const c = ACCENTS[accent]
  return (
    <span
      className="inline-flex items-center gap-x-2 rounded-full border border-ui-border-base bg-ui-bg-base px-3 py-1"
      style={{ boxShadow: "0 1px 2px rgba(17,24,39,0.04)" }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
      <Text size="xsmall" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="small" weight="plus" className="text-ui-fg-base tabular-nums">
        {value}
      </Text>
    </span>
  )
}

/** The entry node: an accented pill that shows + edits the trigger event. */
const TriggerNode = ({
  triggerEvent,
  allowReenroll,
  description,
  onChangeTrigger,
  onChangeReenroll,
  onChangeDescription,
}: {
  triggerEvent: Trigger
  allowReenroll: boolean
  description: string
  onChangeTrigger: (t: Trigger) => void
  onChangeReenroll: (v: boolean) => void
  onChangeDescription: (v: string) => void
}) => {
  const c = ACCENTS.green
  return (
    <div
      className="rounded-2xl border bg-ui-bg-base p-4"
      style={{
        borderColor: `color-mix(in srgb, ${c} 34%, transparent)`,
        boxShadow: `0 1px 2px rgba(17,24,39,0.05), inset 0 0 0 1px color-mix(in srgb, ${c} 8%, transparent)`,
      }}
    >
      <div className="flex items-center gap-x-3">
        <AccentIcon icon={RocketLaunch} accent="green" size={34} />
        <div className="flex flex-col">
          <Text
            size="xsmall"
            weight="plus"
            className="uppercase tracking-wider text-ui-fg-muted"
          >
            When this happens
          </Text>
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Trigger: {triggerLabel(triggerEvent)}
          </Text>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Trigger event">
          <Select
            value={triggerEvent}
            onValueChange={(v) => onChangeTrigger(v as Trigger)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Choose a trigger" />
            </Select.Trigger>
            <Select.Content>
              {TRIGGERS.map((t) => (
                <Select.Item key={t.value} value={t.value}>
                  {t.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Labeled>
        <Labeled label="Re-enrollment">
          <div className="flex h-8 items-center gap-x-2">
            <Switch
              checked={allowReenroll}
              onCheckedChange={onChangeReenroll}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {allowReenroll ? "Allowed" : "Once per customer"}
            </Text>
          </div>
        </Labeled>
      </div>
      <div className="mt-3">
        <Labeled label="Description" hint="Optional — a note for your team.">
          <Input
            value={description}
            placeholder="What is this journey for?"
            onChange={(e) => onChangeDescription(e.target.value)}
          />
        </Labeled>
      </div>
    </div>
  )
}

/** The exit / end-of-journey terminal node. */
const ExitNode = ({ empty }: { empty: boolean }) => {
  const c = ACCENTS.slate
  return (
    <div
      className="flex items-center gap-x-2.5 self-center rounded-full border bg-ui-bg-base px-4 py-2"
      style={{ borderColor: `color-mix(in srgb, ${c} 30%, transparent)` }}
    >
      <CheckCircle className="text-ui-fg-muted" />
      <Text size="small" weight="plus" className="text-ui-fg-subtle">
        {empty ? "Add a step to begin" : "Exit journey"}
      </Text>
    </div>
  )
}

/**
 * A vertical connector with an inline SVG line and a centered "+" that opens a
 * small Wait / Condition / Action insert menu.
 */
const Connector = ({
  open,
  onToggle,
  onPick,
}: {
  open: boolean
  onToggle: () => void
  onPick: (t: StepType) => void
}) => {
  const options: { type: StepType; icon: any; label: string; accent: AccentKey }[] =
    [
      { type: "wait", icon: Clock, label: "Wait", accent: "blue" },
      { type: "condition", icon: CodeBranch, label: "Condition", accent: "amber" },
      { type: "action", icon: Bolt, label: "Action", accent: "violet" },
    ]
  return (
    <div className="relative flex h-11 items-center justify-center">
      {/* inline SVG line + arrowhead */}
      <svg
        width="24"
        height="44"
        viewBox="0 0 24 44"
        className="absolute"
        aria-hidden
      >
        <line
          x1="12"
          y1="0"
          x2="12"
          y2="40"
          stroke="var(--border-strong, #cbd5e1)"
          strokeWidth="2"
        />
        <path
          d="M7 34 L12 40 L17 34"
          fill="none"
          stroke="var(--border-strong, #cbd5e1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* + button */}
      <button
        type="button"
        onClick={onToggle}
        aria-label="Insert step"
        className={clx(
          "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-ui-bg-base text-ui-fg-subtle transition-colors hover:bg-ui-bg-base-hover",
          open
            ? "border-ui-border-interactive text-ui-fg-base"
            : "border-ui-border-strong"
        )}
      >
        {open ? <XMarkMini /> : <PlusMini />}
      </button>

      {/* insert menu */}
      {open && (
        <div
          className="absolute left-1/2 top-9 z-20 -translate-x-1/2 rounded-xl border border-ui-border-base bg-ui-bg-base p-1 shadow-elevation-flyout"
          style={{ minWidth: 168 }}
        >
          {options.map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={() => onPick(o.type)}
              className="flex w-full items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ui-bg-base-hover"
            >
              <AccentIcon icon={o.icon} accent={o.accent} size={24} />
              <Text size="small" className="text-ui-fg-base">
                {o.label}
              </Text>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** A single step node card. Click the header to expand the inline editor. */
const StepNode = ({
  index,
  total,
  step,
  open,
  brandVoices,
  onToggle,
  onChange,
  onRemove,
  onMove,
}: {
  index: number
  total: number
  step: JourneyStep
  open: boolean
  brandVoices: BrandVoice[]
  onToggle: () => void
  onChange: (next: JourneyStep) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) => {
  const meta = STEP_META[step.type]
  const c = ACCENTS[meta.accent]
  const Icon = nodeIcon(step)

  return (
    <div
      className={clx(
        "rounded-2xl border bg-ui-bg-base transition-shadow",
        open ? "shadow-elevation-card-rest" : ""
      )}
      style={{
        borderColor: open
          ? `color-mix(in srgb, ${c} 45%, transparent)`
          : "var(--border-base)",
      }}
    >
      {/* accent rail + header (clickable) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex cursor-pointer items-center justify-between gap-x-2 rounded-2xl px-3 py-3 hover:bg-ui-bg-base-hover"
      >
        <div className="flex min-w-0 items-center gap-x-3">
          <span
            aria-hidden
            style={{
              width: 4,
              alignSelf: "stretch",
              minHeight: 34,
              borderRadius: 999,
              background: c,
            }}
          />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-subtle tabular-nums">
            {index + 1}
          </span>
          <AccentIcon icon={Icon} accent={meta.accent} size={30} />
          <div className="flex min-w-0 flex-col">
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {meta.label}
            </Text>
            <Text size="xsmall" className="truncate text-ui-fg-muted">
              {nodeSummary(step)}
            </Text>
          </div>
        </div>
        <div
          className="flex items-center gap-x-1"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            size="small"
            variant="transparent"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move up"
          >
            <ArrowUpMini />
          </IconButton>
          <IconButton
            size="small"
            variant="transparent"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Move down"
          >
            <ArrowDownMini />
          </IconButton>
          <IconButton
            size="small"
            variant="transparent"
            onClick={onRemove}
            aria-label="Remove step"
          >
            <Trash />
          </IconButton>
        </div>
      </div>

      {/* inline editor */}
      {open && (
        <div className="border-t border-ui-border-base p-4">
          {step.type === "wait" && (
            <WaitEditor step={step} onChange={onChange} />
          )}
          {step.type === "condition" && (
            <ConditionEditor step={step} onChange={onChange} />
          )}
          {step.type === "action" && (
            <ActionEditor
              step={step}
              brandVoices={brandVoices}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Node field editors (same field set as the step schema)
 * ------------------------------------------------------------------ */

const WaitEditor = ({
  step,
  onChange,
}: {
  step: WaitStep
  onChange: (next: JourneyStep) => void
}) => {
  const { value, unit } = decomposeWait(step.delay_seconds)
  return (
    <div className="grid grid-cols-2 gap-3">
      <Labeled label="Duration">
        <Input
          type="number"
          min={0}
          value={String(value)}
          onChange={(e) =>
            onChange({
              ...step,
              delay_seconds: composeWait(parseInt(e.target.value) || 0, unit),
            })
          }
        />
      </Labeled>
      <Labeled label="Unit">
        <Select
          value={unit}
          onValueChange={(u) =>
            onChange({
              ...step,
              delay_seconds: composeWait(value, u as WaitUnit),
            })
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="minutes">Minutes</Select.Item>
            <Select.Item value="hours">Hours</Select.Item>
            <Select.Item value="days">Days</Select.Item>
          </Select.Content>
        </Select>
      </Labeled>
    </div>
  )
}

const ConditionEditor = ({
  step,
  onChange,
}: {
  step: ConditionStep
  onChange: (next: JourneyStep) => void
}) => {
  const c = step.condition
  const setCond = (p: Partial<ConditionStep["condition"]>) =>
    onChange({ ...step, condition: { ...c, ...p } })
  return (
    <div className="flex flex-col gap-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Labeled label="Field">
          <Input
            value={c.field}
            placeholder="e.g. order.total"
            onChange={(e) => setCond({ field: e.target.value })}
          />
        </Labeled>
        <Labeled label="Operator">
          <Select
            value={c.op}
            onValueChange={(v) => setCond({ op: v as ConditionOp })}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {OPS.map((o) => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Labeled>
        <Labeled label="Value">
          <Input
            value={c.value ?? ""}
            disabled={!opNeedsValue(c.op)}
            placeholder={opNeedsValue(c.op) ? "e.g. 100" : "—"}
            onChange={(e) => setCond({ value: e.target.value })}
          />
        </Labeled>
      </div>
      <Labeled label="If the condition fails">
        <Select
          value={step.on_fail ?? "exit"}
          onValueChange={(v) =>
            onChange({ ...step, on_fail: v as "exit" | "skip" })
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="exit">Exit the journey</Select.Item>
            <Select.Item value="skip">Skip this step, continue</Select.Item>
          </Select.Content>
        </Select>
      </Labeled>
    </div>
  )
}

const ActionEditor = ({
  step,
  brandVoices,
  onChange,
}: {
  step: ActionStep
  brandVoices: BrandVoice[]
  onChange: (next: JourneyStep) => void
}) => {
  const a = step.action
  const setAction = (next: JourneyAction) => onChange({ ...step, action: next })

  return (
    <div className="flex flex-col gap-y-3">
      <Labeled label="Action type">
        <Select
          value={a.type}
          onValueChange={(v) =>
            setAction(defaultAction(v as JourneyAction["type"]))
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {ACTION_TYPES.map((t) => (
              <Select.Item key={t.value} value={t.value}>
                {t.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Labeled>

      {a.type === "send_email" && (
        <EmailActionFields
          action={a}
          brandVoices={brandVoices}
          onChange={setAction}
        />
      )}

      {a.type === "send_dm" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
          <Labeled label="Channel">
            <Input
              value={a.channel}
              placeholder="email / sms / whatsapp"
              onChange={(e) => setAction({ ...a, channel: e.target.value })}
            />
          </Labeled>
          <Labeled label="Message">
            <Textarea
              rows={2}
              value={a.text}
              placeholder="Message to send…"
              onChange={(e) => setAction({ ...a, text: e.target.value })}
            />
          </Labeled>
        </div>
      )}

      {(a.type === "add_tag" || a.type === "remove_tag") && (
        <Labeled label="Tag">
          <Input
            value={a.tag}
            placeholder="e.g. vip"
            onChange={(e) => setAction({ ...a, tag: e.target.value })}
          />
        </Labeled>
      )}

      {a.type === "add_score" && (
        <Labeled label="Points">
          <Input
            type="number"
            value={String(a.points)}
            onChange={(e) =>
              setAction({ ...a, points: parseInt(e.target.value) || 0 })
            }
          />
        </Labeled>
      )}

      {a.type === "discount" && (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Percentage (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={String(a.percentage ?? "")}
              onChange={(e) =>
                setAction({
                  ...a,
                  percentage:
                    e.target.value === ""
                      ? undefined
                      : parseInt(e.target.value) || 0,
                })
              }
            />
          </Labeled>
          <Labeled label="Expires (hours)">
            <Input
              type="number"
              min={0}
              value={String(a.expires_hours ?? "")}
              onChange={(e) =>
                setAction({
                  ...a,
                  expires_hours:
                    e.target.value === ""
                      ? undefined
                      : parseInt(e.target.value) || 0,
                })
              }
            />
          </Labeled>
        </div>
      )}

      {a.type === "webhook" && (
        <Labeled label="URL">
          <Input
            value={a.url}
            placeholder="https://…"
            onChange={(e) => setAction({ ...a, url: e.target.value })}
          />
        </Labeled>
      )}
    </div>
  )
}

const EmailActionFields = ({
  action,
  brandVoices,
  onChange,
}: {
  action: Extract<JourneyAction, { type: "send_email" }>
  brandVoices: BrandVoice[]
  onChange: (next: JourneyAction) => void
}) => {
  const aiMode = action.brief !== undefined
  const setAi = (on: boolean) => {
    if (on) {
      onChange({
        type: "send_email",
        subject: action.subject ?? "",
        brief: action.brief ?? "",
        brand_voice_id: action.brand_voice_id,
      })
    } else {
      onChange({
        type: "send_email",
        subject: action.subject ?? "",
        html: action.html ?? "",
      })
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center justify-between rounded-lg bg-ui-bg-subtle px-3 py-2">
        <div className="flex items-center gap-x-2">
          <AccentIcon icon={Sparkles} accent="violet" size={24} />
          <Text size="small" className="text-ui-fg-subtle">
            Write with AI
          </Text>
        </div>
        <Switch checked={aiMode} onCheckedChange={setAi} />
      </div>

      <Labeled label="Subject">
        <Input
          value={action.subject ?? ""}
          placeholder="Email subject line"
          onChange={(e) => onChange({ ...action, subject: e.target.value })}
        />
      </Labeled>

      {aiMode ? (
        <>
          <Labeled label="Brief" hint="What the AI should write about.">
            <Textarea
              rows={3}
              value={action.brief ?? ""}
              placeholder="e.g. Thank the customer, highlight loyalty perks, invite them back."
              onChange={(e) => onChange({ ...action, brief: e.target.value })}
            />
          </Labeled>
          <Labeled label="Brand voice">
            <Select
              value={action.brand_voice_id ?? ""}
              onValueChange={(v) => onChange({ ...action, brand_voice_id: v })}
            >
              <Select.Trigger>
                <Select.Value placeholder="Default voice" />
              </Select.Trigger>
              <Select.Content>
                {brandVoices.length === 0 ? (
                  <Select.Item value="" disabled>
                    No brand voices
                  </Select.Item>
                ) : (
                  brandVoices.map((bv) => (
                    <Select.Item key={bv.id} value={bv.id}>
                      {bv.name}
                    </Select.Item>
                  ))
                )}
              </Select.Content>
            </Select>
          </Labeled>
        </>
      ) : (
        <Labeled label="HTML body">
          <Textarea
            rows={4}
            value={action.html ?? ""}
            placeholder="<p>Hello…</p>"
            onChange={(e) => onChange({ ...action, html: e.target.value })}
          />
        </Labeled>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Small presentational helper
 * ------------------------------------------------------------------ */

const Labeled = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-y-1.5">
    <Text size="small" weight="plus" className="text-ui-fg-base">
      {label}
    </Text>
    {children}
    {hint && (
      <Text size="xsmall" className="text-ui-fg-muted">
        {hint}
      </Text>
    )}
  </div>
)

export const config = defineRouteConfig({
  label: "Journey Flow",
  icon: CodeBranch,
})

export default FlowPage
