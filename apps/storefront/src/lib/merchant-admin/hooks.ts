"use client"

import { useEffect, useState } from "react"
import {
  fetchOverview,
  getRecentOrders,
  OverviewStats,
  OverviewRange,
  Order,
  ApiError,
} from "./api"

export type OverviewData = {
  stats: OverviewStats
  recentOrders: Order[]
  loading: boolean
  error: string | null
}

export function useOverview(token: string | null, range?: OverviewRange): OverviewData {
  const [data, setData] = useState<{
    stats: OverviewStats
    recentOrders: Order[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Depend on the primitive range fields so a fresh range object each render
  // does not trigger an infinite refetch loop.
  const from = range?.from
  const to = range?.to
  const label = range?.label

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    fetchOverview(token, { from, to, label })
      .then((result) => {
        if (!active) return
        setData({ stats: result.stats, recentOrders: result.recentOrders })
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load overview")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token, from, to, label])

  return {
    stats: data?.stats ?? {
      totalSales: 0,
      ordersThisMonth: 0,
      productsLive: 0,
      customers: 0,
      creditBalance: 0,
      currencyCode: "USD",
      series: [],
    },
    recentOrders: data?.recentOrders ?? [],
    loading,
    error,
  }
}

export function useRecentOrders(token: string | null, limit = 5) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    getRecentOrders(token, limit)
      .then(setOrders)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load orders")
      })
      .finally(() => setLoading(false))
  }, [token, limit])

  return { orders, loading, error }
}

export { ApiError }
