"use client"

import React, { useEffect, useState } from "react"
import { ArrowUturnLeft, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listReturnReasons,
  createReturnReason,
  updateReturnReason,
  deleteReturnReason,
  ReturnReason,
  ApiError,
} from "@lib/merchant-admin/api"

export default function ReturnReasonsPage() {
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<ReturnReason[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ReturnReason | null>(null)
  const [value, setValue] = useState("")
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadReasons = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listReturnReasons(token)
      setItems(res.return_reasons || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load return reasons")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReasons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout])

  const openCreate = () => {
    setEditing(null)
    setValue("")
    setLabel("")
    setDescription("")
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (reason: ReturnReason) => {
    setEditing(reason)
    setValue(reason.value)
    setLabel(reason.label)
    setDescription(reason.description || "")
    setFormError(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !label.trim()) return
    if (!editing && !value.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateReturnReason(token, editing.id, {
          label: label.trim(),
          description: description.trim() || null,
        })
      } else {
        await createReturnReason(token, {
          value: value.trim(),
          label: label.trim(),
          description: description.trim() || undefined,
        })
      }
      setModalOpen(false)
      await loadReasons()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setFormError(err instanceof Error ? err.message : "Failed to save return reason")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (reason: ReturnReason) => {
    if (!token) return
    if (!confirm(`Delete return reason "${reason.label}"?`)) return
    try {
      await deleteReturnReason(token, reason.id)
      await loadReasons()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete return reason")
    }
  }

  const columns = [
    { key: "label", header: "Label", sortable: true },
    {
      key: "value",
      header: "Value",
      render: (r: ReturnReason) => (
        <span className="font-mono text-sm text-grey-70">{r.value}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (r: ReturnReason) => (
        <span className="text-grey-70">{r.description || "—"}</span>
      ),
    },
  ]

  const createButton = (
    <button
      onClick={openCreate}
      className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
    >
      <Plus className="h-4 w-4" />
      Create return reason
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Return reasons"
        description="Manage the reasons customers can select when requesting a return."
        action={createButton}
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<ReturnReason>
        columns={columns}
        rows={items}
        searchKeys={["label", "value"]}
        sortKeys={[{ key: "label", label: "Label" }]}
        rowActions={(r) => (
          <>
            <button
              onClick={() => openEdit(r)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              title="Edit"
            >
              <PencilSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(r)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={ArrowUturnLeft}
        emptyTitle="No return reasons"
        emptyDescription="Create your first return reason to streamline returns."
        emptyAction={createButton}
        isLoading={loading}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit return reason" : "Create return reason"}
        description="Shown to customers when they request a return."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Value"
              htmlFor="reason-value"
              hint="Unique identifier, e.g. damaged"
            >
              <Input
                id="reason-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="damaged"
                disabled={!!editing}
              />
            </FormField>
            <FormField label="Label" htmlFor="reason-label">
              <Input
                id="reason-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Item damaged"
              />
            </FormField>
          </div>
          <FormField label="Description" htmlFor="reason-description" hint="Optional">
            <Textarea
              id="reason-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when this reason applies"
              rows={3}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim() || (!editing && !value.trim())}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save reason" : "Create reason"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
