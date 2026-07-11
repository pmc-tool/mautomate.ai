/**
 * Forever Finds CMS — Blog Categories (Phase 8).
 *
 * Simple management page for blog categories: list / create / edit / delete.
 * Fields: name, slug (auto-derived from name when blank), description.
 * Sits under the "Site Management" group (parent route /cms).
 *
 * API CONTRACT (all under /admin/cms/blog/*, cookie-session auth, credentials:include,
 * behind the /admin/cms/* requireAuthenticatedAdmin guard):
 *   GET    /admin/cms/blog/categories?q&limit&offset -> { categories, count, limit, offset }
 *   POST   /admin/cms/blog/categories  { name, slug?, description? } -> 201 { category }
 *   GET    /admin/cms/blog/categories/:id            -> { category }
 *   PUT    /admin/cms/blog/categories/:id  { name?, slug?, description? } -> { category }
 *   DELETE /admin/cms/blog/categories/:id            -> { id, object, deleted }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Pencil, Plus, Tag, Trash } from "@medusajs/icons"
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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type CmsBlogCategory = {
  id: string
  name: string
  slug: string
  description: string | null
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

const BlogCategoriesPage = () => {
  const dialog = usePrompt()

  const [categories, setCategories] = useState<CmsBlogCategory[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  // null = closed; "new" = create; object = edit
  const [editing, setEditing] = useState<CmsBlogCategory | "new" | null>(null)

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      const nextOffset = opts?.offset ?? 0
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(nextOffset))
      if (query.trim()) params.set("q", query.trim())
      try {
        const res = await fetch(
          `/admin/cms/blog/categories?${params.toString()}`,
          { credentials: "include" }
        )
        if (!res.ok) throw new Error(`Failed to load categories (${res.status})`)
        const data = await res.json()
        setCategories((data?.categories ?? []) as CmsBlogCategory[])
        setCount(data?.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        toast.error("Could not load categories", {
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

  const remove = async (c: CmsBlogCategory) => {
    const ok = await dialog({
      title: "Delete category",
      description: `"${c.name}" will be removed. Posts keep their content but lose this category tag.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      const res = await fetch(`/admin/cms/blog/categories/${c.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Delete failed (${res.status})`)
      }
      toast.success("Category deleted")
      setCategories((prev) => prev.filter((x) => x.id !== c.id))
      setCount((n) => Math.max(0, n - 1))
    } catch (e: any) {
      toast.error("Could not delete category", {
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
          <Heading level="h2">Blog Categories</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Group blog posts into topics shown across the storefront blog.
          </Text>
        </div>
        <Button size="small" onClick={() => setEditing("new")}>
          <Plus />
          New category
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
        ) : categories.length === 0 ? (
          <EmptyState
            hasQuery={!!query}
            onCreate={() => setEditing("new")}
          />
        ) : (
          <>
            <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
              {categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  onEdit={() => setEditing(c)}
                  onDelete={() => remove(c)}
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
        <CategoryDrawer
          category={editing === "new" ? null : editing}
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

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: CmsBlogCategory
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
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-subtle">
          <Tag />
        </div>
        <div className="flex min-w-0 flex-col">
          <Text size="small" weight="plus" className="truncate">
            {category.name}
          </Text>
          <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
            /{category.slug}
          </Text>
        </div>
      </button>

      {category.description && (
        <Text
          size="xsmall"
          className="hidden max-w-xs flex-1 truncate text-ui-fg-muted md:block"
          title={category.description}
        >
          {category.description}
        </Text>
      )}

      <div className="flex items-center gap-x-1">
        <Tooltip content="Edit category">
          <IconButton size="small" variant="transparent" onClick={onEdit}>
            <Pencil />
          </IconButton>
        </Tooltip>
        <Tooltip content="Delete category">
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

function CategoryDrawer({
  category,
  onClose,
  onSaved,
}: {
  category: CmsBlogCategory | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!category
  const [name, setName] = useState(category?.name ?? "")
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [description, setDescription] = useState(category?.description ?? "")
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
        description: description.trim() || null,
      }
      const url = isEdit
        ? `/admin/cms/blog/categories/${category!.id}`
        : "/admin/cms/blog/categories"
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
      toast.success(isEdit ? "Category updated" : "Category created")
      onSaved()
    } catch (e: any) {
      toast.error("Could not save category", {
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
          <Drawer.Title>{isEdit ? "Edit category" : "New category"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Name
            </Label>
            <Input
              autoFocus
              value={name}
              placeholder="Handmade gifts"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Slug
            </Label>
            <Input
              value={derivedSlug}
              placeholder="handmade-gifts"
              className="font-mono"
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              Used in the storefront URL. Leave to auto-derive from the name.
            </Text>
          </div>
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Description
            </Label>
            <Textarea
              value={description}
              rows={3}
              placeholder="Optional short summary shown on the category page."
              onChange={(e) => setDescription(e.target.value)}
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
        <Tag />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">
          {hasQuery ? "No categories match" : "No categories yet"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasQuery
            ? "Try a different search."
            : "Create a category to organize blog posts by topic."}
        </Text>
      </div>
      {!hasQuery && (
        <Button size="small" onClick={onCreate}>
          <Plus />
          New category
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
          <div className="size-9 animate-pulse rounded-md bg-ui-bg-subtle" />
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
  label: "Blog Categories",
  icon: Tag,
})

export default BlogCategoriesPage
