"use client"

import React, { useEffect, useState } from "react"
import { Envelope } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listContactMessages,
  ContactMessage,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate } from "@lib/merchant-admin/utils"

export default function ContactMessagesPage() {
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ContactMessage | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    listContactMessages(token, { limit: 200 })
      .then((res) => {
        if (cancelled) return
        setItems(res.messages || [])
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) logout()
        setError(
          err instanceof Error ? err.message : "Failed to load contact messages"
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const columns = [
    { key: "name", header: "Name", sortable: true },
    { key: "email", header: "Email", sortable: true },
    {
      key: "message",
      header: "Message",
      render: (row: ContactMessage) => (
        <span className="block max-w-md truncate text-grey-70">
          {row.message}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Received",
      render: (row: ContactMessage) => (
        <span className="text-grey-60">
          {row.created_at ? formatDate(row.created_at) : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact messages"
        description="Messages sent by visitors through your store's contact form."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<ContactMessage>
        columns={columns}
        rows={items}
        searchKeys={["name", "email", "message"]}
        sortKeys={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "created_at", label: "Received" },
        ]}
        onRowClick={(row) => setSelected(row)}
        emptyIcon={Envelope}
        emptyTitle="No messages yet"
        emptyDescription="When a visitor submits your store's contact form, it will show up here."
        isLoading={loading}
        pageSize={20}
      />

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Message from ${selected.name}` : "Message"}
        description={
          selected
            ? `${selected.email}${
                selected.created_at
                  ? ` · ${formatDate(selected.created_at)}`
                  : ""
              }`
            : undefined
        }
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-grey-80">
              {selected.message}
            </p>
            <div className="flex justify-end gap-2">
              <a
                href={`mailto:${selected.email}`}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
              >
                <Envelope className="h-4 w-4" />
                Reply by email
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
