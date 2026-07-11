"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Envelope,
  Phone,
  User,
  PencilSquare,
  Plus,
  Trash,
  DocumentText,
  Users,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { DataTable } from "@components/merchant-admin/data-table"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { getCustomer, CustomerDetail, CustomerAddress, ApiError } from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

function AddressCard({
  address,
  type,
}: {
  address: CustomerAddress
  type: "Shipping" | "Billing"
}) {
  return (
    <div className="rounded-base border border-grey-20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-grey-50">{type}</span>
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-grey-50 hover:bg-grey-10 hover:text-grey-90">
            <PencilSquare className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-1 text-grey-50 hover:bg-red-50 hover:text-red-600">
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-sm font-medium text-grey-90">
        {[address.first_name, address.last_name].filter(Boolean).join(" ")}
      </p>
      <p className="text-sm text-grey-60">{address.address_1}</p>
      {address.address_2 && <p className="text-sm text-grey-60">{address.address_2}</p>}
      <p className="text-sm text-grey-60">
        {address.city}, {address.province} {address.postal_code}
      </p>
      <p className="text-sm text-grey-60">{address.country_code?.toUpperCase()}</p>
      {address.phone && <p className="text-sm text-grey-60">{address.phone}</p>}
    </div>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, logout } = useMerchantAuth()
  const router = useRouter()

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    getCustomer(token, id)
      .then((r) => setCustomer(r.customer))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load customer")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  const orderColumns = [
    {
      key: "display_id",
      header: "Order",
      render: (o: CustomerDetail["orders"][number]) => <span>#{o.display_id}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (o: CustomerDetail["orders"][number]) => <StatusBadge status={o.status} />,
    },
    {
      key: "total",
      header: "Total",
      render: (o: CustomerDetail["orders"][number]) => formatMoney(o.total, o.currency_code),
    },
    {
      key: "created_at",
      header: "Date",
      render: (o: CustomerDetail["orders"][number]) => formatDate(o.created_at),
    },
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer" description="We could not load this customer." />
        <div className="rounded-large border border-red-200 bg-red-50 p-6 text-center text-red-700">
          {error || "Customer not found."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/customers"
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title={[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Guest"}
          description={customer.email}
          action={
            <div className="flex items-center gap-3">
              <StatusBadge status={customer.status ?? "active"} />
              <button className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">
                <PencilSquare className="h-4 w-4" />
                Edit
              </button>
            </div>
          }
        />
      </div>

      <TwoColumnLayout
        sidebar={
          <>
            <SectionCard
              title="Addresses"
              description="Customer shipping and billing addresses."
              action={
                <button className="inline-flex items-center gap-1 rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-90 hover:bg-grey-10">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              }
            >
              <div className="space-y-4">
                {customer.shipping_addresses?.map((addr) => (
                  <AddressCard key={addr.id} address={addr} type="Shipping" />
                ))}
                {customer.billing_addresses?.map((addr) => (
                  <AddressCard key={addr.id} address={addr} type="Billing" />
                ))}
                {!customer.shipping_addresses?.length && !customer.billing_addresses?.length && (
                  <p className="text-sm text-grey-50">No addresses on file.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Groups"
              description="Customer groups this customer belongs to."
              action={
                <button className="inline-flex items-center gap-1 rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-90 hover:bg-grey-10">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              }
            >
              {customer.groups && customer.groups.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {customer.groups.map((group) => (
                    <span
                      key={group.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-grey-10 px-2.5 py-1 text-xs font-medium text-grey-70"
                    >
                      <Users className="h-3 w-3" />
                      {group.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-grey-50">Not assigned to any group.</p>
              )}
            </SectionCard>
          </>
        }
      >
        <SectionCard title="General" description="Customer information.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="rounded-base bg-grey-10 p-2 text-grey-60">
                <Envelope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-grey-50">Email</p>
                <p className="text-sm font-medium text-grey-90">{customer.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-base bg-grey-10 p-2 text-grey-60">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-grey-50">Name</p>
                <p className="text-sm font-medium text-grey-90">
                  {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-base bg-grey-10 p-2 text-grey-60">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-grey-50">Phone</p>
                <p className="text-sm font-medium text-grey-90">{customer.phone ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-base bg-grey-10 p-2 text-grey-60">
                <DocumentText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-grey-50">Customer since</p>
                <p className="text-sm font-medium text-grey-90">{formatDate(customer.created_at)}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Orders" description="Recent orders placed by this customer.">
          {customer.orders && customer.orders.length > 0 ? (
            <DataTable<CustomerDetail["orders"][number]>
              columns={orderColumns}
              rows={customer.orders}
              pageSize={5}
            />
          ) : (
            <p className="text-sm text-grey-50">No orders yet.</p>
          )}
        </SectionCard>
      </TwoColumnLayout>
    </div>
  )
}
