import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import jwt from "jsonwebtoken"

import { PLATFORM_MODULE } from "../../../../../modules/platform"
import { merchantMfaService } from "../../../../../modules/platform/mfa/service"

const JWT_SECRET = process.env.JWT_SECRET

/**
 * POST /auth/merchant/mfa/verify  { token, code }
 *
 * Step-two of merchant login when MFA is enabled. Accepts the bearer token
 * returned by /auth/merchant/emailpass and a TOTP/recovery code; if valid,
 * returns a NEW token with mfa_verified=true that can access /merchant/*.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is not configured" })
  }

  const body = (req.body ?? {}) as any
  const token = String(body.token ?? "").trim()
  const code = String(body.code ?? "").trim().toUpperCase()

  if (!token) return res.status(400).json({ message: "token required" })
  if (!code) return res.status(400).json({ message: "code required" })

  let payload: any
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ message: "Invalid token" })
  }

  if (payload.actor_type !== "merchant" || !payload.actor_id) {
    return res.status(401).json({ message: "Invalid merchant token" })
  }

  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const merchant = await svc.retrieveMerchant(payload.actor_id).catch(() => null)
  if (!merchant || merchant.status !== "active") {
    return res.status(401).json({ message: "Merchant not found" })
  }

  if (!merchant.mfa_enabled) {
    return res.status(400).json({ message: "MFA is not enabled for this account" })
  }

  if (!merchantMfaService.verify(merchant.mfa_secret_encrypted, merchant.mfa_backup_codes_hash, code)) {
    return res.status(400).json({ message: "Invalid code" })
  }

  const { exp, ...rest } = payload
  const verifiedPayload = { ...rest, mfa_verified: true }
  const newToken = jwt.sign(verifiedPayload, JWT_SECRET, { expiresIn: "24h" })

  res.status(200).json({ token: newToken })
}
