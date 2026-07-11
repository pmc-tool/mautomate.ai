/**
 * AI Call Center — Playbook detail (Phase 4, read-only).
 *
 * Renders a single compiled playbook: persona/objective, the ordered
 * conversation states, the tool catalog, the deterministic guardrails and the
 * closed disposition set. Everything is READ-ONLY for now — a note flags that
 * in-admin editing lands in a later phase.
 *
 * No `defineRouteConfig`, so it is reachable at /call-center/playbooks/:id but
 * is not in the sidebar.
 *
 * API (ASSUMED, may not exist yet): GET /admin/call-center/playbooks/:id. A 404
 * degrades to an informative "Playbook API pending — Phase 4" state.
 */
import { ArrowLeft, ArrowPath, BookOpen, ShieldCheck } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  getPlaybook,
  playbookName,
  type Playbook,
  type PlaybookState,
  type PlaybookTool,
} from "../lib"

const PlaybookDetailPage = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()

  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPending(false)
    try {
      const { playbook } = await getPlaybook(id)
      setPlaybook(playbook)
    } catch (e: any) {
      if (e?.status === 404) {
        setPending(true)
      } else {
        setError(e?.message ?? "Unexpected error.")
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const back = (
    <button
      type="button"
      onClick={() => navigate("/call-center/playbooks")}
      className="flex w-fit items-center gap-x-1 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
    >
      <ArrowLeft />
      <Text size="small">Playbooks</Text>
    </button>
  )

  if (loading) {
    return (
      <Container className="p-0">
        <div className="flex flex-col gap-y-4 px-6 py-4">
          {back}
          <Text className="text-ui-fg-subtle">Loading playbook…</Text>
        </div>
      </Container>
    )
  }

  if (pending) {
    return (
      <Container className="p-0">
        <div className="flex flex-col gap-y-4 px-6 py-4">
          {back}
          <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
              <BookOpen />
            </div>
            <Text weight="plus">Playbook API pending — Phase 4</Text>
            <Text size="small" className="text-ui-fg-subtle">
              GET /admin/call-center/playbooks/{id} is not exposed yet. Detail
              will render here once the integrator ships the admin read endpoint.
            </Text>
          </div>
        </div>
      </Container>
    )
  }

  if (error || !playbook) {
    return (
      <Container className="p-0">
        <div className="flex flex-col gap-y-4 px-6 py-4">
          {back}
          <div className="flex flex-col items-start gap-y-3 py-8">
            <Text weight="plus">Could not load playbook</Text>
            <Text size="small" className="text-ui-fg-subtle">
              {error ?? "Not found."}
            </Text>
            <Button size="small" variant="secondary" onClick={load}>
              <ArrowPath />
              Retry
            </Button>
          </div>
        </div>
      </Container>
    )
  }

  const p = playbook

  return (
    <Container className="p-0">
      {/* Top bar */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4">
        {back}
        <div className="flex min-w-0 flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h2" className="truncate">
              {playbookName(p)}
            </Heading>
            {p.status && (
              <Badge size="2xsmall" color="grey">
                {p.status}
              </Badge>
            )}
            <Badge size="2xsmall" color="blue">
              v{p.version}
            </Badge>
          </div>
          <Text size="small" className="font-mono text-ui-fg-subtle">
            {p.id} · {p.use_case}
          </Text>
        </div>
      </div>

      {/* Read-only note */}
      <div className="mx-6 mt-6 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-2.5">
        <Text size="small" className="text-ui-fg-subtle">
          Read-only view. Playbooks are defined in code today; in-admin editing
          lands in a later phase.
        </Text>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-y-6 px-6 py-6">
        <PersonaCard playbook={p} />
        <StatesCard states={p.states ?? []} />
        <ToolsCard tools={p.tools ?? []} />
        <GuardrailsCard playbook={p} />
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function KeyVal({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-y-0.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="small">{value ?? "—"}</Text>
    </div>
  )
}

function PersonaCard({ playbook }: { playbook: Playbook }) {
  const persona = playbook.persona
  return (
    <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base p-4">
      <Heading level="h3">Persona &amp; objective</Heading>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KeyVal label="Voice name" value={persona?.name} />
        <KeyVal label="Provider" value={persona?.voice_provider} />
        <KeyVal label="Language" value={persona?.language} />
        <KeyVal label="Tone" value={persona?.tone} />
      </div>
      <div className="flex flex-col gap-y-1 border-t border-ui-border-base pt-3">
        <Text size="xsmall" className="text-ui-fg-muted">
          Objective
        </Text>
        <Text size="small">{playbook.objective}</Text>
      </div>
      <div className="flex flex-col gap-y-1">
        <Text size="xsmall" className="text-ui-fg-muted">
          First message
        </Text>
        <Text size="small" className="italic text-ui-fg-subtle">
          “{playbook.first_message}”
        </Text>
      </div>
      {(playbook.merge_fields?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-y-1.5">
          <Text size="xsmall" className="text-ui-fg-muted">
            Merge fields the model may read
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {playbook.merge_fields.map((f) => (
              <Badge key={f} size="2xsmall" color="grey">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatesCard({ states }: { states: PlaybookState[] }) {
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
      <Heading level="h3">Conversation states ({states.length})</Heading>
      {states.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          No states defined.
        </Text>
      ) : (
        <ol className="flex flex-col gap-y-3">
          {states.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3"
            >
              <div className="flex items-center gap-x-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-ui-bg-base text-ui-fg-subtle">
                  <Text size="xsmall">{i + 1}</Text>
                </div>
                <Text size="small" weight="plus" className="font-mono">
                  {s.id}
                </Text>
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                {s.goal}
              </Text>
              {(s.allowed_tools?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Tools:
                  </Text>
                  {s.allowed_tools.map((t) => (
                    <Badge key={t} size="2xsmall" color="blue">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              {(s.transitions?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Transitions:
                  </Text>
                  {s.transitions!.map((tr, j) => (
                    <Text key={j} size="xsmall" className="font-mono">
                      {tr.on} → {tr.to}
                    </Text>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ToolsCard({ tools }: { tools: PlaybookTool[] }) {
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
      <Heading level="h3">Tools ({tools.length})</Heading>
      {tools.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          No tools exposed.
        </Text>
      ) : (
        <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
          {tools.map((t) => (
            <div key={t.name} className="flex flex-col gap-y-0.5 px-4 py-2.5">
              <Text size="small" weight="plus" className="font-mono">
                {t.name}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t.description}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GuardrailsCard({ playbook }: { playbook: Playbook }) {
  const g = playbook.guardrails
  return (
    <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-center gap-x-2">
        <ShieldCheck className="text-ui-fg-subtle" />
        <Heading level="h3">Guardrails &amp; dispositions</Heading>
      </div>
      {g ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KeyVal label="Max turns" value={g.max_turns} />
          <KeyVal label="Max clarify" value={g.max_clarify} />
          <KeyVal
            label="Save offer once"
            value={g.save_offer_once ? "yes" : "no"}
          />
        </div>
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          No guardrails defined.
        </Text>
      )}
      {g?.recording_disclosure && (
        <div className="flex flex-col gap-y-1 border-t border-ui-border-base pt-3">
          <Text size="xsmall" className="text-ui-fg-muted">
            Recording disclosure
          </Text>
          <Text size="small" className="italic text-ui-fg-subtle">
            “{g.recording_disclosure}”
          </Text>
        </div>
      )}
      <div className="flex flex-col gap-y-1.5 border-t border-ui-border-base pt-3">
        <Text size="xsmall" className="text-ui-fg-muted">
          Allowed dispositions
        </Text>
        <div className="flex flex-wrap gap-1.5">
          {(playbook.disposition_set ?? []).map((d) => (
            <Badge key={d} size="2xsmall" color="green">
              {d}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PlaybookDetailPage
