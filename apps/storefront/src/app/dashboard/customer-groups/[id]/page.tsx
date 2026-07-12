"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  Users,
  Plus,
  PencilSquare,
  Trash,
  MagnifyingGlass,
  ExclamationCircle,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { DataTable } from "@components/merchant-admin/data-table"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { formatDate } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"
import {
  getCustomerGroup,
  updateCustomerGroup,
  deleteCustomerGroup,
  listGroupCustomers,
  batchGroupCustomers,
  listCustomers,
  CustomerGroupDetail,
  GroupCustomer,
  Customer,
  ApiError,
} from "@lib/merchant-admin/api"

function customerName(c: { first_name: string | null; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—"
}

function AccountBadge({ hasAccount }: { hasAccount?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        hasAccount ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
      )}
    >
      {hasAccount ? "Registered" : "Guest"}
    </span>
  )
}

function Card({
  title,
  action,
  children,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          {typeof title === "string" ? (
            <h3 className="text-base font-semibold text-grey-90">{title}</h3>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

export default function CustomerGroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [group, setGroup] = useState<CustomerGroupDetail | null>(null)
  const [members, setMembers] = useState<GroupCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")

  // add-customers modal
  const [addOpen, setAddOpen] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [addSel, setAddSel] = useState<Set<string>>(new Set())

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function loadGroup() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getCustomerGroup(token, id)
      setGroup(res.group)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load customer group")
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers() {
    if (!token || !id) return
    setMembersLoading(true)
    try {
      const res = await listGroupCustomers(token, id, { limit: 1000 })
      setMembers(res.customers || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to load customers")
    } finally {
      setMembersLoading(false)
    }
  }

  useEffect(() => {
    loadGroup()
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  // ---- edit ----
  function openEdit() {
    if (!group) return
    setEditName(group.name)
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !group || !editName.trim()) return
    setBusy(true)
    try {
      await updateCustomerGroup(token, group.id, { name: editName.trim() })
      showMessage("success", `Customer group ${editName.trim()} was successfully updated.`)
      setEditOpen(false)
      await loadGroup()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update customer group")
    } finally {
      setBusy(false)
    }
  }

  // ---- delete ----
  async function handleDelete() {
    if (!token || !group) return
    if (
      !confirm(
        `You are about to delete the customer group ${group.name}. This action cannot be undone.`
      )
    )
      return
    setBusy(true)
    try {
      await deleteCustomerGroup(token, group.id)
      router.replace("/dashboard/customer-groups")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete customer group")
      setBusy(false)
    }
  }

  // ---- remove member ----
  async function removeMember(customer: GroupCustomer) {
    if (!token || !group) return
    if (
      !confirm(
        "You are about to remove 1 customer from the customer group. This action cannot be undone."
      )
    )
      return
    setBusy(true)
    try {
      await batchGroupCustomers(token, group.id, { add: [], remove: [customer.id] })
      setMembers((prev) => prev.filter((m) => m.id !== customer.id))
      setGroup((g) => (g ? { ...g, customers_count: Math.max(0, g.customers_count - 1) } : g))
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to remove customer")
    } finally {
      setBusy(false)
    }
  }

  // ---- add customers ----
  async function openAdd() {
    if (!token) return
    setAddSel(new Set())
    setAddSearch("")
    setAddOpen(true)
    setAddLoading(true)
    try {
      const res = await listCustomers(token)
      setAllCustomers(res.customers || [])
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to load customers")
    } finally {
      setAddLoading(false)
    }
  }

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members])

  const addableCustomers = useMemo(() => {
    const term = addSearch.trim().toLowerCase()
    return allCustomers
      .filter((c) => !memberIds.has(c.id))
      .filter((c) => {
        if (!term) return true
        return (
          c.email.toLowerCase().includes(term) ||
          customerName(c).toLowerCase().includes(term)
        )
      })
  }, [allCustomers, memberIds, addSearch])

  async function saveAdd() {
    if (!token || !group || addSel.size === 0) return
    setBusy(true)
    try {
      const ids = Array.from(addSel)
      await batchGroupCustomers(token, group.id, { add: ids, remove: [] })
      showMessage(
        "success",
        ids.length === 1
          ? "Customer was successfully added to the group."
          : "Customers were successfully added to the group."
      )
      setAddOpen(false)
      await Promise.all([loadGroup(), loadMembers()])
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to add customers")
    } finally {
      setBusy(false)
    }
  }

  const memberColumns = useMemo(
    () => [
      {
        key: "email",
        header: "Email",
        sortable: true,
        render: (c: GroupCustomer) => <span className="text-grey-90">{c.email}</span>,
      },
      {
        key: "name",
        header: "Name",
        render: (c: GroupCustomer) => <span className="text-grey-70">{customerName(c)}</span>,
      },
      {
        key: "has_account",
        header: "Account",
        render: (c: GroupCustomer) => <AccountBadge hasAccount={c.has_account} />,
      },
      {
        key: "created_at",
        header: "Created",
        sortable: true,
        render: (c: GroupCustomer) => (
          <span className="text-grey-60">{formatDate(c.created_at)}</span>
        ),
      },
    ],
    []
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer group" description="Loading..." />
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer group" description="We could not load this customer group." />
        <EmptyState
          icon={Users}
          title="Customer group not found"
          description={error || "This customer group does not exist or you do not have access to it."}
        />
      </div>
    )
  }

  const metadataEntries = group.metadata ? Object.entries(group.metadata) : []

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/customer-groups")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to customer groups
      </button>

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

      {/* General */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-50">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-grey-90">{group.name}</h1>
              <p className="mt-0.5 text-sm text-grey-50">
                {group.customers_count} customer{group.customers_count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ActionMenu
            items={[
              { label: "Edit", icon: PencilSquare, onClick: openEdit },
              { label: "Delete", icon: Trash, destructive: true, onClick: handleDelete },
            ]}
          />
        </div>
        <dl className="mt-5 divide-y divide-grey-10 border-t border-grey-10">
          <div className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-grey-50">Customers</dt>
            <dd className="font-medium text-grey-90">{group.customers_count ?? "-"}</dd>
          </div>
        </dl>
      </Card>

      {/* Customers */}
      <Card
        title="Customers"
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        }
        bodyClassName="p-0"
      >
        <div className="p-5">
          <DataTable<GroupCustomer>
            columns={memberColumns}
            rows={members}
            searchKeys={["email", "first_name", "last_name"]}
            onRowClick={(c) => router.push(`/dashboard/customers/${c.id}`)}
            rowActions={(c) => (
              <div onClick={(e) => e.stopPropagation()}>
                <ActionMenu
                  items={[
                    {
                      label: "Remove",
                      icon: Trash,
                      destructive: true,
                      onClick: () => removeMember(c),
                    },
                  ]}
                />
              </div>
            )}
            emptyIcon={Users}
            emptyTitle="No customers"
            emptyDescription="This group doesn't have customers."
            isLoading={membersLoading}
          />
        </div>
      </Card>

      {/* Metadata */}
      {metadataEntries.length > 0 && (
        <Card title="Metadata">
          <dl className="divide-y divide-grey-10">
            {metadataEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                <dt className="text-grey-50">{k}</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* JSON */}
      <Card bodyClassName="p-0">
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
        >
          Raw customer group data (JSON)
          <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
        </button>
        {showJson && (
          <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
            {JSON.stringify(group, null, 2)}
          </pre>
        )}
      </Card>

      {/* Edit group modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer Group" size="sm">
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Name" htmlFor="edit-group-name">
            <Input
              id="edit-group-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              required
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
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

      {/* Add customers modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Customers"
        description="Select the customers you want to add to this group."
        size="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search customers..."
              autoFocus
              className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
            />
          </div>

          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
            {addLoading ? (
              <p className="px-2 py-6 text-center text-sm text-grey-40">Loading customers...</p>
            ) : addableCustomers.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-grey-40">
                {allCustomers.length === 0
                  ? "Create a customer first."
                  : "No customers available to add."}
              </p>
            ) : (
              addableCustomers.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-base px-2 py-2 text-sm hover:bg-grey-10"
                >
                  <input
                    type="checkbox"
                    checked={addSel.has(c.id)}
                    onChange={() =>
                      setAddSel((s) => {
                        const n = new Set(s)
                        if (n.has(c.id)) n.delete(c.id)
                        else n.add(c.id)
                        return n
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-grey-90">{c.email}</span>
                    <span className="block truncate text-xs text-grey-50">{customerName(c)}</span>
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-grey-50">{addSel.size} selected</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAdd}
                disabled={busy || addSel.size === 0}
                className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
