import { Metadata } from "next"

import {
  getBlogPosts,
  getBlogCategories,
  BLOG_PAGE_SIZE,
} from "@lib/data/blog"
import PageBanner from "@modules/blog/components/page-banner"
import PostCard from "@modules/blog/components/post-card"
import CategoryFilter from "@modules/blog/components/category-filter"
import BlogPagination from "@modules/blog/components/pagination"

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Handmade stories, gift guides and inspiration from the Forever Finds team.",
}

type BlogPageSearchParams = {
  page?: string
  category?: string
}

type Params = {
  searchParams: Promise<BlogPageSearchParams>
  params: Promise<{ countryCode: string }>
}

export default async function BlogPage(props: Params) {
  const searchParams = await props.searchParams

  const category =
    typeof searchParams.category === "string" && searchParams.category
      ? searchParams.category
      : undefined

  const pageParam = Number.parseInt(searchParams.page ?? "1", 10)
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
  const offset = (page - 1) * BLOG_PAGE_SIZE

  const [{ posts, count }, { categories }] = await Promise.all([
    getBlogPosts({ category, limit: BLOG_PAGE_SIZE, offset }),
    getBlogCategories(),
  ])

  const totalPages = Math.max(1, Math.ceil(count / BLOG_PAGE_SIZE))

  const activeCategory = category
    ? categories.find((c) => c.slug === category)
    : undefined

  const crumbs = activeCategory
    ? [{ label: "Blog", href: "/blog" }, { label: activeCategory.name }]
    : [{ label: "Blog" }]

  return (
    <div className="learts-theme">
      <PageBanner
        title={activeCategory ? activeCategory.name : "Blog"}
        crumbs={crumbs}
      />

      <div className="section section-padding">
        <div className="container">
          <CategoryFilter
            categories={categories}
            activeCategory={category}
          />

          {posts.length === 0 ? (
            <div className="row">
              <div className="col text-center">
                <p>
                  No posts found
                  {activeCategory ? ` in ${activeCategory.name}` : ""}. Check
                  back soon for fresh stories.
                </p>
              </div>
            </div>
          ) : (
            <div className="row learts-mb-n40">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="col-lg-4 col-md-6 col-12 learts-mb-40"
                >
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          )}

          <BlogPagination
            page={page}
            totalPages={totalPages}
            category={category}
          />
        </div>
      </div>
    </div>
  )
}
