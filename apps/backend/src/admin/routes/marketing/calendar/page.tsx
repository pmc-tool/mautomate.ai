/**
 * Marketing — Content Calendar.
 *
 * A month grid (with a Week toggle) that places scheduled posts on the day they
 * go out, color-coded by channel. Each post is a Popover trigger showing a small
 * detail card with a reschedule control (POST /schedule) and a link into the
 * post. Empty days surface a subtle "gap" hint so you can spot quiet stretches.
 *
 * Store values are UTC ISO strings; every display and bucketing uses the local
 * timezone (new Date(iso) is local), and the reschedule control converts the
 * local datetime-local value back to UTC before sending.
 *
 * API: GET /admin/marketing/posts?status=scheduled,
 *      POST /admin/marketing/posts/:id/schedule { scheduled_at }.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Funnel,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Input,
  Popover,
  Select,
  Tabs,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BrandGlyph } from "../_components/brand-icons"
import { PageHeader } from "../_components/ui-kit"

/* ------------------------------------------------------------------ */
/* Types + data layer (self-contained to avoid cross-route coupling)   */
/* ------------------------------------------------------------------ */

type PostTarget = {
  id?: string
  platform?: string | null
  channel?: string | null
  scheduled_at?: string | null
  status?: string | null
}

type Post = {
  id: string
  status?: string | null
  title?: string | null
  name?: string | null
  content?: string | null
  body?: string | null
  caption?: string | null
  channel?: string | null
  platform?: string | null
  scheduled_at?: string | null
  targets?: PostTarget[] | null
  created_at?: string
  updated_at?: string
}

async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.join("; ") : "") ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

function listScheduledPosts(): Promise<{ posts?: Post[]; data?: Post[] }> {
  return api(`/admin/marketing/posts?status=scheduled&limit=200`)
}

function reschedulePost(
  id: string,
  scheduledAt: string
): Promise<{ post?: Post }> {
  return api(`/admin/marketing/posts/${id}/schedule`, {
    method: "POST",
    json: { scheduled_at: scheduledAt },
  })
}

/* ------------------------------------------------------------------ */
/* Channel presentation                                                */
/* ------------------------------------------------------------------ */

// Inline hex (not Tailwind class names) because the admin's JIT build won't
// generate classes built from runtime channel strings.
const CHANNEL_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  twitter: "#1DA1F2",
  x: "#0F172A",
  linkedin: "#0A66C2",
  tiktok: "#EE1D52",
  youtube: "#FF0000",
  pinterest: "#E60023",
  email: "#7C3AED",
  blog: "#059669",
  threads: "#0F172A",
  whatsapp: "#25D366",
}

const channelColor = (channel: string): string =>
  CHANNEL_COLORS[channel.toLowerCase()] ?? "#6B7280"

const titleCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s

/* ------------------------------------------------------------------ */
/* Date helpers (local timezone)                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`

const isSameDay = (a: Date, b: Date): boolean => dayKey(a) === dayKey(b)

const formatDayTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

const formatFull = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

// Turn a UTC ISO string into the value a datetime-local input expects (local).
const isoToLocalInput = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

type CalEvent = {
  key: string
  postId: string
  title: string
  channel: string
  scheduledAt: string
  status: string
}

const postTitle = (p: Post): string => {
  const t = p.title || p.name
  if (t) return t
  const body = p.content || p.body || p.caption
  if (body) return body.length > 60 ? `${body.slice(0, 60)}…` : body
  return "Untitled post"
}

const buildEvents = (posts: Post[]): CalEvent[] => {
  const out: CalEvent[] = []
  for (const p of posts) {
    const targets = Array.isArray(p.targets) ? p.targets : []
    const scheduledTargets = targets.filter((t) => t.scheduled_at)
    if (scheduledTargets.length) {
      scheduledTargets.forEach((t, i) => {
        out.push({
          key: `${p.id}:${t.id ?? i}`,
          postId: p.id,
          title: postTitle(p),
          channel: (t.platform || t.channel || p.channel || p.platform || "other")
            .toString()
            .toLowerCase(),
          scheduledAt: t.scheduled_at as string,
          status: (t.status || p.status || "scheduled").toString(),
        })
      })
    } else if (p.scheduled_at) {
      out.push({
        key: p.id,
        postId: p.id,
        title: postTitle(p),
        channel: (p.channel || p.platform || "other").toString().toLowerCase(),
        scheduledAt: p.scheduled_at,
        status: (p.status || "scheduled").toString(),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const CalendarPage = () => {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<"month" | "week">("month")
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [channelFilter, setChannelFilter] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listScheduledPosts()
      setPosts(data.posts ?? data.data ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.")
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const allEvents = useMemo(() => buildEvents(posts ?? []), [posts])

  const channels = useMemo(() => {
    const set = new Set<string>()
    allEvents.forEach((e) => set.add(e.channel))
    return Array.from(set).sort()
  }, [allEvents])

  const events = useMemo(
    () =>
      channelFilter === "all"
        ? allEvents
        : allEvents.filter((e) => e.channel === channelFilter),
    [allEvents, channelFilter]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) {
      const d = new Date(e.scheduledAt)
      if (isNaN(d.getTime())) continue
      const key = dayKey(d)
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
    }
    return map
  }, [events])

  const shift = (dir: -1 | 1) => {
    setCursor((cur) => {
      const next = new Date(cur)
      if (view === "month") {
        next.setMonth(next.getMonth() + dir)
      } else {
        next.setDate(next.getDate() + dir * 7)
      }
      return next
    })
  }

  const heading = useMemo(() => {
    if (view === "month") {
      return cursor.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      })
    }
    const start = new Date(cursor)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(
      undefined,
      { ...opts, year: "numeric" }
    )}`
  }, [view, cursor])

  return (
    <Container className="p-0">
      {/* Top bar */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base pb-4">
        <PageHeader
          icon={CalendarIcon}
          accent="blue"
          title="Calendar"
          subtitle="See and reschedule what goes out, and when. Times are shown in your local timezone."
        />

        <div className="flex flex-col gap-y-3 px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-x-2">
            <IconBtn ariaLabel="Previous" onClick={() => shift(-1)}>
              <ChevronLeft />
            </IconBtn>
            <Text weight="plus" className="min-w-[10rem] text-center">
              {heading}
            </Text>
            <IconBtn ariaLabel="Next" onClick={() => shift(1)}>
              <ChevronRight />
            </IconBtn>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setCursor(new Date())}
            >
              Today
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-x-2">
              <Funnel className="text-ui-fg-muted" />
              <Select
                size="small"
                value={channelFilter}
                onValueChange={setChannelFilter}
              >
                <Select.Trigger className="min-w-[9rem]">
                  <Select.Value placeholder="All channels" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All channels</Select.Item>
                  {channels.map((c) => (
                    <Select.Item key={c} value={c}>
                      {titleCase(c)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <Tabs
              value={view}
              onValueChange={(v) => setView(v as "month" | "week")}
            >
              <Tabs.List>
                <Tabs.Trigger value="month">Month</Tabs.Trigger>
                <Tabs.Trigger value="week">Week</Tabs.Trigger>
              </Tabs.List>
            </Tabs>

            <Button
              size="small"
              variant="secondary"
              onClick={load}
              isLoading={loading}
            >
              <ArrowPath />
              Refresh
            </Button>
          </div>
        </div>

        {channels.length > 0 && (
          <div className="px-6">
            <ChannelLegend channels={channels} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {error ? (
          <div className="flex flex-col items-start gap-y-3 py-10">
            <Text weight="plus">Could not load the calendar</Text>
            <Text size="small" className="text-ui-fg-subtle">
              {error}
            </Text>
            <Button size="small" variant="secondary" onClick={load}>
              <ArrowPath />
              Retry
            </Button>
          </div>
        ) : loading && !posts ? (
          <Text className="py-10 text-ui-fg-subtle">Loading calendar…</Text>
        ) : view === "month" ? (
          <MonthGrid
            cursor={cursor}
            eventsByDay={eventsByDay}
            onRescheduled={load}
          />
        ) : (
          <WeekGrid
            cursor={cursor}
            eventsByDay={eventsByDay}
            onRescheduled={load}
          />
        )}
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Month grid                                                          */
/* ------------------------------------------------------------------ */

function MonthGrid({
  cursor,
  eventsByDay,
  onRescheduled,
}: {
  cursor: Date
  eventsByDay: Map<string, CalEvent[]>
  onRescheduled: () => void
}) {
  const today = new Date()
  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const gridStart = useMemo(() => {
    const first = new Date(year, month, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return start
  }, [year, month])

  const days = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [gridStart])

  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base">
      <div className="grid grid-cols-7 border-b border-ui-border-base bg-ui-bg-subtle">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center">
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
              {w}
            </Text>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month
          const dayEvents = eventsByDay.get(dayKey(d)) ?? []
          const isToday = isSameDay(d, today)
          return (
            <div
              key={i}
              className={`flex min-h-[7rem] flex-col gap-y-1 border-b border-r border-ui-border-base p-1.5 ${
                (i + 1) % 7 === 0 ? "border-r-0" : ""
              } ${inMonth ? "bg-ui-bg-base" : "bg-ui-bg-subtle/40"}`}
            >
              <div className="flex items-center justify-between px-0.5">
                <Text
                  size="xsmall"
                  weight={isToday ? "plus" : "regular"}
                  className={
                    isToday
                      ? "flex size-5 items-center justify-center rounded-full bg-ui-bg-interactive text-ui-fg-on-color"
                      : inMonth
                        ? "text-ui-fg-subtle"
                        : "text-ui-fg-muted"
                  }
                >
                  {d.getDate()}
                </Text>
              </div>

              <div className="flex flex-col gap-y-1">
                {dayEvents.map((e) => (
                  <EventChip
                    key={e.key}
                    event={e}
                    onRescheduled={onRescheduled}
                  />
                ))}
                {dayEvents.length === 0 && inMonth && (
                  <span className="mt-1 rounded-md border border-dashed border-ui-border-strong/40 px-1.5 py-0.5 text-[10px] text-ui-fg-muted">
                    Gap — nothing scheduled
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Week grid                                                           */
/* ------------------------------------------------------------------ */

function WeekGrid({
  cursor,
  eventsByDay,
  onRescheduled,
}: {
  cursor: Date
  eventsByDay: Map<string, CalEvent[]>
  onRescheduled: () => void
}) {
  const today = new Date()
  const start = useMemo(() => {
    const s = new Date(cursor)
    s.setDate(s.getDate() - s.getDay())
    s.setHours(0, 0, 0, 0)
    return s
  }, [cursor])

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return d
      }),
    [start]
  )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d, i) => {
        const dayEvents = eventsByDay.get(dayKey(d)) ?? []
        const isToday = isSameDay(d, today)
        return (
          <div
            key={i}
            className="flex min-h-[10rem] flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-base p-2"
          >
            <div className="flex items-center justify-between border-b border-ui-border-base pb-1.5">
              <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
                {WEEKDAYS[d.getDay()]}
              </Text>
              <Text
                size="xsmall"
                weight={isToday ? "plus" : "regular"}
                className={
                  isToday
                    ? "flex size-5 items-center justify-center rounded-full bg-ui-bg-interactive text-ui-fg-on-color"
                    : "text-ui-fg-subtle"
                }
              >
                {d.getDate()}
              </Text>
            </div>
            <div className="flex flex-col gap-y-1.5">
              {dayEvents.length === 0 ? (
                <span className="rounded-md border border-dashed border-ui-border-strong/40 px-2 py-1 text-[10px] text-ui-fg-muted">
                  Gap — nothing scheduled
                </span>
              ) : (
                dayEvents.map((e) => (
                  <EventChip
                    key={e.key}
                    event={e}
                    onRescheduled={onRescheduled}
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

/* ------------------------------------------------------------------ */
/* Event chip + detail popover                                         */
/* ------------------------------------------------------------------ */

function EventChip({
  event,
  onRescheduled,
}: {
  event: CalEvent
  onRescheduled: () => void
}) {
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState(() => isoToLocalInput(event.scheduledAt))
  const [saving, setSaving] = useState(false)
  const color = channelColor(event.channel)

  const save = async () => {
    if (!when) {
      toast.error("Pick a date and time")
      return
    }
    const iso = new Date(when).toISOString()
    setSaving(true)
    try {
      await reschedulePost(event.postId, iso)
      toast.success("Post rescheduled", { description: formatFull(iso) })
      setOpen(false)
      onRescheduled()
    } catch (e: any) {
      toast.error("Could not reschedule", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-x-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-ui-bg-base-hover"
          style={{ backgroundColor: `${color}14`, borderLeft: `3px solid ${color}` }}
        >
          <span className="flex shrink-0 items-center">
            <BrandGlyph platform={event.channel} size={12} />
          </span>
          <span className="truncate text-[11px] leading-tight text-ui-fg-base">
            {formatDayTime(event.scheduledAt)} · {event.title}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-80 p-4" side="right" align="start">
        <div className="flex flex-col gap-y-3">
          <div className="flex items-start justify-between gap-x-2">
            <div className="flex min-w-0 flex-col gap-y-0.5">
              <Text size="small" weight="plus" className="truncate">
                {event.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {formatFull(event.scheduledAt)}
              </Text>
            </div>
            <span
              className="mt-0.5 inline-flex shrink-0 items-center gap-x-1 rounded-full px-2 py-0.5 text-[10px]"
              style={{ backgroundColor: `${color}1f`, color }}
            >
              <BrandGlyph platform={event.channel} size={11} />
              {titleCase(event.channel)}
            </span>
          </div>

          <div className="flex items-center gap-x-2">
            <Badge size="2xsmall" color="grey">
              {event.status}
            </Badge>
          </div>

          <div className="flex flex-col gap-y-1.5 border-t border-ui-border-base pt-3">
            <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
              Reschedule
            </Text>
            <Input
              type="datetime-local"
              size="small"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <div className="mt-1 flex items-center justify-between gap-x-2">
              <Link
                to={`/marketing/posts/${event.postId}`}
                className="text-xs text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              >
                Open post
              </Link>
              <Button size="small" onClick={save} isLoading={saving}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  )
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function ChannelLegend({ channels }: { channels: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {channels.map((c) => (
        <div key={c} className="flex items-center gap-x-1.5">
          <BrandGlyph platform={c} size={13} />
          <Text size="xsmall" className="text-ui-fg-muted">
            {titleCase(c)}
          </Text>
        </div>
      ))}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-subtle transition-colors hover:bg-ui-bg-base-hover"
    >
      {children}
    </button>
  )
}

export const config = defineRouteConfig({
  label: "Calendar",
  icon: CalendarIcon,
})

export default CalendarPage
