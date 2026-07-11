/**
 * Marketing — Post Hub.
 *
 * Every draft, scheduled and published post in one place. Two views:
 *   - Board : a kanban grouped by status (Draft / Needs approval / Scheduled /
 *             Published / Failed). Cards are click-through to the detail screen.
 *   - List  : a flat table with the same data.
 *
 * API: GET /admin/marketing/posts → { posts, count }. Degrades gracefully when
 * the endpoint is missing or returns nothing.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  Calendar,
  PencilSquare,
  Plus,
  SquaresPlus,
} from "@medusajs/icons"
import { Button, Container, Text, clx } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PlatformChip } from "../_components/PlatformChip"
import { StatusBadge } from "../_components/StatusBadge"
import { EmptyState as UiEmptyState, PageHeader } from "../_components/ui-kit"
import {
  STATUS_COLUMNS,
  formatDateTime,
  listPosts,
  snippet,
  statusMeta,
  type Post,
  type PostStatus,
} from "../_components/lib"

type View = "board" | "list"

const PostHubPage = () => {
  const navigate = useNavigate()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>("board")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPosts({ limit: 200 })
      setPosts(data.posts ?? [])
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

  const grouped = useMemo(() => {
    const map: Record<PostStatus, Post[]> = {
      draft: [],
      needs_approval: [],
      scheduled: [],
      published: [],
      failed: [],
    }
    for (const p of posts) {
      const key = (
        STATUS_COLUMNS.includes(p.status as PostStatus) ? p.status : "draft"
      ) as PostStatus
      map[key].push(p)
    }
    return map
  }, [posts])

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="border-b border-ui-border-base">
        <PageHeader
          icon={SquaresPlus}
          accent="violet"
          title="Post Hub"
          subtitle="Every draft, scheduled and published post across your channels."
          actions={
            <>
              <div className="flex items-center gap-x-0.5 rounded-lg bg-ui-bg-subtle p-0.5">
                <Button
                  size="small"
                  variant={view === "board" ? "primary" : "transparent"}
                  onClick={() => setView("board")}
                >
                  <SquaresPlus />
                  Board
                </Button>
                <Button
                  size="small"
                  variant={view === "list" ? "primary" : "transparent"}
                  onClick={() => setView("list")}
                >
                  <ListBulletInline />
                  List
                </Button>
              </div>
              <Button size="small" variant="transparent" onClick={load}>
                <ArrowPath />
              </Button>
              <Button size="small" onClick={() => navigate("/marketing/compose")}>
                <Plus />
                Compose
              </Button>
            </>
          }
        />
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {loading ? (
          <Text className="text-ui-fg-subtle">Loading posts…</Text>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : posts.length === 0 ? (
          <EmptyState onCompose={() => navigate("/marketing/compose")} />
        ) : view === "board" ? (
          <Board
            grouped={grouped}
            onOpen={(id) => navigate(`/marketing/posts/${id}`)}
          />
        ) : (
          <List
            posts={posts}
            onOpen={(id) => navigate(`/marketing/posts/${id}`)}
          />
        )}
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

function Board({
  grouped,
  onOpen,
}: {
  grouped: Record<PostStatus, Post[]>
  onOpen: (id: string) => void
}) {
  return (
    <div className="flex gap-x-4 overflow-x-auto pb-2">
      {STATUS_COLUMNS.map((status) => {
        const items = grouped[status]
        const meta = statusMeta(status)
        return (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col gap-y-3 rounded-lg bg-ui-bg-subtle p-3"
          >
            <div className="flex items-center gap-x-2">
              <StatusBadge status={status} />
              <Text size="xsmall" className="text-ui-fg-muted">
                {items.length}
              </Text>
            </div>
            <div className="flex flex-col gap-y-2">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-ui-border-base px-3 py-6 text-center">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Nothing {meta.label.toLowerCase()}
                  </Text>
                </div>
              ) : (
                items.map((p) => (
                  <PostCard key={p.id} post={p} onOpen={() => onOpen(p.id)} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const platforms = post.platforms ?? []
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2.5 text-left shadow-elevation-card-rest transition-colors hover:bg-ui-bg-base-hover"
    >
      <div className="flex flex-wrap items-center gap-1">
        {platforms.length ? (
          platforms
            .slice(0, 4)
            .map((pl) => <PlatformChip key={pl} platform={pl} />)
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted">
            No channels
          </Text>
        )}
        {platforms.length > 4 && (
          <Text size="xsmall" className="text-ui-fg-muted">
            +{platforms.length - 4}
          </Text>
        )}
      </div>
      <Text size="small" className="line-clamp-3">
        {snippet(post.content, 120) || (
          <span className="italic text-ui-fg-muted">No content yet</span>
        )}
      </Text>
      {post.scheduled_at && (
        <div className="flex items-center gap-x-1 text-ui-fg-muted">
          <Calendar />
          <Text size="xsmall">{formatDateTime(post.scheduled_at)}</Text>
        </div>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

function List({
  posts,
  onOpen,
}: {
  posts: Post[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base">
      <div className="hidden grid-cols-12 gap-x-4 border-b border-ui-border-base bg-ui-bg-subtle px-4 py-2 md:grid">
        <Text size="xsmall" weight="plus" className="col-span-5 text-ui-fg-muted">
          Content
        </Text>
        <Text size="xsmall" weight="plus" className="col-span-3 text-ui-fg-muted">
          Channels
        </Text>
        <Text size="xsmall" weight="plus" className="col-span-2 text-ui-fg-muted">
          Status
        </Text>
        <Text size="xsmall" weight="plus" className="col-span-2 text-ui-fg-muted">
          Scheduled
        </Text>
      </div>
      <div className="flex flex-col divide-y divide-ui-border-base">
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className="grid grid-cols-1 gap-y-2 bg-ui-bg-base px-4 py-3 text-left transition-colors hover:bg-ui-bg-base-hover md:grid-cols-12 md:gap-x-4 md:gap-y-0"
          >
            <div className="md:col-span-5">
              <Text size="small" className="line-clamp-2">
                {snippet(p.content, 120) || (
                  <span className="italic text-ui-fg-muted">No content</span>
                )}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-1 md:col-span-3">
              {(p.platforms ?? []).slice(0, 4).map((pl) => (
                <PlatformChip key={pl} platform={pl} />
              ))}
            </div>
            <div className="md:col-span-2">
              <StatusBadge status={p.status} />
            </div>
            <div className="md:col-span-2">
              <Text size="xsmall" className="text-ui-fg-muted">
                {p.scheduled_at ? formatDateTime(p.scheduled_at) : "—"}
              </Text>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* States + inline icon                                                */
/* ------------------------------------------------------------------ */

function EmptyState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-ui-border-strong">
      <UiEmptyState
        icon={SquaresPlus}
        accent="violet"
        title="No posts yet"
        description="Compose your first post and it will show up here."
        action={
          <Button size="small" onClick={onCompose}>
            <PencilSquare />
            Compose
          </Button>
        }
      />
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-error px-6 py-16 text-center">
      <Text weight="plus">Could not load posts</Text>
      <Text size="small" className="text-ui-fg-subtle">
        {message}
      </Text>
      <Button size="small" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

/* @medusajs/icons has no plain list-bullet glyph, so draw a tiny one. */
function ListBulletInline() {
  return (
    <span
      className={clx(
        "inline-flex h-3.5 w-3.5 flex-col justify-between py-[3px]"
      )}
      aria-hidden
    >
      <span className="block h-[2px] w-full rounded-full bg-current" />
      <span className="block h-[2px] w-full rounded-full bg-current" />
      <span className="block h-[2px] w-full rounded-full bg-current" />
    </span>
  )
}

export const config = defineRouteConfig({
  label: "Post Hub",
  icon: SquaresPlus,
})

export default PostHubPage
