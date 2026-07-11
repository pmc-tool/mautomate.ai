"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChatBubbleLeftRight, Plus, Trash, XMarkMini } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listMarketingChatbots,
  createMarketingChatbot,
  deleteMarketingChatbot,
  MarketingChatbot,
  ApiError,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

type KnowledgeRow = { kind: string; content: string; source: string }

const DATA_KINDS = [
  { value: "faq", label: "FAQ (content)" },
  { value: "url", label: "URL (source)" },
  { value: "product_catalog", label: "Product catalog" },
  { value: "blog", label: "Blog (source)" },
  { value: "file", label: "File (source)" },
]

export default function MarketingChatbotsPage() {
  const { token } = useMerchantAuth()
  const [chatbots, setChatbots] = useState<MarketingChatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: "",
    greeting: "",
    reply_mode: "draft" as "draft" | "auto",
  })
  const [sources, setSources] = useState<KnowledgeRow[]>([])

  const load = () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listMarketingChatbots(token, { limit: 100 })
      .then((res) => setChatbots(res.chatbots || []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load chatbots")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [token])

  const addSource = () =>
    setSources((s) => [...s, { kind: "faq", content: "", source: "" }])

  const updateSource = (i: number, patch: Partial<KnowledgeRow>) =>
    setSources((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const removeSource = (i: number) =>
    setSources((s) => s.filter((_, idx) => idx !== i))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !form.name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const data = sources
        .map((row) => ({
          kind: row.kind,
          content: row.content.trim() || undefined,
          source: row.source.trim() || undefined,
        }))
        .filter((row) => row.content || row.source)

      await createMarketingChatbot(token, {
        name: form.name.trim(),
        greeting: form.greeting.trim() || undefined,
        reply_mode: form.reply_mode,
        data: data.length ? data : undefined,
      })
      setForm({ name: "", greeting: "", reply_mode: "draft" })
      setSources([])
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chatbot")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!token) return
    if (!window.confirm(`Delete chatbot "${name}"? This cannot be undone.`)) return
    try {
      await deleteMarketingChatbot(token, id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chatbot")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Chatbots"
          description="Public-facing conversational bots for your store."
        />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create chatbot"}
        </button>
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="e.g. Store assistant"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">
                Reply mode
              </label>
              <select
                value={form.reply_mode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reply_mode: e.target.value as "draft" | "auto" }))
                }
                className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              >
                <option value="draft">Draft (review before send)</option>
                <option value="auto">Auto (reply automatically)</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-grey-70">Greeting</label>
            <input
              value={form.greeting}
              onChange={(e) => setForm((f) => ({ ...f, greeting: e.target.value }))}
              className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              placeholder="Hi! How can I help you today?"
            />
          </div>

          <div className="mt-5 border-t border-grey-10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-grey-70">Knowledge sources</p>
                <p className="text-xs text-grey-50">
                  Optional. FAQ uses content; URL/blog/file use a source link.
                </p>
              </div>
              <button
                type="button"
                onClick={addSource}
                className="inline-flex items-center gap-1 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add source
              </button>
            </div>
            <div className="space-y-3">
              {sources.map((row, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-base border border-grey-10 bg-grey-5 p-3 sm:flex-row sm:items-start"
                >
                  <select
                    value={row.kind}
                    onChange={(e) => updateSource(i, { kind: e.target.value })}
                    className="rounded-base border border-grey-20 bg-white px-2 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none sm:w-48"
                  >
                    {DATA_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  {row.kind === "faq" || row.kind === "product_catalog" ? (
                    <textarea
                      value={row.content}
                      onChange={(e) => updateSource(i, { content: e.target.value })}
                      className="min-h-[38px] flex-1 rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                      placeholder="Content the bot can answer from"
                    />
                  ) : (
                    <input
                      value={row.source}
                      onChange={(e) => updateSource(i, { source: e.target.value })}
                      className="flex-1 rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                      placeholder="https://example.com/page"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeSource(i)}
                    className="inline-flex items-center justify-center rounded-base border border-grey-20 p-2 text-grey-50 hover:bg-white hover:text-red-600"
                    aria-label="Remove source"
                  >
                    <XMarkMini className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create chatbot"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        {loading ? (
          <div className="p-8 text-center text-sm text-grey-50">Loading chatbots…</div>
        ) : chatbots.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ChatBubbleLeftRight}
              title="No chatbots yet"
              description="Create a chatbot to answer customer questions automatically."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-grey-5 text-grey-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Greeting</th>
                  <th className="px-5 py-3 text-left font-medium">Reply mode</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {chatbots.map((chatbot) => (
                  <tr key={chatbot.id} className="hover:bg-grey-5">
                    <td className="px-5 py-3 font-medium text-grey-90">
                      <Link
                        href={`/dashboard/marketing/chatbots/${chatbot.id}`}
                        className="hover:underline"
                      >
                        {chatbot.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-grey-60">{chatbot.greeting || "—"}</td>
                    <td className="px-5 py-3 capitalize text-grey-60">
                      {chatbot.reply_mode}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={chatbot.active ? "active" : "inactive"} />
                    </td>
                    <td className="px-5 py-3 text-grey-50">
                      {formatDate(chatbot.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/marketing/chatbots/${chatbot.id}`}
                          className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(chatbot.id, chatbot.name)}
                          className="inline-flex items-center justify-center rounded-base border border-grey-20 p-1.5 text-grey-50 hover:bg-grey-5 hover:text-red-600"
                          aria-label="Delete chatbot"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
