"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { createCollection, CreateCollectionInput, ApiError } from "@lib/merchant-admin/api"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Ll}\p{Lo}\p{Lm}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function CreateCollectionPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTitleChange = (value: string) => {
    setTitle(value)
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
      const body: CreateCollectionInput = {
        title,
        handle: handle || slugify(title),
      }
      await createCollection(token, body)
      router.push("/dashboard/collections")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create collection")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Create collection"
      subtitle="Add a new product collection."
      footer={
        <>
          <RouteModalFooterAction
            variant="secondary"
            onClick={() => router.push("/dashboard/collections")}
          >
            Cancel
          </RouteModalFooterAction>
          <RouteModalFooterAction
            type="submit"
            disabled={!title || saving}
            onClick={() => handleSubmit()}
          >
            {saving ? "Creating..." : "Create collection"}
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
        <SectionCard title="Details" description="Basic collection information.">
          <div className="space-y-4">
            <FormField label="Title" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Summer 2024"
                required
              />
            </FormField>
            <FormField label="Handle" htmlFor="handle" hint="Used in the collection URL.">
              <Input
                id="handle"
                value={handle}
                onChange={(e) => handleHandleChange(e.target.value)}
                placeholder="summer-2024"
                required
              />
            </FormField>
          </div>
        </SectionCard>
      </form>
    </RouteModal>
  )
}
