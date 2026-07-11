"use client"

import React, { useMemo, useState, useEffect } from "react"
import {
  MagnifyingGlass,
  Funnel,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import { EmptyState } from "./empty-state"

export type Column<T> = {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

export type DataTableProps<T extends Record<string, any>> = {
  columns: Column<T>[]
  rows: T[]
  searchKeys?: (keyof T)[]
  filterKey?: keyof T
  filterOptions?: { value: string; label: string }[]
  sortKeys?: { key: keyof T; label: string }[]
  rowActions?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  emptyIcon?: React.ComponentType<{ className?: string }>
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  pageSize?: number
  isLoading?: boolean
}

function TableSkeleton({ columns, rowActions }: { columns: Column<any>[]; rowActions?: boolean }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-grey-10 last:border-0">
          {columns.map((col) => (
            <td key={col.key} className={cn("px-4 py-3", col.className)}>
              <div className="h-4 animate-pulse rounded-base bg-grey-10" />
            </td>
          ))}
          {rowActions && (
            <td className="px-4 py-3 text-right">
              <div className="ml-auto h-4 w-16 animate-pulse rounded-base bg-grey-10" />
            </td>
          )}
        </tr>
      ))}
    </>
  )
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  searchKeys = [],
  filterKey,
  filterOptions,
  sortKeys,
  rowActions,
  onRowClick,
  emptyIcon,
  emptyTitle = "No results",
  emptyDescription = "There are no items to display.",
  emptyAction,
  pageSize = 10,
  isLoading,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("")
  const [filterValue, setFilterValue] = useState<string>("")
  const [sortKey, setSortKey] = useState<string>("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, filterValue, sortKey, sortDir])

  const filtered = useMemo(() => {
    let data = [...rows]

    if (query && searchKeys.length) {
      const q = query.toLowerCase()
      data = data.filter((row) =>
        searchKeys.some((key) => {
          const value = row[key]
          if (value == null) return false
          return String(value).toLowerCase().includes(q)
        })
      )
    }

    if (filterKey && filterValue) {
      data = data.filter((row) => String(row[filterKey]) === filterValue)
    }

    if (sortKey) {
      data.sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if (av < bv) return sortDir === "asc" ? -1 : 1
        if (av > bv) return sortDir === "asc" ? 1 : -1
        return 0
      })
    }

    return data
  }, [rows, query, filterValue, sortKey, sortDir, searchKeys, filterKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toggleSortDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"))

  const hasToolbar =
    searchKeys.length || (filterKey && filterOptions?.length) || (sortKeys && sortKeys.length)

  return (
    <div className="space-y-4">
      {hasToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            {searchKeys.length > 0 && (
              <div className="relative flex-1 sm:max-w-xs">
                <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
                />
              </div>
            )}
            {filterKey && filterOptions && filterOptions.length > 0 && (
              <div className="relative sm:w-48">
                <Funnel className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full appearance-none rounded-base border border-grey-20 bg-white py-2 pl-9 pr-8 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                >
                  <option value="">All statuses</option>
                  {filterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {sortKeys && sortKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="appearance-none rounded-base border border-grey-20 bg-white py-2 pl-9 pr-8 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
                >
                  <option value="">Sort by</option>
                  {sortKeys.map((opt) => (
                    <option key={String(opt.key)} value={String(opt.key)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={toggleSortDir}
                disabled={!sortKey}
                className="rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-grey-10 text-grey-70">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 font-medium",
                      col.sortable && "cursor-pointer select-none",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                {rowActions && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-10">
              {isLoading ? (
                <TableSkeleton columns={columns} rowActions={!!rowActions} />
              ) : pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowActions ? 1 : 0)}
                    className="px-4 py-10"
                  >
                    <EmptyState
                      icon={emptyIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                      className="border-0 bg-transparent shadow-none"
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "transition-colors hover:bg-grey-5",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > pageSize && (
          <div className="flex items-center justify-between border-t border-grey-10 px-4 py-3">
            <p className="text-xs text-grey-50">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-grey-60">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
