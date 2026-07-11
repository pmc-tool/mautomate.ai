import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowPath,
  Calendar,
  CheckCircleSolid,
  Clock,
  Globe,
  InformationCircleSolid,
  Key,
  LockClosedSolid,
  Pencil,
  Plus,
  ShieldCheck,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Copy,
  Divider,
  Drawer,
  Heading,
  Hint,
  IconButton,
  InlineTip,
  Input,
  Label,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Table,
  Tabs,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"

type ToggleField = "locked" | "privacy" | "auto_renew"

type Domain = {
  id: string
  domain_name: string
  tld: string
  status: string
  source: string
  reseller_order_id: string | null
  registration_date: string | null
  expiry_date: string | null
  auto_renew: boolean
  privacy_enabled: boolean
  locked: boolean
  nameservers: string[] | null
  years: number | null
  register_price: number | null
  currency: string | null
  last_synced_at: string | null
}

type Order = {
  id: string
  action?: string
  status?: string
  created_at?: string
  display_id?: string | number
  total?: number
  currency_code?: string
}

type DnsRecord = {
  type: string
  host: string
  value: string
  ttl?: number
  priority?: number
}

type DetailResponse = {
  domain: Domain
  orders: Order[]
}

// ---------------------------------------------------------------------------
// Inline fetch helper
// ---------------------------------------------------------------------------
const api = async <T = any,>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  const res = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  })

  const raw = await res.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }

  return data as T
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const DAY_MS = 1000 * 60 * 60 * 24

const fmtDate = (d: string | null | undefined): string => {
  if (!d) {
    return "—"
  }
  const date = new Date(d)
  if (isNaN(date.getTime())) {
    return "—"
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const fmtDateTime = (d: string | null | undefined): string => {
  if (!d) {
    return "—"
  }
  const date = new Date(d)
  if (isNaN(date.getTime())) {
    return "—"
  }
  return date.toLocaleString()
}

const daysRemaining = (expiry: string | null | undefined): number | null => {
  if (!expiry) {
    return null
  }
  const date = new Date(expiry)
  if (isNaN(date.getTime())) {
    return null
  }
  return Math.ceil((date.getTime() - Date.now()) / DAY_MS)
}

const statusColor = (
  status: string
): "green" | "red" | "orange" | "grey" | "blue" => {
  const s = (status || "").toLowerCase()
  if (["active", "registered", "ok"].includes(s)) {
    return "green"
  }
  if (["expired", "cancelled", "failed", "error"].includes(s)) {
    return "red"
  }
  if (["pending", "processing", "transferring"].includes(s)) {
    return "orange"
  }
  if (["locked"].includes(s)) {
    return "blue"
  }
  return "grey"
}

const TTL_OPTIONS = [
  { value: "300", label: "5 minutes" },
  { value: "3600", label: "1 hour" },
  { value: "7200", label: "2 hours" },
  { value: "86400", label: "1 day" },
  { value: "604800", label: "1 week" },
]

const DNS_TYPES = ["A", "AAAA", "MX", "CNAME", "TXT", "NS"]
const DNS_TYPE_ORDER = ["A", "AAAA", "MX", "CNAME", "TXT", "NS"]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const DomainDetailPage = () => {
  const params = useParams()
  const domainName = params.domain || ""
  const encoded = encodeURIComponent(domainName)
  const base = `/admin/domains/${encoded}`

  const prompt = usePrompt()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [domain, setDomain] = useState<Domain | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<DetailResponse>(base)
      setDomain(data.domain)
      setOrders(data.orders || [])
    } catch (e: any) {
      setError(e?.message || "Failed to load domain")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainName])

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <Container className="p-0">
        <div className="px-6 py-4">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mb-2 h-7 w-64" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Divider />
        <div className="grid gap-4 px-6 py-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Container>
    )
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (error || !domain) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <InformationCircleSolid className="text-ui-fg-muted" />
          <div>
            <Heading level="h2">Could not load domain</Heading>
            <Text className="text-ui-fg-subtle mt-1">
              {error || `Domain "${domainName}" was not found.`}
            </Text>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>
              <ArrowPath />
              Retry
            </Button>
            <Link to="/app/domains">
              <Button variant="primary">
                <ArrowLeft />
                Back to domains
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      <PageHeader domain={domain} />

      <Container className="p-0">
        <Tabs defaultValue="overview">
          <div className="px-6 pt-4">
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="nameservers">Nameservers</Tabs.Trigger>
              <Tabs.Trigger value="dns">DNS records</Tabs.Trigger>
              <Tabs.Trigger value="transfer">Transfer out</Tabs.Trigger>
              <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
            </Tabs.List>
          </div>
          <Divider className="mt-4" />

          <Tabs.Content value="overview">
            <OverviewSection
              domain={domain}
              base={base}
              onDomainChange={setDomain}
              onReload={load}
            />
          </Tabs.Content>

          <Tabs.Content value="nameservers">
            <NameserversSection domain={domain} base={base} />
          </Tabs.Content>

          <Tabs.Content value="dns">
            <DnsSection base={base} prompt={prompt} />
          </Tabs.Content>

          <Tabs.Content value="transfer">
            <TransferOutSection
              domain={domain}
              base={base}
              onDomainChange={setDomain}
            />
          </Tabs.Content>

          <Tabs.Content value="activity">
            <ActivitySection orders={orders} />
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const PageHeader = ({ domain }: { domain: Domain }) => {
  return (
    <Container className="p-0">
      <div className="flex flex-col gap-y-3 px-6 py-4">
        <Link
          to="/app/domains"
          className="text-ui-fg-subtle hover:text-ui-fg-base flex w-fit items-center gap-x-1 text-sm"
        >
          <ArrowLeft />
          <span>All domains</span>
        </Link>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-3">
            <Globe className="text-ui-fg-subtle" />
            <Heading level="h1">{domain.domain_name}</Heading>
          </div>
          <StatusBadge color={statusColor(domain.status)}>
            {domain.status || "unknown"}
          </StatusBadge>
        </div>
      </div>
    </Container>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
const OverviewSection = ({
  domain,
  base,
  onDomainChange,
  onReload,
}: {
  domain: Domain
  base: string
  onDomainChange: (d: Domain) => void
  onReload: () => void
}) => {
  const [syncing, setSyncing] = useState(false)
  const [pending, setPending] = useState<Record<ToggleField, boolean>>({
    locked: false,
    privacy: false,
    auto_renew: false,
  })
  const [autoRenewNote, setAutoRenewNote] = useState<string | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)

  const remaining = daysRemaining(domain.expiry_date)
  const expired = remaining !== null && remaining < 0

  const fieldToKey: Record<ToggleField, keyof Domain> = {
    locked: "locked",
    privacy: "privacy_enabled",
    auto_renew: "auto_renew",
  }

  const handleToggle = async (field: ToggleField, enabled: boolean) => {
    const key = fieldToKey[field]
    const previous = domain[key] as boolean

    // optimistic
    onDomainChange({ ...domain, [key]: enabled })
    setPending((p) => ({ ...p, [field]: true }))
    if (field === "auto_renew") {
      setAutoRenewNote(null)
    }

    try {
      const res = await api<any>(`${base}/toggle`, {
        method: "POST",
        body: JSON.stringify({ field, enabled }),
      })

      // reconcile from response if it returns the updated domain
      const updated: Domain | undefined = res?.domain
      if (updated && typeof updated === "object") {
        onDomainChange(updated)
      } else if (
        res &&
        typeof res[key] === "boolean"
      ) {
        onDomainChange({ ...domain, [key]: res[key] })
      }

      if (field === "auto_renew" && res?.note) {
        setAutoRenewNote(String(res.note))
      }

      toast.success(`${labelFor(field)} ${enabled ? "enabled" : "disabled"}`)
    } catch (e: any) {
      // rollback
      onDomainChange({ ...domain, [key]: previous })
      toast.error(e?.message || `Could not update ${labelFor(field)}`)
    } finally {
      setPending((p) => ({ ...p, [field]: false }))
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api<{ domain: Domain }>(`${base}/sync`, {
        method: "POST",
      })
      if (res?.domain) {
        onDomainChange(res.domain)
      } else {
        onReload()
      }
      toast.success("Domain synced from registrar")
    } catch (e: any) {
      toast.error(e?.message || "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level="h2">Overview</Heading>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleSync}
            isLoading={syncing}
          >
            <ArrowPath />
            Sync
          </Button>
          <Button variant="primary" onClick={() => setRenewOpen(true)}>
            <Calendar />
            Renew
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        <InfoRow label="Registration date" value={fmtDate(domain.registration_date)} />
        <InfoRow
          label="Expiry date"
          value={
            <div className="flex items-center gap-x-2">
              <span>{fmtDate(domain.expiry_date)}</span>
              {remaining !== null ? (
                <Badge size="2xsmall" color={expired ? "red" : "grey"}>
                  <Clock className="mr-1 inline" />
                  {expired
                    ? `Expired ${Math.abs(remaining)}d ago`
                    : `${remaining} days remaining`}
                </Badge>
              ) : null}
            </div>
          }
        />
        <InfoRow
          label="Status"
          value={
            <StatusBadge color={statusColor(domain.status)}>
              {domain.status || "unknown"}
            </StatusBadge>
          }
        />
        <InfoRow label="Source" value={domain.source || "—"} />
        <InfoRow label="Order ID" value={domain.reseller_order_id || "—"} />
        <InfoRow label="Last synced" value={fmtDateTime(domain.last_synced_at)} />
      </div>

      <Divider className="my-6" />

      <Heading level="h3" className="mb-3">
        Settings
      </Heading>
      <div className="flex flex-col gap-y-4">
        <ToggleRow
          icon={<LockClosedSolid className="text-ui-fg-subtle" />}
          title="Transfer lock"
          description="Prevents the domain from being transferred to another registrar."
          checked={domain.locked}
          disabled={pending.locked}
          onChange={(v) => handleToggle("locked", v)}
        />
        <ToggleRow
          icon={<ShieldCheck className="text-ui-fg-subtle" />}
          title="WHOIS privacy"
          description="Hides your personal contact details from public WHOIS lookups."
          checked={domain.privacy_enabled}
          disabled={pending.privacy}
          onChange={(v) => handleToggle("privacy", v)}
        />
        <ToggleRow
          icon={<ArrowPath className="text-ui-fg-subtle" />}
          title="Auto-renew"
          description="Automatically renews the domain before it expires."
          checked={domain.auto_renew}
          disabled={pending.auto_renew}
          onChange={(v) => handleToggle("auto_renew", v)}
          hint={autoRenewNote || undefined}
        />
      </div>

      <RenewDrawer
        open={renewOpen}
        onOpenChange={setRenewOpen}
        base={base}
        expired={expired}
        onDone={onReload}
      />
    </div>
  )
}

const labelFor = (field: ToggleField): string => {
  if (field === "locked") {
    return "Transfer lock"
  }
  if (field === "privacy") {
    return "WHOIS privacy"
  }
  return "Auto-renew"
}

const InfoRow = ({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) => {
  return (
    <div className="flex flex-col gap-y-1">
      <Text size="small" className="text-ui-fg-muted">
        {label}
      </Text>
      <div className="text-ui-fg-base txt-compact-small">{value}</div>
    </div>
  )
}

const ToggleRow = ({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
  hint,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  hint?: string
}) => {
  return (
    <div className="bg-ui-bg-subtle flex items-start justify-between gap-x-4 rounded-lg border p-4">
      <div className="flex items-start gap-x-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <Text weight="plus" size="small">
            {title}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {description}
          </Text>
          {hint ? (
            <Hint className="mt-1">{hint}</Hint>
          ) : null}
        </div>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Renew drawer
// ---------------------------------------------------------------------------
const RenewDrawer = ({
  open,
  onOpenChange,
  base,
  expired,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  base: string
  expired: boolean
  onDone: () => void
}) => {
  const [years, setYears] = useState("1")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await api(`${base}/renew`, {
        method: "POST",
        body: JSON.stringify({
          years: Number(years),
          is_restore: expired,
        }),
      })
      toast.success(
        expired
          ? `Restore & renewal for ${years} year(s) submitted`
          : `Renewal for ${years} year(s) submitted`
      )
      onOpenChange(false)
      onDone()
    } catch (e: any) {
      toast.error(e?.message || "Renewal failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Renew domain</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          {expired ? (
            <InlineTip label="Expired" variant="warning">
              This domain has expired. Renewing it will attempt a restore,
              which may incur an additional redemption fee from the registrar.
            </InlineTip>
          ) : null}
          <div className="flex flex-col gap-y-2">
            <Label size="small">Renewal period</Label>
            <Select value={years} onValueChange={setYears}>
              <Select.Trigger>
                <Select.Value placeholder="Select years" />
              </Select.Trigger>
              <Select.Content>
                {[1, 2, 3, 4, 5].map((y) => (
                  <Select.Item key={y} value={String(y)}>
                    {y} year{y > 1 ? "s" : ""}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Cancel</Button>
          </Drawer.Close>
          <Button onClick={submit} isLoading={submitting}>
            {expired ? "Restore & renew" : "Renew"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Nameservers
// ---------------------------------------------------------------------------
const NameserversSection = ({
  domain,
  base,
}: {
  domain: Domain
  base: string
}) => {
  const [nameservers, setNameservers] = useState<string[]>(
    domain.nameservers && domain.nameservers.length
      ? domain.nameservers
      : []
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const loadNs = async () => {
    setLoading(true)
    try {
      const res = await api<{ nameservers: string[] }>(`${base}/nameservers`)
      setNameservers(res?.nameservers || [])
    } catch {
      setNameservers(domain.nameservers || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEdit = () => {
    const initial =
      nameservers.length >= 2 ? [...nameservers] : [...nameservers]
    while (initial.length < 2) {
      initial.push("")
    }
    setDraft(initial)
    setEditing(true)
  }

  const setRow = (i: number, v: string) => {
    setDraft((rows) => rows.map((r, idx) => (idx === i ? v : r)))
  }

  const addRow = () => setDraft((rows) => [...rows, ""])

  const removeRow = (i: number) => {
    setDraft((rows) =>
      rows.length <= 2 ? rows : rows.filter((_, idx) => idx !== i)
    )
  }

  const save = async () => {
    const cleaned = draft.map((d) => d.trim()).filter(Boolean)
    if (cleaned.length < 2) {
      toast.error("At least two nameservers are required")
      return
    }
    setSaving(true)
    try {
      await api(`${base}/nameservers`, {
        method: "POST",
        body: JSON.stringify({ nameservers: cleaned }),
      })
      toast.success("Nameservers updated")
      setEditing(false)
      await loadNs()
    } catch (e: any) {
      toast.error(e?.message || "Could not update nameservers")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2">Nameservers</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            The DNS servers that answer queries for this domain.
          </Text>
        </div>
        {!editing ? (
          <Button variant="secondary" onClick={startEdit}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </div>

      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : editing ? (
          <div className="flex flex-col gap-y-3">
            {draft.map((ns, i) => (
              <div key={i} className="flex items-center gap-x-2">
                <Input
                  placeholder={`ns${i + 1}.example.com`}
                  value={ns}
                  onChange={(e) => setRow(i, e.target.value)}
                />
                <IconButton
                  variant="transparent"
                  onClick={() => removeRow(i)}
                  disabled={draft.length <= 2}
                  aria-label="Remove nameserver"
                >
                  <Trash />
                </IconButton>
              </div>
            ))}
            <div>
              <Button variant="secondary" size="small" onClick={addRow}>
                <Plus />
                Add nameserver
              </Button>
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={save} isLoading={saving}>
                Save nameservers
              </Button>
            </div>
          </div>
        ) : nameservers.length === 0 ? (
          <Text className="text-ui-fg-subtle">
            No nameservers configured.
          </Text>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {nameservers.map((ns, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="font-mono text-sm">{ns}</span>
                <Copy content={ns} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DNS records
// ---------------------------------------------------------------------------
type DnsForm = {
  mode: "add" | "edit"
  type: string
  host: string
  value: string
  ttl: string
  priority: string
  original?: DnsRecord
}

const emptyDnsForm = (): DnsForm => ({
  mode: "add",
  type: "A",
  host: "@",
  value: "",
  ttl: "3600",
  priority: "10",
})

const DnsSection = ({
  base,
  prompt,
}: {
  base: string
  prompt: ReturnType<typeof usePrompt>
}) => {
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<DnsForm | null>(null)

  const loadDns = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ records: DnsRecord[] }>(`${base}/dns`)
      setRecords(res?.records || [])
    } catch (e: any) {
      setError(e?.message || "Could not load DNS records")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, DnsRecord[]>()
    for (const r of records) {
      const t = (r.type || "").toUpperCase()
      if (!map.has(t)) {
        map.set(t, [])
      }
      map.get(t)!.push(r)
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ia = DNS_TYPE_ORDER.indexOf(a)
      const ib = DNS_TYPE_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return keys.map((k) => ({ type: k, rows: map.get(k)! }))
  }, [records])

  const openAdd = () => setForm(emptyDnsForm())

  const openEdit = (r: DnsRecord) =>
    setForm({
      mode: "edit",
      type: (r.type || "A").toUpperCase(),
      host: r.host,
      value: r.value,
      ttl: r.ttl ? String(r.ttl) : "3600",
      priority: r.priority != null ? String(r.priority) : "10",
      original: r,
    })

  const handleDelete = async (r: DnsRecord) => {
    const ok = await prompt({
      title: "Delete DNS record",
      description: `Delete the ${r.type} record for "${r.host}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (!ok) {
      return
    }
    try {
      await api(`${base}/dns`, {
        method: "POST",
        body: JSON.stringify({
          op: "delete",
          record: {
            type: r.type,
            host: r.host,
            value: r.value,
            ttl: r.ttl,
            priority: r.priority,
          },
        }),
      })
      toast.success("DNS record deleted")
      await loadDns()
    } catch (e: any) {
      toast.error(e?.message || "Could not delete record")
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2">DNS records</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Manage the records served for this domain.
          </Text>
        </div>
        <Button variant="secondary" onClick={openAdd}>
          <Plus />
          Add record
        </Button>
      </div>

      <InlineTip label="Note" className="mt-4">
        DNS management only takes effect while the domain uses the
        registrar&apos;s nameservers. If you point the domain elsewhere,
        manage DNS at that provider instead.
      </InlineTip>

      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border p-4">
            <Text className="text-ui-fg-subtle">{error}</Text>
            <Button variant="secondary" size="small" onClick={loadDns}>
              <ArrowPath />
              Retry
            </Button>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Text className="text-ui-fg-subtle">No DNS records yet.</Text>
            <Button variant="secondary" size="small" onClick={openAdd}>
              <Plus />
              Add your first record
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-y-6">
            {grouped.map((g) => (
              <div key={g.type}>
                <div className="mb-2 flex items-center gap-x-2">
                  <Badge size="2xsmall">{g.type}</Badge>
                  <Text size="small" className="text-ui-fg-muted">
                    {g.rows.length} record{g.rows.length > 1 ? "s" : ""}
                  </Text>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Host</Table.HeaderCell>
                        <Table.HeaderCell>Type</Table.HeaderCell>
                        <Table.HeaderCell>Value</Table.HeaderCell>
                        <Table.HeaderCell>TTL</Table.HeaderCell>
                        {g.type === "MX" ? (
                          <Table.HeaderCell>Priority</Table.HeaderCell>
                        ) : null}
                        <Table.HeaderCell className="text-right">
                          Actions
                        </Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {g.rows.map((r, i) => (
                        <Table.Row key={`${g.type}-${i}`}>
                          <Table.Cell className="font-mono">
                            {r.host}
                          </Table.Cell>
                          <Table.Cell>{r.type}</Table.Cell>
                          <Table.Cell className="font-mono">
                            <span className="line-clamp-1 inline-block max-w-[280px] align-middle">
                              {r.value}
                            </span>
                          </Table.Cell>
                          <Table.Cell>{r.ttl ?? "—"}</Table.Cell>
                          {g.type === "MX" ? (
                            <Table.Cell>{r.priority ?? "—"}</Table.Cell>
                          ) : null}
                          <Table.Cell>
                            <div className="flex justify-end gap-x-1">
                              <IconButton
                                size="small"
                                variant="transparent"
                                onClick={() => openEdit(r)}
                                aria-label="Edit record"
                              >
                                <Pencil />
                              </IconButton>
                              <IconButton
                                size="small"
                                variant="transparent"
                                onClick={() => handleDelete(r)}
                                aria-label="Delete record"
                              >
                                <Trash />
                              </IconButton>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form ? (
        <DnsRecordDrawer
          base={base}
          form={form}
          onClose={() => setForm(null)}
          onDone={async () => {
            setForm(null)
            await loadDns()
          }}
        />
      ) : null}
    </div>
  )
}

const DnsRecordDrawer = ({
  base,
  form,
  onClose,
  onDone,
}: {
  base: string
  form: DnsForm
  onClose: () => void
  onDone: () => void
}) => {
  const [state, setState] = useState<DnsForm>(form)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof DnsForm>(key: K, value: DnsForm[K]) => {
    setState((s) => ({ ...s, [key]: value }))
  }

  const submit = async () => {
    if (!state.host.trim() || !state.value.trim()) {
      toast.error("Host and value are required")
      return
    }
    setSubmitting(true)
    try {
      const record: Record<string, any> = {
        type: state.type,
        host: state.host.trim(),
        value: state.value.trim(),
        ttl: Number(state.ttl),
      }
      if (state.type === "MX") {
        record.priority = Number(state.priority)
      }
      if (state.mode === "edit") {
        // send the new value under newValue, keep the original value as target
        record.newValue = state.value.trim()
        if (state.original) {
          record.value = state.original.value
        }
      }

      await api(`${base}/dns`, {
        method: "POST",
        body: JSON.stringify({
          op: state.mode === "edit" ? "update" : "add",
          record,
        }),
      })
      toast.success(
        state.mode === "edit" ? "DNS record updated" : "DNS record added"
      )
      onDone()
    } catch (e: any) {
      toast.error(e?.message || "Could not save record")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open onOpenChange={(v) => (!v ? onClose() : null)}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {state.mode === "edit" ? "Edit DNS record" : "Add DNS record"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small">Type</Label>
            <Select value={state.type} onValueChange={(v) => set("type", v)}>
              <Select.Trigger>
                <Select.Value placeholder="Record type" />
              </Select.Trigger>
              <Select.Content>
                {DNS_TYPES.map((t) => (
                  <Select.Item key={t} value={t}>
                    {t}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small">Host</Label>
            <Input
              placeholder="@ or subdomain"
              value={state.host}
              onChange={(e) => set("host", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small">Value</Label>
            <Input
              placeholder="Record value"
              value={state.value}
              onChange={(e) => set("value", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small">TTL</Label>
            <Select value={state.ttl} onValueChange={(v) => set("ttl", v)}>
              <Select.Trigger>
                <Select.Value placeholder="TTL" />
              </Select.Trigger>
              <Select.Content>
                {TTL_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>
                    {o.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {state.type === "MX" ? (
            <div className="flex flex-col gap-y-2">
              <Label size="small">Priority</Label>
              <Input
                type="number"
                placeholder="10"
                value={state.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </div>
          ) : null}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={submitting}>
            {state.mode === "edit" ? "Save changes" : "Add record"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Transfer out
// ---------------------------------------------------------------------------
const TransferOutSection = ({
  domain,
  base,
  onDomainChange,
}: {
  domain: Domain
  base: string
  onDomainChange: (d: Domain) => void
}) => {
  const [loading, setLoading] = useState(false)
  const [authCode, setAuthCode] = useState<string | null>(null)

  const getCode = async () => {
    setLoading(true)
    try {
      const res = await api<{ locked: boolean; auth_code: string }>(
        `${base}/transfer-out`,
        { method: "POST" }
      )
      setAuthCode(res?.auth_code || "")
      onDomainChange({ ...domain, locked: !!res?.locked })
      toast.success("Transfer authorization code retrieved")
    } catch (e: any) {
      toast.error(e?.message || "Could not start transfer out")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-6">
      <Heading level="h2">Transfer out</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Move this domain to another registrar. Getting the transfer code will
        unlock the domain and reveal its EPP / authorization code.
      </Text>

      <div className="mt-5 rounded-lg border p-5">
        {!authCode ? (
          <div className="flex flex-col items-start gap-y-3">
            <Text size="small" className="text-ui-fg-subtle">
              When you are ready, generate the authorization code below. You
              will use it at your new registrar to complete the transfer.
            </Text>
            <Button variant="primary" onClick={getCode} isLoading={loading}>
              <Key />
              Get transfer (EPP) code
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-y-4">
            <div>
              <Label size="small" className="text-ui-fg-muted">
                Authorization (EPP) code
              </Label>
              <div className="bg-ui-bg-subtle mt-1 flex items-center justify-between gap-x-3 rounded-md border px-3 py-2">
                <span className="font-mono text-sm break-all">
                  {authCode || "(none returned)"}
                </span>
                <Copy content={authCode || ""} />
              </div>
            </div>

            <div>
              <Text weight="plus" size="small" className="mb-2">
                Next steps at your new registrar
              </Text>
              <ol className="text-ui-fg-subtle flex list-decimal flex-col gap-y-1 pl-5 text-sm">
                <li>
                  Transfer lock has been removed
                  <CheckCircleSolid className="text-ui-tag-green-icon ml-1 inline" />
                </li>
                <li>Copy the authorization code above.</li>
                <li>
                  Start a domain transfer at your new registrar and paste the
                  code when prompted.
                </li>
                <li>
                  Approve the confirmation email sent to the domain&apos;s
                  admin contact.
                </li>
                <li>
                  The transfer typically completes in about 5&ndash;7 days.
                </li>
              </ol>
            </div>

            <div>
              <Button
                variant="secondary"
                size="small"
                onClick={getCode}
                isLoading={loading}
              >
                <ArrowPath />
                Regenerate code
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------
const ActivitySection = ({ orders }: { orders: Order[] }) => {
  return (
    <div className="px-6 py-6">
      <Heading level="h2">Recent activity</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Orders and registrar actions associated with this domain.
      </Text>

      <div className="mt-5">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center">
            <Text className="text-ui-fg-subtle">No activity yet.</Text>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {orders.map((o) => (
                  <Table.Row key={o.id}>
                    <Table.Cell>
                      {o.action ||
                        (o.display_id != null
                          ? `Order #${o.display_id}`
                          : o.id)}
                    </Table.Cell>
                    <Table.Cell>
                      {o.status ? (
                        <StatusBadge color={statusColor(o.status)}>
                          {o.status}
                        </StatusBadge>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell>{fmtDateTime(o.created_at)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DomainDetailPage
