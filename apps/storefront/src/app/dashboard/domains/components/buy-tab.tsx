"use client"

import React, { useState } from "react"
import {
  MagnifyingGlass,
  Spinner,
  ShoppingBag,
  CheckCircleSolid,
  StarSolid,
} from "@medusajs/icons"
import { Modal } from "@components/merchant-admin/modal"
import { Select } from "@components/merchant-admin/form-field"
import {
  searchDomainsForPurchase,
  buyDomainForStore,
  DomainSearchResult,
  DomainContact,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"
import { RegistrantProfileForm } from "./registrant-profile-form"
import {
  Callout,
  HowItWorks,
  formatPrice,
  btnPrimary,
  btnSecondary,
} from "./ui"

const DEFAULT_TLDS = ["com", "net", "org", "io", "co", "shop", "store", "xyz"]

export function BuyTab({
  token,
  hasProfile,
  onProfileCreated,
  onPurchased,
}: {
  token: string
  hasProfile: boolean
  onProfileCreated: (contact: DomainContact) => void
  onPurchased: () => void
}) {
  const [query, setQuery] = useState("")
  const [tlds, setTlds] = useState<string[]>(["com", "net", "org", "io", "shop"])
  const [years, setYears] = useState(1)
  const [results, setResults] = useState<DomainSearchResult[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // purchase modal
  const [target, setTarget] = useState<DomainSearchResult | null>(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ domain: string; manual: boolean } | null>(null)

  const toggleTld = (tld: string) =>
    setTlds((prev) => (prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld]))

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults(null)
    setNote(null)
    try {
      const res = await searchDomainsForPurchase(token, query.trim(), tlds)
      setResults(res.results ?? [])
      setConfigured(res.configured)
      if (res.note) setNote(res.note)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  const openBuy = (result: DomainSearchResult) => {
    setTarget(result)
    setBuyError(null)
    setSuccess(null)
  }

  const closeBuy = () => {
    if (buying) return
    setTarget(null)
    setSuccess(null)
    setBuyError(null)
  }

  const confirmBuy = async () => {
    if (!target) return
    setBuying(true)
    setBuyError(null)
    try {
      const res = await buyDomainForStore(token, { domain_name: target.domain, years })
      setSuccess({ domain: target.domain, manual: !!res.manual_approval })
      onPurchased()
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Purchase failed")
    } finally {
      setBuying(false)
    }
  }

  const price = target?.price
  const total = price?.register != null ? price.register * years : null

  return (
    <div className="space-y-6">
      <HowItWorks
        steps={[
          "Search for the name you want and pick from the available results.",
          "Choose how many years to register, then confirm the price.",
          "We register it and point it at your store automatically.",
        ]}
      />

      {configured === false && (
        <Callout tone="warning" title="Live registration is not active yet">
          Our registrar connection isn&apos;t switched on for your store yet, so
          prices shown are estimates and your purchase goes to our team as a
          request for approval. You&apos;ll only be charged store credits once,
          and we&apos;ll complete the registration for you.
        </Callout>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toLowerCase())}
              placeholder="mystore"
              className="w-full rounded-base border border-grey-30 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none focus:ring-1 focus:ring-grey-90"
            />
          </div>
          <button type="submit" disabled={loading || !query.trim()} className={btnPrimary}>
            {loading ? <Spinner className="h-4 w-4 animate-spin" /> : <MagnifyingGlass className="h-4 w-4" />}
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {DEFAULT_TLDS.map((tld) => {
            const active = tlds.includes(tld)
            return (
              <button
                key={tld}
                type="button"
                onClick={() => toggleTld(tld)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-grey-90 bg-grey-90 text-white"
                    : "border-grey-30 bg-white text-grey-60 hover:border-grey-50"
                )}
              >
                .{tld}
              </button>
            )
          })}
        </div>
      </form>

      {error && <Callout tone="warning">{error}</Callout>}
      {note && configured !== false && <Callout tone="info">{note}</Callout>}

      {/* Results */}
      {results && results.length === 0 && !loading && (
        <p className="text-sm text-grey-50">No results — try a different name.</p>
      )}

      {results && results.length > 0 && (
        <div className="overflow-hidden rounded-large border border-grey-20">
          <table className="min-w-full text-sm">
            <thead className="bg-grey-10 text-grey-60">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Price / year</th>
                <th className="px-4 py-2.5 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {results.map((r) => (
                <tr key={r.domain}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-grey-90">{r.domain}</span>
                    {r.isPremium && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        <StarSolid className="h-3 w-3" />
                        Premium
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.available ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircleSolid className="h-4 w-4" />
                        Available
                      </span>
                    ) : (
                      <span className="text-grey-50">Taken</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-grey-70">
                    {r.available ? (
                      <span>
                        {formatPrice(r.price?.register, r.price?.currency)}
                        {r.price?.renew != null && (
                          <span className="ml-1 text-xs text-grey-50">
                            (renews {formatPrice(r.price.renew, r.price.currency)})
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.available && (
                      <button onClick={() => openBuy(r)} className={btnPrimary}>
                        <ShoppingBag className="h-4 w-4" />
                        Buy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Buy modal */}
      <Modal
        open={!!target}
        onClose={closeBuy}
        title={success ? "Request received" : hasProfile ? "Confirm registration" : "Add your registrant profile"}
        description={target?.domain}
        size={!hasProfile && !success ? "lg" : "md"}
      >
        {success ? (
          <div className="space-y-4">
            <Callout
              tone={success.manual ? "info" : "success"}
              title={
                success.manual
                  ? "Submitted for approval"
                  : `${success.domain} is being registered`
              }
            >
              {success.manual ? (
                <>
                  Your request for <span className="font-medium">{success.domain}</span> has
                  been sent to our team. Store credits for the purchase have been
                  reserved and we&apos;ll complete the registration shortly. You&apos;ll
                  see it appear under &ldquo;Your domains&rdquo; once it&apos;s live.
                </>
              ) : (
                <>
                  We&apos;ve registered <span className="font-medium">{success.domain}</span> and
                  pointed it at your store. It will appear under &ldquo;Your
                  domains&rdquo; below.
                </>
              )}
            </Callout>
            <div className="flex justify-end">
              <button onClick={closeBuy} className={btnPrimary}>
                Done
              </button>
            </div>
          </div>
        ) : !hasProfile ? (
          <RegistrantProfileForm
            token={token}
            onCreated={(c) => onProfileCreated(c)}
            onCancel={closeBuy}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-sm text-grey-60">Register for</span>
              <Select
                value={String(years)}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-28"
              >
                {[1, 2, 3, 5, 10].map((y) => (
                  <option key={y} value={y}>
                    {y} year{y > 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-grey-60">
                  {target?.domain} · {years} year{years > 1 ? "s" : ""}
                </span>
                <span className="text-lg font-semibold text-grey-90">
                  {total != null ? formatPrice(total, price?.currency) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-grey-50">
                Charged from your store credit balance.{" "}
                {configured === false && "Price is an estimate until registration is confirmed."}
              </p>
            </div>

            {configured === false && (
              <Callout tone="warning">
                This will be submitted to our team for approval — not registered
                instantly.
              </Callout>
            )}

            {buyError && <Callout tone="warning">{buyError}</Callout>}

            <div className="flex items-center justify-end gap-2">
              <button onClick={closeBuy} disabled={buying} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={confirmBuy} disabled={buying} className={btnPrimary}>
                {buying && <Spinner className="h-4 w-4 animate-spin" />}
                {buying
                  ? "Submitting..."
                  : configured === false
                  ? "Submit request"
                  : "Confirm & register"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
