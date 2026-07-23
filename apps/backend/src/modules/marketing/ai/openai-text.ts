import type {
  AiTextGenerateOptions,
  AiTextProvider,
  AiToolCall,
  AiToolExecution,
  AiToolRunOptions,
  AiToolRunResult,
  AiUsageReporter,
} from "./ai-provider"

/**
 * OpenAiTextProvider — the OpenAI chat-completions backed `AiTextProvider`.
 *
 * Config (env):
 *   - OPENAI_API_KEY        — required; presence gates `isConfigured()`.
 *   - MARKETING_TEXT_MODEL  — chat model, defaults to "gpt-4o-mini".
 *
 * ERROR CONTRACT: `generate` NEVER leaks a raw network error. On any failure
 * (unconfigured, non-2xx, malformed body, transport error) it throws a single
 * clean `Error` after exhausting a small retry budget. Callers in the content
 * engine wrap this in try/catch and fall back to a non-AI path, so the live
 * request never crashes.
 *
 * TOOLS (`supportsTools` / `runTools`): the provider can hand the model a tool
 * catalog and run the classic tool loop — completion -> tool_calls -> execute ->
 * feed results back -> repeat until the model answers in prose. The loop is
 * BOUNDED on every axis: at most `maxRounds` completions (default 4, hard-capped
 * at MAX_TOOL_ROUNDS), at most MAX_CALLS_PER_ROUND tools per round, each tool
 * result truncated to MAX_TOOL_RESULT_CHARS, and each completion capped by
 * `maxTokens`. It can never spin forever and it can never grow the context
 * without bound. A tool executor NEVER throws (contract of `AiToolRunOptions`),
 * so a failing tool becomes a result the model reads, not a failed run.
 */

/**
 * Which OpenAI-compatible backend serves the chat assistant.
 *
 * Preference order (first configured wins):
 *   1. Novita  — same provider as the voice agents; cheap, already paid for.
 *   2. OpenAI  — if a key is set and Novita is not.
 *
 * `CHAT_AI_PROVIDER=openai` forces OpenAI even when Novita is available.
 */
const useNovita = (): boolean => {
  if (process.env.CHAT_AI_PROVIDER === "openai") return false
  if (process.env.CHAT_AI_PROVIDER === "novita") return true
  return !!process.env.NOVITA_API_KEY
}

const chatApiKey = (): string | undefined =>
  useNovita() ? process.env.NOVITA_API_KEY : process.env.OPENAI_API_KEY

const chatBaseUrl = (): string =>
  useNovita() ? "https://api.novita.ai/v3/openai" : "https://api.openai.com/v1"

/** Default chat model — depends on which backend is serving (see useNovita). */
const DEFAULT_MODEL_OPENAI = "gpt-4o-mini"
const DEFAULT_MODEL_NOVITA = "moonshotai/kimi-k2.7-code"
const DEFAULT_MODEL = ""

/** Total attempts (1 initial + retries) for a single generate call. */
const MAX_ATTEMPTS = 2

/** Base backoff between attempts, in ms (grows linearly per attempt). */
const BACKOFF_MS = 400

/** Absolute ceiling on model completions in one tool run (never exceeded). */
const MAX_TOOL_ROUNDS = 4

/** Tool calls honored in a single round (extra ones are dropped, not executed). */
const MAX_CALLS_PER_ROUND = 4

/** Serialized tool result is truncated to this many chars before it re-enters the context. */
const MAX_TOOL_RESULT_CHARS = 4000

/** Default per-completion token cap inside a tool run. */
const DEFAULT_TOOL_MAX_TOKENS = 700

/** Sleep helper for backoff between retries. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** The chat model in use (env-overridable). */
const chatModel = (): string =>
  process.env.MARKETING_TEXT_MODEL ?? (useNovita() ? DEFAULT_MODEL_NOVITA : DEFAULT_MODEL_OPENAI)

/**
 * Cheap/fast model for TRIVIAL short-text (inline "sparkle" rewrites: shorten,
 * punch-up, hashtags, translate). Novita-only: an 8B instruct model is ~10-40x
 * cheaper than Kimi-K2 and more than good enough for a one-line rewrite. On the
 * OpenAI backend (or when unset) it returns undefined, so the caller falls back
 * to the default chat model -- a Novita id is never sent to OpenAI. Override the
 * model via MARKETING_SPARKLE_MODEL.
 */
export const cheapTextModel = (): string | undefined =>
  useNovita()
    ? process.env.MARKETING_SPARKLE_MODEL || "meta-llama/llama-3.1-8b-instruct"
    : undefined

/** Serialize a tool result for the model, bounded in size. */
const serializeToolResult = (result: unknown): string => {
  let text: string
  try {
    text = JSON.stringify(result ?? null)
  } catch {
    text = JSON.stringify({ error: "tool result could not be serialized" })
  }
  return text.length > MAX_TOOL_RESULT_CHARS
    ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}...(truncated)`
    : text
}

/** Parse a tool_call's arguments; malformed JSON degrades to `{}`. */
const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== "string" || !raw.trim()) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export class OpenAiTextProvider implements AiTextProvider {
  readonly name = "openai"

  /** This provider implements the tool loop (see `runTools`). */
  readonly supportsTools = true

  /**
   * Configured when ANY OpenAI-compatible key is present.
   *
   * Novita speaks the same wire protocol (chat/completions + tool calling), so
   * the chat assistant can run on Kimi — the same engine as the voice agents —
   * instead of a separate OpenAI account that can silently run out of quota and
   * take the whole chat down (exactly what happened).
   */
  isConfigured(): boolean {
    return !!chatApiKey()
  }

  /**
   * POST one chat-completion. Retries a 429/5xx once; a 4xx fails fast. Returns
   * the raw `choices[0].message` object. Throws a clean Error on failure.
   */
  private async complete(
    body: Record<string, unknown>,
    onUsage?: AiUsageReporter
  ): Promise<any> {
    const apiKey = chatApiKey()
    if (!apiKey) {
      throw new Error("[marketing] chat AI: no OPENAI_API_KEY or NOVITA_API_KEY set")
    }

    let lastError: unknown = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch(`${chatBaseUrl()}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        })

        if (!resp.ok) {
          lastError = new Error(
            `[marketing] OpenAiTextProvider: OpenAI returned ${resp.status}`
          )
          // 4xx (except 429) will not improve on retry — fail fast.
          if (resp.status !== 429 && resp.status < 500) {
            break
          }
        } else {
          const data = (await resp.json()) as any
          const message = data?.choices?.[0]?.message
          if (message && typeof message === "object") {
            // Best-effort observability: report the resolved model + token usage
            // (OpenAI/Novita return `usage` alongside `choices`). NEVER throws.
            if (onUsage) {
              try {
                const u = data?.usage ?? {}
                onUsage({
                  model:
                    typeof data?.model === "string"
                      ? data.model
                      : (body.model as string | undefined),
                  usage: {
                    promptTokens: u.prompt_tokens,
                    completionTokens: u.completion_tokens,
                    totalTokens: u.total_tokens,
                  },
                })
              } catch {
                /* usage reporting must never affect the call */
              }
            }
            return message
          }
          lastError = new Error(
            "[marketing] OpenAiTextProvider: empty completion content"
          )
        }
      } catch (e) {
        lastError = e
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_MS * attempt)
      }
    }

    throw new Error(
      `[marketing] OpenAiTextProvider: text generation failed (${
        lastError instanceof Error ? lastError.message : String(lastError)
      })`
    )
  }

  /**
   * Generate a completion for `prompt`. Returns the assistant message content
   * as a string (JSON text when `opts.json` is set). Throws a clean Error on any
   * failure after the retry budget is exhausted.
   */
  async generate(
    prompt: string,
    opts: AiTextGenerateOptions = {}
  ): Promise<string> {
    const messages: Array<Record<string, unknown>> = []
    if (opts.system) {
      messages.push({ role: "system", content: opts.system })
    }
    messages.push({ role: "user", content: prompt })

    const body: Record<string, unknown> = {
      // Per-call override wins (trivial short-text can pick a cheaper model);
      // otherwise fall back to the configured default. runTools deliberately
      // does NOT honor this -- agentic tool-calling stays on the default brain.
      model: opts.model || chatModel(),
      messages,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.7,
    }
    if (typeof opts.maxTokens === "number") {
      body.max_tokens = opts.maxTokens
    }
    if (opts.json) {
      body.response_format = { type: "json_object" }
    }

    const message = await this.complete(body, opts.onUsage)
    const content: unknown = message?.content
    if (typeof content === "string" && content.length > 0) {
      return content
    }
    throw new Error(
      "[marketing] OpenAiTextProvider: text generation failed (empty completion content)"
    )
  }

  /**
   * Run the model with tools until it answers in prose or the round cap is hit.
   *
   * Each iteration is ONE billable completion. A completion that returns
   * `tool_calls` is executed through `opts.execute` (which never throws) and the
   * results are appended as `role: "tool"` messages; a completion that returns
   * content ends the loop. If the cap is reached while the model is still calling
   * tools, we do NOT silently return an empty answer: the loop makes one final
   * completion with the tools withheld, so the model must answer from what it has
   * (that final completion is counted in `rounds` too).
   */
  async runTools(
    prompt: string,
    opts: AiToolRunOptions
  ): Promise<AiToolRunResult> {
    const maxRounds = Math.max(
      1,
      Math.min(opts.maxRounds ?? MAX_TOOL_ROUNDS, MAX_TOOL_ROUNDS)
    )

    const tools = (opts.tools ?? []).map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    const messages: Array<Record<string, unknown>> = []
    if (opts.system) {
      messages.push({ role: "system", content: opts.system })
    }
    messages.push({ role: "user", content: prompt })

    const executions: AiToolExecution[] = []
    let rounds = 0
    let truncated = false

    const baseBody = (): Record<string, unknown> => ({
      model: chatModel(),
      messages,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.3,
      max_tokens: opts.maxTokens ?? DEFAULT_TOOL_MAX_TOKENS,
    })

    while (rounds < maxRounds) {
      const body = baseBody()
      if (tools.length) {
        body.tools = tools
        body.tool_choice = "auto"
      }

      const message = await this.complete(body, opts.onUsage)
      rounds += 1

      const toolCalls: any[] = Array.isArray(message?.tool_calls)
        ? message.tool_calls
        : []

      if (!toolCalls.length) {
        const content = typeof message?.content === "string" ? message.content : ""
        return { text: content.trim(), rounds, executions, truncated: false }
      }

      // The assistant turn that requested the tools must stay in the context,
      // otherwise the tool results have nothing to attach to.
      const honored = toolCalls.slice(0, MAX_CALLS_PER_ROUND)
      messages.push({
        role: "assistant",
        content: message?.content ?? null,
        tool_calls: honored,
      })

      for (const raw of honored) {
        const call: AiToolCall = {
          id: String(raw?.id ?? ""),
          name: String(raw?.function?.name ?? ""),
          arguments: parseArgs(raw?.function?.arguments),
        }
        // Contract: `execute` never throws. The catch is belt-and-braces so a
        // misbehaving executor degrades this one tool, not the whole run.
        const result = await Promise.resolve(opts.execute(call)).catch(
          (e: any) => ({
            error: `tool execution failed: ${e?.message ?? "unknown error"}`,
          })
        )
        executions.push({ call, result })
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: serializeToolResult(result),
        })
      }

      // Cap reached while still calling tools -> force a final, tool-free answer.
      if (rounds >= maxRounds) {
        truncated = true
        const finalMessage = await this.complete(baseBody(), opts.onUsage)
        rounds += 1
        const content =
          typeof finalMessage?.content === "string" ? finalMessage.content : ""
        return { text: content.trim(), rounds, executions, truncated }
      }
    }

    // Unreachable in practice (the loop always returns), kept for exhaustiveness.
    return { text: "", rounds, executions, truncated: true }
  }
}

export default OpenAiTextProvider
