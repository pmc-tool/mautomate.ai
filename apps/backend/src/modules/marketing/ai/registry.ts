import type {
  AiImageProvider,
  AiTextProvider,
  AiTtsProvider,
  AiVideoProvider,
} from "./ai-provider"
import { OpenAiTextProvider } from "./openai-text"
import { meterInstanceCall } from "../../platform/integration/instance-meter"

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

/** Wrap a text provider so generate() is credit-metered (ai_text, 1 unit/call). */
const meteredText = (inner: AiTextProvider): AiTextProvider => ({
  name: inner.name,
  isConfigured: () => inner.isConfigured(),
  generate: (prompt, opts) =>
    meterInstanceCall("ai_text", 1, async () => ({
      result: await inner.generate(prompt, opts),
    })),
})

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
 * Return the configured text provider, or null when none is configured (e.g.
 * OPENAI_API_KEY is unset). The content engine treats null as "AI unavailable"
 * and degrades gracefully rather than throwing.
 */
export const getAiTextProvider = (): AiTextProvider | null => {
  const openai = new OpenAiTextProvider()
  if (openai.isConfigured()) {
    return meteredText(openai)
  }
  return null
}

/**
 * Return the configured image provider, or null. Loaded lazily so the module
 * (`./openai-image`) can be authored in a later phase without this file
 * depending on it at compile time; a missing module or unconfigured key both
 * yield null, and callers degrade to "AI image unavailable".
 */
export const getAiImageProvider = (): AiImageProvider | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./openai-image")
    const provider = new mod.OpenAiImageProvider() as AiImageProvider
    return provider.isConfigured() ? meteredImage(provider) : null
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
export const getAiVideoProvider = (): AiVideoProvider | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./gen-video")
    const provider = new mod.GenVideoProvider() as AiVideoProvider
    return provider.isConfigured() ? provider : null
  } catch {
    return null
  }
}
