/**
 * Marketing — Approvals queue.
 *
 * A reviewer inbox: posts awaiting sign-off (status "needs_approval") list on the
 * left; selecting one opens a preview + full content on the right with the three
 * review actions — Approve, Request changes / Reject, and Rework with AI (a free
 * text instruction handed to the model). A lightweight notes area is included; it
 * best-effort persists via the post update endpoint and degrades gracefully when
 * that endpoint isn't present yet.
 *
 * API: GET  /admin/marketing/posts?status=needs_approval
 *      POST /admin/marketing/posts/:id/approve { action: "approve" | "reject" }
 *      POST /admin/marketing/posts/:id/rework  { instruction }
 *      POST /admin/marketing/posts/:id         { notes }        (best-effort)
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  CheckCircleSolid,
  Sparkles,
  ThumbUp,
  XCircle,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BrandBadge } from "../_components/brand-icons"
import { EmptyState as UiEmptyState, PageHeader } from "../_components/ui-kit"

/* ------------------------------------------------------------------ */
/* Types + data layer                                                  */
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
  media?: any[] | null
  image_url?: string | null
  notes?: string | null
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

function listNeedsApproval(): Promise<{ posts?: Post[]; data?: Post[] }> {
  return api(`/admin/marketing/posts?status=needs_approval&limit=200`)
}

function reviewPost(
  id: string,
  action: "approve" | "reject"
): Promise<{ post?: Post }> {
  return api(`/admin/marketing/posts/${id}/approve`, {
    method: "POST",
    json: { action },
  })
}

function reworkPost(
  id: string,
  instruction: string
): Promise<{ post?: Post }> {
  return api(`/admin/marketing/posts/${id}/rework`, {
    method: "POST",
    json: { instruction },
  })
}

// TODO: replace with the dedicated notes endpoint once the backend exposes one.
// For now we best-effort write notes through the generic post update route and
// swallow a 404/405 so the reviewer UX still works without it.
function saveNotes(id: string, notes: string): Promise<{ post?: Post }> {
  return api(`/admin/marketing/posts/${id}`, {
    method: "POST",
    json: { notes },
  })
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

const postTitle = (p: Post): string => {
  const t = p.title || p.name
  if (t) return t
  const body = p.content || p.body || p.caption
  if (body) return body.length > 60 ? `${body.slice(0, 60)}…` : body
  return "Untitled post"
}

const postBody = (p: Post): string =>
  p.content || p.body || p.caption || ""

const postChannels = (p: Post): string[] => {
  const set = new Set<string>()
  ;(p.targets ?? []).forEach((t) => {
    const c = t.platform || t.channel
    if (c) set.add(c.toString())
  })
  if (p.channel) set.add(p.channel)
  if (p.platform) set.add(p.platform)
  return Array.from(set)
}

const postImage = (p: Post): string | null => {
  if (p.image_url) return p.image_url
  const m = Array.isArray(p.media) ? p.media[0] : null
  if (!m) return null
  if (typeof m === "string") return m
  return m.url || m.image_url || m.src || null
}

const formatDate = (iso?: string | null): string => {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const ApprovalsPage = () => {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listNeedsApproval()
      const list = data.posts ?? data.data ?? []
      setPosts(list)
      setSelectedId((cur) => {
        if (cur && list.some((p) => p.id === cur)) return cur
        return list[0]?.id ?? null
      })
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

  const selected = useMemo(
    () => (posts ?? []).find((p) => p.id === selectedId) ?? null,
    [posts, selectedId]
  )

  // Remove a post from the queue once it's been actioned.
  const removeFromQueue = (id: string) => {
    setPosts((cur) => {
      const next = (cur ?? []).filter((p) => p.id !== id)
      setSelectedId((sel) => (sel === id ? next[0]?.id ?? null : sel))
      return next
    })
  }

  return (
    <Container className="p-0">
      <div className="border-b border-ui-border-base">
        <PageHeader
          icon={CheckCircleSolid}
          accent="amber"
          title="Approvals"
          subtitle="Review posts waiting for sign-off before they go out."
          actions={
            <>
              {posts && posts.length > 0 && (
                <Badge size="2xsmall" color="orange">
                  {posts.length} pending
                </Badge>
              )}
              <Button
                size="small"
                variant="secondary"
                onClick={load}
                isLoading={loading}
              >
                <ArrowPath />
                Refresh
              </Button>
            </>
          }
        />
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text weight="plus">Could not load the queue</Text>
          <Text size="small" className="text-ui-fg-subtle">
            {error}
          </Text>
          <Button size="small" variant="secondary" onClick={load}>
            <ArrowPath />
            Retry
          </Button>
        </div>
      ) : loading && !posts ? (
        <Text className="px-6 py-12 text-ui-fg-subtle">Loading queue…</Text>
      ) : (posts ?? []).length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr]">
          {/* Queue list */}
          <div className="flex flex-col divide-y divide-ui-border-base border-b border-ui-border-base lg:border-b-0 lg:border-r">
            {(posts ?? []).map((p) => {
              const active = p.id === selectedId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex flex-col gap-y-1 px-4 py-3 text-left transition-colors ${
                    active
                      ? "bg-ui-bg-base-pressed"
                      : "bg-ui-bg-base hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <Text size="small" weight="plus" className="truncate">
                    {postTitle(p)}
                  </Text>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {postChannels(p).slice(0, 3).map((c) => (
                      <BrandBadge key={c} platform={c} label size={12} />
                    ))}
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {formatDate(p.created_at)}
                    </Text>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Review pane */}
          <div className="p-6">
            {selected ? (
              <ReviewPane
                key={selected.id}
                post={selected}
                onActioned={() => removeFromQueue(selected.id)}
              />
            ) : (
              <Text className="text-ui-fg-subtle">
                Select a post to review.
              </Text>
            )}
          </div>
        </div>
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Review pane                                                         */
/* ------------------------------------------------------------------ */

function ReviewPane({
  post,
  onActioned,
}: {
  post: Post
  onActioned: () => void
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | "rework" | null>(null)
  const [instruction, setInstruction] = useState("")
  const [notes, setNotes] = useState(post.notes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)

  const image = postImage(post)
  const body = postBody(post)
  const channels = postChannels(post)

  const review = async (action: "approve" | "reject") => {
    setBusy(action)
    try {
      await reviewPost(post.id, action)
      toast.success(
        action === "approve" ? "Post approved" : "Changes requested"
      )
      onActioned()
    } catch (e: any) {
      toast.error(
        action === "approve" ? "Could not approve" : "Could not reject",
        { description: e?.message ?? "Unexpected error." }
      )
    } finally {
      setBusy(null)
    }
  }

  const rework = async () => {
    if (!instruction.trim()) {
      toast.error("Describe what to change", {
        description: "Give the AI a short instruction to rework the post.",
      })
      return
    }
    setBusy("rework")
    try {
      await reworkPost(post.id, instruction.trim())
      toast.success("Sent back for a rework", {
        description: "The AI will revise this post per your instruction.",
      })
      setInstruction("")
      onActioned()
    } catch (e: any) {
      toast.error("Could not request a rework", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBusy(null)
    }
  }

  const persistNotes = async () => {
    setSavingNotes(true)
    try {
      await saveNotes(post.id, notes)
      toast.success("Notes saved")
    } catch (e: any) {
      // Endpoint may not exist yet — keep the note in the box and tell the user.
      toast.error("Notes not persisted", {
        description:
          e?.status === 404 || e?.status === 405
            ? "The notes endpoint isn't available yet — kept locally for now."
            : e?.message ?? "Unexpected error.",
      })
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      {/* Header */}
      <div className="flex flex-col gap-y-2">
        <div className="flex items-start justify-between gap-x-3">
          <Heading level="h3" className="min-w-0">
            {postTitle(post)}
          </Heading>
          <Link
            to={`/marketing/posts/${post.id}`}
            className="shrink-0 text-sm text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
          >
            Open post
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {channels.map((c) => (
            <BrandBadge key={c} platform={c} label size={13} />
          ))}
          <Text size="xsmall" className="text-ui-fg-muted">
            Created {formatDate(post.created_at)}
          </Text>
        </div>
      </div>

      {/* Preview + content */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-y-2">
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
            Preview
          </Text>
          <div className="flex min-h-[12rem] items-center justify-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="max-h-72 w-full object-cover"
              />
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                No media attached
              </Text>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-y-2">
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
            Content
          </Text>
          <div className="min-h-[12rem] whitespace-pre-wrap rounded-lg border border-ui-border-base bg-ui-bg-base p-3 text-sm text-ui-fg-base">
            {body || (
              <span className="text-ui-fg-muted">No copy yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-ui-border-base pt-4">
        <Button
          size="small"
          onClick={() => review("approve")}
          isLoading={busy === "approve"}
          disabled={!!busy && busy !== "approve"}
        >
          <CheckCircleSolid />
          Approve
        </Button>
        <Button
          size="small"
          variant="danger"
          onClick={() => review("reject")}
          isLoading={busy === "reject"}
          disabled={!!busy && busy !== "reject"}
        >
          <XCircle />
          Request changes
        </Button>
      </div>

      {/* Rework with AI */}
      <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-4">
        <div className="flex items-center gap-x-2">
          <Sparkles className="text-ui-fg-subtle" />
          <Text size="small" weight="plus">
            Rework with AI
          </Text>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          Describe what to change — the AI will revise the copy and send it back
          into the draft queue.
        </Text>
        <Textarea
          rows={3}
          value={instruction}
          placeholder="Make the tone warmer, shorten the caption, and add a clear call to action."
          onChange={(e) => setInstruction(e.target.value)}
        />
        <div className="flex justify-end">
          <Button
            size="small"
            variant="secondary"
            onClick={rework}
            isLoading={busy === "rework"}
            disabled={!!busy && busy !== "rework"}
          >
            <ThumbUp />
            Send for rework
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-4">
        <Text size="small" weight="plus">
          Reviewer notes
        </Text>
        <Textarea
          rows={3}
          value={notes}
          placeholder="Leave a note for whoever picks this up next…"
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end">
          <Button
            size="small"
            variant="secondary"
            onClick={persistNotes}
            isLoading={savingNotes}
          >
            Save notes
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <UiEmptyState
      icon={CheckCircleSolid}
      accent="amber"
      title="You're all caught up"
      description="Nothing is waiting for approval right now. Posts sent for review will show up here."
      action={
        <Link
          to="/marketing/compose"
          className="text-sm text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
        >
          Compose something new
        </Link>
      }
    />
  )
}

export const config = defineRouteConfig({
  label: "Approvals",
  icon: CheckCircleSolid,
})

export default ApprovalsPage
