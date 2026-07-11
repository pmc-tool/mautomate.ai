/**
 * Forever Finds CMS — Blog Authors (Phase 8).
 *
 * Simple management page for blog authors: list / create / edit / delete.
 * Fields: name, slug (auto-derived from name when blank), bio, avatar (via the
 * shared CMS ImagePicker / Media Library). Sits under the "Site Management"
 * group (parent route /cms).
 *
 * API CONTRACT (all under /admin/cms/blog/*, cookie-session auth, credentials:include,
 * behind the /admin/cms/* requireAuthenticatedAdmin guard):
 *   GET    /admin/cms/blog/authors?q&limit&offset -> { authors, count, limit, offset }
 *   POST   /admin/cms/blog/authors  { name, slug?, bio?, avatar? } -> 201 { author }
 *   GET    /admin/cms/blog/authors/:id            -> { author }
 *   PUT    /admin/cms/blog/authors/:id  { name?, slug?, bio?, avatar? } -> { author }
 *   DELETE /admin/cms/blog/authors/:id            -> { id, object, deleted }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Pencil, Plus, Trash, User } from "@medusajs/icons"
import {
  Button,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  Textarea,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ImagePicker } from "../../../../components/cms/image-picker"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type CmsAuthor = {
  id: string
  name: string
  slug: string
  bio: string | null
  avatar: string | null
  created_at?: string
  updated_at?: string
}

const PAGE_SIZE = 50

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const BlogAuthorsPage = () => {
  const dialog = usePrompt()

  const [authors, setAuthors] = useState<CmsAuthor[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  // null = closed; "new" = create; object = edit
  const [editing, setEditing] = useState<CmsAuthor | "new" | null>(null)

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      const nextOffset = opts?.offset ?? 0
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(nextOffset))
      if (query.trim()) params.set("q", query.trim())
      try {
        const res = await fetch(`/admin/cms/blog/authors?${params.toString()}`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error(`Failed to load authors (${res.status})`)
        const data = await res.json()
        setAuthors((data?.authors ?? []) as CmsAuthor[])
        setCount(data?.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        toast.error("Could not load authors", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  useEffect(() => {
    load({ offset: 0 })
  }, [load])

  const remove = async (a: CmsAuthor) => {
    const ok = await dialog({
      title: "Delete author",
      description: `"${a.name}" will be removed. Posts written by this author lose their byline.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      const res = await fetch(`/admin/cms/blog/authors/${a.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Delete failed (${res.status})`)
      }
      toast.success("Author deleted")
      setAuthors((prev) => prev.filter((x) => x.id !== a.id))
      setCount((n) => Math.max(0, n - 1))
    } catch (e: any) {
      toast.error("Could not delete author", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < count
  const rangeStart = count === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, count)

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Blog Authors</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            People credited as the byline on blog posts.
          </Text>
        </div>
        <Button size="small" onClick={() => setEditing("new")}>
          <Plus />
          New author
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-y-3 border-b border-ui-border-base px-6 py-3 lg:flex-row lg:items-center lg:justify-end">
        <form
          className="flex items-center gap-x-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(search)
          }}
        >
          <Input
            size="small"
            placeholder="Search name or slug…"
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
        ) : authors.length === 0 ? (
          <EmptyState hasQuery={!!query} onCreate={() => setEditing("new")} />
        ) : (
          <>
            <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
              {authors.map((a) => (
                <AuthorRow
                  key={a.id}
                  author={a}
                  onEdit={() => setEditing(a)}
                  onDelete={() => remove(a)}
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

      {editing && (
        <AuthorDrawer
          author={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load({ offset })
          }}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function AuthorRow({
  author,
  onEdit,
  onDelete,
}: {
  author: CmsAuthor
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-x-4 bg-ui-bg-base px-4 py-3 transition-colors hover:bg-ui-bg-base-hover">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-x-3 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
          {author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatar}
              alt={author.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <User />
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <Text size="small" weight="plus" className="truncate">
            {author.name}
          </Text>
          <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
            /{author.slug}
          </Text>
        </div>
      </button>

      {author.bio && (
        <Text
          size="xsmall"
          className="hidden max-w-xs flex-1 truncate text-ui-fg-muted md:block"
          title={author.bio}
        >
          {author.bio}
        </Text>
      )}

      <div className="flex items-center gap-x-1">
        <Tooltip content="Edit author">
          <IconButton size="small" variant="transparent" onClick={onEdit}>
            <Pencil />
          </IconButton>
        </Tooltip>
        <Tooltip content="Delete author">
          <IconButton size="small" variant="transparent" onClick={onDelete}>
            <Trash />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Create / edit drawer                                                */
/* ------------------------------------------------------------------ */

function AuthorDrawer({
  author,
  onClose,
  onSaved,
}: {
  author: CmsAuthor | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!author
  const [name, setName] = useState(author?.name ?? "")
  const [slug, setSlug] = useState(author?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [bio, setBio] = useState(author?.bio ?? "")
  const [avatar, setAvatar] = useState<string>(author?.avatar ?? "")
  const [saving, setSaving] = useState(false)

  const derivedSlug = useMemo(
    () => (slugTouched ? slug : slugify(name)),
    [slug, slugTouched, name]
  )

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        slug: derivedSlug || undefined,
        bio: bio.trim() || null,
        avatar: avatar.trim() || null,
      }
      const url = isEdit
        ? `/admin/cms/blog/authors/${author!.id}`
        : "/admin/cms/blog/authors"
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Save failed (${res.status})`)
      }
      toast.success(isEdit ? "Author updated" : "Author created")
      onSaved()
    } catch (e: any) {
      toast.error("Could not save author", {
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
          <Drawer.Title>{isEdit ? "Edit author" : "New author"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Name
            </Label>
            <Input
              autoFocus
              value={name}
              placeholder="Jane Doe"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Slug
            </Label>
            <Input
              value={derivedSlug}
              placeholder="jane-doe"
              className="font-mono"
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              Used in author links. Leave to auto-derive from the name.
            </Text>
          </div>
          <ImagePicker
            label="Avatar"
            value={avatar}
            onChange={(url) => setAvatar(url)}
            clearable
            hint="Square image works best. Optional."
          />
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Bio
            </Label>
            <Textarea
              value={bio}
              rows={4}
              placeholder="Optional short biography shown on the author's posts."
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={submit} isLoading={saving}>
            {isEdit ? "Save" : "Create"}
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
  hasQuery,
  onCreate,
}: {
  hasQuery: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <User />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">
          {hasQuery ? "No authors match" : "No authors yet"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasQuery
            ? "Try a different search."
            : "Create an author to credit on blog posts."}
        </Text>
      </div>
      {!hasQuery && (
        <Button size="small" onClick={onCreate}>
          <Plus />
          New author
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
          <div className="size-9 animate-pulse rounded-full bg-ui-bg-subtle" />
          <div className="flex flex-1 flex-col gap-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-ui-bg-subtle" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-ui-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Blog Authors",
  icon: User,
})

export default BlogAuthorsPage
