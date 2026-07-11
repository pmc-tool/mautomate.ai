/**
 * Marketing — lightweight polling hook.
 *
 * Invokes `fn` on an interval while `enabled` is true. Used by the post detail
 * screen to refresh publishing status without a manual reload. Cleans up on
 * unmount and skips overlapping runs.
 */
import { useEffect, useRef } from "react"

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs = 5000,
  enabled = true
) {
  const saved = useRef(fn)
  saved.current = fn

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let running = false

    const tick = async () => {
      if (running || cancelled) return
      running = true
      try {
        await saved.current()
      } finally {
        running = false
      }
    }

    const handle = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(handle)
    }
  }, [intervalMs, enabled])
}

export default usePolling
