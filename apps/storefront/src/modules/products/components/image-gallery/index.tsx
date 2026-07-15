"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { HttpTypes } from "@medusajs/types"

import {
  getServerVariantSelection,
  getVariantSelection,
  imagesForVariant,
  subscribeVariantSelection,
} from "@modules/products/variant-gallery"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  /** Enables per-variant filtering. Without it the gallery behaves as before. */
  productId?: string
}

const ImageGallery = ({ images, productId }: ImageGalleryProps) => {
  const [active, setActive] = useState(0)

  // The variant the shopper has picked (published by ProductActions). On the
  // server this is always null, so the first paint shows the full gallery and
  // hydration is stable.
  const selection = useSyncExternalStore(
    subscribeVariantSelection,
    getVariantSelection,
    getServerVariantSelection
  )
  const selectedVariantId =
    productId && selection?.productId === productId ? selection.variantId : null

  const shown = useMemo(
    () => imagesForVariant(images as any, selectedVariantId) as typeof images,
    [images, selectedVariantId]
  )

  // Picking a different variant re-frames the gallery — start at its first
  // photo instead of holding an index that now points at someone else's image.
  useEffect(() => {
    setActive(0)
  }, [selectedVariantId])

  if (!shown?.length) {
    return null
  }

  const main = shown[Math.min(active, shown.length - 1)]

  return (
    <div className="learts-product-gallery">
      {/* Main image */}
      <div
        className="learts-gallery-main bg-ui-bg-subtle"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          overflow: "hidden",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
        }}
      >
        {!!main?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.url}
            alt="Product image"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        )}
      </div>

      {/* Thumbnails */}
      {shown.length > 1 && (
        <div
          className="learts-gallery-thumbs"
          style={{
            display: "flex",
            gap: 12,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          {shown.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`View image ${index + 1}`}
              style={{
                width: 84,
                height: 84,
                padding: 6,
                border:
                  index === active
                    ? "2px solid #72a499"
                    : "1px solid #e5e5e5",
                borderRadius: 6,
                overflow: "hidden",
                cursor: "pointer",
                background: "#f7f7f7",
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!!image.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt={`Thumbnail ${index + 1}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
