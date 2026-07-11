/**
 * AI Call Center — Playbooks list (Phase 4, read-only).
 *
 * Lists the compiled conversation playbooks (the call-center "brains") and links
 * each to a read-only detail view. Editing playbooks lands in a later phase.
 *
 * API (ASSUMED, may not exist yet): GET /admin/call-center/playbooks. When the
 * endpoint 404s, an informative "Playbook API pending — Phase 4" empty state is
 * shown instead of an error, so the screen never crashes.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, BookOpen } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { listPlaybooks, playbookName, type PlaybookRow } from "./lib"

const PlaybooksListPage = () => {
  const navigate = useNavigate()

  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false) // endpoint 404 => not built yet
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPending(false)
    try {
      const data = await listPlaybooks()
      setPlaybooks(data.playbooks ?? [])
    } catch (e: any) {
      if (e?.status === 404) {
        setPending(true)
      } else {
        setError(e?.message ?? "Unexpected error.")
      }
      setPlaybooks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Playbooks</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Versioned conversation blueprints — persona, states, tools and
            guardrails that drive each call.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={load}
          isLoading={loading}
        >
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {loading ? (
          <ListSkeleton />
        ) : pending ? (
          <PendingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : playbooks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
            {playbooks.map((p) => (
              <PlaybookRowItem
                key={p.id}
                playbook={p}
                onOpen={() =>
                  navigate(`/call-center/playbooks/${encodeURIComponent(p.id)}`)
                }
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function PlaybookRowItem({
  playbook,
  onOpen,
}: {
  playbook: PlaybookRow
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-x-4 bg-ui-bg-base px-4 py-3 text-left transition-colors hover:bg-ui-bg-base-hover"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-subtle">
        <BookOpen />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="small" weight="plus" className="truncate">
          {playbookName(playbook)}
        </Text>
        <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
          {playbook.id} · {playbook.use_case}
        </Text>
      </div>
      {playbook.status && (
        <Badge size="2xsmall" color="grey">
          {playbook.status}
        </Badge>
      )}
      <Badge size="2xsmall" color="blue">
        v{playbook.version}
      </Badge>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function PendingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <BookOpen />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">Playbook API pending — Phase 4</Text>
        <Text size="small" className="text-ui-fg-subtle">
          The read endpoint (GET /admin/call-center/playbooks) is not exposed
          yet. Playbooks live in code today (cod_confirmation, wismo) and will be
          browsable here once the integrator ships the admin route.
        </Text>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <BookOpen />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">No playbooks registered</Text>
        <Text size="small" className="text-ui-fg-subtle">
          Add a playbook to the registry to make it available to campaigns.
        </Text>
      </div>
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
      <Text weight="plus">Could not load playbooks</Text>
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
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-x-4 px-4 py-3">
          <div className="size-9 animate-pulse rounded-md bg-ui-bg-subtle" />
          <div className="flex flex-1 flex-col gap-y-1.5">
            <div className="h-3 w-48 animate-pulse rounded bg-ui-bg-subtle" />
            <div className="h-2.5 w-28 animate-pulse rounded bg-ui-bg-subtle" />
          </div>
          <div className="h-5 w-10 animate-pulse rounded-full bg-ui-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Playbooks",
  icon: BookOpen,
})

export default PlaybooksListPage
