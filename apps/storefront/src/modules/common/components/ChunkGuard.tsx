"use client"

import { useEffect } from "react"

/**
 * Auto-recover from stale-deploy chunk errors. When a deploy replaces the
 * build, tabs opened before it hold HTML that references chunk files which no
 * longer exist; the next client-side navigation throws ChunkLoadError. One
 * silent reload picks up the new build. A sessionStorage flag (cleared 15s
 * after a successful load) prevents reload loops if something is truly broken.
 */
const FLAG = "ff-chunk-reloaded"

export default function ChunkGuard() {
  useEffect(() => {
    const timer = setTimeout(() => sessionStorage.removeItem(FLAG), 15000)

    const isChunkError = (v: unknown) =>
      /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        String((v as any)?.message ?? v ?? "")
      )

    const recover = () => {
      if (sessionStorage.getItem(FLAG)) return
      sessionStorage.setItem(FLAG, "1")
      window.location.reload()
    }

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error) || isChunkError(e.message)) recover()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) recover()
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
