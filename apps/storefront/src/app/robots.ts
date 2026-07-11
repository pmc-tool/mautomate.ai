import type { MetadataRoute } from "next"

const BASE = process.env.STOREFRONT_URL || "http://localhost:8000"

/**
 * robots.txt (Next metadata route). Allows crawling of the storefront while
 * keeping the editor, API bridges and private/session pages out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/editor",
          "/editor-canvas",
          "/api/",
          "/*/account",
          "/*/cart",
          "/*/checkout",
          "/*/order",
          "/*/wishlist",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
