"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, PencilSquare, Trash, ExclamationCircle } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  listCustomerGroups,
  updateCustomerGroup,
  deleteCustomerGroup,
  CustomerGroup,
  ApiError,
} from "@lib/merchant-admin/api"

export default function CustomerGroupsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<CustomerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [editTarget, setEditTarget] = useState<CustomerGroup | null>(null)
  const [editName, setEditName] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<CustomerGroup | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listCustomerGroups(token)
      setItems(res.groups || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load customer groups")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function openEdit(group: CustomerGroup) {
    setEditTarget(group)
    setEditName(group.name)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !editTarget || !editName.trim()) return
    setBusy(true)
    try {
      await updateCustomerGroup(token, editTarget.id, { name: editName.trim() })
      showMessage("success", `Customer group ${editName.trim()} was successfully updated.`)
      setEditTarget(null)
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update customer group")
    } finally {
      setBusy(false)
    }
  }

  function openDelete(group: CustomerGroup) {
    setDeleteTarget(group)
    setConfirmText("")
  }

  async function confirmDelete() {
    if (!token || !deleteTarget || confirmText !== deleteTarget.name) return
    setBusy(true)
    try {
      await deleteCustomerGroup(token, deleteTarget.id)
      showMessage("success", `Customer group ${deleteTarget.name} was successfully deleted.`)
      setItems((prev) => prev.filter((g) => g.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete customer group")
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sortable: true,
        render: (g: CustomerGroup) => <span className="font-medium text-grey-90">{g.name}</span>,
      },
      {
        key: "customer_count",
        header: "Customers",
        sortable: true,
        render: (g: CustomerGroup) => <span className="text-grey-70">{g.customer_count ?? 0}</span>,
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Groups"
        description="Organize customers into groups. Groups can have different promotions and prices."
        action={
          <button
            onClick={() => router.push("/dashboard/customer-groups/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        }
      />

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<CustomerGroup>
        columns={columns}
        rows={items}
        searchKeys={["name"]}
        sortKeys={[
          { key: "name", label: "Name" },
          { key: "customer_count", label: "Customers" },
        ]}
        onRowClick={(g) => router.push(`/dashboard/customer-groups/${g.id}`)}
        rowActions={(g) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu
              items={[
                { label: "Edit", icon: PencilSquare, onClick: () => openEdit(g) },
                { label: "Delete", icon: Trash, destructive: true, onClick: () => openDelete(g) },
              ]}
            />
          </div>
        )}
        emptyIcon={Users}
        emptyTitle="No customer groups"
        emptyDescription="There are no customer groups to display."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/customer-groups/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        }
        isLoading={loading}
      />

      {/* Edit group */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Customer Group"
        size="sm"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Name" htmlFor="group-name">
            <Input
              id="group-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              required
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !editName.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete group (type-to-confirm) */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Customer Group"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-grey-60">
              You are about to delete the customer group{" "}
              <span className="font-medium text-grey-90">{deleteTarget.name}</span>. This action
              cannot be undone.
            </p>
            <FormField
              label={`Type "${deleteTarget.name}" to confirm`}
              htmlFor="confirm-name"
            >
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={deleteTarget.name}
                autoFocus
              />
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy || confirmText !== deleteTarget.name}
                className="inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
