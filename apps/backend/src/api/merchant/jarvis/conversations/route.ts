import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { listConversations, createConversation } from "../_chat"

/** GET /merchant/jarvis/conversations — this store's chat history (newest first). */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const conversations = await listConversations(req, ctx.tenant.id)
  res.json({ conversations })
}

/** POST /merchant/jarvis/conversations { title? } — start a new chat. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const title = String((req.body as any)?.title ?? "New chat")
  const id = await createConversation(req, ctx.tenant.id, title)
  res.status(201).json({ id, title: title.slice(0, 80) })
}
