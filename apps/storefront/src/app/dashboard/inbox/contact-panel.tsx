"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  ArrowUpRightOnBox,
  DocumentText,
  Envelope,
  PencilSquare,
  Phone,
  Robot,
  User,
  XMark,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type {
  InboxConversation,
  InboxCustomer360,
  InboxMessage,
  InboxNote,
} from "@lib/merchant-admin/api"
import {
  channelMeta,
  contactName,
  formatAmount,
  fullDateTime,
  handlerMeta,
  handoffCopy,
  initial,
  messageTime,
} from "./inbox-utils"

type Tab = "details" | "orders" | "notes" | "ai"

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

/**
 * The context panel. It used to stack contact fields, order history and the note
 * editor into one 288px column and ask the merchant to scroll past all of it —
 * so the tabs are not decoration, they are what makes each section readable at
 * this width. It also collapses: a long thread deserves the whole screen.
 */
export function ContactPanel({
  conversation,
  customer360,
  messages,
  notes,
  notesError,
  onAddNote,
  onCollapse,
}: {
  conversation: InboxConversation | null
  customer360: InboxCustomer360 | null
  messages: InboxMessage[]
  notes: InboxNote[]
  notesError: string | null
  onAddNote: (content: string) => Promise<boolean>
  onCollapse: () => void
}) {
  const [tab, setTab] = useState<Tab>("details")
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  if (!conversation) return null

  const name = contactName(conversation.contact)
  const channel = channelMeta(conversation.channel)
  const contact = conversation.contact
  const handler = handlerMeta(conversation.handler_mode)
  const HandlerIcon = handler.icon
  const handoff = handoffCopy(conversation.handoff_reason)
  const aiMessages = messages.filter((m) => m.author === "ai")
  const lastAi = aiMessages[aiMessages.length - 1] ?? null
  const orderCount = customer360?.matched ? customer360.order_count : 0

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "details", label: "Details" },
    { id: "orders", label: "Orders", badge: orderCount },
    { id: "notes", label: "Notes", badge: notes.length },
    { id: "ai", label: "AI" },
  ]

  const submit = async () => {
    const content = draft.trim()
    if (!content || saving) return
    setSaving(true)
    const ok = await onAddNote(content)
    setSaving(false)
    if (ok) setDraft("")
  }

  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-grey-20 bg-white xl:flex">
      <div className="relative border-b border-grey-10 px-5 pb-4 pt-5 text-center">
        <button
          type="button"
          onClick={onCollapse}
          className="absolute right-2 top-2 rounded-base p-1.5 text-grey-40 transition-colors hover:bg-grey-10 hover:text-grey-90"
          aria-label="Hide the contact panel"
        >
          <XMark className="h-4 w-4" />
        </button>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grey-90 text-lg font-semibold text-white">
          {initial(name)}
        </span>
        <p className="mt-3 truncate text-sm font-semibold text-grey-90">{name}</p>
        <p className={cn("mt-0.5 text-xs", channel.color)}>{channel.label}</p>
      </div>

      <div className="flex shrink-0 border-b border-grey-10 px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-grey-90 text-grey-90"
                : "border-transparent text-grey-50 hover:text-grey-90"
            )}
            aria-selected={tab === t.id}
            role="tab"
          >
            {t.label}
            {!!t.badge && (
              <span className="rounded-full bg-grey-10 px-1 text-[10px] font-semibold tabular-nums text-grey-60">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "details" && (
          <>
            <Row icon={User} label="Name" value={contact?.display_name || "—"} />
            <Row icon={Envelope} label="Email" value={contact?.email || "—"} />
            <Row icon={Phone} label="Phone" value={contact?.phone || "—"} />
            <Row
              label="Last message"
              value={fullDateTime(conversation.last_message_at)}
            />
            <Row
              label="Handled by"
              value={
                <span
                  className={cn("inline-flex items-center gap-1", handler.text)}
                >
                  <HandlerIcon className="h-3 w-3" />
                  {handler.label}
                </span>
              }
            />
            {contact?.customer_id ? (
              <Link
                href={`/dashboard/customers/${contact.customer_id}`}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-base border border-grey-20 py-2 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10 hover:text-grey-90"
              >
                <ArrowUpRightOnBox className="h-3.5 w-3.5" />
                Open customer profile
              </Link>
            ) : (
              <p className="mt-4 rounded-base bg-grey-5 px-3 py-2 text-[11px] leading-relaxed text-grey-50">
                This contact is not linked to a customer account yet. They are
                matched automatically once they order with the same email or
                phone.
              </p>
            )}
          </>
        )}

        {tab === "orders" &&
          (customer360?.matched ? (
            <>
              <Row label="Orders" value={customer360.order_count} />
              <Row
                label="Total spent"
                value={formatAmount(
                  customer360.total_spent,
                  customer360.currency_code
                )}
              />
              <p className="mb-1 mt-4 text-xs font-semibold text-grey-90">
                Recent orders
              </p>
              {customer360.recent_orders.length === 0 ? (
                <p className="text-xs text-grey-40">No orders yet.</p>
              ) : (
                customer360.recent_orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center justify-between gap-2 border-b border-grey-10 py-2 text-xs transition-colors last:border-b-0 hover:text-grey-90"
                  >
                    <span className="flex items-center gap-1.5 text-grey-50">
                      <DocumentText className="h-3.5 w-3.5 text-grey-40" />#
                      {order.display_id ?? "—"}
                    </span>
                    <span className="font-medium text-grey-90">
                      {formatAmount(order.total, order.currency_code)}
                    </span>
                  </Link>
                ))
              )}
            </>
          ) : (
            <p className="rounded-base bg-grey-5 px-3 py-2 text-[11px] leading-relaxed text-grey-50">
              No customer account matches this contact, so there is no order
              history to show. Orders appear here once they buy with the same
              email or phone number.
            </p>
          ))}

        {tab === "notes" && (
          <>
            <p className="mb-3 text-[11px] leading-relaxed text-grey-50">
              Only your team sees these. They are never sent to the contact.
            </p>

            {notesError && (
              <p className="mb-3 rounded-base bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                {notesError}
              </p>
            )}

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Add an internal note"
              className="w-full resize-none rounded-base border border-grey-20 px-2.5 py-2 text-xs text-grey-90 placeholder:text-grey-40 focus:border-grey-40 focus:outline-none focus:ring-2 focus:ring-grey-10"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || saving}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-base bg-grey-90 py-2 text-xs font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-40"
            >
              <PencilSquare className="h-3.5 w-3.5" />
              {saving ? "Saving" : "Add note"}
            </button>

            <div className="mt-4 space-y-2">
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
          </>
        )}

        {tab === "ai" && (
          <>
            {/* Before a merchant answers a thread the AI gave up on, the one thing
                they need is WHY it gave up — whether this is theirs to fix (out of
                credits), theirs to answer (the customer asked for a person), or
                nobody's (a provider blip that heals itself). */}
            {handoff ? (
              <div
                className={cn(
                  "rounded-base border p-3",
                  handoff.action
                    ? "border-rose-200 bg-rose-50"
                    : "border-amber-200 bg-amber-50"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    handoff.action ? "text-rose-900" : "text-amber-900"
                  )}
                >
                  {handoff.title}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[11px] leading-relaxed",
                    handoff.action ? "text-rose-800" : "text-amber-800"
                  )}
                >
                  {handoff.detail}
                </p>
                {handoff.action && (
                  <Link
                    href={handoff.action.href}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-grey-80"
                  >
                    {handoff.action.label}
                  </Link>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-base border p-3",
                  handler.bg,
                  handler.border
                )}
              >
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold",
                    handler.text
                  )}
                >
                  <HandlerIcon className="h-3.5 w-3.5" />
                  {handler.label}
                </p>
                <p className={cn("mt-1 text-[11px] leading-relaxed", handler.text)}>
                  {conversation.handler_mode === "ai"
                    ? "The assistant is answering this thread on its own. Take it over to reply yourself — it goes quiet until you hand it back."
                    : "A human is handling this thread. The assistant stays silent until it is returned."}
                </p>
              </div>
            )}

            <Row
              label="AI replies here"
              value={`${aiMessages.length}`}
            />
            {lastAi && (
              <>
                <p className="mb-1 mt-4 text-xs font-semibold text-grey-90">
                  What the assistant last said
                </p>
                <div className="rounded-base border border-sky-200 bg-sky-50 p-2.5">
                  <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-sky-900">
                    {lastAi.body}
                  </p>
                  <p className="mt-1.5 text-[11px] text-sky-700">
                    {messageTime(lastAi.sent_at)}
                  </p>
                </div>
              </>
            )}

            <Link
              href="/dashboard/marketing/chatbots"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-base border border-grey-20 py-2 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10 hover:text-grey-90"
            >
              <Robot className="h-3.5 w-3.5" />
              Train the assistant
            </Link>
          </>
        )}
      </div>
    </aside>
  )
}
