"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listThemes, updateTheme, Theme, apiUrl } from "@lib/merchant-admin/api"
import { AuthGate } from "../../../components/merchant-admin/auth-gate"
import { CheckCircleSolid, PencilSquare, Spinner, ExclamationCircle, CheckCircle, Photo } from "@medusajs/icons"

function classNames(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

function SkeletonThemeCard() {
  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="aspect-[4/3] bg-grey-10 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-2/3 rounded bg-grey-10 animate-pulse" />
        <div className="h-4 w-full rounded bg-grey-10 animate-pulse" />
        <div className="h-9 w-full rounded-base bg-grey-10 animate-pulse" />
      </div>
    </div>
  )
}

function SkeletonActiveTheme() {
  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="aspect-[16/9] bg-grey-10 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-6 w-1/3 rounded bg-grey-10 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-grey-10 animate-pulse" />
      </div>
    </div>
  )
}

function EmptyPreview({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-grey-5 text-grey-40">
      <div className="rounded-full bg-white p-3 shadow-borders-base">
        <Photo className="h-6 w-6" />
      </div>
      <span className="text-sm font-medium">{label || "No preview available"}</span>
    </div>
  )
}

function DesignPageContent() {
  const { token, me } = useMerchantAuth()
  const [themes, setThemes] = useState<Theme[]>([])
  const [activeTheme, setActiveTheme] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchThemes = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await listThemes(token)
      setThemes(data.themes.map((t) => ({ ...t, active: t.id === data.active_theme })))
      setActiveTheme(data.active_theme)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load themes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThemes()
  }, [token])

  const activateTheme = async (themeId: string) => {
    if (!token || themeId === activeTheme) return
    setSaving(themeId)
    setMessage(null)
    try {
      await updateTheme(token, { active_theme: themeId })
      setActiveTheme(themeId)
      setThemes((prev) =>
        prev.map((t) => ({ ...t, active: t.id === themeId }))
      )
      setMessage("Theme activated successfully.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate theme")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-grey-90 tracking-tight">Design</h1>
          <p className="text-grey-50 mt-1 text-sm sm:text-base">Choose a theme and customize your storefront.</p>
        </div>
        <button
          onClick={async () => {
            if (!token) return
            try {
              const res = await fetch(apiUrl("/merchant/cms/visual-editor?slug=home"), {
                headers: { authorization: `Bearer ${token}` },
              })
              const data = await res.json().catch(() => ({} as any))
              if (!res.ok || !data.key || !data.to) {
                setError(data.message || "Could not open the visual editor.")
                return
              }
              // Open the editor on the store's own domain so the storefront middleware
          // resolves the correct tenant theme/assets. Falls back to the current
          // host if no domain is available (shouldn't happen for an active merchant).
          const storeHost = me?.store?.domain || window.location.host
          const editorOrigin =
            storeHost === window.location.host
              ? window.location.origin
              : `https://${storeHost}`
          const redirectUrl =
            `${editorOrigin}/api/editor-auth` +
            `?key=${encodeURIComponent(data.key)}&to=${encodeURIComponent(data.to)}`
          window.location.href = redirectUrl
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not open the visual editor.")
            }
          }}
          className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-grey-90 text-white rounded-base font-medium shadow-sm hover:bg-grey-80 hover:shadow-md hover:-translate-y-px active:translate-y-0 transition-all"
        >
          <PencilSquare className="w-4 h-4 transition-transform group-hover:rotate-12" />
          Open visual editor
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-large border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="mb-6 flex items-start gap-3 rounded-large border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-sm">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-8">
          <div>
            <h2 className="text-xs font-semibold text-grey-70 uppercase tracking-wider mb-3">Active theme</h2>
            <SkeletonActiveTheme />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-grey-70 uppercase tracking-wider mb-3">Theme gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonThemeCard />
              <SkeletonThemeCard />
              <SkeletonThemeCard />
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeTheme && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-grey-70 uppercase tracking-wider mb-3">Active theme</h2>
              {themes
                .filter((t) => t.id === activeTheme)
                .map((theme) => (
                  <div
                    key={theme.id}
                    className="relative overflow-hidden rounded-large border-2 border-teal-600 bg-white shadow-md transition-shadow hover:shadow-lg"
                  >
                    <div className="aspect-[16/9] relative bg-grey-10">
                      {theme.preview ? (
                        <Image
                          src={theme.preview}
                          alt={theme.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <EmptyPreview />
                      )}
                      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-600 text-white text-xs font-medium shadow-sm">
                        <CheckCircleSolid className="w-3.5 h-3.5" />
                        Active
                      </div>
                    </div>
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-grey-90">{theme.name}</h3>
                        {theme.description && (
                          <p className="text-grey-50 mt-1 text-sm">{theme.description}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-base border border-grey-20 bg-white text-sm font-medium text-grey-70">
                        <PencilSquare className="w-4 h-4" />
                        Customize
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div>
            <h2 className="text-xs font-semibold text-grey-70 uppercase tracking-wider mb-3">Theme gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {themes.map((theme) => {
                const isActive = theme.id === activeTheme
                return (
                  <div
                    key={theme.id}
                    className={classNames(
                      "group relative overflow-hidden rounded-large border bg-white shadow-borders-base transition-all hover:-translate-y-0.5 hover:shadow-md",
                      isActive ? "border-teal-600 ring-1 ring-teal-600" : "border-grey-20 hover:border-grey-30"
                    )}
                  >
                    <div className="aspect-[4/3] relative bg-grey-10 overflow-hidden">
                      {theme.preview ? (
                        <Image
                          src={theme.preview}
                          alt={theme.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <EmptyPreview label="No preview" />
                      )}
                      {isActive && (
                        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-600 text-white text-xs font-medium shadow-sm">
                          <CheckCircleSolid className="w-3.5 h-3.5" />
                          Active
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-grey-90">{theme.name}</h3>
                      {theme.description && (
                        <p className="text-sm text-grey-50 mt-1 line-clamp-2">{theme.description}</p>
                      )}
                      <button
                        onClick={() => activateTheme(theme.id)}
                        disabled={isActive || saving === theme.id}
                        className={classNames(
                          "mt-4 w-full inline-flex items-center justify-center px-3 py-2 rounded-base text-sm font-medium transition-all",
                          isActive
                            ? "bg-grey-10 text-grey-50 cursor-default"
                            : "bg-grey-90 text-white hover:bg-grey-80 hover:shadow-sm disabled:opacity-50 disabled:hover:shadow-none"
                        )}
                      >
                        {saving === theme.id ? (
                          <>
                            <Spinner className="w-4 h-4 animate-spin mr-1.5" />
                            Activating...
                          </>
                        ) : isActive ? (
                          <>
                            <CheckCircleSolid className="w-4 h-4 mr-1.5" />
                            Currently active
                          </>
                        ) : (
                          "Activate theme"
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DesignPage() {
  return (
    <AuthGate>
      <DesignPageContent />
    </AuthGate>
  )
}
