/**
 * Marketing — Video Studio.
 *
 * LEFT  : product picker (search + select), aspect Select, "Add AI voiceover"
 *         Switch + optional voice id, an optional captions Textarea (one line
 *         per scene), and a Generate video button (long-running render).
 * RIGHT : rendered videos for the product — <video> player, title, aspect,
 *         status badge, created time, Download + Delete. Failed projects show
 *         an error hint.
 *
 * APIs (built in parallel; every call degrades gracefully):
 *   GET    /admin/marketing/videos?product_id=
 *   POST   /admin/marketing/videos
 *   GET    /admin/marketing/videos/:id
 *   DELETE /admin/marketing/videos/:id
 *   GET    /admin/products?q=&limit=&fields=id,title,thumbnail
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowDownTray,
  ArrowPath,
  Camera,
  MagnifyingGlass,
  Photo,
  Sparkles,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  Textarea,
  clx,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { EmptyState, PageHeader } from "../_components/ui-kit"

// ── types ──────────────────────────────────────────────────────────────────
type Aspect = "reel_9x16" | "square_1x1" | "landscape_16x9"

type MarketingVideo = {
  id: string
  title: string
  url: string | null
  aspect_ratio: string
  status: string
  product_id: string
  created_at: string
}

type ProductLite = {
  id: string
  title: string
  thumbnail?: string | null
}

const ASPECTS: { value: Aspect; label: string }[] = [
  { value: "reel_9x16", label: "Reel · 9:16 (vertical)" },
  { value: "square_1x1", label: "Square · 1:1" },
  { value: "landscape_16x9", label: "Landscape · 16:9" },
]

// ── fetch helper ─────────────────────────────────────────────────────────────
const api = async <T,>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> => {
  const { json, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    ...rest,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      message = data?.message || data?.error || message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const aspectLabel = (value: string): string =>
  ASPECTS.find((a) => a.value === value)?.label ?? value

const statusColor = (
  status: string
): "green" | "red" | "orange" | "grey" => {
  const s = status?.toLowerCase()
  if (s === "ready" || s === "completed" || s === "done") return "green"
  if (s === "failed" || s === "error") return "red"
  if (s === "rendering" || s === "processing" || s === "pending")
    return "orange"
  return "grey"
}

// ── page ─────────────────────────────────────────────────────────────────────
const VideoStudioPage = () => {
  const dialog = usePrompt()

  // product search
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<ProductLite[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ProductLite | null>(null)
  const searchSeq = useRef(0)

  // config
  const [aspect, setAspect] = useState<Aspect>("reel_9x16")
  const [addVoiceover, setAddVoiceover] = useState(false)
  const [voice, setVoice] = useState("")
  const [captions, setCaptions] = useState("")

  // list
  const [videos, setVideos] = useState<MarketingVideo[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [rendering, setRendering] = useState(false)

  // debounced product search
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setProducts([])
      setSearching(false)
      return
    }
    setSearching(true)
    const seq = ++searchSeq.current
    const t = setTimeout(() => {
      api<{ products: ProductLite[] }>(
        `/admin/products?q=${encodeURIComponent(
          q
        )}&limit=8&fields=id,title,thumbnail`
      )
        .then((data) => {
          if (seq !== searchSeq.current) return
          setProducts(data.products ?? [])
        })
        .catch(() => {
          if (seq !== searchSeq.current) return
          setProducts([])
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false)
        })
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const loadVideos = useCallback(async (productId: string) => {
    setListLoading(true)
    setListError(null)
    try {
      const data = await api<{ videos: MarketingVideo[]; count: number }>(
        `/admin/marketing/videos?product_id=${encodeURIComponent(productId)}`
      )
      setVideos(data.videos ?? [])
    } catch (e: any) {
      setListError(e.message)
      setVideos([])
    } finally {
      setListLoading(false)
    }
  }, [])

  const pickProduct = (p: ProductLite) => {
    setSelected(p)
    setProducts([])
    setQuery("")
    void loadVideos(p.id)
  }

  const clearProduct = () => {
    setSelected(null)
    setVideos([])
    setListError(null)
  }

  const canGenerate = !!selected && !rendering

  const handleGenerate = async () => {
    if (!selected) {
      toast.error("Pick a product first")
      return
    }
    setRendering(true)
    try {
      const lines = captions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
      const body: Record<string, unknown> = {
        product_id: selected.id,
        aspect,
        add_voiceover: addVoiceover,
      }
      if (lines.length > 0) {
        body.scenes = lines.map((l) => ({ caption: l }))
      }
      if (addVoiceover && voice.trim()) {
        body.voice = voice.trim()
      }
      const data = await api<{
        project: MarketingVideo
        url: string | null
      }>("/admin/marketing/videos", { method: "POST", json: body })
      if (data?.project?.status && statusColor(data.project.status) === "red") {
        toast.error("Render finished with errors", {
          description: "The video project reported a failed status.",
        })
      } else {
        toast.success("Video rendered")
      }
      void loadVideos(selected.id)
    } catch (e: any) {
      toast.error("Video generation failed", { description: e.message })
    } finally {
      setRendering(false)
    }
  }

  const handleDownload = (video: MarketingVideo) => {
    if (!video.url) {
      toast.error("No video file to download")
      return
    }
    try {
      const a = document.createElement("a")
      a.href = video.url
      a.download = `${video.title || "video"}-${video.id}`
      a.target = "_blank"
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      window.open(video.url, "_blank", "noopener")
    }
  }

  const handleDelete = async (video: MarketingVideo) => {
    const ok = await dialog({
      title: "Delete video",
      description: "This will permanently remove the rendered video project.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (!ok) return
    const prev = videos
    setVideos((cur) => cur.filter((v) => v.id !== video.id))
    try {
      await api(`/admin/marketing/videos/${video.id}`, { method: "DELETE" })
      toast.success("Video deleted")
    } catch (e: any) {
      setVideos(prev)
      toast.error("Could not delete video", { description: e.message })
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <PageHeader
          icon={Camera}
          accent="rose"
          title="Video Studio"
          subtitle="Turn products into short marketing videos."
        />
      </Container>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* LEFT — configuration */}
        <Container className="flex flex-col gap-y-5">
          {/* product picker */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Product
            </Label>
            {selected ? (
              <div className="flex items-center justify-between rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2">
                <div className="flex items-center gap-x-3 overflow-hidden">
                  {selected.thumbnail ? (
                    <img
                      src={selected.thumbnail}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-ui-bg-component">
                      <Photo className="text-ui-fg-muted" />
                    </div>
                  )}
                  <Text size="small" className="truncate">
                    {selected.title}
                  </Text>
                </div>
                <Button
                  size="small"
                  variant="transparent"
                  onClick={clearProduct}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-y-2">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products…"
                    className="pl-8"
                  />
                </div>
                {searching && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Searching…
                  </Text>
                )}
                {!searching && query.trim() && products.length === 0 && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    No products found.
                  </Text>
                )}
                {products.length > 0 && (
                  <div className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-ui-border-base">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickProduct(p)}
                        className="flex items-center gap-x-3 border-b border-ui-border-base px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-ui-bg-subtle-hover"
                      >
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt=""
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-ui-bg-component">
                            <Photo className="text-ui-fg-muted" />
                          </div>
                        )}
                        <Text size="small" className="truncate">
                          {p.title}
                        </Text>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* aspect */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Aspect ratio
            </Label>
            <Select
              value={aspect}
              onValueChange={(v) => setAspect(v as Aspect)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select an aspect ratio" />
              </Select.Trigger>
              <Select.Content>
                {ASPECTS.map((a) => (
                  <Select.Item key={a.value} value={a.value}>
                    {a.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* voiceover */}
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label size="small" weight="plus">
                  Add AI voiceover
                </Label>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Narrate the video automatically.
                </Text>
              </div>
              <Switch
                checked={addVoiceover}
                onCheckedChange={setAddVoiceover}
              />
            </div>
            {addVoiceover && (
              <Input
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="Voice id (optional)"
              />
            )}
          </div>

          {/* captions */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Captions
            </Label>
            <Textarea
              value={captions}
              onChange={(e) => setCaptions(e.target.value)}
              rows={4}
              placeholder={"One caption per line…\nEach line becomes a scene."}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              Optional. Scenes are otherwise built from the product.
            </Text>
          </div>

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!canGenerate}
            isLoading={rendering}
            className="w-full"
          >
            {!rendering && <Sparkles />}
            {rendering ? "Rendering…" : "Generate video"}
          </Button>
          {rendering && (
            <Text size="xsmall" className="text-center text-ui-fg-muted">
              Rendering… this can take a minute. Please keep this tab open.
            </Text>
          )}
        </Container>

        {/* RIGHT — videos */}
        <Container className="flex flex-col gap-y-4">
          <div className="flex items-center justify-between">
            <Heading level="h2">Videos</Heading>
            {selected && (
              <IconButton
                size="small"
                variant="transparent"
                onClick={() => loadVideos(selected.id)}
                disabled={listLoading}
              >
                <ArrowPath className={clx(listLoading && "animate-spin")} />
              </IconButton>
            )}
          </div>

          {!selected ? (
            <EmptyState
              icon={Camera}
              accent="rose"
              title="No product selected"
              description="Pick a product to see its rendered videos."
            />
          ) : listLoading && videos.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="aspect-video animate-pulse rounded-lg bg-ui-bg-component"
                />
              ))}
            </div>
          ) : listError ? (
            <div className="flex flex-col items-center gap-y-2 rounded-lg border border-dashed border-ui-border-error py-12">
              <Text size="small" className="text-ui-fg-error">
                {listError}
              </Text>
              <Button
                size="small"
                variant="secondary"
                onClick={() => selected && loadVideos(selected.id)}
              >
                Retry
              </Button>
            </div>
          ) : videos.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              accent="rose"
              title="No videos yet"
              description="Configure the options on the left and hit Generate video."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {videos.map((video) => {
                const failed = statusColor(video.status) === "red"
                return (
                  <div
                    key={video.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle"
                  >
                    <div className="flex items-center justify-center bg-black/90">
                      {video.url && !failed ? (
                        <video
                          src={video.url}
                          controls
                          className="max-h-72 w-full"
                        />
                      ) : (
                        <div className="flex h-44 w-full flex-col items-center justify-center gap-y-1">
                          <Camera className="text-ui-fg-on-color" />
                          <Text
                            size="xsmall"
                            className="text-ui-fg-on-color/80"
                          >
                            {failed
                              ? "Render failed"
                              : "Video not available"}
                          </Text>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-y-2 p-3">
                      <div className="flex items-start justify-between gap-x-2">
                        <Text
                          size="small"
                          weight="plus"
                          className="truncate"
                        >
                          {video.title || "Untitled video"}
                        </Text>
                        <StatusBadge color={statusColor(video.status)}>
                          {video.status}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center gap-x-2">
                        <Badge size="2xsmall">
                          {aspectLabel(video.aspect_ratio)}
                        </Badge>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {fmtDate(video.created_at)}
                        </Text>
                      </div>
                      {failed && (
                        <Text size="xsmall" className="text-ui-fg-error">
                          This render failed. Try generating again — adjust the
                          captions or aspect ratio.
                        </Text>
                      )}
                      <div className="flex items-center gap-x-1">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => handleDownload(video)}
                          disabled={!video.url}
                          className="flex-1"
                        >
                          <ArrowDownTray />
                          Download
                        </Button>
                        <IconButton
                          size="small"
                          variant="transparent"
                          onClick={() => handleDelete(video)}
                        >
                          <Trash className="text-ui-fg-error" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Video Studio",
  icon: Camera,
})

export default VideoStudioPage
