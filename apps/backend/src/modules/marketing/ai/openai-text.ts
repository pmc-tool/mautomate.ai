import type { AiTextGenerateOptions, AiTextProvider } from "./ai-provider"

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
 */

/** Default chat model when `MARKETING_TEXT_MODEL` is unset. */
const DEFAULT_MODEL = "gpt-4o-mini"

/** Total attempts (1 initial + retries) for a single generate call. */
const MAX_ATTEMPTS = 2

/** Base backoff between attempts, in ms (grows linearly per attempt). */
const BACKOFF_MS = 400

/** Sleep helper for backoff between retries. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export class OpenAiTextProvider implements AiTextProvider {
  readonly name = "openai"

  /** Configured when an API key is present in the environment. */
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
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
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("[marketing] OpenAiTextProvider: OPENAI_API_KEY is not set")
    }

    const model = process.env.MARKETING_TEXT_MODEL ?? DEFAULT_MODEL

    const messages: Array<{ role: string; content: string }> = []
    if (opts.system) {
      messages.push({ role: "system", content: opts.system })
    }
    messages.push({ role: "user", content: prompt })

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.7,
    }
    if (typeof opts.maxTokens === "number") {
      body.max_tokens = opts.maxTokens
    }
    if (opts.json) {
      body.response_format = { type: "json_object" }
    }

    let lastError: unknown = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          }
        )

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
          const content: unknown = data?.choices?.[0]?.message?.content
          if (typeof content === "string" && content.length > 0) {
            return content
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
}

export default OpenAiTextProvider
