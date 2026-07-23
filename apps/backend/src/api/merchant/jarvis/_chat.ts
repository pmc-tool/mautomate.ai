import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaRequest } from "@medusajs/framework/http"
import crypto from "crypto"

/**
 * Pixi chat persistence — conversations + messages for the full-page dashboard
 * assistant. Strictly tenant-scoped: every read/write filters by tenant_id (the
 * caller passes the tenant resolved from the session, never a model/body value),
 * so one store's chat history can never surface for another.
 *
 * The floating panel stays ephemeral (no conversation_id); only the full-page
 * assistant passes a conversation_id and gets durable history.
 */

const pg = (req: MedusaRequest) =>
  req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

export function newConversationId(): string {
  return "jconv_" + crypto.randomBytes(12).toString("hex")
}

export async function listConversations(req: MedusaRequest, tenantId: string) {
  try {
    return await pg(req)("jarvis_conversation")
      .select("id", "title", "updated_at")
      .where({ tenant_id: tenantId })
      .orderBy("updated_at", "desc")
      .limit(100)
  } catch {
    return []
  }
}

export async function createConversation(
  req: MedusaRequest,
  tenantId: string,
  title = "New chat"
): Promise<string> {
  const id = newConversationId()
  await pg(req)("jarvis_conversation").insert({
    id,
    tenant_id: tenantId,
    title: (title || "New chat").slice(0, 80),
  })
  return id
}

export async function getConversation(
  req: MedusaRequest,
  tenantId: string,
  id: string
): Promise<any | null> {
  const rows = await pg(req)("jarvis_conversation")
    .where({ id, tenant_id: tenantId })
    .limit(1)
  return rows?.[0] || null
}

export async function getMessages(
  req: MedusaRequest,
  tenantId: string,
  conversationId: string
) {
  const rows = await pg(req)("jarvis_message")
    .select("role", "content", "meta", "created_at")
    .where({ conversation_id: conversationId, tenant_id: tenantId })
    .orderBy("created_at", "asc")
    .limit(300)
  return (rows || []).map((r: any) => ({
    role: r.role,
    content: r.content,
    meta: typeof r.meta === "string" ? safeJson(r.meta) : r.meta ?? null,
    created_at: r.created_at,
  }))
}

export async function saveMessage(
  req: MedusaRequest,
  tenantId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  meta?: any
): Promise<void> {
  try {
    await pg(req)("jarvis_message").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      role,
      content: content || "",
      meta: meta ? JSON.stringify(meta) : null,
    })
    await pg(req)("jarvis_conversation")
      .where({ id: conversationId, tenant_id: tenantId })
      .update({ updated_at: new Date() })
  } catch {
    // history is best-effort; never break the live run over a save failure
  }
}

export async function maybeTitle(
  req: MedusaRequest,
  tenantId: string,
  conversationId: string,
  firstUserMessage: string
): Promise<void> {
  try {
    const conv = await getConversation(req, tenantId, conversationId)
    if (conv && (!conv.title || conv.title === "New chat")) {
      const t = firstUserMessage.trim().replace(/\s+/g, " ").slice(0, 60)
      if (t) {
        await pg(req)("jarvis_conversation")
          .where({ id: conversationId, tenant_id: tenantId })
          .update({ title: t })
      }
    }
  } catch {
    // non-fatal
  }
}

export async function renameConversation(
  req: MedusaRequest,
  tenantId: string,
  id: string,
  title: string
): Promise<void> {
  await pg(req)("jarvis_conversation")
    .where({ id, tenant_id: tenantId })
    .update({ title: String(title || "").slice(0, 80), updated_at: new Date() })
}

export async function deleteConversation(
  req: MedusaRequest,
  tenantId: string,
  id: string
): Promise<void> {
  await pg(req)("jarvis_message")
    .where({ conversation_id: id, tenant_id: tenantId })
    .del()
  await pg(req)("jarvis_conversation").where({ id, tenant_id: tenantId }).del()
}

/** Recent turns (oldest→newest) for the model prompt, from the DB not the client. */
export async function historyForPrompt(
  req: MedusaRequest,
  tenantId: string,
  conversationId: string,
  take = 8
): Promise<Array<{ role: string; content: string }>> {
  try {
    const rows = await pg(req)("jarvis_message")
      .select("role", "content")
      .where({ conversation_id: conversationId, tenant_id: tenantId })
      .whereIn("role", ["user", "assistant"])
      .orderBy("created_at", "desc")
      .limit(take)
    return (rows || [])
      .reverse()
      .map((r: any) => ({ role: r.role, content: r.content }))
  } catch {
    return []
  }
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
