"use client"

import { useEffect, useState } from "react"
import { Envelope, Plus, Trash } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listMarketingEmailTemplates,
  createMarketingEmailTemplate,
  updateMarketingEmailTemplate,
  deleteMarketingEmailTemplate,
  MarketingEmailTemplate,
  ApiError,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const KINDS = ["broadcast", "transactional", "journey", "recovery"]

type FormState = {
  name: string
  kind: string
  subject: string
  preheader: string
  from_name: string
  from_email: string
  html: string
}

const emptyForm: FormState = {
  name: "",
  kind: "broadcast",
  subject: "",
  preheader: "",
  from_name: "",
  from_email: "",
  html: "",
}

export default function MarketingEmailPage() {
  const { token } = useMerchantAuth()
  const [templates, setTemplates] = useState<MarketingEmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const load = () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listMarketingEmailTemplates(token, { limit: 100 })
      .then((res) => setTemplates(res.templates || []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load email templates")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [token])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (t: MarketingEmailTemplate) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      kind: t.kind,
      subject: t.subject || "",
      preheader: t.preheader || "",
      from_name: t.from_name || "",
      from_email: t.from_email || "",
      html: t.html || "",
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        kind: form.kind,
        subject: form.subject.trim() || undefined,
        preheader: form.preheader.trim() || undefined,
        from_name: form.from_name.trim() || undefined,
        from_email: form.from_email.trim() || undefined,
        html: form.html.trim() || undefined,
      }
      if (editingId) {
        await updateMarketingEmailTemplate(token, editingId, payload)
      } else {
        await createMarketingEmailTemplate(token, payload)
      }
      closeForm()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!token) return
    if (!window.confirm(`Delete template "${name}"? This cannot be undone.`)) return
    try {
      await deleteMarketingEmailTemplate(token, id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Email templates"
          description="Reusable email templates for broadcasts and journeys."
        />
        <button
          onClick={() => (showForm ? closeForm() : openCreate())}
          className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create template"}
        </button>
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
        >
          <p className="mb-4 text-sm font-medium text-grey-70">
            {editingId ? "Edit template" : "New template"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="e.g. Welcome email"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Kind</label>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k} className="capitalize">
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Subject</label>
              <input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="Email subject line"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Preheader</label>
              <input
                value={form.preheader}
                onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="Preview text"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">From name</label>
              <input
                value={form.from_name}
                onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="Your store"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">From email</label>
              <input
                type="email"
                value={form.from_email}
                onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="hello@store.com"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-grey-70">HTML body</label>
            <textarea
              value={form.html}
              onChange={(e) => setForm((f) => ({ ...f, html: e.target.value }))}
              className="min-h-[140px] w-full resize-y rounded-base border border-grey-20 px-3 py-2 font-mono text-xs text-grey-90 focus:border-grey-90 focus:outline-none"
              placeholder="<html>…</html>"
            />
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Create template"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        {loading ? (
          <div className="p-8 text-center text-sm text-grey-50">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Envelope}
              title="No email templates yet"
              description="Create templates to send consistent emails to your customers."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-grey-5 text-grey-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Subject</th>
                  <th className="px-5 py-3 text-left font-medium">Kind</th>
                  <th className="px-5 py-3 text-left font-medium">From</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-grey-5">
                    <td className="px-5 py-3 font-medium text-grey-90">{template.name}</td>
                    <td className="px-5 py-3 text-grey-60">{template.subject || "—"}</td>
                    <td className="px-5 py-3 capitalize text-grey-60">{template.kind}</td>
                    <td className="px-5 py-3 text-grey-60">
                      {template.from_name || template.from_email || "—"}
                    </td>
                    <td className="px-5 py-3 text-grey-50">
                      {formatDate(template.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(template)}
                          className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template.id, template.name)}
                          className="inline-flex items-center justify-center rounded-base border border-grey-20 p-1.5 text-grey-50 hover:bg-grey-5 hover:text-red-600"
                          aria-label="Delete template"
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
