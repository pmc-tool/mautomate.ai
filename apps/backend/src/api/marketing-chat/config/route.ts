/**
 * GET /marketing-chat/config?public_key=… — the widget's appearance/behavior.
 *
 * The FIRST call any embed makes: it turns the public embed key into the bot's
 * presentation (name, welcome/bubble copy, avatar, color, position, dimensions,
 * toggles) so both the React storefront widget and the vanilla widget.js loader
 * render the merchant's configured bot.
 *
 * PUBLIC-SAFE BY CONSTRUCTION: the payload is projected through `toPublicConfig`,
 * which exposes appearance + behavior only. `instructions` (the system prompt),
 * `agent_id`, `channel_config`, `reply_mode` and `tenant_id` are NEVER returned.
 *
 * Fail closed: unknown key or inactive bot -> 404, so a storefront/embed with no
 * live chatbot renders nothing.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { applyCors, OPTIONS } from "../_cors"
import { readPublicKey, resolveChatbotByPublicKey, toPublicConfig } from "../_chatbot"

export { OPTIONS }

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  applyCors(req, res)

  const publicKey = readPublicKey(req)
  if (!publicKey) {
    res.status(400).json({ error: "public_key_required" })
    return
  }

  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const chatbot = await resolveChatbotByPublicKey(mk, publicKey)
    if (!chatbot) {
      res.status(404).json({ error: "chatbot_not_found" })
      return
    }
    // The config changes the moment a merchant edits the bot; never cache it.
    res.setHeader("Cache-Control", "no-store")
    res.status(200).json({ chatbot: toPublicConfig(chatbot) })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[marketing-chat] config read failed:", e?.message ?? e)
    res.status(500).json({ error: "could_not_load_config" })
  }
}
