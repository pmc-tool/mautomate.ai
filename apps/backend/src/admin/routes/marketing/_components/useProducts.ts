/**
 * Marketing — product search hook for the attach-product picker.
 *
 * Debounced search over the Medusa admin /admin/products endpoint. Returns the
 * current result set plus loading/error state; callers drive it with `setQuery`.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { searchProducts, type PickerProduct } from "./lib"

export function useProducts(initialQuery = "", limit = 20) {
  const [query, setQuery] = useState(initialQuery)
  const [products, setProducts] = useState<PickerProduct[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const run = useCallback(
    async (q: string) => {
      const mine = ++seq.current
      setLoading(true)
      setError(null)
      try {
        const res = await searchProducts({ q: q.trim() || undefined, limit })
        // Ignore stale responses if a newer query already fired.
        if (mine !== seq.current) return
        setProducts(res.products)
        setCount(res.count)
      } catch (e: any) {
        if (mine !== seq.current) return
        setError(e?.message ?? "Could not load products.")
        setProducts([])
        setCount(0)
      } finally {
        if (mine === seq.current) setLoading(false)
      }
    },
    [limit]
  )

  useEffect(() => {
    const t = setTimeout(() => run(query), 250)
    return () => clearTimeout(t)
  }, [query, run])

  return {
    query,
    setQuery,
    products,
    count,
    loading,
    error,
    reload: () => run(query),
  }
}

export default useProducts
