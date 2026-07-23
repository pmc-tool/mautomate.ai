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

/** Token usage a provider MAY report for observability (best-effort, optional). */
export type AiUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

/**
 * @internal Observability side-channel. A provider MAY call this once per model
 * completion to report the resolved model name and token usage. It NEVER affects
 * generation and is safe to ignore; the tracing wrapper injects it.
 */
export type AiUsageReporter = (info: {
  model?: string
  usage?: AiUsage
}) => void

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
  /**
   * Per-call model override. When set, the provider uses THIS model instead of
   * its configured default -- lets trivial short-text callers (inline "sparkle"
   * rewrites) pick a cheaper/faster model without changing the global default.
   * Providers that do not support per-call model selection ignore it.
   */
  model?: string
  /**
   * Observability tag grouping this call by subsystem (e.g. "jarvis", "seo").
   * Purely cosmetic - providers ignore it; only the tracing wrapper reads it.
   */
  feature?: string
  /** @internal see AiUsageReporter - injected by the tracing wrapper. */
  onUsage?: AiUsageReporter
}

// ---------------------------------------------------------------------------
// Tool calling (optional capability)
// ---------------------------------------------------------------------------

/**
 * One tool the model may call, described by a JSON-Schema parameter object.
 * Provider-agnostic on purpose: an implementation translates this into whatever
 * its vendor expects (OpenAI `tools[].function`, Anthropic `tools`, …).
 */
export type AiToolDefinition = {
  /** Stable tool name the model calls (e.g. "lookupOrder"). */
  name: string
  /** What the tool does and WHEN to use it — the model reads only this. */
  description: string
  /** JSON Schema (type: "object") describing the tool's arguments. */
  parameters: Record<string, unknown>
}

/** One tool invocation the model asked for. */
export type AiToolCall = {
  /** Provider-side call id; echoed back with the result. */
  id: string
  name: string
  /** Parsed arguments — `{}` when the model sent nothing or invalid JSON. */
  arguments: Record<string, unknown>
}

/** A tool call and whatever the caller's executor returned for it. */
export type AiToolExecution = { call: AiToolCall; result: unknown }

/**
 * Options for a tool-enabled run. Everything `generate` takes, plus the tool
 * catalog, the executor, and a HARD cap on model<->tool rounds.
 */
export type AiToolRunOptions = AiTextGenerateOptions & {
  /** The only tools the model may call in this run. */
  tools: AiToolDefinition[]
  /**
   * Execute ONE tool call and return its JSON-serializable result. It MUST NOT
   * throw — return an error payload (`{ error: "..." }`) instead, so a failing
   * tool degrades the answer rather than the run.
   */
  execute: (call: AiToolCall) => Promise<unknown>
  /** Max model completions in the loop (implementation caps it too). */
  maxRounds?: number
}

/** The outcome of a tool-enabled run. */
export type AiToolRunResult = {
  /** The model's final natural-language answer ("" if it never produced one). */
  text: string
  /**
   * Model completions actually consumed (always >= 1). This is the unit of AI
   * spend for the run — one round == one billable `ai_text` unit.
   */
  rounds: number
  /** Every tool call executed, in order. */
  executions: AiToolExecution[]
  /** True when the round cap stopped the loop before a final answer. */
  truncated: boolean
}

/**
 * A text-generation provider. `generate` resolves to the raw model message
 * string (JSON text when `opts.json` is set). Implementations decide their own
 * error contract; the OpenAI provider throws a clean Error the caller catches.
 *
 * TOOLS are an OPTIONAL capability: a provider that cannot call tools simply
 * leaves `supportsTools` false / `runTools` undefined, and callers fall back to
 * plain `generate` (see `messaging/ai-reply`). No call site has to know which
 * vendor is configured.
 */
export interface AiTextProvider {
  /** Stable provider name (e.g. "openai"). */
  readonly name: string
  /** Whether the provider has the config it needs to run (e.g. an API key). */
  isConfigured(): boolean
  /** Generate text for `prompt`, honoring `opts`. */
  generate(prompt: string, opts?: AiTextGenerateOptions): Promise<string>
  /** CAPABILITY FLAG: true only when `runTools` is implemented. */
  readonly supportsTools?: boolean
  /**
   * Generate an answer, letting the model call `opts.tools` (executed by
   * `opts.execute`) until it produces a final text answer or the round cap is
   * hit. Present only when `supportsTools` is true.
   */
  runTools?(prompt: string, opts: AiToolRunOptions): Promise<AiToolRunResult>
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
  system?: string  /** Observability tag grouping this call by subsystem. Providers ignore it. */
  feature?: string
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
  system?: string  /** Observability tag grouping this call by subsystem. Providers ignore it. */
  feature?: string
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
