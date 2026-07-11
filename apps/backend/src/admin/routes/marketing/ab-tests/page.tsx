/**
 * Marketing — Email A/B Tests.
 *
 * Subject-line A/B testing for broadcasts. One HTML body, two subject lines;
 * every subscribed contact is deterministically bucketed 50/50 into variant A
 * or B on the server. This screen launches a test and shows a head-to-head
 * comparison of the results. Self-contained — inline fetch helper + types,
 * built on the shared marketing ui-kit so it matches the rest of the suite.
 *
 * APIs (all under /admin/marketing/email/ab-test):
 *   POST /                → { subject_a, subject_b, html, to? } launch
 *   GET  /list            → { tests } recent tests, newest first
 *   GET  /:id             → results { subject_a, subject_b, variants, winner }
 * Eligible contact count comes from GET /admin/marketing/email/stats.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Beaker, PaperPlane, Trophy } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Input,
  Label,
  Text,
  Textarea,
  clx,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  EmptyState,
  PageHeader,
  SectionLabel,
  StatusDot,
} from "../_components/ui-kit"

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type TestSummary = {
  ab_test_id: string
  sends: number
  created_at: string | null
}

type VariantStats = {
  subject: string
  sent: number
  opened: number
  clicked: number
  open_rate: number
  click_rate: number
}

type TestResult = {
  ab_test_id: string
  subject_a: string
  subject_b: string
  variants: { A: VariantStats; B: VariantStats }
  winner: "A" | "B" | "tie" | null
}

/* ------------------------------------------------------------------ *
 * Fetch helper
 * ------------------------------------------------------------------ */

const api = async <T = any,>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> => {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(`/admin/marketing/email${path}`, {
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

const pct = (n: number) => `${Math.round((n || 0) * 1000) / 10}%`

/** Enough signal to trust a winner call. */
const MIN_SENT_FOR_WINNER = 10

const formatDate = (v?: string | null) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/* ------------------------------------------------------------------ *
 * Preview
 * ------------------------------------------------------------------ */

const Preview = ({ html }: { html: string }) => {
  if (!html.trim()) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-ui-border-base bg-ui-bg-subtle">
        <Text size="small" className="text-ui-fg-muted">
          Preview appears here
        </Text>
      </div>
    )
  }
  return (
    <iframe
      title="Email preview"
      srcDoc={html}
      sandbox=""
      className="h-full min-h-[240px] w-full rounded-lg border border-ui-border-base bg-white"
    />
  )
}

/* ------------------------------------------------------------------ *
 * New A/B test form
 * ------------------------------------------------------------------ */

const NewTestSection = ({
  contacts,
  onLaunched,
}: {
  contacts: number
  onLaunched: (id: string) => void
}) => {
  const prompt = usePrompt()
  const [subjectA, setSubjectA] = useState("")
  const [subjectB, setSubjectB] = useState("")
  const [html, setHtml] = useState("")
  const [launching, setLaunching] = useState(false)

  const a = subjectA.trim()
  const b = subjectB.trim()
  const canLaunch =
    a.length > 0 && b.length > 0 && a !== b && html.trim().length > 0

  // Deterministic 50/50 split → roughly half to each variant.
  const half = Math.round(contacts / 2)

  const launch = async () => {
    if (!canLaunch) {
      if (a && b && a === b) {
        toast.error("The two subject lines must be different.")
      } else {
        toast.error("Both subject lines and the HTML body are required.")
      }
      return
    }

    const confirmed = await prompt({
      title: "Launch A/B test to all contacts?",
      description: `This will email ${contacts} eligible contact${
        contacts === 1 ? "" : "s"
      }, split ~50/50 — about ${half} get subject A and ${
        contacts - half
      } get subject B. Suppressed recipients are skipped automatically. This cannot be undone.`,
      confirmText: `Launch to ${contacts}`,
      cancelText: "Cancel",
    })
    if (!confirmed) return

    setLaunching(true)
    try {
      const r = await api<{
        ab_test_id: string
        sent_a?: number
        sent_b?: number
        suppressed?: number
      }>("/ab-test", {
        method: "POST",
        json: {
          subject_a: a,
          subject_b: b,
          html,
          to: "all_contacts",
        },
      })
      toast.success(
        `A/B test launched: ${r.sent_a ?? 0} on A, ${r.sent_b ?? 0} on B, ${
          r.suppressed ?? 0
        } suppressed.`
      )
      setSubjectA("")
      setSubjectB("")
      setHtml("")
      onLaunched(r.ab_test_id)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to launch A/B test.")
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
      <div className="flex flex-col gap-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-y-1.5">
            <Label size="small">Subject A</Label>
            <Input
              value={subjectA}
              onChange={(e) => setSubjectA(e.target.value)}
              placeholder="First subject line"
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <Label size="small">Subject B</Label>
            <Input
              value={subjectB}
              onChange={(e) => setSubjectB(e.target.value)}
              placeholder="Second subject line"
            />
          </div>
        </div>

        <div className="flex flex-col gap-y-1.5">
          <Label size="small">HTML body (shared by both)</Label>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<h1>Hello</h1><p>…</p>"
            rows={10}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-x-2">
          <Text size="small" className="text-ui-fg-subtle">
            Recipients: all subscribed contacts
          </Text>
          <Badge size="2xsmall">{contacts}</Badge>
          <Text size="xsmall" className="text-ui-fg-muted">
            split ~{half} / {contacts - half}
          </Text>
        </div>

        <div>
          <Button
            variant="primary"
            onClick={launch}
            isLoading={launching}
            disabled={!canLaunch}
          >
            <PaperPlane />
            Launch A/B test
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-y-1.5">
        <Label size="small">Preview</Label>
        <Preview html={html} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Head-to-head result columns
 * ------------------------------------------------------------------ */

const VariantColumn = ({
  variant,
  stats,
  isWinner,
  enoughData,
}: {
  variant: "A" | "B"
  stats: VariantStats
  isWinner: boolean
  enoughData: boolean
}) => {
  return (
    <div
      className={clx(
        "flex flex-col gap-y-3 rounded-xl border p-4",
        isWinner && enoughData
          ? "border-ui-tag-green-border bg-ui-tag-green-bg"
          : "border-ui-border-base bg-ui-bg-base"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-base">
            {variant}
          </span>
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Variant {variant}
          </Text>
        </div>
        {isWinner && enoughData && (
          <Badge size="2xsmall" color="green" className="flex items-center gap-x-1">
            <Trophy />
            Winner
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2">
        <Text size="xsmall" className="uppercase tracking-wide text-ui-fg-muted">
          Subject
        </Text>
        <Text size="small" className="text-ui-fg-base">
          {stats.subject || "—"}
        </Text>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col">
          <Text className="text-[20px] font-semibold leading-tight text-ui-fg-base tabular-nums">
            {stats.sent}
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            Sent
          </Text>
        </div>
        <div className="flex flex-col">
          <Text className="text-[20px] font-semibold leading-tight text-ui-fg-base tabular-nums">
            {pct(stats.open_rate)}
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            Open rate
          </Text>
        </div>
        <div className="flex flex-col">
          <Text className="text-[20px] font-semibold leading-tight text-ui-fg-base tabular-nums">
            {pct(stats.click_rate)}
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            Click rate
          </Text>
        </div>
      </div>

      <Text size="xsmall" className="text-ui-fg-subtle">
        {stats.opened} opened · {stats.clicked} clicked
      </Text>
    </div>
  )
}

const ResultsDetail = ({
  result,
  loading,
}: {
  result: TestResult | null
  loading: boolean
}) => {
  if (loading && !result) {
    return (
      <div className="px-6 py-10">
        <Text size="small" className="text-ui-fg-muted">
          Loading results…
        </Text>
      </div>
    )
  }

  if (!result) {
    return (
      <EmptyState
        icon={Beaker}
        accent="violet"
        title="Select a test"
        description="Pick a test from the list to see how the two subject lines compare."
      />
    )
  }

  const { A, B } = result.variants
  const totalSent = A.sent + B.sent
  const enoughData = totalSent >= MIN_SENT_FOR_WINNER

  return (
    <div className="flex flex-col gap-y-4 px-6 py-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Head to head
          </Text>
          <Text size="xsmall" className="font-mono text-ui-fg-muted">
            {result.ab_test_id}
          </Text>
        </div>
        {enoughData ? (
          result.winner === "tie" ? (
            <StatusDot tone="slate">Tie so far</StatusDot>
          ) : result.winner ? (
            <Badge size="small" color="green">
              Variant {result.winner} winning
            </Badge>
          ) : null
        ) : (
          <StatusDot tone="amber">Not enough data yet</StatusDot>
        )}
      </div>

      {!enoughData && (
        <div className="rounded-lg border border-dashed border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Only {totalSent} message{totalSent === 1 ? "" : "s"} sent so far.
            The winner is highlighted once at least {MIN_SENT_FOR_WINNER} have
            gone out and engagement lands.
          </Text>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <VariantColumn
          variant="A"
          stats={A}
          isWinner={result.winner === "A"}
          enoughData={enoughData}
        />
        <VariantColumn
          variant="B"
          stats={B}
          isWinner={result.winner === "B"}
          enoughData={enoughData}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Recent tests list
 * ------------------------------------------------------------------ */

const TestsList = ({
  tests,
  selectedId,
  onSelect,
}: {
  tests: TestSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) => {
  if (tests.length === 0) {
    return (
      <EmptyState
        icon={Beaker}
        accent="slate"
        title="No A/B tests yet"
        description="Launch your first subject-line test above to start comparing."
      />
    )
  }

  return (
    <div className="flex flex-col divide-y divide-ui-border-base">
      {tests.map((t) => (
        <button
          key={t.ab_test_id}
          type="button"
          onClick={() => onSelect(t.ab_test_id)}
          className={clx(
            "flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-ui-bg-base-hover",
            selectedId === t.ab_test_id && "bg-ui-bg-base-pressed"
          )}
        >
          <div className="flex flex-col">
            <Text size="small" weight="plus" className="font-mono text-ui-fg-base">
              {t.ab_test_id}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {formatDate(t.created_at)}
            </Text>
          </div>
          <Badge size="2xsmall">{t.sends} sent</Badge>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const AbTestsPage = () => {
  const [contacts, setContacts] = useState(0)
  const [tests, setTests] = useState<TestSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [resultLoading, setResultLoading] = useState(false)

  const loadContacts = useCallback(async () => {
    try {
      const s = await api<{ contacts?: number }>("/stats")
      setContacts(Number(s?.contacts ?? 0))
    } catch {
      setContacts(0)
    }
  }, [])

  const loadTests = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const r = await api<{ tests?: TestSummary[] }>("/ab-test/list")
      setTests(Array.isArray(r?.tests) ? r.tests : [])
    } catch (e: any) {
      setListError(e?.message ?? "Failed to load tests.")
      setTests([])
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadResult = useCallback(async (id: string) => {
    setResultLoading(true)
    try {
      const r = await api<TestResult>(`/ab-test/${encodeURIComponent(id)}`)
      setResult(r)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load results.")
      setResult(null)
    } finally {
      setResultLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContacts()
    loadTests()
  }, [loadContacts, loadTests])

  useEffect(() => {
    if (selectedId) {
      loadResult(selectedId)
    } else {
      setResult(null)
    }
  }, [selectedId, loadResult])

  const onLaunched = useCallback(
    (id: string) => {
      loadTests()
      loadContacts()
      setSelectedId(id)
    },
    [loadTests, loadContacts]
  )

  const selectedResult = useMemo(() => result, [result])

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <PageHeader
        icon={Beaker}
        accent="violet"
        title="Subject-line A/B tests"
        subtitle="One email body, two subject lines. Contacts are split ~50/50 (deterministically) so you can see which subject wins."
      />

      {/* New test */}
      <div>
        <div className="px-6 pt-5">
          <SectionLabel>New A/B test</SectionLabel>
        </div>
        <NewTestSection contacts={contacts} onLaunched={onLaunched} />
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
        <div className="border-b border-ui-border-base lg:border-b-0 lg:border-r">
          <div className="px-4 pt-5">
            <SectionLabel count={tests.length}>Recent tests</SectionLabel>
          </div>
          {listLoading ? (
            <div className="px-4 py-8">
              <Text size="small" className="text-ui-fg-muted">
                Loading tests…
              </Text>
            </div>
          ) : listError ? (
            <div className="px-4 py-8">
              <Text size="small" className="text-ui-fg-error">
                {listError}
              </Text>
              <Button
                size="small"
                variant="secondary"
                className="mt-3"
                onClick={loadTests}
              >
                Retry
              </Button>
            </div>
          ) : (
            <TestsList
              tests={tests}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <div>
          <div className="px-6 pt-5">
            <SectionLabel>Results</SectionLabel>
          </div>
          <ResultsDetail result={selectedResult} loading={resultLoading} />
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "A/B Tests",
  icon: Beaker,
})

export default AbTestsPage
