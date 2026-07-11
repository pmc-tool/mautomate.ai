const excludedPaths = ["/checkout", "/account/*"]

// Region prefix used for blog URLs in the sitemap (storefront routes are
// nested under /[countryCode]). Defaults to the storefront's default region.
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "bd"

/**
 * Fetch published blog slugs from the Medusa store API so each post gets its
 * own sitemap entry. Build-time only (next-sitemap postbuild); never throws —
 * if the backend is unreachable the sitemap is simply generated without blog
 * post URLs.
 */
async function getBlogPaths() {
  const backendUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    const res = await fetch(
      `${backendUrl}/store/cms/blog/posts?limit=100&offset=0`,
      {
        headers: publishableKey
          ? { "x-publishable-api-key": publishableKey }
          : {},
      }
    )
    if (!res.ok) {
      return []
    }
    const data = await res.json()
    const posts = Array.isArray(data?.posts) ? data.posts : []
    return posts
      .filter((p) => p && p.slug)
      .map((p) => ({ slug: p.slug, published_at: p.published_at }))
  } catch (e) {
    return []
  }
}

module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_VERCEL_URL,
  generateRobotsTxt: true,
  exclude: excludedPaths + ["/[sitemap]"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: "*",
        disallow: excludedPaths,
      },
    ],
  },
  additionalPaths: async (config) => {
    const paths = []

    // Blog listing index.
    paths.push(
      await config.transform(config, `/${DEFAULT_REGION}/blog`, {
        changefreq: "daily",
        priority: 0.7,
      })
    )

    // Individual published posts.
    const posts = await getBlogPaths()
    for (const post of posts) {
      paths.push(
        await config.transform(config, `/${DEFAULT_REGION}/blog/${post.slug}`, {
          changefreq: "weekly",
          priority: 0.6,
          lastmod: post.published_at || new Date().toISOString(),
        })
      )
    }

    return paths
  },
}
