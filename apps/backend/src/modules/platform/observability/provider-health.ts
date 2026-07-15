/**
 * Vendor health — is every service we resell actually able to serve?
 *
 * WHY THIS EXISTS: the OpenAI account ran out of credit and nothing told anyone.
 * The keys were valid, the processes were green, every dashboard said healthy —
 * and two customers phoned in, said their order number into an open line, and
 * hung up on silence. We found out because a human complained. That is not
 * monitoring; that is luck.
 *
 * So each vendor is asked the only question that matters — "can you serve a
 * request RIGHT NOW?" — and, where the vendor will tell us, how much is left
 * before it cannot.
 *
 * Honest about what it cannot know: OpenAI exposes no balance API, and the
 * Deepgram key lacks the `billing:read` scope, so those are probe-only. A
 * balance we cannot read is reported as unknown, never as fine.
 *
 * NEVER THROWS. A prober that takes the console down when a vendor is slow is
 * worse than no prober: it hides the very outage it exists to surface.
 */

export type ProviderSeverity = "ok" | "warn" | "critical" | "unknown"

export type ProviderHealth = {
  service: string
  /** What it powers, in the operator's language ("Voice + chat brain"). */
  role: string
  ok: boolean
  severity: ProviderSeverity
  detail: string
  /** Remaining budget, when the vendor exposes one. */
  remaining?: {
    value: number
    unit: string
    /** Percent of the allowance still available, when there is an allowance. */
    percent?: number
  }
  /** True when this vendor has no live standby if it dies. */
  single_point_of_failure?: boolean
}

const TIMEOUT_MS = 8000

/** Warn when a metered allowance drops below this share of its limit. */
const LOW_BALANCE_PERCENT = Number(process.env.PROVIDER_LOW_BALANCE_PERCENT ?? 15)
/** Warn when Novita's credit balance falls below this many credits. */
const NOVITA_LOW_CREDITS = Number(process.env.NOVITA_LOW_CREDIT_ALERT ?? 20000)

const withTimeout = async (
  url: string,
  init: RequestInit = {}
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const missing = (service: string, role: string, envName: string): ProviderHealth => ({
  service,
  role,
  ok: false,
  severity: "unknown",
  detail: `No API key configured (${envName}).`,
})

/**
 * OpenAI — the voice agent's brain.
 *
 * There is no balance endpoint, so the ONLY way to know an account has run dry is
 * to ask it to think. One token is enough: a dead account answers 429
 * `insufficient_quota` to the cheapest request in the world.
 */
const checkOpenAI = async (): Promise<ProviderHealth> => {
  const key = process.env.OPENAI_API_KEY
  const role = "Voice agent brain (LLM)"
  if (!key) return missing("OpenAI", role, "OPENAI_API_KEY")

  try {
    const res = await withTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    })

    if (res.ok) {
      return {
        service: "OpenAI",
        role,
        ok: true,
        severity: "ok",
        detail: "Answering. (No balance API — health is probed, not read.)",
      }
    }

    const body = await res.text().catch(() => "")
    const outOfCredit =
      res.status === 429 && body.includes("insufficient_quota")

    return {
      service: "OpenAI",
      role,
      ok: false,
      severity: "critical",
      detail: outOfCredit
        ? "OUT OF CREDIT — the account has no quota left. The voice agent falls back to Novita, but top this up."
        : `Refusing requests (HTTP ${res.status}).`,
    }
  } catch (e: any) {
    return {
      service: "OpenAI",
      role,
      ok: false,
      severity: "critical",
      detail: `Unreachable: ${String(e?.message ?? e).slice(0, 120)}`,
    }
  }
}

/** Novita — the chat brain, and the voice agent's standby brain. */
const checkNovita = async (): Promise<ProviderHealth> => {
  const key = process.env.NOVITA_API_KEY
  const role = "Chat brain + voice failover (LLM)"
  if (!key) return missing("Novita", role, "NOVITA_API_KEY")

  try {
    const res = await withTimeout("https://api.novita.ai/v3/user", {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      return {
        service: "Novita",
        role,
        ok: false,
        severity: "critical",
        detail: `Refusing requests (HTTP ${res.status}).`,
      }
    }

    const data: any = await res.json()
    const credits = Number(data?.credit_balance ?? 0)
    const low = credits < NOVITA_LOW_CREDITS

    return {
      service: "Novita",
      role,
      ok: true,
      severity: low ? "warn" : "ok",
      detail: low
        ? `LOW: ${credits.toLocaleString()} credits left. This is also the voice agent's only standby brain.`
        : `${credits.toLocaleString()} credits left.`,
      remaining: { value: credits, unit: "credits" },
    }
  } catch (e: any) {
    return {
      service: "Novita",
      role,
      ok: false,
      severity: "critical",
      detail: `Unreachable: ${String(e?.message ?? e).slice(0, 120)}`,
    }
  }
}

/**
 * ElevenLabs — the agent's voice. The one vendor that tells us exactly how much
 * is left, so this is the only place a genuine "low balance" number exists.
 */
const checkElevenLabs = async (): Promise<ProviderHealth> => {
  const key = process.env.ELEVENLABS_API_KEY
  const role = "Voice agent speech (TTS)"
  if (!key) return missing("ElevenLabs", role, "ELEVENLABS_API_KEY")

  try {
    const res = await withTimeout(
      "https://api.elevenlabs.io/v1/user/subscription",
      { headers: { "xi-api-key": key } }
    )
    if (!res.ok) {
      return {
        service: "ElevenLabs",
        role,
        ok: false,
        severity: "critical",
        detail: `Refusing requests (HTTP ${res.status}).`,
        single_point_of_failure: true,
      }
    }

    const data: any = await res.json()
    const used = Number(data?.character_count ?? 0)
    const limit = Number(data?.character_limit ?? 0)
    const left = Math.max(0, limit - used)
    const percent = limit > 0 ? Math.round((left / limit) * 100) : undefined
    const low = percent !== undefined && percent <= LOW_BALANCE_PERCENT

    return {
      service: "ElevenLabs",
      role,
      ok: true,
      severity: low ? "warn" : "ok",
      detail: low
        ? `LOW: only ${left.toLocaleString()} characters left (${percent}% of the ${data?.tier ?? "plan"} allowance). The agent goes mute at zero.`
        : `${left.toLocaleString()} of ${limit.toLocaleString()} characters left (${percent}%, ${data?.tier ?? "plan"}).`,
      remaining: { value: left, unit: "characters", percent },
      // No second TTS vendor is wired: if this runs out, the agent cannot speak
      // at all — not even the failure apology.
      single_point_of_failure: true,
    }
  } catch (e: any) {
    return {
      service: "ElevenLabs",
      role,
      ok: false,
      severity: "critical",
      detail: `Unreachable: ${String(e?.message ?? e).slice(0, 120)}`,
      single_point_of_failure: true,
    }
  }
}

/**
 * Deepgram — the agent's ears.
 *
 * The balance endpoint needs the `billing:read` scope and our key does not have
 * it, so we can only prove it ANSWERS, not how much is left. Say exactly that:
 * a balance we cannot read must never be rendered as a balance that is fine.
 */
const checkDeepgram = async (): Promise<ProviderHealth> => {
  const key = process.env.DEEPGRAM_API_KEY
  const role = "Voice agent hearing (STT)"
  if (!key) return missing("Deepgram", role, "DEEPGRAM_API_KEY")

  try {
    const res = await withTimeout("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${key}` },
    })
    if (!res.ok) {
      return {
        service: "Deepgram",
        role,
        ok: false,
        severity: "critical",
        detail: `Refusing requests (HTTP ${res.status}).`,
        single_point_of_failure: true,
      }
    }
    return {
      service: "Deepgram",
      role,
      ok: true,
      severity: "ok",
      detail:
        "Answering. Balance not visible — the API key lacks the 'billing:read' scope, so a low balance here would go unseen.",
      single_point_of_failure: true,
    }
  } catch (e: any) {
    return {
      service: "Deepgram",
      role,
      ok: false,
      severity: "critical",
      detail: `Unreachable: ${String(e?.message ?? e).slice(0, 120)}`,
      single_point_of_failure: true,
    }
  }
}

/** Gemini — image generation. */
const checkGemini = async (): Promise<ProviderHealth> => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  const role = "Image generation"
  if (!key) return missing("Gemini", role, "GEMINI_API_KEY")

  try {
    const res = await withTimeout(
      "https://generativelanguage.googleapis.com/v1beta/models",
      { headers: { "x-goog-api-key": key } }
    )
    return res.ok
      ? {
          service: "Gemini",
          role,
          ok: true,
          severity: "ok",
          detail: "Answering. (No balance API — health is probed, not read.)",
        }
      : {
          service: "Gemini",
          role,
          ok: false,
          severity: "critical",
          detail: `Refusing requests (HTTP ${res.status}).`,
        }
  } catch (e: any) {
    return {
      service: "Gemini",
      role,
      ok: false,
      severity: "critical",
      detail: `Unreachable: ${String(e?.message ?? e).slice(0, 120)}`,
    }
  }
}

/** Daily — the call transport. No calls happen without it. */
const checkDaily = async (): Promise<ProviderHealth> => {
  const key = process.env.DAILY_API_KEY
  const role = "Call transport (voice)"
  if (!key) return missing("Daily", role, "DAILY_API_KEY")

  try {
    const res = await withTimeout("https://api.daily.co/v1/", {
      headers: { Authorization: `Bearer ${key}` },
    })
    return res.ok
      ? {
          service: "Daily",
          role,
          ok: true,
          severity: "ok",
          detail: "Answering.",
          single_point_of_failure: true,
        }
      : {
          service: "Daily",
          role,
          ok: false,
          severity: "critical",
          detail: `Refusing requests (HTTP ${res.status}).`,
          single_point_of_failure: true,
        }
  } catch (e: any) {
    return {
      service: "Daily",
      role,
      ok: false,
      severity: "critical",
      detail: `Unreachable: ${String(e?.message ?? e).slice(0, 120)}`,
      single_point_of_failure: true,
    }
  }
}

// The probes cost real vendor requests, so a page refresh must not re-run them.
let cache: { at: number; providers: ProviderHealth[] } | null = null
const CACHE_MS = 60_000

export const checkProviders = async (
  force = false
): Promise<ProviderHealth[]> => {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.providers
  }

  const providers = await Promise.all([
    checkOpenAI(),
    checkNovita(),
    checkElevenLabs(),
    checkDeepgram(),
    checkGemini(),
    checkDaily(),
  ])

  cache = { at: Date.now(), providers }
  return providers
}

/** The providers that need someone to do something, worst first. */
export const failingProviders = (providers: ProviderHealth[]): ProviderHealth[] =>
  providers
    .filter((p) => p.severity === "critical" || p.severity === "warn")
    .sort((a, b) => (a.severity === "critical" ? -1 : 1))
