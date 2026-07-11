/**
 * usePolling — run an async fetcher immediately and then on a fixed interval,
 * exposing { data, error, loading, refreshing, refetch }.
 *
 * Used by the Live Queue (and available to sibling subpages) to keep tables in
 * near-real-time sync. The interval is cleared on unmount. Overlapping runs are
 * guarded so a slow request cannot stack. Polling pauses while the browser tab
 * is hidden and resumes (with an immediate refresh) when it becomes visible, to
 * avoid hammering the API in a background tab.
 *
 * NOTE: this is short-interval polling, not a live stream. For token-by-token
 * transcripts subscribe to the SSE channel at /admin/call-center/stream (owned
 * by another agent) instead of shortening the poll interval here.
 */
import { useCallback, useEffect, useRef, useState } from "react"

type Options = {
  /** Poll interval in ms. Default 5000. */
  intervalMs?: number
  /** When false, polling is disabled entirely. Default true. */
  enabled?: boolean
}

export type PollingResult<T> = {
  data: T | null
  error: Error | null
  loading: boolean
  refreshing: boolean
  refetch: () => Promise<void>
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: Options = {}
): PollingResult<T> {
  const { intervalMs = 5000, enabled = true } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Keep the latest fetcher in a ref so the polling effect does not resubscribe
  // on every render when callers pass an inline function.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const inFlight = useRef(false)
  const mounted = useRef(true)
  const hasData = useRef(false)

  const run = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    if (hasData.current) setRefreshing(true)
    try {
      const result = await fetcherRef.current()
      if (!mounted.current) return
      setData(result)
      setError(null)
      hasData.current = true
    } catch (e: any) {
      if (!mounted.current) return
      setError(e instanceof Error ? e : new Error(String(e?.message ?? e)))
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!enabled) {
      setLoading(false)
      return () => {
        mounted.current = false
      }
    }

    // Immediate first load, then interval.
    run()
    let timer = window.setInterval(() => {
      if (document.visibilityState === "visible") run()
    }, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === "visible") run()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      mounted.current = false
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [run, intervalMs, enabled])

  return { data, error, loading, refreshing, refetch: run }
}

export default usePolling
