"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Sparkles,
  ArrowUpTray,
  Trash,
  Link as LinkIcon,
  Hashtag,
  Calendar,
  Photo,
  ExclamationCircle,
} from "@medusajs/icons"
import {
  ApiError,
  SocialAccount,
  MarketingPost,
  MarketingPostMedia,
  CreatePostPlatformTarget,
  createMarketingPost,
  updateMarketingPost,
  getMarketingPost,
  schedulePost,
  uploadPostMedia,
  generateMarketingPost,
  reworkMarketingPost,
  tailorMarketingPost,
} from "@lib/merchant-admin/api"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input, Textarea } from "@components/merchant-admin/form-field"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import {
  PLATFORMS,
  platformMeta,
  parseHashtags,
  toDatetimeLocal,
  fromDatetimeLocal,
  earliestScheduledAt,
  formatDateTime,
} from "./post-utils"

type OverrideState = { body: string; hashtags: string }

// A media item shown in the composer. `persisted` rows already exist on the
// server (edit mode); `pending` rows were uploaded in create mode and are sent
// in the create body's `media` array.
type MediaItem = {
  key: string
  url: string | null
  file_id: string | null
  kind: "image" | "video"
  alt: string | null
  persisted: boolean
}

function mediaFromServer(m: MarketingPostMedia): MediaItem {
  return {
    key: m.id,
    url: m.url,
    file_id: m.file_id,
    kind: m.kind,
    alt: m.alt,
    persisted: true,
  }
}

export function PostComposer({
  open,
  onClose,
  editingId,
  token,
  accounts,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editingId: string | null
  token: string
  accounts: SocialAccount[]
  onSaved: () => void
}) {
  const [currentId, setCurrentId] = useState<string | null>(editingId)
  const [detail, setDetail] = useState<MarketingPost | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [platforms, setPlatforms] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({})
  const [media, setMedia] = useState<MediaItem[]>([])
  const [scheduleAt, setScheduleAt] = useState("")

  const [tab, setTab] = useState<string>("compose")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [reworkInstruction, setReworkInstruction] = useState("")
  const [tailorInstruction, setTailorInstruction] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const mode = currentId ? "edit" : "create"

  const resetForm = () => {
    setTitle("")
    setBody("")
    setHashtags("")
    setLinkUrl("")
    setPlatforms([])
    setOverrides({})
    setMedia([])
    setScheduleAt("")
    setTab("compose")
    setAiPrompt("")
    setReworkInstruction("")
    setTailorInstruction({})
    setError(null)
    setNotice(null)
    setDetail(null)
  }

  const hydrateFrom = (post: MarketingPost) => {
    setDetail(post)
    setTitle(post.title || "")
    setBody(post.body || "")
    setHashtags(Array.isArray(post.hashtags) ? post.hashtags.join(" ") : "")
    setLinkUrl(post.link_url || "")
    const targetPlatforms = (post.targets || []).map((t) => t.platform)
    setPlatforms(Array.from(new Set(targetPlatforms)))
    const nextOverrides: Record<string, OverrideState> = {}
    for (const t of post.targets || []) {
      nextOverrides[t.platform] = {
        body: t.override_body || "",
        hashtags: Array.isArray(t.override_hashtags)
          ? t.override_hashtags.join(" ")
          : "",
      }
    }
    setOverrides(nextOverrides)
    setMedia((post.media || []).map(mediaFromServer))
    setScheduleAt(toDatetimeLocal(earliestScheduledAt(post)))
  }

  const loadDetail = async (id: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const { post } = await getMarketingPost(token, id)
      hydrateFrom(post)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load post")
    } finally {
      setLoadingDetail(false)
    }
  }

  // Reset / hydrate when the dialog opens or the target changes.
  useEffect(() => {
    if (!open) return
    resetForm()
    setCurrentId(editingId)
    if (editingId) {
      loadDetail(editingId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId])

  // Connected accounts grouped so a merchant can toggle platforms they own.
  const connectedPlatforms = useMemo(() => {
    const set = new Set<string>()
    for (const a of accounts) {
      if (a.status === "connected") set.add(a.platform)
    }
    return set
  }, [accounts])

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
    setTab((t) => (t === p ? "compose" : t))
  }

  const setOverride = (platform: string, patch: Partial<OverrideState>) => {
    setOverrides((prev) => ({
      ...prev,
      [platform]: { body: "", hashtags: "", ...prev[platform], ...patch },
    }))
  }

  const removeMedia = (key: string) => {
    setMedia((prev) => prev.filter((m) => m.key !== key))
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const { media: uploaded } = await uploadPostMedia(token, file, {
        post_id: mode === "edit" && currentId ? currentId : undefined,
      })
      setMedia((prev) => [
        ...prev,
        {
          key: uploaded.id || `pending-${Date.now()}`,
          url: uploaded.url,
          file_id: uploaded.file_id,
          kind: uploaded.kind,
          alt: uploaded.alt,
          persisted: mode === "edit",
        },
      ])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Media upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const buildPlatformTargets = (): CreatePostPlatformTarget[] =>
    platforms.map((p) => {
      const ov = overrides[p]
      const overrideBody = ov?.body?.trim()
      const overrideTags = ov ? parseHashtags(ov.hashtags) : []
      if (overrideBody || overrideTags.length) {
        return {
          platform: p,
          ...(overrideBody ? { override_body: overrideBody } : {}),
          ...(overrideTags.length ? { override_hashtags: overrideTags } : {}),
        }
      }
      return p
    })

  const handleSave = async () => {
    if (!title.trim() && !body.trim()) {
      setError("Provide at least a title or body.")
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    let keepOpen = false
    try {
      const tags = parseHashtags(hashtags)
      const scheduledIso = fromDatetimeLocal(scheduleAt)

      if (mode === "create") {
        if (scheduledIso && !platforms.length) {
          setError("Pick at least one target platform to schedule the post.")
          setSaving(false)
          return
        }
        const media_ = media
          .filter((m) => m.url || m.file_id)
          .map((m, i) => ({
            ...(m.url ? { url: m.url } : {}),
            ...(m.file_id ? { file_id: m.file_id } : {}),
            kind: m.kind,
            ...(m.alt ? { alt: m.alt } : {}),
            position: i,
          }))
        await createMarketingPost(token, {
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          hashtags: tags.length ? tags : undefined,
          link_url: linkUrl.trim() || undefined,
          platforms: platforms.length ? buildPlatformTargets() : undefined,
          scheduled_at: scheduledIso && platforms.length ? scheduledIso : undefined,
          media: media_.length ? media_ : undefined,
        })
      } else if (currentId) {
        await updateMarketingPost(token, currentId, {
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          hashtags: tags.length ? tags : undefined,
          link_url: linkUrl.trim() || undefined,
        })
        // Reconcile the schedule against the current targets.
        const hasTargets = (detail?.targets || []).length > 0
        const currentIso = earliestScheduledAt(detail || ({} as MarketingPost))
        if (hasTargets && scheduledIso !== currentIso) {
          await schedulePost(token, currentId, { scheduled_at: scheduledIso })
        } else if (scheduledIso && !hasTargets) {
          keepOpen = true
          setNotice(
            "Saved. Scheduling was skipped because this post has no platform targets — targets can only be added when creating a post."
          )
        }
      }
      onSaved()
      if (!keepOpen) onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save post")
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError("Describe what the post should say to generate copy.")
      return
    }
    setAiBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await generateMarketingPost(token, {
        prompt: aiPrompt.trim(),
        platforms: platforms.length ? platforms : undefined,
        title: title.trim() || undefined,
      })
      setCurrentId(res.post.id)
      hydrateFrom(res.post)
      onSaved()
      if (res.needs_ai) {
        setNotice(
          "A draft was created but AI copy could not be generated — no OpenAI key is configured on the backend. Add one to enable generation, or write the copy manually."
        )
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate post")
    } finally {
      setAiBusy(false)
    }
  }

  const handleRework = async () => {
    if (!currentId || !reworkInstruction.trim()) {
      setError("Enter a rework instruction (e.g. “make it punchier”).")
      return
    }
    setAiBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await reworkMarketingPost(token, currentId, {
        instruction: reworkInstruction.trim(),
      })
      hydrateFrom(res.post)
      setReworkInstruction("")
      if (res.needs_ai) {
        setNotice(
          "Rework is unavailable — no OpenAI key is configured on the backend. The copy is unchanged."
        )
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rework post")
    } finally {
      setAiBusy(false)
    }
  }

  const handleTailor = async (platform: string) => {
    if (!currentId) return
    setAiBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await tailorMarketingPost(token, currentId, {
        platform,
        instruction: tailorInstruction[platform]?.trim() || undefined,
      })
      hydrateFrom(res.post)
      if (res.needs_ai) {
        setNotice(
          "Tailoring is unavailable — no OpenAI key is configured on the backend."
        )
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to tailor post")
    } finally {
      setAiBusy(false)
    }
  }

  const tabs = ["compose", ...platforms, "preview"]
  const targetByPlatform = (platform: string) =>
    (detail?.targets || []).find((t) => t.platform === platform) || null

  const bodyCount = body.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit post" : "Compose post"}
      description={
        mode === "edit"
          ? "Update the copy, tailor per platform, and schedule."
          : "Write once, target multiple platforms, schedule or publish."
      }
      size="xl"
    >
      {loadingDetail ? (
        <div className="py-16 text-center text-sm text-grey-50">Loading post…</div>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {error && (
            <div className="flex items-start gap-2 rounded-base border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 rounded-base border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-grey-20">
            {tabs.map((t) => {
              const label =
                t === "compose"
                  ? "Compose"
                  : t === "preview"
                  ? "Preview"
                  : platformMeta(t).label
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize " +
                    (tab === t
                      ? "border-grey-90 text-grey-90"
                      : "border-transparent text-grey-50 hover:text-grey-80")
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>

          {tab === "compose" && (
            <div className="space-y-4">
              <FormField label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Internal title / headline"
                />
              </FormField>

              <FormField
                label="Body"
                hint={`${bodyCount} characters`}
              >
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What do you want to say?"
                  className="min-h-[140px]"
                />
              </FormField>

              {/* AI copy */}
              <div className="rounded-base border border-grey-20 bg-grey-5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-grey-70">
                  <Sparkles className="h-4 w-4" /> AI copy
                </div>
                {mode === "create" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe the post to generate…"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={aiBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      {aiBusy ? "Generating…" : "Generate"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={reworkInstruction}
                      onChange={(e) => setReworkInstruction(e.target.value)}
                      placeholder="Rework instruction (e.g. make it punchier)…"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleRework}
                      disabled={aiBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-80 hover:bg-grey-5 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      {aiBusy ? "Reworking…" : "Rework"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Link URL">
                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://…"
                      className="pl-9"
                    />
                  </div>
                </FormField>
                <FormField label="Hashtags" hint="Space or comma separated">
                  <div className="relative">
                    <Hashtag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
                    <Input
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="sale summer newarrivals"
                      className="pl-9"
                    />
                  </div>
                </FormField>
              </div>

              {/* Media */}
              <FormField
                label="Media"
                hint="Images or video, up to 10MB each."
              >
                <div className="space-y-3">
                  {media.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {media.map((m) => (
                        <div
                          key={m.key}
                          className="group relative h-20 w-20 overflow-hidden rounded-base border border-grey-20 bg-grey-5"
                        >
                          {m.kind === "image" && m.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.url}
                              alt={m.alt || ""}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-grey-40">
                              <Photo className="h-6 w-6" />
                            </div>
                          )}
                          {(!m.persisted || mode === "create") && (
                            <button
                              type="button"
                              onClick={() => removeMedia(m.key)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Remove media"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,video/mp4,video/quicktime"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUpload(f)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm font-medium text-grey-80 hover:bg-grey-5 disabled:opacity-50"
                    >
                      <ArrowUpTray className="h-4 w-4" />
                      {uploading ? "Uploading…" : "Upload media"}
                    </button>
                  </div>
                </div>
              </FormField>

              {/* Target platforms */}
              <FormField
                label="Target platforms"
                hint={
                  mode === "edit"
                    ? "Targets are set when the post is created and cannot be changed here."
                    : "Pick the connected accounts to publish to."
                }
              >
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon
                    const active = platforms.includes(p.value)
                    const connected = connectedPlatforms.has(p.value)
                    const disabled = mode === "edit"
                    return (
                      <button
                        key={p.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => togglePlatform(p.value)}
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium " +
                          (active
                            ? "border-grey-90 bg-grey-90 text-white"
                            : "border-grey-20 text-grey-70 hover:bg-grey-5") +
                          (disabled ? " cursor-not-allowed opacity-60" : "")
                        }
                        title={
                          connected
                            ? `Connected`
                            : `No connected ${p.label} account`
                        }
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {p.label}
                        {!connected && (
                          <span
                            className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
                            title="Not connected"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
                {mode === "create" &&
                  platforms.some((p) => !connectedPlatforms.has(p)) && (
                    <p className="mt-2 text-xs text-amber-700">
                      Some selected platforms have no connected account yet —
                      connect them on the Connect page before publishing.
                    </p>
                  )}
              </FormField>

              {/* Schedule */}
              <FormField
                label="Schedule"
                hint={
                  mode === "create"
                    ? "Optional. Requires at least one target platform."
                    : "Set or clear the scheduled time for this post's targets."
                }
              >
                <div className="relative sm:w-72">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </FormField>
            </div>
          )}

          {/* Per-platform tabs */}
          {platforms.includes(tab) && (
            <div className="space-y-4">
              {mode === "create" ? (
                <>
                  <p className="text-sm text-grey-50">
                    Override the copy for {platformMeta(tab).label}. Leave blank
                    to use the main body and hashtags.
                  </p>
                  <FormField label={`${platformMeta(tab).label} body override`}>
                    <Textarea
                      value={overrides[tab]?.body || ""}
                      onChange={(e) => setOverride(tab, { body: e.target.value })}
                      placeholder="Platform-specific copy…"
                    />
                  </FormField>
                  <FormField
                    label={`${platformMeta(tab).label} hashtags override`}
                    hint="Space or comma separated"
                  >
                    <Input
                      value={overrides[tab]?.hashtags || ""}
                      onChange={(e) =>
                        setOverride(tab, { hashtags: e.target.value })
                      }
                      placeholder="platform specific tags"
                    />
                  </FormField>
                </>
              ) : (
                <>
                  {(() => {
                    const t = targetByPlatform(tab)
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          {t && <StatusBadge status={t.status} />}
                          {t?.scheduled_at && (
                            <span className="text-xs text-grey-50">
                              Scheduled {formatDateTime(t.scheduled_at)}
                            </span>
                          )}
                          {t?.external_url && (
                            <a
                              href={t.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-sky-600 underline"
                            >
                              View published
                            </a>
                          )}
                        </div>
                        {t?.error && (
                          <p className="text-xs text-rose-600">{t.error}</p>
                        )}
                        <FormField
                          label={`${platformMeta(tab).label} override`}
                          hint="Current per-platform copy (edit via AI tailor below)."
                        >
                          <Textarea
                            readOnly
                            value={
                              t?.override_body ||
                              "No override — uses the main body."
                            }
                            className="bg-grey-5"
                          />
                        </FormField>
                        <div className="rounded-base border border-grey-20 bg-grey-5 p-3">
                          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-grey-70">
                            <Sparkles className="h-4 w-4" /> Tailor for{" "}
                            {platformMeta(tab).label}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={tailorInstruction[tab] || ""}
                              onChange={(e) =>
                                setTailorInstruction((prev) => ({
                                  ...prev,
                                  [tab]: e.target.value,
                                }))
                              }
                              placeholder="Optional steer (e.g. add emojis)…"
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleTailor(tab)}
                              disabled={aiBusy}
                              className="inline-flex items-center justify-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-80 hover:bg-grey-5 disabled:opacity-50"
                            >
                              <Sparkles className="h-4 w-4" />
                              {aiBusy ? "Tailoring…" : "Tailor"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}

          {/* Preview */}
          {tab === "preview" && (
            <PostPreview
              title={title}
              body={body}
              hashtags={parseHashtags(hashtags)}
              linkUrl={linkUrl}
              media={media}
              platforms={platforms}
            />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-grey-20 pt-4">
        <div className="text-xs text-grey-50">
          {mode === "edit" && detail ? (
            <span className="inline-flex items-center gap-2">
              Status <StatusBadge status={detail.status} />
            </span>
          ) : (
            <span>New draft</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-70 hover:bg-grey-5"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!title.trim() && !body.trim())}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : mode === "edit"
              ? "Save changes"
              : "Create post"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function PostPreview({
  title,
  body,
  hashtags,
  linkUrl,
  media,
  platforms,
}: {
  title: string
  body: string
  hashtags: string[]
  linkUrl: string
  media: MediaItem[]
  platforms: string[]
}) {
  const firstImage = media.find((m) => m.kind === "image" && m.url)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {platforms.length === 0 ? (
          <span className="text-xs text-grey-50">No platforms selected</span>
        ) : (
          platforms.map((p) => {
            const meta = platformMeta(p)
            const Icon = meta.icon
            return (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full bg-grey-10 px-2 py-0.5 text-xs text-grey-70"
              >
                <Icon className="h-3 w-3" /> {meta.label}
              </span>
            )
          })
        )}
      </div>
      <div className="mx-auto max-w-md rounded-large border border-grey-20 bg-white p-4 shadow-borders-base">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-grey-20" />
          <div>
            <p className="text-sm font-semibold text-grey-90">Your brand</p>
            <p className="text-xs text-grey-40">Just now</p>
          </div>
        </div>
        {title && <p className="mb-1 text-sm font-semibold text-grey-90">{title}</p>}
        {body ? (
          <p className="whitespace-pre-wrap text-sm text-grey-80">{body}</p>
        ) : (
          <p className="text-sm italic text-grey-40">No body yet…</p>
        )}
        {hashtags.length > 0 && (
          <p className="mt-1 text-sm text-sky-600">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}
        {firstImage?.url && (
          <div className="mt-3 overflow-hidden rounded-base border border-grey-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={firstImage.url} alt="" className="max-h-64 w-full object-cover" />
          </div>
        )}
        {linkUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-base border border-grey-20 bg-grey-5 p-2 text-xs text-grey-60">
            <LinkIcon className="h-3.5 w-3.5" />
            <span className="truncate">{linkUrl}</span>
          </div>
        )}
      </div>
    </div>
  )
}
