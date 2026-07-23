"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { useWishlist } from "@lib/context/wishlist-context"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import BaseProductCard from "@modules/home/components/base/product-card"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

const EmptyState = () => (
  <div className="text-center" style={{ padding: "80px 0" }}>
    <i
      className="far fa-heart"
      style={{ fontSize: 48, color: "#ccc", marginBottom: 24, display: "block" }}
    />
    <h4 style={{ marginBottom: 24 }}>Your wishlist is empty</h4>
    <LocalizedClientLink href="/store" className="btn btn-dark btn-outline-hover-dark">
      Browse products
    </LocalizedClientLink>
  </div>
)

const LoadingSkeleton = () => (
  <div className="products row row-cols-xl-4 row-cols-lg-3 row-cols-md-3 row-cols-sm-2 row-cols-1">
    {Array.from({ length: 4 }).map((_, i) => (
      <div className="col" key={i}>
        <div
          style={{
            background: "#f3f3f3",
            borderRadius: 4,
            aspectRatio: "3 / 4",
            marginBottom: 40,
          }}
        />
      </div>
    ))}
  </div>
)

const WishlistTemplate = ({ regionId }: { regionId?: string }) => {
  const { ids, count } = useWishlist()
  const { countryCode } = useParams() as { countryCode: string }

  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetch the saved products whenever the saved ids change. Products removed
  // from the wishlist are also dropped client-side via the `ids` filter below,
  // so toggling a heart off removes the card without waiting for a refetch.
  useEffect(() => {
    if (!ids.length) {
      setProducts([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({
      limit: "100",
      country_code: countryCode,
      fields: "*variants.calculated_price,thumbnail,title,handle",
    })
    // region_id is the pricing context /store/products requires for
    // calculated_price; without it the request is rejected.
    if (regionId) {
      params.set("region_id", regionId)
    }
    ids.forEach((id) => params.append("id[]", id))

    fetch(`${BACKEND_URL}/store/products?${params.toString()}`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch wishlist products: ${res.status}`)
        }
        return res.json()
      })
      .then(({ products }: { products: HttpTypes.StoreProduct[] }) => {
        if (!cancelled) {
          setProducts(products ?? [])
          setError(false)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(","), countryCode, regionId])

  // Only show products that are still saved (instant removal on toggle-off).
  const visibleProducts = products.filter((p) => ids.includes(p.id))

  return (
    <div className="learts-theme section section-fluid section-padding bg-white">
      <div className="container">
        <div className="section-title text-center">
          <h2 className="title title-icon-both">Wishlist ({count})</h2>
        </div>
        {count === 0 ? (
          <EmptyState />
        ) : loading ? (
          <LoadingSkeleton />
        ) : error || !visibleProducts.length ? (
          <div className="text-center" style={{ padding: "80px 0" }}>
            <p style={{ marginBottom: 24 }}>
              We couldn&apos;t load your saved products right now.
            </p>
            <LocalizedClientLink
              href="/store"
              className="btn btn-dark btn-outline-hover-dark"
            >
              Browse products
            </LocalizedClientLink>
          </div>
        ) : (
          <div className="products row row-cols-xl-4 row-cols-lg-3 row-cols-md-3 row-cols-sm-2 row-cols-1">
            {visibleProducts.map((p) => (
              <BaseProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WishlistTemplate
