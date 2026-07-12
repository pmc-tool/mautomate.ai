"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, ExclamationCircle } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCustomers,
  createCustomer,
  CustomerListItem,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  company_name: "",
  phone: "",
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function CustomersPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<CustomerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token) return
    setLoading(true)
    try {
      const res = await listCustomers(token)
      setItems((res.customers as CustomerListItem[]) || [])
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load customers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setCreateOpen(true)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!EMAIL_RE.test(form.email.trim())) {
      setFormError("Please enter a valid email address.")
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await createCustomer(token, {
        email: form.email.trim(),
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        company_name: form.company_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
      })
      showMessage("success", `Customer ${form.email.trim()} was successfully created.`)
      setCreateOpen(false)
      router.push(`/dashboard/customers/${res.customer.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create customer")
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { key: "email", header: "Email", sortable: true },
    {
      key: "name",
      header: "Name",
      render: (row: CustomerListItem) => (
        <span className="text-grey-90">
          {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
        </span>
      ),
    },
    {
      key: "has_account",
      header: "Account",
      render: (row: CustomerListItem) => <AccountBadge hasAccount={row.has_account} />,
    },
    {
      key: "created_at",
      header: "Created",
      render: (row: CustomerListItem) => (
        <span className="text-grey-60">{row.created_at ? formatDate(row.created_at) : "—"}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="View and manage your customers."
        action={
          <button
            onClick={openCreate}
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

      <DataTable<CustomerListItem>
        columns={columns}
        rows={items}
        searchKeys={["email", "first_name", "last_name"]}
        sortKeys={[
          { key: "email", label: "Email" },
          { key: "first_name", label: "First Name" },
          { key: "last_name", label: "Last Name" },
          { key: "has_account", label: "Has account" },
          { key: "created_at", label: "Created" },
        ]}
        onRowClick={(row) => router.push(`/dashboard/customers/${row.id}`)}
        emptyIcon={Users}
        emptyTitle="No customers yet"
        emptyDescription="Your customers will show up here."
        emptyAction={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        }
        isLoading={loading}
        pageSize={20}
      />

      {/* Create customer modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Customer"
        description="Create a new customer and manage their details."
        size="md"
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name" htmlFor="new-first">
              <Input
                id="new-first"
                autoComplete="off"
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Last Name" htmlFor="new-last">
              <Input
                id="new-last"
                autoComplete="off"
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Email" htmlFor="new-email">
              <Input
                id="new-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="customer@example.com"
              />
            </FormField>
            <FormField label="Company" htmlFor="new-company">
              <Input
                id="new-company"
                autoComplete="off"
                value={form.company_name}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Phone" htmlFor="new-phone">
              <Input
                id="new-phone"
                autoComplete="off"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </FormField>
          </div>
          {formError && <p className="text-sm text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
