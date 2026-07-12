"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  PencilSquare,
  Trash,
  Plus,
  User,
  MapPin,
  ExclamationCircle,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { DataTable } from "@components/merchant-admin/data-table"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCustomer,
  updateCustomer,
  deleteCustomer,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  addCustomerToGroups,
  listCustomerGroups,
  CustomerFull,
  CustomerFullAddress,
  CustomerGroup,
  Order,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

// A broad ISO-3166-1 alpha-2 list; names rendered via Intl.DisplayNames.
const COUNTRY_CODES =
  "us ca gb au nz ie de fr es it nl be pt ch at se no dk fi pl cz sk hu ro bg gr hr si ee lv lt lu is mt cy in bd pk lk np sg my th vn ph id jp kr cn hk tw ae sa qa kw bh om il tr eg za ng ke gh ma dz tn br mx ar cl co pe uy ec ve bo py cr pa gt do jm tt ru ua by kz ge am az".split(
    " "
  )

function countryName(code?: string | null): string {
  if (!code) return "—"
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim()
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

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 py-2 text-sm">
      <span className="font-medium text-grey-60">{label}</span>
      <span className="text-grey-90">{value ?? "—"}</span>
    </div>
  )
}

function normalizeAddresses(c: CustomerFull): CustomerFullAddress[] {
  if (c.addresses && c.addresses.length) return c.addresses
  const out: CustomerFullAddress[] = []
  ;(c.shipping_addresses ?? []).forEach((a, i) =>
    out.push({ ...a, is_default_shipping: i === 0 })
  )
  ;(c.billing_addresses ?? []).forEach((a, i) =>
    out.push({ ...a, is_default_billing: i === 0 })
  )
  return out
}

type AddressForm = {
  address_name: string
  first_name: string
  last_name: string
  company: string
  address_1: string
  address_2: string
  postal_code: string
  city: string
  country_code: string
  province: string
  phone: string
  is_default_shipping: boolean
  is_default_billing: boolean
}

const EMPTY_ADDRESS: AddressForm = {
  address_name: "",
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  postal_code: "",
  city: "",
  country_code: "",
  province: "",
  phone: "",
  is_default_shipping: false,
  is_default_billing: false,
}

type GroupRow = { id: string; name: string; customers_count?: number }

type MetaRow = { key: string; value: string }

function metaToRows(meta?: Record<string, unknown> | null): MetaRow[] {
  const entries = Object.entries(meta ?? {}).filter(
    ([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v)
  )
  if (entries.length === 0) return [{ key: "", value: "" }]
  return entries.map(([k, v]) => ({ key: k, value: v === null ? "" : String(v) }))
}

function parseValue(raw: string): string | number | boolean {
  const t = raw.trim()
  if (t === "true") return true
  if (t === "false") return false
  if (t !== "" && !isNaN(Number(t))) return Number(t)
  return raw
}

function rowsToMetadata(
  rows: MetaRow[],
  original?: Record<string, unknown> | null
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  // Preserve non-primitive values that the editor cannot represent.
  for (const [k, v] of Object.entries(original ?? {})) {
    if (v !== null && typeof v === "object") out[k] = v
  }
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    out[key] = parseValue(row.value)
  }
  // Keys present in the original primitive set but removed now are cleared.
  for (const [k, v] of Object.entries(original ?? {})) {
    if ((v === null || typeof v !== "object") && !(k in out)) out[k] = ""
  }
  if (Object.keys(out).length === 0) return null
  return out
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [customer, setCustomer] = useState<CustomerFull | null>(null)
  const [groupsCatalog, setGroupsCatalog] = useState<CustomerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  // General edit
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company_name: "",
    phone: "",
  })

  // Delete customer
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  // Address modal
  const [addressModal, setAddressModal] = useState<{
    open: boolean
    mode: "create" | "edit"
    addressId?: string
    form: AddressForm
  }>({ open: false, mode: "create", form: EMPTY_ADDRESS })

  // Groups modal
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [groupSel, setGroupSel] = useState<Set<string>>(new Set())
  const [groupSearch, setGroupSearch] = useState("")

  // Metadata modal
  const [metaOpen, setMetaOpen] = useState(false)
  const [metaRows, setMetaRows] = useState<MetaRow[]>([{ key: "", value: "" }])

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [c, g] = await Promise.all([
        getCustomer(token, id),
        listCustomerGroups(token).catch(() => ({ groups: [] as CustomerGroup[], count: 0 })),
      ])
      setCustomer(c.customer as CustomerFull)
      setGroupsCatalog(g.groups || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load customer")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    if (!token) return false
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await load()
      return true
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  // ---- general edit ----
  function openEdit() {
    if (!customer) return
    setEditForm({
      email: customer.email || "",
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      company_name: customer.company_name || "",
      phone: customer.phone || "",
    })
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !customer) return
    const partial: Record<string, string | null | undefined> = {
      // Email is never updated for registered customers.
      email: customer.has_account ? undefined : editForm.email.trim() || undefined,
      first_name: editForm.first_name.trim() || null,
      last_name: editForm.last_name.trim() || null,
      company_name: editForm.company_name.trim() || null,
      phone: editForm.phone.trim() || null,
    }
    const ok = await run(
      "save-edit",
      () => updateCustomer(token, customer.id, partial),
      `Customer ${customer.email} was successfully updated.`
    )
    if (ok) setEditOpen(false)
  }

  // ---- delete customer ----
  async function confirmDelete() {
    if (!token || !customer) return
    setBusy("del-customer")
    try {
      await deleteCustomer(token, customer.id)
      router.replace("/dashboard/customers")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete customer")
      setBusy(null)
    }
  }

  // ---- address modal ----
  function openAddressCreate() {
    setAddressModal({ open: true, mode: "create", form: EMPTY_ADDRESS })
  }
  function openAddressEdit(a: CustomerFullAddress) {
    setAddressModal({
      open: true,
      mode: "edit",
      addressId: a.id,
      form: {
        address_name: a.address_name || "",
        first_name: a.first_name || "",
        last_name: a.last_name || "",
        company: a.company || "",
        address_1: a.address_1 || "",
        address_2: a.address_2 || "",
        postal_code: a.postal_code || "",
        city: a.city || "",
        country_code: a.country_code || "",
        province: a.province || "",
        phone: a.phone || "",
        is_default_shipping: !!a.is_default_shipping,
        is_default_billing: !!a.is_default_billing,
      },
    })
  }
  async function saveAddress(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !customer) return
    const f = addressModal.form
    if (!f.address_name.trim() || !f.address_1.trim() || f.country_code.trim().length !== 2) return
    const payload = {
      address_name: f.address_name.trim(),
      first_name: f.first_name.trim() || undefined,
      last_name: f.last_name.trim() || undefined,
      company: f.company.trim() || undefined,
      address_1: f.address_1.trim(),
      address_2: f.address_2.trim() || undefined,
      postal_code: f.postal_code.trim() || undefined,
      city: f.city.trim() || undefined,
      country_code: f.country_code.trim().toLowerCase(),
      province: f.province.trim() || undefined,
      phone: f.phone.trim() || undefined,
      is_default_shipping: f.is_default_shipping,
      is_default_billing: f.is_default_billing,
    }
    const ok = await run(
      "save-address",
      () =>
        addressModal.mode === "create"
          ? createCustomerAddress(token, customer.id, payload)
          : updateCustomerAddress(token, customer.id, addressModal.addressId!, payload),
      addressModal.mode === "create"
        ? "Address was successfully created."
        : "Address was successfully updated."
    )
    if (ok) setAddressModal((m) => ({ ...m, open: false }))
  }
  async function handleDeleteAddress(a: CustomerFullAddress) {
    if (!token || !customer) return
    const label = a.address_name || "address"
    if (!confirm(`You are about to delete the address ${label}. This cannot be undone.`)) return
    await run(
      `del-addr-${a.id}`,
      () => deleteCustomerAddress(token, customer.id, a.id),
      "Address was successfully deleted."
    )
  }

  // ---- groups ----
  function openGroups() {
    if (!customer) return
    setGroupSel(new Set())
    setGroupSearch("")
    setGroupsOpen(true)
  }
  async function saveGroups() {
    if (!token || !customer) return
    const add = Array.from(groupSel)
    if (add.length === 0) return
    const names = groupsCatalog
      .filter((g) => groupSel.has(g.id))
      .map((g) => g.name)
      .join(", ")
    const ok = await run(
      "save-groups",
      () => addCustomerToGroups(token, customer.id, { add, remove: [] }),
      `Customer added to: ${names}.`
    )
    if (ok) setGroupsOpen(false)
  }
  async function handleRemoveGroup(g: { id: string; name: string }) {
    if (!token || !customer) return
    if (!confirm(`Are you sure you want to remove the customer from "${g.name}" customer group?`)) {
      return
    }
    await run(
      `rm-group-${g.id}`,
      () => addCustomerToGroups(token, customer.id, { add: [], remove: [g.id] }),
      `Customer removed from: ${g.name}.`
    )
  }

  // ---- metadata ----
  function openMetadata() {
    if (!customer) return
    setMetaRows(metaToRows(customer.metadata))
    setMetaOpen(true)
  }
  async function saveMetadata() {
    if (!token || !customer) return
    const metadata = rowsToMetadata(metaRows, customer.metadata)
    const ok = await run(
      "save-meta",
      () => updateCustomer(token, customer.id, { metadata }),
      "Metadata was successfully updated."
    )
    if (ok) setMetaOpen(false)
  }

  const addresses = useMemo(
    () => (customer ? normalizeAddresses(customer) : []),
    [customer]
  )
  const groupCountById = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of groupsCatalog) map.set(g.id, g.customer_count ?? 0)
    return map
  }, [groupsCatalog])
  // Fail closed against cross-tenant leakage: customers are shared across
  // pooled tenants, so the raw customer.groups payload can contain other
  // tenants' groups. Membership is only acknowledged for groups present in
  // the tenant-scoped listCustomerGroups catalog — everything rendered (and
  // therefore removable) is intersected with that catalog first.
  const memberGroupIds = useMemo(
    () =>
      new Set(
        (customer?.groups ?? [])
          .map((g) => g.id)
          .filter((gid) => groupCountById.has(gid))
      ),
    [customer, groupCountById]
  )
  const filteredCatalog = useMemo(() => {
    const term = groupSearch.trim().toLowerCase()
    return groupsCatalog.filter((g) => !term || g.name.toLowerCase().includes(term))
  }, [groupsCatalog, groupSearch])

  const orderColumns = [
    {
      key: "display_id",
      header: "Order",
      render: (o: Order) => <span className="font-medium text-grey-90">#{o.display_id}</span>,
    },
    {
      key: "created_at",
      header: "Date",
      render: (o: Order) => <span className="text-grey-60">{formatDate(o.created_at)}</span>,
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (o: Order) => <StatusBadge status={o.payment_status ?? o.status} />,
    },
    {
      key: "fulfillment_status",
      header: "Fulfillment",
      render: (o: Order) => <StatusBadge status={o.fulfillment_status ?? o.status} />,
    },
    {
      key: "total",
      header: "Total",
      render: (o: Order) => (
        <span className="text-grey-90">{formatMoney(o.total, o.currency_code)}</span>
      ),
    },
    {
      key: "country_code",
      header: "Country",
      render: (o: Order) => (
        <span className="text-grey-60">
          {o.country_code ? o.country_code.toUpperCase() : "—"}
        </span>
      ),
    },
  ]

  // Tenant-scoped view of the customer's groups (see memberGroupIds note).
  const groupRows: GroupRow[] = (customer?.groups ?? [])
    .filter((g) => groupCountById.has(g.id))
    .map((g) => ({
      ...g,
      customers_count: groupCountById.get(g.id),
    }))
  const groupColumns = [
    {
      key: "name",
      header: "Name",
      render: (g: GroupRow) => <span className="text-grey-90">{g.name || "—"}</span>,
    },
    {
      key: "customers_count",
      header: "Customers",
      render: (g: GroupRow) => (
        <span className="text-grey-60">{g.customers_count ?? "—"}</span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer" description="Loading..." />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer" description="We could not load this customer." />
        <EmptyState
          icon={User}
          title="Customer not found"
          description={error || "This customer does not exist or you do not have access to it."}
        />
      </div>
    )
  }

  const name = fullName(customer.first_name, customer.last_name)
  const metaKeys = Object.keys(customer.metadata ?? {})

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/customers")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to customers
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* General */}
          <Card
            title={
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-grey-90">{customer.email}</h1>
                <AccountBadge hasAccount={customer.has_account} />
              </div>
            }
            action={
              <ActionMenu
                items={[
                  { label: "Edit", icon: PencilSquare, onClick: openEdit },
                  { label: "Delete", icon: Trash, destructive: true, onClick: () => setDeleteOpen(true) },
                ]}
              />
            }
          >
            <dl className="divide-y divide-grey-10">
              <InfoRow label="Name" value={name || "—"} />
              <InfoRow label="Company" value={customer.company_name || "—"} />
              <InfoRow label="Phone" value={customer.phone || "—"} />
            </dl>
          </Card>

          {/* Orders */}
          <Card title="Orders">
            {customer.orders && customer.orders.length > 0 ? (
              <DataTable<Order>
                columns={orderColumns}
                rows={customer.orders}
                onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
                pageSize={10}
              />
            ) : (
              <p className="text-sm text-grey-50">This customer has no orders yet.</p>
            )}
          </Card>

          {/* Customer Groups */}
          <Card
            title="Customer Groups"
            action={
              <button
                onClick={openGroups}
                className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            }
          >
            {groupRows.length > 0 ? (
              <DataTable<GroupRow>
                columns={groupColumns}
                rows={groupRows}
                onRowClick={(g) => router.push(`/dashboard/customer-groups/${g.id}`)}
                rowActions={(g) => (
                  // DataTable renders row actions inside the clickable <tr>;
                  // without this guard, opening the menu (or clicking Remove)
                  // bubbles to onRowClick and navigates away before the action
                  // can run.
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        {
                          label: "Remove",
                          icon: Trash,
                          destructive: true,
                          onClick: () => handleRemoveGroup(g),
                        },
                      ]}
                    />
                  </div>
                )}
                pageSize={10}
              />
            ) : (
              <p className="text-sm text-grey-50">This customer doesn&apos;t belong to any group.</p>
            )}
          </Card>

          {/* Metadata */}
          <Card
            title="Metadata"
            action={
              <button
                onClick={openMetadata}
                className="text-sm font-medium text-grey-60 hover:text-grey-90"
              >
                Edit
              </button>
            }
          >
            {metaKeys.length > 0 ? (
              <dl className="divide-y divide-grey-10">
                {Object.entries(customer.metadata ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-grey-50">{k}</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-grey-50">{metaKeys.length} keys</p>
            )}
          </Card>

          {/* JSON */}
          <Card bodyClassName="p-0">
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
            >
              <span>
                JSON
                <span className="ml-2 text-grey-40">
                  {Object.keys(customer).length} keys
                </span>
              </span>
              <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
            </button>
            {showJson && (
              <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
                {JSON.stringify(customer, null, 2)}
              </pre>
            )}
          </Card>
        </div>

        {/* Sidebar: Addresses */}
        <div className="space-y-6">
          <Card
            title="Addresses"
            action={
              <button
                onClick={openAddressCreate}
                className="inline-flex items-center gap-1 text-xs font-medium text-grey-50 hover:text-grey-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            }
            bodyClassName={addresses.length > 0 ? "p-0" : undefined}
          >
            {addresses.length > 0 ? (
              <ul className="divide-y divide-grey-10">
                {addresses.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-grey-90">
                          {a.address_name || "n/a"}
                        </p>
                        {a.is_default_shipping && (
                          <span className="rounded-full bg-grey-10 px-1.5 py-0.5 text-[10px] font-medium text-grey-60">
                            Default shipping
                          </span>
                        )}
                        {a.is_default_billing && (
                          <span className="rounded-full bg-grey-10 px-1.5 py-0.5 text-[10px] font-medium text-grey-60">
                            Default billing
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-grey-50">
                        {[a.address_1, a.address_2].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-grey-40">
                        {[a.city, a.province, a.postal_code].filter(Boolean).join(", ")}
                        {a.country_code ? ` · ${countryName(a.country_code)}` : ""}
                      </p>
                    </div>
                    <ActionMenu
                      items={[
                        { label: "Edit", icon: PencilSquare, onClick: () => openAddressEdit(a) },
                        {
                          label: "Delete",
                          icon: Trash,
                          destructive: true,
                          onClick: () => handleDeleteAddress(a),
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-base border border-dashed border-grey-20 p-6 text-center">
                <MapPin className="mx-auto h-6 w-6 text-grey-40" />
                <p className="mt-2 text-sm font-medium text-grey-80">No records</p>
                <p className="mt-0.5 text-sm text-grey-50">There are no records to show</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit customer modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Customer"
        description="Update this customer's details."
        size="sm"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField
            label="Email"
            htmlFor="cust-email"
            hint={
              customer.has_account
                ? "The email address cannot be changed for registered customers."
                : undefined
            }
          >
            <Input
              id="cust-email"
              type="email"
              autoComplete="off"
              disabled={customer.has_account}
              value={editForm.email}
              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name" htmlFor="cust-first">
              <Input
                id="cust-first"
                autoComplete="off"
                value={editForm.first_name}
                onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Last Name" htmlFor="cust-last">
              <Input
                id="cust-last"
                autoComplete="off"
                value={editForm.last_name}
                onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Company" htmlFor="cust-company">
            <Input
              id="cust-company"
              autoComplete="off"
              value={editForm.company_name}
              onChange={(e) => setEditForm((p) => ({ ...p, company_name: e.target.value }))}
            />
          </FormField>
          <FormField label="Phone" htmlFor="cust-phone">
            <Input
              id="cust-phone"
              autoComplete="off"
              value={editForm.phone}
              onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
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
              disabled={busy === "save-edit"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-edit" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete customer modal */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          setDeleteConfirm("")
        }}
        title="Delete Customer"
        description={`You are about to delete the customer ${customer.email}. This action cannot be undone.`}
        size="sm"
      >
        <div className="space-y-4">
          <FormField label={`Please type ${customer.email} to confirm:`} htmlFor="del-confirm">
            <Input
              id="del-confirm"
              autoComplete="off"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={customer.email}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteConfirm("")
              }}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteConfirm !== customer.email || busy === "del-customer"}
              className="inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy === "del-customer" ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Address modal */}
      <Modal
        open={addressModal.open}
        onClose={() => setAddressModal((m) => ({ ...m, open: false }))}
        title={addressModal.mode === "create" ? "Create Address" : "Edit Address"}
        description={
          addressModal.mode === "create"
            ? "Create a new address for the customer."
            : "Update this address for the customer."
        }
        size="md"
      >
        <form onSubmit={saveAddress} className="space-y-4">
          <FormField label="Address name" htmlFor="addr-name">
            <Input
              id="addr-name"
              value={addressModal.form.address_name}
              onChange={(e) =>
                setAddressModal((m) => ({ ...m, form: { ...m.form, address_name: e.target.value } }))
              }
              placeholder="e.g. Home, Office"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" htmlFor="addr-first">
              <Input
                id="addr-first"
                value={addressModal.form.first_name}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, first_name: e.target.value } }))
                }
              />
            </FormField>
            <FormField label="Last name" htmlFor="addr-last">
              <Input
                id="addr-last"
                value={addressModal.form.last_name}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, last_name: e.target.value } }))
                }
              />
            </FormField>
          </div>
          <FormField label="Address" htmlFor="addr-1">
            <Input
              id="addr-1"
              value={addressModal.form.address_1}
              onChange={(e) =>
                setAddressModal((m) => ({ ...m, form: { ...m.form, address_1: e.target.value } }))
              }
              placeholder="Street address"
            />
          </FormField>
          <FormField label="Apartment, suite, etc." htmlFor="addr-2">
            <Input
              id="addr-2"
              value={addressModal.form.address_2}
              onChange={(e) =>
                setAddressModal((m) => ({ ...m, form: { ...m.form, address_2: e.target.value } }))
              }
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Postal code" htmlFor="addr-postal">
              <Input
                id="addr-postal"
                value={addressModal.form.postal_code}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, postal_code: e.target.value } }))
                }
              />
            </FormField>
            <FormField label="City" htmlFor="addr-city">
              <Input
                id="addr-city"
                value={addressModal.form.city}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, city: e.target.value } }))
                }
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Country" htmlFor="addr-country">
              <Select
                id="addr-country"
                value={addressModal.form.country_code}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, country_code: e.target.value } }))
                }
              >
                <option value="">Select</option>
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {countryName(c)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="State / Province" htmlFor="addr-prov">
              <Input
                id="addr-prov"
                value={addressModal.form.province}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, province: e.target.value } }))
                }
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company" htmlFor="addr-company">
              <Input
                id="addr-company"
                value={addressModal.form.company}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, company: e.target.value } }))
                }
              />
            </FormField>
            <FormField label="Phone" htmlFor="addr-phone">
              <Input
                id="addr-phone"
                value={addressModal.form.phone}
                onChange={(e) =>
                  setAddressModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value } }))
                }
              />
            </FormField>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-grey-90">
              <input
                type="checkbox"
                checked={addressModal.form.is_default_shipping}
                onChange={(e) =>
                  setAddressModal((m) => ({
                    ...m,
                    form: { ...m.form, is_default_shipping: e.target.checked },
                  }))
                }
              />
              Set as default shipping address
            </label>
            <label className="flex items-center gap-2 text-sm text-grey-90">
              <input
                type="checkbox"
                checked={addressModal.form.is_default_billing}
                onChange={(e) =>
                  setAddressModal((m) => ({
                    ...m,
                    form: { ...m.form, is_default_billing: e.target.checked },
                  }))
                }
              />
              Set as default billing address
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddressModal((m) => ({ ...m, open: false }))}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                busy === "save-address" ||
                !addressModal.form.address_name.trim() ||
                !addressModal.form.address_1.trim() ||
                addressModal.form.country_code.trim().length !== 2
              }
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-address" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add groups modal */}
      <Modal
        open={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        title="Add customer to groups"
        description="Select the customer groups to add this customer to."
        size="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <Input
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Search groups..."
              autoFocus
            />
          </div>
          {groupsCatalog.length === 0 ? (
            <p className="rounded-base border border-dashed border-grey-20 p-6 text-center text-sm text-grey-50">
              Please create a customer group first.
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
              {filteredCatalog.map((g) => {
                const already = memberGroupIds.has(g.id)
                return (
                  <label
                    key={g.id}
                    title={already ? "The customer is already in this customer group." : undefined}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-base px-2 py-2 text-sm",
                      already ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-grey-10"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={already || groupSel.has(g.id)}
                        onChange={() =>
                          setGroupSel((s) => {
                            const n = new Set(s)
                            n.has(g.id) ? n.delete(g.id) : n.add(g.id)
                            return n
                          })
                        }
                      />
                      <span className="text-grey-90">{g.name}</span>
                    </span>
                    <span className="text-grey-40">{g.customer_count ?? 0}</span>
                  </label>
                )
              })}
              {filteredCatalog.length === 0 && (
                <p className="px-2 py-2 text-sm text-grey-40">No matches.</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setGroupsOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveGroups}
              disabled={busy === "save-groups" || groupSel.size === 0}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-groups" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Metadata modal */}
      <Modal
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        title="Edit Metadata"
        description="Add structured key/value data to this customer."
        size="md"
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-base border border-grey-20">
            <div className="grid grid-cols-[1fr_1fr_auto] border-b border-grey-10 bg-grey-10 text-xs font-medium text-grey-60">
              <span className="px-3 py-2">Key</span>
              <span className="px-3 py-2">Value</span>
              <span className="px-3 py-2" />
            </div>
            {metaRows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_auto] items-center border-b border-grey-10 last:border-0"
              >
                <input
                  value={row.key}
                  onChange={(e) =>
                    setMetaRows((rows) =>
                      rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r))
                    )
                  }
                  placeholder="Key"
                  className="border-0 bg-transparent px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:outline-none"
                />
                <input
                  value={row.value}
                  onChange={(e) =>
                    setMetaRows((rows) =>
                      rows.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))
                    )
                  }
                  placeholder="Value"
                  className="border-0 border-l border-grey-10 bg-transparent px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setMetaRows((rows) => {
                      const next = rows.filter((_, i) => i !== idx)
                      return next.length ? next : [{ key: "", value: "" }]
                    })
                  }
                  className="px-3 py-2 text-grey-40 hover:text-rose-600"
                  aria-label="Delete row"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMetaRows((rows) => [...rows, { key: "", value: "" }])}
            className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMetaOpen(false)}
              disabled={busy === "save-meta"}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveMetadata}
              disabled={busy === "save-meta"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-meta" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
