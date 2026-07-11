"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [active, setActive] = useState(0)

  if (!images?.length) {
    return null
  }

  const main = images[Math.min(active, images.length - 1)]

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
      {images.length > 1 && (
        <div
          className="learts-gallery-thumbs"
          style={{
            display: "flex",
            gap: 12,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          {images.map((image, index) => (
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
