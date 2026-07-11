/**
 * Marketing — Compose editor (3-pane composer).
 *
 * LEFT   : platform selection, attach products, attach media (stub).
 * CENTER : AI-assist (prompt / tone / length → generate), the master content
 *          editor with inline "sparkle" transforms, hashtags, link, and
 *          collapsible per-platform overrides (each with tailor-with-AI).
 * RIGHT  : live preview cards per selected platform with character-limit and
 *          media pre-flight warnings.
 * BOTTOM : schedule bar — Publish now / Schedule / Submit for approval.
 *
 * APIs (built in parallel; every call degrades gracefully on 404/empty):
 *   POST /admin/marketing/posts/generate        — AI draft
 *   POST /admin/marketing/posts                  — create/persist a draft
 *   POST /admin/marketing/posts/:id/tailor       — per-platform AI rewrite
 *   POST /admin/marketing/posts/:id/schedule     — schedule
 *   POST /admin/marketing/posts/:id/approve      — publish / submit
 *   POST /admin/marketing/generate-text          — inline snippet transforms
 *   GET  /admin/marketing/brand-voice            — brand voice options
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Adjustments,
  ArrowUpTray,
  ChevronDown,
  ChevronRight,
  ExclamationCircle,
  Hashtag,
  Link as LinkIcon,
  PencilSquare,
  Photo,
  Sparkles,
  Tag,
  Trash,
  XMarkMini,
} from "@medusajs/icons"
import {
  Button,
  Checkbox,
  Container,
  IconButton,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  Tooltip,
  clx,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PlatformChip } from "../_components/PlatformChip"
import { ProductPicker } from "../_components/ProductPicker"
import { PageHeader } from "../_components/ui-kit"
import {
  PLATFORMS,
  approvePost,
  createPost,
  generatePost,
  generateText,
  listBrandVoices,
  localInputToISO,
  platformMeta,
  schedulePost,
  tailorTarget,
  type BrandVoice,
  type PickerProduct,
  type Platform,
  type PostMedia,
} from "../_components/lib"

const TONES = [
  "friendly",
  "professional",
  "playful",
  "bold",
  "minimal",
  "luxury",
]
const LENGTHS = ["short", "medium", "long"]

const SPARKLE_ACTIONS: { action: string; label: string }[] = [
  { action: "shorten", label: "Shorten" },
  { action: "punch_up", label: "Punch it up" },
  { action: "add_hashtags", label: "Add hashtags" },
]

const ComposePage = () => {
  const navigate = useNavigate()

  // Left pane -------------------------------------------------------
  const [platforms, setPlatforms] = useState<Set<Platform>>(
    new Set<Platform>(["instagram", "facebook"])
  )
  const [products, setProducts] = useState<PickerProduct[]>([])
  const [media, setMedia] = useState<PostMedia[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // Center pane -----------------------------------------------------
  const [prompt, setPrompt] = useState("")
  const [tone, setTone] = useState<string>("friendly")
  const [length, setLength] = useState<string>("medium")
  const [brandVoiceId, setBrandVoiceId] = useState<string>("")
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([])

  const [content, setContent] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [link, setLink] = useState("")
  const [overrides, setOverrides] = useState<Partial<Record<Platform, string>>>(
    {}
  )
  const [expanded, setExpanded] = useState<Set<Platform>>(new Set())

  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Persistence -----------------------------------------------------
  const [postId, setPostId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [tailoring, setTailoring] = useState<Platform | null>(null)

  // Bottom bar ------------------------------------------------------
  const [scheduledAt, setScheduledAt] = useState("")

  useEffect(() => {
    listBrandVoices()
      .then((r) => setBrandVoices(r.brand_voices ?? []))
      .catch(() => setBrandVoices([]))
  }, [])

  const selectedPlatforms = useMemo(
    () => PLATFORMS.filter((p) => platforms.has(p.value)),
    [platforms]
  )

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const toggleExpanded = (p: Platform) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  /* --------------------------------------------------------------- */
  /* AI generate                                                      */
  /* --------------------------------------------------------------- */

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe what to post", {
        description: "Add a short prompt so the AI has something to work with.",
      })
      return
    }
    if (platforms.size === 0) {
      toast.error("Pick at least one platform")
      return
    }
    setGenerating(true)
    try {
      const { post, targets } = await generatePost({
        prompt: prompt.trim(),
        product_ids: products.map((p) => p.id),
        platforms: Array.from(platforms),
        brand_voice_id: brandVoiceId || null,
        tone,
        length,
      })
      setPostId(post.id)
      setContent(post.content ?? "")
      setHashtags(post.hashtags ?? "")
      setLink(post.link ?? "")
      const next: Partial<Record<Platform, string>> = {}
      ;(targets ?? []).forEach((t) => {
        if (t.content) next[t.platform as Platform] = t.content
      })
      setOverrides(next)
      toast.success("Draft generated")
    } catch (e: any) {
      toast.error("Could not generate", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setGenerating(false)
    }
  }

  /* --------------------------------------------------------------- */
  /* Inline sparkle transforms                                        */
  /* --------------------------------------------------------------- */

  const applySparkle = async (action: string, label: string) => {
    const el = contentRef.current
    const hasContent = content.trim().length > 0
    if (!hasContent) {
      toast.error("Write something first")
      return
    }
    const start = el?.selectionStart ?? 0
    const end = el?.selectionEnd ?? 0
    const hasSelection = end > start
    const target = hasSelection ? content.slice(start, end) : content

    setBusyAction(action)
    try {
      const { text } = await generateText({
        prompt: target,
        action,
        product_ids: products.map((p) => p.id),
      })
      if (hasSelection) {
        setContent(content.slice(0, start) + text + content.slice(end))
      } else {
        setContent(text)
      }
      toast.success(`${label} applied`)
    } catch (e: any) {
      toast.error(`${label} failed`, {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  /* --------------------------------------------------------------- */
  /* Persistence helper — create the post if it does not exist yet    */
  /* --------------------------------------------------------------- */

  const buildBody = useCallback(
    () => ({
      content: content.trim() || null,
      hashtags: hashtags.trim() || null,
      link: link.trim() || null,
      product_ids: products.map((p) => p.id),
      platforms: Array.from(platforms),
      tone,
      length,
      brand_voice_id: brandVoiceId || null,
      targets: Object.entries(overrides)
        .filter(([, v]) => v && v.trim())
        .map(([platform, v]) => ({ platform, content: v ?? null })),
    }),
    [
      content,
      hashtags,
      link,
      products,
      platforms,
      tone,
      length,
      brandVoiceId,
      overrides,
    ]
  )

  const ensurePost = useCallback(async (): Promise<string> => {
    if (postId) return postId
    const { post } = await createPost(buildBody())
    setPostId(post.id)
    return post.id
  }, [postId, buildBody])

  /* --------------------------------------------------------------- */
  /* Per-platform tailor                                              */
  /* --------------------------------------------------------------- */

  const handleTailor = async (platform: Platform, instruction: string) => {
    if (!content.trim() && !overrides[platform]?.trim()) {
      toast.error("Write the master content first")
      return
    }
    setTailoring(platform)
    try {
      const id = await ensurePost()
      const detail = await tailorTarget(id, { platform, instruction })
      const t = (detail.targets ?? []).find((x) => x.platform === platform)
      if (t?.content) {
        setOverrides((prev) => ({ ...prev, [platform]: t.content ?? "" }))
      }
      toast.success(`Tailored for ${platformMeta(platform).label}`)
    } catch (e: any) {
      toast.error("Could not tailor", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setTailoring(null)
    }
  }

  /* --------------------------------------------------------------- */
  /* Bottom bar actions                                               */
  /* --------------------------------------------------------------- */

  const preflight = (): boolean => {
    if (platforms.size === 0) {
      toast.error("Pick at least one platform")
      return false
    }
    if (!content.trim()) {
      toast.error("Write some content first")
      return false
    }
    return true
  }

  const runAction = async (
    key: string,
    fn: (id: string) => Promise<unknown>,
    successMsg: string
  ) => {
    if (!preflight()) return
    setBusyAction(key)
    try {
      const id = await ensurePost()
      await fn(id)
      toast.success(successMsg)
      navigate(`/marketing/posts/${id}`)
    } catch (e: any) {
      toast.error("Action failed", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handlePublishNow = () =>
    runAction(
      "publish",
      (id) => approvePost(id, { action: "publish" }),
      "Publishing now"
    )

  const handleSchedule = () => {
    const iso = localInputToISO(scheduledAt)
    if (!iso) {
      toast.error("Pick a date and time to schedule")
      return
    }
    if (new Date(iso).getTime() < Date.now()) {
      toast.error("Schedule time is in the past")
      return
    }
    return runAction(
      "schedule",
      (id) => schedulePost(id, { scheduled_at: iso }),
      "Post scheduled"
    )
  }

  const handleSubmitApproval = () =>
    runAction(
      "submit",
      (id) => approvePost(id, { action: "submit" }),
      "Submitted for approval"
    )

  const handleSaveDraft = async () => {
    if (!content.trim() && !prompt.trim()) {
      toast.error("Nothing to save yet")
      return
    }
    setBusyAction("draft")
    try {
      const id = await ensurePost()
      toast.success("Draft saved")
      navigate(`/marketing/posts/${id}`)
    } catch (e: any) {
      toast.error("Could not save draft", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  const anyBusy = generating || !!busyAction || !!tailoring

  /* --------------------------------------------------------------- */
  /* Render                                                           */
  /* --------------------------------------------------------------- */

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="border-b border-ui-border-base">
        <PageHeader
          icon={PencilSquare}
          accent="violet"
          title="Compose"
          subtitle="Draft once, tailor per platform, and preview before it ships."
        />
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-12">
        {/* ---------------------------------------------------------- */}
        {/* LEFT                                                       */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-y-6 border-b border-ui-border-base px-6 py-5 lg:col-span-3 lg:border-b-0 lg:border-r">
          <Section title="Platforms" icon={<Adjustments />}>
            <div className="flex flex-col gap-y-1">
              {PLATFORMS.map((p) => (
                <label
                  key={p.value}
                  className="flex cursor-pointer items-center gap-x-3 rounded-md px-2 py-1.5 transition-colors hover:bg-ui-bg-base-hover"
                >
                  <Checkbox
                    checked={platforms.has(p.value)}
                    onCheckedChange={() => togglePlatform(p.value)}
                  />
                  <PlatformChip platform={p.value} />
                  <Text size="small">{p.label}</Text>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Products" icon={<Tag />}>
            {products.length > 0 && (
              <div className="mb-2 flex flex-col gap-y-1.5">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-x-2 rounded-md border border-ui-border-base bg-ui-bg-subtle px-2 py-1.5"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-base text-ui-fg-muted">
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Photo />
                      )}
                    </div>
                    <Text size="xsmall" className="min-w-0 flex-1 truncate">
                      {p.title}
                    </Text>
                    <IconButton
                      size="2xsmall"
                      variant="transparent"
                      onClick={() =>
                        setProducts((prev) =>
                          prev.filter((x) => x.id !== p.id)
                        )
                      }
                    >
                      <XMarkMini />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="small"
              variant="secondary"
              className="w-full"
              onClick={() => setPickerOpen(true)}
            >
              <Tag />
              {products.length ? "Edit products" : "Attach product"}
            </Button>
          </Section>

          <Section title="Media" icon={<Photo />}>
            {media.length > 0 && (
              <div className="mb-2 grid grid-cols-3 gap-2">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="relative aspect-square overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-subtle"
                  >
                    <img
                      src={m.url}
                      alt={m.alt ?? ""}
                      className="size-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <Button
              size="small"
              variant="secondary"
              className="w-full"
              onClick={() =>
                toast.info("Media upload", {
                  description: "Uploading from the composer is coming soon.",
                })
              }
            >
              <ArrowUpTray />
              Attach media
            </Button>
            <Text size="xsmall" className="mt-1.5 text-ui-fg-muted">
              Some platforms need an image or video to publish.
            </Text>
          </Section>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* CENTER                                                     */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-y-5 border-b border-ui-border-base px-6 py-5 lg:col-span-6 lg:border-b-0 lg:border-r">
          {/* AI assist */}
          <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
            <div className="flex items-center gap-x-2">
              <span className="text-ui-fg-interactive">
                <Sparkles />
              </span>
              <Text size="small" weight="plus">
                AI assist
              </Text>
            </div>
            <Textarea
              value={prompt}
              rows={2}
              placeholder="What should this post be about? e.g. Launch our new linen shirt for summer."
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <LabeledSelect
                label="Tone"
                value={tone}
                options={TONES}
                onChange={setTone}
              />
              <LabeledSelect
                label="Length"
                value={length}
                options={LENGTHS}
                onChange={setLength}
              />
              {brandVoices.length > 0 && (
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Brand voice
                  </Label>
                  <Select
                    size="small"
                    value={brandVoiceId}
                    onValueChange={setBrandVoiceId}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Default" />
                    </Select.Trigger>
                    <Select.Content>
                      {brandVoices.map((v) => (
                        <Select.Item key={v.id} value={v.id}>
                          {v.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="small" onClick={handleGenerate} isLoading={generating}>
                <Sparkles />
                Generate
              </Button>
            </div>
          </div>

          {/* Master content */}
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <Label size="small" weight="plus">
                Content
              </Label>
              <div className="flex items-center gap-x-1">
                {SPARKLE_ACTIONS.map((s) => (
                  <Button
                    key={s.action}
                    size="small"
                    variant="transparent"
                    disabled={anyBusy}
                    isLoading={busyAction === s.action}
                    onClick={() => applySparkle(s.action, s.label)}
                  >
                    <Sparkles />
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              ref={contentRef}
              value={content}
              rows={8}
              placeholder="Write your post, or generate a draft above and refine it here."
              onChange={(e) => setContent(e.target.value)}
            />
            <Text size="xsmall" className="text-right text-ui-fg-muted">
              {content.length} characters
            </Text>
          </div>

          {/* Hashtags + link */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Hashtags
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ui-fg-muted">
                  <Hashtag />
                </span>
                <Input
                  value={hashtags}
                  placeholder="#summer #linen #newarrival"
                  className="pl-9"
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Link
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ui-fg-muted">
                  <LinkIcon />
                </span>
                <Input
                  value={link}
                  placeholder="https://store.com/product"
                  className="pl-9"
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Per-platform overrides */}
          {selectedPlatforms.length > 0 && (
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Per-platform overrides
              </Label>
              <div className="flex flex-col gap-y-2">
                {selectedPlatforms.map((p) => {
                  const isOpen = expanded.has(p.value)
                  const value = overrides[p.value] ?? ""
                  return (
                    <div
                      key={p.value}
                      className="overflow-hidden rounded-lg border border-ui-border-base"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(p.value)}
                        className="flex w-full items-center gap-x-2 bg-ui-bg-subtle px-3 py-2 text-left transition-colors hover:bg-ui-bg-base-hover"
                      >
                        <span className="text-ui-fg-muted">
                          {isOpen ? <ChevronDown /> : <ChevronRight />}
                        </span>
                        <PlatformChip platform={p.value} showLabel />
                        {value ? (
                          <Text size="xsmall" className="text-ui-fg-muted">
                            overridden
                          </Text>
                        ) : (
                          <Text size="xsmall" className="text-ui-fg-muted">
                            uses master content
                          </Text>
                        )}
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-y-2 border-t border-ui-border-base bg-ui-bg-base px-3 py-3">
                          <Textarea
                            value={value}
                            rows={4}
                            placeholder={`Override the copy for ${p.label}…`}
                            onChange={(e) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [p.value]: e.target.value,
                              }))
                            }
                          />
                          <div className="flex items-center justify-between">
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {(value || content).length}/{p.charLimit}
                            </Text>
                            <div className="flex items-center gap-x-2">
                              {value && (
                                <Button
                                  size="small"
                                  variant="transparent"
                                  onClick={() =>
                                    setOverrides((prev) => {
                                      const next = { ...prev }
                                      delete next[p.value]
                                      return next
                                    })
                                  }
                                >
                                  Reset
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="secondary"
                                isLoading={tailoring === p.value}
                                disabled={anyBusy}
                                onClick={() =>
                                  handleTailor(
                                    p.value,
                                    `Rewrite this post specifically for ${p.label}.`
                                  )
                                }
                              >
                                <Sparkles />
                                Tailor with AI
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* RIGHT — live preview                                        */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-y-4 px-6 py-5 lg:col-span-3">
          <Text size="small" weight="plus">
            Preview
          </Text>
          {selectedPlatforms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ui-border-strong px-4 py-10 text-center">
              <Text size="small" className="text-ui-fg-muted">
                Select a platform to preview.
              </Text>
            </div>
          ) : (
            <div className="flex flex-col gap-y-3">
              {selectedPlatforms.map((p) => (
                <PreviewCard
                  key={p.value}
                  platform={p.value}
                  content={overrides[p.value] || content}
                  hashtags={hashtags}
                  link={link}
                  hasMedia={media.length > 0}
                  products={products}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* BOTTOM — schedule bar                                       */}
      {/* ---------------------------------------------------------- */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-y-3 border-t border-ui-border-base bg-ui-bg-base px-6 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-x-2">
          <Button
            size="small"
            variant="secondary"
            disabled={anyBusy}
            isLoading={busyAction === "draft"}
            onClick={handleSaveDraft}
          >
            Save draft
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={anyBusy}
            isLoading={busyAction === "submit"}
            onClick={handleSubmitApproval}
          >
            Submit for approval
          </Button>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-x-2">
            <Input
              type="datetime-local"
              size="small"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <Button
              size="small"
              variant="secondary"
              disabled={anyBusy}
              isLoading={busyAction === "schedule"}
              onClick={handleSchedule}
            >
              Schedule
            </Button>
          </div>
          <Button
            size="small"
            disabled={anyBusy}
            isLoading={busyAction === "publish"}
            onClick={handlePublishNow}
          >
            Publish now
          </Button>
        </div>
      </div>

      <ProductPicker
        open={pickerOpen}
        initialSelected={products}
        onClose={() => setPickerOpen(false)}
        onConfirm={(picked) => {
          setProducts(picked)
          setPickerOpen(false)
        }}
      />
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Preview card                                                        */
/* ------------------------------------------------------------------ */

function PreviewCard({
  platform,
  content,
  hashtags,
  link,
  hasMedia,
  products,
}: {
  platform: Platform
  content: string
  hashtags: string
  link: string
  hasMedia: boolean
  products: PickerProduct[]
}) {
  const meta = platformMeta(platform)
  const body = [content, hashtags].filter((s) => s && s.trim()).join("\n\n")
  const over = body.length > meta.charLimit
  const needsMedia = meta.requiresMedia && !hasMedia
  const thumb = products[0]?.thumbnail ?? null

  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest">
      <div className="flex items-center gap-x-2 border-b border-ui-border-base px-3 py-2">
        <PlatformChip platform={platform} showLabel />
        <div className="ml-auto flex items-center gap-x-1.5">
          <Text
            size="xsmall"
            className={clx(
              "tabular-nums",
              over ? "text-ui-fg-error" : "text-ui-fg-muted"
            )}
          >
            {body.length}/{meta.charLimit}
          </Text>
        </div>
      </div>

      {/* Media placeholder */}
      <div className="flex aspect-video items-center justify-center bg-ui-bg-subtle text-ui-fg-muted">
        {hasMedia || thumb ? (
          thumb ? (
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <Photo />
          )
        ) : (
          <div className="flex flex-col items-center gap-y-1">
            <Photo />
            <Text size="xsmall" className="text-ui-fg-muted">
              No media
            </Text>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-y-2 px-3 py-3">
        {content.trim() ? (
          <Text size="small" className="whitespace-pre-wrap">
            {content}
          </Text>
        ) : (
          <Text size="small" className="italic text-ui-fg-muted">
            Your copy will appear here.
          </Text>
        )}
        {hashtags.trim() && (
          <Text size="small" className="text-ui-fg-interactive">
            {hashtags}
          </Text>
        )}
        {link.trim() && (
          <Text size="xsmall" className="truncate text-ui-fg-muted">
            {link}
          </Text>
        )}
      </div>

      {(over || needsMedia) && (
        <div className="flex flex-col gap-y-1 border-t border-ui-border-base bg-ui-bg-subtle px-3 py-2">
          {over && (
            <Warning>
              {body.length - meta.charLimit} characters over the {meta.label}{" "}
              limit.
            </Warning>
          )}
          {needsMedia && (
            <Warning>{meta.label} needs an image or video to publish.</Warning>
          )}
        </div>
      )}
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-x-1.5 text-ui-fg-error">
      <span className="mt-0.5">
        <ExclamationCircle />
      </span>
      <Text size="xsmall">{children}</Text>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-center gap-x-1.5 text-ui-fg-subtle">
        <span className="text-ui-fg-muted">{icon}</span>
        <Text size="xsmall" weight="plus" className="uppercase tracking-wide">
          {title}
        </Text>
      </div>
      {children}
    </div>
  )
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-y-1">
      <Label size="xsmall" className="text-ui-fg-subtle">
        {label}
      </Label>
      <Select size="small" value={value} onValueChange={onChange}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((o) => (
            <Select.Item key={o} value={o}>
              {o.charAt(0).toUpperCase() + o.slice(1)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Compose",
  icon: PencilSquare,
})

export default ComposePage
