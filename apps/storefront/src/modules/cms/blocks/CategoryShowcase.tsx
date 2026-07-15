import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listCategories } from "@lib/data/categories"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend category_showcase resolved     */
/* schema). Received as the spread prop bag from the storefront         */
/* SectionRenderer (`<CategoryShowcase {...block} />`), so it also       */
/* carries block_type / schema_version which we simply ignore.          */
/*                                                                      */
/* This is an ASYNC SERVER component: it fetches the live product        */
/* categories itself and resolves each tile's item count from the        */
/* category's `products.length`. A tile that references a category       */
/* (`category_id`) which no longer exists is SKIPPED (dangling-ref safe).*/
/* Tiles WITHOUT a `category_id` are static and always rendered.         */
/* All image fields hold fully-resolved media URLs.                      */
/* ------------------------------------------------------------------ */

export interface CategoryShowcaseItem {
  category_id?: string
  label: string
  image: string
  href: string
}

export interface CategoryShowcaseData {
  sub_title?: string
  title: string
  items?: CategoryShowcaseItem[]
  [key: string]: unknown
}

const FALLBACK_IMAGES = [
  "/learts/assets/images/banner/category/banner-s5-1.webp",
  "/learts/assets/images/banner/category/banner-s5-2.webp",
  "/learts/assets/images/banner/category/banner-s5-3.webp",
  "/learts/assets/images/banner/category/banner-s5-4.webp",
  "/learts/assets/images/banner/category/banner-s5-5.webp",
]

const CategoryShowcase = async (props: CategoryShowcaseData) => {
  const { sub_title, title } = props
  const items = Array.isArray(props.items) ? props.items : []

  // Resolve live categories once; index by id for O(1) lookup. Never throw —
  // a failed fetch degrades to "no live counts", static tiles still render.
  const categories = await listCategories().catch(
    () => [] as HttpTypes.StoreProductCategory[]
  )
  const byId = new Map<string, HttpTypes.StoreProductCategory>(
    categories.map((c) => [c.id, c])
  )

  // Build the renderable tiles, dropping dangling category references.
  const tiles = items
    .map((item, index) => {
      const cat = item.category_id ? byId.get(item.category_id) : undefined

      // Dangling ref: the tile points at a category that no longer exists.
      if (item.category_id && !cat) {
        return null
      }

      const count = cat?.products?.length
      const href =
        item.href ||
        (cat?.handle ? `/categories/${cat.handle}` : "/store")

      return {
        label: item.label || cat?.name || "",
        image: item.image,
        href,
        count,
        index,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)

  if (tiles.length === 0) {
    return null
  }

  return (
    <div className="section section-fluid section-padding bg-white learts-theme">
      <div className="container">
        <div className="section-title text-center">
          {sub_title ? <h3 className="sub-title">{sub_title}</h3> : null}
          {title ? (
            <h2 data-el="title" className="title title-icon-both">
              {title}
            </h2>
          ) : null}
        </div>

        <div className="row row-cols-xl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 learts-mb-n40">
          {tiles.map((tile, i) => (
            <div
              className="col learts-mb-40"
              key={i}
              data-el-item={`items:${tile.index}`}
            >
              <div className="category-banner5" data-el="tile">
                <LocalizedClientLink href={tile.href} className="inner">
                  <div className="image" data-el="image">
                    <img
                      src={tile.image || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                      alt={tile.label}
                    />
                  </div>
                  <div className="content">
                    <h3 className="title" data-el="label">{tile.label}</h3>
                    <span className="number">
                      {typeof tile.count === "number"
                        ? `${tile.count} Items`
                        : ""}
                    </span>
                  </div>
                </LocalizedClientLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CategoryShowcase
