"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import { persistWishlist, syncWishlist } from "@lib/data/wishlist"

const STORAGE_KEY = "ff_wishlist"

interface WishlistContext {
  ids: string[]
  count: number
  has: (id: string) => boolean
  toggle: (id: string) => void
}

const WishlistContext = createContext<WishlistContext | undefined>(undefined)

// Defensive localStorage read — the stored value is expected to be a JSON
// string[] but may be missing or corrupted.
const readLocalWishlist = (): string[] => {
  if (typeof window === "undefined") {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : []
  } catch {
    return []
  }
}

const writeLocalWishlist = (ids: string[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Ignore: storage may be unavailable (private mode, quota).
  }
}

export const WishlistProvider = ({
  children,
}: {
  children?: React.ReactNode
}) => {
  const [ids, setIds] = useState<string[]>([])

  // On mount: load the guest wishlist, then reconcile with the logged-in
  // customer's stored wishlist (union). Guests get `null` back and keep
  // relying on localStorage only.
  useEffect(() => {
    let cancelled = false

    const localIds = readLocalWishlist()
    setIds(localIds)

    syncWishlist(localIds)
      .then((merged) => {
        if (!cancelled && merged) {
          setIds(merged)
          writeLocalWishlist(merged)
        }
      })
      .catch(() => {
        // Ignore: localStorage state already applied.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]

      writeLocalWishlist(next)

      // Fire-and-forget server persistence (no-op for guests).
      void persistWishlist(next).catch(() => {})

      return next
    })
  }, [])

  const has = useCallback((id: string) => ids.includes(id), [ids])

  return (
    <WishlistContext.Provider
      value={{ ids, count: ids.length, has, toggle }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

// Inert fallback so consumers rendered outside the provider (e.g. the editor
// canvas rendering the header standalone) never throw.
const INERT_WISHLIST: WishlistContext = {
  ids: [],
  count: 0,
  has: () => false,
  toggle: () => {},
}

export const useWishlist = (): WishlistContext => {
  const context = useContext(WishlistContext)
  return context ?? INERT_WISHLIST
}
