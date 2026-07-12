"use client"

import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CubeSolid,
  ExclamationCircle,
  Funnel,
  MagnifyingGlass,
  PencilSquare,
  Photo,
  Plus,
  Trash,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listProductsPagedWithDates,
  listProductTypes,
  listProductTags,
  deleteProduct,
  ProductListItem,
  ProductType,
  ProductTag,
  ApiError,
} from "../../../lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Product status badge (dot style) — colors per Medusa spec:
// draft=grey, proposed=orange, published=green, rejected=red.
// ---------------------------------------------------------------------------

const STATUS_META: Record<string, { label: string; dot: string }> = {
  draft: { label: "Draft", dot: "bg-grey-40" },
  proposed: { label: "Proposed", dot: "bg-orange-500" },
  published: { label: "Published", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", dot: "bg-rose-500" },
}

function ProductStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "—",
    dot: "bg-grey-40",
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-grey-20 bg-white px-2 py-0.5 text-xs font-medium text-grey-70">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "proposed", label: "Proposed" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
]

const SORT_OPTIONS = [
  { value: "title", label: "Title (A-Z)" },
  { value: "-title", label: "Title (Z-A)" },
  { value: "created_at", label: "Created (oldest first)" },
  { value: "-created_at", label: "Created (newest first)" },
  { value: "updated_at", label: "Updated (oldest first)" },
  { value: "-updated_at", label: "Updated (newest first)" },
]

// ---------------------------------------------------------------------------
// Multi-select filter dropdown (searchable checkbox list)
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  searchable,
  loading,
  loadError,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  searchable?: boolean
  loading?: boolean
  loadError?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) => o.label.toLowerCase().includes(term))
  }, [options, q])

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-base border px-3 py-2 text-sm font-medium transition-colors",
          selected.length > 0
            ? "border-grey-90 bg-grey-90 text-white hover:bg-grey-80"
            : "border-grey-20 bg-white text-grey-70 hover:bg-grey-10"
        )}
      >
        <Funnel className="h-4 w-4" />
        {label}
        {selected.length > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 text-xs",
              "bg-white/20 text-white"
            )}
          >
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-60 rounded-large border border-grey-20 bg-white py-2 shadow-lg">
          {searchable && (
            <div className="px-2 pb-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-base border border-grey-20 px-2.5 py-1.5 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto px-1">
            {loading ? (
              <p className="px-2 py-2 text-sm text-grey-40">Loading...</p>
            ) : loadError ? (
              <p className="px-2 py-2 text-sm text-rose-600">{loadError}</p>
            ) : visible.length === 0 ? (
              <p className="px-2 py-2 text-sm text-grey-40">No options found.</p>
            ) : (
              visible.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-base px-2 py-1.5 text-sm text-grey-90 hover:bg-grey-10"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-grey-10 px-2 pt-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-base px-2 py-1.5 text-left text-sm text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date-range filter dropdown (After / Before date inputs) — matches the
// filter-pill styling of FilterDropdown. Emits ISO date strings (YYYY-MM-DD)
// via URL params; the backend expands them to inclusive day boundaries.
// ---------------------------------------------------------------------------

function DateFilterDropdown({
  label,
  after,
  before,
  onChange,
}: {
  label: string
  after: string
  before: string
  onChange: (next: { after: string; before: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const activeCount = (after ? 1 : 0) + (before ? 1 : 0)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-base border px-3 py-2 text-sm font-medium transition-colors",
          activeCount > 0
            ? "border-grey-90 bg-grey-90 text-white hover:bg-grey-80"
            : "border-grey-20 bg-white text-grey-70 hover:bg-grey-10"
        )}
      >
        <Calendar className="h-4 w-4" />
        {label}
        {activeCount > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-xs text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-large border border-grey-20 bg-white p-3 shadow-lg">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-grey-60">
                After
              </label>
              <input
                type="date"
                value={after}
                max={before || undefined}
                onChange={(e) =>
                  onChange({ after: e.target.value, before })
                }
                className="w-full rounded-base border border-grey-20 px-2.5 py-1.5 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-grey-60">
                Before
              </label>
              <input
                type="date"
                value={before}
                min={after || undefined}
                onChange={(e) =>
                  onChange({ after, before: e.target.value })
                }
                className="w-full rounded-base border border-grey-20 px-2.5 py-1.5 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              />
            </div>
          </div>
          {activeCount > 0 && (
            <div className="mt-3 border-t border-grey-10 pt-2">
              <button
                type="button"
                onClick={() => onChange({ after: "", before: "" })}
                className="w-full rounded-base px-2 py-1.5 text-left text-sm text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table cells
// ---------------------------------------------------------------------------

function SalesChannelsCell({ product }: { product: ProductListItem }) {
  const names = (product.sales_channels || []).map((c) => c.name)
  if (names.length === 0) {
    return <span className="text-grey-50">-</span>
  }
  const first = names.slice(0, 2).join(", ")
  const rest = names.slice(2)
  return (
    <span className="text-grey-90">
      {first}
      {rest.length > 0 && (
        <span
          title={rest.join(", ")}
          className="ml-1 cursor-default text-grey-50"
        >
          +{rest.length} more
        </span>
      )}
    </span>
  )
}

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-grey-10 last:border-0">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded-base bg-grey-10" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ProductsPageContent() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // URL is the single source of truth for q / filters / sort / offset.
  const qParam = searchParams.get("q") || ""
  const orderParam = searchParams.get("order") || ""
  const statusParam = searchParams.getAll("status")
  const typeParam = searchParams.getAll("type_id")
  const tagParam = searchParams.getAll("tag_id")
  const createdAfterParam = searchParams.get("created_after") || ""
  const createdBeforeParam = searchParams.get("created_before") || ""
  const updatedAfterParam = searchParams.get("updated_after") || ""
  const updatedBeforeParam = searchParams.get("updated_before") || ""
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10)
  const offset =
    Number.isFinite(offsetRaw) && offsetRaw > 0
      ? Math.floor(offsetRaw / PAGE_SIZE) * PAGE_SIZE
      : 0

  const [products, setProducts] = useState<ProductListItem[]>([])
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [types, setTypes] = useState<ProductType[]>([])
  const [tags, setTags] = useState<ProductTag[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(qParam)
  const selfUrlUpdate = useRef(false)

  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showMessage(type: "success" | "error", text: string) {
    if (messageTimer.current) clearTimeout(messageTimer.current)
    setMessage({ type, text })
    messageTimer.current = setTimeout(() => setMessage(null), 4000)
  }

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current)
    }
  }, [])

  // ---- URL helpers ----
  function updateParams(
    mutate: (p: URLSearchParams) => void,
    { resetOffset = true }: { resetOffset?: boolean } = {}
  ) {
    const p = new URLSearchParams(searchParams.toString())
    mutate(p)
    if (resetOffset) p.delete("offset")
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function setMultiParam(key: string, values: string[]) {
    updateParams((p) => {
      p.delete(key)
      values.forEach((v) => p.append(key, v))
    })
  }

  function setDateParam(
    afterKey: string,
    beforeKey: string,
    next: { after: string; before: string }
  ) {
    updateParams((p) => {
      if (next.after) {
        p.set(afterKey, next.after)
      } else {
        p.delete(afterKey)
      }
      if (next.before) {
        p.set(beforeKey, next.before)
      } else {
        p.delete(beforeKey)
      }
    })
  }

  // ---- debounced search -> URL ----
  useEffect(() => {
    if (searchInput === qParam) return
    const t = setTimeout(() => {
      selfUrlUpdate.current = true
      updateParams((p) => {
        if (searchInput.trim()) {
          p.set("q", searchInput.trim())
        } else {
          p.delete("q")
        }
      })
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Sync input when the URL changes externally (back/forward, refresh).
  useEffect(() => {
    if (selfUrlUpdate.current) {
      selfUrlUpdate.current = false
      return
    }
    setSearchInput(qParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  // ---- data fetch (server-side pagination; keeps previous rows while fetching) ----
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const run = async () => {
      setFetching(true)
      setError(null)
      try {
        const res = await listProductsPagedWithDates(token, {
          q: qParam || undefined,
          offset,
          limit: PAGE_SIZE,
          status: statusParam.length ? statusParam : undefined,
          type_id: typeParam.length ? typeParam : undefined,
          tag_id: tagParam.length ? tagParam : undefined,
          created_after: createdAfterParam || undefined,
          created_before: createdBeforeParam || undefined,
          updated_after: updatedAfterParam || undefined,
          updated_before: updatedBeforeParam || undefined,
          order: orderParam || undefined,
        })
        if (!cancelled) {
          setProducts(res.products || [])
          setCount(res.count || 0)
          setLoaded(true)
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load products"
          )
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams, refreshKey])

  // ---- filter options (types + tags) ----
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const run = async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const [typesRes, tagsRes] = await Promise.all([
          listProductTypes(token),
          listProductTags(token),
        ])
        if (!cancelled) {
          setTypes(typesRes.types || [])
          setTags(tagsRes.tags || [])
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        if (!cancelled) setOptionsError("Could not load options.")
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ---- delete ----
  async function confirmDelete() {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(token, deleteTarget.id)
      showMessage(
        "success",
        `Product deleted. ${deleteTarget.title} was successfully deleted.`
      )
      setDeleteTarget(null)
      // If we just removed the last row of a page beyond the first, step back.
      if (products.length === 1 && offset > 0) {
        updateParams(
          (p) => p.set("offset", String(Math.max(0, offset - PAGE_SIZE))),
          { resetOffset: false }
        )
      } else {
        setRefreshKey((k) => k + 1)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showMessage(
        "error",
        err instanceof Error && err.message
          ? `Failed to delete product. ${err.message}`
          : "Failed to delete product"
      )
    } finally {
      setDeleting(false)
    }
  }

  const hasActiveFilters =
    !!qParam ||
    statusParam.length > 0 ||
    typeParam.length > 0 ||
    tagParam.length > 0 ||
    !!createdAfterParam ||
    !!createdBeforeParam ||
    !!updatedAfterParam ||
    !!updatedBeforeParam

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < count

  const typeOptions = useMemo(
    () => types.map((t) => ({ value: t.id, label: t.value })),
    [types]
  )
  const tagOptions = useMemo(
    () => tags.map((t) => ({ value: t.id, label: t.value })),
    [tags]
  )

  const createButton = (
    <button
      onClick={() => router.push("/dashboard/products/create")}
      className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
    >
      <Plus className="h-4 w-4" />
      Create
    </button>
  )

  const showInitialEmptyState = loaded && count === 0 && !hasActiveFilters
  const showFilteredEmptyState = loaded && count === 0 && hasActiveFilters

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, inventory, and pricing."
        action={createButton}
      />

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && (
            <ExclamationCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="shrink-0 rounded-base border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Toolbar: filters left, search + sort right */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Type"
              options={typeOptions}
              selected={typeParam}
              onChange={(vals) => setMultiParam("type_id", vals)}
              searchable
              loading={optionsLoading}
              loadError={optionsError}
            />
            <FilterDropdown
              label="Tag"
              options={tagOptions}
              selected={tagParam}
              onChange={(vals) => setMultiParam("tag_id", vals)}
              searchable
              loading={optionsLoading}
              loadError={optionsError}
            />
            <FilterDropdown
              label="Status"
              options={STATUS_OPTIONS}
              selected={statusParam}
              onChange={(vals) => setMultiParam("status", vals)}
            />
            <DateFilterDropdown
              label="Created"
              after={createdAfterParam}
              before={createdBeforeParam}
              onChange={(next) =>
                setDateParam("created_after", "created_before", next)
              }
            />
            <DateFilterDropdown
              label="Updated"
              after={updatedAfterParam}
              before={updatedBeforeParam}
              onChange={(next) =>
                setDateParam("updated_after", "updated_before", next)
              }
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("")
                  updateParams((p) => {
                    p.delete("q")
                    p.delete("status")
                    p.delete("type_id")
                    p.delete("tag_id")
                    p.delete("created_after")
                    p.delete("created_before")
                    p.delete("updated_after")
                    p.delete("updated_before")
                  })
                }}
                className="inline-flex items-center gap-1 rounded-base px-2 py-2 text-sm font-medium text-grey-60 hover:text-grey-90"
              >
                <XMark className="h-4 w-4" />
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search"
                className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
              <select
                value={orderParam}
                onChange={(e) =>
                  updateParams((p) => {
                    if (e.target.value) {
                      p.set("order", e.target.value)
                    } else {
                      p.delete("order")
                    }
                  })
                }
                aria-label="Sort"
                className="appearance-none rounded-base border border-grey-20 bg-white py-2 pl-9 pr-8 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              >
                <option value="">Sort by</option>
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <div className="overflow-x-auto">
            <table
              className={cn(
                "w-full text-left text-sm transition-opacity",
                fetching && loaded && "opacity-60"
              )}
            >
              <thead className="bg-grey-10 text-grey-70">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Collection</th>
                  <th className="px-4 py-3 font-medium">Sales Channels</th>
                  <th className="px-4 py-3 font-medium">Variants</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {!loaded && fetching ? (
                  <TableSkeletonRows />
                ) : showInitialEmptyState ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10">
                      <EmptyState
                        icon={CubeSolid}
                        title="No products"
                        description="Create your first product to start selling."
                        action={createButton}
                        className="border-0 bg-transparent shadow-none"
                      />
                    </td>
                  </tr>
                ) : showFilteredEmptyState ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10">
                      <EmptyState
                        icon={MagnifyingGlass}
                        title="No results"
                        description="Try adjusting the search or filters to find what you are looking for."
                        className="border-0 bg-transparent shadow-none"
                      />
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/products/${p.id}`)}
                      className="cursor-pointer transition-colors hover:bg-grey-5"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.thumbnail ? (
                            <img
                              src={p.thumbnail}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-base object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-base bg-grey-10">
                              <Photo className="h-5 w-5 text-grey-40" />
                            </div>
                          )}
                          <span className="max-w-[220px] truncate font-medium text-grey-90">
                            {p.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.collection?.title ? (
                          <span className="text-grey-90">
                            {p.collection.title}
                          </span>
                        ) : (
                          <span className="text-grey-50">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SalesChannelsCell product={p} />
                      </td>
                      <td className="px-4 py-3 text-grey-90">
                        {p.variants_count ?? 0} variant(s)
                      </td>
                      <td className="px-4 py-3">
                        <ProductStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ActionMenu
                            items={[
                              {
                                label: "Edit",
                                icon: PencilSquare,
                                onClick: () =>
                                  router.push(
                                    `/dashboard/products/${p.id}?edit=1`
                                  ),
                              },
                              {
                                label: "Delete",
                                icon: Trash,
                                destructive: true,
                                onClick: () => setDeleteTarget(p),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {loaded && count > 0 && (
            <div className="flex items-center justify-between border-t border-grey-10 px-4 py-3">
              <p className="text-xs text-grey-50">
                {offset + 1} — {Math.min(offset + PAGE_SIZE, count)} of {count}{" "}
                results
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateParams(
                      (p) => {
                        const next = Math.max(0, offset - PAGE_SIZE)
                        if (next === 0) {
                          p.delete("offset")
                        } else {
                          p.set("offset", String(next))
                        }
                      },
                      { resetOffset: false }
                    )
                  }
                  disabled={!canPrev || fetching}
                  aria-label="Previous page"
                  className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-grey-60">
                  {currentPage} of {totalPages} pages
                </span>
                <button
                  onClick={() =>
                    updateParams(
                      (p) => p.set("offset", String(offset + PAGE_SIZE)),
                      { resetOffset: false }
                    )
                  }
                  disabled={!canNext || fetching}
                  aria-label="Next page"
                  className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        title="Are you sure?"
        size="sm"
      >
        <div className="space-y-6">
          <p className="text-sm text-grey-70">
            You are about to delete the product {deleteTarget?.title}. This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ProductsPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, inventory, and pricing."
      />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-base bg-grey-10" />
      <div className="h-96 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ProductsPageContent />
    </Suspense>
  )
}
