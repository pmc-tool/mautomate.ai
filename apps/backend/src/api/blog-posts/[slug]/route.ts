import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../modules/platform"

/** GET /blog-posts/:slug — PUBLIC single published post. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const [post] = await svc.listBlogPosts({ slug: req.params.slug, status: "published" }, { take: 1 })
  if (!post) return res.status(404).json({ message: "post not found" })
  res.json({ post: { slug: post.slug, title: post.title, excerpt: post.excerpt, body: post.body, published_at: post.published_at } })
}
