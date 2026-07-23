"use client"

import React, { useEffect, useState } from "react"
import { CheckCircleSolid, CloudArrowUp } from "@medusajs/icons"
import { ImageUpload } from "@components/merchant-admin/image-upload"
import {
  MobileAppConfig,
  updateMobileAppConfig,
  uploadMobileAppIcon,
} from "@lib/merchant-admin/api"
import { PhonePreview } from "./phone-preview"

const DEFAULT_ACCENT = "#F26522"

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function BrandingEditor({
  token,
  config,
  onSaved,
}: {
  token: string
  config: MobileAppConfig | null
  onSaved: (next: MobileAppConfig) => void
}) {
  const [appName, setAppName] = useState(config?.app_name ?? "")
  const [iconUrl, setIconUrl] = useState<string | null>(config?.icon_url ?? null)
  const [accent, setAccent] = useState(config?.accent_color || DEFAULT_ACCENT)

  // `config` is fetched asynchronously by the parent page (mobile-app/page.tsx)
  // and may arrive AFTER this component has already mounted with empty defaults.
  // Sync local state whenever a config object lands so the merchant sees their
  // real store name / logo / accent pre-filled instead of an empty placeholder.
  // Keyed on the config fields (not identity) so re-renders that don't change
  // the incoming values never clobber what the merchant is currently typing.
  useEffect(() => {
    if (!config) {
      return
    }
    setAppName(config.app_name ?? "")
    setIconUrl(config.icon_url ?? null)
    setAccent(config.accent_color || DEFAULT_ACCENT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.app_name, config?.icon_url, config?.accent_color])

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const androidBundle = config?.android_bundle_id
  const iosBundle = config?.ios_bundle_id

  const validAccent = HEX_RE.test(accent) ? accent : DEFAULT_ACCENT

  const handleIcon = async (file: File | null) => {
    setError(null)
    if (!file) {
      setIconUrl(null)
      return
    }
    setUploading(true)
    try {
      const { url } = await uploadMobileAppIcon(token, file)
      setIconUrl(url)
      setSaved(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn't upload that icon. Please try again."
      )
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const next = await updateMobileAppConfig(token, {
        app_name: appName.trim(),
        icon_url: iconUrl,
        accent_color: validAccent,
      })
      onSaved(next)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn't save your branding just yet. Please try again."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
      {/* Editor */}
      <div className="space-y-6">
        {/* App name */}
        <div className="space-y-1.5">
          <label
            htmlFor="mobile-app-name"
            className="block text-sm font-medium text-grey-90"
          >
            App name
          </label>
          <input
            id="mobile-app-name"
            type="text"
            value={appName}
            onChange={(e) => {
              setAppName(e.target.value)
              setSaved(false)
            }}
            placeholder="Your store name"
            maxLength={30}
            className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 outline-none placeholder:text-grey-40 focus:border-grey-40"
          />
          <p className="text-xs text-grey-50">
            Shown under your icon on the phone. Keep it short — 30 characters or fewer.
          </p>
        </div>

        {/* App icon */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-grey-90">App icon</span>
          <ImageUpload
            currentUrl={iconUrl}
            file={null}
            onChange={handleIcon}
            loading={uploading}
          />
          <p className="text-xs text-grey-50">
            Use a square 1024&times;1024 PNG with no transparency (Apple rejects
            transparent icons). Uploading replaces the current icon.
          </p>
        </div>

        {/* Accent colour */}
        <div className="space-y-1.5">
          <label
            htmlFor="mobile-app-accent"
            className="block text-sm font-medium text-grey-90"
          >
            Accent colour
          </label>
          <div className="flex items-center gap-3">
            <input
              id="mobile-app-accent"
              type="color"
              value={validAccent}
              onChange={(e) => {
                setAccent(e.target.value)
                setSaved(false)
              }}
              aria-label="Pick accent colour"
              className="h-10 w-12 shrink-0 cursor-pointer rounded-base border border-grey-20 bg-white p-1"
            />
            <input
              type="text"
              value={accent}
              onChange={(e) => {
                setAccent(e.target.value)
                setSaved(false)
              }}
              placeholder="#F26522"
              spellCheck={false}
              className="w-32 rounded-base border border-grey-20 bg-white px-3 py-2 font-mono text-sm text-grey-90 outline-none focus:border-grey-40"
            />
            {!HEX_RE.test(accent) && (
              <span className="text-xs text-amber-600">Enter a valid hex, e.g. #F26522</span>
            )}
          </div>
          <p className="text-xs text-grey-50">
            Used for buttons, highlights and the app header. Defaults to your store accent.
          </p>
        </div>

        {/* Bundle ids */}
        {(androidBundle || iosBundle) && (
          <div className="rounded-base border border-grey-20 bg-grey-5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-grey-50">
              App identifiers
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              {androidBundle && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-grey-60">Android package</dt>
                  <dd className="font-mono text-xs text-grey-90">{androidBundle}</dd>
                </div>
              )}
              {iosBundle && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-grey-60">iOS bundle</dt>
                  <dd className="font-mono text-xs text-grey-90">{iosBundle}</dd>
                </div>
              )}
            </dl>
            <p className="mt-2 text-xs text-grey-50">
              Generated automatically from your store. You&apos;ll need these when you create
              the app in the Play Console or App Store Connect.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-base border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudArrowUp className="h-4 w-4" />
            {saving ? "Saving…" : "Save branding"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircleSolid className="h-4 w-4" />
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:pt-1">
        <PhonePreview appName={appName} iconUrl={iconUrl} accent={validAccent} />
      </div>
    </div>
  )
}
