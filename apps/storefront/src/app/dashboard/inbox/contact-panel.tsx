"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Envelope, Phone, User } from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type {
  InboxConversation,
  InboxCustomer360,
  InboxNote,
} from "@lib/merchant-admin/api"
import {
  channelMeta,
  contactName,
  formatAmount,
  fullDateTime,
  initial,
} from "./inbox-utils"

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-grey-10 py-2 last:border-b-0">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-grey-50">
        {Icon && <Icon className="h-3.5 w-3.5 text-grey-40" />}
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-xs text-grey-90">
        {value}
      </span>
    </div>
  )
}

export function ContactPanel({
  conversation,
  customer360,
  notes,
  notesError,
  onAddNote,
}: {
  conversation: InboxConversation | null
  customer360: InboxCustomer360 | null
  notes: InboxNote[]
  notesError: string | null
  onAddNote: (content: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  if (!conversation) return null

  const name = contactName(conversation.contact)
  const channel = channelMeta(conversation.channel)
  const contact = conversation.contact

  const submit = async () => {
    const content = draft.trim()
    if (!content || saving) return
    setSaving(true)
    const ok = await onAddNote(content)
    setSaving(false)
    if (ok) setDraft("")
  }

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-grey-20 bg-white xl:flex">
      <div className="border-b border-grey-10 px-5 py-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grey-90 text-lg font-semibold text-white">
          {initial(name)}
        </span>
        <p className="mt-3 text-sm font-semibold text-grey-90">{name}</p>
        <p className={cn("mt-0.5 text-xs", channel.color)}>{channel.label}</p>
      </div>

      <div className="border-b border-grey-10 px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-50">
          Contact
        </h3>
        <Row icon={User} label="Name" value={contact?.display_name || "—"} />
        <Row icon={Envelope} label="Email" value={contact?.email || "—"} />
        <Row icon={Phone} label="Phone" value={contact?.phone || "—"} />
        <Row
          label="Last message"
          value={fullDateTime(conversation.last_message_at)}
        />
        {contact?.customer_id && (
          <Row
            label="Customer"
            value={
              <Link
                href={`/dashboard/customers/${contact.customer_id}`}
                className="font-medium text-grey-90 underline underline-offset-2 hover:text-grey-70"
              >
                View customer
              </Link>
            }
          />
        )}
      </div>

      {customer360?.matched && (
        <div className="border-b border-grey-10 px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-50">
            Commerce
          </h3>
          <Row label="Orders" value={customer360.order_count} />
          <Row
            label="Total spent"
            value={formatAmount(
              customer360.total_spent,
              customer360.currency_code
            )}
          />
          {customer360.recent_orders.slice(0, 3).map((order) => (
            <Row
              key={order.id}
              label={`Order #${order.display_id ?? "—"}`}
              value={
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="font-medium text-grey-90 underline underline-offset-2 hover:text-grey-70"
                >
                  {formatAmount(order.total, order.currency_code)}
                </Link>
              }
            />
          ))}
        </div>
      )}

      <div className="px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-50">
          Internal notes
        </h3>
        <p className="mb-3 text-xs text-grey-50">
          Only your team sees these. They are never sent to the contact.
        </p>

        {notesError && (
          <p className="mb-3 rounded-base bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
            {notesError}
          </p>
        )}

        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-xs text-grey-40">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-base border border-amber-200 bg-amber-50 p-2.5"
              >
                <p className="whitespace-pre-wrap break-words text-xs text-grey-90">
                  {note.content}
                </p>
                <p className="mt-1.5 text-[11px] text-grey-50">
                  {fullDateTime(note.created_at)}
                </p>
              </div>
            ))
          )}
        </div>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Add an internal note"
          className="mt-3 w-full resize-none rounded-base border border-grey-20 px-2.5 py-2 text-xs text-grey-90 placeholder:text-grey-40 focus:border-grey-40 focus:outline-none focus:ring-2 focus:ring-grey-10"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || saving}
          className="mt-2 w-full rounded-base bg-grey-90 py-2 text-xs font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-40"
        >
          {saving ? "Saving" : "Add note"}
        </button>
      </div>
    </aside>
  )
}
