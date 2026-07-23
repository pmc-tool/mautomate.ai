"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeftMini,
  MagnifyingGlass,
  Phone,
  Plus,
  Spinner,
  Trash,
} from "@medusajs/icons"
import { useRouter } from "next/navigation"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AvailablePhoneNumber,
  CallAgent,
  CallPhoneNumber,
  buyCallPhoneNumber,
  deleteCallPhoneNumber,
  listCallAgents,
  listCallPhoneNumbers,
  registerCallPhoneNumber,
  searchAvailablePhoneNumbers,
  updateCallPhoneNumber,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { cn } from "@lib/util/cn"

/**
 * Phone numbers — buy a number from a carrier (Twilio / Vonage), or register
 * one you already own, and attach it to an AI agent. The attached agent
 * answers every call to that number.
 */

const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
]

const NUMBER_TYPES = [
  { value: "local", label: "Local" },
  { value: "tollfree", label: "Toll-free" },
  { value: "mobile", label: "Mobile" },
]

const inputCls =
  "rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none focus:ring-1 focus:ring-grey-90"
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"

export default function PhoneNumbersPage() {
  const router = useRouter()
  const { token } = useMerchantAuth()

  const [numbers, setNumbers] = useState<CallPhoneNumber[]>([])
  const [providers, setProviders] = useState<Record<string, boolean>>({})
  const [monthlyCredits, setMonthlyCredits] = useState<number>(300)
  const [agents, setAgents] = useState<CallAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Buy flow state
  const [showBuy, setShowBuy] = useState(false)
  const [provider, setProvider] = useState<"twilio" | "vonage">("twilio")
  const [country, setCountry] = useState("US")
  const [numType, setNumType] = useState("local")
  const [contains, setContains] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<AvailablePhoneNumber[] | null>(null)
  const [buyingE164, setBuyingE164] = useState<string | null>(null)
  const [buyAgentId, setBuyAgentId] = useState("")

  // Register-your-own flow state
  const [showRegister, setShowRegister] = useState(false)
  const [regE164, setRegE164] = useState("")
  const [regProvider, setRegProvider] = useState<"twilio" | "vonage">("twilio")
  const [regAgentId, setRegAgentId] = useState("")
  const [registering, setRegistering] = useState(false)

  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const res = await listCallPhoneNumbers(token)
      setNumbers(res.phone_numbers ?? [])
      setProviders(res.providers ?? {})
      if (res.monthly_credits) setMonthlyCredits(res.monthly_credits)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load numbers")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    refresh()
    listCallAgents(token)
      .then((r) => setAgents(r.agents ?? []))
      .catch(() => {})
  }, [token, refresh])

  const anyProviderReady = Object.values(providers).some(Boolean)

  const handleSearch = async () => {
    if (!token) return
    setSearching(true)
    setError(null)
    setResults(null)
    try {
      const res = await searchAvailablePhoneNumbers(token, {
        provider,
        country,
        type: numType,
        contains: contains || undefined,
      })
      setResults(res.numbers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const handleBuy = async (n: AvailablePhoneNumber) => {
    if (!token) return
    if (
      !confirm(
        `Buy ${n.e164}? This costs ${monthlyCredits} credits per month, billed from your credit balance starting now.`
      )
    ) {
      return
    }
    setBuyingE164(n.e164)
    setError(null)
    try {
      const res = await buyCallPhoneNumber(token, {
        provider,
        e164: n.e164,
        country: n.country || country,
        agent_id: buyAgentId || undefined,
      })
      setNotice(res.message || `You now own ${n.e164}.`)
      setShowBuy(false)
      setResults(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed")
    } finally {
      setBuyingE164(null)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !regE164.trim()) return
    setRegistering(true)
    setError(null)
    try {
      await registerCallPhoneNumber(token, {
        e164: regE164.trim(),
        provider: regProvider,
        agent_id: regAgentId || undefined,
      })
      setNotice(`${regE164.trim()} registered.`)
      setShowRegister(false)
      setRegE164("")
      await refresh()
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not register the number")
    } finally {
      setRegistering(false)
    }
  }

  const handleAttach = async (row: CallPhoneNumber, agentId: string) => {
    if (!token) return
    setBusyId(row.id)
    setError(null)
    try {
      await updateCallPhoneNumber(token, row.id, { agent_id: agentId })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the number")
    } finally {
      setBusyId(null)
    }
  }

  const handleRelease = async (row: CallPhoneNumber) => {
    if (!token) return
    const bought = !!row.provider_number_id
    if (
      !confirm(
        bought
          ? `Release ${row.e164}? It is returned to the carrier, monthly billing stops, and you may not be able to get this exact number back.`
          : `Remove ${row.e164}? Calls to it will stop being answered by your agent.`
      )
    ) {
      return
    }
    setBusyId(row.id)
    setError(null)
    try {
      await deleteCallPhoneNumber(token, row.id)
      setNotice(`${row.e164} ${bought ? "released" : "removed"}.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not release the number")
    } finally {
      setBusyId(null)
    }
  }

  const agentName = (id: string | null) =>
    agents.find((a) => a.id === id)?.name ?? null

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/calls")}
        className="inline-flex items-center gap-1 text-sm text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" /> Call center
      </button>

      <PageHeader
        title="Phone numbers"
        description={`Buy a number and attach it to an AI agent — the agent answers every call. Numbers cost ${monthlyCredits} credits/month.`}
        action={
          <div className="flex gap-2">
            <button
              className={btnSecondary}
              onClick={() => {
                setShowRegister(!showRegister)
                setShowBuy(false)
              }}
            >
              <Plus className="h-4 w-4" /> Add your own
            </button>
            <button
              className={btnPrimary}
              onClick={() => {
                setShowBuy(!showBuy)
                setShowRegister(false)
              }}
            >
              <Phone className="h-4 w-4" /> Get a number
            </button>
          </div>
        }
      />

      {notice && (
        <div className="rounded-base border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {showBuy && (
        <div className="space-y-5 rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
          <div>
            <h3 className="text-sm font-semibold text-grey-90">Get a new number</h3>
            <p className="mt-0.5 text-xs text-grey-50">
              Pick your filters, search the carrier inventory, then buy in one click.
            </p>
          </div>

          {!anyProviderReady ? (
            <p className="text-sm text-grey-50">
              Number purchasing isn&apos;t enabled yet — our team is connecting
              the carriers. You can still add a number you already own with
              &quot;Add your own&quot;.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                <StepLabel step={1} label="Choose filters" />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
                    Carrier
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                      className={inputCls}
                    >
                      {providers.twilio && <option value="twilio">Twilio</option>}
                      {providers.vonage && <option value="vonage">Vonage</option>}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
                    Country
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={inputCls}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
                    Type
                    <select
                      value={numType}
                      onChange={(e) => setNumType(e.target.value)}
                      className={inputCls}
                    >
                      {NUMBER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
                    Digits (optional)
                    <input
                      value={contains}
                      onChange={(e) => setContains(e.target.value)}
                      placeholder="e.g. 777"
                      className={inputCls + " w-28"}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
                    Answered by
                    <select
                      value={buyAgentId}
                      onChange={(e) => setBuyAgentId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Choose later</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={btnPrimary} onClick={handleSearch} disabled={searching}>
                    {searching ? (
                      <Spinner className="h-4 w-4 animate-spin" />
                    ) : (
                      <MagnifyingGlass className="h-4 w-4" />
                    )}
                    Search
                  </button>
                </div>
              </div>

              {results !== null && (
                <div className="space-y-3">
                  <StepLabel step={2} label="Pick your number" />
                  <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
                    {results.length === 0 ? (
                      <EmptyState
                        icon={MagnifyingGlass}
                        title="No numbers matched"
                        description="Try another type, country, or digit filter."
                        className="border-0 shadow-none"
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-grey-10 text-xs font-medium text-grey-50">
                            <tr>
                              <th className="px-4 py-3 font-medium">Number</th>
                              <th className="px-4 py-3 font-medium">Location</th>
                              <th className="px-4 py-3 font-medium">Capabilities</th>
                              <th className="px-4 py-3 text-right font-medium">Price</th>
                              <th className="px-4 py-3 text-right font-medium"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-grey-10">
                            {results.map((n) => (
                              <tr key={n.e164} className="transition-colors hover:bg-grey-5">
                                <td className="px-4 py-3 font-mono text-[13px] font-medium text-grey-90">
                                  {n.e164}
                                </td>
                                <td className="px-4 py-3 text-grey-60">
                                  {[n.locality, n.region].filter(Boolean).join(", ") ||
                                    n.country}
                                </td>
                                <td className="px-4 py-3 text-grey-60">
                                  {[n.capabilities.voice && "Voice", n.capabilities.sms && "SMS"]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="inline-flex items-center rounded-full bg-grey-10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-grey-70">
                                    {n.monthly_credits} credits/mo
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    className={btnPrimary + " px-4 py-1.5"}
                                    disabled={buyingE164 !== null}
                                    onClick={() => handleBuy(n)}
                                  >
                                    {buyingE164 === n.e164 ? (
                                      <Spinner className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Buy"
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showRegister && (
        <form
          onSubmit={handleRegister}
          className="space-y-4 rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
        >
          <div>
            <h3 className="text-sm font-semibold text-grey-90">
              Add a number you already own
            </h3>
            <p className="mt-0.5 text-sm text-grey-50">
              For numbers bought in your own Twilio or Vonage account. Point the
              number&apos;s voice webhook at us (support can help), then add the
              number here so your agent answers it.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
              Number (E.164)
              <input
                value={regE164}
                onChange={(e) => setRegE164(e.target.value)}
                placeholder="+61480123456"
                className={inputCls + " w-44"}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
              Carrier
              <select
                value={regProvider}
                onChange={(e) => setRegProvider(e.target.value as any)}
                className={inputCls}
              >
                <option value="twilio">Twilio</option>
                <option value="vonage">Vonage</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-grey-50">
              Answered by
              <select
                value={regAgentId}
                onChange={(e) => setRegAgentId(e.target.value)}
                className={inputCls}
              >
                <option value="">Choose later</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={btnPrimary}
              disabled={registering || !regE164.trim()}
            >
              {registering ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add number
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <NumbersTableSkeleton />
      ) : numbers.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No phone numbers yet"
          description="Buy a number (or add one you own) and attach it to an agent — callers will talk to your AI agent."
          action={
            <button
              className={btnPrimary}
              onClick={() => {
                setShowBuy(true)
                setShowRegister(false)
              }}
            >
              <Phone className="h-4 w-4" /> Get a number
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-grey-10 text-xs font-medium text-grey-50">
                <tr>
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Carrier</th>
                  <th className="px-4 py-3 font-medium">Answered by</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {numbers.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-grey-5">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] font-medium text-grey-90">
                        {row.e164}
                      </span>
                      {row.label && (
                        <span className="ml-2 text-xs text-grey-40">{row.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CarrierBadge provider={row.provider} />
                      {!row.provider_number_id && (
                        <span className="ml-1.5 rounded-full bg-grey-10 px-2 py-0.5 text-[11px] text-grey-50">
                          your account
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.agent_id ?? ""}
                        disabled={busyId === row.id}
                        onChange={(e) => handleAttach(row, e.target.value)}
                        className={inputCls + " py-1.5"}
                      >
                        <option value="">No agent (calls rejected)</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      {row.agent_id && !agentName(row.agent_id) && (
                        <p className="mt-1 text-xs text-amber-600">
                          Attached agent no longer exists.
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <NumberStatusPill active={row.active} hasAgent={!!row.agent_id} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className={btnSecondary + " px-3 py-1.5 text-rose-600 hover:bg-rose-50"}
                        disabled={busyId === row.id}
                        onClick={() => handleRelease(row)}
                      >
                        {busyId === row.id ? (
                          <Spinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash className="h-4 w-4" />
                        )}
                        {row.provider_number_id ? "Release" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-grey-90 text-[11px] font-semibold text-white">
        {step}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-grey-50">
        {label}
      </span>
    </div>
  )
}

function CarrierBadge({ provider }: { provider?: string | null }) {
  const label = provider === "vonage" ? "Vonage" : "Twilio"
  return (
    <span className="inline-flex items-center rounded-base border border-grey-20 bg-grey-5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-grey-60">
      {label}
    </span>
  )
}

function NumberStatusPill({
  active,
  hasAgent,
}: {
  active?: boolean
  hasAgent: boolean
}) {
  const label = !active ? "Inactive" : hasAgent ? "Answering" : "No agent"
  const cls = !active
    ? "bg-grey-10 text-grey-60"
    : hasAgent
    ? "bg-emerald-50 text-emerald-700"
    : "bg-amber-50 text-amber-700"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cls
      )}
    >
      {label}
    </span>
  )
}

function NumbersTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="bg-grey-10 px-4 py-3">
        <div className="h-3 w-40 animate-pulse rounded-base bg-grey-20" />
      </div>
      <div className="divide-y divide-grey-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-4">
            <div className="h-4 w-36 animate-pulse rounded-base bg-grey-10" />
            <div className="h-4 w-16 animate-pulse rounded-base bg-grey-10" />
            <div className="h-4 w-40 animate-pulse rounded-base bg-grey-10" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded-base bg-grey-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
