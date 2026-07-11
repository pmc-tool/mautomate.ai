"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  MapPin,
  Buildings,
  TruckFast,
  ShoppingBag,
  Plus,
  PencilSquare,
  Trash,
  ExclamationCircle,
  CurrencyDollar,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getStockLocation,
  updateStockLocation,
  deleteStockLocation,
  enableFulfillmentSet,
  deleteFulfillmentSet,
  createServiceZone,
  updateServiceZone,
  deleteServiceZone,
  createShippingOption,
  updateShippingOption,
  deleteShippingOption,
  updateLocationSalesChannels,
  updateLocationFulfillmentProviders,
  listMerchantSalesChannels,
  listMerchantFulfillmentProviders,
  StockLocationDetail,
  LocationFulfillmentSet,
  LocationServiceZone,
  LocationShippingOption,
  MerchantSalesChannel,
  MerchantFulfillmentProvider,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

// A broad ISO-3166-1 alpha-2 list; names rendered via Intl.DisplayNames.
const COUNTRY_CODES =
  "us ca gb au nz ie de fr es it nl be pt ch at se no dk fi pl cz sk hu ro bg gr hr si ee lv lt lu is mt cy in bd pk lk np sg my th vn ph id jp kr cn hk tw ae sa qa kw bh om il tr eg za ng ke gh ma dz tn br mx ar cl co pe uy ec ve bo py cr pa gt do jm tt ru ua by kz ge am az".split(
    " "
  )

function countryName(code?: string | null): string {
  if (!code) return "—"
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function formatAddress(a: StockLocationDetail["address"]): string {
  if (!a) return "No address set"
  return (
    [a.address_1, a.city, a.province, a.postal_code, a.country_code?.toUpperCase()]
      .filter(Boolean)
      .join(", ") || "No address set"
  )
}

function formatProvider(id?: string | null): string {
  if (!id) return "Manual"
  return (
    id.replace(/^mp_/, "").replace(/_/g, " ").replace(/\bmanual manual\b/i, "Manual").trim() || id
  )
}

const SET_META: Record<string, { label: string; help: string; icon: React.ComponentType<{ className?: string }> }> = {
  shipping: { label: "Shipping", help: "Zones and rates you ship orders to.", icon: TruckFast },
  pickup: { label: "Pickup", help: "Let customers collect orders from this location.", icon: ShoppingBag },
}

function Card({
  title,
  action,
  children,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          {typeof title === "string" ? <h3 className="text-base font-semibold text-grey-90">{title}</h3> : title}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

function CountryPicker({
  selected,
  onToggle,
}: {
  selected: Set<string>
  onToggle: (code: string) => void
}) {
  const [q, setQ] = useState("")
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return COUNTRY_CODES.filter((c) => !term || c.includes(term) || countryName(c).toLowerCase().includes(term))
  }, [q])
  return (
    <div className="space-y-2">
      <Input placeholder="Search countries..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
        {list.map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-2 rounded-base px-2 py-1.5 text-sm hover:bg-grey-10">
            <input type="checkbox" checked={selected.has(c)} onChange={() => onToggle(c)} />
            <span className="text-grey-90">{countryName(c)}</span>
            <span className="text-grey-40">{c.toUpperCase()}</span>
          </label>
        ))}
        {list.length === 0 && <p className="px-2 py-2 text-sm text-grey-40">No matches.</p>}
      </div>
      <p className="text-xs text-grey-50">{selected.size} selected</p>
    </div>
  )
}

type LocForm = { name: string; address_1: string; city: string; country_code: string; postal_code: string; province: string }
type ZoneModal = { open: boolean; mode: "create" | "edit"; setId: string; zoneId?: string; name: string; countries: Set<string> }
type OptModal = {
  open: boolean
  mode: "create" | "edit"
  zoneId: string
  optionId?: string
  name: string
  price_type: "flat" | "calculated"
  amount: string
  enabled_in_store: boolean
  is_return: boolean
}

export default function LocationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [loc, setLoc] = useState<StockLocationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<LocForm>({ name: "", address_1: "", city: "", country_code: "", postal_code: "", province: "" })

  const [zoneModal, setZoneModal] = useState<ZoneModal>({ open: false, mode: "create", setId: "", name: "", countries: new Set() })
  const [optModal, setOptModal] = useState<OptModal>({ open: false, mode: "create", zoneId: "", name: "", price_type: "flat", amount: "", enabled_in_store: true, is_return: false })

  const [channelsOpen, setChannelsOpen] = useState(false)
  const [allChannels, setAllChannels] = useState<MerchantSalesChannel[]>([])
  const [channelSel, setChannelSel] = useState<Set<string>>(new Set())

  const [providersOpen, setProvidersOpen] = useState(false)
  const [allProviders, setAllProviders] = useState<MerchantFulfillmentProvider[]>([])
  const [providerSel, setProviderSel] = useState<Set<string>>(new Set())

  function showMessage(type: "success" | "error" | "info", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getStockLocation(token, id)
      setLoc(res.stock_location)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load location")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  async function run(key: string, fn: () => Promise<any>, okMsg: string) {
    if (!token) return
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await load()
      return true
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  // ---- location edit ----
  function openEdit() {
    if (!loc) return
    setForm({
      name: loc.name,
      address_1: loc.address?.address_1 || "",
      city: loc.address?.city || "",
      country_code: loc.address?.country_code || "",
      postal_code: loc.address?.postal_code || "",
      province: loc.address?.province || "",
    })
    setEditOpen(true)
  }
  async function saveLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !loc || !form.name.trim()) return
    const address =
      form.address_1.trim() && form.country_code.trim()
        ? {
            address_1: form.address_1.trim(),
            city: form.city.trim() || undefined,
            country_code: form.country_code.trim().toLowerCase(),
            postal_code: form.postal_code.trim() || undefined,
            province: form.province.trim() || undefined,
          }
        : null
    const ok = await run("save-loc", () => updateStockLocation(token, loc.id, { name: form.name.trim(), address }), "Location updated.")
    if (ok) setEditOpen(false)
  }
  async function handleDeleteLocation() {
    if (!token || !loc) return
    if (!confirm(`Delete location "${loc.name}"? This cannot be undone.`)) return
    setBusy("del-loc")
    try {
      await deleteStockLocation(token, loc.id)
      router.push("/dashboard/settings/locations")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete location")
      setBusy(null)
    }
  }

  // ---- fulfillment sets ----
  async function handleEnableSet(type: "shipping" | "pickup") {
    await run(`enable-${type}`, () => enableFulfillmentSet(token!, id, type), `${SET_META[type].label} enabled.`)
  }
  async function handleDisableSet(set: LocationFulfillmentSet) {
    if (!confirm(`Disable ${set.type} fulfillment? This removes its zones and rates.`)) return
    await run(`disable-${set.id}`, () => deleteFulfillmentSet(token!, set.id), "Fulfillment disabled.")
  }

  // ---- zones ----
  function openZoneCreate(setId: string) {
    setZoneModal({ open: true, mode: "create", setId, name: "", countries: new Set() })
  }
  function openZoneEdit(setId: string, z: LocationServiceZone) {
    setZoneModal({
      open: true,
      mode: "edit",
      setId,
      zoneId: z.id,
      name: z.name,
      countries: new Set(z.geo_zones.filter((g) => g.type === "country" && g.country_code).map((g) => g.country_code!.toLowerCase())),
    })
  }
  async function saveZone() {
    if (!token || !zoneModal.name.trim()) return
    const country_codes = Array.from(zoneModal.countries)
    const ok = await run(
      "save-zone",
      () =>
        zoneModal.mode === "create"
          ? createServiceZone(token, zoneModal.setId, { name: zoneModal.name.trim(), country_codes })
          : updateServiceZone(token, zoneModal.zoneId!, { name: zoneModal.name.trim(), country_codes }),
      zoneModal.mode === "create" ? "Service zone created." : "Service zone updated."
    )
    if (ok) setZoneModal((m) => ({ ...m, open: false }))
  }
  async function handleDeleteZone(z: LocationServiceZone) {
    if (!confirm(`Delete zone "${z.name}"?`)) return
    await run(`del-zone-${z.id}`, () => deleteServiceZone(token!, z.id), "Zone deleted.")
  }

  // ---- shipping options ----
  function openOptionCreate(zoneId: string, isReturn: boolean) {
    setOptModal({ open: true, mode: "create", zoneId, name: "", price_type: "flat", amount: "", enabled_in_store: true, is_return: isReturn })
  }
  function openOptionEdit(o: LocationShippingOption) {
    const usd = o.prices.find((p) => p.currency_code) || o.prices[0]
    setOptModal({
      open: true,
      mode: "edit",
      zoneId: "",
      optionId: o.id,
      name: o.name,
      price_type: (o.price_type as "flat" | "calculated") || "flat",
      amount: usd ? String(usd.amount) : "",
      enabled_in_store: o.enabled_in_store,
      is_return: o.is_return,
    })
  }
  async function saveOption() {
    if (!token || !optModal.name.trim()) return
    const amount = optModal.price_type === "flat" ? Number(optModal.amount || 0) : undefined
    const ok = await run(
      "save-opt",
      () =>
        optModal.mode === "create"
          ? createShippingOption(token, {
              service_zone_id: optModal.zoneId,
              name: optModal.name.trim(),
              price_type: optModal.price_type,
              is_return: optModal.is_return,
              enabled_in_store: optModal.enabled_in_store,
              amount,
            })
          : updateShippingOption(token, optModal.optionId!, {
              name: optModal.name.trim(),
              price_type: optModal.price_type,
              enabled_in_store: optModal.enabled_in_store,
              amount,
            }),
      optModal.mode === "create" ? "Shipping option created." : "Shipping option updated."
    )
    if (ok) setOptModal((m) => ({ ...m, open: false }))
  }
  async function handleDeleteOption(o: LocationShippingOption) {
    if (!confirm(`Delete shipping option "${o.name}"?`)) return
    await run(`del-opt-${o.id}`, () => deleteShippingOption(token!, o.id), "Shipping option deleted.")
  }

  // ---- sales channels ----
  async function openChannels() {
    if (!token || !loc) return
    try {
      const res = await listMerchantSalesChannels(token)
      setAllChannels(res.sales_channels || [])
      setChannelSel(new Set(loc.sales_channels.map((c) => c.id)))
      setChannelsOpen(true)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to load sales channels")
    }
  }
  async function saveChannels() {
    if (!token || !loc) return
    const current = new Set(loc.sales_channels.map((c) => c.id))
    const add = Array.from(channelSel).filter((c) => !current.has(c))
    const remove = Array.from(current).filter((c) => !channelSel.has(c))
    const ok = await run("save-ch", () => updateLocationSalesChannels(token, loc.id, { add, remove }), "Sales channels updated.")
    if (ok) setChannelsOpen(false)
  }

  // ---- providers ----
  async function openProviders() {
    if (!token || !loc) return
    try {
      const res = await listMerchantFulfillmentProviders(token)
      setAllProviders(res.fulfillment_providers || [])
      setProviderSel(new Set(loc.fulfillment_providers.map((p) => p.id)))
      setProvidersOpen(true)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to load providers")
    }
  }
  async function saveProviders() {
    if (!token || !loc) return
    const current = new Set(loc.fulfillment_providers.map((p) => p.id))
    const add = Array.from(providerSel).filter((p) => !current.has(p))
    const remove = Array.from(current).filter((p) => !providerSel.has(p))
    const ok = await run("save-pr", () => updateLocationFulfillmentProviders(token, loc.id, { add, remove }), "Providers updated.")
    if (ok) setProvidersOpen(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Location" description="Loading..." />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }
  if (error || !loc) {
    return (
      <div className="space-y-6">
        <PageHeader title="Location" description="We could not load this location." />
        <EmptyState icon={MapPin} title="Location not found" description={error || "This location does not exist or you do not have access to it."} />
      </div>
    )
  }

  const shippingSet = loc.fulfillment_sets.find((s) => s.type === "shipping") || null
  const pickupSet = loc.fulfillment_sets.find((s) => s.type === "pickup") || null

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/settings/locations")} className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90">
        <ArrowLeftMini className="h-4 w-4" />
        Back to locations
      </button>

      {message && (
        <div className={cn("flex items-center gap-2 rounded-base px-4 py-3 text-sm", message.type === "success" && "bg-emerald-50 text-emerald-800", message.type === "error" && "bg-rose-50 text-rose-800", message.type === "info" && "bg-sky-50 text-sky-800")}>
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-50">
                  <Buildings className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-grey-90">{loc.name}</h1>
                  <p className="mt-0.5 text-sm text-grey-50">{formatAddress(loc.address)}</p>
                </div>
              </div>
              <ActionMenu
                items={[
                  { label: "Edit", icon: PencilSquare, onClick: openEdit },
                  { label: "Delete", icon: Trash, destructive: true, onClick: handleDeleteLocation },
                ]}
              />
            </div>
          </Card>

          <FulfillmentSetSection
            type="shipping"
            set={shippingSet}
            busy={busy}
            onEnable={() => handleEnableSet("shipping")}
            onDisable={handleDisableSet}
            onCreateZone={openZoneCreate}
            onZoneEdit={openZoneEdit}
            onZoneDelete={handleDeleteZone}
            onCreateOption={openOptionCreate}
            onOptionEdit={openOptionEdit}
            onOptionDelete={handleDeleteOption}
          />
          <FulfillmentSetSection
            type="pickup"
            set={pickupSet}
            busy={busy}
            onEnable={() => handleEnableSet("pickup")}
            onDisable={handleDisableSet}
            onCreateZone={openZoneCreate}
            onZoneEdit={openZoneEdit}
            onZoneDelete={handleDeleteZone}
            onCreateOption={openOptionCreate}
            onOptionEdit={openOptionEdit}
            onOptionDelete={handleDeleteOption}
          />

          {loc.metadata && Object.keys(loc.metadata).length > 0 && (
            <Card title="Metadata">
              <dl className="divide-y divide-grey-10">
                {Object.entries(loc.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-grey-50">{k}</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card bodyClassName="p-0">
            <button type="button" onClick={() => setShowJson((s) => !s)} className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90">
              Raw location data (JSON)
              <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
            </button>
            {showJson && <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">{JSON.stringify(loc, null, 2)}</pre>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Sales channels" action={<button onClick={openChannels} className="text-sm font-medium text-grey-60 hover:text-grey-90">Edit</button>}>
            {loc.sales_channels.length > 0 ? (
              <ul className="space-y-2">
                {loc.sales_channels.map((sc) => (
                  <li key={sc.id} className="flex items-center gap-2 text-sm text-grey-80">
                    <ShoppingBag className="h-4 w-4 text-grey-40" />
                    {sc.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-grey-50">No sales channels connected.</p>
            )}
          </Card>

          <Card title="Fulfillment providers" action={<button onClick={openProviders} className="text-sm font-medium text-grey-60 hover:text-grey-90">Edit</button>}>
            {loc.fulfillment_providers.length > 0 ? (
              <ul className="space-y-2">
                {loc.fulfillment_providers.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm text-grey-80">
                    <TruckFast className="h-4 w-4 text-grey-40" />
                    {formatProvider(p.id)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-grey-50">No fulfillment providers enabled.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Edit location modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit location" description="A place you stock and ship inventory from." size="sm">
        <form onSubmit={saveLocation} className="space-y-4">
          <FormField label="Name" htmlFor="loc-name"><Input id="loc-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Main warehouse" /></FormField>
          <FormField label="Address" htmlFor="loc-addr" hint="Optional"><Input id="loc-addr" value={form.address_1} onChange={(e) => setForm((p) => ({ ...p, address_1: e.target.value }))} placeholder="Street address" /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="City" htmlFor="loc-city"><Input id="loc-city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Optional" /></FormField>
            <FormField label="Province / state" htmlFor="loc-prov"><Input id="loc-prov" value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))} placeholder="Optional" /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Postal code" htmlFor="loc-postal"><Input id="loc-postal" value={form.postal_code} onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))} placeholder="Optional" /></FormField>
            <FormField label="Country code" htmlFor="loc-country" hint="2-letter, required with address"><Input id="loc-country" value={form.country_code} onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))} placeholder="us" maxLength={2} /></FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button type="submit" disabled={busy === "save-loc" || !form.name.trim()} className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">{busy === "save-loc" ? "Saving..." : "Save location"}</button>
          </div>
        </form>
      </Modal>

      {/* Zone modal */}
      <Modal open={zoneModal.open} onClose={() => setZoneModal((m) => ({ ...m, open: false }))} title={zoneModal.mode === "create" ? "Create service zone" : "Edit service zone"} description="Name the zone and choose the countries it covers." size="sm">
        <div className="space-y-4">
          <FormField label="Zone name" htmlFor="zone-name"><Input id="zone-name" value={zoneModal.name} onChange={(e) => setZoneModal((m) => ({ ...m, name: e.target.value }))} placeholder="e.g. Domestic, Europe" /></FormField>
          <div>
            <p className="mb-1.5 text-sm font-medium text-grey-70">Countries</p>
            <CountryPicker
              selected={zoneModal.countries}
              onToggle={(code) =>
                setZoneModal((m) => {
                  const next = new Set(m.countries)
                  next.has(code) ? next.delete(code) : next.add(code)
                  return { ...m, countries: next }
                })
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setZoneModal((m) => ({ ...m, open: false }))} className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={saveZone} disabled={busy === "save-zone" || !zoneModal.name.trim()} className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">{busy === "save-zone" ? "Saving..." : "Save zone"}</button>
          </div>
        </div>
      </Modal>

      {/* Shipping option modal */}
      <Modal open={optModal.open} onClose={() => setOptModal((m) => ({ ...m, open: false }))} title={optModal.mode === "create" ? (optModal.is_return ? "Create return option" : "Create shipping option") : "Edit shipping option"} description="Set the option name, price and store visibility." size="sm">
        <div className="space-y-4">
          <FormField label="Name" htmlFor="opt-name"><Input id="opt-name" value={optModal.name} onChange={(e) => setOptModal((m) => ({ ...m, name: e.target.value }))} placeholder="e.g. Standard, Express" /></FormField>
          <div>
            <p className="mb-1.5 text-sm font-medium text-grey-70">Price</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-grey-90"><input type="radio" checked={optModal.price_type === "flat"} onChange={() => setOptModal((m) => ({ ...m, price_type: "flat" }))} /> Flat rate</label>
              <label className="flex items-center gap-2 text-sm text-grey-90"><input type="radio" checked={optModal.price_type === "calculated"} onChange={() => setOptModal((m) => ({ ...m, price_type: "calculated" }))} /> Calculated</label>
            </div>
          </div>
          {optModal.price_type === "flat" && (
            <FormField label="Amount" htmlFor="opt-amount" hint="In your store currency (major units)">
              <Input id="opt-amount" type="number" min={0} value={optModal.amount} onChange={(e) => setOptModal((m) => ({ ...m, amount: e.target.value }))} placeholder="0" />
            </FormField>
          )}
          <label className="flex items-center gap-2 text-sm text-grey-90">
            <input type="checkbox" checked={optModal.enabled_in_store} onChange={(e) => setOptModal((m) => ({ ...m, enabled_in_store: e.target.checked }))} />
            Available to customers at checkout
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setOptModal((m) => ({ ...m, open: false }))} className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={saveOption} disabled={busy === "save-opt" || !optModal.name.trim()} className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">{busy === "save-opt" ? "Saving..." : "Save option"}</button>
          </div>
        </div>
      </Modal>

      {/* Sales channels modal */}
      <Modal open={channelsOpen} onClose={() => setChannelsOpen(false)} title="Sales channels" description="Choose which sales channels fulfil from this location." size="sm">
        <div className="space-y-4">
          {allChannels.length === 0 ? (
            <p className="text-sm text-grey-50">No sales channels available.</p>
          ) : (
            <div className="space-y-1">
              {allChannels.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-base px-2 py-2 text-sm hover:bg-grey-10">
                  <input
                    type="checkbox"
                    checked={channelSel.has(c.id)}
                    onChange={() =>
                      setChannelSel((s) => {
                        const n = new Set(s)
                        n.has(c.id) ? n.delete(c.id) : n.add(c.id)
                        return n
                      })
                    }
                  />
                  <span className="text-grey-90">{c.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setChannelsOpen(false)} className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={saveChannels} disabled={busy === "save-ch"} className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">{busy === "save-ch" ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Providers modal */}
      <Modal open={providersOpen} onClose={() => setProvidersOpen(false)} title="Fulfillment providers" description="Enable providers that can fulfil orders from this location." size="sm">
        <div className="space-y-4">
          {allProviders.length === 0 ? (
            <p className="text-sm text-grey-50">No providers available.</p>
          ) : (
            <div className="space-y-1">
              {allProviders.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-base px-2 py-2 text-sm hover:bg-grey-10">
                  <input
                    type="checkbox"
                    checked={providerSel.has(p.id)}
                    onChange={() =>
                      setProviderSel((s) => {
                        const n = new Set(s)
                        n.has(p.id) ? n.delete(p.id) : n.add(p.id)
                        return n
                      })
                    }
                  />
                  <span className="text-grey-90">{formatProvider(p.id)}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setProvidersOpen(false)} className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={saveProviders} disabled={busy === "save-pr"} className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">{busy === "save-pr" ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fulfillment set section
// ---------------------------------------------------------------------------

function FulfillmentSetSection({
  type,
  set,
  busy,
  onEnable,
  onDisable,
  onCreateZone,
  onZoneEdit,
  onZoneDelete,
  onCreateOption,
  onOptionEdit,
  onOptionDelete,
}: {
  type: "shipping" | "pickup"
  set: LocationFulfillmentSet | null
  busy: string | null
  onEnable: () => void
  onDisable: (s: LocationFulfillmentSet) => void
  onCreateZone: (setId: string) => void
  onZoneEdit: (setId: string, z: LocationServiceZone) => void
  onZoneDelete: (z: LocationServiceZone) => void
  onCreateOption: (zoneId: string, isReturn: boolean) => void
  onOptionEdit: (o: LocationShippingOption) => void
  onOptionDelete: (o: LocationShippingOption) => void
}) {
  const meta = SET_META[type]
  const Icon = meta.icon
  const enabled = !!set
  const zones = set?.service_zones || []

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-grey-50" />
          <h3 className="text-base font-semibold text-grey-90">{meta.label}</h3>
          <StatusBadge status={enabled ? "active" : "disabled"} />
        </div>
      }
      action={
        enabled ? (
          <ActionMenu
            items={[
              { label: "Create service zone", icon: Plus, onClick: () => onCreateZone(set!.id) },
              { label: "Disable", icon: Trash, destructive: true, onClick: () => onDisable(set!) },
            ]}
          />
        ) : (
          <button onClick={onEnable} disabled={busy === `enable-${type}`} className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {busy === `enable-${type}` ? "Enabling..." : "Enable"}
          </button>
        )
      }
      bodyClassName={enabled && zones.length > 0 ? "p-0" : undefined}
    >
      {!enabled ? (
        <p className="text-sm text-grey-50">{meta.help} Enable to add service zones and rates.</p>
      ) : zones.length === 0 ? (
        <div className="rounded-base border border-dashed border-grey-20 p-6 text-center">
          <MapPin className="mx-auto h-6 w-6 text-grey-40" />
          <p className="mt-2 text-sm font-medium text-grey-80">No service zones yet</p>
          <p className="mt-0.5 text-sm text-grey-50">Add a service zone to define which countries you {type === "pickup" ? "offer pickup in" : "ship to"} and at what rates.</p>
          <button onClick={() => onCreateZone(set!.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80">
            <Plus className="h-4 w-4" />
            Create service zone
          </button>
        </div>
      ) : (
        <div className="divide-y divide-grey-10">
          {zones.map((z) => (
            <ServiceZoneBlock
              key={z.id}
              zone={z}
              type={type}
              onEdit={() => onZoneEdit(set!.id, z)}
              onDelete={() => onZoneDelete(z)}
              onCreateOption={(isReturn) => onCreateOption(z.id, isReturn)}
              onOptionEdit={onOptionEdit}
              onOptionDelete={onOptionDelete}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function ServiceZoneBlock({
  zone,
  type,
  onEdit,
  onDelete,
  onCreateOption,
  onOptionEdit,
  onOptionDelete,
}: {
  zone: LocationServiceZone
  type: "shipping" | "pickup"
  onEdit: () => void
  onDelete: () => void
  onCreateOption: (isReturn: boolean) => void
  onOptionEdit: (o: LocationShippingOption) => void
  onOptionDelete: (o: LocationShippingOption) => void
}) {
  const countries = zone.geo_zones.filter((g) => g.type === "country")
  const outbound = zone.shipping_options.filter((o) => !o.is_return)
  const returns = zone.shipping_options.filter((o) => o.is_return)

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-50"><MapPin className="h-4 w-4" /></div>
          <div>
            <p className="font-medium text-grey-90">{zone.name}</p>
            <p className="text-xs text-grey-50">
              {countries.length > 0
                ? countries.slice(0, 3).map((g) => countryName(g.country_code)).join(", ") + (countries.length > 3 ? ` +${countries.length - 3} more` : "")
                : "No countries"}
              {" · "}{outbound.length} option{outbound.length === 1 ? "" : "s"}{" · "}{returns.length} return{returns.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <ActionMenu items={[{ label: "Edit zone", icon: PencilSquare, onClick: onEdit }, { label: "Delete", icon: Trash, destructive: true, onClick: onDelete }]} />
      </div>

      <div className="mt-3 space-y-3 pl-12">
        <OptionGroup label={type === "pickup" ? "Pickup options" : "Shipping options"} options={outbound} onCreate={() => onCreateOption(false)} onOptionEdit={onOptionEdit} onOptionDelete={onOptionDelete} />
        <OptionGroup label="Return options" options={returns} onCreate={() => onCreateOption(true)} onOptionEdit={onOptionEdit} onOptionDelete={onOptionDelete} />
      </div>
    </div>
  )
}

function OptionGroup({
  label,
  options,
  onCreate,
  onOptionEdit,
  onOptionDelete,
}: {
  label: string
  options: LocationShippingOption[]
  onCreate: () => void
  onOptionEdit: (o: LocationShippingOption) => void
  onOptionDelete: (o: LocationShippingOption) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-grey-50">{label}</span>
        <button onClick={onCreate} className="inline-flex items-center gap-1 text-xs font-medium text-grey-60 hover:text-grey-90"><Plus className="h-3.5 w-3.5" />Create</button>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-grey-40">None yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {options.map((o) => {
            const price = o.prices.find((p) => p.currency_code) || o.prices[0]
            return (
              <li key={o.id} className="flex items-center justify-between rounded-base border border-grey-20 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-grey-90">{o.name}</p>
                  <p className="text-xs text-grey-50">
                    {o.price_type === "calculated" ? "Calculated at checkout" : price ? formatMoney(price.amount, price.currency_code || "usd") : "Flat"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", o.enabled_in_store ? "bg-emerald-50 text-emerald-700" : "bg-grey-10 text-grey-50")}>{o.enabled_in_store ? "In store" : "Hidden"}</span>
                  <ActionMenu items={[{ label: "Edit", icon: CurrencyDollar, onClick: () => onOptionEdit(o) }, { label: "Delete", icon: Trash, destructive: true, onClick: () => onOptionDelete(o) }]} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
