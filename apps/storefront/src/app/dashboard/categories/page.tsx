"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  FolderOpen,
  Plus,
  PencilSquare,
  Trash,
  TriangleRightMini,
  ArrowUpMini,
  ArrowDownMini,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCategories,
  deleteCategory,
  reorderCategories,
  ProductCategory,
  ApiError,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

type Tone = "green" | "red" | "blue" | "grey"

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800",
  red: "bg-rose-50 text-rose-800",
  blue: "bg-sky-50 text-sky-800",
  grey: "bg-grey-10 text-grey-70",
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "green" && "bg-emerald-500",
          tone === "red" && "bg-rose-500",
          tone === "blue" && "bg-sky-500",
          tone === "grey" && "bg-grey-40"
        )}
      />
      {children}
    </span>
  )
}

function parentIdOf(c: ProductCategory): string | null {
  return c.parent?.id ?? null
}

function CategoriesPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cats, setCats] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [organizeMode, setOrganizeMode] = useState(false)
  const [parentMap, setParentMap] = useState<Record<string, string | null>>({})
  const [rankMap, setRankMap] = useState<Record<string, number>>({})
  const [origParent, setOrigParent] = useState<Record<string, string | null>>({})
  const [origRank, setOrigRank] = useState<Record<string, number>>({})
  const [savingRank, setSavingRank] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listCategories(token)
      setCats(res.categories || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const byId = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
  const allIds = useMemo(() => cats.map((c) => c.id), [cats])

  const childrenOf = useMemo(() => {
    return (pid: string | null) =>
      cats
        .filter((c) => parentIdOf(c) === pid)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [cats])

  // Full breadcrumb path (root -> ... -> node) using parent pointers.
  function pathOf(id: string): ProductCategory[] {
    const chain: ProductCategory[] = []
    let current: ProductCategory | undefined = byId.get(id)
    const guard = new Set<string>()
    while (current && !guard.has(current.id)) {
      guard.add(current.id)
      chain.unshift(current)
      const pid = parentIdOf(current)
      current = pid ? byId.get(pid) : undefined
    }
    return chain
  }

  // Enter organize mode: seed working state from the current tree, siblings
  // ranked by their display order (alphabetical).
  function enterOrganize() {
    const pm: Record<string, string | null> = {}
    const rm: Record<string, number> = {}
    const seed = (pid: string | null) => {
      const sibs = childrenOf(pid)
      sibs.forEach((c, idx) => {
        pm[c.id] = pid
        rm[c.id] = idx
        seed(c.id)
      })
    }
    seed(null)
    setParentMap(pm)
    setRankMap(rm)
    setOrigParent({ ...pm })
    setOrigRank({ ...rm })
    setOrganizeMode(true)
  }

  function cancelOrganize() {
    setOrganizeMode(false)
    setParentMap({})
    setRankMap({})
  }

  // Auto-open organize mode when arriving from the detail "Edit ranking" action.
  useEffect(() => {
    if (!loading && cats.length > 0 && searchParams.get("organize") === "1" && !organizeMode) {
      enterOrganize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, cats.length])

  function organizeChildren(pid: string | null): string[] {
    return allIds
      .filter((id) => (parentMap[id] ?? null) === pid)
      .sort((a, b) => (rankMap[a] ?? 0) - (rankMap[b] ?? 0))
  }

  function descendantsOf(id: string): Set<string> {
    const out = new Set<string>()
    const walk = (pid: string) => {
      for (const cid of allIds) {
        if ((parentMap[cid] ?? null) === pid && !out.has(cid)) {
          out.add(cid)
          walk(cid)
        }
      }
    }
    walk(id)
    return out
  }

  function normalizeSiblings(pid: string | null, rm: Record<string, number>) {
    const sibs = allIds
      .filter((id) => (parentMap[id] ?? null) === pid)
      .sort((a, b) => (rm[a] ?? 0) - (rm[b] ?? 0))
    sibs.forEach((id, idx) => {
      rm[id] = idx
    })
  }

  function moveWithinSiblings(id: string, dir: -1 | 1) {
    const pid = parentMap[id] ?? null
    const sibs = organizeChildren(pid)
    const idx = sibs.indexOf(id)
    const target = idx + dir
    if (target < 0 || target >= sibs.length) return
    setRankMap((prev) => {
      const next = { ...prev }
      const a = sibs[idx]
      const b = sibs[target]
      const tmp = next[a]
      next[a] = next[b]
      next[b] = tmp
      return next
    })
  }

  function reparent(id: string, newParent: string | null) {
    if (newParent === id) return
    if (newParent && descendantsOf(id).has(newParent)) {
      showMessage("error", "A category cannot be moved under one of its own descendants.")
      return
    }
    const oldParent = parentMap[id] ?? null
    if (oldParent === newParent) return
    const newSibsCount = allIds.filter(
      (x) => x !== id && (parentMap[x] ?? null) === newParent
    ).length
    setParentMap((prev) => ({ ...prev, [id]: newParent }))
    setRankMap((prev) => ({ ...prev, [id]: newSibsCount }))
  }

  async function saveRanking() {
    if (!token) return
    // Renormalize every affected sibling group so ranks are contiguous.
    const rm = { ...rankMap }
    const groups = new Set<string | null>()
    for (const id of allIds) groups.add(parentMap[id] ?? null)
    groups.forEach((pid) => normalizeSiblings(pid, rm))

    const updates = allIds
      .filter(
        (id) =>
          (parentMap[id] ?? null) !== (origParent[id] ?? null) || rm[id] !== origRank[id]
      )
      .map((id) => ({
        id,
        rank: rm[id],
        parent_category_id: parentMap[id] ?? null,
      }))

    if (updates.length === 0) {
      cancelOrganize()
      return
    }

    setSavingRank(true)
    try {
      await reorderCategories(token, updates)
      showMessage("success", "Category ranking was successfully updated.")
      cancelOrganize()
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update ranking")
    } finally {
      setSavingRank(false)
    }
  }

  async function handleDelete(cat: ProductCategory) {
    if (!token) return
    if (
      !confirm(
        `You are about to delete the category ${cat.name}. This action cannot be undone.`
      )
    )
      return
    try {
      await deleteCategory(token, cat.id)
      showMessage("success", `Category ${cat.name} was successfully deleted.`)
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete category")
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const searching = query.trim().length > 0

  const searchResults = useMemo(() => {
    if (!searching) return []
    const q = query.trim().toLowerCase()
    return cats
      .filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.handle || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [cats, query, searching])

  // ---- render helpers ----

  function renderTreeRows(pid: string | null, depth: number): React.ReactNode[] {
    const rows: React.ReactNode[] = []
    for (const c of childrenOf(pid)) {
      const kids = childrenOf(c.id)
      const isOpen = expanded.has(c.id)
      const count = (c as any).products_count as number | undefined
      rows.push(
        <tr
          key={c.id}
          onClick={() => router.push(`/dashboard/categories/${c.id}`)}
          className="cursor-pointer transition-colors hover:bg-grey-5"
        >
          <td className="px-4 py-3">
            <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
              {kids.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(c.id)
                  }}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  className="mr-1 flex h-6 w-6 items-center justify-center rounded-base text-grey-50 hover:bg-grey-10 hover:text-grey-90"
                >
                  <TriangleRightMini
                    className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                  />
                </button>
              ) : (
                <span className="mr-1 inline-block h-6 w-6" />
              )}
              <span className="font-medium text-grey-90">{c.name}</span>
            </div>
          </td>
          <td className="px-4 py-3 text-grey-70">/{c.handle}</td>
          <td className="px-4 py-3">
            <Pill tone={c.status === "active" ? "green" : "red"}>
              {c.status === "active" ? "Active" : "Inactive"}
            </Pill>
          </td>
          <td className="px-4 py-3">
            <Pill tone={c.visibility === "internal" ? "blue" : "green"}>
              {c.visibility === "internal" ? "Internal" : "Public"}
            </Pill>
          </td>
          <td className="px-4 py-3 text-grey-70">{count ?? 0}</td>
          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <ActionMenu
                items={[
                  {
                    label: "Edit",
                    icon: PencilSquare,
                    onClick: () => router.push(`/dashboard/categories/${c.id}`),
                  },
                  {
                    label: "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: () => handleDelete(c),
                  },
                ]}
              />
            </div>
          </td>
        </tr>
      )
      if (isOpen && kids.length > 0) {
        rows.push(...renderTreeRows(c.id, depth + 1))
      }
    }
    return rows
  }

  function renderSearchRows(): React.ReactNode[] {
    return searchResults.map((c) => {
      const path = pathOf(c.id)
      const count = (c as any).products_count as number | undefined
      return (
        <tr
          key={c.id}
          onClick={() => router.push(`/dashboard/categories/${c.id}`)}
          className="cursor-pointer transition-colors hover:bg-grey-5"
        >
          <td className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-1 text-sm">
              {path.map((node, idx) => {
                const last = idx === path.length - 1
                return (
                  <React.Fragment key={node.id}>
                    <span className={last ? "font-medium text-grey-90" : "text-grey-40"}>
                      {node.name}
                    </span>
                    {!last && <span className="text-grey-30">/</span>}
                  </React.Fragment>
                )
              })}
            </div>
          </td>
          <td className="px-4 py-3 text-grey-70">/{c.handle}</td>
          <td className="px-4 py-3">
            <Pill tone={c.status === "active" ? "green" : "red"}>
              {c.status === "active" ? "Active" : "Inactive"}
            </Pill>
          </td>
          <td className="px-4 py-3">
            <Pill tone={c.visibility === "internal" ? "blue" : "green"}>
              {c.visibility === "internal" ? "Internal" : "Public"}
            </Pill>
          </td>
          <td className="px-4 py-3 text-grey-70">{count ?? 0}</td>
          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <ActionMenu
                items={[
                  {
                    label: "Edit",
                    icon: PencilSquare,
                    onClick: () => router.push(`/dashboard/categories/${c.id}`),
                  },
                  {
                    label: "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: () => handleDelete(c),
                  },
                ]}
              />
            </div>
          </td>
        </tr>
      )
    })
  }

  function renderOrganizeRows(pid: string | null, depth: number): React.ReactNode[] {
    const rows: React.ReactNode[] = []
    const sibs = organizeChildren(pid)
    sibs.forEach((id, idx) => {
      const c = byId.get(id)
      if (!c) return
      const descendants = descendantsOf(id)
      const parentOptions = allIds
        .filter((oid) => oid !== id && !descendants.has(oid))
        .map((oid) => byId.get(oid)!)
        .filter(Boolean)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      rows.push(
        <tr key={id} className="border-b border-grey-10 last:border-0">
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveWithinSiblings(id, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                  className="flex h-5 w-5 items-center justify-center rounded-base text-grey-50 hover:bg-grey-10 hover:text-grey-90 disabled:opacity-30"
                >
                  <ArrowUpMini className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveWithinSiblings(id, 1)}
                  disabled={idx === sibs.length - 1}
                  aria-label="Move down"
                  className="flex h-5 w-5 items-center justify-center rounded-base text-grey-50 hover:bg-grey-10 hover:text-grey-90 disabled:opacity-30"
                >
                  <ArrowDownMini className="h-4 w-4" />
                </button>
              </div>
              <span className="font-medium text-grey-90">{c.name}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <select
              value={pid ?? ""}
              onChange={(e) => reparent(id, e.target.value || null)}
              className="w-full max-w-xs appearance-none rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
            >
              <option value="">— Top level —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </td>
          <td className="px-4 py-3">
            <input
              type="number"
              min={1}
              value={idx + 1}
              onChange={(e) => {
                const pos = Math.max(1, Math.min(sibs.length, Number(e.target.value) || 1)) - 1
                const current = idx
                if (pos === current) return
                setRankMap((prev) => {
                  const next = { ...prev }
                  const ordered = [...sibs]
                  ordered.splice(pos, 0, ordered.splice(current, 1)[0])
                  ordered.forEach((sid, i) => {
                    next[sid] = i
                  })
                  return next
                })
              }}
              className="w-16 rounded-base border border-grey-30 bg-white px-2 py-1.5 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
            />
          </td>
        </tr>
      )
      rows.push(...renderOrganizeRows(id, depth + 1))
    })
    return rows
  }

  const hasCategories = cats.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize products into categories, and manage those categories' ranking and hierarchy."
        action={
          organizeMode ? (
            <div className="flex items-center gap-3">
              <button
                onClick={cancelOrganize}
                disabled={savingRank}
                className="inline-flex items-center rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveRanking}
                disabled={savingRank}
                className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
              >
                {savingRank ? "Saving..." : "Save ranking"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {hasCategories && (
                <button
                  onClick={enterOrganize}
                  className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
                >
                  <PencilSquare className="h-4 w-4" />
                  Edit ranking
                </button>
              )}
              <button
                onClick={() => router.push("/dashboard/categories/create")}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
            </div>
          )
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div
          className={cn(
            "rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.text}
        </div>
      )}

      {!organizeMode && (
        <div className="relative sm:max-w-xs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full rounded-base border border-grey-20 bg-white py-2 px-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
          />
        </div>
      )}

      {organizeMode && (
        <p className="text-sm text-grey-50">
          Use the arrows to reorder categories within their level, the parent selector to move
          a category under another, or type a position. Changes apply when you save.
        </p>
      )}

      <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-grey-10 text-grey-70">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                {organizeMode ? (
                  <>
                    <th className="px-4 py-3 font-medium">Parent</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-medium">Handle</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Visibility</th>
                    <th className="px-4 py-3 font-medium">Products</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={organizeMode ? 3 : 6} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded-base bg-grey-10" />
                    </td>
                  </tr>
                ))
              ) : !hasCategories ? (
                <tr>
                  <td colSpan={organizeMode ? 3 : 6} className="px-4 py-10">
                    <EmptyState
                      icon={FolderOpen}
                      title="No categories yet"
                      description="Get started by adding your first category."
                      action={
                        <button
                          onClick={() => router.push("/dashboard/categories/create")}
                          className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
                        >
                          <Plus className="h-4 w-4" />
                          Create
                        </button>
                      }
                      className="border-0 bg-transparent shadow-none"
                    />
                  </td>
                </tr>
              ) : organizeMode ? (
                renderOrganizeRows(null, 0)
              ) : searching ? (
                searchResults.length > 0 ? (
                  renderSearchRows()
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-grey-50">
                      No categories match your search.
                    </td>
                  </tr>
                )
              ) : (
                renderTreeRows(null, 0)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function CategoriesPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-grey-50">Loading...</div>}>
      <CategoriesPage />
    </Suspense>
  )
}
