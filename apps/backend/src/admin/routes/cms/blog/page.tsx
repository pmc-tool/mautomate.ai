/**
 * Forever Finds CMS — Blog Posts list (Phase 8).
 *
 * Lists blog posts (status / date / categories), with create + delete, linking
 * each row to the post editor at /cms/blog/posts/:id. Registered as "Blog" under
 * the "Site Management" group (parent route /cms).
 *
 * API: GET /admin/cms/blog/posts, POST /admin/cms/blog/posts,
 *      DELETE /admin/cms/blog/posts/:id  (all cookie-session, /admin/cms/* guard).
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Newspaper, Plus, Tag, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Text,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  createPost,
  deletePost,
  formatDate,
  listCategories,
  listPosts,
  slugify,
  STATUS_BADGE,
  type BlogCategory,
  type BlogPostRow,
  type BlogPostStatus,
} from "./lib"

const PAGE_SIZE = 50

const BlogPostsListPage = () => {
  const navigate = useNavigate()
  const dialog = usePrompt()

  const [posts, setPosts] = useState<BlogPostRow[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<BlogPostStatus | "">("")
  const [categoryId, setCategoryId] = useState<string>("")

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      const nextOffset = opts?.offset ?? 0
      try {
        const data = await listPosts({
          q: query,
          status,
          category_id: categoryId || undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setPosts(data.posts ?? [])
        setCount(data.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        toast.error("Could not load posts", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setLoading(false)
      }
    },
    [query, status, categoryId]
  )

  useEffect(() => {
    load({ offset: 0 })
  }, [load])

  // Category filter options (best-effort — failure just hides the filter).
  useEffect(() => {
    listCategories()
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]))
  }, [])

  const remove = async (p: BlogPostRow) => {
    const ok = await dialog({
      title: "Delete post",
      description: `"${p.title}" will be removed. This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deletePost(p.id)
      toast.success("Post deleted")
      setPosts((prev) => prev.filter((x) => x.id !== p.id))
      setCount((c) => Math.max(0, c - 1))
    } catch (e: any) {
      toast.error("Could not delete post", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < count
  const rangeStart = count === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, count)
  const hasFilters = !!query || !!status || !!categoryId

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Blog</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Write and publish blog posts for the storefront.
          </Text>
        </div>
        <Button size="small" onClick={() => setCreateOpen(true)}>
          <Plus />
          New post
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-y-3 border-b border-ui-border-base px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
            {(
              [
                { value: "", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ] as const
            ).map((s) => (
              <Button
                key={s.value || "all"}
                size="small"
                variant={status === s.value ? "primary" : "transparent"}
                onClick={() => setStatus(s.value as BlogPostStatus | "")}
              >
                {s.label}
              </Button>
            ))}
          </div>
          {categories.length > 0 && (
            <div className="w-48">
              <Select
                value={categoryId || "__all__"}
                onValueChange={(v) => setCategoryId(v === "__all__" ? "" : v)}
              >
                <Select.Trigger>
                  <Select.Value placeholder="All categories" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="__all__">All categories</Select.Item>
                  {categories.map((c) => (
                    <Select.Item key={c.id} value={c.id}>
                      {c.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          )}
        </div>
        <form
          className="flex items-center gap-x-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(search)
          }}
        >
          <Input
            size="small"
            placeholder="Search title or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <Button type="submit" size="small" variant="secondary">
            Search
          </Button>
          {query && (
            <Button
              type="button"
              size="small"
              variant="transparent"
              onClick={() => {
                setSearch("")
                setQuery("")
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {loading ? (
          <ListSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onCreate={() => setCreateOpen(true)}
          />
        ) : (
          <>
            <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
              {posts.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  onOpen={() => navigate(`/cms/blog/posts/${p.id}`)}
                  onDelete={() => remove(p)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {rangeStart}–{rangeEnd} of {count}
              </Text>
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasPrev}
                  onClick={() => load({ offset: offset - PAGE_SIZE })}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasNext}
                  onClick={() => load({ offset: offset + PAGE_SIZE })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {createOpen && (
        <CreatePostDrawer
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            navigate(`/cms/blog/posts/${id}`)
          }}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function PostRow({
  post,
  onOpen,
  onDelete,
}: {
  post: BlogPostRow
  onOpen: () => void
  onDelete: () => void
}) {
  const badge = STATUS_BADGE[post.status]
  const cats = post.categories ?? []
  const dateLabel =
    post.status === "published" && post.published_at
      ? `Published ${formatDate(post.published_at)}`
      : post.scheduled_at
      ? `Scheduled ${formatDate(post.scheduled_at)}`
      : `Updated ${formatDate(post.updated_at)}`

  return (
    <div className="flex items-center gap-x-4 bg-ui-bg-base px-4 py-3 transition-colors hover:bg-ui-bg-base-hover">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-x-3 text-left"
      >
        <div className="h-11 w-16 shrink-0 overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-subtle">
          {post.cover_image ? (
            <img
              src={post.cover_image}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ui-fg-muted">
              <Newspaper />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-y-0.5">
          <Text size="small" weight="plus" className="truncate">
            {post.title}
          </Text>
          <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
            /{post.slug}
          </Text>
          {cats.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {cats.slice(0, 3).map((c) => (
                <Badge key={c.id} size="2xsmall" className="gap-x-0.5">
                  <Tag className="text-ui-fg-muted" />
                  {c.name}
                </Badge>
              ))}
              {cats.length > 3 && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  +{cats.length - 3}
                </Text>
              )}
            </div>
          )}
        </div>
      </button>

      <Badge size="2xsmall" color={badge.color}>
        {badge.label}
      </Badge>
      <Text
        size="xsmall"
        className="hidden w-40 text-right text-ui-fg-muted lg:block"
      >
        {dateLabel}
      </Text>
      <div className="flex items-center gap-x-1">
        <Button size="small" variant="secondary" onClick={onOpen}>
          Edit
        </Button>
        <Tooltip content="Delete post">
          <IconButton size="small" variant="transparent" onClick={onDelete}>
            <Trash />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Create drawer                                                       */
/* ------------------------------------------------------------------ */

function CreatePostDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const derivedSlug = useMemo(
    () => (slugTouched ? slug : slugify(title)),
    [slug, slugTouched, title]
  )

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    setSaving(true)
    try {
      const { post } = await createPost({
        title: title.trim(),
        slug: derivedSlug || undefined,
        status: "draft",
      })
      toast.success("Post created", { description: `/${post.slug}` })
      onCreated(post.id)
    } catch (e: any) {
      toast.error("Could not create post", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>New blog post</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Title
            </Label>
            <Input
              autoFocus
              value={title}
              placeholder="The art of handmade gifts"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Slug
            </Label>
            <Input
              value={derivedSlug}
              placeholder="the-art-of-handmade-gifts"
              className="font-mono"
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              The storefront URL (/blog/&lt;slug&gt;). Leave to auto-derive from
              the title.
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={submit} isLoading={saving}>
            Create
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */
/* Empty / loading                                                     */
/* ------------------------------------------------------------------ */

function EmptyState({
  hasFilters,
  onCreate,
}: {
  hasFilters: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <Newspaper />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">
          {hasFilters ? "No posts match" : "No posts yet"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasFilters
            ? "Try a different search, status or category filter."
            : "Write your first blog post to get started."}
        </Text>
      </div>
      {!hasFilters && (
        <Button size="small" onClick={onCreate}>
          <Plus />
          New post
        </Button>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-x-4 px-4 py-3">
          <div className="h-11 w-16 animate-pulse rounded-md bg-ui-bg-subtle" />
          <div className="flex flex-1 flex-col gap-y-1.5">
            <div className="h-3 w-48 animate-pulse rounded bg-ui-bg-subtle" />
            <div className="h-2.5 w-28 animate-pulse rounded bg-ui-bg-subtle" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-ui-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Blog",
  icon: Newspaper,
})

export default BlogPostsListPage
