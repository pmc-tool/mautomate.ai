import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { withTenant } from "../../../lib/tenant-context"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { applyCors, OPTIONS } from "../_cors"
import { verifyIdentity } from "../_identity"
import { bindConversationToCustomer } from "../_bind-customer"

export { OPTIONS }

type Body = { conversation_token?: string; identity?: string }

/**
 * POST /marketing-chat/identify
 *
 * Attach a signed-in shopper to a chat thread that already exists.
 *
 * The widget keeps its conversation token in localStorage, so a thread very often
 * outlives the moment of signing in: the visitor chats anonymously, logs in, and
 * comes back. Without this, that thread would stay anonymous forever and keep
 * asking them to prove who they are — which is precisely the hassle we are
 * removing. The widget calls this whenever it holds both a session and a signed
 * identity.
 *
 * The identity is a token minted by the STOREFRONT SERVER, which has already
 * authenticated the shopper. A `customer_id` sent straight from the browser is
 * never trusted (see `_identity.ts`).
 *
 * Always 200 for a well-formed call: `{ identified: boolean }`. Failing to bind
 * is not an error the shopper should see — the bot simply carries on anonymously.
 */
export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  applyCors(req, res)

  const token = req.body?.conversation_token
  const identity = verifyIdentity(req.body?.identity)

  if (typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "conversation_token_required" })
    return
  }
  if (!identity) {
    res.status(200).json({ identified: false })
    return
  }

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const rows = await mk.listMarketingConversations({
      external_thread_id: token,
      channel: "web_widget",
    })
    const conversation = Array.isArray(rows) ? rows[0] : rows
    if (!conversation) {
      res.status(404).json({ error: "conversation_not_found" })
      return
    }

    const tenantId: string = conversation.tenant_id
    const identified = await withTenant(tenantId, () =>
      bindConversationToCustomer(req.scope, {
        tenantId,
        conversation,
        customerId: identity.customerId,
      })
    )

    res.status(200).json({ identified })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] identify failed:", e?.message ?? e)
    res.status(200).json({ identified: false })
  }
}
