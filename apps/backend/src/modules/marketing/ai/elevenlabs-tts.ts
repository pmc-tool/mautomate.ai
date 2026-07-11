import type { AiTtsGenerateOptions, AiTtsProvider } from "./ai-provider"

/**
 * ElevenLabsTtsProvider — the ElevenLabs text-to-speech backed `AiTtsProvider`.
 *
 * Config (env):
 *   - ELEVENLABS_API_KEY  — required; presence gates `isConfigured()`.
 *   - ELEVENLABS_VOICE_ID — default voice id when the caller passes none.
 *   - ELEVENLABS_MODEL    — model id, defaults to "eleven_multilingual_v2".
 *
 * ERROR CONTRACT: `generate` NEVER leaks a raw network error. On any failure
 * (unconfigured, non-2xx, transport error) it throws a single clean `Error`.
 * The studio wraps this in try/catch and falls back to a silent track, so a
 * missing/failing TTS key never crashes a render.
 *
 * The ElevenLabs endpoint returns raw audio bytes (mp3 by default), so the
 * result is surfaced as base64 (`b64`), matching the `AiTtsResult` inline shape.
 */

/** A sensible built-in default voice ("Rachel") when none is configured. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

/** Default TTS model when `ELEVENLABS_MODEL` is unset. */
const DEFAULT_MODEL = "eleven_multilingual_v2"

export class ElevenLabsTtsProvider implements AiTtsProvider {
  readonly name = "elevenlabs"

  /** Configured when an API key is present in the environment. */
  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY
  }

  /**
   * Synthesize `text` to speech. Returns the audio bytes as base64 in `b64`.
   * Throws a clean Error on any failure.
   */
  async generate(
    text: string,
    opts: AiTtsGenerateOptions = {}
  ): Promise<{ url?: string; b64?: string }> {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      throw new Error(
        "[marketing] ElevenLabsTtsProvider: ELEVENLABS_API_KEY is not set"
      )
    }

    const voiceId =
      opts.voice ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID
    const modelId = process.env.ELEVENLABS_MODEL ?? DEFAULT_MODEL

    const body: Record<string, unknown> = {
      text,
      model_id: modelId,
    }

    let resp: Response
    try {
      resp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          voiceId
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify(body),
        }
      )
    } catch (e) {
      throw new Error(
        `[marketing] ElevenLabsTtsProvider: request failed (${
          e instanceof Error ? e.message : String(e)
        })`
      )
    }

    if (!resp.ok) {
      throw new Error(
        `[marketing] ElevenLabsTtsProvider: ElevenLabs returned ${resp.status}`
      )
    }

    const bytes = await resp.arrayBuffer()
    if (!bytes || bytes.byteLength === 0) {
      throw new Error(
        "[marketing] ElevenLabsTtsProvider: empty audio response"
      )
    }

    return { b64: Buffer.from(bytes).toString("base64") }
  }
}

export default ElevenLabsTtsProvider
