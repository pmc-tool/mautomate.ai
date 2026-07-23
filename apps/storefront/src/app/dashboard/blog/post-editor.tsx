"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRightOnBox, Photo, Sparkles, Trash, XMark } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { Modal } from "@components/merchant-admin/modal"
import {
  FormField,
  Input,
  Select,
  Textarea,
} from "@components/merchant-admin/form-field"
import { RichTextEditor } from "@components/merchant-admin/rich-text-editor"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { ApiError, listProducts, Product } from "@lib/merchant-admin/api"
import {
  BlogAuthor,
  BlogCategory,
  BlogPost,
  BlogPostInput,
  createBlogAuthor,
  createBlogCategory,
  createBlogPost,
  deleteBlogPost,
  getBlogPost,
  listBlogAuthors,
  listBlogCategories,
  publishBlogPost,
  unpublishBlogPost,
  updateBlogPost,
  uploadBlogMedia,
  composeBlogPost,
  generateBlogImage,
  generateBlogVideo,
} from "@lib/merchant-admin/blog-api"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function storeBaseUrl(store?: { domain?: string | null; slug?: string } | null) {
  if (!store) return null
  if (store.domain) return `https://${store.domain}`
  if (store.slug) return `https://${store.slug}.mautomate.ai`
  return null
}

export function PostEditor({ postId }: { postId?: string }) {
  const { token, me, logout } = useMerchantAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(!!postId)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [post, setPost] = useState<BlogPost | null>(null)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [content, setContent] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")
  const [authorId, setAuthorId] = useState<string>("")
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [addingCategory, setAddingCategory] = useState(false)
  const [newAuthor, setNewAuthor] = useState("")
  const [addingAuthor, setAddingAuthor] = useState(false)
  const [showAuthorInput, setShowAuthorInput] = useState(false)

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBrief, setAiBrief] = useState("")
  const [aiTone, setAiTone] = useState("friendly")
  const [aiLength, setAiLength] = useState("medium")
  const [aiBusy, setAiBusy] = useState(false)
  const [coverAiOpen, setCoverAiOpen] = useState(false)
  const [coverProducts, setCoverProducts] = useState<Product[]>([])
  const [coverProductsLoaded, setCoverProductsLoaded] = useState(false)
  const [coverProductUrl, setCoverProductUrl] = useState<string | null>(null)
  const [coverAiPrompt, setCoverAiPrompt] = useState("")
  const [coverAiBusy, setCoverAiBusy] = useState(false)

  const baseUrl = storeBaseUrl(me?.store)
  const isNew = !postId

  const applyPost = (p: BlogPost) => {
    setPost(p)
    setTitle(p.title || "")
    setSlug(p.slug || "")
    setSlugTouched(true)
    setContent(p.content || "")
    setExcerpt(p.excerpt || "")
    setCoverImage(p.cover_image || null)
    setSeoTitle(p.seo_title || "")
    setSeoDescription(p.seo_description || "")
    setAuthorId(p.author?.id || p.author_id || "")
    setCategoryIds((p.categories || []).map((c) => c.id))
  }

  useEffect(() => {
    if (!token) return
    const load = async () => {
      try {
        const [cats, auths] = await Promise.all([
          listBlogCategories(token),
          listBlogAuthors(token),
        ])
        setCategories(cats.categories || [])
        setAuthors(auths.authors || [])
        if (postId) {
          const res = await getBlogPost(token, postId)
          applyPost(res.post)
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load post")
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, postId])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const buildInput = (): BlogPostInput => ({
    title: title.trim(),
    slug: slug.trim() || undefined,
    content,
    excerpt: excerpt.trim() || null,
    cover_image: coverImage,
    seo_title: seoTitle.trim() || null,
    seo_description: seoDescription.trim() || null,
    author_id: authorId || null,
    category_ids: categoryIds,
  })

  const save = async (): Promise<BlogPost | null> => {
    if (!token) return null
    if (!title.trim()) {
      setError("A title is required.")
      return null
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (isNew) {
        const res = await createBlogPost(token, buildInput())
        setNotice("Draft saved.")
        router.replace(`/dashboard/blog/${res.post.id}`)
        return res.post
      }
      const res = await updateBlogPost(token, postId!, buildInput())
      applyPost(res.post)
      setNotice("Saved.")
      return res.post
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to save post")
      return null
    } finally {
      setSaving(false)
    }
  }

  const publishNow = async () => {
    if (!token) return
    setPublishing(true)
    setError(null)
    try {
      // Persist the latest edits first, then flip live (revalidates the store).
      let target = post
      if (isNew) {
        target = await save()
        if (!target) return
      } else {
        const saved = await save()
        if (!saved) return
        target = saved
      }
      const res = await publishBlogPost(token, target.id)
      applyPost(res.post)
      setNotice("Published — the post is live on your blog.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish post")
    } finally {
      setPublishing(false)
    }
  }

  const schedule = async () => {
    if (!token || !scheduleAt) return
    setPublishing(true)
    setError(null)
    try {
      let target = post
      if (isNew) {
        target = await save()
        if (!target) return
      } else {
        const saved = await save()
        if (!saved) return
        target = saved
      }
      const iso = new Date(scheduleAt).toISOString()
      const res = await publishBlogPost(token, target.id, iso)
      applyPost(res.post)
      setScheduleOpen(false)
      setNotice("Scheduled — the post will publish automatically.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule post")
    } finally {
      setPublishing(false)
    }
  }

  const unpublish = async () => {
    if (!token || !postId) return
    setPublishing(true)
    setError(null)
    try {
      const res = await unpublishBlogPost(token, postId)
      applyPost(res.post)
      setNotice("Unpublished — the post is back to draft.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unpublish post")
    } finally {
      setPublishing(false)
    }
  }

  const confirmDelete = async () => {
    if (!token || !postId) return
    setDeleting(true)
    try {
      await deleteBlogPost(token, postId)
      router.push("/dashboard/blog")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post")
      setDeleting(false)
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    if (!token) throw new Error("Not signed in")
    const res = await uploadBlogMedia(token, file)
    return res.url
  }

  const generateInlineImage = async (prompt: string): Promise<string> => {
    if (!token) throw new Error("Not signed in")
    const res = await generateBlogImage(token, {
      prompt,
      context: { title: title.trim() || undefined },
    })
    return res.url
  }

  const openCoverAi = () => {
    setCoverAiOpen(true)
    if (!coverProductsLoaded && token) {
      setCoverProductsLoaded(true)
      listProducts(token)
        .then((res) =>
          setCoverProducts(
            (res.products || []).filter((p) => p.thumbnail).slice(0, 24)
          )
        )
        .catch(() => undefined)
    }
  }

  const generateInlineVideo = async (
    prompt: string
  ): Promise<{ video_url: string; poster_url: string }> => {
    if (!token) throw new Error("Not signed in")
    return generateBlogVideo(token, prompt)
  }

  const runAiCompose = async () => {
    if (!token || !aiBrief.trim()) return
    setAiBusy(true)
    setError(null)
    try {
      const res = await composeBlogPost(token, {
        brief: aiBrief.trim(),
        tone: aiTone,
        length: aiLength,
      })
      const d = res.draft
      handleTitleChange(d.title)
      setContent(d.content_html)
      setExcerpt(d.excerpt || "")
      setSeoTitle(d.seo_title || "")
      setSeoDescription(d.seo_description || "")
      setAiOpen(false)
      setNotice("Draft written — review it, tweak anything, then save or publish.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI drafting failed")
    } finally {
      setAiBusy(false)
    }
  }

  const runCoverAi = async () => {
    if (!token) return
    if (!coverAiPrompt.trim() && !coverProductUrl && !title.trim()) {
      setError("Give the post a title first, describe the image, or pick a product.")
      return
    }
    setCoverAiBusy(true)
    setError(null)
    try {
      const res = await generateBlogImage(token, {
        prompt: coverAiPrompt.trim() || undefined,
        product_image_url: coverProductUrl,
        context: {
          title: title.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
        },
        orientation: "landscape",
      })
      setCoverImage(res.url)
      setCoverAiOpen(false)
      setNotice("Cover image generated.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed")
    } finally {
      setCoverAiBusy(false)
    }
  }

  const handleCoverSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !token) return
    setCoverUploading(true)
    setError(null)
    try {
      const res = await uploadBlogMedia(token, file)
      setCoverImage(res.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover upload failed")
    } finally {
      setCoverUploading(false)
    }
  }

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const addCategory = async () => {
    if (!token || !newCategory.trim()) return
    setAddingCategory(true)
    setError(null)
    try {
      const res = await createBlogCategory(token, { name: newCategory.trim() })
      setCategories((prev) =>
        [...prev, res.category].sort((a, b) => a.name.localeCompare(b.name))
      )
      setCategoryIds((prev) => [...prev, res.category.id])
      setNewCategory("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category")
    } finally {
      setAddingCategory(false)
    }
  }

  const addAuthor = async () => {
    if (!token || !newAuthor.trim()) return
    setAddingAuthor(true)
    setError(null)
    try {
      const res = await createBlogAuthor(token, { name: newAuthor.trim() })
      setAuthors((prev) =>
        [...prev, res.author].sort((a, b) => a.name.localeCompare(b.name))
      )
      setAuthorId(res.author.id)
      setNewAuthor("")
      setShowAuthorInput(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add author")
    } finally {
      setAddingAuthor(false)
    }
  }

  const status = post?.status ?? "draft"
  const isPublished = status === "published"

  const minSchedule = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000)
    return d.toISOString().slice(0, 16)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-base bg-grey-10" />
        <div className="h-96 animate-pulse rounded-large bg-grey-10" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "New blog post" : "Edit blog post"}
        description={
          isNew
            ? "Write an article for your store's blog."
            : "Changes go live when you save a published post."
        }
        action={
          <div className="flex items-center gap-2">
            {!isNew && isPublished && baseUrl && post && (
              <a
                href={`${baseUrl}/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
              >
                <ArrowUpRightOnBox className="h-4 w-4" />
                View on site
              </a>
            )}
            <button
              onClick={save}
              disabled={saving || publishing}
              className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:opacity-50"
            >
              {saving ? "Saving..." : isPublished ? "Save changes" : "Save draft"}
            </button>
            {isPublished ? (
              <button
                onClick={unpublish}
                disabled={saving || publishing}
                className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:opacity-50"
              >
                {publishing ? "Working..." : "Unpublish"}
              </button>
            ) : (
              <button
                onClick={publishNow}
                disabled={saving || publishing}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rounded-base border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Content"
            action={
              <button
                onClick={() => setAiOpen(true)}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-grey-80"
              >
                <Sparkles className="h-4 w-4" />
                Write with AI
              </button>
            }
          >
            <div className="space-y-4">
              <FormField label="Title" htmlFor="post-title">
                <Input
                  id="post-title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Our summer gift guide"
                />
              </FormField>
              <FormField
                label="Slug"
                htmlFor="post-slug"
                hint={`The post's address: /blog/${slug || "..."}`}
              >
                <Input
                  id="post-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(slugify(e.target.value))
                  }}
                  placeholder="summer-gift-guide"
                />
              </FormField>
              <FormField label="Body">
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  onUploadImage={uploadImage}
                  onGenerateImage={generateInlineImage}
                  onGenerateVideo={generateInlineVideo}
                />
              </FormField>
              <FormField
                label="Excerpt"
                htmlFor="post-excerpt"
                hint="A short summary shown on the blog listing page."
              >
                <Textarea
                  id="post-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                  placeholder="Optional summary..."
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title="Search engine listing"
            description="How this post appears on Google and social shares."
          >
            <div className="space-y-4">
              <FormField label="SEO title" htmlFor="post-seo-title">
                <Input
                  id="post-seo-title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={title || "Defaults to the post title"}
                />
              </FormField>
              <FormField label="SEO description" htmlFor="post-seo-desc">
                <Textarea
                  id="post-seo-desc"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  placeholder={excerpt || "Defaults to the excerpt"}
                />
              </FormField>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-grey-60">Current status</span>
                <StatusBadge status={status} />
              </div>
              {post?.published_at && (
                <p className="text-xs text-grey-50">
                  Published {new Date(post.published_at).toLocaleString()}
                </p>
              )}
              {post?.scheduled_at && status === "draft" && (
                <p className="text-xs text-grey-50">
                  Scheduled for {new Date(post.scheduled_at).toLocaleString()}
                </p>
              )}
              {!isPublished && (
                <button
                  onClick={() => setScheduleOpen(true)}
                  disabled={saving || publishing}
                  className="w-full rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
                >
                  Schedule for later
                </button>
              )}
              {!isNew && (
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-base border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Trash className="h-4 w-4" />
                  Delete post
                </button>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Cover image"
            description="Shown on the blog listing and at the top of the post."
          >
            <div className="space-y-3">
              {coverImage ? (
                <div className="relative overflow-hidden rounded-base border border-grey-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImage}
                    alt="Cover"
                    className="h-40 w-full object-cover"
                  />
                  <button
                    onClick={() => setCoverImage(null)}
                    title="Remove cover image"
                    className="absolute right-2 top-2 rounded-base bg-white/90 p-1 text-grey-70 shadow hover:text-grey-90"
                  >
                    <XMark className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-base border border-dashed border-grey-30 bg-grey-5">
                  <Photo className="h-8 w-8 text-grey-40" />
                </div>
              )}
              <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">
                {coverUploading
                  ? "Uploading..."
                  : coverImage
                  ? "Replace image"
                  : "Upload image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={coverUploading}
                  onChange={handleCoverSelected}
                />
              </label>
              <button
                onClick={openCoverAi}
                className="inline-flex w-full items-center justify-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Organization">
            <div className="space-y-4">
              <FormField label="Categories">
                <div className="space-y-2">
                  {categories.length === 0 && (
                    <p className="text-xs text-grey-50">
                      No categories yet — add one below.
                    </p>
                  )}
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {categories.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded-base px-1 py-1 text-sm text-grey-90 hover:bg-grey-5"
                      >
                        <input
                          type="checkbox"
                          checked={categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                          className="h-4 w-4 rounded border-grey-30"
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCategory()
                        }
                      }}
                      placeholder="New category..."
                    />
                    <button
                      onClick={addCategory}
                      disabled={addingCategory || !newCategory.trim()}
                      className="shrink-0 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </FormField>

              <FormField label="Author">
                <div className="space-y-2">
                  <Select
                    value={authorId}
                    onChange={(e) => setAuthorId(e.target.value)}
                  >
                    <option value="">No author</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  {showAuthorInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={newAuthor}
                        onChange={(e) => setNewAuthor(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addAuthor()
                          }
                        }}
                        placeholder="Author name..."
                        autoFocus
                      />
                      <button
                        onClick={addAuthor}
                        disabled={addingAuthor || !newAuthor.trim()}
                        className="shrink-0 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAuthorInput(true)}
                      className="text-xs font-medium text-grey-60 hover:text-grey-90"
                    >
                      + New author
                    </button>
                  )}
                </div>
              </FormField>
            </div>
          </SectionCard>
        </div>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule this post"
        description="The post stays a draft and publishes automatically at the chosen time."
        size="sm"
      >
        <div className="space-y-4">
          <FormField label="Publish at" htmlFor="schedule-at">
            <Input
              id="schedule-at"
              type="datetime-local"
              value={scheduleAt}
              min={minSchedule}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setScheduleOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={schedule}
              disabled={!scheduleAt || publishing}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? "Scheduling..." : "Schedule"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this post?"
        description={`"${title}" will be removed from your blog. This action cannot be undone.`}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
            className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      <Modal
        open={aiOpen}
        onClose={() => !aiBusy && setAiOpen(false)}
        title="Write with AI"
        description="Describe the post and AI drafts the title, body, excerpt and SEO fields. You review before anything is saved."
        size="md"
      >
        <div className="space-y-4">
          <FormField label="What should the post be about?" htmlFor="ai-brief">
            <Textarea
              id="ai-brief"
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. A gift guide for Eid featuring our handmade candles and home decor, with tips for wrapping"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tone" htmlFor="ai-tone">
              <Select id="ai-tone" value={aiTone} onChange={(e) => setAiTone(e.target.value)}>
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="playful">Playful</option>
                <option value="luxury">Luxury</option>
              </Select>
            </FormField>
            <FormField label="Length" htmlFor="ai-length">
              <Select id="ai-length" value={aiLength} onChange={(e) => setAiLength(e.target.value)}>
                <option value="short">Short (~250 words)</option>
                <option value="medium">Medium (~500 words)</option>
                <option value="long">Long (~900 words)</option>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              disabled={aiBusy}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runAiCompose}
              disabled={aiBusy || !aiBrief.trim()}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {aiBusy ? "Writing..." : "Write the post"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={coverAiOpen}
        onClose={() => !coverAiBusy && setCoverAiOpen(false)}
        title="Generate a cover image"
        description="The cover is matched to your post title automatically. Optionally feature one of your real products in the scene."
        size="md"
      >
        <div className="space-y-4">
          {title.trim() && (
            <p className="rounded-base border border-grey-20 bg-grey-5 px-3 py-2 text-xs text-grey-60">
              Matching the cover to: <span className="font-medium text-grey-90">{title.trim()}</span>
            </p>
          )}
          {coverProducts.length > 0 && (
            <FormField
              label="Feature a product (optional)"
              hint="Your real product photo is placed into the generated scene."
            >
              <div className="flex gap-2 overflow-x-auto pb-1">
                {coverProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.title}
                    onClick={() =>
                      setCoverProductUrl(
                        coverProductUrl === p.thumbnail ? null : (p.thumbnail as string)
                      )
                    }
                    className={
                      coverProductUrl === p.thumbnail
                        ? "shrink-0 rounded-base ring-2 ring-grey-90 ring-offset-2"
                        : "shrink-0 rounded-base border border-grey-20 opacity-80 hover:opacity-100"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnail as string}
                      alt={p.title}
                      className="h-16 w-16 rounded-base object-cover"
                    />
                  </button>
                ))}
              </div>
            </FormField>
          )}
          <FormField
            label="Extra direction (optional)"
            htmlFor="cover-ai-prompt"
            hint="Anything specific about the scene, mood or colors."
          >
            <Textarea
              id="cover-ai-prompt"
              value={coverAiPrompt}
              onChange={(e) => setCoverAiPrompt(e.target.value)}
              rows={2}
              placeholder="e.g. warm flat lay on linen with dried flowers"
            />
          </FormField>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCoverAiOpen(false)}
              disabled={coverAiBusy}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runCoverAi}
              disabled={
                coverAiBusy ||
                (!coverAiPrompt.trim() && !coverProductUrl && !title.trim())
              }
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {coverAiBusy ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
