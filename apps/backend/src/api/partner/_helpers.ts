import { MedusaRequest } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"

export type PartnerCtx = { partner: any; svc: any }

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

/**
 * Resolve the authenticated partner from the request's auth context
 * (actor_type "partner", set by authenticate("partner") in middlewares.ts —
 * the auth identity's app_metadata.partner_id is the actor id). Returns null
 * if not a partner or the partner is inactive — every /partner route is scoped
 * to EXACTLY this partner, so cross-partner access is impossible.
 */
export async function resolvePartner(req: MedusaRequest): Promise<PartnerCtx | null> {
  const auth = (req as any).auth_context ?? {}
  if (auth.actor_type !== "partner" || !auth.actor_id) return null
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const partner = await svc.retrievePartner(auth.actor_id).catch(() => null)
  if (!partner || partner.status !== "active") return null
  return { partner, svc }
}

/** The signup link a partner shares — lands on the platform signup with ?ref. */
export function referralLink(partner: { referral_code?: string | null }): string | null {
  if (!partner.referral_code) return null
  return `https://${ROOT}/signup?ref=${partner.referral_code}`
}

/** Sum a list of commission rows' amount_cents. */
export function sumCents(rows: Array<{ amount_cents?: number }>): number {
  return rows.reduce((acc, r) => acc + (Number(r.amount_cents) || 0), 0)
}
