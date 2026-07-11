"use client"

import React, { useEffect, useState } from "react"
import {
  Spinner,
  ArrowPath,
  ShieldCheck,
  LockClosedSolid,
  Server,
  CircleStack,
  ArrowUpRightOnBox,
  Trash,
  Plus,
} from "@medusajs/icons"
import { Modal } from "@components/merchant-admin/modal"
import { Select, Input } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import {
  Domain,
  DnsRecord,
  renewDomain,
  getDomainDnsRecords,
  addDomainDnsRecord,
  deleteDomainDnsRecord,
  getDomainNameservers,
  setDomainNameservers,
  setDomainPrivacy,
  setDomainLock,
  prepareDomainTransferOut,
  TransferOutResponse,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"
import { Callout, CopyField, btnPrimary, btnSecondary } from "./ui"

type ToolKey = "renew" | "dns" | "nameservers" | "privacy" | "lock" | "transfer-out"

const TOOLS: { key: ToolKey; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { key: "renew", label: "Renew", icon: ArrowPath, hint: "Extend the registration period" },
  { key: "dns", label: "DNS records", icon: CircleStack, hint: "Edit A / CNAME / TXT records" },
  { key: "nameservers", label: "Nameservers", icon: Server, hint: "Point the domain elsewhere" },
  { key: "privacy", label: "WHOIS privacy", icon: ShieldCheck, hint: "Hide your contact details" },
  { key: "lock", label: "Transfer lock", icon: LockClosedSolid, hint: "Prevent unauthorized transfers" },
  { key: "transfer-out", label: "Transfer out", icon: ArrowUpRightOnBox, hint: "Get the EPP code to leave" },
]

export function ManageDomainModal({
  open,
  onClose,
  token,
  domain,
  registrarConfigured,
}: {
  open: boolean
  onClose: () => void
  token: string
  domain: Domain | null
  registrarConfigured: boolean | null
}) {
  const [tool, setTool] = useState<ToolKey>("renew")

  useEffect(() => {
    if (open) setTool("renew")
  }, [open, domain?.id])

  const name = domain?.domain ?? ""

  return (
    <Modal open={open} onClose={onClose} title={`Manage ${name}`} size="lg">
      {registrarConfigured !== true ? (
        <Callout tone="warning" title="Domain management isn't available yet">
          Renew, DNS, nameservers, privacy, transfer lock and transfer-out become
          available once our team connects the registrar (ResellerClub) for your
          store. Your domain keeps working in the meantime — this only affects
          registrar-level controls.
        </Callout>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
          {/* Tool nav */}
          <nav className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
            {TOOLS.map((t) => {
              const Icon = t.icon
              const active = tool === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTool(t.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-base border px-3 py-2 text-left text-sm transition-colors sm:shrink",
                    active
                      ? "border-grey-90 bg-grey-90 text-white"
                      : "border-grey-20 bg-white text-grey-70 hover:bg-grey-10"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="min-h-[16rem]">
            {tool === "renew" && <RenewTool token={token} domain={name} />}
            {tool === "dns" && <DnsTool token={token} domain={name} />}
            {tool === "nameservers" && <NameserversTool token={token} domain={name} />}
            {tool === "privacy" && <ToggleTool token={token} domain={name} kind="privacy" />}
            {tool === "lock" && <ToggleTool token={token} domain={name} kind="lock" />}
            {tool === "transfer-out" && <TransferOutTool token={token} domain={name} />}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Status({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <Callout tone="warning">{error}</Callout>
  if (ok) return <Callout tone="success">{ok}</Callout>
  return null
}

function RenewTool({ token, domain }: { token: string; domain: string }) {
  const [years, setYears] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await renewDomain(token, domain, years)
      setOk(`Renewed ${domain} for ${years} year${years > 1 ? "s" : ""}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Renewal failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-grey-90">Renew registration</h4>
      <div className="flex items-center gap-3">
        <Select value={String(years)} onChange={(e) => setYears(Number(e.target.value))} className="w-28">
          {[1, 2, 3, 5, 10].map((y) => (
            <option key={y} value={y}>
              {y} year{y > 1 ? "s" : ""}
            </option>
          ))}
        </Select>
        <button onClick={run} disabled={busy} className={btnPrimary}>
          {busy && <Spinner className="h-4 w-4 animate-spin" />}
          {busy ? "Renewing..." : "Renew"}
        </button>
      </div>
      <p className="text-xs text-grey-50">Charged from your store credit balance.</p>
      <Status error={error} ok={ok} />
    </div>
  )
}

function DnsTool({ token, domain }: { token: string; domain: string }) {
  const [records, setRecords] = useState<DnsRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [draft, setDraft] = useState<DnsRecord>({ type: "A", host: "", value: "", ttl: 3600 })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDomainDnsRecords(token, domain)
      setRecords(res.records ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load DNS records")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])

  const add = async () => {
    if (!draft.host.trim() || !draft.value.trim()) return
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await addDomainDnsRecord(token, domain, draft)
      setOk("Record added.")
      setDraft({ type: "A", host: "", value: "", ttl: 3600 })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add record")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (record: DnsRecord) => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await deleteDomainDnsRecord(token, domain, record)
      setOk("Record deleted.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete record")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-grey-90">DNS records</h4>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-grey-50">
          <Spinner className="h-4 w-4 animate-spin" /> Loading records...
        </div>
      ) : records && records.length > 0 ? (
        <div className="overflow-hidden rounded-large border border-grey-20">
          <table className="min-w-full text-sm">
            <thead className="bg-grey-10 text-grey-60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Host</th>
                <th className="px-3 py-2 text-left font-medium">Value</th>
                <th className="px-3 py-2 text-left font-medium">TTL</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {records.map((r, idx) => (
                <tr key={r.id ?? idx}>
                  <td className="px-3 py-2 font-mono text-xs text-grey-80">{r.type}</td>
                  <td className="px-3 py-2 font-mono text-xs text-grey-80 break-all">{r.host}</td>
                  <td className="px-3 py-2 font-mono text-xs text-grey-80 break-all">{r.value}</td>
                  <td className="px-3 py-2 text-xs text-grey-60">{r.ttl ?? "Auto"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(r)}
                      disabled={busy}
                      className="rounded-base p-1 text-grey-40 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      aria-label="Delete record"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-grey-50">No records yet.</p>
      )}

      {/* Add record */}
      <div className="rounded-large border border-grey-20 bg-grey-5 p-3">
        <p className="mb-2 text-xs font-medium text-grey-60">Add a record</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            className="sm:w-24"
          >
            {["A", "AAAA", "CNAME", "TXT", "MX", "NS"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            placeholder="host (e.g. @ or www)"
            value={draft.host}
            onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))}
          />
          <Input
            placeholder="value"
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          />
          <button onClick={add} disabled={busy || !draft.host.trim() || !draft.value.trim()} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <Status error={error} ok={ok} />
    </div>
  )
}

function NameserversTool({ token, domain }: { token: string; domain: string }) {
  const [ns, setNs] = useState<string[]>(["", ""])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await getDomainNameservers(token, domain)
        setNs(res.nameservers?.length ? res.nameservers : ["", ""])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load nameservers")
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])

  const save = async () => {
    const cleaned = ns.map((n) => n.trim()).filter(Boolean)
    if (cleaned.length < 2) {
      setError("Enter at least two nameservers.")
      return
    }
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await setDomainNameservers(token, domain, cleaned)
      setOk("Nameservers updated.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update nameservers")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-grey-50">
        <Spinner className="h-4 w-4 animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-grey-90">Nameservers</h4>
      <div className="space-y-2">
        {ns.map((n, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              placeholder={`ns${idx + 1}.example.com`}
              value={n}
              onChange={(e) => setNs((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
            />
            {ns.length > 2 && (
              <button
                onClick={() => setNs((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-base p-2 text-grey-40 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove nameserver"
              >
                <Trash className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setNs((prev) => (prev.length < 6 ? [...prev, ""] : prev))}
          className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
        >
          <Plus className="h-4 w-4" /> Add nameserver
        </button>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy && <Spinner className="h-4 w-4 animate-spin" />}
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
      <Status error={error} ok={ok} />
    </div>
  )
}

function ToggleTool({
  token,
  domain,
  kind,
}: {
  token: string
  domain: string
  kind: "privacy" | "lock"
}) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const title = kind === "privacy" ? "WHOIS privacy protection" : "Transfer lock"
  const desc =
    kind === "privacy"
      ? "Hide your name, email and address from public WHOIS lookups."
      : "Block transfers to another registrar until you unlock it."

  const apply = async (value: boolean) => {
    setBusy(true)
    setError(null)
    setOk(null)
    setEnabled(value)
    try {
      if (kind === "privacy") await setDomainPrivacy(token, domain, value)
      else await setDomainLock(token, domain, value)
      setOk(`${title} ${value ? "enabled" : "disabled"}.`)
    } catch (err) {
      setEnabled(!value)
      setError(err instanceof Error ? err.message : "Could not update setting")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-grey-90">{title}</h4>
      <div className="rounded-large border border-grey-20 p-4">
        <FormToggle checked={enabled} onChange={apply} label={title} description={desc} />
      </div>
      <p className="text-xs text-grey-50">
        Toggling this applies the change at the registrar right away.
      </p>
      <Status error={error} ok={busy ? null : ok} />
    </div>
  )
}

function TransferOutTool({ token, domain }: { token: string; domain: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TransferOutResponse | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await prepareDomainTransferOut(token, domain)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare transfer out")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-grey-90">Transfer this domain away</h4>
      <p className="text-sm text-grey-60">
        Moving to another registrar? We&apos;ll unlock the domain and give you the
        EPP/auth code to hand to your new provider.
      </p>
      {!result ? (
        <button onClick={run} disabled={busy} className={btnSecondary}>
          {busy ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowUpRightOnBox className="h-4 w-4" />}
          {busy ? "Preparing..." : "Get EPP code"}
        </button>
      ) : (
        <div className="space-y-3">
          <Callout tone="success" title="Domain unlocked for transfer">
            Give this code to your new registrar. It stays valid until the transfer
            completes.
          </Callout>
          {result.auth_code ? (
            <CopyField label="EPP / auth code" value={result.auth_code} />
          ) : (
            <Callout tone="info">
              The registrar didn&apos;t return an auth code — it may be emailed to
              your registrant contact instead.
            </Callout>
          )}
          <p className="text-xs text-grey-50">
            Lock status: {result.locked ? "locked" : "unlocked"}
          </p>
        </div>
      )}
      <Status error={error} />
    </div>
  )
}
