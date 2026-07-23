import type {
  AiImageGenerateOptions,
  AiImageProvider,
  AiImageResult,
  AiTextGenerateOptions,
  AiTextProvider,
  AiToolRunOptions,
  AiToolRunResult,
  AiUsage,
  AiVideoGenerateOptions,
  AiVideoProvider,
  AiVideoResult,
} from "./ai-provider"

/**
 * langfuse-trace — the single tracing wrapper for every AI provider call.
 *
 * WHY HERE: `registry.ts` is the one chokepoint every AI caller flows through.
 * The metered wrappers already run there; this composes a TRACING wrapper the
 * same way, so `tracedText(meteredText(base), { tenantId })` makes every text
 * call BOTH credit-metered AND reported to the self-hosted Langfuse — with zero
 * call-site edits. Image and video are wrapped the same way.
 *
 * SAFETY: tracing is best-effort and must NEVER affect the AI call. The client
 * is a lazy singleton that is a pure no-op when `LANGFUSE_ENABLED!=="1"` or the
 * keys are missing, construction never throws, and every trace operation is
 * wrapped so a Langfuse failure can never surface to the caller. Delivery is
 * fire-and-forget (`flushAsync`), so a slow/unreachable Langfuse never adds
 * latency to the model call.
 *
 * WHAT A TRACE CAPTURES (per call): a `trace` (name "ai.text.generate" /
 * "ai.text.runTools" / "ai.image" / "ai.video") with metadata `{ tenant_id,
 * feature }`, and a nested `generation` with input (prompt/messages, truncated),
 * output (result text, truncated), the resolved MODEL name, token USAGE
 * (prompt/completion/total) when the vendor returned it, and start/end times
 * (latency). For runTools the tool names, round count and truncation flag are
 * recorded too. tenant_id is the REAL request tenant threaded in by the caller
 * (see registry.ts COST-ATTRIBUTION INVARIANT) — never a boot-time env var — so
 * super-admin can attribute AI cost to the merchant who actually triggered it.
 */

/** Longest input/output string we send to Langfuse (keeps payloads bounded). */
const MAX_IO_CHARS = 8000

const truncate = (s: string): string =>
  typeof s === "string" && s.length > MAX_IO_CHARS
    ? `${s.slice(0, MAX_IO_CHARS)}...(truncated)`
    : s

// ---------------------------------------------------------------------------
// Lazy singleton Langfuse client
// ---------------------------------------------------------------------------

/** `undefined` = not yet resolved; `null` = disabled/unavailable (no-op). */
let _client: any | null | undefined = undefined

/**
 * Resolve the Langfuse client once. Returns null (tracing disabled) when the
 * feature flag is off, keys are missing, or the SDK can't be loaded — never
 * throws. `langfuse` is required lazily so it is only touched when tracing is on
 * and so a missing module degrades to "no tracing" rather than a boot crash.
 */
const getClient = (): any | null => {
  if (_client !== undefined) {
    return _client
  }
  try {
    if (process.env.LANGFUSE_ENABLED !== "1") {
      _client = null
      return null
    }
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY
    const secretKey = process.env.LANGFUSE_SECRET_KEY
    const baseUrl = process.env.LANGFUSE_HOST
    if (!publicKey || !secretKey) {
      _client = null
      return null
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Langfuse } = require("langfuse")
    _client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      // Small batch so short-lived request handlers deliver promptly; we also
      // flushAsync after each trace as belt-and-braces.
      flushAt: 1,
    })
    return _client
  } catch {
    _client = null
    return null
  }
}

/** Fire-and-forget flush; never throws, never awaited by the caller path. */
const flush = (lf: any): void => {
  try {
    lf?.flushAsync?.().catch(() => undefined)
  } catch {
    /* swallow */
  }
}

/** Map our provider usage shape onto Langfuse's generation usage shape. */
const toLangfuseUsage = (usage?: AiUsage) => {
  if (!usage) {
    return undefined
  }
  const { promptTokens, completionTokens, totalTokens } = usage
  if (
    promptTokens == null &&
    completionTokens == null &&
    totalTokens == null
  ) {
    return undefined
  }
  return {
    input: promptTokens,
    output: completionTokens,
    total: totalTokens,
    unit: "TOKENS" as const,
  }
}

type TraceCtx = { tenantId?: string }

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Wrap a text provider so `generate` and `runTools` each emit a Langfuse trace.
 * Passthrough (returns `inner` untouched behaviour) whenever tracing is off.
 */
export const tracedText = (
  inner: AiTextProvider,
  ctx: TraceCtx
): AiTextProvider => {
  const generate = async (
    prompt: string,
    opts?: AiTextGenerateOptions
  ): Promise<string> => {
    const lf = getClient()
    if (!lf) {
      return inner.generate(prompt, opts)
    }

    const feature = opts?.feature ?? "unknown"
    const startTime = new Date()
    // Providers report the resolved model + token usage through this hook; we
    // chain any pre-existing hook so we never clobber a caller's own.
    let reported: { model?: string; usage?: AiUsage } = {}
    const injected: AiTextGenerateOptions = {
      ...(opts ?? {}),
      onUsage: (info) => {
        reported = info
        try {
          opts?.onUsage?.(info)
        } catch {
          /* swallow */
        }
      },
    }

    let generation: any
    try {
      const trace = lf.trace({
        name: "ai.text.generate",
        input: truncate(prompt),
        userId: ctx.tenantId,
        metadata: { tenant_id: ctx.tenantId, feature },
        tags: ["ai", "text", feature].filter(Boolean) as string[],
      })
      generation = trace.generation({
        name: "ai.text.generate",
        startTime,
        input: opts?.system
          ? [
              { role: "system", content: truncate(opts.system) },
              { role: "user", content: truncate(prompt) },
            ]
          : truncate(prompt),
        metadata: { tenant_id: ctx.tenantId, feature },
      })
    } catch {
      /* tracing setup failed — run the call untraced */
      return inner.generate(prompt, injected)
    }

    try {
      const result = await inner.generate(prompt, injected)
      try {
        generation?.end({
          output: truncate(result),
          model: reported.model,
          usage: toLangfuseUsage(reported.usage),
        })
      } catch {
        /* swallow */
      }
      flush(lf)
      return result
    } catch (e: any) {
      try {
        generation?.end({
          model: reported.model,
          level: "ERROR",
          statusMessage: String(e?.message ?? e),
        })
      } catch {
        /* swallow */
      }
      flush(lf)
      throw e
    }
  }

  const canRunTools =
    inner.supportsTools === true && typeof inner.runTools === "function"

  const runTools = async (
    prompt: string,
    opts: AiToolRunOptions
  ): Promise<AiToolRunResult> => {
    const lf = getClient()
    if (!lf) {
      return inner.runTools!(prompt, opts)
    }

    const feature = opts?.feature ?? "unknown"
    const startTime = new Date()
    // One tool run makes SEVERAL completions; accumulate their usage.
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let sawUsage = false
    let model: string | undefined
    const injected: AiToolRunOptions = {
      ...opts,
      onUsage: (info) => {
        if (info.model) {
          model = info.model
        }
        if (info.usage) {
          sawUsage = true
          promptTokens += info.usage.promptTokens ?? 0
          completionTokens += info.usage.completionTokens ?? 0
          totalTokens += info.usage.totalTokens ?? 0
        }
        try {
          opts?.onUsage?.(info)
        } catch {
          /* swallow */
        }
      },
    }

    let generation: any
    try {
      const trace = lf.trace({
        name: "ai.text.runTools",
        input: truncate(prompt),
        userId: ctx.tenantId,
        metadata: {
          tenant_id: ctx.tenantId,
          feature,
          tools_available: (opts.tools ?? []).map((t) => t.name),
        },
        tags: ["ai", "text", "tools", feature].filter(Boolean) as string[],
      })
      generation = trace.generation({
        name: "ai.text.runTools",
        startTime,
        input: opts?.system
          ? [
              { role: "system", content: truncate(opts.system) },
              { role: "user", content: truncate(prompt) },
            ]
          : truncate(prompt),
        metadata: { tenant_id: ctx.tenantId, feature },
      })
    } catch {
      return inner.runTools!(prompt, injected)
    }

    try {
      const result = await inner.runTools!(prompt, injected)
      try {
        generation?.end({
          output: truncate(result.text),
          model,
          usage: sawUsage
            ? toLangfuseUsage({ promptTokens, completionTokens, totalTokens })
            : undefined,
          metadata: {
            tenant_id: ctx.tenantId,
            feature,
            rounds: result.rounds,
            truncated: result.truncated,
            tools_called: result.executions.map((e) => e.call.name),
          },
        })
      } catch {
        /* swallow */
      }
      flush(lf)
      return result
    } catch (e: any) {
      try {
        generation?.end({
          model,
          level: "ERROR",
          statusMessage: String(e?.message ?? e),
        })
      } catch {
        /* swallow */
      }
      flush(lf)
      throw e
    }
  }

  return {
    name: inner.name,
    isConfigured: () => inner.isConfigured(),
    generate,
    supportsTools: canRunTools,
    runTools: canRunTools ? runTools : undefined,
  }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

/** Wrap an image provider so each `generate` emits an "ai.image" trace. */
export const tracedImage = (
  inner: AiImageProvider,
  ctx: TraceCtx
): AiImageProvider => ({
  name: inner.name,
  isConfigured: () => inner.isConfigured(),
  generate: async (
    prompt: string,
    opts?: AiImageGenerateOptions
  ): Promise<AiImageResult[]> => {
    const lf = getClient()
    if (!lf) {
      return inner.generate(prompt, opts)
    }

    const feature = opts?.feature ?? "unknown"
    const startTime = new Date()
    let generation: any
    try {
      const trace = lf.trace({
        name: "ai.image",
        input: truncate(prompt),
        userId: ctx.tenantId,
        metadata: {
          tenant_id: ctx.tenantId,
          feature,
          size: opts?.size,
          count: opts?.count,
        },
        tags: ["ai", "image", feature].filter(Boolean) as string[],
      })
      generation = trace.generation({
        name: "ai.image",
        startTime,
        input: truncate(prompt),
        metadata: { tenant_id: ctx.tenantId, feature, size: opts?.size },
      })
    } catch {
      return inner.generate(prompt, opts)
    }

    try {
      const result = await inner.generate(prompt, opts)
      try {
        generation?.end({
          output: result.map((r) => r.url ?? (r.b64 ? "[b64]" : "[empty]")),
          metadata: {
            tenant_id: ctx.tenantId,
            feature,
            images: result.length,
          },
        })
      } catch {
        /* swallow */
      }
      flush(lf)
      return result
    } catch (e: any) {
      try {
        generation?.end({ level: "ERROR", statusMessage: String(e?.message ?? e) })
      } catch {
        /* swallow */
      }
      flush(lf)
      throw e
    }
  },
})

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

/** Wrap a video provider so each `generate` emits an "ai.video" trace. */
export const tracedVideo = (
  inner: AiVideoProvider,
  ctx: TraceCtx
): AiVideoProvider => ({
  name: inner.name,
  isConfigured: () => inner.isConfigured(),
  generate: async (
    prompt: string,
    opts?: AiVideoGenerateOptions
  ): Promise<AiVideoResult> => {
    const lf = getClient()
    if (!lf) {
      return inner.generate(prompt, opts)
    }

    const feature = opts?.feature ?? "unknown"
    const startTime = new Date()
    let generation: any
    try {
      const trace = lf.trace({
        name: "ai.video",
        input: truncate(prompt),
        userId: ctx.tenantId,
        metadata: {
          tenant_id: ctx.tenantId,
          feature,
          seconds: opts?.seconds,
          aspect_ratio: opts?.aspectRatio,
        },
        tags: ["ai", "video", feature].filter(Boolean) as string[],
      })
      generation = trace.generation({
        name: "ai.video",
        startTime,
        input: truncate(prompt),
        metadata: { tenant_id: ctx.tenantId, feature },
      })
    } catch {
      return inner.generate(prompt, opts)
    }

    try {
      const result = await inner.generate(prompt, opts)
      try {
        generation?.end({
          output: result.url ?? (result.jobId ? `job:${result.jobId}` : "[empty]"),
          metadata: { tenant_id: ctx.tenantId, feature, job_id: result.jobId },
        })
      } catch {
        /* swallow */
      }
      flush(lf)
      return result
    } catch (e: any) {
      try {
        generation?.end({ level: "ERROR", statusMessage: String(e?.message ?? e) })
      } catch {
        /* swallow */
      }
      flush(lf)
      throw e
    }
  },
})
