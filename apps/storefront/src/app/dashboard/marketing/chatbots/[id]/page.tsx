"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Textarea, Select } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getMarketingChatbot,
  updateMarketingChatbot,
  deleteMarketingChatbot,
  MarketingChatbot,
  MarketingChatbotData,
  ApiError,
} from "@lib/merchant-admin/api"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function EditChatbotPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [chatbot, setChatbot] = useState<MarketingChatbot | null>(null)
  const [data, setData] = useState<MarketingChatbotData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [greeting, setGreeting] = useState("")
  const [replyMode, setReplyMode] = useState<"draft" | "auto">("draft")
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    getMarketingChatbot(token, id)
      .then((res) => {
        setChatbot(res.chatbot)
        setData(res.data || [])
        setName(res.chatbot.name)
        setGreeting(res.chatbot.greeting || "")
        setReplyMode((res.chatbot.reply_mode as "draft" | "auto") || "draft")
        setActive(res.chatbot.active)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load chatbot")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !chatbot) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await updateMarketingChatbot(token, chatbot.id, {
        name: name.trim(),
        greeting: greeting.trim() || null,
        reply_mode: replyMode,
        active,
      })
      setChatbot(res.chatbot)
      setMessage("Chatbot saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chatbot")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !chatbot) return
    if (!window.confirm(`Delete chatbot "${chatbot.name}"? This cannot be undone.`)) return
    try {
      await deleteMarketingChatbot(token, chatbot.id)
      router.push("/dashboard/marketing/chatbots")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chatbot")
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-grey-50">Loading chatbot…</div>
  }

  if (!chatbot) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/marketing/chatbots"
          className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chatbots
        </Link>
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Chatbot not found."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/marketing/chatbots"
        className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to chatbots
      </Link>

      <div className="flex items-start justify-between gap-4">
        <PageHeader title={chatbot.name} description="Edit this chatbot's settings." />
        <button
          onClick={handleDelete}
          className="inline-flex shrink-0 items-center gap-2 rounded-base border border-grey-20 px-4 py-2 text-sm font-medium text-grey-70 hover:bg-grey-5 hover:text-red-600"
        >
          <Trash className="h-4 w-4" />
          Delete
        </button>
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-base border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Settings">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </FormField>
            <FormField label="Reply mode">
              <Select
                value={replyMode}
                onChange={(e) => setReplyMode(e.target.value as "draft" | "auto")}
              >
                <option value="draft">Draft (review before send)</option>
                <option value="auto">Auto (reply automatically)</option>
              </Select>
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="Greeting">
              <Textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="Hi! How can I help you today?"
              />
            </FormField>
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm text-grey-70">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-grey-30"
              />
              Active
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Details"
          description="Read-only identifiers for this chatbot."
        >
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-grey-50">Public key</dt>
              <dd className="break-all font-mono text-grey-90">
                {chatbot.public_key || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-grey-50">Created</dt>
              <dd className="text-grey-90">{formatDate(chatbot.created_at)}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Knowledge sources"
          description="Sources seeded when this chatbot was created."
        >
          {data.length === 0 ? (
            <p className="text-sm text-grey-50">No knowledge sources.</p>
          ) : (
            <ul className="divide-y divide-grey-10 text-sm">
              {data.map((row) => (
                <li key={row.id} className="flex items-start gap-3 py-2">
                  <span className="rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium capitalize text-grey-70">
                    {row.kind.replace(/_/g, " ")}
                  </span>
                  <span className="flex-1 break-words text-grey-80">
                    {row.content || row.source || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
