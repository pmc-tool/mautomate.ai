"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowPath, ExclamationCircle, ShieldCheck, UsersSolid } from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import { listOperators } from "@/lib/api/operators"
import { DataTable, type Column } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

type OperatorRow = {
  id: string
  email: string
}

const searchKeys: (keyof OperatorRow)[] = ["email"]

export default function OperatorsPage() {
  const { token } = useControlAuth()

  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listOperators(token)
      setOperators(
        res.operators.map((email) => ({
          id: email,
          email,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operators")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo<Column<OperatorRow>[]>(
    () => [
      {
        key: "email",
        header: "Email address",
        render: (row) => (
          <span className="font-medium text-grey-90">{row.email}</span>
        ),
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
        title="Operators & Access"
        description="View the SuperAdmin email allowlist that controls access to this control panel."
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

      <div className="rounded-large border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <p>
            These email addresses are granted access to the SuperAdmin panel
            through the{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-blue-900">
              PLATFORM_SUPERADMIN_EMAILS
            </code>{" "}
            environment variable. To add or remove an operator, update that
            variable and redeploy the platform backend.
          </p>
        </div>
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <DataTable
          columns={columns}
          rows={operators}
          searchKeys={searchKeys}
          isLoading={loading}
          emptyIcon={UsersSolid}
          emptyTitle="No operators configured"
          emptyDescription="Add SuperAdmin emails to PLATFORM_SUPERADMIN_EMAILS to see them here."
        />
      </div>
    </div>
  )
}
