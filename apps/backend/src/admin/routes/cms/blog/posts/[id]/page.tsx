/**
 * Forever Finds CMS — Blog post editor (Phase 8).
 *
 * Edits a single blog post: title, slug, excerpt, cover image, rich-text body
 * (HTML editor — TipTap is not installed, so the styled-textarea fallback is
 * used), author, categories, SEO, and status / publish controls. EN/BN tabs
 * localise the translatable text (title, excerpt, content, SEO) — EN lives on
 * the base post, BN is a sparse override row.
 *
 * This route has no `defineRouteConfig`, so it is reachable at
 * /cms/blog/posts/:id but does not appear in the sidebar.
 *
 * API (cookie-session, /admin/cms/* guard):
 *   GET/PUT/DELETE /admin/cms/blog/posts/:id
 *   POST/DELETE    /admin/cms/blog/posts/:id/publish
 *   GET            /admin/cms/blog/authors, /admin/cms/blog/categories
 */
import {
  ArrowLeft,
  Clock,
  Plus,
  RocketLaunch,
  Trash,
  XMarkMini,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  DatePicker,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  clx,
  toast,
  usePrompt,
} from "@medusajs/ui"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useNavigate, useParams } from "react-router-dom"

import { ImagePicker } from "../../../../../components/cms/image-picker"
import { HtmlEditor } from "../../html-editor"
import {
  cancelSchedule,
  createAuthor,
  createCategory,
  deletePost,
  formatDateTime,
  getPost,
  listAuthors,
  listCategories,
  LOCALE_LABEL,
  LOCALES,
  postTranslation,
  publishPost,
  slugify,
  STATUS_BADGE,
  unpublishPost,
  updatePost,
  type BlogAuthor,
  type BlogCategory,
  type BlogPostFull,
  type Locale,
  type PostScalarInput,
} from "../../lib"

/* ================================================================== */
/* Editable form state                                                 */
/* ================================================================== */

type FormState = {
  // EN base fields.
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image: string
  seo_title: string
  seo_description: string
  og_image: string
  author_id: string
  category_ids: string[]
  // BN override fields (sparse — empty falls back to EN).
  bn_title: string
  bn_excerpt: string
  bn_content: string
  bn_seo_title: string
  bn_seo_description: string
  bn_og_image: string
}

function toForm(post: BlogPostFull): FormState {
  const bn = postTranslation(post, "bn")
  return {
    title: post.title ?? "",
    slug: post.slug ?? "",
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    cover_image: post.cover_image ?? "",
    seo_title: post.seo_title ?? "",
    seo_description: post.seo_description ?? "",
    og_image: post.og_image ?? "",
    author_id: post.author_id ?? post.author?.id ?? "",
    category_ids: (post.categories ?? []).map((c) => c.id),
    bn_title: bn?.title ?? "",
    bn_excerpt: bn?.excerpt ?? "",
    bn_content: bn?.content ?? "",
    bn_seo_title: bn?.seo_title ?? "",
    bn_seo_description: bn?.seo_description ?? "",
    bn_og_image: bn?.og_image ?? "",
  }
}

const NONE = "__none__"

/* ================================================================== */
/* Post editor                                                         */
/* ================================================================== */

const BlogPostEditor = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const dialog = usePrompt()

  const [post, setPost] = useState<BlogPostFull | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locale, setLocale] = useState<Locale>("en")
  const [dirty, setDirty] = useState(false)

  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])

  const [publishing, setPublishing] = useState(false)
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null)

  const patch = useCallback((next: Partial<FormState>) => {
    setForm((f) => (f ? { ...f, ...next } : f))
    setDirty(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { post } = await getPost(id)
      setPost(post)
      setForm(toForm(post))
      setDirty(false)
    } catch (e: any) {
      toast.error("Could not load post", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const loadRefs = useCallback(() => {
    listAuthors()
      .then((d) => setAuthors(d.authors ?? []))
      .catch(() => setAuthors([]))
    listCategories()
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    loadRefs()
  }, [loadRefs])

  /* -------- save (current locale) -------- */

  const save = async (): Promise<boolean> => {
    if (!form) return false
    if (locale === "en" && !form.title.trim()) {
      toast.error("Title is required")
      return false
    }
    setSaving(true)
    try {
      const body: PostScalarInput =
        locale === "en"
          ? {
              title: form.title.trim(),
              slug: form.slug.trim() || undefined,
              excerpt: form.excerpt.trim() || null,
              content: form.content || null,
              cover_image: form.cover_image || null,
              seo_title: form.seo_title.trim() || null,
              seo_description: form.seo_description.trim() || null,
              og_image: form.og_image || null,
              author_id: form.author_id || null,
              category_ids: form.category_ids,
            }
          : {
              translations: {
                bn: {
                  title: form.bn_title.trim() || null,
                  excerpt: form.bn_excerpt.trim() || null,
                  content: form.bn_content || null,
                  seo_title: form.bn_seo_title.trim() || null,
                  seo_description: form.bn_seo_description.trim() || null,
                  og_image: form.bn_og_image || null,
                },
              },
            }
      const { post: updated } = await updatePost(id, body)
      setPost(updated)
      setForm(toForm(updated))
      setDirty(false)
      toast.success("Post saved")
      return true
    } catch (e: any) {
      toast.error("Could not save post", {
        description: e?.message ?? "Unexpected error.",
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  /* -------- publish / schedule / unpublish -------- */

  const publishNow = async () => {
    // Persist any pending edits first so we publish the latest content.
    if (dirty) {
      const ok = await save()
      if (!ok) return
    }
    setPublishing(true)
    try {
      const { post: updated } = await publishPost(id)
      setPost(updated)
      setForm(toForm(updated))
      setDirty(false)
      toast.success("Post published", { description: `/${updated.slug}` })
    } catch (e: any) {
      toast.error("Publish failed", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPublishing(false)
    }
  }

  const schedule = async () => {
    if (!scheduleAt || scheduleAt.getTime() <= Date.now()) {
      toast.error("Choose a time in the future")
      return
    }
    if (dirty) {
      const ok = await save()
      if (!ok) return
    }
    setPublishing(true)
    try {
      const { post: updated } = await publishPost(id, scheduleAt.toISOString())
      setPost(updated)
      setForm(toForm(updated))
      setDirty(false)
      setScheduleAt(null)
      toast.success("Publish scheduled", {
        description: formatDateTime(scheduleAt.toISOString()),
      })
    } catch (e: any) {
      toast.error("Could not schedule", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPublishing(false)
    }
  }

  const cancelScheduled = async () => {
    setPublishing(true)
    try {
      const { post: updated } = await cancelSchedule(id)
      setPost(updated)
      setForm(toForm(updated))
      toast.success("Schedule cancelled")
    } catch (e: any) {
      toast.error("Could not cancel schedule", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPublishing(false)
    }
  }

  const unpublish = async () => {
    const ok = await dialog({
      title: "Unpublish post",
      description:
        "The post will be hidden from the storefront and revert to a draft. You can publish it again later.",
      confirmText: "Unpublish",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    setPublishing(true)
    try {
      const { post: updated } = await unpublishPost(id)
      setPost(updated)
      setForm(toForm(updated))
      toast.success("Post unpublished")
    } catch (e: any) {
      toast.error("Could not unpublish", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setPublishing(false)
    }
  }

  /* -------- delete -------- */

  const removePost = async () => {
    if (!post) return
    const ok = await dialog({
      title: "Delete post",
      description: `"${post.title}" will be removed. This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deletePost(id)
      toast.success("Post deleted")
      navigate("/cms/blog")
    } catch (e: any) {
      toast.error("Could not delete post", { description: e?.message })
    }
  }

  /* ----------------------------------------------------------------- */

  if (loading || !form) {
    return (
      <Container className="p-0">
        <div className="px-6 py-12">
          <Text className="text-ui-fg-subtle">Loading post…</Text>
        </div>
      </Container>
    )
  }

  if (!post) {
    return (
      <Container className="p-0">
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text className="text-ui-fg-subtle">Post not found.</Text>
          <Button
            size="small"
            variant="secondary"
            onClick={() => navigate("/cms/blog")}
          >
            <ArrowLeft />
            Back to blog
          </Button>
        </div>
      </Container>
    )
  }

  const badge = STATUS_BADGE[post.status]
  const isEn = locale === "en"

  return (
    <Container className="p-0">
      {/* Top bar */}
      <div className="flex flex-col gap-y-4 border-b border-ui-border-base px-6 py-4">
        <button
          type="button"
          onClick={() => navigate("/cms/blog")}
          className="flex w-fit items-center gap-x-1 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ArrowLeft />
          <Text size="small">Blog</Text>
        </button>

        <div className="flex flex-col gap-y-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-col gap-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Heading level="h2" className="truncate">
                {post.title}
              </Heading>
              <Badge size="2xsmall" color={badge.color}>
                {badge.label}
              </Badge>
              {post.scheduled_at && post.status !== "published" && (
                <Badge size="2xsmall" color="orange">
                  Scheduled
                </Badge>
              )}
              {dirty && (
                <Badge size="2xsmall" color="orange">
                  Unsaved changes
                </Badge>
              )}
            </div>
            <Text size="small" className="font-mono text-ui-fg-subtle">
              /blog/{post.slug}
            </Text>
          </div>

          <div className="flex shrink-0 items-center gap-x-3">
            <LocaleSwitcher locale={locale} onChange={setLocale} />
            <Button size="small" onClick={save} isLoading={saving}>
              Save
            </Button>
          </div>
        </div>

        {!isEn && (
          <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-4 py-2.5">
            <Text size="small" className="text-ui-tag-orange-text">
              Editing Bengali (বাংলা) overrides. Only translatable text (title,
              excerpt, body, SEO) is editable here — cover image, author,
              categories and status are shared with English. Leave a field empty
              to fall back to the English value.
            </Text>
          </div>
        )}

        {/* Publish controls */}
        <PublishControls
          post={post}
          busy={publishing}
          scheduleAt={scheduleAt}
          onScheduleChange={setScheduleAt}
          onPublishNow={publishNow}
          onSchedule={schedule}
          onCancelSchedule={cancelScheduled}
          onUnpublish={unpublish}
        />
      </div>

      {/* Body: two columns */}
      <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-y-6 lg:col-span-2">
          {isEn ? (
            <>
              <Field label="Title">
                <Input
                  value={form.title}
                  placeholder="The art of handmade gifts"
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <Field
                label="Slug"
                hint="The storefront URL (/blog/<slug>). Must be unique."
              >
                <Input
                  value={form.slug}
                  className="font-mono"
                  onChange={(e) => patch({ slug: slugify(e.target.value) })}
                />
              </Field>
              <Field
                label="Excerpt"
                hint="A short summary shown on cards and in search results."
              >
                <Textarea
                  value={form.excerpt}
                  rows={3}
                  placeholder="A one or two sentence teaser…"
                  onChange={(e) => patch({ excerpt: e.target.value })}
                />
              </Field>
              <Field label="Content">
                <HtmlEditor
                  value={form.content}
                  onChange={(v) => patch({ content: v })}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Title · বাংলা">
                <Input
                  value={form.bn_title}
                  placeholder={form.title}
                  onChange={(e) => patch({ bn_title: e.target.value })}
                />
              </Field>
              <Field label="Excerpt · বাংলা">
                <Textarea
                  value={form.bn_excerpt}
                  rows={3}
                  placeholder={form.excerpt || "Bengali excerpt…"}
                  onChange={(e) => patch({ bn_excerpt: e.target.value })}
                />
              </Field>
              <Field
                label="Content · বাংলা"
                hint="Leave empty to use the English body."
              >
                <HtmlEditor
                  value={form.bn_content}
                  placeholder="Leave empty to use the English content."
                  onChange={(v) => patch({ bn_content: v })}
                />
              </Field>
            </>
          )}
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-y-6">
          {/* Cover image (locale-invariant — EN only) */}
          <SideCard title="Cover image">
            {isEn ? (
              <ImagePicker
                hint="Shown as the hero and on listing cards."
                clearable
                value={form.cover_image}
                onChange={(url) => patch({ cover_image: url })}
              />
            ) : (
              <SharedFieldNote />
            )}
          </SideCard>

          {/* Author (EN only) */}
          <SideCard title="Author">
            {isEn ? (
              <AuthorSelect
                authors={authors}
                value={form.author_id}
                onChange={(v) => patch({ author_id: v })}
                onCreated={(a) => {
                  setAuthors((prev) => [...prev, a])
                  patch({ author_id: a.id })
                }}
              />
            ) : (
              <SharedFieldNote />
            )}
          </SideCard>

          {/* Categories (EN only) */}
          <SideCard title="Categories">
            {isEn ? (
              <CategoryPicker
                categories={categories}
                selected={form.category_ids}
                onChange={(ids) => patch({ category_ids: ids })}
                onCreated={(c) => {
                  setCategories((prev) => [...prev, c])
                  patch({ category_ids: [...form.category_ids, c.id] })
                }}
              />
            ) : (
              <SharedFieldNote />
            )}
          </SideCard>

          {/* SEO (translatable) */}
          <SideCard title="SEO">
            {isEn ? (
              <div className="flex flex-col gap-y-4">
                <Field
                  label="SEO title"
                  hint="Defaults to the post title when empty."
                >
                  <Input
                    value={form.seo_title}
                    placeholder={form.title}
                    onChange={(e) => patch({ seo_title: e.target.value })}
                  />
                </Field>
                <Field
                  label="SEO description"
                  hint="Defaults to the excerpt when empty."
                >
                  <Textarea
                    value={form.seo_description}
                    rows={3}
                    placeholder={form.excerpt}
                    onChange={(e) =>
                      patch({ seo_description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Social share image (og:image)">
                  <ImagePicker
                    hint="Defaults to the cover image when empty."
                    clearable
                    value={form.og_image}
                    onChange={(url) => patch({ og_image: url })}
                  />
                </Field>
              </div>
            ) : (
              <div className="flex flex-col gap-y-4">
                <Field label="SEO title · বাংলা">
                  <Input
                    value={form.bn_seo_title}
                    placeholder={form.seo_title || form.title}
                    onChange={(e) => patch({ bn_seo_title: e.target.value })}
                  />
                </Field>
                <Field label="SEO description · বাংলা">
                  <Textarea
                    value={form.bn_seo_description}
                    rows={3}
                    placeholder={form.seo_description || form.excerpt}
                    onChange={(e) =>
                      patch({ bn_seo_description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Social share image · বাংলা">
                  <ImagePicker
                    hint="Leave empty to use the English / cover image."
                    clearable
                    value={form.bn_og_image}
                    onChange={(url) => patch({ bn_og_image: url })}
                  />
                </Field>
              </div>
            )}
          </SideCard>

          {/* Meta */}
          <SideCard title="Details">
            <div className="flex flex-col gap-y-2">
              <MetaRow
                label="Reading time"
                value={
                  post.reading_time
                    ? `${post.reading_time} min`
                    : "Auto-estimated"
                }
              />
              <MetaRow
                label="Published"
                value={formatDateTime(post.published_at)}
              />
              <MetaRow
                label="Last updated"
                value={formatDateTime(post.updated_at)}
              />
            </div>
          </SideCard>
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex justify-end border-t border-ui-border-base px-6 py-4">
        <Button
          size="small"
          variant="transparent"
          className="text-ui-fg-error"
          onClick={removePost}
        >
          <Trash />
          Delete post
        </Button>
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Locale switcher                                                     */
/* ------------------------------------------------------------------ */

function LocaleSwitcher({
  locale,
  onChange,
}: {
  locale: Locale
  onChange: (l: Locale) => void
}) {
  return (
    <div className="flex items-center gap-x-1 rounded-lg bg-ui-bg-subtle p-0.5">
      {LOCALES.map((l) => (
        <Button
          key={l}
          size="small"
          variant={locale === l ? "primary" : "transparent"}
          onClick={() => onChange(l)}
          aria-label={`Edit ${LOCALE_LABEL[l]} content`}
        >
          {LOCALE_LABEL[l]}
        </Button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Publish controls                                                    */
/* ------------------------------------------------------------------ */

function PublishControls({
  post,
  busy,
  scheduleAt,
  onScheduleChange,
  onPublishNow,
  onSchedule,
  onCancelSchedule,
  onUnpublish,
}: {
  post: BlogPostFull
  busy: boolean
  scheduleAt: Date | null
  onScheduleChange: (d: Date | null) => void
  onPublishNow: () => void
  onSchedule: () => void
  onCancelSchedule: () => void
  onUnpublish: () => void
}) {
  const isPublished = post.status === "published"
  const isScheduled = !isPublished && !!post.scheduled_at
  const future = !!scheduleAt && scheduleAt.getTime() > Date.now()

  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
      <div className="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-x-2">
          <RocketLaunch className="text-ui-fg-subtle" />
          <Text size="small" weight="plus">
            Publishing
          </Text>
          {isPublished ? (
            <Badge size="2xsmall" color="green">
              Live{post.published_at ? ` · ${formatDateTime(post.published_at)}` : ""}
            </Badge>
          ) : isScheduled ? (
            <Badge size="2xsmall" color="orange">
              Scheduled · {formatDateTime(post.scheduled_at)}
            </Badge>
          ) : (
            <Badge size="2xsmall" color="grey">
              Draft
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="small" onClick={onPublishNow} isLoading={busy}>
            <RocketLaunch />
            {isPublished ? "Republish" : "Publish now"}
          </Button>
          {isPublished && (
            <Button
              size="small"
              variant="secondary"
              onClick={onUnpublish}
              disabled={busy}
            >
              Unpublish
            </Button>
          )}
          {isScheduled && (
            <Button
              size="small"
              variant="secondary"
              onClick={onCancelSchedule}
              disabled={busy}
            >
              <XMarkMini />
              Cancel schedule
            </Button>
          )}
        </div>
      </div>

      {/* Schedule a future publish (draft only) */}
      {!isPublished && (
        <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
          <div className="flex items-center gap-x-2">
            <Clock className="text-ui-fg-subtle" />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Or schedule it to go live automatically at a future time.
            </Text>
          </div>
          <div className="flex flex-col gap-x-2 gap-y-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <DatePicker
                granularity="minute"
                value={scheduleAt}
                onChange={onScheduleChange}
                minValue={new Date()}
                shouldCloseOnSelect={false}
                aria-label="Scheduled publish date and time"
              />
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={onSchedule}
              isLoading={busy}
              disabled={!future}
            >
              <Clock />
              Schedule
            </Button>
          </div>
          {scheduleAt && !future && (
            <Text size="xsmall" className="text-ui-fg-error">
              Choose a time in the future.
            </Text>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Author select (+ inline create)                                     */
/* ------------------------------------------------------------------ */

function AuthorSelect({
  authors,
  value,
  onChange,
  onCreated,
}: {
  authors: BlogAuthor[]
  value: string
  onChange: (id: string) => void
  onCreated: (a: BlogAuthor) => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const { author } = await createAuthor({ name: name.trim() })
      toast.success("Author created")
      setName("")
      setCreating(false)
      onCreated(author)
    } catch (e: any) {
      toast.error("Could not create author", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Select
        value={value || NONE}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
      >
        <Select.Trigger>
          <Select.Value placeholder="No author" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={NONE}>No author</Select.Item>
          {authors.map((a) => (
            <Select.Item key={a.id} value={a.id}>
              {a.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {creating ? (
        <div className="flex items-center gap-x-2">
          <Input
            autoFocus
            size="small"
            value={name}
            placeholder="Author name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button size="small" onClick={add} isLoading={saving}>
            Add
          </Button>
          <Button
            size="small"
            variant="transparent"
            onClick={() => {
              setCreating(false)
              setName("")
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="small"
          variant="transparent"
          className="w-fit"
          onClick={() => setCreating(true)}
        >
          <Plus />
          New author
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Category picker (chip toggles + inline create)                      */
/* ------------------------------------------------------------------ */

function CategoryPicker({
  categories,
  selected,
  onChange,
  onCreated,
}: {
  categories: BlogCategory[]
  selected: string[]
  onChange: (ids: string[]) => void
  onCreated: (c: BlogCategory) => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const { category } = await createCategory({ name: name.trim() })
      toast.success("Category created")
      setName("")
      setCreating(false)
      onCreated(category)
    } catch (e: any) {
      toast.error("Could not create category", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      {categories.length === 0 ? (
        <Text size="xsmall" className="text-ui-fg-muted">
          No categories yet — create one below.
        </Text>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = selectedSet.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={clx(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  on
                    ? "border-ui-border-interactive bg-ui-bg-interactive text-ui-fg-on-color"
                    : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                )}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      {creating ? (
        <div className="flex items-center gap-x-2">
          <Input
            autoFocus
            size="small"
            value={name}
            placeholder="Category name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button size="small" onClick={add} isLoading={saving}>
            Add
          </Button>
          <Button
            size="small"
            variant="transparent"
            onClick={() => {
              setCreating(false)
              setName("")
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="small"
          variant="transparent"
          className="w-fit"
          onClick={() => setCreating(true)}
        >
          <Plus />
          New category
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  )
}

function SideCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-4">
      <Heading level="h3" className="text-ui-fg-base">
        {title}
      </Heading>
      {children}
    </div>
  )
}

function SharedFieldNote() {
  return (
    <Text size="xsmall" className="text-ui-fg-muted">
      Shared across languages — edit on the English tab.
    </Text>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-x-3">
      <Text size="xsmall" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="xsmall" className="truncate text-ui-fg-subtle">
        {value}
      </Text>
    </div>
  )
}

export default BlogPostEditor
