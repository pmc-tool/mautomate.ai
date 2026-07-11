import crypto from "crypto"

import { MedusaContainer } from "@medusajs/framework/types"

/**
 * OtpService — SMS one-time-password step-up for inbound WISMO calls.
 *
 * WHY THIS EXISTS: an inbound caller's caller-ID is a HINT, never proof — it is
 * trivially spoofable. Before the voice runtime reveals any sensitive order
 * detail (status, COD amount, address) to an inbound caller, the caller must
 * prove control of the phone number by reading back a 6-digit code we SMS them.
 * This service is that real gate; the playbook's `otp_challenge` state blocks
 * disclosure until `verify()` returns `{ verified: true }`.
 *
 * STORAGE: there is no OTP DB model, so challenges live in a short-TTL key/value
 * store. When `REDIS_URL` is set we use a Redis-backed store (survives across
 * multiple app instances / restarts); otherwise we fall back to a process-local
 * in-memory `Map`. In-memory is FINE for a single instance / dev, but a code
 * issued on instance A cannot be verified on instance B, and a restart drops all
 * pending challenges — see `TODO(durability)` on `InMemoryOtpStore`.
 *
 * SECURITY POSTURE:
 *   - the raw code is NEVER returned from `send()` (no code leakage),
 *   - only a SHA-256 hash of the code is stored (never the plaintext),
 *   - `verify()` compares with a timing-safe digest compare,
 *   - a 5-minute TTL + a hard cap of 3 attempts (then lock) bounds brute force.
 */

const CODE_TTL_SECONDS = 5 * 60
const MAX_ATTEMPTS = 3

/** A pending OTP challenge as persisted in the KV store. */
type OtpChallenge = {
  /** SHA-256 hex digest of the issued code — never the plaintext. */
  code_hash: string
  /** Epoch ms when the challenge expires (redundant with the store TTL). */
  expires_at: number
  /** Count of failed verification attempts so far. */
  attempts: number
  /** True once the attempt cap is hit; further verifies are refused. */
  locked: boolean
}

/** Minimal KV contract the service needs — satisfied by both store backends. */
interface OtpStore {
  get(key: string): Promise<OtpChallenge | null>
  set(key: string, value: OtpChallenge, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
}

/**
 * Process-local fallback store.
 *
 * TODO(durability): in-memory only — a code issued here cannot be verified on
 * another instance, and a restart drops every pending challenge. Acceptable for
 * a single instance / dev; set `REDIS_URL` in production to get the shared,
 * restart-surviving Redis store instead.
 */
class InMemoryOtpStore implements OtpStore {
  private readonly map = new Map<string, { value: OtpChallenge; expiresAt: number }>()

  async get(key: string): Promise<OtpChallenge | null> {
    const entry = this.map.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: OtpChallenge, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  async del(key: string): Promise<void> {
    this.map.delete(key)
  }
}

/**
 * Redis-backed store. Uses `ioredis` (already present transitively via the
 * Medusa Redis modules). The client is imported through a non-literal specifier
 * and treated as `any` so this file typechecks with or without `@types/ioredis`
 * installed, and so the dependency stays soft (unset `REDIS_URL` -> never
 * loaded).
 */
class RedisOtpStore implements OtpStore {
  private client: any
  private readonly ready: Promise<void>

  constructor(redisUrl: string) {
    this.ready = this.connect(redisUrl)
  }

  private async connect(redisUrl: string): Promise<void> {
    // Non-literal specifier: keeps TS from statically resolving ioredis' types.
    const specifier = "ioredis"
    const mod: any = await import(specifier)
    const RedisCtor = mod?.default ?? mod?.Redis ?? mod
    this.client = new RedisCtor(redisUrl)
    // Swallow connection errors so a Redis blip never crashes the voice runtime;
    // a failed op degrades to "not verified" rather than throwing.
    this.client.on?.("error", (err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn("[otp] redis client error:", err instanceof Error ? err.message : err)
    })
  }

  async get(key: string): Promise<OtpChallenge | null> {
    await this.ready
    const raw = await this.client.get(key)
    if (!raw) {
      return null
    }
    try {
      return JSON.parse(raw) as OtpChallenge
    } catch {
      return null
    }
  }

  async set(key: string, value: OtpChallenge, ttlSeconds: number): Promise<void> {
    await this.ready
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.ready
    await this.client.del(key)
  }
}

/** SHA-256 hex digest of a code (equal-length digests enable a timing-safe compare). */
const hashCode = (code: string): string =>
  crypto.createHash("sha256").update(code, "utf8").digest("hex")

/** Constant-time compare of two equal-length hex digests. */
const timingSafeEqualHex = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ba.length !== bb.length) {
    return false
  }
  return crypto.timingSafeEqual(Uint8Array.from(ba), Uint8Array.from(bb))
}

/** Cryptographically-random 6-digit code, left-padded (e.g. "004215"). */
const generateCode = (): string =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")

/** Normalize a phone into a stable KV key segment (trimmed, whitespace-free). */
const normalizePhone = (phone: string): string => phone.trim().replace(/\s+/g, "")

/** Build the per-tenant, per-phone challenge key. */
const challengeKey = (tenantId: string, phone: string): string =>
  `otp:${tenantId}:${normalizePhone(phone)}`

/**
 * POST to Twilio's Messages API to send an SMS. NO-THROW: any failure (missing
 * credentials, network error, non-2xx) is logged and swallowed — the OTP flow
 * must never crash the voice runtime, and we never surface send failures to the
 * caller in a way that would leak whether a number exists.
 *
 * When `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` are unset we log a dev stub
 * and return without calling Twilio (the code is still stored so a dev can read
 * it from logs if they add one — but we deliberately do NOT log the code).
 */
const sendSms = async (to: string, body: string): Promise<void> => {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    // eslint-disable-next-line no-console
    console.info(
      `[otp] Twilio not configured — dev stub: would SMS ${to} an OTP (credentials/from unset).`
    )
    return
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const auth = Buffer.from(`${sid}:${token}`).toString("base64")
    const form = new URLSearchParams({ To: to, From: from, Body: body })

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    })

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "")
      // eslint-disable-next-line no-console
      console.warn(`[otp] Twilio send failed (${resp.status}): ${detail.slice(0, 200)}`)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[otp] Twilio send error:", e instanceof Error ? e.message : e)
  }
}

/**
 * OtpService — construct with the DI container. Stateless apart from its KV
 * store choice, which is decided once at construction from `REDIS_URL`.
 */
export class OtpService {
  private readonly store: OtpStore

  constructor(_container?: MedusaContainer) {
    const redisUrl = process.env.REDIS_URL
    this.store = redisUrl
      ? new RedisOtpStore(redisUrl)
      : new InMemoryOtpStore()
  }

  /**
   * Issue a fresh 6-digit code for `phone`, store its hash under a 5-minute TTL
   * with a zeroed attempt counter, and SMS it to the caller. NEVER returns the
   * code. Always resolves `{ sent: true }` — even if the SMS provider is
   * unconfigured — so callers cannot probe number existence via the response.
   */
  async send(tenantId: string, phone: string): Promise<{ sent: true }> {
    const code = generateCode()
    const key = challengeKey(tenantId, phone)

    const challenge: OtpChallenge = {
      code_hash: hashCode(code),
      expires_at: Date.now() + CODE_TTL_SECONDS * 1000,
      attempts: 0,
      locked: false,
    }

    await this.store.set(key, challenge, CODE_TTL_SECONDS)
    await sendSms(
      normalizePhone(phone),
      `Your Forever Finds verification code is ${code}`
    )

    return { sent: true }
  }

  /**
   * Verify a caller-supplied `code` against the stored challenge.
   *   - no/expired challenge -> `{ verified: false }`
   *   - already locked, or this failure hits the 3-attempt cap -> `{ verified:
   *     false, locked: true }`
   *   - match -> `{ verified: true }` and the challenge is consumed (single-use).
   * The compare is timing-safe and operates on hashes, not plaintext.
   */
  async verify(
    tenantId: string,
    phone: string,
    code: string
  ): Promise<{ verified: boolean; locked?: boolean }> {
    const key = challengeKey(tenantId, phone)
    const challenge = await this.store.get(key)

    if (!challenge) {
      return { verified: false }
    }

    if (challenge.locked || challenge.attempts >= MAX_ATTEMPTS) {
      return { verified: false, locked: true }
    }

    const supplied = typeof code === "string" ? code.trim() : ""
    const matches = timingSafeEqualHex(challenge.code_hash, hashCode(supplied))

    if (matches) {
      // Single-use: consume the challenge so a code cannot be replayed.
      await this.store.del(key)
      return { verified: true }
    }

    const attempts = challenge.attempts + 1
    const locked = attempts >= MAX_ATTEMPTS

    // Preserve the remaining TTL so a failed attempt never extends the window.
    const remainingSeconds = Math.max(
      1,
      Math.ceil((challenge.expires_at - Date.now()) / 1000)
    )
    await this.store.set(
      key,
      { ...challenge, attempts, locked },
      remainingSeconds
    )

    return locked ? { verified: false, locked: true } : { verified: false }
  }
}

export default OtpService
