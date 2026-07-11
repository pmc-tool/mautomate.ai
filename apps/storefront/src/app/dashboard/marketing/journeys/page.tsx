"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Sparkles, Trash } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listMarketingJourneys,
  createMarketingJourney,
  deleteMarketingJourney,
  MarketingJourney,
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

export default function MarketingJourneysPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()
  const [journeys, setJourneys] = useState<MarketingJourney[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger_event: "manual",
  })

  const load = () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listMarketingJourneys(token, { limit: 100 })
      .then((res) => setJourneys(res.journeys || []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load journeys")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [token])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !form.name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await createMarketingJourney(token, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        trigger_event: form.trigger_event,
        status: "draft",
        steps: [],
      })
      // Jump straight into the step builder for the new draft journey.
      router.push(`/dashboard/marketing/journeys/${res.journey.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create journey")
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!token) return
    if (!window.confirm(`Delete journey "${name}"? This cannot be undone.`)) return
    try {
      await deleteMarketingJourney(token, id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete journey")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Journeys"
          description="Automated customer journeys triggered by events."
        />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex shrink-0 items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create journey"}
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
                placeholder="e.g. Abandoned cart recovery"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-grey-70">
                Trigger event
              </label>
              <select
                value={form.trigger_event}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trigger_event: e.target.value }))
                }
                className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              >
                <option value="manual">Manual</option>
                <option value="cart.updated">Cart updated</option>
                <option value="order.placed">Order placed</option>
                <option value="order.completed">Order completed</option>
                <option value="customer.created">Customer created</option>
                <option value="segment">Segment</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-grey-70">
              Description
            </label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              placeholder="What this journey does"
            />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <p className="mr-auto text-xs text-grey-50">
              Creates a draft, then opens the step builder.
            </p>
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create & build steps"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        {loading ? (
          <div className="p-8 text-center text-sm text-grey-50">Loading journeys…</div>
        ) : journeys.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Sparkles}
              title="No journeys yet"
              description="Build journeys to automate follow-ups and recover abandoned carts."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-grey-5 text-grey-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Trigger</th>
                  <th className="px-5 py-3 text-left font-medium">Steps</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {journeys.map((journey) => (
                  <tr key={journey.id} className="hover:bg-grey-5">
                    <td className="px-5 py-3 font-medium text-grey-90">
                      <Link
                        href={`/dashboard/marketing/journeys/${journey.id}`}
                        className="hover:underline"
                      >
                        {journey.name}
                      </Link>
                      {journey.description && (
                        <p className="text-xs font-normal text-grey-50">
                          {journey.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-grey-60">{journey.trigger_event}</td>
                    <td className="px-5 py-3 text-grey-60">
                      {Array.isArray(journey.steps) ? journey.steps.length : 0}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={journey.status} />
                    </td>
                    <td className="px-5 py-3 text-grey-50">
                      {formatDate(journey.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/marketing/journeys/${journey.id}`}
                          className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-5"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(journey.id, journey.name)}
                          className="inline-flex items-center justify-center rounded-base border border-grey-20 p-1.5 text-grey-50 hover:bg-grey-5 hover:text-red-600"
                          aria-label="Delete journey"
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
