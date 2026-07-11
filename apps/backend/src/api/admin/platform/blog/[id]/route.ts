import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../modules/platform"

/** PUT /admin/platform/blog/:id — edit / publish / unpublish. */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const post = await svc.retrieveBlogPost(req.params.id).catch(() => null)
  if (!post) return res.status(404).json({ message: "post not found" })
  const b = (req.body ?? {}) as any
  const patch: any = { id: req.params.id }
  if (typeof b.title === "string") patch.title = b.title
  if (typeof b.excerpt === "string") patch.excerpt = b.excerpt
  if (typeof b.content === "string") patch.body = b.content
  if (typeof b.body === "string") patch.body = b.body
  if (b.status && ["draft", "published"].includes(b.status)) {
    patch.status = b.status
    patch.published_at = b.status === "published" ? (post.published_at || new Date()) : null
  }
  await svc.updateBlogPosts(patch)
  const updated = await svc.retrieveBlogPost(req.params.id).catch(() => null)
  res.json({ id: req.params.id, ...patch, content: updated?.body ?? patch.body ?? "" })
}

/** DELETE /admin/platform/blog/:id */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  await svc.deleteBlogPosts(req.params.id)
  res.json({ id: req.params.id, deleted: true })
}
