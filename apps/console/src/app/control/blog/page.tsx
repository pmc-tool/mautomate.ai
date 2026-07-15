"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  DocumentText,
  ExclamationCircle,
  PencilSquare,
  Plus,
  Trash,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  createPost,
  deletePost,
  listPosts,
  updatePost,
  type Post,
  type PostStatus,
} from "@/lib/api/blog"
import { DataTable, type Column } from "@/components/data-table"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function formatDate(value?: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString()
}

const searchKeys: (keyof Post)[] = ["title", "slug"]
const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
]

const emptyPost = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  status: "draft" as PostStatus,
}

export default function BlogPage() {
  const { token } = useControlAuth()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [form, setForm] = useState(emptyPost)

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; post: Post | null }>({
    open: false,
    post: null,
  })

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listPosts(token)
      setPosts(res.posts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingPost(null)
    setForm(emptyPost)
    setEditorOpen(true)
  }

  const openEdit = (post: Post) => {
    setEditingPost(post)
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      status: post.status,
    })
    setEditorOpen(true)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return
    if (!form.title.trim() || !form.slug.trim()) {
      setError("Title and slug are required")
      return
    }
    setWorkingId(editingPost?.id ?? "create")
    try {
      const payload = {
        ...form,
        slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      }
      if (editingPost) {
        await updatePost(token, editingPost.id, payload)
      } else {
        await createPost(token, payload)
      }
      await load()
      setEditorOpen(false)
      setForm(emptyPost)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post")
    } finally {
      setWorkingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteModal.post) return
    setWorkingId(deleteModal.post.id)
    try {
      await deletePost(token, deleteModal.post.id)
      await load()
      setDeleteModal({ open: false, post: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post")
    } finally {
      setWorkingId(null)
    }
  }

  const columns = useMemo<Column<Post>[]>(
    () => [
      {
        key: "title",
        header: "Title",
        render: (row) => (
          <div>
            <p className="font-medium text-grey-90">{row.title}</p>
            <p className="text-xs text-grey-50">/{row.slug}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "published_at",
        header: "Published",
        render: (row) => <span className="text-grey-70">{formatDate(row.published_at)}</span>,
      },
      {
        key: "created_at",
        header: "Created",
        render: (row) => <span className="text-grey-70">{formatDate(row.created_at)}</span>,
      },
    ],
    []
  )

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-base border px-2.5 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20 disabled:cursor-not-allowed disabled:opacity-50"

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={openCreate}
        className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
      >
        <Plus className="h-4 w-4" />
        New post
      </button>
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Site / Blog"
        description="Create and manage platform blog posts and pages."
        action={headerActions}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={posts}
          searchKeys={searchKeys}
          filterKey="status"
          filterOptions={statusOptions}
          isLoading={loading}
          emptyIcon={DocumentText}
          emptyTitle="No posts yet"
          emptyDescription="Create your first blog post or marketing page."
          rowActions={(row) => [
            <button
              key={`edit-${row.id}`}
              onClick={() => openEdit(row)}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-grey-20 bg-white text-grey-70 hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              )}
            >
              <PencilSquare className="h-3.5 w-3.5" />
              Edit
            </button>,
            <button
              key={`delete-${row.id}`}
              onClick={() => setDeleteModal({ open: true, post: row })}
              disabled={workingId === row.id}
              className={cn(
                actionBtn,
                "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
              )}
            >
              <Trash className="h-3.5 w-3.5" />
            </button>,
          ]}
        />
      </div>

      <Modal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setForm(emptyPost)
        }}
        title={editingPost ? "Edit post" : "Create post"}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="post-title" className="mb-1.5 block text-sm font-medium text-grey-70">
              Title
            </label>
            <input
              id="post-title"
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Post title"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          <div>
            <label htmlFor="post-slug" className="mb-1.5 block text-sm font-medium text-grey-70">
              Slug
            </label>
            <input
              id="post-slug"
              type="text"
              required
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="post-slug"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          <div>
            <label
              htmlFor="post-excerpt"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Excerpt
            </label>
            <input
              id="post-excerpt"
              type="text"
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              placeholder="Short summary"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          <div>
            <label
              htmlFor="post-status"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Status
            </label>
            <select
              id="post-status"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as PostStatus }))
              }
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="post-content"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Content
            </label>
            <textarea
              id="post-content"
              rows={8}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Write post content…"
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditorOpen(false)
                setForm(emptyPost)
              }}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingId === (editingPost?.id ?? "create")}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              {editingPost ? "Save changes" : "Create post"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, post: null })}
        title="Delete post"
        description={
          deleteModal.post
            ? `Delete "${deleteModal.post.title}"? This cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleteModal({ open: false, post: null })}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={workingId === deleteModal.post?.id}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
