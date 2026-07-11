"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { createCategory, listCategories, CreateCategoryInput, ApiError, ProductCategory } from "@lib/merchant-admin/api"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

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
  const [parents, setParents] = useState<ProductCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    listCategories(token)
      .then((r) => setParents((r.categories || []).filter((c) => !c.parent)))
      .catch(() => {})
  }, [token])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!handleEdited) {
      setHandle(slugify(value))
    }
  }

  const handleHandleChange = (value: string) => {
    setHandle(value)
    setHandleEdited(true)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const body: CreateCategoryInput = {
        name,
        handle: handle || slugify(name),
        description,
        status,
        visibility,
        parent_id: parentId || null,
      }
      await createCategory(token, body)
      router.push("/dashboard/categories")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create category")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Create category"
      subtitle="Add a new product category."
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
            disabled={!name || saving}
            onClick={() => handleSubmit()}
          >
            {saving ? "Creating..." : "Create category"}
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
            <FormField label="Name" htmlFor="name">
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
                onChange={(e) => handleHandleChange(e.target.value)}
                placeholder="clothing"
                required
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
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
