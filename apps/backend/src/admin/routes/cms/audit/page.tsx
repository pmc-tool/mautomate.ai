/**
 * Forever Finds CMS — Audit Log viewer (Phase 9).
 *
 * Read-only, paginated table of the `cms_audit_log` trail. Every CMS write
 * records a row (actor, action, entity, before/after snapshots). This page is
 * visible to ALL CMS roles (admin + editor + viewer) — the underlying endpoint
 * is a GET, which the `/admin/cms/*` role matrix allows for every role.
 *
 * Sits under the "Site Management" group (parent route: /cms).
 *
 * API CONTRACT (cookie-session auth, credentials:include):
 *   GET /admin/cms/audit-log
 *     query: action?, entity_type?, actor_id?, from?, to? (ISO), limit (<=200,
 *            default 50), offset (default 0)
 *     -> { audit_logs, count, limit, offset }  (newest first)
 *
 * A row's "View" button (or row click) opens a Drawer showing the before/after
 * JSON snapshots side by side.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Clock, Eye } from "@medusajs/icons"
import {
  Badge,
  Button,
  clx,
  Container,
  Drawer,
  Heading,
  Input,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

/* ------------------------------------------------------------------ */
/* Types (mirror the cms_audit_log model + GET /admin/cms/audit-log)   */
/* ------------------------------------------------------------------ */

type CmsAuditLog = {
  id: string
  actor_id: string
  actor_email: string | null
  action: string
  entity_type: string | null
  entity_key: string | null
  before: unknown
  after: unknown
  created_at: string
}

const PAGE_SIZE = 50
const ALL = "__all__" as const

/* Known action / entity values — used to populate the filter dropdowns.
 * Free-form fallbacks are still supported via the actor / date filters; these
 * are just convenience presets and degrade gracefully if the backend emits a
 * value not listed here (the list rebuilds from whatever rows come back). */
const KNOWN_ACTIONS = [
  "page.create",
  "page.update",
  "page.delete",
  "page.publish",
  "page.unpublish",
  "page.schedule",
  "section.create",
  "section.update",
  "section.delete",
  "section.reorder",
  "blog.create",
  "blog.update",
  "blog.delete",
  "blog.publish",
  "media.create",
  "media.update",
  "media.delete",
  "settings.update",
  "role.update",
]

const KNOWN_ENTITY_TYPES = [
  "page",
  "section",
  "blog_post",
  "blog_author",
  "blog_category",
  "media",
  "global_setting",
  "cms_role",
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const formatDateTime = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Color the action badge by its semantic verb (create/update/delete/...). */
const actionColor = (
  action: string
): "green" | "blue" | "red" | "orange" | "purple" | "grey" => {
  const a = action.toLowerCase()
  if (a.includes("delete") || a.includes("unpublish")) return "red"
  if (a.includes("create")) return "green"
  if (a.includes("publish")) return "purple"
  if (a.includes("schedule")) return "orange"
  if (a.includes("role")) return "blue"
  if (a.includes("update") || a.includes("reorder")) return "blue"
  return "grey"
}

const prettyJson = (value: unknown): string => {
  if (value === null || value === undefined) return "—"
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** Convert a value from a <datetime-local> input into an ISO string (or ""). */
const localInputToIso = (local: string): string => {
  if (!local) return ""
  const d = new Date(local)
  if (isNaN(d.getTime())) return ""
  return d.toISOString()
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

const AuditLogPage = () => {
  const [logs, setLogs] = useState<CmsAuditLog[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  /* committed filters (what we actually query with) */
  const [action, setAction] = useState<string>(ALL)
  const [entityType, setEntityType] = useState<string>(ALL)
  const [actorId, setActorId] = useState("")
  const [from, setFrom] = useState("") // <datetime-local> value
  const [to, setTo] = useState("") // <datetime-local> value

  /* uncommitted actor input (commit on submit, like the media search box) */
  const [actorInput, setActorInput] = useState("")

  const [selected, setSelected] = useState<CmsAuditLog | null>(null)

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      const nextOffset = opts?.offset ?? 0
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(nextOffset))
      if (action !== ALL) params.set("action", action)
      if (entityType !== ALL) params.set("entity_type", entityType)
      if (actorId.trim()) params.set("actor_id", actorId.trim())
      const fromIso = localInputToIso(from)
      const toIso = localInputToIso(to)
      if (fromIso) params.set("from", fromIso)
      if (toIso) params.set("to", toIso)

      try {
        const res = await fetch(`/admin/cms/audit-log?${params.toString()}`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error(`Failed to load audit log (${res.status})`)
        const data = await res.json()
        setLogs((data?.audit_logs ?? []) as CmsAuditLog[])
        setCount(data?.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        toast.error("Could not load audit log", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setLoading(false)
      }
    },
    [action, entityType, actorId, from, to]
  )

  useEffect(() => {
    load({ offset: 0 })
  }, [load])

  const hasFilters =
    action !== ALL ||
    entityType !== ALL ||
    !!actorId.trim() ||
    !!from ||
    !!to

  const clearFilters = () => {
    setAction(ALL)
    setEntityType(ALL)
    setActorId("")
    setActorInput("")
    setFrom("")
    setTo("")
  }

  /* pagination */
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < count
  const rangeStart = count === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, count)

  /* Merge any actions/entities present in the current page into the preset
   * lists so a row's value is always selectable even if it's not a known one. */
  const actionOptions = useMemo(() => {
    const set = new Set(KNOWN_ACTIONS)
    logs.forEach((l) => l.action && set.add(l.action))
    return Array.from(set).sort()
  }, [logs])

  const entityOptions = useMemo(() => {
    const set = new Set(KNOWN_ENTITY_TYPES)
    logs.forEach((l) => l.entity_type && set.add(l.entity_type))
    return Array.from(set).sort()
  }, [logs])

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Audit Log</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            A read-only trail of every change made across the CMS, newest first.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          isLoading={loading}
          onClick={() => load({ offset })}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <form
        className="flex flex-col gap-3 border-b border-ui-border-base px-6 py-3 lg:flex-row lg:flex-wrap lg:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          setActorId(actorInput)
          // committing actorId triggers `load` via the effect dependency.
        }}
      >
        <Field label="Action">
          <Select
            value={action}
            onValueChange={(v) => setAction(v)}
            size="small"
          >
            <Select.Trigger className="w-full lg:w-48">
              <Select.Value placeholder="All actions" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={ALL}>All actions</Select.Item>
              {actionOptions.map((a) => (
                <Select.Item key={a} value={a}>
                  {a}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Field>

        <Field label="Entity type">
          <Select
            value={entityType}
            onValueChange={(v) => setEntityType(v)}
            size="small"
          >
            <Select.Trigger className="w-full lg:w-44">
              <Select.Value placeholder="All entities" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={ALL}>All entities</Select.Item>
              {entityOptions.map((t) => (
                <Select.Item key={t} value={t}>
                  {t}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Field>

        <Field label="Actor (user id)">
          <Input
            size="small"
            placeholder="user_..."
            value={actorInput}
            onChange={(e) => setActorInput(e.target.value)}
            className="w-full lg:w-48"
          />
        </Field>

        <Field label="From">
          <Input
            size="small"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full lg:w-52"
          />
        </Field>

        <Field label="To">
          <Input
            size="small"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full lg:w-52"
          />
        </Field>

        <div className="flex items-center gap-x-2">
          <Button type="submit" size="small" variant="secondary">
            Apply
          </Button>
          {hasFilters && (
            <Button
              type="button"
              size="small"
              variant="transparent"
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Body */}
      <div className="px-6 py-6">
        {loading ? (
          <TableSkeleton />
        ) : logs.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-ui-border-base">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Date / time</Table.HeaderCell>
                    <Table.HeaderCell>Actor</Table.HeaderCell>
                    <Table.HeaderCell>Action</Table.HeaderCell>
                    <Table.HeaderCell>Entity</Table.HeaderCell>
                    <Table.HeaderCell>Key</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">
                      Details
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {logs.map((log) => (
                    <Table.Row
                      key={log.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(log)}
                    >
                      <Table.Cell>
                        <Text size="small" className="whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          size="small"
                          className="max-w-[16rem] truncate"
                          title={log.actor_email ?? log.actor_id}
                        >
                          {log.actor_email ?? log.actor_id ?? "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          size="2xsmall"
                          color={actionColor(log.action)}
                          className="whitespace-nowrap"
                        >
                          {log.action}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-subtle">
                          {log.entity_type ?? "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          size="small"
                          className="max-w-[14rem] truncate font-mono text-ui-fg-subtle"
                          title={log.entity_key ?? undefined}
                        >
                          {log.entity_key ?? "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <Button
                            size="small"
                            variant="transparent"
                            onClick={() => setSelected(log)}
                          >
                            <Eye />
                            View
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {rangeStart}–{rangeEnd} of {count}
              </Text>
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasPrev}
                  onClick={() => load({ offset: offset - PAGE_SIZE })}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasNext}
                  onClick={() => load({ offset: offset + PAGE_SIZE })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <AuditDetailDrawer
          log={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Filter field wrapper                                                */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1">
      <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detail drawer — before / after snapshots                            */
/* ------------------------------------------------------------------ */

function AuditDetailDrawer({
  log,
  onClose,
}: {
  log: CmsAuditLog
  onClose: () => void
}) {
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Audit entry</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-ui-border-base px-3 py-3">
            <Meta label="Date / time" value={formatDateTime(log.created_at)} />
            <Meta label="Action">
              <Badge size="2xsmall" color={actionColor(log.action)}>
                {log.action}
              </Badge>
            </Meta>
            <Meta label="Actor" value={log.actor_email ?? "—"} />
            <Meta label="Actor id" value={log.actor_id} mono />
            <Meta label="Entity type" value={log.entity_type ?? "—"} />
            <Meta label="Entity key" value={log.entity_key ?? "—"} mono />
          </div>

          {/* Before / after diff */}
          <div className="flex flex-col gap-y-3">
            <Heading level="h3">Changes</Heading>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <JsonPanel
                title="Before"
                tone="before"
                value={log.before}
              />
              <JsonPanel title="After" tone="after" value={log.after} />
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Close
            </Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

function JsonPanel({
  title,
  tone,
  value,
}: {
  title: string
  tone: "before" | "after"
  value: unknown
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-ui-border-base">
      <div
        className={clx(
          "flex items-center gap-x-2 border-b border-ui-border-base px-3 py-2",
          tone === "before" ? "bg-ui-bg-subtle" : "bg-ui-bg-base"
        )}
      >
        <Badge size="2xsmall" color={tone === "before" ? "grey" : "green"}>
          {title}
        </Badge>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-xs text-ui-fg-subtle">
        {prettyJson(value)}
      </pre>
    </div>
  )
}

function Meta({
  label,
  value,
  mono,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-0.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      {children ?? (
        <Text
          size="small"
          className={clx("truncate", mono && "font-mono")}
          title={value}
        >
          {value}
        </Text>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty + loading states                                              */
/* ------------------------------------------------------------------ */

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <Clock />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">
          {hasFilters ? "No entries match your filters" : "No audit entries yet"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasFilters
            ? "Try widening the date range or clearing the filters."
            : "Changes made across the CMS will be recorded here."}
        </Text>
      </div>
      {hasFilters && (
        <Button size="small" variant="secondary" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base">
      <div className="border-b border-ui-border-base bg-ui-bg-subtle px-4 py-3">
        <div className="h-3 w-40 animate-pulse rounded bg-ui-bg-base" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-x-4 border-b border-ui-border-base px-4 py-3 last:border-b-0"
        >
          <div className="h-3 w-36 animate-pulse rounded bg-ui-bg-subtle" />
          <div className="h-3 w-40 animate-pulse rounded bg-ui-bg-subtle" />
          <div className="h-3 w-24 animate-pulse rounded bg-ui-bg-subtle" />
          <div className="h-3 w-20 animate-pulse rounded bg-ui-bg-subtle" />
          <div className="ml-auto h-3 w-12 animate-pulse rounded bg-ui-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Audit Log",
  icon: Clock,
})

export default AuditLogPage
