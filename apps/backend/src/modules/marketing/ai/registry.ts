import type {
  AiImageProvider,
  AiTextProvider,
  AiTtsProvider,
  AiVideoProvider,
} from "./ai-provider"
import { OpenAiTextProvider } from "./openai-text"
import { meterInstanceCall } from "../../platform/integration/instance-meter"
import { tracedImage, tracedText, tracedVideo } from "./langfuse-trace"

/**
 * ai/registry — the single place the content engine asks for a provider.
 *
 * Today only OpenAI-backed text exists. Adding a second vendor (or picking one
 * by env) is a change here alone; every caller keeps depending on the
 * `AiTextProvider` interface, never a concrete class.
 *
 * METERING: providers are wrapped here so that inside a tenant INSTANCE every
 * generate() reserves→commits credits against the tenant's control-plane wallet
 * (see instance-meter). On the control plane / single-tenant FF the wrapper is a
 * pure passthrough, so wrapping here is safe and needs zero call-site changes.
 */

/**
 * Wrap a text provider so generate() is credit-metered (ai_text, 1 unit/call).
 *
 * TOOL RUNS: `runTools` is forwarded (and its capability flag with it) so the
 * wrapper never silently strips the tool capability. One tool run makes SEVERAL
 * model completions, so it reserves 1 unit and commits the ACTUAL number of
 * rounds — a 3-round answer is billed as 3 `ai_text` units, never as 1.
 */
const meteredText = (inner: AiTextProvider): AiTextProvider => {
  const canRunTools =
    inner.supportsTools === true && typeof inner.runTools === "function"

  return {
    name: inner.name,
    isConfigured: () => inner.isConfigured(),
    generate: (prompt, opts) =>
      meterInstanceCall("ai_text", 1, async () => ({
        result: await inner.generate(prompt, opts),
      })),
    supportsTools: canRunTools,
    runTools: canRunTools
      ? (prompt, opts) =>
          meterInstanceCall("ai_text", 1, async () => {
            const result = await inner.runTools!(prompt, opts)
            return { result, actualUnits: Math.max(1, result.rounds) }
          })
      : undefined,
  }
}

/** Wrap an image provider so generate() is metered (ai_image, per image). */
const meteredImage = (inner: AiImageProvider): AiImageProvider => ({
  name: inner.name,
  isConfigured: () => inner.isConfigured(),
  generate: (prompt, opts) => {
    const estimate = Math.max(1, opts?.count ?? 1)
    return meterInstanceCall("ai_image", estimate, async () => {
      const result = await inner.generate(prompt, opts)
      return { result, actualUnits: Math.max(1, result.length) }
    })
  },
})

/**
 * COST-ATTRIBUTION INVARIANT: the tenant a provider is TRACED under must be the
 * merchant who triggered the call, not a boot-time constant. In pooled prod
 * `process.env.TENANT_ID` is UNSET, so any trace stamped from it lands on the
 * null "Platform" tenant and the super-admin per-merchant margin is wrong for
 * every non-voice AI. Callers therefore pass the request's REAL resolved tenant
 * (`ctx.tenant.id` / `input.tenantId`) which flows straight into the Langfuse
 * trace metadata. The env var is only a single-tenant fallback for callers that
 * genuinely have no request tenant (e.g. the Forever Finds admin surface).
 */
const resolveTraceTenant = (tenantId?: string): string | undefined =>
  tenantId || process.env.TENANT_ID

/**
 * Return the configured text provider, or null when none is configured (e.g.
 * OPENAI_API_KEY is unset). The content engine treats null as "AI unavailable"
 * and degrades gracefully rather than throwing.
 *
 * Pass the calling merchant's `tenantId` so the emitted Langfuse trace is
 * attributed to them (see COST-ATTRIBUTION INVARIANT above).
 */
export const getAiTextProvider = (
  tenantId?: string
): AiTextProvider | null => {
  const openai = new OpenAiTextProvider()
  if (openai.isConfigured()) {
    return tracedText(meteredText(openai), {
      tenantId: resolveTraceTenant(tenantId),
    })
  }
  return null
}

/**
 * Return the configured image provider, or null. Loaded lazily so the module
 * (`./openai-image`) can be authored in a later phase without this file
 * depending on it at compile time; a missing module or unconfigured key both
 * yield null, and callers degrade to "AI image unavailable".
 */
export const getAiImageProvider = (
  tenantId?: string
): AiImageProvider | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./openai-image")
    const provider = new mod.OpenAiImageProvider() as AiImageProvider
    return provider.isConfigured()
      ? tracedImage(meteredImage(provider), {
          tenantId: resolveTraceTenant(tenantId),
        })
      : null
  } catch {
    return null
  }
}

/** Return the configured text-to-speech provider, or null (lazy, see above). */
export const getAiTtsProvider = (): AiTtsProvider | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./elevenlabs-tts")
    const provider = new mod.ElevenLabsTtsProvider() as AiTtsProvider
    return provider.isConfigured() ? provider : null
  } catch {
    return null
  }
}

/** Return the configured video provider, or null (lazy, see above). */
export const getAiVideoProvider = (
  tenantId?: string
): AiVideoProvider | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./gen-video")
    const provider = new mod.GenVideoProvider() as AiVideoProvider
    return provider.isConfigured()
      ? tracedVideo(provider, { tenantId: resolveTraceTenant(tenantId) })
      : null
  } catch {
    return null
  }
}
