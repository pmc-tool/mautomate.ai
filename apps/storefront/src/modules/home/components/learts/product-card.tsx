import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import WishlistButton from "@modules/common/components/wishlist-button"

const PLACEHOLDER = "/learts/assets/images/product/s328/product-1.webp"

const LeartsProductCard = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const { cheapestPrice } = getProductPrice({ product })

  const images = product.images ?? []
  const mainImage = product.thumbnail || images[0]?.url || PLACEHOLDER
  const hoverImage = images[1]?.url || images[0]?.url || mainImage

  const onSale =
    cheapestPrice?.price_type === "sale" ||
    (!!cheapestPrice &&
      cheapestPrice.original_price !== cheapestPrice.calculated_price)

  const href = `/products/${product.handle}`

  return (
    <div className="col">
      <div className="product" data-el="card">
        <div className="product-thumb">
          {onSale && cheapestPrice?.percentage_diff ? (
            <span className="product-badges">
              <span className="onsale">-{cheapestPrice.percentage_diff}%</span>
            </span>
          ) : null}
          <LocalizedClientLink href={href} className="image">
            <img src={mainImage} alt={product.title} />
            <img className="image-hover" src={hoverImage} alt={product.title} />
          </LocalizedClientLink>
          <WishlistButton
            productId={product.id}
            className="add-to-wishlist hintT-left"
            data-hint="Add to wishlist"
          />
        </div>
        <div className="product-info">
          <h6 className="title">
            <LocalizedClientLink href={href}>
              {product.title}
            </LocalizedClientLink>
          </h6>
          <span className="price">
            {onSale && cheapestPrice ? (
              <>
                <span className="old">{cheapestPrice.original_price}</span>{" "}
                <span className="new">{cheapestPrice.calculated_price}</span>
              </>
            ) : (
              cheapestPrice?.calculated_price ?? ""
            )}
          </span>
          <div className="product-buttons">
            <LocalizedClientLink
              href={href}
              className="product-button hintT-top"
              data-hint="Quick View"
            >
              <i className="fas fa-search" />
            </LocalizedClientLink>
            <LocalizedClientLink
              href={href}
              className="product-button hintT-top"
              data-hint="Add to Cart"
            >
              <i className="fas fa-shopping-cart" />
            </LocalizedClientLink>
            <LocalizedClientLink
              href={href}
              className="product-button hintT-top"
              data-hint="Compare"
            >
              <i className="fas fa-random" />
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeartsProductCard
