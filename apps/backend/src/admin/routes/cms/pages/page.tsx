/**
 * Forever Finds CMS — Pages list (Phase 3).
 *
 * Lists CMS pages (the multi-page builder), with create + delete, linking each
 * row to the page editor at /cms/pages/:id. Sits under the "Site Management"
 * group (parent route /cms).
 *
 * API: GET /admin/cms/pages, POST /admin/cms/pages, DELETE /admin/cms/pages/:id
 * (all cookie-session, behind the /admin/cms/* admin guard).
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText, House, Plus, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Label,
  Switch,
  Text,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createPage,
  deletePage,
  listPages,
  STATUS_BADGE,
  type CmsPageRow,
  type PageStatus,
} from "./lib"

const PAGE_SIZE = 50

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

const PagesListPage = () => {
  // Pages open in the visual editor (the single page builder) rather than the
  // retired drawer builder. Opens in a new tab, minting the token server-side.
  const openInEditor = (slug: string) =>
    window.open(
      `/admin/cms/visual-editor?slug=${encodeURIComponent(slug)}&locale=en`,
      "_blank",
      "noopener"
    )
  const dialog = usePrompt()

  const [pages, setPages] = useState<CmsPageRow[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<PageStatus | "">("")

  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      const nextOffset = opts?.offset ?? 0
      try {
        const data = await listPages({
          q: query,
          status,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setPages(data.pages ?? [])
        setCount(data.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        toast.error("Could not load pages", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setLoading(false)
      }
    },
    [query, status]
  )

  useEffect(() => {
    load({ offset: 0 })
  }, [load])

  const remove = async (p: CmsPageRow) => {
    const ok = await dialog({
      title: "Delete page",
      description: `"${p.title}" will be removed. Published snapshots are kept for history, but the page will no longer be editable.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deletePage(p.id)
      toast.success("Page deleted")
      setPages((prev) => prev.filter((x) => x.id !== p.id))
      setCount((c) => Math.max(0, c - 1))
    } catch (e: any) {
      toast.error("Could not delete page", {
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
          <Heading level="h2">Pages</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Build and publish storefront pages from reusable content blocks.
          </Text>
        </div>
        <Button size="small" onClick={() => setCreateOpen(true)}>
          <Plus />
          New page
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-y-3 border-b border-ui-border-base px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
          {([
            { value: "", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ] as const).map((s) => (
            <Button
              key={s.value || "all"}
              size="small"
              variant={status === s.value ? "primary" : "transparent"}
              onClick={() => setStatus(s.value as PageStatus | "")}
            >
              {s.label}
            </Button>
          ))}
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
        ) : pages.length === 0 ? (
          <EmptyState hasQuery={!!query || !!status} onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            <div className="flex flex-col divide-y divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base">
              {pages.map((p) => (
                <PageRow
                  key={p.id}
                  page={p}
                  onOpen={() => openInEditor(p.slug)}
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
        <CreatePageDrawer
          onClose={() => setCreateOpen(false)}
          onCreated={(_id, slug) => {
            setCreateOpen(false)
            openInEditor(slug)
          }}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function PageRow({
  page,
  onOpen,
  onDelete,
}: {
  page: CmsPageRow
  onOpen: () => void
  onDelete: () => void
}) {
  const badge = STATUS_BADGE[page.status]
  return (
    <div className="flex items-center gap-x-4 bg-ui-bg-base px-4 py-3 transition-colors hover:bg-ui-bg-base-hover">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-x-3 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-subtle">
          {page.is_home ? <House /> : <DocumentText />}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-x-2">
            <Text size="small" weight="plus" className="truncate">
              {page.title}
            </Text>
            {page.is_home && (
              <Badge size="2xsmall" color="blue">
                Home
              </Badge>
            )}
          </div>
          <Text size="xsmall" className="truncate font-mono text-ui-fg-subtle">
            /{page.slug}
          </Text>
        </div>
      </button>

      <Badge size="2xsmall" color={badge.color}>
        {badge.label}
      </Badge>
      <Text size="xsmall" className="hidden w-24 text-right text-ui-fg-muted md:block">
        {formatDate(page.updated_at)}
      </Text>
      <div className="flex items-center gap-x-1">
        <Button size="small" variant="secondary" onClick={onOpen}>
          Edit
        </Button>
        <Tooltip content="Delete page">
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

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

function CreatePageDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string, slug: string) => void
}) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [isHome, setIsHome] = useState(false)
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
      const { page } = await createPage({
        title: title.trim(),
        slug: derivedSlug || undefined,
        is_home: isHome,
        status: "draft",
      })
      toast.success("Page created", { description: `/${page.slug}` })
      onCreated(page.id, page.slug)
    } catch (e: any) {
      toast.error("Could not create page", {
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
          <Drawer.Title>New page</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Title
            </Label>
            <Input
              autoFocus
              value={title}
              placeholder="Home"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <Label size="small" weight="plus">
              Slug
            </Label>
            <Input
              value={derivedSlug}
              placeholder="home"
              className="font-mono"
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              The storefront route. Leave to auto-derive from the title.
            </Text>
          </div>
          <div className="flex items-start justify-between gap-x-4 rounded-lg border border-ui-border-base px-4 py-3">
            <div className="flex flex-col">
              <Label size="small" weight="plus">
                Home page
              </Label>
              <Text size="xsmall" className="text-ui-fg-muted">
                Render this page at the storefront root.
              </Text>
            </div>
            <Switch checked={isHome} onCheckedChange={setIsHome} />
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
  hasQuery,
  onCreate,
}: {
  hasQuery: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <DocumentText />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">{hasQuery ? "No pages match" : "No pages yet"}</Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasQuery
            ? "Try a different search or status filter."
            : "Create a page and start adding content blocks."}
        </Text>
      </div>
      {!hasQuery && (
        <Button size="small" onClick={onCreate}>
          <Plus />
          New page
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
          <div className="h-5 w-14 animate-pulse rounded-full bg-ui-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Pages",
  icon: DocumentText,
})

export default PagesListPage
