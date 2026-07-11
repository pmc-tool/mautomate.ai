"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Plus,
  Trash,
  PencilSquare,
  Calendar,
  RocketLaunch,
  CheckCircle,
  GridLayout,
  ListBullet,
  MagnifyingGlass,
  EllipsisHorizontal,
  DocumentText,
  Clock,
  ChevronDown,
  ExclamationCircle,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listMarketingPosts,
  getMarketingPost,
  deleteMarketingPost,
  schedulePost,
  approvePost,
  publishPostNow,
  updateMarketingPost,
  listSocialAccounts,
  MarketingPost,
  SocialAccount,
  ApiError,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { PostComposer } from "./post-composer"
import {
  BOARD_COLUMNS,
  columnForStatus,
  postPlatforms,
  earliestScheduledAt,
  postLabel,
  postSnippet,
  formatDate,
  formatDateTime,
  toDatetimeLocal,
  fromDatetimeLocal,
  platformMeta,
  PlatformIcons,
  PLATFORMS,
} from "./post-utils"

type View = "board" | "list" | "calendar"

// Calendar anchor date for a post: earliest target scheduled_at or published_at.
function postCalendarDate(post: MarketingPost): string | null {
  const times = (post.targets || [])
    .map((t) => t.scheduled_at || t.published_at)
    .filter((v): v is string => !!v)
    .sort()
  return times.length ? times[0] : null
}

export default function MarketingPostsPage() {
  const { token } = useMerchantAuth()
  const [posts, setPosts] = useState<MarketingPost[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [view, setView] = useState<View>("board")
  const [statusFilter, setStatusFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [search, setSearch] = useState("")

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [scheduleFor, setScheduleFor] = useState<MarketingPost | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [postsRes, accountsRes] = await Promise.all([
        listMarketingPosts(token, { limit: 100 }),
        listSocialAccounts(token).catch(() => ({ accounts: [], providers: [] })),
      ])
      setAccounts(accountsRes.accounts || [])
      // The list endpoint does not hydrate targets/media; fetch each post's
      // detail so cards can show platforms + schedule. Failures fall back to
      // the list row.
      const base = postsRes.posts || []
      const hydrated = await Promise.allSettled(
        base.map((p) => getMarketingPost(token, p.id))
      )
      setPosts(
        base.map((p, i) => {
          const r = hydrated[i]
          return r.status === "fulfilled" ? r.value.post : p
        })
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      if (
        platformFilter !== "all" &&
        !postPlatforms(p).includes(platformFilter)
      ) {
        return false
      }
      if (q) {
        const hay = `${p.title || ""} ${p.body || ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [posts, statusFilter, platformFilter, search])

  const openCreate = () => {
    setEditingId(null)
    setComposerOpen(true)
  }
  const openEdit = (p: MarketingPost) => {
    setEditingId(p.id)
    setComposerOpen(true)
  }

  const runAction = async (id: string, fn: () => Promise<void>) => {
    if (!token) return
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = (p: MarketingPost) => {
    if (!token) return
    if (!window.confirm(`Delete post "${postLabel(p)}"? This cannot be undone.`))
      return
    runAction(p.id, () => deleteMarketingPost(token, p.id).then(() => undefined))
  }

  const handleSubmit = (p: MarketingPost) =>
    runAction(p.id, () =>
      approvePost(token!, p.id, { action: "submit" }).then(() => undefined)
    )

  const handleApprove = (p: MarketingPost) =>
    runAction(p.id, () =>
      approvePost(token!, p.id, { action: "approve" }).then(() => undefined)
    )

  const handleReject = (p: MarketingPost) =>
    runAction(p.id, () =>
      approvePost(token!, p.id, { action: "reject" }).then(() => undefined)
    )

  const handlePublish = (p: MarketingPost) => {
    if (!token) return
    if (!postPlatforms(p).length) {
      setError(
        "This post has no platform targets. Edit it and add platforms before publishing."
      )
      return
    }
    if (!window.confirm(`Publish "${postLabel(p)}" now?`)) return
    setBusyId(p.id)
    setError(null)
    publishPostNow(token, p.id)
      .then((res) => {
        if (res.publishing_disabled) {
          setFlash(res.note || "Publishing is currently disabled on the server.")
        } else if (res.published) {
          setFlash("Post published.")
        } else {
          setFlash("Publish sweep ran — check target statuses for results.")
        }
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to publish")
      )
      .then(() => load())
      .finally(() => setBusyId(null))
  }

  const revertToDraft = (p: MarketingPost) => {
    const from = p.status
    if (from === "needs_approval") return handleReject(p)
    if (from === "scheduled") {
      return runAction(p.id, () =>
        schedulePost(token!, p.id, { scheduled_at: null }).then(() => undefined)
      )
    }
    return runAction(p.id, () =>
      updateMarketingPost(token!, p.id, { status: "draft" }).then(() => undefined)
    )
  }

  // Drag-and-drop: dropping a card into another column triggers the matching
  // transition. Dropping into "scheduled" opens the schedule picker.
  const onDropToColumn = (columnId: string, post: MarketingPost) => {
    const from = columnForStatus(post.status)
    if (from === columnId) return
    const col = BOARD_COLUMNS.find((c) => c.id === columnId)
    if (!col || !col.droppable) return
    if (columnId === "scheduled") {
      if (!postPlatforms(post).length) {
        setError(
          "Add platform targets (edit the post) before scheduling it."
        )
        return
      }
      setScheduleFor(post)
      return
    }
    if (columnId === "published") return handlePublish(post)
    if (columnId === "needs_approval") return handleSubmit(post)
    if (columnId === "draft") return revertToDraft(post)
  }

  const confirmSchedule = async (whenIso: string | null, platformSubset: string[]) => {
    if (!scheduleFor || !token) return
    const target = scheduleFor
    setScheduleFor(null)
    await runAction(target.id, () =>
      schedulePost(token, target.id, {
        scheduled_at: whenIso,
        target_platforms: platformSubset.length ? platformSubset : undefined,
      }).then(() => undefined)
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Social posts"
          description="Plan, compose, schedule and publish your social content."
        />
        <button
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
        >
          <Plus className="h-4 w-4" /> Compose post
        </button>
      </div>

      {flash && (
        <div className="flex items-start justify-between gap-2 rounded-base border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          <span className="flex items-start gap-2">
            <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {flash}
          </span>
          <button onClick={() => setFlash(null)} className="text-sky-600 underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-base border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts…"
              className="w-56 pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          >
            <option value="all">All statuses</option>
            {BOARD_COLUMNS.flatMap((c) => c.statuses).map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          >
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center rounded-base border border-grey-20 bg-white p-0.5 text-sm">
          {(
            [
              { id: "board", label: "Board", icon: GridLayout },
              { id: "list", label: "List", icon: ListBullet },
              { id: "calendar", label: "Calendar", icon: Calendar },
            ] as { id: View; label: string; icon: any }[]
          ).map((v) => {
            const Icon = v.icon
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={
                  "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 font-medium " +
                  (view === v.id
                    ? "bg-grey-90 text-white"
                    : "text-grey-60 hover:bg-grey-5")
                }
              >
                <Icon className="h-4 w-4" /> {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-large border border-grey-20 bg-white p-10 text-center text-sm text-grey-50 shadow-borders-base">
          Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={DocumentText}
          title="No posts yet"
          description="Compose your first post to start planning your social content."
          action={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              <Plus className="h-4 w-4" /> Compose post
            </button>
          }
        />
      ) : view === "board" ? (
        <BoardView
          posts={filtered}
          busyId={busyId}
          onOpen={openEdit}
          onDropToColumn={onDropToColumn}
          onSchedule={(p) => setScheduleFor(p)}
          onPublish={handlePublish}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      ) : view === "list" ? (
        <ListView
          posts={filtered}
          onOpen={openEdit}
          onDelete={handleDelete}
        />
      ) : (
        <CalendarView posts={filtered} onOpen={openEdit} />
      )}

      {composerOpen && token && (
        <PostComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          editingId={editingId}
          token={token}
          accounts={accounts}
          onSaved={load}
        />
      )}

      {scheduleFor && (
        <ScheduleModal
          post={scheduleFor}
          onClose={() => setScheduleFor(null)}
          onConfirm={confirmSchedule}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Board */

function BoardView({
  posts,
  busyId,
  onOpen,
  onDropToColumn,
  onSchedule,
  onPublish,
  onSubmit,
  onApprove,
  onDelete,
}: {
  posts: MarketingPost[]
  busyId: string | null
  onOpen: (p: MarketingPost) => void
  onDropToColumn: (columnId: string, p: MarketingPost) => void
  onSchedule: (p: MarketingPost) => void
  onPublish: (p: MarketingPost) => void
  onSubmit: (p: MarketingPost) => void
  onApprove: (p: MarketingPost) => void
  onDelete: (p: MarketingPost) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  const byColumn = useMemo(() => {
    const map: Record<string, MarketingPost[]> = {}
    for (const c of BOARD_COLUMNS) map[c.id] = []
    for (const p of posts) {
      const col = columnForStatus(p.status)
      if (map[col]) map[col].push(p)
    }
    return map
  }, [posts])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {BOARD_COLUMNS.map((col) => {
        const isOver = overCol === col.id && col.droppable
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              if (!col.droppable) return
              e.preventDefault()
              setOverCol(col.id)
            }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              setOverCol(null)
              const id = e.dataTransfer.getData("text/plain") || dragId
              const p = posts.find((x) => x.id === id)
              setDragId(null)
              if (p) onDropToColumn(col.id, p)
            }}
            className={
              "flex min-h-[220px] flex-col rounded-large border bg-grey-5/60 " +
              (isOver
                ? "border-grey-90 ring-1 ring-grey-90"
                : "border-grey-20")
            }
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={"h-2 w-2 rounded-full " + col.accent} />
                <span className="text-sm font-semibold text-grey-80">
                  {col.label}
                </span>
              </div>
              <span className="rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-60">
                {byColumn[col.id].length}
              </span>
            </div>
            <div className="flex-1 space-y-2 px-2 pb-2">
              {byColumn[col.id].length === 0 ? (
                <div className="rounded-base border border-dashed border-grey-20 py-6 text-center text-xs text-grey-40">
                  {col.droppable ? "Drop posts here" : "Nothing here"}
                </div>
              ) : (
                byColumn[col.id].map((p) => (
                  <KanbanCard
                    key={p.id}
                    post={p}
                    busy={busyId === p.id}
                    dragging={dragId === p.id}
                    onDragStart={(e) => {
                      setDragId(p.id)
                      e.dataTransfer.setData("text/plain", p.id)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    onDragEnd={() => setDragId(null)}
                    onOpen={() => onOpen(p)}
                    onSchedule={() => onSchedule(p)}
                    onPublish={() => onPublish(p)}
                    onSubmit={() => onSubmit(p)}
                    onApprove={() => onApprove(p)}
                    onDelete={() => onDelete(p)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({
  post,
  busy,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onSchedule,
  onPublish,
  onSubmit,
  onApprove,
  onDelete,
}: {
  post: MarketingPost
  busy: boolean
  dragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onOpen: () => void
  onSchedule: () => void
  onPublish: () => void
  onSubmit: () => void
  onApprove: () => void
  onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const platforms = postPlatforms(post)
  const scheduled = earliestScheduledAt(post)

  useEffect(() => {
    if (!menu) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [menu])

  const canSubmit = post.status === "draft"
  const canApprove = post.status === "draft" || post.status === "needs_approval"

  return (
    <div
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={
        "group cursor-grab rounded-base border border-grey-20 bg-white p-3 shadow-borders-base active:cursor-grabbing " +
        (dragging ? "opacity-40" : "") +
        (busy ? " pointer-events-none opacity-60" : "")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium text-grey-90">
            {postLabel(post)}
          </p>
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenu((m) => !m)}
            className="rounded-base p-1 text-grey-40 hover:bg-grey-10 hover:text-grey-70"
            aria-label="Post actions"
          >
            <EllipsisHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-base border border-grey-20 bg-white py-1 text-sm shadow-lg">
              <MenuItem icon={PencilSquare} label="Edit" onClick={() => { setMenu(false); onOpen() }} />
              {canSubmit && (
                <MenuItem icon={CheckCircle} label="Submit for approval" onClick={() => { setMenu(false); onSubmit() }} />
              )}
              {canApprove && (
                <MenuItem icon={CheckCircle} label="Approve" onClick={() => { setMenu(false); onApprove() }} />
              )}
              <MenuItem icon={Calendar} label="Schedule…" onClick={() => { setMenu(false); onSchedule() }} />
              <MenuItem icon={RocketLaunch} label="Publish now" onClick={() => { setMenu(false); onPublish() }} />
              <div className="my-1 border-t border-grey-10" />
              <MenuItem icon={Trash} label="Delete" danger onClick={() => { setMenu(false); onDelete() }} />
            </div>
          )}
        </div>
      </div>

      {postSnippet(post) && (
        <p className="mt-1 line-clamp-2 text-xs text-grey-50">
          {postSnippet(post)}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <PlatformIcons platforms={platforms} />
        {scheduled && (
          <span className="inline-flex items-center gap-1 text-xs text-grey-50">
            <Clock className="h-3 w-3" />
            {formatDateTime(scheduled)}
          </span>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-grey-5 " +
        (danger ? "text-rose-600" : "text-grey-70")
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------- List */

function ListView({
  posts,
  onOpen,
  onDelete,
}: {
  posts: MarketingPost[]
  onOpen: (p: MarketingPost) => void
  onDelete: (p: MarketingPost) => void
}) {
  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-grey-5 text-grey-50">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Title</th>
              <th className="px-5 py-3 text-left font-medium">Platforms</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Scheduled</th>
              <th className="px-5 py-3 text-left font-medium">Created</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-10">
            {posts.map((p) => {
              const scheduled = earliestScheduledAt(p)
              return (
                <tr key={p.id} className="hover:bg-grey-5">
                  <td className="px-5 py-3 font-medium text-grey-90">
                    <button onClick={() => onOpen(p)} className="text-left hover:underline">
                      {postLabel(p)}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <PlatformIcons platforms={postPlatforms(p)} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-grey-50">
                    {scheduled ? formatDateTime(scheduled) : "—"}
                  </td>
                  <td className="px-5 py-3 text-grey-50">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onOpen(p)}
                        className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(p)}
                        className="inline-flex items-center justify-center rounded-base border border-grey-20 p-1.5 text-grey-50 hover:bg-grey-5 hover:text-rose-600"
                        aria-label="Delete post"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Calendar */

function CalendarView({
  posts,
  onOpen,
}: {
  posts: MarketingPost[]
  onOpen: (p: MarketingPost) => void
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const byDay = useMemo(() => {
    const map: Record<string, MarketingPost[]> = {}
    for (const p of posts) {
      const iso = postCalendarDate(p)
      if (!iso) continue
      const d = new Date(iso)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      ;(map[key] = map[key] || []).push(p)
    }
    return map
  }, [posts])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = firstDay.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const unscheduledCount = posts.filter((p) => !postCalendarDate(p)).length

  return (
    <div className="rounded-large border border-grey-20 bg-white p-4 shadow-borders-base">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-grey-90">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-base border border-grey-20 px-2 py-1 text-sm text-grey-70 hover:bg-grey-5"
          >
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <button
            onClick={() => {
              const d = new Date()
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
            }}
            className="rounded-base border border-grey-20 px-3 py-1 text-sm text-grey-70 hover:bg-grey-5"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-base border border-grey-20 px-2 py-1 text-sm text-grey-70 hover:bg-grey-5"
          >
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-base border border-grey-20 bg-grey-20 text-center text-xs font-medium text-grey-50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-grey-5 py-2">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-[96px] bg-grey-5/40" />
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          const dayPosts = byDay[key] || []
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
          return (
            <div
              key={i}
              className="min-h-[96px] bg-white p-1 text-left align-top"
            >
              <div
                className={
                  "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs " +
                  (isToday ? "bg-grey-90 text-white" : "text-grey-50")
                }
              >
                {date.getDate()}
              </div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((p) => {
                  const plats = postPlatforms(p)
                  const meta = plats[0] ? platformMeta(plats[0]) : null
                  const Icon = meta?.icon
                  return (
                    <button
                      key={p.id}
                      onClick={() => onOpen(p)}
                      className="flex w-full items-center gap-1 truncate rounded bg-grey-5 px-1.5 py-1 text-left text-[11px] text-grey-70 hover:bg-grey-10"
                      title={postLabel(p)}
                    >
                      {Icon && <Icon className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{postLabel(p)}</span>
                    </button>
                  )
                })}
                {dayPosts.length > 3 && (
                  <div className="px-1 text-[11px] text-grey-40">
                    +{dayPosts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {unscheduledCount > 0 && (
        <p className="mt-3 text-xs text-grey-50">
          {unscheduledCount} post{unscheduledCount === 1 ? "" : "s"} without a
          schedule are not shown on the calendar.
        </p>
      )}
    </div>
  )
}

/* --------------------------------------------------------- Schedule modal */

function ScheduleModal({
  post,
  onClose,
  onConfirm,
}: {
  post: MarketingPost
  onClose: () => void
  onConfirm: (whenIso: string | null, platformSubset: string[]) => void
}) {
  const platforms = postPlatforms(post)
  const [when, setWhen] = useState(toDatetimeLocal(earliestScheduledAt(post)))
  const [subset, setSubset] = useState<string[]>([])

  const toggle = (p: string) =>
    setSubset((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule post"
      description={`Set when "${postLabel(post)}" should publish.`}
      size="sm"
    >
      <div className="space-y-4">
        <FormField label="Publish at" hint="Local time.">
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </FormField>

        {platforms.length > 1 && (
          <FormField
            label="Platforms"
            hint="Leave empty to schedule all targets."
          >
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => {
                const meta = platformMeta(p)
                const Icon = meta.icon
                const active = subset.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggle(p)}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium " +
                      (active
                        ? "border-grey-90 bg-grey-90 text-white"
                        : "border-grey-20 text-grey-70 hover:bg-grey-5")
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </FormField>
        )}

        <div className="flex justify-end gap-2 border-t border-grey-20 pt-4">
          <button
            onClick={() => onConfirm(null, subset)}
            className="rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-70 hover:bg-grey-5"
          >
            Unschedule
          </button>
          <button
            onClick={() => onConfirm(fromDatetimeLocal(when), subset)}
            disabled={!when}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </div>
    </Modal>
  )
}
