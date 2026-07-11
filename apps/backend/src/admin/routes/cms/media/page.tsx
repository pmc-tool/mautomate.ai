/**
 * Forever Finds CMS — Media Library (Phase 2).
 *
 * Admin page for browsing, uploading, organizing and editing media assets.
 * Lives under the "Site Management" group (parent route: /cms).
 *
 * API CONTRACT (all under /admin/cms/*, cookie-session auth, credentials:include):
 *   GET    /admin/cms/media            -> { media, count, limit, offset }
 *   POST   /admin/cms/media            (multipart, field "files") -> 201 { media }
 *   POST   /admin/cms/media/:id        (metadata) { alt?, title?, folder_id? } -> { media }
 *   DELETE /admin/cms/media/:id        -> { id, object, deleted }
 *   GET    /admin/cms/media/folders    -> { folders, count }
 *   POST   /admin/cms/media/folders    { name, parent_id? } -> 201 { folder }
 *   DELETE /admin/cms/media/folders/:id-> { id, object, deleted }
 *
 * alt/title are per-locale maps { en?, bn? }. We send/receive JSON objects.
 * media.url is an absolute URL (dev: http://localhost:9000/static/..., prod: S3/CDN)
 * stored verbatim — rendered directly with no rewriting.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowUpTray,
  Folder,
  FolderOpen,
  Pencil,
  Photo,
  Plus,
  Trash,
  XMark,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  clx,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  Textarea,
  toast,
  Tooltip,
  usePrompt,
} from "@medusajs/ui"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react"

/* ------------------------------------------------------------------ */
/* Types (mirror the backend cms_media / cms_media_folder contract)    */
/* ------------------------------------------------------------------ */

type LocaleText = { en?: string; bn?: string } | null

type CmsMedia = {
  id: string
  file_id: string
  url: string
  original_filename: string
  filename: string
  mime_type: string
  size: number
  width: number | null
  height: number | null
  checksum: string | null
  alt: LocaleText
  title: LocaleText
  folder_id: string | null
  created_by: string | null
  created_at: string
}

type CmsMediaFolder = {
  id: string
  name: string
  path: string
  parent_id: string | null
}

const PAGE_SIZE = 50
const ALL = "__all__" as const
const ROOT = "root" as const

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const isImage = (mime: string) => mime.startsWith("image/")

const formatBytes = (bytes: number): string => {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const localeValue = (m: LocaleText): { en: string; bn: string } => ({
  en: m?.en ?? "",
  bn: m?.bn ?? "",
})

/** Build a {en,bn} payload, dropping empty keys (null when fully empty). */
const buildLocale = (en: string, bn: string): LocaleText => {
  const out: { en?: string; bn?: string } = {}
  if (en.trim()) out.en = en.trim()
  if (bn.trim()) out.bn = bn.trim()
  return Object.keys(out).length ? out : null
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const MediaLibraryPage = () => {
  const dialog = usePrompt()

  const [media, setMedia] = useState<CmsMedia[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [folders, setFolders] = useState<CmsMediaFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>(ALL)

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState<CmsMedia | null>(null)

  /* -------- data loading -------- */

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/admin/cms/media/folders", {
        credentials: "include",
      })
      const data = await res.json()
      setFolders((data?.folders ?? []) as CmsMediaFolder[])
    } catch {
      // folders are optional — fail quietly
    }
  }, [])

  const loadMedia = useCallback(
    async (opts?: { offset?: number }) => {
      setLoading(true)
      const nextOffset = opts?.offset ?? 0
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(nextOffset))
      if (selectedFolder !== ALL) params.set("folder_id", selectedFolder)
      if (query.trim()) params.set("q", query.trim())

      try {
        const res = await fetch(`/admin/cms/media?${params.toString()}`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error(`Failed to load media (${res.status})`)
        const data = await res.json()
        setMedia((data?.media ?? []) as CmsMedia[])
        setCount(data?.count ?? 0)
        setOffset(nextOffset)
      } catch (e: any) {
        toast.error("Could not load media", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setLoading(false)
      }
    },
    [selectedFolder, query]
  )

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    loadMedia({ offset: 0 })
  }, [loadMedia])

  /* -------- upload -------- */

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (!files.length) return

      const form = new FormData()
      for (const f of files) form.append("files", f)
      // Assign to the active folder when a concrete folder is selected.
      if (selectedFolder !== ALL && selectedFolder !== ROOT) {
        form.append("folder_id", selectedFolder)
      }

      setUploading(true)
      try {
        const res = await fetch("/admin/cms/media", {
          method: "POST",
          credentials: "include",
          body: form,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.message || `Upload failed (${res.status})`)
        }
        const data = await res.json()
        const uploaded = (data?.media ?? []) as CmsMedia[]
        toast.success("Upload complete", {
          description: `${uploaded.length} file${
            uploaded.length === 1 ? "" : "s"
          } added to the library.`,
        })
        await loadMedia({ offset: 0 })
      } catch (e: any) {
        toast.error("Upload failed", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [selectedFolder, loadMedia]
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (uploading) return
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files)
  }

  /* -------- delete media -------- */

  const deleteMedia = async (m: CmsMedia) => {
    const confirmed = await dialog({
      title: "Delete media",
      description: `"${m.original_filename}" will be permanently removed from the library and storage. This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/admin/cms/media/${m.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Delete failed (${res.status})`)
      }
      toast.success("Media deleted")
      setMedia((prev) => prev.filter((x) => x.id !== m.id))
      setCount((c) => Math.max(0, c - 1))
    } catch (e: any) {
      toast.error("Could not delete", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  /* -------- pagination -------- */

  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < count
  const rangeStart = count === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + PAGE_SIZE, count)

  /* ----------------------------------------------------------------- */

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <Heading level="h2">Media Library</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Upload and manage images used across the storefront.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files)
            }}
          />
          <Button
            size="small"
            isLoading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <ArrowUpTray />
            Upload
          </Button>
        </div>
      </div>

      {/* Toolbar: folders + search */}
      <div className="flex flex-col gap-y-3 border-b border-ui-border-base px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <FolderTabs
          folders={folders}
          selected={selectedFolder}
          onSelect={setSelectedFolder}
          onCreated={loadFolders}
          onDeleted={() => {
            setSelectedFolder(ALL)
            loadFolders()
          }}
        />
        <form
          className="flex items-center gap-x-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(search)
          }}
        >
          <Input
            size="small"
            placeholder="Search filename…"
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
      <div
        className={clx(
          "relative px-6 py-6",
          dragging && "outline-dashed outline-2 -outline-offset-4 outline-ui-fg-interactive"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          if (!dragging) setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={onDrop}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-lg bg-ui-bg-base/80">
            <div className="flex flex-col items-center gap-y-2 text-ui-fg-interactive">
              <ArrowUpTray />
              <Text weight="plus">Drop files to upload</Text>
            </div>
          </div>
        )}

        {loading ? (
          <GridSkeleton />
        ) : media.length === 0 ? (
          <EmptyState
            uploading={uploading}
            hasQuery={!!query}
            onUploadClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {media.map((m) => (
                <MediaCard
                  key={m.id}
                  media={m}
                  onEdit={() => setEditing(m)}
                  onDelete={() => deleteMedia(m)}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {rangeStart}–{rangeEnd} of {count}
              </Text>
              <div className="flex items-center gap-x-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasPrev}
                  onClick={() => loadMedia({ offset: offset - PAGE_SIZE })}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasNext}
                  onClick={() => loadMedia({ offset: offset + PAGE_SIZE })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit drawer */}
      {editing && (
        <EditMediaDrawer
          media={editing}
          folders={folders}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setMedia((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x))
            )
            setEditing(null)
          }}
        />
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Folder tabs (minimal: All / Root / each folder + create / delete)  */
/* ------------------------------------------------------------------ */

function FolderTabs({
  folders,
  selected,
  onSelect,
  onCreated,
  onDeleted,
}: {
  folders: CmsMediaFolder[]
  selected: string
  onSelect: (id: string) => void
  onCreated: () => void
  onDeleted: () => void
}) {
  const dialog = usePrompt()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const submitCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const res = await fetch("/admin/cms/media/folders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Could not create folder (${res.status})`)
      }
      toast.success("Folder created")
      setName("")
      setCreating(false)
      onCreated()
    } catch (e: any) {
      toast.error("Could not create folder", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBusy(false)
    }
  }

  const deleteFolder = async (f: CmsMediaFolder) => {
    const ok = await dialog({
      title: "Delete folder",
      description: `Delete "${f.name}"? Media inside it is kept and moved to the root view.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      const res = await fetch(`/admin/cms/media/folders/${f.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Delete failed (${res.status})`)
      }
      toast.success("Folder deleted")
      onDeleted()
    } catch (e: any) {
      toast.error("Could not delete folder", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FolderChip
        label="All media"
        active={selected === ALL}
        onClick={() => onSelect(ALL)}
      />
      <FolderChip
        label="Root"
        active={selected === ROOT}
        onClick={() => onSelect(ROOT)}
      />
      {folders.map((f) => (
        <FolderChip
          key={f.id}
          label={f.name}
          active={selected === f.id}
          onClick={() => onSelect(f.id)}
          onDelete={() => deleteFolder(f)}
        />
      ))}

      {creating ? (
        <div className="flex items-center gap-x-1">
          <Input
            size="small"
            autoFocus
            placeholder="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate()
              if (e.key === "Escape") {
                setCreating(false)
                setName("")
              }
            }}
            className="w-36"
          />
          <Button size="small" onClick={submitCreate} isLoading={busy}>
            Add
          </Button>
          <IconButton
            size="small"
            variant="transparent"
            onClick={() => {
              setCreating(false)
              setName("")
            }}
          >
            <XMark />
          </IconButton>
        </div>
      ) : (
        <Button
          size="small"
          variant="transparent"
          onClick={() => setCreating(true)}
        >
          <Plus />
          New folder
        </Button>
      )}
    </div>
  )
}

function FolderChip({
  label,
  active,
  onClick,
  onDelete,
}: {
  label: string
  active: boolean
  onClick: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={clx(
        "group flex items-center gap-x-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-ui-border-interactive bg-ui-bg-base text-ui-fg-base shadow-borders-base"
          : "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle hover:bg-ui-bg-base-hover"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-x-1.5"
      >
        {active ? <FolderOpen /> : <Folder />}
        <span>{label}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete folder ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="ml-0.5 hidden text-ui-fg-muted hover:text-ui-fg-error group-hover:block"
        >
          <XMark />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Media card                                                          */
/* ------------------------------------------------------------------ */

function MediaCard({
  media,
  onEdit,
  onDelete,
}: {
  media: CmsMedia
  onEdit: () => void
  onDelete: () => void
}) {
  const dims =
    media.width && media.height ? `${media.width}×${media.height}` : null
  const altText = media.alt?.en ?? ""

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle transition-shadow hover:shadow-elevation-card-rest">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-ui-bg-base">
        {isImage(media.mime_type) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={altText}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-y-1 text-ui-fg-muted">
            <Photo />
            <Text size="xsmall">{media.mime_type}</Text>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute right-2 top-2 flex items-center gap-x-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip content="Edit alt text">
            <IconButton size="small" variant="primary" onClick={onEdit}>
              <Pencil />
            </IconButton>
          </Tooltip>
          <Tooltip content="Delete">
            <IconButton size="small" variant="primary" onClick={onDelete}>
              <Trash />
            </IconButton>
          </Tooltip>
        </div>

        {!altText && isImage(media.mime_type) && (
          <div className="absolute bottom-2 left-2">
            <Badge size="2xsmall" color="orange">
              No alt
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-y-0.5 px-3 py-2">
        <Text
          size="small"
          weight="plus"
          className="truncate"
          title={media.original_filename}
        >
          {media.original_filename}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {[dims, formatBytes(media.size)].filter(Boolean).join(" · ")}
        </Text>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Edit drawer — alt / title (per-locale) + folder                     */
/* ------------------------------------------------------------------ */

function EditMediaDrawer({
  media,
  folders,
  onClose,
  onSaved,
}: {
  media: CmsMedia
  folders: CmsMediaFolder[]
  onClose: () => void
  onSaved: (m: CmsMedia) => void
}) {
  const initialAlt = localeValue(media.alt)
  const initialTitle = localeValue(media.title)

  const [altEn, setAltEn] = useState(initialAlt.en)
  const [altBn, setAltBn] = useState(initialAlt.bn)
  const [titleEn, setTitleEn] = useState(initialTitle.en)
  const [titleBn, setTitleBn] = useState(initialTitle.bn)
  const [folderId, setFolderId] = useState<string | null>(media.folder_id)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const body = {
        alt: buildLocale(altEn, altBn),
        title: buildLocale(titleEn, titleBn),
        folder_id: folderId,
      }
      const res = await fetch(`/admin/cms/media/${media.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Save failed (${res.status})`)
      }
      const data = await res.json()
      toast.success("Media updated")
      onSaved(data.media as CmsMedia)
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  const dims =
    media.width && media.height ? `${media.width} × ${media.height}px` : "—"

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit media</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {/* Preview */}
          <div className="flex items-center justify-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
            {isImage(media.mime_type) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.url}
                alt={altEn}
                className="max-h-56 w-auto object-contain"
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-ui-fg-muted">
                <Photo />
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-ui-border-base px-3 py-3">
            <Meta label="Filename" value={media.original_filename} />
            <Meta label="Type" value={media.mime_type} />
            <Meta label="Dimensions" value={dims} />
            <Meta label="Size" value={formatBytes(media.size)} />
          </div>

          {/* Alt text */}
          <div className="flex flex-col gap-y-3">
            <Heading level="h3">Alt text</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Describes the image for screen readers and SEO. Provide per-locale
              values; Bengali falls back to English when empty.
            </Text>
            <LabeledTextarea
              label="Alt · EN"
              value={altEn}
              onChange={setAltEn}
              placeholder="A pair of gold hoop earrings on a marble surface"
            />
            <LabeledTextarea
              label="Alt · BN"
              value={altBn}
              onChange={setAltBn}
            />
          </div>

          {/* Title */}
          <div className="flex flex-col gap-y-3">
            <Heading level="h3">Title</Heading>
            <LabeledInput label="Title · EN" value={titleEn} onChange={setTitleEn} />
            <LabeledInput label="Title · BN" value={titleBn} onChange={setTitleBn} />
          </div>

          {/* Folder */}
          {folders.length > 0 && (
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Folder
              </Label>
              <select
                value={folderId ?? ""}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="bg-ui-bg-field shadow-borders-base txt-compact-small h-8 w-full rounded-md px-2 outline-none focus:shadow-borders-interactive-with-active"
              >
                <option value="">Root</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={save} isLoading={saving}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-y-0.5">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="small" className="truncate" title={value}>
        {value}
      </Text>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function LabeledTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      <Textarea
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty + loading states                                              */
/* ------------------------------------------------------------------ */

function EmptyState({
  uploading,
  hasQuery,
  onUploadClick,
}: {
  uploading: boolean
  hasQuery: boolean
  onUploadClick: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-3 rounded-lg border border-dashed border-ui-border-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
        <Photo />
      </div>
      <div className="flex flex-col gap-y-1">
        <Text weight="plus">
          {hasQuery ? "No media matches your search" : "No media yet"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {hasQuery
            ? "Try a different filename or clear the search."
            : "Upload images to use them across the storefront. You can also drag and drop files here."}
        </Text>
      </div>
      {!hasQuery && (
        <Button size="small" isLoading={uploading} onClick={onUploadClick}>
          <ArrowUpTray />
          Upload media
        </Button>
      )}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-lg border border-ui-border-base"
        >
          <div className="aspect-square animate-pulse bg-ui-bg-subtle" />
          <div className="flex flex-col gap-y-1.5 px-3 py-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-ui-bg-subtle" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-ui-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Media Library",
  icon: Photo,
})

export default MediaLibraryPage
