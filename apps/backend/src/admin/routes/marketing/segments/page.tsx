/**
 * Marketing — Segments & Scoring.
 *
 * The audience "brain": build dynamic rule-based segments (re-evaluated hourly,
 * plus an on-demand "Evaluate now") or hand-picked static ones, watch a live
 * audience preview as you edit rules, and tune the engagement-scoring engine +
 * leaderboard. Self-contained — inline fetch helper + types + field metadata,
 * built on the shared marketing ui-kit so it matches the rest of the suite.
 *
 * APIs (all under /admin/marketing):
 *   GET/POST      /segments                 → list / create
 *   GET/POST/DEL  /segments/:id             → retrieve / update / delete
 *   GET           /segments/:id/members     → paginated joined members
 *   POST          /segments/:id/evaluate    → re-materialize now → { count }
 *   POST          /segments/preview         → live audience → { count, sample }
 *   GET/POST      /scoring                  → { enabled, points }
 *   GET           /scoring/leaderboard      → { contacts }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  Bolt,
  ChartBar,
  Star,
  Trash,
  Users,
  XMarkMini,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  IconButton,
  Input,
  Select,
  Switch,
  Tabs,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
  StatusDot,
} from "../_components/ui-kit"

/* ------------------------------------------------------------------ *
 * Field metadata (mirror of segments/types.ts — kept inline so the
 * admin page stays self-contained).
 * ------------------------------------------------------------------ */

type FieldType = "number" | "string" | "boolean" | "tags"

const SEGMENT_FIELD_META: Record<string, { label: string; type: FieldType }> = {
  score: { label: "Engagement score", type: "number" },
  tags: { label: "Tag", type: "tags" },
  orders_count: { label: "Number of orders", type: "number" },
  total_spent: { label: "Total spent", type: "number" },
  days_since_last_order: { label: "Days since last order", type: "number" },
  days_since_created: { label: "Days since first seen", type: "number" },
  has_ordered: { label: "Has ordered", type: "boolean" },
  has_abandoned_cart: { label: "Has an abandoned cart", type: "boolean" },
  email_opens: { label: "Email opens", type: "number" },
  email_clicks: { label: "Email clicks", type: "number" },
  is_subscribed: { label: "Is subscribed", type: "boolean" },
  country: { label: "Country", type: "string" },
}

const FIELD_ENTRIES = Object.entries(SEGMENT_FIELD_META)

type Op =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "contains"
  | "in"

const OP_LABEL: Record<Op, string> = {
  eq: "is",
  neq: "is not",
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  exists: "exists",
  not_exists: "does not exist",
  contains: "contains",
  in: "is any of",
}

const OPS_BY_TYPE: Record<FieldType, Op[]> = {
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  string: ["eq", "neq", "contains", "exists", "not_exists"],
  boolean: ["eq"],
  tags: ["contains", "in"],
}

/** Ops that take no value input. */
const VALUELESS_OPS: Op[] = ["exists", "not_exists"]

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type SegmentKind = "dynamic" | "static"

type SegmentRule = {
  field: string
  op: Op
  value?: unknown
}

type SegmentFilter = {
  match: "all" | "any"
  rules: SegmentRule[]
}

type Segment = {
  id: string
  name: string
  description?: string | null
  kind: SegmentKind
  filter?: SegmentFilter | null
  member_count?: number
  last_evaluated_at?: string | null
  created_at?: string
}

type Member = {
  id: string
  contact_id: string
  source?: string | null
  added_at?: string | null
  email?: string | null
  name?: string | null
}

type PreviewResult = {
  count: number
  sample: { email?: string | null; display_name?: string | null; contact_id?: string }[]
}

type ScoringConfig = {
  enabled: boolean
  points: Record<string, number>
}

type LeaderboardContact = {
  contact_id: string
  email?: string | null
  display_name?: string | null
  score: number
}

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
 * Small helpers
 * ------------------------------------------------------------------ */

const SCORING_EVENTS: { key: string; label: string; hint: string }[] = [
  { key: "email_open", label: "Email open", hint: "Opened a marketing email" },
  { key: "email_click", label: "Email click", hint: "Clicked a link in an email" },
  { key: "purchase", label: "Purchase", hint: "Placed an order" },
  { key: "page_visit", label: "Page visit", hint: "Visited the storefront" },
  { key: "unsubscribe", label: "Unsubscribe", hint: "Opted out of email" },
]

const MEMBERS_PAGE_SIZE = 20

const relTime = (iso?: string | null): string => {
  if (!iso) {
    return "never"
  }
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) {
    return "—"
  }
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) {
    return "just now"
  }
  if (mins < 60) {
    return `${mins}m ago`
  }
  const hours = Math.round(mins / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (days < 30) {
    return `${days}d ago`
  }
  return new Date(iso).toLocaleDateString()
}

const emptyFilter = (): SegmentFilter => ({ match: "all", rules: [] })

const firstOpFor = (field: string): Op => {
  const type = SEGMENT_FIELD_META[field]?.type ?? "string"
  return OPS_BY_TYPE[type][0]
}

const newRule = (): SegmentRule => {
  const field = FIELD_ENTRIES[0][0]
  return { field, op: firstOpFor(field), value: "" }
}

/* ------------------------------------------------------------------ *
 * Draft type for the builder
 * ------------------------------------------------------------------ */

type Draft = {
  id: string | null
  name: string
  description: string
  kind: SegmentKind
  filter: SegmentFilter
}

const draftFromSegment = (s: Segment): Draft => ({
  id: s.id,
  name: s.name ?? "",
  description: s.description ?? "",
  kind: s.kind ?? "dynamic",
  filter:
    s.filter && Array.isArray(s.filter.rules)
      ? { match: s.filter.match === "any" ? "any" : "all", rules: s.filter.rules }
      : emptyFilter(),
})

const blankDraft = (): Draft => ({
  id: null,
  name: "",
  description: "",
  kind: "dynamic",
  filter: emptyFilter(),
})

/* ================================================================== *
 * Page
 * ================================================================== */

const SegmentsPage = () => {
  const [tab, setTab] = useState<"segments" | "scoring">("segments")

  return (
    <Container className="p-0 divide-y divide-ui-border-base">
      <PageHeader
        icon={Users}
        accent="violet"
        title="Segments & Scoring"
        subtitle="Build audiences from behaviour and tune the engagement-scoring engine."
      />

      <div className="px-6 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <Tabs.List>
            <Tabs.Trigger value="segments">Segments</Tabs.Trigger>
            <Tabs.Trigger value="scoring">Scoring</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </div>

      {tab === "segments" ? <SegmentsTab /> : <ScoringTab />}
    </Container>
  )
}

/* ================================================================== *
 * Segments tab
 * ================================================================== */

const SegmentsTab = () => {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>(blankDraft())
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [rightTab, setRightTab] = useState<"builder" | "members">("builder")

  // Live preview.
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSegments = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const data = await api<{ segments: Segment[] }>("/segments?limit=100")
      setSegments(Array.isArray(data.segments) ? data.segments : [])
    } catch (e: any) {
      setListError(e?.message ?? "Failed to load segments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSegments()
  }, [loadSegments])

  const selectSegment = useCallback((s: Segment) => {
    setDraft(draftFromSegment(s))
    setRightTab("builder")
    setPreview(null)
  }, [])

  const startNew = useCallback(() => {
    setDraft(blankDraft())
    setRightTab("builder")
    setPreview(null)
  }, [])

  /* ---- live preview (debounced) ---- */
  useEffect(() => {
    if (draft.kind !== "dynamic") {
      setPreview(null)
      return
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const data = await api<PreviewResult>("/segments/preview", {
          method: "POST",
          json: { filter: draft.filter, limit: 5 },
        })
        setPreview({
          count: Number(data?.count ?? 0),
          sample: Array.isArray(data?.sample) ? data.sample : [],
        })
      } catch {
        setPreview(null)
      } finally {
        setPreviewing(false)
      }
    }, 500)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
    // Re-run whenever the rule tree, match mode or kind changes.
  }, [draft.filter, draft.kind])

  /* ---- rule mutations ---- */
  const patchFilter = (next: Partial<SegmentFilter>) =>
    setDraft((d) => ({ ...d, filter: { ...d.filter, ...next } }))

  const addRule = () =>
    patchFilter({ rules: [...draft.filter.rules, newRule()] })

  const removeRule = (idx: number) =>
    patchFilter({ rules: draft.filter.rules.filter((_, i) => i !== idx) })

  const updateRule = (idx: number, next: Partial<SegmentRule>) =>
    patchFilter({
      rules: draft.filter.rules.map((r, i) =>
        i === idx ? { ...r, ...next } : r
      ),
    })

  const changeField = (idx: number, field: string) =>
    updateRule(idx, { field, op: firstOpFor(field), value: "" })

  /* ---- save ---- */
  const save = useCallback(async () => {
    const name = draft.name.trim()
    if (!name) {
      toast.error("A segment name is required.")
      return
    }
    setSaving(true)
    try {
      const body = {
        name,
        description: draft.description.trim() || null,
        kind: draft.kind,
        filter: draft.kind === "dynamic" ? draft.filter : null,
      }
      if (draft.id) {
        const data = await api<{ segment: Segment }>(`/segments/${draft.id}`, {
          method: "POST",
          json: body,
        })
        toast.success("Segment updated.")
        setDraft(draftFromSegment(data.segment))
      } else {
        const data = await api<{ segment: Segment }>("/segments", {
          method: "POST",
          json: body,
        })
        toast.success("Segment created.")
        setDraft(draftFromSegment(data.segment))
      }
      await loadSegments()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save segment")
    } finally {
      setSaving(false)
    }
  }, [draft, loadSegments])

  /* ---- evaluate now ---- */
  const evaluate = useCallback(async () => {
    if (!draft.id) {
      return
    }
    setEvaluating(true)
    try {
      const data = await api<{ count: number }>(
        `/segments/${draft.id}/evaluate`,
        { method: "POST" }
      )
      toast.success(`Segment re-evaluated — ${data.count} member${data.count === 1 ? "" : "s"}.`)
      await loadSegments()
      const fresh = await api<{ segment: Segment }>(`/segments/${draft.id}`)
      setDraft(draftFromSegment(fresh.segment))
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to evaluate segment")
    } finally {
      setEvaluating(false)
    }
  }, [draft.id, loadSegments])

  /* ---- delete ---- */
  const remove = useCallback(async () => {
    if (!draft.id) {
      return
    }
    if (!window.confirm(`Delete segment "${draft.name}"? This cannot be undone.`)) {
      return
    }
    setDeleting(true)
    try {
      await api(`/segments/${draft.id}`, { method: "DELETE" })
      toast.success("Segment deleted.")
      startNew()
      await loadSegments()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete segment")
    } finally {
      setDeleting(false)
    }
  }, [draft.id, draft.name, loadSegments, startNew])

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[340px_1fr]">
      {/* LEFT — list */}
      <div className="border-b border-ui-border-base p-6 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel count={segments.length}>Segments</SectionLabel>
          <Button size="small" variant="secondary" onClick={startNew}>
            New
          </Button>
        </div>

        {loading ? (
          <Text size="small" className="text-ui-fg-muted">
            Loading segments…
          </Text>
        ) : listError ? (
          <div className="rounded-lg border border-ui-border-error bg-ui-bg-base p-4">
            <Text size="small" className="text-ui-fg-error">
              {listError}
            </Text>
            <Button size="small" variant="secondary" className="mt-2" onClick={loadSegments}>
              Retry
            </Button>
          </div>
        ) : segments.length === 0 ? (
          <EmptyState
            icon={Users}
            accent="violet"
            title="No segments yet"
            description="Create your first audience on the right."
          />
        ) : (
          <div className="flex flex-col gap-y-2">
            {segments.map((s) => {
              const active = draft.id === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSegment(s)}
                  className={
                    "flex flex-col gap-y-1 rounded-lg border px-3 py-2.5 text-left transition-colors " +
                    (active
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                      : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover")
                  }
                >
                  <div className="flex items-center justify-between gap-x-2">
                    <Text size="small" weight="plus" className="truncate text-ui-fg-base">
                      {s.name}
                    </Text>
                    <Badge size="2xsmall" color={s.kind === "dynamic" ? "purple" : "grey"}>
                      {s.kind}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-x-2">
                    <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                      {s.member_count ?? 0} member{(s.member_count ?? 0) === 1 ? "" : "s"}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {relTime(s.last_evaluated_at)}
                    </Text>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
          <Text size="xsmall" className="text-ui-fg-subtle">
            <strong className="text-ui-fg-base">Dynamic</strong> segments are
            rule-based and re-evaluate automatically every hour (or on demand
            via <em>Evaluate now</em>). <strong className="text-ui-fg-base">Static</strong>{" "}
            segments hold a fixed, hand-picked set of contacts.
          </Text>
        </div>
      </div>

      {/* RIGHT — builder / members */}
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-x-2">
          <SectionLabel>{draft.id ? "Edit segment" : "New segment"}</SectionLabel>
          <div className="flex items-center gap-x-2">
            {draft.id && draft.kind === "dynamic" && (
              <Button
                size="small"
                variant="secondary"
                onClick={evaluate}
                isLoading={evaluating}
              >
                <ArrowPath /> Evaluate now
              </Button>
            )}
            {draft.id && (
              <IconButton size="small" variant="transparent" onClick={remove} disabled={deleting}>
                <Trash className="text-ui-fg-error" />
              </IconButton>
            )}
          </div>
        </div>

        {draft.id && (
          <div className="mb-4">
            <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as any)}>
              <Tabs.List>
                <Tabs.Trigger value="builder">Builder</Tabs.Trigger>
                <Tabs.Trigger value="members">Members</Tabs.Trigger>
              </Tabs.List>
            </Tabs>
          </div>
        )}

        {rightTab === "members" && draft.id ? (
          <MembersView segmentId={draft.id} />
        ) : (
          <div className="flex flex-col gap-y-5">
            {/* Core fields */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input
                  value={draft.name}
                  placeholder="e.g. High-value repeat buyers"
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={draft.kind}
                  onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as SegmentKind }))}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select type" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="dynamic">Dynamic (rule-based)</Select.Item>
                    <Select.Item value="static">Static (hand-picked)</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                rows={2}
                value={draft.description}
                placeholder="What defines this audience?"
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </Field>

            {/* Rule builder — dynamic only */}
            {draft.kind === "dynamic" ? (
              <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4">
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    Match
                  </Text>
                  <div className="w-[180px]">
                    <Select
                      value={draft.filter.match}
                      onValueChange={(v) => patchFilter({ match: v as "all" | "any" })}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="all">all rules (AND)</Select.Item>
                        <Select.Item value="any">any rule (OR)</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                  <Text size="small" className="text-ui-fg-subtle">
                    of the following:
                  </Text>
                </div>

                {draft.filter.rules.length === 0 ? (
                  <Text size="small" className="text-ui-fg-muted">
                    No rules yet — this matches every contact. Add a rule to
                    narrow the audience.
                  </Text>
                ) : (
                  <div className="flex flex-col gap-y-2">
                    {draft.filter.rules.map((rule, idx) => (
                      <RuleRow
                        key={idx}
                        rule={rule}
                        onChangeField={(field) => changeField(idx, field)}
                        onChangeOp={(op) => updateRule(idx, { op })}
                        onChangeValue={(value) => updateRule(idx, { value })}
                        onRemove={() => removeRule(idx)}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <Button size="small" variant="secondary" onClick={addRule}>
                    Add rule
                  </Button>
                </div>

                {/* Live preview */}
                <div className="mt-4 flex items-center justify-between gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2.5">
                  <div className="flex items-center gap-x-2">
                    <StatusDot tone="violet">
                      {previewing
                        ? "Estimating audience…"
                        : preview
                          ? `≈ ${preview.count} contact${preview.count === 1 ? "" : "s"} match`
                          : "Live preview unavailable"}
                    </StatusDot>
                  </div>
                  {preview && preview.sample.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {preview.sample.slice(0, 5).map((c, i) => (
                        <Badge key={i} size="2xsmall" color="grey">
                          {c.email || c.display_name || c.contact_id || "contact"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4">
                <Text size="small" className="text-ui-fg-subtle">
                  Static segments hold a fixed, hand-picked member set — there
                  are no rules to configure. Members are managed directly and do
                  not re-evaluate.
                </Text>
              </div>
            )}

            {/* Save */}
            <div className="flex justify-end border-t border-ui-border-base pt-4">
              <Button onClick={save} isLoading={saving} disabled={!draft.name.trim()}>
                {draft.id ? "Save changes" : "Create segment"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Rule row
 * ------------------------------------------------------------------ */

const RuleRow = ({
  rule,
  onChangeField,
  onChangeOp,
  onChangeValue,
  onRemove,
}: {
  rule: SegmentRule
  onChangeField: (field: string) => void
  onChangeOp: (op: Op) => void
  onChangeValue: (value: unknown) => void
  onRemove: () => void
}) => {
  const type = SEGMENT_FIELD_META[rule.field]?.type ?? "string"
  const ops = OPS_BY_TYPE[type]
  const showValue = !VALUELESS_OPS.includes(rule.op)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base p-2">
      {/* Field */}
      <div className="min-w-[170px] flex-1">
        <Select value={rule.field} onValueChange={onChangeField}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {FIELD_ENTRIES.map(([key, meta]) => (
              <Select.Item key={key} value={key}>
                {meta.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {/* Op */}
      <div className="min-w-[140px]">
        <Select value={rule.op} onValueChange={(v) => onChangeOp(v as Op)}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {ops.map((op) => (
              <Select.Item key={op} value={op}>
                {OP_LABEL[op]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {/* Value */}
      {showValue && (
        <div className="min-w-[150px] flex-1">
          {type === "boolean" ? (
            <Select
              value={rule.value === true || rule.value === "true" ? "true" : "false"}
              onValueChange={(v) => onChangeValue(v === "true")}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="true">true</Select.Item>
                <Select.Item value="false">false</Select.Item>
              </Select.Content>
            </Select>
          ) : type === "number" ? (
            <Input
              type="number"
              value={rule.value === undefined || rule.value === null ? "" : String(rule.value)}
              placeholder="0"
              onChange={(e) =>
                onChangeValue(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          ) : type === "tags" && rule.op === "in" ? (
            <Input
              value={
                Array.isArray(rule.value)
                  ? (rule.value as string[]).join(", ")
                  : String(rule.value ?? "")
              }
              placeholder="vip, wholesale"
              onChange={(e) =>
                onChangeValue(
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                )
              }
            />
          ) : (
            <Input
              value={String(rule.value ?? "")}
              placeholder={type === "tags" ? "vip" : "value"}
              onChange={(e) => onChangeValue(e.target.value)}
            />
          )}
        </div>
      )}

      <IconButton size="small" variant="transparent" onClick={onRemove}>
        <XMarkMini />
      </IconButton>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Members view
 * ------------------------------------------------------------------ */

const MembersView = ({ segmentId }: { segmentId: string }) => {
  const [rows, setRows] = useState<Member[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (p: number) => {
      setLoading(true)
      setError(null)
      try {
        const data = await api<{ members: Member[]; count: number }>(
          `/segments/${segmentId}/members?limit=${MEMBERS_PAGE_SIZE}&offset=${p * MEMBERS_PAGE_SIZE}`
        )
        setRows(Array.isArray(data.members) ? data.members : [])
        setCount(Number(data.count ?? 0))
      } catch (e: any) {
        setError(e?.message ?? "Failed to load members")
      } finally {
        setLoading(false)
      }
    },
    [segmentId]
  )

  useEffect(() => {
    load(page)
  }, [load, page])

  const pages = Math.max(1, Math.ceil(count / MEMBERS_PAGE_SIZE))

  return (
    <div className="flex flex-col gap-y-3">
      <SectionLabel count={count}>Members</SectionLabel>

      {loading ? (
        <Text size="small" className="text-ui-fg-muted">
          Loading members…
        </Text>
      ) : error ? (
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          accent="slate"
          title="No members yet"
          description="Run Evaluate now to materialize this segment's audience."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-ui-border-base bg-ui-bg-base">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-ui-border-base text-ui-fg-muted">
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th>Added</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-ui-border-base last:border-0">
                    <Td>{m.name || m.contact_id}</Td>
                    <Td>{m.email || "—"}</Td>
                    <Td>
                      <Badge size="2xsmall" color={m.source === "manual" ? "grey" : "purple"}>
                        {m.source ?? "dynamic"}
                      </Badge>
                    </Td>
                    <Td className="text-ui-fg-subtle">{relTime(m.added_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Text size="xsmall" className="text-ui-fg-muted">
              Page {page + 1} of {pages}
            </Text>
            <div className="flex items-center gap-x-2">
              <Button
                size="small"
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="small"
                variant="secondary"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ================================================================== *
 * Scoring tab
 * ================================================================== */

const ScoringTab = () => {
  const [config, setConfig] = useState<ScoringConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [enabled, setEnabled] = useState(false)
  const [points, setPoints] = useState<Record<string, string>>({})

  const [leaders, setLeaders] = useState<LeaderboardContact[]>([])
  const [leadersLoading, setLeadersLoading] = useState(true)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<ScoringConfig>("/scoring")
      setConfig(data)
      setEnabled(data.enabled === true)
      const p: Record<string, string> = {}
      for (const ev of SCORING_EVENTS) {
        p[ev.key] = String(data.points?.[ev.key] ?? 0)
      }
      setPoints(p)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load scoring config")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeaders = useCallback(async () => {
    setLeadersLoading(true)
    try {
      const data = await api<{ contacts: LeaderboardContact[] }>(
        "/scoring/leaderboard?limit=20"
      )
      setLeaders(Array.isArray(data.contacts) ? data.contacts : [])
    } catch {
      setLeaders([])
    } finally {
      setLeadersLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadLeaders()
  }, [loadConfig, loadLeaders])

  const toggleEnabled = useCallback(
    async (next: boolean) => {
      setEnabled(next)
      try {
        await api("/scoring", { method: "POST", json: { enabled: next } })
        toast.success(next ? "Scoring enabled." : "Scoring disabled.")
        setConfig((c) => (c ? { ...c, enabled: next } : c))
      } catch (e: any) {
        setEnabled(!next)
        toast.error(e?.message ?? "Failed to update scoring")
      }
    },
    []
  )

  const savePoints = useCallback(async () => {
    setSaving(true)
    try {
      const payload: Record<string, number> = {}
      for (const ev of SCORING_EVENTS) {
        const n = Math.round(Number(points[ev.key]))
        payload[ev.key] = Number.isFinite(n) ? n : 0
      }
      const data = await api<ScoringConfig>("/scoring", {
        method: "POST",
        json: { points: payload },
      })
      setConfig(data)
      toast.success("Scoring points saved.")
      await loadLeaders()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save points")
    } finally {
      setSaving(false)
    }
  }, [points, loadLeaders])

  const maxScore = useMemo(
    () => leaders.reduce((m, c) => Math.max(m, c.score), 0),
    [leaders]
  )

  if (loading) {
    return (
      <div className="px-6 py-10">
        <Text size="small" className="text-ui-fg-muted">
          Loading scoring…
        </Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-10">
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
        <Button size="small" variant="secondary" className="mt-2" onClick={loadConfig}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
      {/* LEFT — engine + points */}
      <div className="border-b border-ui-border-base p-6 lg:border-b-0 lg:border-r">
        <div className="flex items-start justify-between gap-x-4 rounded-xl border border-ui-border-base bg-ui-bg-base p-4">
          <div className="flex items-start gap-x-3">
            <div className="mt-0.5">
              <Bolt className={enabled ? "text-ui-fg-interactive" : "text-ui-fg-muted"} />
            </div>
            <div className="flex flex-col gap-y-1">
              <Text size="small" weight="plus">
                Engagement scoring
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle max-w-sm">
                When enabled, contacts accrue points from marketing signals. The
                running total powers dynamic segments and the leaderboard.
                Dormant by default — nothing is scored while this is off.
              </Text>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleEnabled} />
        </div>

        <div className="mt-5">
          <SectionLabel>Points per event</SectionLabel>
          <div className="flex flex-col gap-y-2">
            {SCORING_EVENTS.map((ev) => (
              <div
                key={ev.key}
                className="flex items-center justify-between gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2"
              >
                <div className="flex flex-col">
                  <Text size="small" weight="plus" className="text-ui-fg-base">
                    {ev.label}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {ev.hint}
                  </Text>
                </div>
                <div className="w-[110px]">
                  <Input
                    type="number"
                    value={points[ev.key] ?? "0"}
                    onChange={(e) =>
                      setPoints((p) => ({ ...p, [ev.key]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end border-t border-ui-border-base pt-4">
            <Button onClick={savePoints} isLoading={saving}>
              Save points
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT — leaderboard */}
      <div className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel count={leaders.length}>Leaderboard</SectionLabel>
          <IconButton size="small" variant="transparent" onClick={loadLeaders}>
            <ArrowPath />
          </IconButton>
        </div>

        {leadersLoading ? (
          <Text size="small" className="text-ui-fg-muted">
            Loading leaderboard…
          </Text>
        ) : leaders.length === 0 ? (
          <EmptyState
            icon={ChartBar}
            accent="amber"
            title="No scored contacts yet"
            description={
              enabled
                ? "Scores will appear here as contacts engage."
                : "Enable scoring to start tracking engagement."
            }
          />
        ) : (
          <div className="flex flex-col gap-y-2">
            {leaders.map((c, i) => (
              <div
                key={c.contact_id}
                className="flex items-center gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2"
              >
                <Text size="small" weight="plus" className="w-6 text-ui-fg-muted tabular-nums">
                  {i + 1}
                </Text>
                <div className="min-w-0 flex-1">
                  <Text size="small" weight="plus" className="truncate text-ui-fg-base">
                    {c.email || c.display_name || c.contact_id}
                  </Text>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${maxScore > 0 ? Math.max(4, Math.round((c.score / maxScore) * 100)) : 0}%`,
                        background: "#F59E0B",
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-x-1 text-ui-fg-base">
                  <Star className="text-ui-fg-muted" />
                  <Text size="small" weight="plus" className="tabular-nums">
                    {c.score}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Local presentational helpers
 * ------------------------------------------------------------------ */

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-1.5">
    <Text size="xsmall" weight="plus" className="uppercase tracking-wide text-ui-fg-muted">
      {label}
    </Text>
    {children}
  </div>
)

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">{children}</th>
)

const Td = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <td className={"px-3 py-2.5 text-sm text-ui-fg-base " + (className ?? "")}>
    {children}
  </td>
)

export const config = defineRouteConfig({
  label: "Segments",
  icon: Users,
})

export default SegmentsPage
