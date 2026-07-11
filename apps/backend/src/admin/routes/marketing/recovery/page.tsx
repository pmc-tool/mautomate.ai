/**
 * Marketing — Cart Recovery.
 *
 * The abandoned-cart recovery command center: a master enable toggle, KPI
 * overview, a small config panel (idle threshold / step delay / discount), and
 * the live recovery queue. Self-contained — inline fetch helper + types, built
 * on the shared marketing ui-kit so it matches the rest of the suite.
 *
 * APIs (all under /admin/marketing/recovery):
 *   GET  /config   → { enabled, idle_minutes, step_hours, discount_pct }
 *   POST /config   → persist any of the above, returns updated config
 *   GET  /stats    → KPI aggregate over a rolling window
 *   GET  /         → { recoveries, count, limit, offset } (status filter)
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingCart } from "@medusajs/icons"
import {
  Button,
  Container,
  Input,
  Switch,
  Tabs,
  Text,
  toast,
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

type RecoveryStatus =
  | "active"
  | "processing"
  | "recovered"
  | "completed"
  | "canceled"
  | "failed"

type Recovery = {
  id: string
  cart_id: string
  email: string
  step: number
  status: RecoveryStatus
  next_run_at?: string | null
  discount_code?: string | null
  cart_total?: number | null
  currency_code?: string | null
  recovered_at?: string | null
  created_at?: string
}

type Config = {
  enabled: boolean
  idle_minutes: number
  step_hours: number
  discount_pct: number
}

type Stats = {
  detected: number
  active: number
  emailed: number
  recovered: number
  recovered_revenue: number
  recovery_rate: number
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
  const res = await fetch(`/admin/marketing/recovery${path}`, {
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

const PAGE_SIZE = 20

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "processing", label: "Processing" },
  { value: "recovered", label: "Recovered" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
]

const STATUS_TONE: Record<
  RecoveryStatus,
  "green" | "amber" | "rose" | "blue" | "violet" | "slate"
> = {
  active: "blue",
  processing: "violet",
  recovered: "green",
  completed: "slate",
  canceled: "slate",
  failed: "rose",
}

const shortId = (id: string): string => {
  if (!id) {
    return "—"
  }
  const tail = id.length > 8 ? id.slice(-8) : id
  return `#${tail}`
}

const fmtMoney = (
  amount?: number | null,
  currency?: string | null
): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—"
  }
  const code = (currency ?? "usd").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
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

const fmtRelative = (iso?: string | null): string => {
  if (!iso) {
    return "—"
  }
  const d = new Date(iso)
  const ms = d.getTime()
  if (Number.isNaN(ms)) {
    return "—"
  }
  const diff = ms - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  const hours = Math.round(abs / 3600000)
  const daysN = Math.round(abs / 86400000)
  let label: string
  if (mins < 1) {
    label = "now"
  } else if (mins < 60) {
    label = `${mins}m`
  } else if (hours < 24) {
    label = `${hours}h`
  } else {
    label = `${daysN}d`
  }
  if (label === "now") {
    return "now"
  }
  return diff >= 0 ? `in ${label}` : `${label} ago`
}

const pct = (v: number): string => `${Math.round((v ?? 0) * 100)}%`

/* ------------------------------------------------------------------ *
 * Step progress indicator (0–3)
 * ------------------------------------------------------------------ */

const StepDots = ({ step }: { step: number }) => {
  const s = Math.max(0, Math.min(3, Number(step) || 0))
  return (
    <span className="inline-flex items-center gap-x-1" title={`Email ${s} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: i <= s ? "#2E6BFF" : "transparent",
            boxShadow:
              i <= s
                ? "none"
                : "inset 0 0 0 1px color-mix(in srgb, #64748B 40%, transparent)",
          }}
        />
      ))}
      <Text size="xsmall" className="ml-1 text-ui-fg-muted tabular-nums">
        {s}/3
      </Text>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const RecoveryPage = () => {
  const [config, setConfig] = useState<Config | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [rows, setRows] = useState<Recovery[]>([])
  const [count, setCount] = useState(0)

  const [statusTab, setStatusTab] = useState("all")
  const [offset, setOffset] = useState(0)

  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingToggle, setSavingToggle] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Local editable config fields (strings for the number inputs).
  const [idle, setIdle] = useState("60")
  const [stepHours, setStepHours] = useState("24")
  const [discount, setDiscount] = useState("10")

  const syncConfigInputs = useCallback((c: Config) => {
    setIdle(String(c.idle_minutes))
    setStepHours(String(c.step_hours))
    setDiscount(String(c.discount_pct))
  }, [])

  const loadTable = useCallback(async () => {
    setTableLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set("limit", String(PAGE_SIZE))
      qs.set("offset", String(offset))
      if (statusTab !== "all") {
        qs.set("status", statusTab)
      }
      const data = await api<{ recoveries: Recovery[]; count: number }>(
        `?${qs.toString()}`
      )
      setRows(Array.isArray(data.recoveries) ? data.recoveries : [])
      setCount(Number(data.count ?? 0))
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load the recovery queue.")
    } finally {
      setTableLoading(false)
    }
  }, [offset, statusTab])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfg, st] = await Promise.all([
        api<Config>("/config"),
        api<Stats>("/stats?days=30"),
      ])
      setConfig(cfg)
      syncConfigInputs(cfg)
      setStats(st)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load cart recovery.")
    } finally {
      setLoading(false)
    }
  }, [syncConfigInputs])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadTable()
  }, [loadTable])

  const onToggle = useCallback(
    async (next: boolean) => {
      setSavingToggle(true)
      // Optimistic.
      setConfig((c) => (c ? { ...c, enabled: next } : c))
      try {
        const updated = await api<Config>("/config", {
          method: "POST",
          json: { enabled: next },
        })
        setConfig(updated)
        toast.success(
          next ? "Cart recovery enabled." : "Cart recovery disabled."
        )
      } catch (e: any) {
        setConfig((c) => (c ? { ...c, enabled: !next } : c))
        toast.error(e?.message ?? "Failed to update the toggle.")
      } finally {
        setSavingToggle(false)
      }
    },
    []
  )

  const onSaveConfig = useCallback(async () => {
    setSavingConfig(true)
    try {
      const updated = await api<Config>("/config", {
        method: "POST",
        json: {
          idle_minutes: parseInt(idle) || 0,
          step_hours: parseInt(stepHours) || 0,
          discount_pct: parseInt(discount) || 0,
        },
      })
      setConfig(updated)
      syncConfigInputs(updated)
      toast.success("Recovery settings saved.")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save settings.")
    } finally {
      setSavingConfig(false)
    }
  }, [idle, stepHours, discount, syncConfigInputs])

  const onTab = useCallback((v: string) => {
    setStatusTab(v)
    setOffset(0)
  }, [])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasActivity = (stats?.detected ?? 0) > 0

  const configDirty = useMemo(() => {
    if (!config) {
      return false
    }
    return (
      String(config.idle_minutes) !== idle ||
      String(config.step_hours) !== stepHours ||
      String(config.discount_pct) !== discount
    )
  }, [config, idle, stepHours, discount])

  /* ---- Loading / error ---- */
  if (loading) {
    return (
      <Container className="p-0">
        <PageHeader
          icon={ShoppingCart}
          accent="teal"
          title="Cart Recovery"
          subtitle="Win back abandoned carts with an automated email sequence."
        />
        <div className="px-6 pb-10">
          <Text size="small" className="text-ui-fg-muted">
            Loading…
          </Text>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="p-0">
        <PageHeader
          icon={ShoppingCart}
          accent="teal"
          title="Cart Recovery"
          subtitle="Win back abandoned carts with an automated email sequence."
        />
        <EmptyState
          icon={ShoppingCart}
          accent="rose"
          title="Couldn't load cart recovery"
          description={error}
          action={
            <Button size="small" variant="secondary" onClick={loadOverview}>
              Retry
            </Button>
          }
        />
      </Container>
    )
  }

  const enabled = config?.enabled ?? false

  return (
    <Container className="p-0">
      <PageHeader
        icon={ShoppingCart}
        accent="teal"
        title="Cart Recovery"
        subtitle="Win back abandoned carts with an automated 3-email sequence."
        actions={
          <div className="flex items-center gap-x-3">
            <Text
              size="small"
              weight="plus"
              className={enabled ? "text-ui-fg-base" : "text-ui-fg-muted"}
            >
              {enabled ? "On" : "Off"}
            </Text>
            <Switch
              checked={enabled}
              disabled={savingToggle}
              onCheckedChange={onToggle}
            />
          </div>
        }
      />

      {/* Enable note + cadence intro */}
      <div className="px-6 pb-5">
        <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Recovery only runs when this toggle{" "}
            <span className="font-medium text-ui-fg-base">and</span> the global
            marketing switch are both on. When a shopper leaves a cart idle past
            the threshold, we send up to three nudges — roughly{" "}
            <span className="font-medium text-ui-fg-base">≈1h</span>,{" "}
            <span className="font-medium text-ui-fg-base">≈24h</span>, and{" "}
            <span className="font-medium text-ui-fg-base">≈48h</span> after —
            with an escalating incentive. A completed order stops the sequence
            and marks the cart recovered.
          </Text>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-6 pb-6">
        <SectionLabel>Last 30 days</SectionLabel>
        {hasActivity ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <StatTile
              label="Carts detected"
              value={stats?.detected ?? 0}
              accent="teal"
            />
            <StatTile
              label="Emails sent"
              value={stats?.emailed ?? 0}
              accent="blue"
            />
            <StatTile
              label="Carts recovered"
              value={stats?.recovered ?? 0}
              accent="green"
            />
            <StatTile
              label="Revenue recovered"
              value={fmtMoney(stats?.recovered_revenue ?? 0, "usd")}
              accent="violet"
            />
            <StatTile
              label="Recovery rate"
              value={pct(stats?.recovery_rate ?? 0)}
              sub={`${stats?.recovered ?? 0} of ${stats?.detected ?? 0}`}
              accent="amber"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-ui-border-base bg-ui-bg-base">
            <EmptyState
              icon={ShoppingCart}
              accent="teal"
              title="No recovery activity yet"
              description={
                enabled
                  ? "Abandoned carts will start showing up here as shoppers leave items behind."
                  : "Turn on the toggle above to start recovering abandoned carts."
              }
            />
          </div>
        )}
      </div>

      {/* Config panel */}
      <div className="px-6 pb-6">
        <SectionLabel>Sequence settings</SectionLabel>
        <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ConfigField
              label="Idle threshold (minutes)"
              hint="How long a cart sits before it's considered abandoned."
              value={idle}
              onChange={setIdle}
              min={1}
            />
            <ConfigField
              label="Step delay (hours)"
              hint="Base spacing between the emails in the sequence."
              value={stepHours}
              onChange={setStepHours}
              min={1}
            />
            <ConfigField
              label="Discount (%)"
              hint="Incentive offered in the later nudges."
              value={discount}
              onChange={setDiscount}
              min={0}
              max={100}
            />
          </div>
          <div className="mt-4 flex justify-end border-t border-ui-border-base pt-4">
            <Button
              size="small"
              onClick={onSaveConfig}
              isLoading={savingConfig}
              disabled={!configDirty}
            >
              Save settings
            </Button>
          </div>
        </div>
      </div>

      {/* Recovery queue */}
      <div className="px-6 pb-10">
        <SectionLabel count={count}>Recovery queue</SectionLabel>
        <div className="overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-base">
          <div className="border-b border-ui-border-base px-3 py-2">
            <Tabs value={statusTab} onValueChange={onTab}>
              <Tabs.List>
                {STATUS_TABS.map((t) => (
                  <Tabs.Trigger key={t.value} value={t.value}>
                    {t.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </div>

          {tableLoading ? (
            <div className="px-6 py-10">
              <Text size="small" className="text-ui-fg-muted">
                Loading queue…
              </Text>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              accent="slate"
              title="No carts in this view"
              description="Nothing matches the current filter yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="border-b border-ui-border-base text-ui-fg-muted">
                    <Th>Cart</Th>
                    <Th>Email</Th>
                    <Th>Step</Th>
                    <Th>Status</Th>
                    <Th>Cart total</Th>
                    <Th>Next run</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-ui-border-base last:border-0 hover:bg-ui-bg-base-hover"
                    >
                      <Td>
                        <span className="font-mono text-xs text-ui-fg-base">
                          {shortId(r.cart_id)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ui-fg-base">
                          {r.email || "—"}
                        </span>
                      </Td>
                      <Td>
                        <StepDots step={r.step} />
                      </Td>
                      <Td>
                        <StatusDot tone={STATUS_TONE[r.status] ?? "slate"}>
                          {r.status}
                        </StatusDot>
                      </Td>
                      <Td>
                        <span className="tabular-nums text-ui-fg-base">
                          {fmtMoney(r.cart_total, r.currency_code)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ui-fg-subtle">
                          {r.status === "active" || r.status === "processing"
                            ? fmtRelative(r.next_run_at)
                            : "—"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ui-fg-subtle">
                          {fmtDate(r.created_at)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {count > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-ui-border-base px-4 py-3">
              <Text size="small" className="text-ui-fg-muted">
                Page {page} of {pageCount} · {count} total
              </Text>
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={offset === 0 || tableLoading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={offset + PAGE_SIZE >= count || tableLoading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ *
 * Small presentational helpers
 * ------------------------------------------------------------------ */

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
    {children}
  </th>
)

const Td = ({ children }: { children: React.ReactNode }) => (
  <td className="px-4 py-3 text-sm align-middle">{children}</td>
)

const ConfigField = ({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
}) => (
  <div className="flex flex-col gap-y-1.5">
    <Text size="small" weight="plus" className="text-ui-fg-base">
      {label}
    </Text>
    <Input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
    />
    <Text size="xsmall" className="text-ui-fg-muted">
      {hint}
    </Text>
  </div>
)

export const config = defineRouteConfig({
  label: "Cart Recovery",
  icon: ShoppingCart,
})

export default RecoveryPage
