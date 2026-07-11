"use client"

import { useEffect, useState } from "react"
import { Hashtag, Plus, Trash } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listMarketingCampaigns,
  createMarketingCampaign,
  updateMarketingCampaign,
  deleteMarketingCampaign,
  MarketingCampaign,
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

const STATUSES = ["draft", "active", "paused", "completed"]

type FormState = {
  name: string
  objective: string
  status: string
  starts_at: string
  ends_at: string
}

const emptyForm: FormState = {
  name: "",
  objective: "",
  status: "draft",
  starts_at: "",
  ends_at: "",
}

export default function MarketingCampaignsPage() {
  const { token } = useMerchantAuth()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
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
    listMarketingCampaigns(token, { limit: 100 })
      .then((res) => setCampaigns(res.campaigns || []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load campaigns")
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

  const openEdit = (c: MarketingCampaign) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      objective: c.objective || "",
      status: c.status,
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : "",
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : "",
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
        objective: form.objective.trim() || undefined,
        status: form.status,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : undefined,
      }
      if (editingId) {
        await updateMarketingCampaign(token, editingId, payload)
      } else {
        await createMarketingCampaign(token, payload)
      }
      closeForm()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!token) return
    if (!window.confirm(`Delete campaign "${name}"? This cannot be undone.`)) return
    try {
      await deleteMarketingCampaign(token, id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Campaigns"
          description="Themed groups of posts pursuing a shared objective."
        />
        <button
          onClick={() => (showForm ? closeForm() : openCreate())}
          className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create campaign"}
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
            {editingId ? "Edit campaign" : "New campaign"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                placeholder="e.g. Summer sale"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-grey-70">Objective</label>
            <input
              value={form.objective}
              onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
              className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              placeholder="What this campaign is for"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Starts</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">Ends</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Create campaign"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        {loading ? (
          <div className="p-8 text-center text-sm text-grey-50">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Hashtag}
              title="No campaigns yet"
              description="Create campaigns to organize your marketing content."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-grey-5 text-grey-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Objective</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Starts</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-grey-5">
                    <td className="px-5 py-3 font-medium text-grey-90">{campaign.name}</td>
                    <td className="px-5 py-3 text-grey-60">{campaign.objective || "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-5 py-3 text-grey-50">
                      {campaign.starts_at ? formatDate(campaign.starts_at) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(campaign)}
                          className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(campaign.id, campaign.name)}
                          className="inline-flex items-center justify-center rounded-base border border-grey-20 p-1.5 text-grey-50 hover:bg-grey-5 hover:text-red-600"
                          aria-label="Delete campaign"
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
