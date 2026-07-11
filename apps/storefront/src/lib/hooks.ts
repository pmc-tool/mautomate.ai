"use client"

import { useEffect, useState } from "react"
import {
  fetchOverview,
  getRecentOrders,
  OverviewStats,
  Order,
  ApiError,
} from "./api"

export type OverviewData = {
  stats: OverviewStats
  recentOrders: Order[]
  loading: boolean
  error: string | null
}

export function useOverview(token: string | null): OverviewData {
  const [data, setData] = useState<{
    stats: OverviewStats
    recentOrders: Order[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchOverview(token)
      .then((result) => {
        setData({ stats: result.stats, recentOrders: result.recentOrders })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load overview")
      })
      .finally(() => setLoading(false))
  }, [token])

  return {
    stats: data?.stats ?? {
      totalSales: 0,
      ordersThisMonth: 0,
      productsLive: 0,
      customers: 0,
      creditBalance: 0,
      currencyCode: "USD",
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
