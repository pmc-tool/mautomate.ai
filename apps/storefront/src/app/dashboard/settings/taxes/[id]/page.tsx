"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  BuildingTax,
  ExclamationCircle,
  GlobeEuropeSolid,
  InformationCircleSolid,
  MagnifyingGlass,
  MapPin,
  PencilSquare,
  Plus,
  Trash,
  TriangleDownMini,
  TriangleRightMini,
} from "@medusajs/icons"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getTaxRegion,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  createTaxProvince,
  listProducts,
  listProductTypes,
  TaxRegionDetail,
  TaxRate,
  Product,
  ProductType,
  ApiError,
} from "@lib/merchant-admin/api"
import {
  getCountryName,
  getSublevelType,
  formatTaxRate,
  targetTypeLabel,
} from "@lib/merchant-admin/tax-utils"
import { cn } from "@lib/util/cn"

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
          {typeof title === "string" ? (
            <h2 className="text-base font-semibold text-grey-90">{title}</h2>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

function NoDefaultRateBadge() {
  return (
    <span
      title="This tax region does not have a default tax rate. If there is a standard rate, such as a country's VAT, please add it to this region."
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
    >
      <ExclamationCircle className="h-3.5 w-3.5" />
      No default rate
    </span>
  )
}

function TaxRateLine({
  rate,
  showCombinable,
  onEdit,
  onDelete,
}: {
  rate: TaxRate
  showCombinable?: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-grey-90">
          {rate.name}
          {rate.code ? (
            <span className="font-normal text-grey-50"> · {rate.code}</span>
          ) : null}
        </p>
        {showCombinable && (
          <div className="mt-1">
            <StatusBadge
              status={rate.is_combinable ? "Combinable" : "Not combinable"}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-medium text-grey-90">
          {formatTaxRate(rate.rate)}
        </span>
        <ActionMenu
          items={[
            { label: "Edit", icon: PencilSquare, onClick: onEdit },
            { label: "Delete", icon: Trash, destructive: true, onClick: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

// Tax REGIONS (countries and their sublevels) are platform-managed: merchants
// cannot delete this region or its provinces from the dashboard. What IS
// merchant-editable here per the settings contract: tax rates (default +
// overrides) and creating sublevel regions where the backend supports it.
export default function TaxRegionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [region, setRegion] = useState<TaxRegionDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [expandedOverrides, setExpandedOverrides] = useState<
    Record<string, boolean>
  >({})

  // Default tax-rate modal
  const [rateOpen, setRateOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null)
  const [rateName, setRateName] = useState("")
  const [rateValue, setRateValue] = useState("")
  const [rateCode, setRateCode] = useState("")
  const [rateCombinable, setRateCombinable] = useState(false)

  // Province modal
  const [provinceOpen, setProvinceOpen] = useState(false)
  const [provinceCode, setProvinceCode] = useState("")
  const [provRateName, setProvRateName] = useState("")
  const [provRateValue, setProvRateValue] = useState("")
  const [provRateCode, setProvRateCode] = useState("")
  const [provCombinable, setProvCombinable] = useState(false)

  // Override modal
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [editingOverride, setEditingOverride] = useState<TaxRate | null>(null)
  const [ovName, setOvName] = useState("")
  const [ovValue, setOvValue] = useState("")
  const [ovCode, setOvCode] = useState("")
  const [ovCombinable, setOvCombinable] = useState(false)
  const [ovProductIds, setOvProductIds] = useState<string[]>([])
  const [ovTypeIds, setOvTypeIds] = useState<string[]>([])
  const [ovProductSearch, setOvProductSearch] = useState("")
  const [ovTypeSearch, setOvTypeSearch] = useState("")
  const [modalError, setModalError] = useState<string | null>(null)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const load = async () => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [{ tax_region }, prod, types] = await Promise.all([
        getTaxRegion(token, id),
        listProducts(token).catch(() => ({ products: [] as Product[] })),
        listProductTypes(token).catch(() => ({ types: [] as ProductType[] })),
      ])
      setRegion(tax_region)
      setProducts(prod.products || [])
      setProductTypes(types.types || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load tax region")
    } finally {
      setLoading(false)
    }
  }

  const reloadRegion = async () => {
    if (!token || !id) return
    try {
      const { tax_region } = await getTaxRegion(token, id)
      setRegion(tax_region)
    } catch (err) {
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to refresh tax region"
      )
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  const isProvince = !!region?.parent_id
  const sublevel = getSublevelType(region?.country_code)

  const defaultRates = useMemo(
    () => (region?.rates || []).filter((r) => r.is_default),
    [region]
  )
  const overrides = useMemo(
    () => (region?.rates || []).filter((r) => !r.is_default),
    [region]
  )
  const provinces = region?.provinces || []

  const productNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of products) map[p.id] = p.title
    return map
  }, [products])
  const typeNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of productTypes) map[t.id] = t.value
    return map
  }, [productTypes])

  // ---- default tax rate ----
  const openCreateRate = () => {
    setEditingRate(null)
    setRateName("")
    setRateValue("")
    setRateCode("")
    setRateCombinable(false)
    setModalError(null)
    setRateOpen(true)
  }

  const openEditRate = (rate: TaxRate) => {
    setEditingRate(rate)
    setRateName(rate.name)
    setRateValue(rate.rate === null || rate.rate === undefined ? "" : String(rate.rate))
    setRateCode(rate.code || "")
    setRateCombinable(!!rate.is_combinable)
    setModalError(null)
    setRateOpen(true)
  }

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !region || !rateName.trim()) {
      setModalError("Name is required.")
      return
    }
    setBusy("rate")
    setModalError(null)
    try {
      const parsed = rateValue === "" ? null : Number(rateValue)
      const payload = {
        name: rateName.trim(),
        rate: parsed !== null && Number.isNaN(parsed) ? null : parsed,
        code: rateCode.trim() || null,
        is_combinable: isProvince ? rateCombinable : undefined,
      }
      if (editingRate) {
        await updateTaxRate(token, region.id, editingRate.id, payload)
        showMessage("success", "Tax rate was successfully updated.")
      } else {
        await createTaxRate(token, region.id, { ...payload, is_default: true })
        showMessage("success", "Tax rate was successfully created.")
      }
      setRateOpen(false)
      await reloadRegion()
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Failed to save tax rate"
      )
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteRate = async (rate: TaxRate) => {
    if (!token || !region) return
    if (
      !confirm(
        `You are about to delete the tax rate "${rate.name}". This action cannot be undone.`
      )
    )
      return
    setBusy("delete-rate")
    try {
      await deleteTaxRate(token, region.id, rate.id)
      showMessage("success", "Tax rate was successfully deleted.")
      await reloadRegion()
    } catch (err) {
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to delete tax rate"
      )
    } finally {
      setBusy(null)
    }
  }

  // ---- province ----
  const openCreateProvince = () => {
    setProvinceCode("")
    setProvRateName("")
    setProvRateValue("")
    setProvRateCode("")
    setProvCombinable(false)
    setModalError(null)
    setProvinceOpen(true)
  }

  const saveProvince = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !region || !provinceCode.trim()) {
      setModalError("Sublevel code is required.")
      return
    }
    setBusy("province")
    setModalError(null)
    try {
      const parsed = provRateValue === "" ? null : Number(provRateValue)
      const hasRate = provRateName.trim() && parsed !== null && !Number.isNaN(parsed)
      await createTaxProvince(token, region.id, {
        province_code: provinceCode.trim().toLowerCase(),
        default_tax_rate: hasRate
          ? {
              name: provRateName.trim(),
              rate: parsed,
              code: provRateCode.trim() || null,
              is_combinable: provCombinable,
            }
          : null,
      })
      setProvinceOpen(false)
      showMessage("success", "The tax region was successfully created.")
      await reloadRegion()
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Failed to create sublevel region"
      )
    } finally {
      setBusy(null)
    }
  }

  // ---- override ----
  const openCreateOverride = () => {
    setEditingOverride(null)
    setOvName("")
    setOvValue("")
    setOvCode("")
    setOvCombinable(false)
    setOvProductIds([])
    setOvTypeIds([])
    setOvProductSearch("")
    setOvTypeSearch("")
    setModalError(null)
    setOverrideOpen(true)
  }

  const openEditOverride = (rate: TaxRate) => {
    setEditingOverride(rate)
    setOvName(rate.name)
    setOvValue(rate.rate === null || rate.rate === undefined ? "" : String(rate.rate))
    setOvCode(rate.code || "")
    setOvCombinable(!!rate.is_combinable)
    setOvProductIds(
      (rate.rules || [])
        .filter((r) => r.reference === "product")
        .map((r) => r.reference_id)
    )
    setOvTypeIds(
      (rate.rules || [])
        .filter((r) => r.reference === "product_type")
        .map((r) => r.reference_id)
    )
    setOvProductSearch("")
    setOvTypeSearch("")
    setModalError(null)
    setOverrideOpen(true)
  }

  const saveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !region || !ovName.trim()) {
      setModalError("Name is required.")
      return
    }
    setBusy("override")
    setModalError(null)
    try {
      const parsed = ovValue === "" ? null : Number(ovValue)
      const rules = [
        ...ovProductIds.map((rid) => ({
          reference: "product",
          reference_id: rid,
        })),
        ...ovTypeIds.map((rid) => ({
          reference: "product_type",
          reference_id: rid,
        })),
      ]
      const payload = {
        name: ovName.trim(),
        rate: parsed !== null && Number.isNaN(parsed) ? null : parsed,
        code: ovCode.trim() || null,
        is_combinable: ovCombinable,
        rules,
      }
      if (editingOverride) {
        await updateTaxRate(token, region.id, editingOverride.id, payload)
        showMessage("success", "Tax rate was successfully updated.")
      } else {
        await createTaxRate(token, region.id, { ...payload, is_default: false })
        showMessage("success", "Tax rate was successfully created.")
      }
      setOverrideOpen(false)
      await reloadRegion()
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Failed to save override"
      )
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteOverride = async (rate: TaxRate) => {
    if (!token || !region) return
    if (
      !confirm(
        `You are about to delete the tax rate "${rate.name}". This action cannot be undone.`
      )
    )
      return
    setBusy("delete-override")
    try {
      await deleteTaxRate(token, region.id, rate.id)
      showMessage("success", "Tax rate was successfully deleted.")
      await reloadRegion()
    } catch (err) {
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to delete override"
      )
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 animate-pulse rounded-base bg-grey-10" />
        <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
      </div>
    )
  }

  if (error || !region) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/settings/taxes")}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to tax regions
        </button>
        <EmptyState
          icon={BuildingTax}
          title="Tax region not found"
          description={
            error || "This tax region does not exist or you do not have access to it."
          }
        />
      </div>
    )
  }

  const regionLabel = isProvince
    ? region.province_code
      ? region.province_code.toUpperCase()
      : sublevel.singular
    : getCountryName(region.country_code)

  const backHref = region.parent_id
    ? `/dashboard/settings/taxes/${region.parent_id}`
    : "/dashboard/settings/taxes"

  // Regions are platform-managed: no region-level delete is offered. The only
  // region-card action is creating the default tax rate when none exists.
  const detailMenuItems =
    defaultRates.length === 0
      ? [
          {
            label: "Create default tax rate",
            icon: Plus,
            onClick: openCreateRate,
          },
        ]
      : []

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(backHref)}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        {region.parent_id
          ? `Back to ${getCountryName(region.country_code)}`
          : "Back to tax regions"}
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Detail card */}
      <Card
        title={
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-base bg-grey-10 text-grey-60">
              {isProvince ? (
                <MapPin className="h-5 w-5" />
              ) : (
                <GlobeEuropeSolid className="h-5 w-5" />
              )}
            </span>
            <div>
              <h1 className="text-lg font-semibold text-grey-90">{regionLabel}</h1>
              {!isProvince && (
                <p className="text-xs text-grey-50">
                  Country code: {region.country_code.toUpperCase()}
                </p>
              )}
            </div>
            {defaultRates.length === 0 && (
              <div className="ml-1">
                <NoDefaultRateBadge />
              </div>
            )}
          </div>
        }
        action={
          detailMenuItems.length > 0 ? (
            <ActionMenu items={detailMenuItems} />
          ) : undefined
        }
        bodyClassName={defaultRates.length === 0 ? "p-5" : "px-5 py-1"}
      >
        {defaultRates.length === 0 ? (
          <p className="text-sm text-grey-50">
            This tax region does not have a default tax rate yet.
          </p>
        ) : (
          <div className="divide-y divide-grey-10">
            {defaultRates.map((rate) => (
              <TaxRateLine
                key={rate.id}
                rate={rate}
                showCombinable={isProvince}
                onEdit={() => openEditRate(rate)}
                onDelete={() => handleDeleteRate(rate)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Provinces (country only) */}
      {!isProvince && (
        <Card
          title={sublevel.plural}
          action={
            <button
              onClick={openCreateProvince}
              className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          }
          bodyClassName={provinces.length === 0 ? "p-5" : "p-0"}
        >
          {provinces.length === 0 ? (
            <p className="text-sm text-grey-50">
              No {sublevel.plural.toLowerCase()} have been added to this tax region.
            </p>
          ) : (
            <ul className="divide-y divide-grey-10">
              {provinces.map((prov) => (
                <li key={prov.id} className="transition-colors hover:bg-grey-5">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/settings/taxes/${prov.id}`)
                    }
                    className="flex w-full min-w-0 items-center gap-3 px-5 py-3 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-60">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-grey-90">
                        {prov.province_code
                          ? prov.province_code.toUpperCase()
                          : sublevel.singular}
                      </span>
                      <span className="block truncate text-xs text-grey-50">
                        {prov.default_rate
                          ? `${prov.default_rate.name} · ${formatTaxRate(
                              prov.default_rate.rate
                            )}`
                          : "No default rate"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Overrides */}
      <Card
        title="Overrides"
        action={
          <button
            onClick={openCreateOverride}
            className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        }
        bodyClassName={overrides.length === 0 ? "p-5" : "p-0"}
      >
        {overrides.length === 0 ? (
          <p className="text-sm text-grey-50">
            No overrides have been added. Create an override to apply a different
            tax rate to specific products or product types.
          </p>
        ) : (
          <ul className="divide-y divide-grey-10">
            {overrides.map((rate) => {
              const expanded = !!expandedOverrides[rate.id]
              const productRules = (rate.rules || []).filter(
                (r) => r.reference === "product"
              )
              const typeRules = (rate.rules || []).filter(
                (r) => r.reference === "product_type"
              )
              const groups = [
                { reference: "product", ids: productRules.map((r) => r.reference_id) },
                {
                  reference: "product_type",
                  ids: typeRules.map((r) => r.reference_id),
                },
              ].filter((g) => g.ids.length > 0)
              return (
                <li key={rate.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOverrides((prev) => ({
                          ...prev,
                          [rate.id]: !prev[rate.id],
                        }))
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {expanded ? (
                        <TriangleDownMini className="h-4 w-4 shrink-0 text-grey-50" />
                      ) : (
                        <TriangleRightMini className="h-4 w-4 shrink-0 text-grey-50" />
                      )}
                      <span className="min-w-0">
                        <span className="text-sm font-medium text-grey-90">
                          {rate.name}
                          {rate.code ? (
                            <span className="font-normal text-grey-50">
                              {" "}
                              · {rate.code}
                            </span>
                          ) : null}
                        </span>
                        <span className="ml-2 text-xs text-grey-50">
                          {(rate.rules || []).length} target
                          {(rate.rules || []).length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                    <StatusBadge
                      status={rate.is_combinable ? "Combinable" : "Not combinable"}
                    />
                    <ActionMenu
                      items={[
                        {
                          label: "Edit",
                          icon: PencilSquare,
                          onClick: () => openEditOverride(rate),
                        },
                        {
                          label: "Delete",
                          icon: Trash,
                          destructive: true,
                          onClick: () => handleDeleteOverride(rate),
                        },
                      ]}
                    />
                  </div>

                  {expanded && (
                    <div className="mt-3 border-t border-dashed border-grey-20 pt-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-grey-70">
                        <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                          {formatTaxRate(rate.rate)}
                        </span>
                        <span className="text-grey-50">on</span>
                        {groups.length === 0 ? (
                          <span className="text-grey-50">all items</span>
                        ) : (
                          groups.map((g) => {
                            const names = g.ids.map((rid) =>
                              g.reference === "product"
                                ? productNameById[rid] || rid
                                : typeNameById[rid] || rid
                            )
                            return (
                              <span
                                key={g.reference}
                                className="inline-flex items-center gap-1"
                              >
                                <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                                  {targetTypeLabel(g.reference)}
                                </span>
                                <span
                                  title={names.slice(0, 10).join(", ")}
                                  className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70"
                                >
                                  {g.ids.length} value
                                  {g.ids.length === 1 ? "" : "s"}
                                </span>
                              </span>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* JSON */}
      <Card bodyClassName="p-0">
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
        >
          JSON · {Object.keys(region).length} keys
          <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
        </button>
        {showJson && (
          <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
            {JSON.stringify(region, null, 2)}
          </pre>
        )}
      </Card>

      {/* Default / sublevel tax rate modal */}
      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title={editingRate ? "Edit Tax Rate" : "Create Tax Rate"}
        description="Create a new tax rate to define the tax rate for a region."
        size="md"
      >
        <form onSubmit={saveRate} className="space-y-4">
          {modalError && (
            <div className="rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {modalError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Name" htmlFor="rate-name">
              <Input
                id="rate-name"
                value={rateName}
                onChange={(e) => setRateName(e.target.value)}
                placeholder="VAT"
                autoFocus
                required
              />
            </FormField>
            <FormField label="Tax rate" htmlFor="rate-value">
              <div className="relative">
                <Input
                  id="rate-value"
                  type="number"
                  min={0}
                  step="0.0001"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  placeholder="0.00"
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grey-40">
                  %
                </span>
              </div>
            </FormField>
            <FormField label="Tax code" htmlFor="rate-code">
              <Input
                id="rate-code"
                value={rateCode}
                onChange={(e) => setRateCode(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>
          {isProvince && (
            <div className="rounded-base border border-grey-20 p-3">
              <FormToggle
                checked={rateCombinable}
                onChange={setRateCombinable}
                label="Combinable"
                description="Whether this tax rate can be combined with the default rate from the tax region."
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setRateOpen(false)}
              disabled={busy === "rate"}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "rate" || !rateName.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "rate" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Province / sublevel modal */}
      <Modal
        open={provinceOpen}
        onClose={() => setProvinceOpen(false)}
        title={sublevel.createHeading}
        description="Create a sublevel tax region to define tax rates for a specific area within the country."
        size="md"
      >
        <form onSubmit={saveProvince} className="space-y-4">
          {modalError && (
            <div className="rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {modalError}
            </div>
          )}
          <FormField
            label={`${sublevel.singular} code`}
            htmlFor="province-code"
            hint="Enter the ISO 3166-2 code for the sublevel tax region, e.g. KR-26."
          >
            <Input
              id="province-code"
              value={provinceCode}
              onChange={(e) => setProvinceCode(e.target.value)}
              placeholder="KR-26"
              autoFocus
              required
            />
          </FormField>
          <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
            <h3 className="mb-3 text-sm font-medium text-grey-90">
              Default tax rate{" "}
              <span className="font-normal text-grey-50">(Optional)</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Name" htmlFor="province-rate-name">
                <Input
                  id="province-rate-name"
                  value={provRateName}
                  onChange={(e) => setProvRateName(e.target.value)}
                  placeholder="VAT"
                />
              </FormField>
              <FormField label="Tax rate" htmlFor="province-rate-value">
                <div className="relative">
                  <Input
                    id="province-rate-value"
                    type="number"
                    min={0}
                    step="0.0001"
                    value={provRateValue}
                    onChange={(e) => setProvRateValue(e.target.value)}
                    placeholder="0.00"
                    className="pr-8"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grey-40">
                    %
                  </span>
                </div>
              </FormField>
              <FormField label="Tax code" htmlFor="province-rate-code">
                <Input
                  id="province-rate-code"
                  value={provRateCode}
                  onChange={(e) => setProvRateCode(e.target.value)}
                  placeholder="Optional"
                />
              </FormField>
            </div>
            <div className="mt-3">
              <FormToggle
                checked={provCombinable}
                onChange={setProvCombinable}
                label="Combinable"
                description="Whether this tax rate can be combined with the default rate from the tax region."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setProvinceOpen(false)}
              disabled={busy === "province"}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "province" || !provinceCode.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "province" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Override modal */}
      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title={editingOverride ? "Edit Override" : "Create Override"}
        description="Create a tax rate that overrides the default tax rates for selected conditions."
        size="lg"
      >
        <form onSubmit={saveOverride} className="space-y-5">
          {modalError && (
            <div className="rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {modalError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Name" htmlFor="ov-name">
              <Input
                id="ov-name"
                value={ovName}
                onChange={(e) => setOvName(e.target.value)}
                placeholder="Reduced rate"
                autoFocus
                required
              />
            </FormField>
            <FormField label="Tax rate" htmlFor="ov-value">
              <div className="relative">
                <Input
                  id="ov-value"
                  type="number"
                  min={0}
                  step="0.0001"
                  value={ovValue}
                  onChange={(e) => setOvValue(e.target.value)}
                  placeholder="0.00"
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grey-40">
                  %
                </span>
              </div>
            </FormField>
            <FormField label="Tax code" htmlFor="ov-code">
              <Input
                id="ov-code"
                value={ovCode}
                onChange={(e) => setOvCode(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>

          <div className="rounded-base border border-grey-20 p-3">
            <FormToggle
              checked={ovCombinable}
              onChange={setOvCombinable}
              label="Combinable"
              description="Whether this tax rate can be combined with the default rate from the tax region."
            />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-sm font-medium text-grey-90">Targets</span>
              <span className="text-xs text-grey-50">(Optional)</span>
              <span title="Limit this override to specific products or product types. Leave empty to apply to everything.">
                <InformationCircleSolid className="h-3.5 w-3.5 text-grey-40" />
              </span>
            </div>
            <p className="mb-3 text-xs text-grey-50">
              Choose which products or product types this override applies to.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <TargetPicker
                title="Products"
                emptyLabel="No products available."
                search={ovProductSearch}
                onSearch={setOvProductSearch}
                options={products.map((p) => ({ id: p.id, label: p.title }))}
                selected={ovProductIds}
                onToggle={(pid) =>
                  setOvProductIds((prev) =>
                    prev.includes(pid)
                      ? prev.filter((x) => x !== pid)
                      : [...prev, pid]
                  )
                }
              />
              <TargetPicker
                title="Product types"
                emptyLabel="No product types available."
                search={ovTypeSearch}
                onSearch={setOvTypeSearch}
                options={productTypes.map((t) => ({ id: t.id, label: t.value }))}
                selected={ovTypeIds}
                onToggle={(tid) =>
                  setOvTypeIds((prev) =>
                    prev.includes(tid)
                      ? prev.filter((x) => x !== tid)
                      : [...prev, tid]
                  )
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setOverrideOpen(false)}
              disabled={busy === "override"}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "override" || !ovName.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "override" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function TargetPicker({
  title,
  emptyLabel,
  search,
  onSearch,
  options,
  selected,
  onToggle,
}: {
  title: string
  emptyLabel: string
  search: string
  onSearch: (value: string) => void
  options: { id: string; label: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  return (
    <div className="rounded-large border border-grey-20">
      <div className="flex items-center justify-between gap-2 border-b border-grey-10 px-3 py-2">
        <span className="text-sm font-medium text-grey-90">{title}</span>
        {selected.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
            {selected.length} selected
          </span>
        )}
      </div>
      <div className="border-b border-grey-10 p-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full rounded-base border border-grey-20 bg-white py-1.5 pl-8 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-grey-50">
            {options.length === 0 ? emptyLabel : "No matches."}
          </p>
        ) : (
          filtered.map((o) => {
            const checked = selected.includes(o.id)
            return (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-grey-5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(o.id)}
                  className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                />
                <span className="truncate text-sm text-grey-90">{o.label}</span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
