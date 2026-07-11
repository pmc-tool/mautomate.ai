/**
 * scoring/scoring-service — the contact engagement-scoring engine.
 *
 * Contacts accrue engagement points from marketing signals (email opens/clicks,
 * purchases, page visits) and lose points when they unsubscribe. The running
 * total lives on `marketing_contact.score` and feeds dynamic segments and a
 * leaderboard. Points per event are configurable per tenant via the durable
 * setting `scoring_points`; defaults apply for any event the override omits.
 *
 * DORMANT BY DEFAULT (this deploys to a LIVE store): `applyScore` is a no-op
 * unless the durable setting `scoring_enabled` is explicitly true. When off the
 * function still succeeds (`{ ok: true }`) so callers never branch on the gate.
 *
 * Every path is defensive: a resolution/lookup/write error returns a benign
 * result rather than throwing. Nothing thrown out of any public entrypoint —
 * scoring is strictly best-effort and must never break the flows that call it.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { SettingsService } from "../settings/settings-service"

/** Durable setting keys. */
export const SCORING_POINTS_KEY = "scoring_points"
export const SCORING_ENABLED_KEY = "scoring_enabled"

/**
 * Default points awarded per engagement event. Overridable (per event) via the
 * durable `scoring_points` setting — an override is merged over these defaults.
 */
export const DEFAULT_SCORING_POINTS: Record<string, number> = {
  email_open: 1,
  email_click: 3,
  purchase: 10,
  page_visit: 1,
  unsubscribe: -5,
}

/**
 * Resolve the effective points map for a tenant: the defaults merged with the
 * durable `scoring_points` override (override wins per key). Never throws —
 * returns the plain defaults on any lookup failure.
 */
export const getPoints = async (
  container: MedusaContainer,
  tenantId: string
): Promise<Record<string, number>> => {
  try {
    const settings = new SettingsService(container)
    const override = await settings.get<Record<string, number>>(
      tenantId,
      SCORING_POINTS_KEY,
      undefined
    )
    if (override && typeof override === "object") {
      return { ...DEFAULT_SCORING_POINTS, ...override }
    }
  } catch {
    // Fail-safe: fall back to the built-in defaults.
  }
  return { ...DEFAULT_SCORING_POINTS }
}

export type ApplyScoreInput = {
  tenantId: string
  contactId?: string
  email?: string
  event: string
  points?: number
}

export type ApplyScoreResult = {
  ok: boolean
  score?: number
}

/**
 * Apply an engagement delta to a contact's score. Resolves the contact by
 * `contactId` (else by `email` within the tenant), computes the delta from the
 * explicit `points` or the tenant points map for `event`, and writes the new
 * score floored at 0. Returns `{ ok: true, score }` on success.
 *
 * Gated by `scoring_enabled` (defaults OFF): while dormant this is a no-op that
 * still returns `{ ok: true }`. Never throws — returns `{ ok: false }` on any
 * failure to resolve or persist.
 */
export const applyScore = async (
  container: MedusaContainer,
  input: ApplyScoreInput
): Promise<ApplyScoreResult> => {
  try {
    const { tenantId, contactId, email, event } = input

    // Gate — dormant unless the durable flag is explicitly enabled.
    const settings = new SettingsService(container)
    const enabled = await settings.get<boolean>(
      tenantId,
      SCORING_ENABLED_KEY,
      false
    )
    if (enabled !== true) {
      // No-op while dormant, but a success from the caller's perspective.
      return { ok: true }
    }

    const mk: any = container.resolve(MARKETING_MODULE)

    // Resolve the target contact — by id first, else by email in-tenant.
    let contact: any = null
    if (contactId) {
      try {
        contact = await mk.retrieveMarketingContact(contactId)
      } catch {
        contact = null
      }
    }
    if (!contact && email) {
      try {
        const rows = await mk.listMarketingContacts(
          { tenant_id: tenantId, email },
          { take: 1 }
        )
        contact = Array.isArray(rows) ? rows[0] : null
      } catch {
        contact = null
      }
    }

    if (!contact?.id) {
      return { ok: false }
    }

    // Compute the delta: explicit points win, else the tenant map, else 0.
    let delta = input.points
    if (delta == null) {
      const pointsMap = await getPoints(container, tenantId)
      delta = pointsMap[event] ?? 0
    }

    const current = Number(contact.score ?? 0)
    const score = Math.max(0, current + Number(delta))

    await mk.updateMarketingContacts({ id: contact.id, score } as any)

    return { ok: true, score }
  } catch {
    // Never throw — scoring is best-effort.
    return { ok: false }
  }
}

export type TopContact = {
  contact_id: string
  email: string | null
  display_name: string | null
  score: number
}

/**
 * Return the tenant's highest-scoring contacts (score desc) for a leaderboard.
 * Never throws — returns an empty list on any failure.
 */
export const getTopContacts = async (
  container: MedusaContainer,
  opts: { tenantId: string; limit?: number }
): Promise<TopContact[]> => {
  const limit = opts.limit ?? 10
  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const rows = await mk.listMarketingContacts(
      { tenant_id: opts.tenantId },
      { take: limit, order: { score: "DESC" } }
    )
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
      contact_id: row?.id,
      email: row?.email ?? null,
      display_name: row?.display_name ?? null,
      score: Number(row?.score ?? 0),
    }))
  } catch {
    return []
  }
}

export default applyScore
