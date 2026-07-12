"use client"

import React, { useEffect, useMemo, useState } from "react"
import { BuildingStorefront, Check, Plus, Trash, CurrencyDollar, ExclamationCircle } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu, ActionMenuItem } from "@components/merchant-admin/action-menu"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getStoreSettings,
  updateStoreSettings,
  listCurrencies,
  listStoreCurrencies,
  updateTenantCurrencies,
  StoreSettings,
  Currency,
  ApiError,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

const locales = [
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "de-DE", name: "German" },
  { code: "fr-FR", name: "French" },
]

export default function StoreSettingsPage() {
  const { token, logout } = useMerchantAuth()

  const [store, setStore] = useState<StoreSettings | null>(null)
  const [catalog, setCatalog] = useState<Currency[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [defaultCode, setDefaultCode] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [name, setName] = useState("")
  const [defaultCurrency, setDefaultCurrency] = useState("")
  const [defaultLocale, setDefaultLocale] = useState("")

  const [addOpen, setAddOpen] = useState(false)
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set())

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  function applyCurrencies(currencies: string[], defCode: string) {
    const codes = currencies.map((c) => c.toLowerCase())
    const def = (defCode || codes[0] || "").toLowerCase()
    setEnabled(codes)
    setDefaultCode(def)
    setDefaultCurrency(def)
  }

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [storeRes, tenantCurrencies, curRes] = await Promise.all([
        getStoreSettings(token),
        listStoreCurrencies(token),
        listCurrencies(token),
      ])
      setStore(storeRes.store)
      setName(storeRes.store.name)
      setDefaultLocale(storeRes.store.default_locale)
      setCatalog(curRes.currencies)
      applyCurrencies(tenantCurrencies.currencies, tenantCurrencies.default_currency)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load store settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function currencyMeta(code: string): { name: string; symbol: string } {
    const found = catalog.find((c) => c.code.toLowerCase() === code.toLowerCase())
    if (found) return { name: found.name, symbol: found.symbol }
    return { name: code.toUpperCase(), symbol: code.toUpperCase() }
  }

  const enabledSet = useMemo(() => new Set(enabled), [enabled])
  const addableCurrencies = useMemo(
    () => catalog.filter((c) => !enabledSet.has(c.code.toLowerCase())),
    [catalog, enabledSet]
  )

  // ---- General card ----
  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !store || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateStoreSettings(token, {
        name: name.trim(),
        default_currency_code: defaultCurrency,
        default_locale: defaultLocale,
      })
      await load()
      showMessage("success", "Store successfully updated")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to save store settings")
    } finally {
      setSaving(false)
    }
  }

  // ---- Currencies card ----
  async function persistCurrencies(key: string, currencies: string[], def: string, okMsg: string) {
    if (!token) return
    setBusy(key)
    try {
      const res = await updateTenantCurrencies(token, {
        currencies,
        default_currency: def,
      })
      applyCurrencies(res.currencies, res.default_currency)
      // Keep the General card's persisted store snapshot in sync.
      const storeRes = await getStoreSettings(token)
      setStore(storeRes.store)
      showMessage("success", okMsg)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to update currencies")
      return false
    } finally {
      setBusy(null)
    }
  }

  function openAdd() {
    setAddSelection(new Set())
    setAddOpen(true)
  }

  function toggleAdd(code: string) {
    setAddSelection((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  async function handleAddCurrencies() {
    if (addSelection.size === 0) return
    const next = Array.from(new Set([...enabled, ...Array.from(addSelection).map((c) => c.toLowerCase())]))
    const ok = await persistCurrencies("add", next, defaultCode, "Currencies updated successfully")
    if (ok) setAddOpen(false)
  }

  async function handleMakeDefault(code: string) {
    if (code === defaultCode) return
    await persistCurrencies(`default-${code}`, enabled, code, "Default currency updated")
  }

  async function handleRemove(code: string) {
    if (code === defaultCode || enabled.length <= 1) return
    const meta = currencyMeta(code)
    const confirmed = window.confirm(
      `Are you sure?\n\nYou are about to remove ${meta.name} (${code.toUpperCase()}) from your store. Ensure that you have removed all prices using the currency before proceeding.`
    )
    if (!confirmed) return
    const next = enabled.filter((c) => c !== code)
    await persistCurrencies(`remove-${code}`, next, defaultCode, "Removed currencies from the store successfully")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Store" description="Manage your store's details" />
        <div className="h-48 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Store" description="Manage your store's details" />

      {error && (
        <div className="flex items-center gap-2 rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ExclamationCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "border border-green-200 bg-green-50 text-green-800",
            message.type === "error" && "border border-red-200 bg-red-50 text-red-700"
          )}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <ExclamationCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSaveGeneral}>
        <SectionCard title="General" description="Basic store information." icon={BuildingStorefront}>
          <div className="space-y-4">
            <FormField
              label="Store name"
              htmlFor="store-name"
              hint="Shown from your account. Editing here is not persisted yet."
            >
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ACME"
                required
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Default currency" htmlFor="default-currency">
                <Select
                  id="default-currency"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                >
                  {enabled.map((code) => {
                    const meta = currencyMeta(code)
                    return (
                      <option key={code} value={code}>
                        {code.toUpperCase()} · {meta.name}
                      </option>
                    )
                  })}
                </Select>
              </FormField>
              <FormField
                label="Default locale"
                htmlFor="default-locale"
                hint="Display preference; not persisted yet."
              >
                <Select
                  id="default-locale"
                  value={defaultLocale}
                  onChange={(e) => setDefaultLocale(e.target.value)}
                >
                  {locales.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (store) {
                    setName(store.name)
                    setDefaultLocale(store.default_locale)
                    setDefaultCurrency(defaultCode)
                  }
                }}
                className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </SectionCard>
      </form>

      <SectionCard
        title="Currencies"
        description="The currencies your store supports."
        icon={CurrencyDollar}
        action={
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        }
      >
        {enabled.length === 0 ? (
          <div className="rounded-base border border-dashed border-grey-20 p-8 text-center">
            <CurrencyDollar className="mx-auto h-6 w-6 text-grey-40" />
            <p className="mt-2 text-sm font-medium text-grey-80">No currencies</p>
            <p className="mt-0.5 text-sm text-grey-50">Add a currency to start selling in it.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-base border border-grey-20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-10 bg-grey-10 text-left text-xs font-medium uppercase tracking-wide text-grey-50">
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5" />
                  <th className="w-16 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {enabled.map((code) => {
                  const meta = currencyMeta(code)
                  const isDefault = code === defaultCode
                  const items: ActionMenuItem[] = []
                  if (!isDefault) {
                    items.push({ label: "Make default", icon: Check, onClick: () => handleMakeDefault(code) })
                    if (enabled.length > 1) {
                      items.push({
                        label: "Remove",
                        icon: Trash,
                        destructive: true,
                        onClick: () => handleRemove(code),
                      })
                    }
                  }
                  const rowBusy = busy === `default-${code}` || busy === `remove-${code}`
                  return (
                    <tr key={code} className="text-grey-90">
                      <td className="px-4 py-3 font-medium uppercase">{code}</td>
                      <td className="px-4 py-3 text-grey-70">{meta.name}</td>
                      <td className="px-4 py-3">
                        {isDefault && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rowBusy ? (
                          <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
                        ) : items.length > 0 ? (
                          <div className="flex justify-end">
                            <ActionMenu items={items} />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add currencies"
        description="Select the currencies you want to add to your store."
        size="sm"
      >
        <div className="space-y-4">
          {addableCurrencies.length === 0 ? (
            <p className="rounded-base border border-grey-20 bg-grey-10 px-4 py-6 text-center text-sm text-grey-50">
              All available currencies are already added to your store.
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
              {addableCurrencies.map((c) => {
                const code = c.code.toLowerCase()
                return (
                  <label
                    key={code}
                    className="flex cursor-pointer items-center gap-3 rounded-base px-2 py-2 text-sm hover:bg-grey-10"
                  >
                    <input
                      type="checkbox"
                      checked={addSelection.has(code)}
                      onChange={() => toggleAdd(code)}
                    />
                    <span className="w-10 font-medium uppercase text-grey-90">{code}</span>
                    <span className="text-grey-70">{c.name}</span>
                  </label>
                )
              })}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddCurrencies}
              disabled={busy === "add" || addSelection.size === 0}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "add" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
