"use client"

import React from "react"

import { useWishlist } from "@lib/context/wishlist-context"

type WishlistButtonProps = {
  productId: string
  className?: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className">

/**
 * Heart toggle for saving a product to the wishlist. Rendered as an anchor
 * because the Learts theme styles card hearts as `<a class="add-to-wishlist">`.
 * Safe anywhere: useWishlist falls back to an inert no-op without a provider.
 */
const WishlistButton = ({
  productId,
  className,
  ...rest
}: WishlistButtonProps) => {
  const { has, toggle } = useWishlist()
  const saved = has(productId)

  return (
    <a
      href="#"
      role="button"
      className={className}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(productId)
      }}
      {...rest}
    >
      <i
        className={saved ? "fas fa-heart" : "far fa-heart"}
        style={saved ? { color: "#e11d48" } : undefined}
      />
    </a>
  )
}

export default WishlistButton
