/**
 * Marketing — Journeys.
 *
 * The automation "brain": a visual editor for multi-step lifecycle journeys.
 * Each journey listens for a trigger event and runs an ordered list of steps —
 * waits, conditional branches, and actions (send email/DM, tag, score,
 * discount, webhook). Self-contained: inline fetch helper + types, built on the
 * shared marketing ui-kit so it matches the rest of the suite.
 *
 * APIs (all under /admin/marketing):
 *   GET    /journeys?status=&trigger_event=   → { journeys, count }
 *   POST   /journeys                          → { journey }  (create)
 *   GET    /journeys/:id                       → { journey, enrollment_counts }
 *   POST   /journeys/:id                       → { journey }  (partial update)
 *   POST   /journeys/:id/activate  { status }  → { journey }
 *   GET    /journeys/:id/enrollments?status=   → { enrollments, count }
 *   DELETE /journeys/:id
 *   GET    /brand-voice                        → { brand_voices }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  RocketLaunch,
  Plus,
  Trash,
  ArrowUpMini,
  ArrowDownMini,
  Clock,
  CodeBranch,
  Bolt,
  Envelope,
  Tag,
  Hashtag,
  Sparkles,
  ChatBubble,
  ReceiptPercent,
  PlaySolid,
  Pause,
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
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AccentIcon,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
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

type Enrollment = {
  id: string
  customer_id?: string | null
  email?: string | null
  status?: string | null
  current_step?: number | null
  created_at?: string | null
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

const OPS: { value: ConditionOp; label: string }[] = [
  { value: "eq", label: "= equals" },
  { value: "neq", label: "≠ not equals" },
  { value: "gt", label: "> greater than" },
  { value: "gte", label: "≥ greater/equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "≤ less/equal" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" },
  { value: "contains", label: "contains" },
]

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

/* wait decompose / compose */
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

const fmtDate = (iso?: string | null): string => {
  if (!iso) {
    return "—"
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return "—"
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/* Step meta for cards */
const STEP_META: Record<
  JourneyStep["type"],
  { icon: any; accent: AccentKey; label: string }
> = {
  wait: { icon: Clock, accent: "amber", label: "Wait" },
  condition: { icon: CodeBranch, accent: "violet", label: "Condition" },
  action: { icon: Bolt, accent: "blue", label: "Action" },
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

const newStep = (t: JourneyStep["type"]): JourneyStep => {
  if (t === "wait") {
    return { type: "wait", delay_seconds: 3600 }
  }
  if (t === "condition") {
    return {
      type: "condition",
      condition: { field: "", op: "eq", value: "" },
      on_fail: "exit",
    }
  }
  return { type: "action", action: defaultAction("send_email") }
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
          subject: "Welcome to the family 👋",
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
      { type: "action", action: { type: "discount", percentage: 15, expires_hours: 72 } },
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

const JourneysPage = () => {
  const prompt = usePrompt()

  const [journeys, setJourneys] = useState<Journey[]>([])
  const [count, setCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [triggerFilter, setTriggerFilter] = useState<string>("all")

  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [form, setForm] = useState<EditorForm | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)

  const [counts, setCounts] = useState<EnrollmentCounts | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
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
      if (triggerFilter !== "all") {
        qs.set("trigger_event", triggerFilter)
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
  }, [statusFilter, triggerFilter])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    api<{ brand_voices: BrandVoice[] }>("/brand-voice")
      .then((d) => setBrandVoices(Array.isArray(d.brand_voices) ? d.brand_voices : []))
      .catch(() => setBrandVoices([]))
  }, [])

  const loadEnrollments = useCallback(async (id: string) => {
    try {
      const d = await api<{ enrollments: Enrollment[] }>(
        `/journeys/${id}/enrollments`
      )
      setEnrollments(Array.isArray(d.enrollments) ? d.enrollments.slice(0, 6) : [])
    } catch {
      setEnrollments([])
    }
  }, [])

  const openJourney = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setCounts(null)
      setEnrollments([])
      try {
        const d = await api<{
          journey: Journey
          enrollment_counts: EnrollmentCounts
        }>(`/journeys/${id}`)
        setForm(formFromJourney(d.journey))
        setCounts(d.enrollment_counts ?? null)
        loadEnrollments(id)
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to open journey.")
      } finally {
        setDetailLoading(false)
      }
    },
    [loadEnrollments]
  )

  const startNew = useCallback((seed?: EditorForm) => {
    setForm(seed ?? blankForm())
    setCounts(null)
    setEnrollments([])
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

  const addStep = useCallback((t: JourneyStep["type"]) => {
    setForm((f) => (f ? { ...f, steps: [...f.steps, newStep(t)] } : f))
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
      if (!form.id && d.journey?.id) {
        loadEnrollments(d.journey.id)
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save the journey.")
    } finally {
      setSaving(false)
    }
  }, [form, loadList, loadEnrollments])

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
      description: `"${form.name || "Untitled"}" and its enrollments will be removed. This cannot be undone.`,
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
      setEnrollments([])
      loadList()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete the journey.")
    }
  }, [form, prompt, loadList])

  /* ---- derived ---- */
  const selectedId = form?.id ?? null

  return (
    <Container className="p-0">
      <PageHeader
        icon={RocketLaunch}
        accent="violet"
        title="Journeys"
        subtitle="Design automated, multi-step lifecycle flows triggered by store events."
        actions={
          <Button size="small" variant="primary" onClick={() => startNew()}>
            <Plus />
            New journey
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-6 pb-10 lg:grid-cols-[340px_1fr]">
        {/* ---------------- LEFT: list ---------------- */}
        <div className="flex flex-col gap-y-3">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-2">
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
            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <Select.Trigger>
                <Select.Value placeholder="Trigger" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All triggers</Select.Item>
                {TRIGGERS.map((t) => (
                  <Select.Item key={t.value} value={t.value}>
                    {t.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <SectionLabel count={count}>Journeys</SectionLabel>

          <div className="flex flex-col gap-y-2">
            {listLoading ? (
              <Text size="small" className="px-1 text-ui-fg-muted">
                Loading…
              </Text>
            ) : listError ? (
              <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
                <EmptyState
                  icon={RocketLaunch}
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
                  icon={RocketLaunch}
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
                        {(j.steps?.length ?? 0)} step
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

        {/* ---------------- RIGHT: editor ---------------- */}
        <div>
          {!form ? (
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
              <EmptyState
                icon={RocketLaunch}
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
            <Editor
              form={form}
              saving={saving}
              statusSaving={statusSaving}
              counts={counts}
              enrollments={enrollments}
              brandVoices={brandVoices}
              onPatch={patch}
              onSetStep={setStep}
              onAddStep={addStep}
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
 * Editor
 * ------------------------------------------------------------------ */

const Editor = ({
  form,
  saving,
  statusSaving,
  counts,
  enrollments,
  brandVoices,
  onPatch,
  onSetStep,
  onAddStep,
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
  enrollments: Enrollment[]
  brandVoices: BrandVoice[]
  onPatch: (p: Partial<EditorForm>) => void
  onSetStep: (i: number, next: JourneyStep) => void
  onAddStep: (t: JourneyStep["type"]) => void
  onRemoveStep: (i: number) => void
  onMoveStep: (i: number, dir: -1 | 1) => void
  onSave: () => void
  onSetStatus: (s: JourneyStatus) => void
  onDelete: () => void
}) => {
  const saved = !!form.id

  return (
    <div className="flex flex-col gap-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-x-3">
        <Text weight="plus" className="text-ui-fg-base">
          {saved ? "Edit journey" : "New journey"}
        </Text>
        <div className="flex items-center gap-x-2">
          <IconButton
            size="small"
            variant="transparent"
            onClick={onDelete}
            aria-label="Delete journey"
          >
            <Trash />
          </IconButton>
          <Button size="small" variant="primary" onClick={onSave} isLoading={saving}>
            {saved ? "Save" : "Create"}
          </Button>
        </div>
      </div>

      {/* Basics */}
      <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4">
        <div className="flex flex-col gap-y-4">
          <Labeled label="Name">
            <Input
              value={form.name}
              placeholder="e.g. Post-purchase thank you"
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </Labeled>
          <Labeled label="Description" hint="Optional — a note for your team.">
            <Textarea
              rows={2}
              value={form.description}
              placeholder="What is this journey for?"
              onChange={(e) => onPatch({ description: e.target.value })}
            />
          </Labeled>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Labeled label="Trigger event">
              <Select
                value={form.trigger_event}
                onValueChange={(v) => onPatch({ trigger_event: v as Trigger })}
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
            <Labeled
              label="Re-enrollment"
              hint="Allow a customer to enter again after finishing."
            >
              <div className="flex h-8 items-center gap-x-2">
                <Switch
                  checked={form.allow_reenroll}
                  onCheckedChange={(v) => onPatch({ allow_reenroll: v })}
                />
                <Text size="small" className="text-ui-fg-subtle">
                  {form.allow_reenroll ? "Allowed" : "Once per customer"}
                </Text>
              </div>
            </Labeled>
          </div>

          {/* Status control */}
          <Labeled
            label="Status"
            hint={
              saved
                ? undefined
                : "Save the journey to activate or pause it."
            }
          >
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
            </div>
          </Labeled>
        </div>
      </div>

      {/* Stats strip + recent enrollments (saved journeys only) */}
      {saved && (
        <div className="flex flex-col gap-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="Active"
              value={counts?.active ?? 0}
              accent="blue"
            />
            <StatTile
              label="Completed"
              value={counts?.completed ?? 0}
              accent="green"
            />
            <StatTile
              label="Failed"
              value={counts?.failed ?? 0}
              accent="rose"
            />
          </div>

          <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
            <div className="border-b border-ui-border-base px-4 py-3">
              <SectionLabel className="mb-0">Recent enrollments</SectionLabel>
            </div>
            {enrollments.length === 0 ? (
              <div className="px-4 py-6">
                <Text size="small" className="text-ui-fg-muted">
                  No enrollments yet.
                </Text>
              </div>
            ) : (
              <div className="divide-y divide-ui-border-base">
                {enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <Text size="small" className="truncate text-ui-fg-base">
                      {e.email || e.customer_id || e.id}
                    </Text>
                    <div className="flex items-center gap-x-3">
                      <StatusDot
                        tone={
                          e.status === "completed"
                            ? "green"
                            : e.status === "failed"
                            ? "rose"
                            : "blue"
                        }
                      >
                        {e.status ?? "active"}
                      </StatusDot>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {fmtDate(e.created_at)}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step builder */}
      <div>
        <SectionLabel count={form.steps.length}>Steps</SectionLabel>
        <div className="flex flex-col gap-y-2">
          {form.steps.length === 0 && (
            <div className="rounded-xl border border-dashed border-ui-border-strong bg-ui-bg-subtle px-4 py-8 text-center">
              <Text size="small" className="text-ui-fg-muted">
                No steps yet. Add a wait, a condition, or an action below.
              </Text>
            </div>
          )}

          {form.steps.map((step, i) => (
            <StepCard
              key={i}
              index={i}
              total={form.steps.length}
              step={step}
              brandVoices={brandVoices}
              onChange={(next) => onSetStep(i, next)}
              onRemove={() => onRemoveStep(i)}
              onMove={(dir) => onMoveStep(i, dir)}
            />
          ))}

          {/* Add step */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Text size="small" className="text-ui-fg-muted">
              Add step:
            </Text>
            <Button size="small" variant="secondary" onClick={() => onAddStep("wait")}>
              <Clock />
              Wait
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => onAddStep("condition")}
            >
              <CodeBranch />
              Condition
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => onAddStep("action")}
            >
              <Bolt />
              Action
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Step card
 * ------------------------------------------------------------------ */

const StepCard = ({
  index,
  total,
  step,
  brandVoices,
  onChange,
  onRemove,
  onMove,
}: {
  index: number
  total: number
  step: JourneyStep
  brandVoices: BrandVoice[]
  onChange: (next: JourneyStep) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) => {
  const meta = STEP_META[step.type]
  return (
    <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-3">
      {/* card header */}
      <div className="mb-3 flex items-center justify-between gap-x-2">
        <div className="flex items-center gap-x-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-subtle tabular-nums">
            {index + 1}
          </span>
          <AccentIcon icon={meta.icon} accent={meta.accent} size={28} />
          <div className="flex flex-col">
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {meta.label}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {stepSummary(step)}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-x-1">
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

      {/* card body */}
      <div className="border-t border-ui-border-base pt-3">
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
    </div>
  )
}

const stepSummary = (step: JourneyStep): string => {
  if (step.type === "wait") {
    return `Pause for ${humanWait(step.delay_seconds)}`
  }
  if (step.type === "condition") {
    const c = step.condition
    return `If ${c.field || "field"} ${c.op}${
      opNeedsValue(c.op) ? ` ${c.value ?? ""}` : ""
    }`
  }
  const a = step.action
  const t = ACTION_TYPES.find((x) => x.value === a.type)?.label ?? a.type
  return t
}

/* ---- wait ---- */
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

/* ---- condition ---- */
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
          <Select value={c.op} onValueChange={(v) => setCond({ op: v as ConditionOp })}>
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

/* ---- action ---- */
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
                    e.target.value === "" ? undefined : parseInt(e.target.value) || 0,
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
                    e.target.value === "" ? undefined : parseInt(e.target.value) || 0,
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
  children: React.ReactNode
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
  label: "Journeys",
  icon: RocketLaunch,
})

export default JourneysPage
