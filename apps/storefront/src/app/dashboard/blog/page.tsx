"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpRightOnBox,
  BookOpen,
  PencilSquare,
  Plus,
  Sparkles,
  Trash,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { AutopilotModal } from "./autopilot-modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { ApiError } from "@lib/merchant-admin/api"
import {
  BlogPost,
  deleteBlogPost,
  listBlogPosts,
  publishBlogPost,
  unpublishBlogPost,
} from "@lib/merchant-admin/blog-api"

function storeBaseUrl(store?: { domain?: string | null; slug?: string } | null) {
  if (!store) return null
  if (store.domain) return `https://${store.domain}`
  if (store.slug) return `https://${store.slug}.mautomate.ai`
  return null
}

export default function BlogPostsPage() {
  const { token, me, logout } = useMerchantAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [autopilotOpen, setAutopilotOpen] = useState(false)

  const baseUrl = storeBaseUrl(me?.store)

  const loadPosts = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listBlogPosts(token, { limit: 200 })
      setPosts(res.posts || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load blog posts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const togglePublish = async (post: BlogPost) => {
    if (!token) return
    setBusyId(post.id)
    setError(null)
    try {
      if (post.status === "published") {
        await unpublishBlogPost(token, post.id)
      } else {
        await publishBlogPost(token, post.id)
      }
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update post")
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteBlogPost(token, deleteTarget.id)
      setDeleteTarget(null)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post")
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (p: BlogPost) => (
        <div className="flex items-center gap-3">
          {p.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.cover_image}
              alt=""
              className="h-9 w-9 shrink-0 rounded-base border border-grey-20 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base border border-grey-20 bg-grey-10">
              <BookOpen className="h-4 w-4 text-grey-40" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-grey-90">{p.title}</p>
            <p className="truncate text-xs text-grey-50">/blog/{p.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p: BlogPost) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={p.status} />
          {p.status === "draft" && p.scheduled_at && (
            <span className="text-xs text-grey-50">
              Scheduled {new Date(p.scheduled_at).toLocaleString()}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "categories",
      header: "Categories",
      render: (p: BlogPost) => (
        <span className="text-grey-60">
          {(p.categories || []).map((c) => c.name).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (p: BlogPost) => (
        <span className="text-grey-60">
          {new Date(p.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Write and publish articles on your store's blog."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutopilotOpen(true)}
              className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
            >
              <Sparkles className="h-4 w-4" />
              Autopilot
            </button>
            <button
              onClick={() => router.push("/dashboard/blog/categories")}
              className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
            >
              Categories
            </button>
            <button
              onClick={() => router.push("/dashboard/blog/new")}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              <Plus className="h-4 w-4" />
              New post
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<BlogPost>
        columns={columns}
        rows={posts}
        searchKeys={["title", "slug"]}
        filterKey="status"
        filterOptions={[
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
        ]}
        sortKeys={[
          { key: "title", label: "Title" },
          { key: "created_at", label: "Created" },
        ]}
        onRowClick={(p) => router.push(`/dashboard/blog/${p.id}`)}
        rowActions={(p) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu
              items={[
                {
                  label: "Edit",
                  icon: PencilSquare,
                  onClick: () => router.push(`/dashboard/blog/${p.id}`),
                },
                {
                  label:
                    busyId === p.id
                      ? "Working..."
                      : p.status === "published"
                      ? "Unpublish"
                      : "Publish",
                  icon: BookOpen,
                  onClick: () => togglePublish(p),
                },
                ...(p.status === "published" && baseUrl
                  ? [
                      {
                        label: "View on site",
                        icon: ArrowUpRightOnBox,
                        onClick: () =>
                          window.open(`${baseUrl}/blog/${p.slug}`, "_blank"),
                      },
                    ]
                  : []),
                {
                  label: "Delete",
                  icon: Trash,
                  destructive: true,
                  onClick: () => setDeleteTarget(p),
                },
              ]}
            />
          </div>
        )}
        emptyIcon={BookOpen}
        emptyTitle="No blog posts yet"
        emptyDescription="Share news, guides and stories — posts appear on your store's /blog page."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/blog/new")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Write your first post
          </button>
        }
        isLoading={loading}
        pageSize={20}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this post?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed from your blog. This action cannot be undone.`
            : ""
        }
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
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

      <AutopilotModal open={autopilotOpen} onClose={() => setAutopilotOpen(false)} />
    </div>
  )
}
