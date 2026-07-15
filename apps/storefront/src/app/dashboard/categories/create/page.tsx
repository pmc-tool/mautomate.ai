"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createCategory,
  listCategories,
  CreateCategoryInput,
  ApiError,
  ProductCategory,
} from "@lib/merchant-admin/api"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Ll}\p{Lo}\p{Lm}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type FlatOption = { id: string; name: string; depth: number }

export default function CreateCategoryPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [visibility, setVisibility] = useState<"public" | "internal">("public")
  const [parentId, setParentId] = useState<string>("")
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    listCategories(token)
      .then((r) => setCategories(r.categories || []))
      .catch(() => {})
  }, [token])

  // Flatten the category tree into indented parent options (any level).
  const parentOptions = useMemo<FlatOption[]>(() => {
    const out: FlatOption[] = []
    const childrenOf = (pid: string | null) =>
      categories
        .filter((c) => (c.parent?.id ?? null) === pid)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    const walk = (pid: string | null, depth: number) => {
      for (const c of childrenOf(pid)) {
        out.push({ id: c.id, name: c.name, depth })
        walk(c.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [categories])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!handleEdited) {
      setHandle(slugify(value))
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const body: CreateCategoryInput = {
        name: name.trim(),
        handle: handle.trim() || slugify(name),
        description: description.trim() || undefined,
        status,
        visibility,
        parent_id: parentId || null,
      }
      const { category } = await createCategory(token, body)
      router.push(`/dashboard/categories/${category.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create category")
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Create Category"
      subtitle="Create a new category to organize your products."
      footer={
        <>
          <RouteModalFooterAction
            variant="secondary"
            onClick={() => router.push("/dashboard/categories")}
          >
            Cancel
          </RouteModalFooterAction>
          <RouteModalFooterAction
            type="submit"
            disabled={!name.trim() || saving}
            onClick={() => handleSubmit()}
          >
            {saving ? "Saving..." : "Save"}
          </RouteModalFooterAction>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <SectionCard title="Details" description="Basic category information.">
          <div className="space-y-4">
            <FormField label="Title" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Clothing"
                required
              />
            </FormField>
            <FormField label="Handle" htmlFor="handle" hint="Used in the category URL.">
              <Input
                id="handle"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value)
                  setHandleEdited(true)
                }}
                placeholder="clothing"
              />
            </FormField>
            <FormField label="Description" htmlFor="description">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                rows={3}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Status" htmlFor="status">
                <Select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormField>
              <FormField label="Visibility" htmlFor="visibility">
                <Select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "public" | "internal")}
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Parent category" htmlFor="parent">
              <Select
                id="parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">No parent</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${"  ".repeat(c.depth)}${c.name}`}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </SectionCard>
      </form>
    </RouteModal>
  )
}
