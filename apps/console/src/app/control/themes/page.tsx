"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  Check,
  CubeSolid,
  CloudArrowUp,
  ExclamationCircle,
  ListCheckbox,
  PencilSquare,
  Swatch,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  getThemes,
  getUploadedThemes,
  updateTenantEntitlements,
  updateTenantTheme,
  uploadTheme,
  type TenantTheme,
  type ThemeCatalogItem,
  type UploadedTheme,
  type UploadValidationError,
} from "@/lib/api/themes"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

type ThemeModalState =
  | { type: "theme"; tenant: TenantTheme }
  | { type: "entitlements"; tenant: TenantTheme }
  | null

export default function ThemesPage() {
  const { token } = useControlAuth()

  const [catalog, setCatalog] = useState<ThemeCatalogItem[]>([])
  const [tenants, setTenants] = useState<TenantTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingTenantId, setWorkingTenantId] = useState<string | null>(null)

  const [modal, setModal] = useState<ThemeModalState>(null)
  const [selectedTheme, setSelectedTheme] = useState<string>("")
  const [selectedEntitlements, setSelectedEntitlements] = useState<string[]>([])

  // Uploaded (Liquid) themes — the upload library.
  const [uploaded, setUploaded] = useState<UploadedTheme[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<UploadValidationError[]>([])
  const [uploadNote, setUploadNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [res, up] = await Promise.all([
        getThemes(token),
        getUploadedThemes(token).catch(() => ({ themes: [] })),
      ])
      setCatalog(res.catalog || [])
      setTenants(res.tenants || [])
      setUploaded(up.themes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load themes")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (modal?.type === "theme") {
      setSelectedTheme(modal.tenant.active_theme ?? "")
    } else if (modal?.type === "entitlements") {
      setSelectedEntitlements(modal.tenant.allowed_themes ?? [])
    }
  }, [modal])

  const themeById = useMemo(() => {
    return new Map(catalog.map((theme) => [theme.id, theme]))
  }, [catalog])

  const handleUpdateTheme = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !modal || modal.type !== "theme") return
    if (!selectedTheme) {
      setError("Please select a theme")
      return
    }
    setWorkingTenantId(modal.tenant.id)
    try {
      await updateTenantTheme(token, modal.tenant.id, selectedTheme)
      await load()
      setModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update theme")
    } finally {
      setWorkingTenantId(null)
    }
  }

  const handleUpdateEntitlements = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !modal || modal.type !== "entitlements") return
    setWorkingTenantId(modal.tenant.id)
    try {
      await updateTenantEntitlements(token, modal.tenant.id, selectedEntitlements)
      await load()
      setModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entitlements")
    } finally {
      setWorkingTenantId(null)
    }
  }

  const toggleEntitlement = (themeId: string) => {
    setSelectedEntitlements((prev) =>
      prev.includes(themeId) ? prev.filter((id) => id !== themeId) : [...prev, themeId]
    )
  }

  const entitlementTenant =
    modal?.type === "entitlements" ? modal.tenant : null
  const activeThemeDropped =
    !!entitlementTenant &&
    !!entitlementTenant.active_theme &&
    selectedEntitlements.length > 0 &&
    !selectedEntitlements.includes(entitlementTenant.active_theme)

  const tenantColumns = useMemo<Column<TenantTheme>[]>(
    () => [
      {
        key: "name",
        header: "Tenant",
        render: (row) => (
          <div>
            <div className="font-medium text-grey-90">{row.name}</div>
            <div className="text-xs text-grey-50">{row.id}</div>
          </div>
        ),
      },
      {
        key: "active_theme",
        header: "Active theme",
        render: (row) => {
          const theme = row.active_theme ? themeById.get(row.active_theme) : undefined
          return (
            <span className="font-medium text-grey-90">
              {theme ? theme.name : row.active_theme ?? "—"}
            </span>
          )
        },
      },
      {
        key: "allowed_themes",
        header: "Allowed themes",
        render: (row) =>
          !row.allowed_themes || row.allowed_themes.length === 0 ? (
            <span className="text-grey-50">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.allowed_themes.map((themeId) => {
                const theme = themeById.get(themeId)
                return (
                  <StatusBadge
                    key={themeId}
                    status={theme ? theme.name : themeId}
                  />
                )
              })}
            </div>
          ),
      },
    ],
    [themeById]
  )

  const onUpload = useCallback(
    async (file: File | undefined) => {
      if (!token || !file) return
      if (!/\.zip$/i.test(file.name)) {
        setUploadErrors([{ level: "error", message: "Upload a .zip theme package." }])
        setUploadNote(null)
        return
      }
      setUploadBusy(true)
      setUploadErrors([])
      setUploadNote(null)
      try {
        const r = await uploadTheme(token, file)
        if (r.ok) {
          setUploadNote(
            `${r.theme.name} ${r.theme.version} uploaded — ${r.files} files.` +
              (r.warnings.length ? ` ${r.warnings.length} warning(s).` : "")
          )
          await load()
        } else {
          setUploadErrors(
            r.errors.length ? r.errors : [{ level: "error", message: r.message }]
          )
        }
      } catch (err) {
        setUploadErrors([
          { level: "error", message: err instanceof Error ? err.message : "Upload failed" },
        ])
      } finally {
        setUploadBusy(false)
      }
    },
    [token, load]
  )

  const headerActions = (
    <button
      onClick={load}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
    >
      <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
      Refresh
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Themes & Storefronts"
        description="Manage the theme catalog and assign themes to tenants."
        action={headerActions}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Swatch className="h-5 w-5 text-grey-50" />
          <h2 className="text-lg font-semibold text-grey-90">Theme catalog</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10"
              />
            ))}
          </div>
        ) : catalog.length === 0 ? (
          <EmptyState
            title="No themes"
            description="Themes in the catalog will appear here once they are registered."
            icon={CubeSolid}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((theme) => (
              <div
                key={theme.id}
                className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
              >
                <div className="mb-4 overflow-hidden rounded-base border border-grey-10 bg-grey-5">
                  {theme.preview ? (
                    <img
                      src={theme.preview}
                      alt={`${theme.name} preview`}
                      className="h-32 w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center">
                      <CubeSolid className="h-8 w-8 text-grey-40" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-grey-90">{theme.name}</h3>
                  <StatusBadge status={theme.active_on > 0 ? "active" : "inactive"} />
                </div>
                <p className="mt-1 text-sm text-grey-50">{theme.id}</p>
                <p className="mt-3 line-clamp-3 text-sm text-grey-70">
                  {theme.description}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-grey-10 pt-4 text-sm">
                  <span className="text-grey-50">Active on</span>
                  <span className="font-medium text-grey-90">
                    {theme.active_on} {theme.active_on === 1 ? "tenant" : "tenants"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Uploaded (Liquid) themes: the upload library ---- */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CloudArrowUp className="h-5 w-5 text-grey-50" />
          <h2 className="text-lg font-semibold text-grey-90">Uploaded themes</h2>
          <span className="rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-60">
            {uploaded.length}
          </span>
        </div>

        {/* Dropzone */}
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            onUpload(e.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-large border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-[#F26522] bg-[#FEF1EA]"
              : "border-grey-30 bg-grey-5 hover:border-grey-40 hover:bg-grey-10",
            uploadBusy && "pointer-events-none opacity-60"
          )}
        >
          <input
            type="file"
            accept=".zip"
            className="hidden"
            disabled={uploadBusy}
            onChange={(e) => {
              onUpload(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <CloudArrowUp className="h-8 w-8 text-grey-40" />
          <div className="text-sm font-medium text-grey-90">
            {uploadBusy ? "Validating and storing…" : "Drop a theme .zip here, or click to choose"}
          </div>
          <div className="text-xs text-grey-50">
            Validated on upload — a rejected theme is never stored.
          </div>
        </label>

        {uploadNote && (
          <div className="flex items-start gap-3 rounded-large border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            {uploadNote}
          </div>
        )}

        {uploadErrors.length > 0 && (
          <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <ExclamationCircle className="h-5 w-5" />
              The theme was rejected
            </div>
            <ul className="space-y-1 pl-1">
              {uploadErrors.map((e, i) => (
                <li key={i} className="flex gap-2 font-mono text-xs">
                  {(e.path || e.line) && (
                    <span className="shrink-0 text-red-500">
                      {e.path}
                      {e.line ? `:${e.line}` : ""}
                    </span>
                  )}
                  <span>{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {uploaded.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uploaded.map((t) => (
              <div
                key={t.id}
                className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
              >
                <div className="mb-4 overflow-hidden rounded-base border border-grey-10 bg-grey-5">
                  {t.preview ? (
                    <img
                      src={t.preview}
                      alt={`${t.name} preview`}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center">
                      <Swatch className="h-8 w-8 text-grey-40" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-grey-90">{t.name}</h3>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-grey-50">
                  {t.handle} · v{t.current_version}
                </p>
                {t.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-grey-70">{t.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-grey-10 pt-4 text-sm">
                  <span className="text-grey-50">
                    {t.settings.length} setting{t.settings.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-grey-50">
                    {t.versions.length} version{t.versions.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <div className="mb-4 flex items-center gap-2">
          <ListCheckbox className="h-5 w-5 text-grey-50" />
          <h2 className="text-lg font-semibold text-grey-90">Tenant assignments</h2>
        </div>
        <DataTable
          columns={tenantColumns}
          rows={tenants}
          searchKeys={["name", "id", "active_theme", "allowed_themes"]}
          isLoading={loading}
          emptyIcon={CubeSolid}
          emptyTitle="No tenant assignments"
          emptyDescription="Tenants and their active themes will appear here."
          rowActions={(row) => (
            <>
              <button
                onClick={() => setModal({ type: "theme", tenant: row })}
                disabled={workingTenantId === row.id}
                className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
                title="Set active theme"
              >
                <PencilSquare className="h-3.5 w-3.5" />
                Set theme
              </button>
              <button
                onClick={() => setModal({ type: "entitlements", tenant: row })}
                disabled={workingTenantId === row.id}
                className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
                title="Edit allowed themes"
              >
                <ListCheckbox className="h-3.5 w-3.5" />
                Edit entitlements
              </button>
            </>
          )}
        />
      </div>

      <Modal
        open={modal?.type === "theme"}
        onClose={() => setModal(null)}
        title="Set active theme"
        description={
          modal?.type === "theme"
            ? `Choose the theme that ${modal.tenant.name} will use.`
            : undefined
        }
        size="sm"
      >
        <form onSubmit={handleUpdateTheme} className="space-y-4">
          <div>
            <label
              htmlFor="active-theme"
              className="mb-1.5 block text-sm font-medium text-grey-70"
            >
              Theme
            </label>
            <select
              id="active-theme"
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            >
              <option value="" disabled>
                Select a theme
              </option>
              {catalog.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingTenantId === modal?.tenant?.id}
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              {workingTenantId === modal?.tenant?.id ? (
                <ArrowPath className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal?.type === "entitlements"}
        onClose={() => setModal(null)}
        title="Edit allowed themes"
        description={
          entitlementTenant
            ? `Toggle which themes ${entitlementTenant.name} is entitled to. At least one is required.`
            : undefined
        }
        size="md"
      >
        <form onSubmit={handleUpdateEntitlements} className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-grey-70">
              <span className="font-medium text-grey-90">
                {selectedEntitlements.length}
              </span>{" "}
              of {catalog.length} themes enabled
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedEntitlements(catalog.map((theme) => theme.id))
                }
                className="rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedEntitlements([])}
                className="rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90"
              >
                Clear
              </button>
            </div>
          </div>

          {catalog.length === 0 ? (
            <p className="text-sm text-grey-50">No themes available.</p>
          ) : (
            <div className="grid max-h-[26rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {catalog.map((theme) => {
                const checked = selectedEntitlements.includes(theme.id)
                const isActive =
                  entitlementTenant?.active_theme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => toggleEntitlement(theme.id)}
                    aria-pressed={checked}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-large border text-left transition-all",
                      checked
                        ? "border-grey-90 ring-1 ring-grey-90"
                        : "border-grey-20 hover:border-grey-30"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                        checked
                          ? "border-grey-90 bg-grey-90 text-white"
                          : "border-grey-30 bg-white text-transparent group-hover:border-grey-40"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="relative h-24 w-full overflow-hidden bg-grey-5">
                      {theme.preview ? (
                        <img
                          src={theme.preview}
                          alt={`${theme.name} preview`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <CubeSolid className="h-7 w-7 text-grey-40" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-grey-90">
                          {theme.name}
                        </div>
                        <div className="truncate text-xs text-grey-50">
                          {theme.id}
                        </div>
                      </div>
                      {isActive && <StatusBadge status="active" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {activeThemeDropped && (
            <div className="flex items-start gap-2 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
              The store&apos;s active theme is not in this selection. Saving will
              reset it to the first allowed theme.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                workingTenantId === modal?.tenant?.id ||
                selectedEntitlements.length === 0
              }
              className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              {workingTenantId === modal?.tenant?.id ? (
                <ArrowPath className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
