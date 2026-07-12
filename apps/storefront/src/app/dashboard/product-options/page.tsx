"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Swatch,
  ChevronDownMini,
  ChevronRightMini,
  MagnifyingGlass,
  ExclamationCircle,
  ArrowUpRightMini,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listProductOptionRegistry,
  ProductOptionRegistryEntry,
  ApiError,
} from "@lib/merchant-admin/api"

const MAX_VALUE_CHIPS = 8

function ValueChips({ values }: { values: string[] }) {
  if (!values || values.length === 0) {
    return <span className="text-grey-40">—</span>
  }

  const shown = values.slice(0, MAX_VALUE_CHIPS)
  const remaining = values.length - shown.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((value, idx) => (
        <span
          key={`${value}-${idx}`}
          className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70"
        >
          {value}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-grey-50">+{remaining} more</span>
      )}
    </div>
  )
}

function OptionRow({ entry }: { entry: ProductOptionRegistryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const productCount = entry.product_count ?? entry.products?.length ?? 0
  const hiddenProducts = productCount - (entry.products?.length ?? 0)

  return (
    <>
      <tr
        onClick={() => setExpanded((s) => !s)}
        className="cursor-pointer border-b border-grey-10 transition-colors hover:bg-grey-5"
      >
        <td className="w-10 px-4 py-3 align-top">
          <span className="text-grey-50">
            {expanded ? (
              <ChevronDownMini className="h-4 w-4" />
            ) : (
              <ChevronRightMini className="h-4 w-4" />
            )}
          </span>
        </td>
        <td className="px-4 py-3 align-top">
          <span className="font-medium text-grey-90">{entry.title}</span>
        </td>
        <td className="px-4 py-3 align-top">
          <ValueChips values={entry.values} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 align-top text-grey-70">
          {productCount} {productCount === 1 ? "product" : "products"}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-grey-10 bg-grey-5">
          <td />
          <td colSpan={3} className="px-4 pb-4 pt-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-grey-50">
              Products using this option
            </p>
            {entry.products && entry.products.length > 0 ? (
              <ul className="space-y-1">
                {entry.products.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="group inline-flex items-center gap-1.5 text-sm text-grey-90 hover:underline"
                    >
                      {product.title}
                      <ArrowUpRightMini className="h-3.5 w-3.5 text-grey-40 group-hover:text-grey-70" />
                    </Link>
                  </li>
                ))}
                {hiddenProducts > 0 && (
                  <li className="pt-1 text-xs text-grey-50">
                    +{hiddenProducts} more{" "}
                    {hiddenProducts === 1 ? "product" : "products"} using this
                    option
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-grey-50">
                No products are using this option.
              </p>
            )}
            <p className="mt-3 text-xs text-grey-50">
              Edit this option's title or values from a product's detail page.
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

function RegistrySkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-grey-10 last:border-0">
          <td className="px-4 py-3">
            <div className="h-4 w-4 animate-pulse rounded-base bg-grey-10" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-32 animate-pulse rounded-base bg-grey-10" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-48 animate-pulse rounded-base bg-grey-10" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 animate-pulse rounded-base bg-grey-10" />
          </td>
        </tr>
      ))}
    </>
  )
}

export default function ProductOptionsPage() {
  const { token, logout } = useMerchantAuth()
  const [options, setOptions] = useState<ProductOptionRegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const load = async () => {
      if (!token) return
      setLoading(true)
      setError(null)
      try {
        const res = await listProductOptionRegistry(token)
        setOptions(res.options || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        setError(
          err instanceof Error ? err.message : "Failed to load product options"
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, logout])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((entry) => {
      if (entry.title.toLowerCase().includes(q)) return true
      return entry.values.some((value) => value.toLowerCase().includes(q))
    })
  }, [options, query])

  const isFiltering = query.trim().length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product options"
        description="A registry of every option title used across your products, with the values and the products that use them."
      />

      <div className="flex items-start gap-3 rounded-large border border-grey-20 bg-grey-5 px-4 py-3 text-sm text-grey-70">
        <Swatch className="mt-0.5 h-5 w-5 shrink-0 text-grey-50" />
        <p>
          Product options are managed per product. To add, rename, or change an
          option's values, open the owning product and edit its options there.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ExclamationCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative sm:max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search options..."
            className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-grey-10 text-grey-70">
                <tr>
                  <th className="w-10 px-4 py-3 font-medium" />
                  <th className="px-4 py-3 font-medium">Option</th>
                  <th className="px-4 py-3 font-medium">Values</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">
                    Used by
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <RegistrySkeleton />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10">
                      <EmptyState
                        icon={Swatch}
                        title={
                          isFiltering
                            ? "No matching options"
                            : "No product options yet"
                        }
                        description={
                          isFiltering
                            ? "There are no options matching your search."
                            : "Options appear here once you add them to a product from the product detail page."
                        }
                        className="border-0 bg-transparent shadow-none"
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry) => (
                    <OptionRow key={entry.title} entry={entry} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="border-t border-grey-10 px-4 py-3">
              <p className="text-xs text-grey-50">
                {filtered.length}{" "}
                {filtered.length === 1 ? "option" : "options"}
                {isFiltering && options.length !== filtered.length
                  ? ` of ${options.length}`
                  : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
