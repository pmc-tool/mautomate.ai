/**
 * Marketing — Image Studio.
 *
 * LEFT  : product picker (search + select), mode toggle (Composite / AI),
 *         size-preset multi-select grouped by platform, headline + subtext,
 *         optional AI prompt (AI mode), Generate button.
 * RIGHT : gallery of generated images for the selected product — each card
 *         has the image, preset label + dimensions, Download, Copy URL, Delete.
 *
 * APIs (built in parallel; every call degrades gracefully):
 *   GET    /admin/marketing/images/presets
 *   GET    /admin/marketing/images?product_id=
 *   POST   /admin/marketing/images
 *   DELETE /admin/marketing/images/:id
 *   GET    /admin/products?q=&limit=&fields=id,title,thumbnail
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowDownTray,
  ArrowPath,
  Link as LinkIcon,
  MagnifyingGlass,
  Photo,
  Sparkles,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  Textarea,
  clx,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EmptyState, PageHeader } from "../_components/ui-kit"

// ── types ──────────────────────────────────────────────────────────────────
type ImagePreset = {
  key: string
  label: string
  width: number
  height: number
  platform: string
}

type MarketingImage = {
  id: string
  url: string
  preset: string
  width: number
  height: number
  product_id: string
  created_at: string
}

type ProductLite = {
  id: string
  title: string
  thumbnail?: string | null
}

type Mode = "composite" | "ai"

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

// ── page ─────────────────────────────────────────────────────────────────────
const ImageStudioPage = () => {
  const dialog = usePrompt()

  // product search
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<ProductLite[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ProductLite | null>(null)
  const searchSeq = useRef(0)

  // config
  const [mode, setMode] = useState<Mode>("composite")
  const [presets, setPresets] = useState<ImagePreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [chosen, setChosen] = useState<string[]>([])
  const [headline, setHeadline] = useState("")
  const [subtext, setSubtext] = useState("")
  const [prompt, setPrompt] = useState("")

  // gallery
  const [images, setImages] = useState<MarketingImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)

  // load presets once
  useEffect(() => {
    let active = true
    setPresetsLoading(true)
    api<{ presets: ImagePreset[] }>("/admin/marketing/images/presets")
      .then((data) => {
        if (!active) return
        setPresets(data.presets ?? [])
      })
      .catch((e) => {
        if (!active) return
        toast.error("Could not load size presets", { description: e.message })
        setPresets([])
      })
      .finally(() => {
        if (active) setPresetsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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

  const loadGallery = useCallback(async (productId: string) => {
    setGalleryLoading(true)
    setGalleryError(null)
    try {
      const data = await api<{ images: MarketingImage[]; count: number }>(
        `/admin/marketing/images?product_id=${encodeURIComponent(productId)}`
      )
      setImages(data.images ?? [])
    } catch (e: any) {
      setGalleryError(e.message)
      setImages([])
    } finally {
      setGalleryLoading(false)
    }
  }, [])

  // when a product is picked: seed headline + load gallery
  const pickProduct = (p: ProductLite) => {
    setSelected(p)
    setProducts([])
    setQuery("")
    if (!headline) setHeadline(p.title)
    void loadGallery(p.id)
  }

  const clearProduct = () => {
    setSelected(null)
    setImages([])
    setGalleryError(null)
  }

  const togglePreset = (key: string) => {
    setChosen((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const groupedPresets = useMemo(() => {
    const map = new Map<string, ImagePreset[]>()
    for (const p of presets) {
      const arr = map.get(p.platform) ?? []
      arr.push(p)
      map.set(p.platform, arr)
    }
    return Array.from(map.entries())
  }, [presets])

  const canGenerate =
    !!selected && chosen.length > 0 && !generating && !presetsLoading

  const handleGenerate = async () => {
    if (!selected) {
      toast.error("Pick a product first")
      return
    }
    if (chosen.length === 0) {
      toast.error("Select at least one size preset")
      return
    }
    setGenerating(true)
    try {
      const body: Record<string, unknown> = {
        product_id: selected.id,
        preset_keys: chosen,
        mode,
        headline: headline || undefined,
        subtext: subtext || undefined,
      }
      if (mode === "ai" && prompt.trim()) {
        body.prompt = prompt.trim()
      }
      const data = await api<{ images: MarketingImage[] }>(
        "/admin/marketing/images",
        { method: "POST", json: body }
      )
      const made = data.images ?? []
      toast.success(
        made.length === 1
          ? "1 image generated"
          : `${made.length} images generated`
      )
      // merge fresh results in front, then reconcile with server
      setImages((prev) => [...made, ...prev])
      void loadGallery(selected.id)
    } catch (e: any) {
      toast.error("Image generation failed", { description: e.message })
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (url: string) => {
    try {
      const abs = new URL(url, window.location.origin).href
      await navigator.clipboard.writeText(abs)
      toast.success("URL copied")
    } catch {
      toast.error("Could not copy URL")
    }
  }

  const handleDownload = (img: MarketingImage) => {
    try {
      const a = document.createElement("a")
      a.href = img.url
      a.download = `${img.preset || "image"}-${img.id}`
      a.target = "_blank"
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      window.open(img.url, "_blank", "noopener")
    }
  }

  const handleDelete = async (img: MarketingImage) => {
    const ok = await dialog({
      title: "Delete image",
      description: "This will permanently remove the generated image.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (!ok) return
    // optimistic
    const prev = images
    setImages((cur) => cur.filter((i) => i.id !== img.id))
    try {
      await api(`/admin/marketing/images/${img.id}`, { method: "DELETE" })
      toast.success("Image deleted")
    } catch (e: any) {
      setImages(prev)
      toast.error("Could not delete image", { description: e.message })
    }
  }

  const presetLabel = (key: string): string => {
    const p = presets.find((pp) => pp.key === key)
    return p ? p.label : key
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <PageHeader
          icon={Photo}
          accent="violet"
          title="Image Studio"
          subtitle="Generate on-brand marketing images for your products."
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

          {/* mode toggle */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Mode
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "composite", label: "Composite", hint: "Product + text" },
                  { key: "ai", label: "AI generate", hint: "Prompt-driven" },
                ] as { key: Mode; label: string; hint: string }[]
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={clx(
                    "flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
                    mode === m.key
                      ? "border-ui-border-interactive bg-ui-bg-base shadow-borders-interactive-with-active"
                      : "border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover"
                  )}
                >
                  <div className="flex items-center gap-x-1">
                    {m.key === "ai" && (
                      <Sparkles className="text-ui-fg-interactive" />
                    )}
                    <Text size="small" weight="plus">
                      {m.label}
                    </Text>
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {m.hint}
                  </Text>
                </button>
              ))}
            </div>
          </div>

          {/* presets */}
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <Label size="small" weight="plus">
                Sizes
              </Label>
              {chosen.length > 0 && (
                <Badge size="2xsmall" color="blue">
                  {chosen.length} selected
                </Badge>
              )}
            </div>
            {presetsLoading ? (
              <Text size="small" className="text-ui-fg-muted">
                Loading presets…
              </Text>
            ) : groupedPresets.length === 0 ? (
              <Text size="small" className="text-ui-fg-muted">
                No presets available.
              </Text>
            ) : (
              <div className="flex flex-col gap-y-3">
                {groupedPresets.map(([platform, items]) => (
                  <div key={platform} className="flex flex-col gap-y-1.5">
                    <Text
                      size="xsmall"
                      weight="plus"
                      className="uppercase text-ui-fg-muted"
                    >
                      {platform}
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {items.map((p) => {
                        const active = chosen.includes(p.key)
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => togglePreset(p.key)}
                            className={clx(
                              "flex items-center gap-x-2 rounded-full border px-3 py-1.5 transition-colors",
                              active
                                ? "border-ui-border-interactive bg-ui-bg-base"
                                : "border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover"
                            )}
                          >
                            <Checkbox
                              checked={active}
                              className="pointer-events-none"
                              tabIndex={-1}
                            />
                            <Text size="xsmall">{p.label}</Text>
                            <Text
                              size="xsmall"
                              className="text-ui-fg-muted"
                            >
                              {p.width}×{p.height}
                            </Text>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* copy fields */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Headline
            </Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={selected?.title || "Headline text"}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Subtext
            </Label>
            <Input
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              placeholder="e.g. Shop now · Free shipping"
            />
          </div>

          {mode === "ai" && (
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                AI prompt
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe the scene, style, and mood…"
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Optional. Guides the AI image generation.
              </Text>
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!canGenerate}
            isLoading={generating}
            className="w-full"
          >
            {!generating && <Sparkles />}
            {generating ? "Generating…" : "Generate"}
          </Button>
          {generating && (
            <Text size="xsmall" className="text-center text-ui-fg-muted">
              This can take a few seconds — hang tight.
            </Text>
          )}
        </Container>

        {/* RIGHT — gallery */}
        <Container className="flex flex-col gap-y-4">
          <div className="flex items-center justify-between">
            <Heading level="h2">Gallery</Heading>
            {selected && (
              <IconButton
                size="small"
                variant="transparent"
                onClick={() => loadGallery(selected.id)}
                disabled={galleryLoading}
              >
                <ArrowPath
                  className={clx(galleryLoading && "animate-spin")}
                />
              </IconButton>
            )}
          </div>

          {!selected ? (
            <EmptyState
              icon={Photo}
              accent="violet"
              title="No product selected"
              description="Pick a product to see its generated images."
            />
          ) : galleryLoading && images.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-lg bg-ui-bg-component"
                />
              ))}
            </div>
          ) : galleryError ? (
            <div className="flex flex-col items-center gap-y-2 rounded-lg border border-dashed border-ui-border-error py-12">
              <Text size="small" className="text-ui-fg-error">
                {galleryError}
              </Text>
              <Button
                size="small"
                variant="secondary"
                onClick={() => selected && loadGallery(selected.id)}
              >
                Retry
              </Button>
            </div>
          ) : images.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              accent="violet"
              title="No images yet"
              description="Configure the options on the left and hit Generate."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle"
                >
                  <div className="relative bg-ui-bg-component">
                    <img
                      src={img.url}
                      alt={img.preset}
                      className="h-44 w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-y-2 p-3">
                    <div className="flex items-center justify-between gap-x-2">
                      <Text size="small" weight="plus" className="truncate">
                        {presetLabel(img.preset)}
                      </Text>
                      <Text
                        size="xsmall"
                        className="shrink-0 text-ui-fg-muted"
                      >
                        {img.width}×{img.height}
                      </Text>
                    </div>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {fmtDate(img.created_at)}
                    </Text>
                    <div className="flex items-center gap-x-1">
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => handleDownload(img)}
                        className="flex-1"
                      >
                        <ArrowDownTray />
                        Download
                      </Button>
                      <IconButton
                        size="small"
                        variant="transparent"
                        onClick={() => handleCopy(img.url)}
                      >
                        <LinkIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        onClick={() => handleDelete(img)}
                      >
                        <Trash className="text-ui-fg-error" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Image Studio",
  icon: Photo,
})

export default ImageStudioPage
