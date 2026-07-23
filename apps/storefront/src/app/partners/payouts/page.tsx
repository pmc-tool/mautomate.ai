"use client"

import React, { useEffect, useState } from "react"
import { Buildings, CurrencyDollar } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { SectionCard } from "@components/merchant-admin/section-card"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { usePartnerAuth } from "@lib/partner/auth"
import {
  listPartnerPayouts,
  PartnerApiError,
  PartnerPayout,
  requestPartnerPayout,
  updatePartnerProfile,
  usd,
} from "@lib/partner/api"

type MethodType = "bank" | "paypal" | "other"

type MethodDetails = {
  type: MethodType
  holder?: string
  bank_name?: string
  branch?: string
  account_number?: string
  routing?: string
  paypal_email?: string
  notes?: string
}

/**
 * partner.payout_method stores these details as JSON so the form can be
 * re-edited; legacy free-text values load as type "other". Each payout REQUEST
 * snapshots the human-readable rendering (formatMethod) so the operator sees
 * clean transfer instructions without any parsing on their side.
 */
function parseMethod(raw: string | null | undefined): MethodDetails {
  if (!raw) return { type: "bank" }
  try {
    const d = JSON.parse(raw)
    if (d && typeof d === "object" && d.type) return d as MethodDetails
  } catch {
    // Legacy free-text payout details.
  }
  return { type: "other", notes: raw }
}

function formatMethod(d: MethodDetails): string {
  if (d.type === "bank") {
    const parts = [
      "Bank transfer",
      d.holder && `Account holder: ${d.holder}`,
      d.bank_name && `Bank: ${d.bank_name}`,
      d.branch && `Branch: ${d.branch}`,
      d.account_number && `Account number: ${d.account_number}`,
      d.routing && `Routing/SWIFT: ${d.routing}`,
    ]
    return parts.filter(Boolean).join(" | ")
  }
  if (d.type === "paypal") {
    return d.paypal_email ? `PayPal | ${d.paypal_email}` : ""
  }
  return (d.notes || "").trim()
}

function methodComplete(d: MethodDetails): boolean {
  if (d.type === "bank") {
    return !!(d.holder?.trim() && d.bank_name?.trim() && d.account_number?.trim())
  }
  if (d.type === "paypal") {
    return !!d.paypal_email?.trim()
  }
  return !!d.notes?.trim()
}

export default function PartnerPayoutsPage() {
  const { token, me, logout, refreshMe } = usePartnerAuth()
  const [payouts, setPayouts] = useState<PartnerPayout[]>([])
  const [requestableCents, setRequestableCents] = useState(0)
  const [minCents, setMinCents] = useState(1000)
  const [method, setMethod] = useState<MethodDetails>({ type: "bank" })
  const [methodLoaded, setMethodLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    if (!token) return
    try {
      const res = await listPartnerPayouts(token)
      setPayouts(res.payouts || [])
      setRequestableCents(res.requestable_cents || 0)
      setMinCents(res.min_cents || 1000)
    } catch (err) {
      if (err instanceof PartnerApiError && err.status === 401) logout()
      else setError(err instanceof Error ? err.message : "Failed to load payouts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!methodLoaded && me?.partner) {
      setMethod(parseMethod(me.partner.payout_method))
      setMethodLoaded(true)
    }
  }, [me, methodLoaded])

  const setField = (key: keyof MethodDetails, value: string) =>
    setMethod((prev) => ({ ...prev, [key]: value }))

  const saveMethod = async () => {
    if (!token) return
    if (!methodComplete(method)) {
      setError(
        method.type === "bank"
          ? "Fill in the account holder, bank name and account number."
          : method.type === "paypal"
          ? "Enter your PayPal email."
          : "Enter your payout details."
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updatePartnerProfile(token, {
        payout_method: JSON.stringify(method),
      })
      await refreshMe().catch(() => undefined)
      setNotice("Payout method saved.")
      setTimeout(() => setNotice(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payout method")
    } finally {
      setSaving(false)
    }
  }

  const requestPayout = async () => {
    if (!token) return
    if (!methodComplete(method)) {
      setError("Complete your payout method below before requesting a payout.")
      return
    }
    setRequesting(true)
    setError(null)
    try {
      // Persist the structured details, then request with the readable snapshot.
      await updatePartnerProfile(token, {
        payout_method: JSON.stringify(method),
      }).catch(() => undefined)
      await requestPartnerPayout(token, formatMethod(method))
      setNotice("Payout requested — we will process the transfer shortly.")
      await Promise.all([load(), refreshMe().catch(() => undefined)])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request payout")
    } finally {
      setRequesting(false)
    }
  }

  const columns = [
    {
      key: "created_at",
      header: "Requested",
      sortable: true,
      render: (p: PartnerPayout) => (
        <span className="text-grey-60">
          {new Date(p.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "amount_cents",
      header: "Amount",
      render: (p: PartnerPayout) => (
        <span className="font-medium text-grey-90">{usd(p.amount_cents)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p: PartnerPayout) => (
        <StatusBadge status={p.status === "requested" ? "processing" : p.status} />
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (p: PartnerPayout) => (
        <span className="block max-w-xs truncate text-grey-60" title={p.method || ""}>
          {(p.method || "—").split(" | ")[0]}
        </span>
      ),
    },
    {
      key: "paid_at",
      header: "Paid",
      render: (p: PartnerPayout) => (
        <span className="text-grey-60">
          {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="Request payouts of your commission balance and track their status."
        action={
          <button
            onClick={requestPayout}
            disabled={requesting || requestableCents < minCents}
            title={
              requestableCents < minCents
                ? `Minimum payout is ${usd(minCents)}`
                : undefined
            }
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requesting ? "Requesting..." : `Request payout (${usd(requestableCents)})`}
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rounded-base border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Available to request"
          value={usd(requestableCents)}
          icon={CurrencyDollar}
          tone="brand"
          trend={`Minimum payout ${usd(minCents)}`}
        />
        <KpiCard
          label="Paid out to date"
          value={me?.stats ? usd(me.stats.paid_cents) : "—"}
          icon={CurrencyDollar}
          tone="green"
        />
      </div>

      <SectionCard
        title="Payout method"
        description="Where we send your money. Bank transfers are processed manually within a few business days."
        icon={Buildings}
      >
        <div className="space-y-4">
          <div className="max-w-xs">
            <FormField label="Method" htmlFor="payout-type">
              <Select
                id="payout-type"
                value={method.type}
                onChange={(e) =>
                  setMethod((prev) => ({
                    ...prev,
                    type: e.target.value as MethodType,
                  }))
                }
              >
                <option value="bank">Bank transfer</option>
                <option value="paypal">PayPal</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
          </div>

          {method.type === "bank" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Account holder name" htmlFor="bank-holder">
                <Input
                  id="bank-holder"
                  value={method.holder || ""}
                  onChange={(e) => setField("holder", e.target.value)}
                  placeholder="Name on the account"
                />
              </FormField>
              <FormField label="Bank name" htmlFor="bank-name">
                <Input
                  id="bank-name"
                  value={method.bank_name || ""}
                  onChange={(e) => setField("bank_name", e.target.value)}
                  placeholder="e.g. BRAC Bank"
                />
              </FormField>
              <FormField label="Branch" htmlFor="bank-branch" hint="Optional">
                <Input
                  id="bank-branch"
                  value={method.branch || ""}
                  onChange={(e) => setField("branch", e.target.value)}
                  placeholder="Branch name"
                />
              </FormField>
              <FormField label="Account number" htmlFor="bank-account">
                <Input
                  id="bank-account"
                  value={method.account_number || ""}
                  onChange={(e) => setField("account_number", e.target.value)}
                  placeholder="Account number / IBAN"
                />
              </FormField>
              <FormField
                label="Routing / SWIFT code"
                htmlFor="bank-routing"
                hint="Optional — for international or interbank transfers"
              >
                <Input
                  id="bank-routing"
                  value={method.routing || ""}
                  onChange={(e) => setField("routing", e.target.value)}
                  placeholder="Routing or SWIFT/BIC"
                />
              </FormField>
            </div>
          )}

          {method.type === "paypal" && (
            <div className="max-w-md">
              <FormField label="PayPal email" htmlFor="paypal-email">
                <Input
                  id="paypal-email"
                  type="email"
                  value={method.paypal_email || ""}
                  onChange={(e) => setField("paypal_email", e.target.value)}
                  placeholder="you@example.com"
                />
              </FormField>
            </div>
          )}

          {method.type === "other" && (
            <div className="max-w-xl">
              <FormField
                label="Payout details"
                htmlFor="other-notes"
                hint="Describe how we should pay you."
              >
                <Input
                  id="other-notes"
                  value={method.notes || ""}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="e.g. Wise account details"
                />
              </FormField>
            </div>
          )}

          <div>
            <button
              onClick={saveMethod}
              disabled={saving}
              className="rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save payout method"}
            </button>
          </div>
        </div>
      </SectionCard>

      <DataTable<PartnerPayout>
        columns={columns}
        rows={payouts}
        sortKeys={[{ key: "created_at", label: "Requested" }]}
        emptyIcon={CurrencyDollar}
        emptyTitle="No payouts yet"
        emptyDescription="Once your open balance reaches the minimum, request a payout here."
        isLoading={loading}
        pageSize={20}
      />
    </div>
  )
}
