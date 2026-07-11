import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const FALLBACK_IMAGES = [
  "/learts/assets/images/banner/category/banner-s5-1.webp",
  "/learts/assets/images/banner/category/banner-s5-2.webp",
  "/learts/assets/images/banner/category/banner-s5-3.webp",
  "/learts/assets/images/banner/category/banner-s5-4.webp",
  "/learts/assets/images/banner/category/banner-s5-5.webp",
]

const ShopCategories = ({
  categories,
}: {
  categories: HttpTypes.StoreProductCategory[]
}) => {
  const items = (categories.length
    ? categories
    : FALLBACK_IMAGES.map((_, i) => ({
        id: `placeholder-${i}`,
        name: ["Gift ideas", "Home Decor", "Toys", "Pots", "Kniting & Sewing"][
          i
        ],
        handle: "",
        products: [],
      }))
  ).slice(0, 5)

  return (
    <div className="section section-fluid section-padding bg-white learts-theme">
      <div className="container">
        <div className="section-title text-center">
          <h3 className="sub-title">Shop by categories</h3>
          <h2 className="title title-icon-both">Making &amp; crafting</h2>
        </div>

        <div className="row row-cols-xl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 learts-mb-n40">
          {items.map((c: any, i: number) => {
            const count = c.products?.length
            return (
              <div className="col learts-mb-40" key={c.id}>
                <div className="category-banner5">
                  <LocalizedClientLink
                    href={c.handle ? `/categories/${c.handle}` : "/store"}
                    className="inner"
                  >
                    <div className="image">
                      <img
                        src={FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                        alt={c.name}
                      />
                    </div>
                    <div className="content">
                      <h3 className="title">{c.name}</h3>
                      <span className="number">
                        {typeof count === "number" ? `${count} Items` : ""}
                      </span>
                    </div>
                  </LocalizedClientLink>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ShopCategories
