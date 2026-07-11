/**
 * Marketing — Email.
 *
 * The email command center: overview KPIs, a composer that can send a test or
 * broadcast to every contact, template management, the suppression (do-not-email)
 * list, and a live activity log. Self-contained — inline fetch helper + types,
 * built on the shared marketing ui-kit so it matches the rest of the suite.
 *
 * APIs (all under /admin/marketing/email):
 *   GET  /stats                      → KPI aggregate (+ eligible contact count)
 *   GET  /templates ?kind            → { templates, count }
 *   POST /templates                  → create
 *   GET/POST/DELETE /templates/:id   → retrieve / update / delete
 *   GET  /sends ?status              → { sends, count }
 *   GET  /suppression ?q             → { suppression, count }
 *   POST /suppression                → add
 *   DELETE /suppression?id=          → remove (re-subscribe)
 *   POST /send-test                  → { to, subject, html }
 *   POST /broadcast                  → { subject, html, template_id?, to }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Envelope,
  InboxSolid,
  MagnifyingGlass,
  PaperPlane,
  Plus,
  SquareTwoStack,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Input,
  Label,
  Select,
  Tabs,
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
  StatTile,
  StatusDot,
} from "../_components/ui-kit"

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type Kind = "broadcast" | "transactional" | "journey" | "recovery"

type Template = {
  id: string
  name: string
  subject?: string | null
  preheader?: string | null
  html?: string | null
  kind: Kind
  from_name?: string | null
  from_email?: string | null
  created_at?: string
}

type SendStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"

type Send = {
  id: string
  to_email: string
  subject?: string | null
  status: SendStatus
  open_count?: number
  click_count?: number
  sent_at?: string | null
  created_at?: string
}

type SuppressionEntry = {
  id: string
  email: string
  reason: string
  created_at?: string
}

type Stats = {
  sent: number
  opened: number
  clicked: number
  bounced: number
  suppressed: number
  open_rate: number
  click_rate: number
  contacts: number
  window_days: number
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

const STATUS_TONE: Record<
  SendStatus,
  "green" | "amber" | "rose" | "blue" | "violet" | "slate"
> = {
  queued: "slate",
  sending: "slate",
  sent: "blue",
  delivered: "blue",
  opened: "green",
  clicked: "violet",
  bounced: "rose",
  complained: "rose",
  failed: "rose",
  suppressed: "amber",
}

const KIND_LABEL: Record<Kind, string> = {
  broadcast: "Broadcast",
  transactional: "Transactional",
  journey: "Journey",
  recovery: "Recovery",
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
 * Overview
 * ------------------------------------------------------------------ */

const OverviewSection = ({
  stats,
  loading,
}: {
  stats: Stats | null
  loading: boolean
}) => {
  if (loading && !stats) {
    return (
      <div className="px-6 py-10">
        <Text size="small" className="text-ui-fg-muted">
          Loading metrics…
        </Text>
      </div>
    )
  }

  const s = stats
  const hasActivity = !!s && (s.sent > 0 || s.suppressed > 0 || s.bounced > 0)

  return (
    <div className="px-6 py-5">
      <SectionLabel>Last {s?.window_days ?? 30} days</SectionLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Sent"
          value={s?.sent ?? 0}
          accent="blue"
          icon={PaperPlane}
        />
        <StatTile
          label="Open rate"
          value={pct(s?.open_rate ?? 0)}
          sub={`${s?.opened ?? 0} opened`}
          accent="green"
        />
        <StatTile
          label="Click rate"
          value={pct(s?.click_rate ?? 0)}
          sub={`${s?.clicked ?? 0} clicked`}
          accent="violet"
        />
        <StatTile
          label="Suppressed"
          value={s?.suppressed ?? 0}
          sub={`${s?.bounced ?? 0} bounced`}
          accent="amber"
          icon={InboxSolid}
        />
      </div>

      {!hasActivity && (
        <div className="mt-5 rounded-xl border border-ui-border-base">
          <EmptyState
            icon={Envelope}
            accent="blue"
            title="No email activity yet"
            description="Once you send a test or broadcast, delivery and engagement metrics will show up here."
          />
        </div>
      )}

      <div className="mt-5 flex items-center gap-x-2">
        <Text size="small" className="text-ui-fg-subtle">
          Eligible contacts (not unsubscribed):
        </Text>
        <Badge size="2xsmall">{s?.contacts ?? 0}</Badge>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Compose / Broadcast
 * ------------------------------------------------------------------ */

const ComposeSection = ({
  templates,
  contacts,
  onSent,
}: {
  templates: Template[]
  contacts: number
  onSent: () => void
}) => {
  const prompt = usePrompt()
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [testTo, setTestTo] = useState("")
  const [templateId, setTemplateId] = useState<string>("")
  const [sendingTest, setSendingTest] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) {
      if (t.subject) setSubject(t.subject)
      if (typeof t.html === "string") setHtml(t.html)
    }
  }

  const canSend = subject.trim().length > 0 && html.trim().length > 0

  const sendTest = async () => {
    const to = testTo.trim()
    if (!to) {
      toast.error("Enter a recipient email for the test.")
      return
    }
    if (!canSend) {
      toast.error("Subject and HTML body are required.")
      return
    }
    setSendingTest(true)
    try {
      const r = await api<{ ok?: boolean; suppressed?: boolean; error?: string }>(
        "/send-test",
        { method: "POST", json: { to, subject: subject.trim(), html } }
      )
      if (r.suppressed) {
        toast.warning(`${to} is on the suppression list — nothing was sent.`)
      } else if (r.ok) {
        toast.success(`Test sent to ${to}.`)
      } else {
        toast.error(r.error || "Test could not be sent.")
      }
      onSent()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send test.")
    } finally {
      setSendingTest(false)
    }
  }

  const broadcast = async () => {
    if (!canSend) {
      toast.error("Subject and HTML body are required.")
      return
    }
    const confirmed = await prompt({
      title: "Send broadcast to all contacts?",
      description: `This will email ${contacts} eligible contact${
        contacts === 1 ? "" : "s"
      } (recipients on the suppression list are skipped automatically). This cannot be undone.`,
      confirmText: `Send to ${contacts}`,
      cancelText: "Cancel",
    })
    if (!confirmed) return

    setBroadcasting(true)
    try {
      const r = await api<{
        queued?: number
        suppressed?: number
        failed?: number
      }>("/broadcast", {
        method: "POST",
        json: {
          subject: subject.trim(),
          html,
          template_id: templateId || undefined,
          to: "all_contacts",
        },
      })
      toast.success(
        `Broadcast queued: ${r.queued ?? 0} sent, ${
          r.suppressed ?? 0
        } suppressed, ${r.failed ?? 0} failed.`
      )
      onSent()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to broadcast.")
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
      <div className="flex flex-col gap-y-4">
        {templates.length > 0 && (
          <div className="flex flex-col gap-y-1.5">
            <Label size="small">Start from template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <Select.Trigger>
                <Select.Value placeholder="Choose a template (optional)" />
              </Select.Trigger>
              <Select.Content>
                {templates.map((t) => (
                  <Select.Item key={t.id} value={t.id}>
                    {t.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-y-1.5">
          <Label size="small">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your subject line"
          />
        </div>

        <div className="flex flex-col gap-y-1.5">
          <Label size="small">HTML body</Label>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<h1>Hello</h1><p>…</p>"
            rows={10}
            className="font-mono text-xs"
          />
        </div>

        <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4">
          <SectionLabel>Send a test</SectionLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
            />
            <Button
              variant="secondary"
              onClick={sendTest}
              isLoading={sendingTest}
              disabled={!canSend}
            >
              <PaperPlane />
              Send test
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-x-3 rounded-xl border border-ui-border-base p-4">
          <div className="flex flex-col">
            <Text size="small" weight="plus">
              Broadcast to all contacts
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {contacts} eligible recipient{contacts === 1 ? "" : "s"}
            </Text>
          </div>
          <Button
            variant="primary"
            onClick={broadcast}
            isLoading={broadcasting}
            disabled={!canSend || contacts === 0}
          >
            <PaperPlane />
            Broadcast
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-y-1.5">
        <Label size="small">Preview</Label>
        <div className="flex-1">
          <Preview html={html} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

const emptyTemplateForm = {
  name: "",
  kind: "broadcast" as Kind,
  subject: "",
  html: "",
}

const TemplatesSection = ({
  templates,
  loading,
  onChanged,
}: {
  templates: Template[]
  loading: boolean
  onChanged: () => void
}) => {
  const prompt = usePrompt()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState({ ...emptyTemplateForm })
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyTemplateForm })
    setOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditing(t)
    setForm({
      name: t.name ?? "",
      kind: t.kind ?? "broadcast",
      subject: t.subject ?? "",
      html: t.html ?? "",
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("A template name is required.")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api(`/templates/${editing.id}`, {
          method: "POST",
          json: form,
        })
        toast.success("Template updated.")
      } else {
        await api("/templates", { method: "POST", json: form })
        toast.success("Template created.")
      }
      setOpen(false)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save template.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: Template) => {
    const ok = await prompt({
      title: "Delete template?",
      description: `"${t.name}" will be permanently removed.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api(`/templates/${t.id}`, { method: "DELETE" })
      toast.success("Template deleted.")
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete template.")
    }
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel count={templates.length}>Templates</SectionLabel>
        <Button variant="secondary" size="small" onClick={openCreate}>
          <Plus />
          New template
        </Button>
      </div>

      {loading && templates.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Loading…
        </Text>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-ui-border-base">
          <EmptyState
            icon={SquareTwoStack}
            accent="violet"
            title="No templates yet"
            description="Create reusable email templates for broadcasts, transactional messages and journeys."
            action={
              <Button variant="secondary" size="small" onClick={openCreate}>
                <Plus />
                New template
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-ui-border-base rounded-xl border border-ui-border-base">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-x-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-x-2">
                  <Text size="small" weight="plus" className="truncate">
                    {t.name}
                  </Text>
                  <Badge size="2xsmall">{KIND_LABEL[t.kind]}</Badge>
                </div>
                <Text size="xsmall" className="truncate text-ui-fg-subtle">
                  {t.subject || "No subject"}
                </Text>
              </div>
              <div className="flex shrink-0 items-center gap-x-1">
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => openEdit(t)}
                >
                  Edit
                </Button>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => remove(t)}
                >
                  <Trash className="text-ui-fg-error" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editing ? "Edit template" : "New template"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            <div className="flex flex-col gap-y-1.5">
              <Label size="small">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Welcome email"
              />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <Label size="small">Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as Kind })}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {(
                    Object.keys(KIND_LABEL) as Kind[]
                  ).map((k) => (
                    <Select.Item key={k} value={k}>
                      {KIND_LABEL[k]}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-y-1.5">
              <Label size="small">Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Subject line"
              />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <Label size="small">HTML body</Label>
              <Textarea
                value={form.html}
                onChange={(e) => setForm({ ...form, html: e.target.value })}
                rows={10}
                className="font-mono text-xs"
                placeholder="<h1>Hello</h1>"
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button onClick={save} isLoading={saving}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Suppression
 * ------------------------------------------------------------------ */

const SuppressionSection = () => {
  const prompt = usePrompt()
  const [rows, setRows] = useState<SuppressionEntry[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)

  const load = useCallback(async (search: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (search.trim()) params.set("q", search.trim())
      const data = await api<{ suppression?: SuppressionEntry[]; count?: number }>(
        `/suppression?${params.toString()}`
      )
      setRows(data.suppression ?? [])
      setCount(data.count ?? 0)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load suppression list.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load("")
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  const add = async () => {
    const email = newEmail.trim()
    if (!email) return
    setAdding(true)
    try {
      await api("/suppression", { method: "POST", json: { email } })
      toast.success(`${email} added to suppression list.`)
      setNewEmail("")
      load(q)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add address.")
    } finally {
      setAdding(false)
    }
  }

  const remove = async (row: SuppressionEntry) => {
    const ok = await prompt({
      title: "Re-subscribe this address?",
      description: `${row.email} will be removed from the suppression list and can receive email again.`,
      confirmText: "Re-subscribe",
      cancelText: "Cancel",
    })
    if (!ok) return
    try {
      await api(`/suppression?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      toast.success(`${row.email} re-subscribed.`)
      load(q)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove address.")
    }
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email"
            className="pl-8"
          />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Add email to suppress"
          />
          <Button
            variant="secondary"
            onClick={add}
            isLoading={adding}
            disabled={!newEmail.trim()}
          >
            <Plus />
            Add
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Loading…
        </Text>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-ui-border-base">
          <EmptyState
            icon={InboxSolid}
            accent="green"
            title={q ? "No matches" : "Suppression list is empty"}
            description={
              q
                ? "No suppressed addresses match your search."
                : "Unsubscribes, hard bounces and complaints will appear here. You can also add addresses manually."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ui-border-base">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ui-border-base text-ui-fg-muted">
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ui-border-base">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-ui-fg-base">{r.email}</td>
                  <td className="px-4 py-2">
                    <Badge size="2xsmall">{r.reason}</Badge>
                  </td>
                  <td className="px-4 py-2 text-ui-fg-subtle">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() => remove(r)}
                    >
                      Re-subscribe
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {count > rows.length && (
        <Text size="xsmall" className="mt-2 text-ui-fg-muted">
          Showing {rows.length} of {count}.
        </Text>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

const ActivitySection = ({
  reloadKey,
}: {
  reloadKey: number
}) => {
  const [rows, setRows] = useState<Send[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>("")

  const load = useCallback(async (st: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (st) params.set("status", st)
      const data = await api<{ sends?: Send[] }>(`/sends?${params.toString()}`)
      setRows(data.sends ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load activity.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(status)
  }, [status, reloadKey, load])

  return (
    <div className="px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel count={rows.length}>Recent sends</SectionLabel>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <Select.Trigger className="w-[160px]">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All statuses</Select.Item>
            <Select.Item value="sent">Sent</Select.Item>
            <Select.Item value="opened">Opened</Select.Item>
            <Select.Item value="clicked">Clicked</Select.Item>
            <Select.Item value="bounced">Bounced</Select.Item>
            <Select.Item value="failed">Failed</Select.Item>
            <Select.Item value="suppressed">Suppressed</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Loading…
        </Text>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-ui-border-base">
          <EmptyState
            icon={Envelope}
            accent="blue"
            title="No sends yet"
            description="Individual email sends and their delivery status will appear here."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ui-border-base">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ui-border-base text-ui-fg-muted">
                <th className="px-4 py-2 font-medium">Recipient</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Engagement</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ui-border-base">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-ui-fg-base">{r.to_email}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-ui-fg-subtle">
                    {r.subject || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusDot tone={STATUS_TONE[r.status] ?? "slate"}>
                      {r.status}
                    </StatusDot>
                  </td>
                  <td className="px-4 py-2 text-ui-fg-subtle">
                    <span
                      className={clx(
                        (r.open_count ?? 0) > 0 && "text-ui-fg-base"
                      )}
                    >
                      {(r.open_count ?? 0) > 0 ? "Opened" : "—"}
                    </span>
                    {(r.click_count ?? 0) > 0 && (
                      <span className="ml-2 text-ui-fg-base">Clicked</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ui-fg-subtle">
                    {formatDate(r.sent_at || r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const EmailPage = () => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [activityKey, setActivityKey] = useState(0)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await api<Stats>("/stats")
      setStats(data)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const data = await api<{ templates?: Template[] }>("/templates?limit=200")
      setTemplates(data.templates ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load templates.")
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    loadTemplates()
  }, [loadStats, loadTemplates])

  const afterSend = useCallback(() => {
    loadStats()
    setActivityKey((k) => k + 1)
  }, [loadStats])

  const contacts = stats?.contacts ?? 0

  return (
    <Container className="p-0">
      <PageHeader
        icon={Envelope}
        accent="blue"
        title="Email"
        subtitle="Compose broadcasts, manage templates, and monitor deliverability."
      />

      <Tabs defaultValue="overview">
        <div className="border-y border-ui-border-base px-6">
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="compose">Compose</Tabs.Trigger>
            <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
            <Tabs.Trigger value="suppression">Suppression</Tabs.Trigger>
            <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content value="overview">
          <OverviewSection stats={stats} loading={statsLoading} />
        </Tabs.Content>
        <Tabs.Content value="compose">
          <ComposeSection
            templates={templates}
            contacts={contacts}
            onSent={afterSend}
          />
        </Tabs.Content>
        <Tabs.Content value="templates">
          <TemplatesSection
            templates={templates}
            loading={templatesLoading}
            onChanged={loadTemplates}
          />
        </Tabs.Content>
        <Tabs.Content value="suppression">
          <SuppressionSection />
        </Tabs.Content>
        <Tabs.Content value="activity">
          <ActivitySection reloadKey={activityKey} />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Email",
  icon: Envelope,
})

export default EmailPage
