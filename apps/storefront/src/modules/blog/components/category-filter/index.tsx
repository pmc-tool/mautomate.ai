import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { BlogCategoryWithCount } from "@lib/data/blog"
import { clx } from "@modules/common/components/ui"

/**
 * Horizontal category filter for the blog listing. Server component.
 * Renders an "All" pill plus one pill per category (with its published
 * post count); the active category is highlighted. Selecting a category
 * resets pagination to page 1 by linking without a `page` param.
 */
export default function CategoryFilter({
  categories,
  activeCategory,
}: {
  categories: BlogCategoryWithCount[]
  activeCategory?: string
}) {
  if (!categories?.length) {
    return null
  }

  return (
    <div className="row">
      <div className="col-12">
        <ul
          className="blog-category-filter"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "center",
            listStyle: "none",
            padding: 0,
            margin: "0 0 40px",
          }}
        >
          <li>
            <LocalizedClientLink
              href="/blog"
              className={clx("btn btn-outline-dark btn-sm", {
                "btn-dark": !activeCategory,
              })}
            >
              All
            </LocalizedClientLink>
          </li>
          {categories.map((category) => {
            const isActive = activeCategory === category.slug
            return (
              <li key={category.id}>
                <LocalizedClientLink
                  href={`/blog?category=${category.slug}`}
                  className={clx("btn btn-outline-dark btn-sm", {
                    "btn-dark": isActive,
                  })}
                >
                  {category.name}
                  {typeof category.post_count === "number" && (
                    <span> ({category.post_count})</span>
                  )}
                </LocalizedClientLink>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
