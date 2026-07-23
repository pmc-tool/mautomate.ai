"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, PencilSquare, Plus, Tag, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import {
  FormField,
  Input,
  Textarea,
} from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { ApiError } from "@lib/merchant-admin/api"
import {
  BlogCategory,
  createBlogCategory,
  deleteBlogCategory,
  listBlogCategories,
  updateBlogCategory,
} from "@lib/merchant-admin/blog-api"

export default function BlogCategoriesPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<BlogCategory | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [savingCategory, setSavingCategory] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BlogCategory | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCategories = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listBlogCategories(token)
      setItems(res.categories || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const openCreate = () => {
    setEditing(null)
    setName("")
    setDescription("")
    setEditorOpen(true)
  }

  const openEdit = (category: BlogCategory) => {
    setEditing(category)
    setName(category.name)
    setDescription(category.description || "")
    setEditorOpen(true)
  }

  const saveCategory = async () => {
    if (!token || !name.trim()) return
    setSavingCategory(true)
    setError(null)
    try {
      if (editing) {
        await updateBlogCategory(token, editing.id, {
          name: name.trim(),
          description: description.trim() || null,
        })
      } else {
        await createBlogCategory(token, {
          name: name.trim(),
          description: description.trim() || null,
        })
      }
      setEditorOpen(false)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category")
    } finally {
      setSavingCategory(false)
    }
  }

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteBlogCategory(token, deleteTarget.id)
      setDeleteTarget(null)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category")
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (c: BlogCategory) => (
        <span className="font-medium text-grey-90">{c.name}</span>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      render: (c: BlogCategory) => (
        <span className="text-grey-60">/{c.slug}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (c: BlogCategory) => (
        <span className="text-grey-60">{c.description || "—"}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog categories"
        description="Group blog posts so shoppers can browse by topic."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/blog")}
              className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
            >
              <ArrowLeft className="h-4 w-4" />
              Posts
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
            >
              <Plus className="h-4 w-4" />
              New category
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<BlogCategory>
        columns={columns}
        rows={items}
        searchKeys={["name", "slug"]}
        rowActions={(c) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu
              items={[
                {
                  label: "Edit",
                  icon: PencilSquare,
                  onClick: () => openEdit(c),
                },
                {
                  label: "Delete",
                  icon: Trash,
                  destructive: true,
                  onClick: () => setDeleteTarget(c),
                },
              ]}
            />
          </div>
        )}
        onRowClick={openEdit}
        emptyIcon={Tag}
        emptyTitle="No categories yet"
        emptyDescription="Create categories to organize your blog posts."
        emptyAction={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            New category
          </button>
        }
        isLoading={loading}
        pageSize={20}
      />

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "Edit category" : "New category"}
        size="sm"
      >
        <div className="space-y-4">
          <FormField label="Name" htmlFor="category-name">
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Gift guides"
            />
          </FormField>
          <FormField label="Description" htmlFor="category-description">
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              disabled={savingCategory}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveCategory}
              disabled={savingCategory || !name.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingCategory ? "Saving..." : editing ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this category?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed. Posts in it are kept.`
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
    </div>
  )
}
