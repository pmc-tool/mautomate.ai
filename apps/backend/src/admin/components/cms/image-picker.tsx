/**
 * Forever Finds CMS — reusable admin ImagePicker (Phase 2, Media Library).
 *
 * A controlled image field that lets an editor either:
 *   1. pick an existing image from the CMS Media Library, or
 *   2. upload a brand-new image (which is then auto-selected).
 *
 * Contract (matches the Phase 2 media backend exactly):
 *   - List:   GET  /admin/cms/media?q&limit&offset  -> { media: CmsMedia[], count, ... }
 *   - Upload: POST /admin/cms/media  (multipart, field name "files")
 *             -> 201 { media: CmsMedia[] }   (read media[0] for the chosen one)
 *   Both calls use `credentials: "include"` (cookie-session admin auth + the
 *   /admin/cms/* requireAuthenticatedAdmin guard).
 *
 * Props:
 *   value      current media URL (or id) as a plain string, or null
 *   onChange   (url, media?) — called with the chosen absolute URL; `media` is
 *              the full CmsMedia row when known (after pick/upload)
 *   label      optional field label
 *   hint       optional helper text under the field
 *   clearable  show a "Remove" control to reset the value to ""
 *   disabled   render read-only (e.g. while on a non-default locale)
 *
 * The save payload shape is unchanged: the editor still stores a string URL.
 * This component is self-contained and reused by every CMS settings editor.
 */
import {
  Badge,
  Button,
  FocusModal,
  IconButton,
  Input,
  Tabs,
  Text,
  clx,
  toast,
} from "@medusajs/ui"
import {
  ArrowUpTray,
  CheckCircleSolid,
  MagnifyingGlass,
  Photo,
  Spinner,
  Trash,
} from "@medusajs/icons"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CmsMedia = {
  id: string
  url: string
  original_filename?: string | null
  filename?: string | null
  mime_type?: string | null
  size?: number | null
  width?: number | null
  height?: number | null
  alt?: { en?: string; bn?: string } | null
  title?: { en?: string; bn?: string } | null
  folder_id?: string | null
  created_at?: string
}

export type ImagePickerProps = {
  value: string | null | undefined
  onChange: (url: string, media?: CmsMedia) => void
  label?: string
  hint?: string
  clearable?: boolean
  disabled?: boolean
}

/* ------------------------------------------------------------------ */
/* Constants (mirror the backend allowlist for friendlier UX)          */
/* ------------------------------------------------------------------ */

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4"
const MAX_BYTES = 10 * 1024 * 1024

const altOf = (m: CmsMedia | undefined, fallback = ""): string =>
  m?.alt?.en ?? m?.alt?.bn ?? fallback

/* ------------------------------------------------------------------ */
/* Small image thumb with graceful fallback                            */
/* ------------------------------------------------------------------ */

function Thumb({
  src,
  alt,
  className,
}: {
  src: string
  alt?: string
  className?: string
}) {
  const [errored, setErrored] = useState(false)
  // Reset error state when the source changes.
  useEffect(() => setErrored(false), [src])

  if (errored || !src) {
    return (
      <div
        className={clx(
          "flex flex-col items-center justify-center gap-y-1 bg-ui-bg-subtle text-ui-fg-muted",
          className
        )}
      >
        <Photo />
        <Text size="xsmall" className="max-w-full truncate px-1">
          {src ? "Preview unavailable" : "No image"}
        </Text>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      onError={() => setErrored(true)}
      className={clx("h-full w-full object-contain", className)}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Library grid (existing media)                                       */
/* ------------------------------------------------------------------ */

function LibraryTab({
  onPick,
}: {
  onPick: (m: CmsMedia) => void
}) {
  const [media, setMedia] = useState<CmsMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [selected, setSelected] = useState<CmsMedia | null>(null)

  // Debounce the search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: "100", offset: "0" })
      if (search) params.set("q", search)
      const res = await fetch(`/admin/cms/media?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error(`Failed to load media (${res.status})`)
      }
      const data = await res.json()
      setMedia(Array.isArray(data?.media) ? data.media : [])
    } catch (e: any) {
      setError(e?.message ?? "Failed to load media")
      setMedia([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(debouncedQ)
  }, [debouncedQ, load])

  return (
    <div className="flex h-full flex-col gap-y-4">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-ui-fg-muted">
          <MagnifyingGlass />
        </span>
        <Input
          value={q}
          placeholder="Search by file name…"
          className="pl-8"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-x-2 py-16 text-ui-fg-subtle">
            <span className="animate-spin">
              <Spinner />
            </span>
            <Text size="small">Loading media…</Text>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-y-2 py-16">
            <Text size="small" className="text-ui-fg-error">
              {error}
            </Text>
            <Button
              size="small"
              variant="secondary"
              onClick={() => load(debouncedQ)}
            >
              Retry
            </Button>
          </div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-2 py-16 text-ui-fg-muted">
            <Photo />
            <Text size="small">
              {debouncedQ
                ? "No images match your search."
                : "No images yet — upload one from the Upload tab."}
            </Text>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {media.map((m) => {
              const isSelected = selected?.id === m.id
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => onPick(m)}
                  title={m.original_filename ?? m.filename ?? m.url}
                  className={clx(
                    "group relative flex flex-col overflow-hidden rounded-lg border bg-ui-bg-base text-left transition-colors",
                    isSelected
                      ? "border-ui-border-interactive shadow-borders-interactive-with-active"
                      : "border-ui-border-base hover:border-ui-border-strong"
                  )}
                >
                  <div className="flex aspect-square items-center justify-center bg-ui-bg-subtle p-2">
                    <Thumb
                      src={m.url}
                      alt={altOf(m)}
                      className="rounded-md"
                    />
                  </div>
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 text-ui-fg-interactive">
                      <CheckCircleSolid />
                    </span>
                  )}
                  <div className="border-t border-ui-border-base px-2 py-1.5">
                    <Text size="xsmall" className="truncate">
                      {m.original_filename ?? m.filename ?? m.id}
                    </Text>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-x-2 border-t border-ui-border-base pt-4">
        <Text size="small" className="mr-auto text-ui-fg-subtle">
          {selected
            ? selected.original_filename ?? selected.filename ?? selected.id
            : "Select an image, or double-click to choose."}
        </Text>
        <Button
          size="small"
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
        >
          Select image
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Upload tab                                                          */
/* ------------------------------------------------------------------ */

function UploadTab({
  onUploaded,
}: {
  onUploaded: (m: CmsMedia) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        toast.error("File too large", {
          description: `"${file.name}" exceeds the 10MB limit.`,
        })
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append("files", file)
        const res = await fetch("/admin/cms/media", {
          method: "POST",
          credentials: "include",
          body: form,
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e?.message || `Upload failed (${res.status})`)
        }
        const data = await res.json()
        const created: CmsMedia | undefined = data?.media?.[0]
        if (!created?.url) {
          throw new Error("Upload succeeded but no media was returned.")
        }
        toast.success("Image uploaded", {
          description: created.original_filename ?? created.filename ?? "",
        })
        onUploaded(created)
      } catch (e: any) {
        toast.error("Could not upload image", {
          description: e?.message ?? "Unexpected error.",
        })
      } finally {
        setUploading(false)
      }
    },
    [onUploaded]
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clx(
          "flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-y-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
          dragOver
            ? "border-ui-border-interactive bg-ui-bg-highlight"
            : "border-ui-border-strong bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <>
            <span className="animate-spin text-ui-fg-subtle">
              <Spinner />
            </span>
            <Text size="small" className="text-ui-fg-subtle">
              Uploading…
            </Text>
          </>
        ) : (
          <>
            <div className="text-ui-fg-muted">
              <ArrowUpTray />
            </div>
            <div className="flex flex-col gap-y-1">
              <Text size="small" weight="plus">
                Click to upload or drag &amp; drop
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted">
                PNG, JPG, WEBP, GIF, SVG or MP4 — up to 10MB
              </Text>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload(file)
            // Reset so the same file can be re-selected.
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The ImagePicker                                                     */
/* ------------------------------------------------------------------ */

export function ImagePicker({
  value,
  onChange,
  label,
  hint,
  clearable,
  disabled,
}: ImagePickerProps) {
  const [open, setOpen] = useState(false)
  const hasValue = !!value

  const choose = useCallback(
    (m: CmsMedia) => {
      onChange(m.url, m)
      setOpen(false)
    },
    [onChange]
  )

  return (
    <div className="flex flex-col gap-y-1.5">
      {label && (
        <Text size="small" weight="plus" className="text-ui-fg-base">
          {label}
        </Text>
      )}

      <div className="flex items-start gap-x-3">
        {/* Preview / empty dropzone */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-ui-border-base">
          {hasValue ? (
            <div className="flex h-full w-full items-center justify-center bg-ui-bg-subtle p-1.5">
              <Thumb src={value as string} className="rounded-md" />
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen(true)}
              className={clx(
                "flex h-full w-full flex-col items-center justify-center gap-y-1 border-2 border-dashed border-ui-border-strong bg-ui-bg-subtle text-ui-fg-muted transition-colors",
                !disabled && "hover:bg-ui-bg-subtle-hover",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <Photo />
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              type="button"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              <Photo />
              {hasValue ? "Change image" : "Choose image"}
            </Button>
            {clearable && hasValue && (
              <IconButton
                size="small"
                variant="transparent"
                type="button"
                disabled={disabled}
                onClick={() => onChange("")}
                aria-label="Remove image"
              >
                <Trash />
              </IconButton>
            )}
          </div>

          {hasValue && (
            <Badge size="2xsmall" className="max-w-full truncate font-mono">
              {value}
            </Badge>
          )}

          {hint && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {hint}
            </Text>
          )}
        </div>
      </div>

      {/* Library / Upload modal */}
      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <FocusModal.Title>Media Library</FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col overflow-hidden p-0">
            <Tabs defaultValue="library" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-ui-border-base px-6 pt-4">
                <Tabs.List>
                  <Tabs.Trigger value="library">Library</Tabs.Trigger>
                  <Tabs.Trigger value="upload">Upload</Tabs.Trigger>
                </Tabs.List>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <Tabs.Content
                  value="library"
                  className="h-full overflow-hidden p-6"
                >
                  <LibraryTab onPick={choose} />
                </Tabs.Content>
                <Tabs.Content value="upload" className="h-full p-6">
                  <UploadTab onUploaded={choose} />
                </Tabs.Content>
              </div>
            </Tabs>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </div>
  )
}

export default ImagePicker
