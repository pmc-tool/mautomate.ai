/**
 * ai-provider — the provider contracts the marketing content engine depends on.
 *
 * These are deliberately backend-agnostic: the content engine only ever sees
 * these interfaces, so swapping OpenAI for another vendor (or a self-hosted
 * model) later is a registry-only change with NO call-site edits.
 *
 * Only `AiTextProvider` has an implementation today (see `openai-text.ts`); the
 * image / video / tts shapes are declared now so later phases can slot in
 * providers without reshaping the contract surface.
 */

/** Options for a single text generation call. All optional. */
export type AiTextGenerateOptions = {
  /** System prompt / grounding block prepended as the `system` role. */
  system?: string
  /** When true, ask the model for a strict JSON object response. */
  json?: boolean
  /** Upper bound on generated tokens. */
  maxTokens?: number
  /** Sampling temperature (0 = deterministic). */
  temperature?: number
}

/**
 * A text-generation provider. `generate` resolves to the raw model message
 * string (JSON text when `opts.json` is set). Implementations decide their own
 * error contract; the OpenAI provider throws a clean Error the caller catches.
 */
export interface AiTextProvider {
  /** Stable provider name (e.g. "openai"). */
  readonly name: string
  /** Whether the provider has the config it needs to run (e.g. an API key). */
  isConfigured(): boolean
  /** Generate text for `prompt`, honoring `opts`. */
  generate(prompt: string, opts?: AiTextGenerateOptions): Promise<string>
}

// ---------------------------------------------------------------------------
// Stub contracts for later phases (no implementations yet). Declared here so
// the provider surface is stable and the registry can grow without reshaping.
// ---------------------------------------------------------------------------

/** Options for a single image generation call. */
export type AiImageGenerateOptions = {
  /** WxH size hint, e.g. "1024x1024". */
  size?: string
  /** How many images to produce. */
  count?: number
  /** Optional system / style grounding. */
  system?: string
}

/** The result of an image generation call. */
export type AiImageResult = {
  /** Publicly reachable image url, when the provider hosts it. */
  url?: string
  /** Base64-encoded image bytes, when returned inline. */
  b64?: string
}

/** An image-generation provider (later phase). */
export interface AiImageProvider {
  readonly name: string
  isConfigured(): boolean
  generate(
    prompt: string,
    opts?: AiImageGenerateOptions
  ): Promise<AiImageResult[]>
}

/** Options for a single video generation call. */
export type AiVideoGenerateOptions = {
  /** Target clip length in seconds. */
  seconds?: number
  /** Aspect ratio hint, e.g. "9:16". */
  aspectRatio?: string
  /** Optional system / style grounding. */
  system?: string
}

/** The result of a video generation call. */
export type AiVideoResult = {
  /** Publicly reachable video url, when the provider hosts it. */
  url?: string
  /** Opaque job id when generation is async. */
  jobId?: string
}

/** A video-generation provider (later phase). */
export interface AiVideoProvider {
  readonly name: string
  isConfigured(): boolean
  generate(
    prompt: string,
    opts?: AiVideoGenerateOptions
  ): Promise<AiVideoResult>
}

/** Options for a single text-to-speech call. */
export type AiTtsGenerateOptions = {
  /** Voice id / name understood by the provider. */
  voice?: string
  /** Output audio format, e.g. "mp3". */
  format?: string
  /** Speaking rate multiplier. */
  speed?: number
}

/** The result of a text-to-speech call. */
export type AiTtsResult = {
  /** Publicly reachable audio url, when the provider hosts it. */
  url?: string
  /** Base64-encoded audio bytes, when returned inline. */
  b64?: string
}

/** A text-to-speech provider (later phase). */
export interface AiTtsProvider {
  readonly name: string
  isConfigured(): boolean
  generate(text: string, opts?: AiTtsGenerateOptions): Promise<AiTtsResult>
}
