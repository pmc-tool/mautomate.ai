import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../../_helpers"
import {
  getConversation,
  getMessages,
  renameConversation,
  deleteConversation,
} from "../../_chat"

/** GET /merchant/jarvis/conversations/:id — the messages in one chat. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params
  const conv = await getConversation(req, ctx.tenant.id, id)
  if (!conv) return res.status(404).json({ message: "chat not found" })
  const messages = await getMessages(req, ctx.tenant.id, id)
  res.json({ id: conv.id, title: conv.title, messages })
}

/** PATCH /merchant/jarvis/conversations/:id { title } — rename a chat. */
export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params
  const conv = await getConversation(req, ctx.tenant.id, id)
  if (!conv) return res.status(404).json({ message: "chat not found" })
  const title = String((req.body as any)?.title ?? "").trim()
  if (!title) return res.status(400).json({ message: "title required" })
  await renameConversation(req, ctx.tenant.id, id, title)
  res.json({ id, title: title.slice(0, 80) })
}

/** DELETE /merchant/jarvis/conversations/:id — remove a chat and its messages. */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { id } = req.params
  const conv = await getConversation(req, ctx.tenant.id, id)
  if (!conv) return res.status(404).json({ message: "chat not found" })
  await deleteConversation(req, ctx.tenant.id, id)
  res.json({ id, deleted: true })
}
