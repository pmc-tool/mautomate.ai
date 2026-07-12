"use client"

import React, { useEffect, useState } from "react"
import { CurrencyDollar, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listRefundReasons,
  createRefundReason,
  updateRefundReason,
  deleteRefundReason,
  RefundReason,
  ApiError,
} from "@lib/merchant-admin/api"

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export default function RefundReasonsPage() {
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<RefundReason[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RefundReason | null>(null)
  const [label, setLabel] = useState("")
  const [code, setCode] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadReasons = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listRefundReasons(token)
      setItems(res.refund_reasons || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load refund reasons")
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
    setLabel("")
    setCode("")
    setCodeTouched(false)
    setDescription("")
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (reason: RefundReason) => {
    setEditing(reason)
    setLabel(reason.label)
    setCode(reason.code)
    setCodeTouched(true)
    setDescription(reason.description || "")
    setFormError(null)
    setModalOpen(true)
  }

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setLabel(next)
    if (!editing && (!codeTouched || code === "")) {
      setCode(slugify(next))
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value)
    setCodeTouched(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !label.trim() || !code.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateRefundReason(token, editing.id, {
          label: label.trim(),
          code: code.trim(),
          description: description.trim() || null,
        })
      } else {
        await createRefundReason(token, {
          label: label.trim(),
          code: code.trim(),
          description: description.trim() || undefined,
        })
      }
      setModalOpen(false)
      await loadReasons()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setFormError(err instanceof Error ? err.message : "Failed to save refund reason")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (reason: RefundReason) => {
    if (!token) return
    if (
      !confirm(
        `You are about to delete the refund reason "${reason.label}". This action cannot be undone.`
      )
    )
      return
    try {
      await deleteRefundReason(token, reason.id)
      await loadReasons()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete refund reason")
    }
  }

  const columns = [
    { key: "label", header: "Label", sortable: true },
    {
      key: "code",
      header: "Code",
      sortable: true,
      render: (r: RefundReason) => (
        <span className="font-mono text-sm text-grey-70">{r.code}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      sortable: true,
      render: (r: RefundReason) => (
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
      Create refund reason
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refund Reasons"
        description="Manage reasons for issuing refunds."
        action={createButton}
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<RefundReason>
        columns={columns}
        rows={items}
        searchKeys={["label", "code"]}
        sortKeys={[
          { key: "label", label: "Label" },
          { key: "code", label: "Code" },
        ]}
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
        emptyIcon={CurrencyDollar}
        emptyTitle="No refund reasons"
        emptyDescription="Specify the most common reasons for refunds."
        emptyAction={createButton}
        isLoading={loading}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Refund Reason" : "Add Refund Reason"}
        description="Specify the most common reasons for refunds."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <FormField label="Label" htmlFor="refund-label">
            <Input
              id="refund-label"
              value={label}
              onChange={handleLabelChange}
              placeholder="Gesture of goodwill"
            />
          </FormField>
          <FormField
            label="Code"
            htmlFor="refund-code"
            hint="Unique identifier for the refund reason"
          >
            <Input
              id="refund-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="gesture_of_goodwill"
            />
          </FormField>
          <FormField label="Description" htmlFor="refund-description" hint="Optional">
            <Textarea
              id="refund-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Customer had a bad shopping experience"
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
              disabled={saving || !label.trim() || !code.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
