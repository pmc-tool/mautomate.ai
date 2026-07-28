import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import jwt from "jsonwebtoken"
import { resolveMerchant } from "../_helpers"

/**
 * POST /merchant/session — exchange a VALID merchant bearer for a fresh
 * full-length session token (24h, matching password login).
 *
 * Why: handoff entries into the dashboard (post-signup "go to admin",
 * super-admin impersonation) mint deliberately SHORT tokens (30m) so a leaked
 * URL hash goes stale fast. The dashboard used to persist that short token as
 * the whole session — merchants entering through those paths were silently
 * logged out minutes later. The client now swaps the short token for a real
 * session immediately after adopting it; the leak-protection window is
 * unchanged (an unused handoff link still dies at 30m).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ message: "auth is not configured" })
  }

  const token = jwt.sign(
    {
      actor_id: ctx.merchant.id,
      actor_type: "merchant",
      auth_provider: "emailpass",
      app_metadata: { email: ctx.merchant.email, merchant_id: ctx.merchant.id },
      user_metadata: {},
    },
    secret,
    { expiresIn: "24h" }
  )

  res.json({ token })
}
