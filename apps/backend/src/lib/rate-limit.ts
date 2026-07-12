/**
 * rate-limit — a small fixed-window limiter for PUBLIC, unauthenticated routes.
 *
 * The web-chat API (`/marketing-chat/*`) is open to the internet and a single
 * message can trigger a PAID AI call, so it must be bounded per conversation
 * token and per client IP. This is the shared primitive for that.
 *
 * BACKING STORE (chosen once, at first use):
 *   1. Redis — the durable, cross-instance store. Discovered from `REDIS_URL`,
 *      or from the SAME Sentinel configuration the event bus / workflow engine
 *      use (REDIS_PASSWORD + REDIS_MASTER_NAME + the three local sentinels, see
 *      medusa-config.ts). Counters are `INCR` + `EXPIRE` on a window-bucketed
 *      key, so several backend instances share one budget.
 *   2. In-process — the fallback when Redis is not configured (dev) or is
 *      unreachable. Bounds abuse per instance; a restart resets the windows.
 *
 * Redis is imported through a non-literal specifier and treated as `any` so the
 * dependency stays soft (no REDIS_* env -> ioredis is never loaded) and this
 * file typechecks without @types/ioredis — the same pattern the call-center OTP
 * store uses.
 *
 * FAIL-CLOSED-ISH: a Redis error degrades to the in-process counter for that
 * call rather than allowing the request unconditionally.
 */

/** One consume() verdict. */
export type RateLimitResult = {
  allowed: boolean
  /** Requests still available in the current window (never negative). */
  remaining: number
  /** Seconds until the current window rolls over (for Retry-After). */
  retryAfter: number
  limit: number
}

/** Sentinel wiring mirrors medusa-config.ts — one source of truth for the ports. */
const SENTINELS = [
  { host: "127.0.0.1", port: 26479 },
  { host: "127.0.0.1", port: 26480 },
  { host: "127.0.0.1", port: 26481 },
]

/** Process-local fixed-window counters: key -> { count, window expiry }. */
const memoryCounters = new Map<string, { count: number; expiresAt: number }>()

/** Drop expired buckets so a long-lived process cannot grow the map forever. */
const sweepMemory = (now: number): void => {
  if (memoryCounters.size < 5000) {
    return
  }
  for (const [key, entry] of memoryCounters) {
    if (entry.expiresAt <= now) {
      memoryCounters.delete(key)
    }
  }
}

const memoryIncr = (key: string, windowSeconds: number): number => {
  const now = Date.now()
  sweepMemory(now)
  const entry = memoryCounters.get(key)
  if (!entry || entry.expiresAt <= now) {
    memoryCounters.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    })
    return 1
  }
  entry.count += 1
  return entry.count
}

/**
 * The shared Redis client, created at most once. `undefined` = not attempted
 * yet, `null` = no Redis configured / connection could not be constructed.
 */
let redisPromise: Promise<any | null> | undefined

const connectRedis = async (): Promise<any | null> => {
  const url = process.env.REDIS_URL
  const password = process.env.REDIS_PASSWORD
  if (!url && !password) {
    return null
  }
  try {
    // Non-literal specifier: keeps TS from statically resolving ioredis' types.
    const specifier = "ioredis"
    const mod: any = await import(specifier)
    const RedisCtor = mod?.default ?? mod?.Redis ?? mod
    // The offline queue stays ENABLED on purpose: the first limiter call can land
    // before the Sentinel handshake completes, and a queued command that resolves
    // a few ms later is correct, whereas a rejected one would silently degrade the
    // counter to per-instance memory. `maxRetriesPerRequest` bounds the wait so a
    // genuinely dead Redis still fails fast into the in-process fallback.
    const options = { maxRetriesPerRequest: 2 }
    const client = url
      ? new RedisCtor(url, options)
      : new RedisCtor({
          ...options,
          sentinels: SENTINELS,
          name: process.env.REDIS_MASTER_NAME ?? "b2d-master",
          password,
          sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD ?? password,
        })
    // Swallow connection errors: a Redis blip degrades the limiter to the
    // in-process counter, it must never crash the API process.
    client.on?.("error", (err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(
        "[rate-limit] redis client error:",
        err instanceof Error ? err.message : err
      )
    })
    return client
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[rate-limit] redis unavailable, using in-process counters:", e?.message ?? e)
    return null
  }
}

const getRedis = (): Promise<any | null> => {
  if (!redisPromise) {
    redisPromise = connectRedis()
  }
  return redisPromise
}

/**
 * Consume one unit against `key` and report whether the caller is still within
 * `limit` per `windowSeconds`. Windows are fixed and aligned to the epoch, so
 * every instance buckets identically.
 */
export const consumeRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const windowStart = nowSeconds - (nowSeconds % windowSeconds)
  const retryAfter = windowStart + windowSeconds - nowSeconds
  const bucketKey = `rl:${key}:${windowStart}`

  let count: number | null = null
  const redis = await getRedis()
  if (redis) {
    try {
      const [[, incremented]] = await redis
        .multi()
        .incr(bucketKey)
        .expire(bucketKey, windowSeconds)
        .exec()
      count = Number(incremented)
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn("[rate-limit] redis incr failed, falling back:", e?.message ?? e)
      count = null
    }
  }

  if (count == null || Number.isNaN(count)) {
    count = memoryIncr(bucketKey, windowSeconds)
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: Math.max(1, retryAfter),
    limit,
  }
}

/**
 * The client's IP, preferring the left-most entry of `x-forwarded-for` (the
 * backend sits behind nginx/Cloudflare, so `req.ip` is the proxy).
 */
export const clientIp = (headers: Record<string, any>, fallback?: string): string => {
  const fwd = headers["x-forwarded-for"]
  const raw = Array.isArray(fwd) ? fwd[0] : fwd
  if (typeof raw === "string" && raw.trim()) {
    const first = raw.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }
  const real = headers["x-real-ip"]
  if (typeof real === "string" && real.trim()) {
    return real.trim()
  }
  return fallback && fallback.trim() ? fallback : "unknown"
}
