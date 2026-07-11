import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"

/** GET /blog-posts — PUBLIC list of published posts for the marketing site. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const posts = await svc.listBlogPosts({ status: "published" }, { order: { published_at: "DESC" }, take: 100 })
  res.json({
    posts: (posts || []).map((p: any) => ({
      slug: p.slug, title: p.title, excerpt: p.excerpt, published_at: p.published_at,
    })),
  })
}
