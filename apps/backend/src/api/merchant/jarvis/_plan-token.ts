import crypto from "crypto"

/**
 * Pixi P1 — stateless plan tokens (the confirm gate).
 *
 * A write is a TWO-request handshake: the streaming `/merchant/jarvis` run
 * executes a write tool in PROPOSE mode (no mutation) and emits a signed plan
 * token describing the frozen action; the merchant confirms in the panel and the
 * browser posts it to `/merchant/jarvis/apply`, which re-verifies the token and
 * executes the EXACT frozen args. The token is self-contained (HMAC-signed, no
 * server state) and TENANT-BOUND — apply re-checks `tid === ctx.tenant.id`, so a
 * token minted for one store can never be replayed against another (the same
 * class of hole we closed on editor tokens). Hard-tier actions additionally
 * require the merchant to type a confirm word, and every apply is single-use via
 * an idempotency key derived from the token.
 */

export type PlanTier = "soft" | "hard"

export type JarvisPlan = {
  v: 1
  tid: string // tenant id — apply MUST match this to the live session
  action: string // write-tool name
  args: Record<string, unknown> // FROZEN apply_args (resolved server-side, never model ids)
  tier: PlanTier
  requireText?: string // hard-tier confirm word (e.g. "REFUND")
  summary: string // human one-liner shown on the confirm card
  iat: number
  exp: number
}

const TTL_MS = 120_000 // a plan is good for 2 minutes, then the merchant re-asks

function secret(): string {
  // Deliberately NOT falling back to COOKIE_SECRET / JWT_SECRET: those are broad,
  // high-exposure secrets, and a plan token can move money. Pixi gets its own
  // dedicated secret so the blast radius of a plan-token forge is contained to
  // this one key. Fail closed if it isn't set — never mint a forgeable token.
  const s = process.env.JARVIS_PLAN_SECRET || ""
  if (!s || s.length < 16) {
    throw new Error("JARVIS_PLAN_SECRET is not configured")
  }
  return s
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64")
}

function sign(payloadB64: string): string {
  return b64url(
    crypto.createHmac("sha256", secret()).update(payloadB64).digest()
  )
}

export function signPlan(
  input: Omit<JarvisPlan, "v" | "iat" | "exp">
): { token: string; exp: number } {
  const now = Date.now()
  const plan: JarvisPlan = {
    v: 1,
    iat: now,
    exp: now + TTL_MS,
    ...input,
  }
  const payloadB64 = b64url(JSON.stringify(plan))
  const token = `${payloadB64}.${sign(payloadB64)}`
  return { token, exp: plan.exp }
}

/**
 * Verify a plan token. Returns the plan on success, or `{ error }` describing why
 * it was rejected — the apply route turns that into a friendly message. Uses a
 * constant-time signature compare and rejects on any tamper / expiry.
 */
export function verifyPlan(
  token: unknown
): { ok: true; plan: JarvisPlan } | { ok: false; error: string } {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, error: "This confirmation is invalid. Ask Pixi again." }
  }
  const dot = token.lastIndexOf(".")
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  let expected: string
  try {
    expected = sign(payloadB64)
  } catch {
    return { ok: false, error: "The assistant isn't fully configured on this store yet." }
  }

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "This confirmation couldn't be verified. Ask Pixi again." }
  }

  let plan: JarvisPlan
  try {
    plan = JSON.parse(fromB64url(payloadB64).toString("utf8"))
  } catch {
    return { ok: false, error: "This confirmation is unreadable. Ask Pixi again." }
  }

  if (plan?.v !== 1 || !plan.tid || !plan.action) {
    return { ok: false, error: "This confirmation is invalid. Ask Pixi again." }
  }
  if (typeof plan.exp !== "number" || Date.now() > plan.exp) {
    return { ok: false, error: "This confirmation expired. Ask Pixi to do it again." }
  }
  return { ok: true, plan }
}

/** Single-use key for a plan — apply meters/dedupes on this so one token = one run. */
export function planNonce(token: string): string {
  return crypto.createHash("sha256").update(String(token)).digest("hex").slice(0, 32)
}
