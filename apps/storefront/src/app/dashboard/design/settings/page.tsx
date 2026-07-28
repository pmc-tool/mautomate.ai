"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getThemeSettings,
  saveThemeSettings,
  ThemeSettingEntry,
} from "@lib/merchant-admin/api"
import { AuthGate } from "../../../../components/merchant-admin/auth-gate"
import { Spinner, CheckCircle, ExclamationCircle } from "@medusajs/icons"

/* Theme settings — the merchant's values for the ACTIVE theme's theme.json
 * settings schema (announcement bar, footer blurb, checkout branding, ...).
 * The schema is authored by the theme; this page just renders it. Values are
 * stored per theme handle, so switching themes keeps earlier tweaks. */

type Values = Record<string, unknown>

/** Common storefront font families for the theme-settings font pickers. */
const FONT_SUGGESTIONS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
  "Nunito",
  "Raleway",
  "Playfair Display",
  "Marcellus",
  "Cormorant Garamond",
  "DM Sans",
  "Work Sans",
  "Source Sans 3",
  "Jost",
  "Karla",
  "Libre Baskerville",
  "Merriweather",
  "Oswald",
  "Quicksand",
  "Georgia",
  "Times New Roman",
  "Arial",
  "Helvetica Neue",
]

function Field({
  entry,
  value,
  onChange,
}: {
  entry: ThemeSettingEntry
  value: unknown
  onChange: (v: unknown) => void
}) {
  const base =
    "w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-50 focus:outline-none bg-white"
  switch (entry.type) {
    case "color": {
      const v = typeof value === "string" && value ? value : "#000000"
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-base border border-grey-20 bg-white p-1"
          />
          <input
            type="text"
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className={base + " max-w-[120px] font-mono"}
          />
        </div>
      )
    }
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-grey-90">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Enabled</span>
        </label>
      )
    case "range": {
      const n = Number(value ?? entry.default ?? entry.min ?? 0)
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={entry.min}
            max={entry.max}
            step={entry.step ?? 1}
            value={n}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-20 text-right text-sm text-grey-50">
            {n}
            {entry.unit ?? ""}
          </span>
        </div>
      )
    }
    case "select": {
      const opts = (entry.options ?? []).map((o: any) =>
        typeof o === "string" ? { value: o, label: o } : o
      )
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          {opts.map((o: any) => (
            <option key={o.value} value={o.value}>
              {o.label ?? o.value}
            </option>
          ))}
        </select>
      )
    }
    case "textarea":
      return (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={base}
        />
      )
    default: {
      // Font settings get native suggestions (QA 52: free-typing a font name
      // with no hints). Any entry whose type/id/label mentions "font" offers
      // the common storefront stacks via a datalist - typing stays possible.
      const isFont =
        /font/i.test(String(entry.type ?? "")) ||
        /font/i.test(String(entry.id ?? "")) ||
        /font/i.test(String(entry.label ?? ""))
      if (isFont) {
        const listId = `fonts-${entry.id ?? "generic"}`
        return (
          <>
            <input
              type="text"
              list={listId}
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Start typing a font name..."
              className={base}
            />
            <datalist id={listId}>
              {FONT_SUGGESTIONS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </>
        )
      }
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )
    }
  }
}

function ThemeSettingsContent() {
  const { token } = useMerchantAuth()
  const [handle, setHandle] = useState("")
  const [schema, setSchema] = useState<ThemeSettingEntry[]>([])
  const [values, setValues] = useState<Values>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getThemeSettings(token)
      .then((d) => {
        setHandle(d.handle)
        setSchema(d.schema ?? [])
        // Effective starting values: theme defaults overridden by saved.
        const init: Values = {}
        for (const s of d.schema ?? []) {
          if (!s.id || s.type === "header") continue
          init[s.id] = d.values?.[s.id] ?? s.default
        }
        setValues(init)
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load settings")
      )
      .finally(() => setLoading(false))
  }, [token])

  const groups = useMemo(() => {
    const out: { label: string; entries: ThemeSettingEntry[] }[] = []
    let current = { label: "General", entries: [] as ThemeSettingEntry[] }
    for (const s of schema) {
      if (s.type === "header") {
        if (current.entries.length) out.push(current)
        current = { label: s.label ?? "Settings", entries: [] }
      } else if (s.id) {
        current.entries.push(s)
      }
    }
    if (current.entries.length) out.push(current)
    return out
  }, [schema])

  const save = async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await saveThemeSettings(token, values)
      setMessage(
        "Saved. Your storefront picks the change up within about a minute."
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-grey-90">Theme settings</h1>
          <p className="mt-1 text-sm text-grey-50">
            Options your active theme{handle ? ` (${handle})` : ""} exposes —
            including checkout branding. Changes apply to your live store.
          </p>
        </div>
        <Link
          href="/dashboard/design"
          className="rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 hover:bg-grey-5"
        >
          Back to Design
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-large border border-grey-20 bg-white p-6 text-grey-50">
          <Spinner className="animate-spin" /> Loading theme settings...
        </div>
      ) : schema.filter((s) => s.id && s.type !== "header").length === 0 ? (
        <div className="rounded-large border border-grey-20 bg-white p-6 text-sm text-grey-50">
          This theme does not expose any settings.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div
              key={g.label}
              className="rounded-large border border-grey-20 bg-white shadow-borders-base"
            >
              <div className="border-b border-grey-20 px-5 py-3 text-sm font-semibold text-grey-90">
                {g.label}
              </div>
              <div className="space-y-5 p-5">
                {g.entries.map((entry) => (
                  <div key={entry.id}>
                    <label className="mb-1.5 block text-sm font-medium text-grey-90">
                      {entry.label ?? entry.id}
                    </label>
                    <Field
                      entry={entry}
                      value={values[entry.id!]}
                      onChange={(v) =>
                        setValues((prev) => ({ ...prev, [entry.id!]: v }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <ExclamationCircle /> {error}
            </div>
          )}
          {message && (
            <div className="flex items-center gap-2 rounded-base border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle /> {message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-base bg-grey-90 px-5 py-2.5 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ThemeSettingsPage() {
  return (
    <AuthGate>
      <ThemeSettingsContent />
    </AuthGate>
  )
}
