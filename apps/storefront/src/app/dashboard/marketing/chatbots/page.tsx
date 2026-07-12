"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AcademicCap,
  ChatBubbleLeftRight,
  Code,
  CogSixTooth,
  PlaySolid,
  Plus,
  Trash,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createMarketingChatbot,
  deleteMarketingChatbot,
  listMarketingChatbots,
  updateMarketingChatbot,
  ApiError,
  MarketingChatbot,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { Modal } from "@components/merchant-admin/modal"
import { BotAvatar } from "./chatbot-preview"
import { ChatbotWizard, type WizardStep } from "./chatbot-wizard"

/** "3 days ago" — created_at is the only date a bot card shows. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ]
  let value = seconds
  for (const [size, unit] of units) {
    if (value < size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        -Math.floor(value),
        unit
      )
    }
    value = value / size
  }
  return ""
}

const TRAINING_LABEL: Record<string, string> = {
  trained: "Trained",
  training: "Training",
  not_trained: "Not trained",
}

export default function MarketingChatbotsPage() {
  const { token } = useMerchantAuth()

  const [chatbots, setChatbots] = useState<MarketingChatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [wizard, setWizard] = useState<{ id: string; step: WizardStep } | null>(
    null
  )
  const [confirmDelete, setConfirmDelete] = useState<MarketingChatbot | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listMarketingChatbots(token, { limit: 100 })
      .then((res) => setChatbots(res.chatbots ?? []))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Failed to load chatbots.")
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [token])

  const stats = useMemo(
    () => ({
      total: chatbots.length,
      active: chatbots.filter((c) => c.active).length,
      trained: chatbots.filter((c) => c.training_status === "trained").length,
    }),
    [chatbots]
  )

  /**
   * "Add New Chatbot" creates the bot immediately and drops the merchant into
   * the wizard — exactly the reference flow. There is no create form: every
   * field lives in a wizard step, and the wizard autosaves.
   */
  const addNew = async () => {
    if (!token || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await createMarketingChatbot(token, {
        name: "Untitled chatbot",
        welcome_message: "Hello. How can I help you today?",
        reply_mode: "auto",
      })
      setChatbots((prev) => [res.chatbot, ...prev])
      setWizard({ id: res.chatbot.id, step: 1 })
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not create the chatbot."
      )
    } finally {
      setCreating(false)
    }
  }

  const upsert = (bot: MarketingChatbot) =>
    setChatbots((prev) => prev.map((c) => (c.id === bot.id ? bot : c)))

  const toggleActive = async (bot: MarketingChatbot) => {
    if (!token) return
    setError(null)
    try {
      const res = await updateMarketingChatbot(token, bot.id, {
        active: !bot.active,
      })
      upsert(res.chatbot)
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not update the chatbot."
      )
    }
  }

  const remove = async () => {
    if (!token || !confirmDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteMarketingChatbot(token, confirmDelete.id)
      setChatbots((prev) => prev.filter((c) => c.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not delete the chatbot."
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbots"
        description="Build a chatbot that answers your customers from your own knowledge, on your store and anywhere else you put it."
        action={
          <button
            type="button"
            onClick={addNew}
            disabled={creating || !token}
            className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Creating..." : "Add new chatbot"}
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Chatbots" value={stats.total} icon={ChatBubbleLeftRight} />
        <KpiCard label="Active" value={stats.active} icon={PlaySolid} tone="green" />
        <KpiCard label="Trained" value={stats.trained} icon={AcademicCap} />
      </div>

      {loading ? (
        <div className="rounded-large border border-grey-20 bg-white p-8 text-center text-sm text-grey-50 shadow-borders-base">
          Loading chatbots...
        </div>
      ) : chatbots.length === 0 ? (
        <div className="rounded-large border border-grey-20 bg-white p-6 shadow-borders-base">
          <EmptyState
            icon={ChatBubbleLeftRight}
            title="No chatbots yet"
            description="Create one and the studio walks you through it: give it a persona, style the widget, feed it your knowledge, then test it and put it on your site."
            action={
              <button
                type="button"
                onClick={addNew}
                disabled={creating || !token}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Creating..." : "Add new chatbot"}
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {chatbots.map((bot) => (
            <div
              key={bot.id}
              className="flex flex-col rounded-large border border-grey-20 bg-white p-5 shadow-borders-base transition-shadow hover:shadow-elevation-card-hover"
            >
              <div className="flex items-start gap-3">
                <BotAvatar
                  avatar={bot.avatar}
                  color={bot.color || "#017BE5"}
                  name={bot.name}
                  className="h-11 w-11 text-base"
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setWizard({ id: bot.id, step: 1 })}
                    className="block max-w-full truncate text-left text-sm font-semibold text-grey-90 hover:underline"
                  >
                    {bot.name}
                  </button>
                  <p className="mt-0.5 text-xs text-grey-50">
                    Created {timeAgo(bot.created_at)}
                  </p>
                </div>
                <ActionMenu
                  label={`Actions for ${bot.name}`}
                  items={[
                    {
                      label: "Edit",
                      icon: CogSixTooth,
                      onClick: () => setWizard({ id: bot.id, step: 1 }),
                    },
                    {
                      label: "Train",
                      icon: AcademicCap,
                      onClick: () => setWizard({ id: bot.id, step: 3 }),
                    },
                    {
                      label: "Channels",
                      icon: ChatBubbleLeftRight,
                      onClick: () => setWizard({ id: bot.id, step: 4 }),
                    },
                    {
                      label: "Test and embed",
                      icon: Code,
                      onClick: () => setWizard({ id: bot.id, step: 5 }),
                    },
                    {
                      label: bot.active ? "Pause" : "Activate",
                      icon: PlaySolid,
                      onClick: () => toggleActive(bot),
                    },
                    {
                      label: "Delete",
                      icon: Trash,
                      destructive: true,
                      onClick: () => setConfirmDelete(bot),
                    },
                  ]}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={bot.active ? "active" : "paused"} />
                <StatusBadge
                  status={
                    bot.training_status === "trained"
                      ? "success"
                      : bot.training_status === "training"
                        ? "processing"
                        : "draft"
                  }
                />
                <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                  {TRAINING_LABEL[bot.training_status] ?? "Not trained"}
                </span>
                <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                  {bot.reply_mode === "auto" ? "Answers automatically" : "Drafts only"}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 flex-1 text-xs leading-relaxed text-grey-50">
                {bot.instructions?.trim() ||
                  "No persona yet. Open the studio and tell the bot who it is."}
              </p>

              <div className="mt-4 flex gap-2 border-t border-grey-10 pt-4">
                <button
                  type="button"
                  onClick={() => setWizard({ id: bot.id, step: 1 })}
                  className="flex-1 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setWizard({ id: bot.id, step: 4 })}
                  className="flex-1 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10"
                >
                  Test and embed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {wizard && token && (
        <ChatbotWizard
          token={token}
          chatbotId={wizard.id}
          initialStep={wizard.step}
          onClose={() => {
            setWizard(null)
            load()
          }}
          onSaved={upsert}
        />
      )}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this chatbot"
        description={
          confirmDelete
            ? `"${confirmDelete.name}" and everything it has learned will be removed. This cannot be undone.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            disabled={deleting}
            className="rounded-base border border-grey-20 px-4 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete chatbot"}
          </button>
        </div>
      </Modal>
    </div>
  )
}
