"use client"

import React, { useEffect, useState } from "react"
import { Sparkles } from "@medusajs/icons"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Select, Textarea } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  BlogAutopilot,
  getBlogAutopilot,
  updateBlogAutopilot,
} from "@lib/merchant-admin/blog-api"

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

/**
 * Blog Autopilot — the merchant's "agent that writes my blog": standing
 * topics + cadence; the platform writes one post per slot with AI and either
 * saves a draft for review or publishes it automatically.
 */
export function AutopilotModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { token } = useMerchantAuth()
  const [cfg, setCfg] = useState<BlogAutopilot | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open || !token) return
    setLoading(true)
    setError(null)
    setSaved(false)
    getBlogAutopilot(token)
      .then((res) => setCfg(res.autopilot))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load autopilot")
      )
      .finally(() => setLoading(false))
  }, [open, token])

  const set = <K extends keyof BlogAutopilot>(key: K, value: BlogAutopilot[K]) =>
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev))

  const save = async () => {
    if (!token || !cfg) return
    setSaving(true)
    setError(null)
    try {
      const res = await updateBlogAutopilot(token, {
        enabled: cfg.enabled,
        topics: cfg.topics,
        tone: cfg.tone,
        length: cfg.length,
        frequency: cfg.frequency,
        weekday: cfg.weekday,
        hour: cfg.hour,
        mode: cfg.mode,
        ai_cover: cfg.ai_cover,
      })
      setCfg(res.autopilot)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save autopilot")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Blog Autopilot"
      description="Your writing agent: give it standing topics and a schedule, and it writes posts for you — as drafts to review, or published automatically."
      size="md"
    >
      {loading || !cfg ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-base bg-grey-10" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {saved && !error && (
            <div className="rounded-base border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Autopilot saved.
            </div>
          )}
          {cfg.last_error === "out_of_credits" && (
            <div className="rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The last scheduled post was skipped — you were out of AI credits.
            </div>
          )}

          <FormToggle
            label="Autopilot on"
            description="Write a post automatically on the schedule below."
            checked={cfg.enabled}
            onChange={(v: boolean) => set("enabled", v)}
          />

          <FormField
            label="Topics"
            htmlFor="ap-topics"
            hint="One per line. Autopilot rotates through them; leave empty to let it pick seasonal topics for your store."
          >
            <Textarea
              id="ap-topics"
              value={cfg.topics}
              onChange={(e) => set("topics", e.target.value)}
              rows={4}
              placeholder={"Gift guide for the holidays\nHow to care for handmade products\nBehind the scenes at our studio"}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tone" htmlFor="ap-tone">
              <Select
                id="ap-tone"
                value={cfg.tone}
                onChange={(e) => set("tone", e.target.value)}
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="playful">Playful</option>
                <option value="luxury">Luxury</option>
              </Select>
            </FormField>
            <FormField label="Length" htmlFor="ap-length">
              <Select
                id="ap-length"
                value={cfg.length}
                onChange={(e) => set("length", e.target.value)}
              >
                <option value="short">Short (~250 words)</option>
                <option value="medium">Medium (~500 words)</option>
                <option value="long">Long (~900 words)</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="How often" htmlFor="ap-frequency">
              <Select
                id="ap-frequency"
                value={cfg.frequency}
                onChange={(e) => set("frequency", e.target.value as "daily" | "weekly")}
              >
                <option value="weekly">Once a week</option>
                <option value="daily">Every day</option>
              </Select>
            </FormField>
            {cfg.frequency === "weekly" ? (
              <FormField label="Day" htmlFor="ap-weekday">
                <Select
                  id="ap-weekday"
                  value={String(cfg.weekday)}
                  onChange={(e) => set("weekday", Number(e.target.value))}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <div />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Hour (UTC)" htmlFor="ap-hour">
              <Select
                id="ap-hour"
                value={String(cfg.hour)}
                onChange={(e) => set("hour", Number(e.target.value))}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="What happens with the post" htmlFor="ap-mode">
              <Select
                id="ap-mode"
                value={cfg.mode}
                onChange={(e) => set("mode", e.target.value as "draft" | "publish")}
              >
                <option value="draft">Save as draft for my review</option>
                <option value="publish">Publish automatically</option>
              </Select>
            </FormField>
          </div>

          <FormToggle
            label="AI cover image"
            description="Also generate a cover image for each post (uses image credits)."
            checked={cfg.ai_cover}
            onChange={(v: boolean) => set("ai_cover", v)}
          />

          <p className="text-xs text-grey-50">
            Each post uses your AI credits (writing, plus the cover when enabled). If
            you run out of credits, the slot is skipped and retried after a top-up.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {saving ? "Saving..." : "Save autopilot"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
