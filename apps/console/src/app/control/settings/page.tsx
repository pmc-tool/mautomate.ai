"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowPath, CogSixTooth, ExclamationCircle } from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { getSettings, type PlatformSettings } from "@/lib/api/settings"
import { DataTable, type Column } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

type SettingsRow = {
  id: string
  label: string
  value: React.ReactNode
}

function booleanBadge(value: boolean, type: "enabled" | "set"): React.ReactNode {
  if (type === "enabled") {
    return <StatusBadge status={value ? "Enabled" : "Disabled"} />
  }
  return <StatusBadge status={value ? "Set" : "Not set"} />
}

function formatValue(
  key: keyof PlatformSettings,
  value: unknown
): React.ReactNode {
  if (typeof value === "boolean") {
    if (key === "encryption_key_set" || key === "webhook_master_set") {
      return booleanBadge(value, "set")
    }
    return booleanBadge(value, "enabled")
  }

  if (value === null || value === undefined) {
    return <span className="text-grey-40">—</span>
  }

  return String(value)
}

function rowsFromSettings(settings: PlatformSettings): SettingsRow[] {
  const entries: { key: keyof PlatformSettings; label: string }[] = [
    { key: "root_domain", label: "Root domain" },
    { key: "provisioner_mode", label: "Provisioner mode" },
    { key: "platform_enabled", label: "Platform enabled" },
    { key: "signup_open", label: "Signup open" },
    { key: "encryption_key_set", label: "Encryption key set" },
    { key: "webhook_master_set", label: "Webhook master set" },
    { key: "superadmins", label: "Superadmins count" },
    { key: "node_env", label: "Node env" },
    { key: "file_provider", label: "File provider" },
  ]

  return entries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    value: formatValue(entry.key, settings[entry.key]),
  }))
}

export default function SettingsPage() {
  const { token } = useControlAuth()

  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getSettings(token)
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(
    () => (settings ? rowsFromSettings(settings) : []),
    [settings]
  )

  const columns = useMemo<Column<SettingsRow>[]>(
    () => [
      {
        key: "label",
        header: "Setting",
        render: (row) => (
          <span className="font-medium text-grey-90">{row.label}</span>
        ),
      },
      {
        key: "value",
        header: "Value",
        render: (row) => <div className="text-grey-70">{row.value}</div>,
      },
    ],
    []
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
        title="Settings"
        description="Platform configuration and environment state."
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

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <div className="mb-4 flex items-center gap-2">
          <CogSixTooth className="h-5 w-5 text-grey-50" />
          <h2 className="text-lg font-semibold text-grey-90">
            Platform settings
          </h2>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={["label"]}
          isLoading={loading}
          emptyIcon={CogSixTooth}
          emptyTitle="No settings available"
          emptyDescription="Platform settings could not be loaded."
        />
      </div>
    </div>
  )
}
