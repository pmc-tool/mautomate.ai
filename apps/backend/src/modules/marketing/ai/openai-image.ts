import type {
  AiImageGenerateOptions,
  AiImageProvider,
  AiImageResult,
} from "./ai-provider"

/**
 * OpenAiImageProvider — the OpenAI `gpt-image-1` backed `AiImageProvider`.
 *
 * Config (env):
 *   - OPENAI_API_KEY — required; presence gates `isConfigured()`.
 *
 * Two production entrypoints:
 *   - `generate(prompt, opts)` — text-to-image via `/v1/images/generations`.
 *   - `editProductImage(url, prompt, size)` — image EDIT via `/v1/images/edits`,
 *     passing the real product image so the product stays faithful rather than
 *     being hallucinated. This is the preferred path for on-brand product ads.
 *
 * ERROR CONTRACT: both methods NEVER leak a raw network/transport error. On any
 * failure (unconfigured, non-2xx, malformed body) they throw a single clean
 * `Error`. Callers in the studio wrap this and degrade gracefully.
 */

/** Sizes `gpt-image-1` accepts today. Requests are mapped to the nearest. */
const SUPPORTED_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const

type SupportedSize = (typeof SUPPORTED_SIZES)[number]

/** Parse a "WxH" size string into numbers, or null when malformed. */
const parseSize = (size?: string): { w: number; h: number } | null => {
  if (!size) {
    return null
  }
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim())
  if (!match) {
    return null
  }
  const w = Number(match[1])
  const h = Number(match[2])
  if (!w || !h) {
    return null
  }
  return { w, h }
}

/**
 * Map an arbitrary requested size to the nearest supported `gpt-image-1` size by
 * aspect ratio (square / portrait / landscape). Defaults to square.
 */
export const mapToSupportedSize = (size?: string): SupportedSize => {
  const parsed = parseSize(size)
  if (!parsed) {
    return "1024x1024"
  }
  const ratio = parsed.w / parsed.h
  let best: SupportedSize = "1024x1024"
  let bestDelta = Infinity
  for (const candidate of SUPPORTED_SIZES) {
    const [cw, ch] = candidate.split("x").map(Number)
    const delta = Math.abs(cw / ch - ratio)
    if (delta < bestDelta) {
      bestDelta = delta
      best = candidate
    }
  }
  return best
}

export class OpenAiImageProvider implements AiImageProvider {
  readonly name = "openai-image"

  /** Configured when an API key is present in the environment. */
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  /**
   * Text-to-image generation. Returns one result per requested image, each
   * carrying inline base64 bytes. Throws a clean Error on any failure.
   */
  async generate(
    prompt: string,
    opts: AiImageGenerateOptions = {}
  ): Promise<AiImageResult[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "[marketing] OpenAiImageProvider: OPENAI_API_KEY is not set"
      )
    }

    const body = {
      model: "gpt-image-1",
      prompt,
      size: mapToSupportedSize(opts.size),
      n: typeof opts.count === "number" && opts.count > 0 ? opts.count : 1,
    }

    try {
      const resp = await fetch(
        "https://api.openai.com/v1/images/generations",
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
        throw new Error(`OpenAI returned ${resp.status}`)
      }

      const data = (await resp.json()) as any
      const items: unknown[] = Array.isArray(data?.data) ? data.data : []
      const results: AiImageResult[] = items
        .map((item: any) => {
          const b64: unknown = item?.b64_json
          const url: unknown = item?.url
          if (typeof b64 === "string" && b64.length > 0) {
            return { b64 } as AiImageResult
          }
          if (typeof url === "string" && url.length > 0) {
            return { url } as AiImageResult
          }
          return null
        })
        .filter((r): r is AiImageResult => r !== null)

      if (results.length === 0) {
        throw new Error("empty image response")
      }
      return results
    } catch (e) {
      throw new Error(
        `[marketing] OpenAiImageProvider: image generation failed (${
          e instanceof Error ? e.message : String(e)
        })`
      )
    }
  }
}

/**
 * editProductImage — image EDIT so the REAL product is preserved.
 *
 * Downloads the product image, then POSTs it (multipart) to `/v1/images/edits`
 * alongside `prompt`, asking the model to keep the product and restyle the
 * scene. Returns a single `{ b64 }` result. Throws a clean Error on failure.
 */
export const editProductImage = async (
  productImageUrl: string,
  prompt: string,
  size?: string
): Promise<AiImageResult> => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("[marketing] editProductImage: OPENAI_API_KEY is not set")
  }

  try {
    const imgResp = await fetch(productImageUrl)
    if (!imgResp.ok) {
      throw new Error(`failed to download product image (${imgResp.status})`)
    }
    const contentType = imgResp.headers.get("content-type") ?? "image/png"
    const bytes = Buffer.from(await imgResp.arrayBuffer())

    const form = new FormData()
    form.append("model", "gpt-image-1")
    form.append("prompt", prompt)
    form.append("size", mapToSupportedSize(size))
    form.append(
      "image",
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      "product.png"
    )

    const resp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!resp.ok) {
      throw new Error(`OpenAI returned ${resp.status}`)
    }

    const data = (await resp.json()) as any
    const first: any = Array.isArray(data?.data) ? data.data[0] : undefined
    const b64: unknown = first?.b64_json
    const url: unknown = first?.url
    if (typeof b64 === "string" && b64.length > 0) {
      return { b64 }
    }
    if (typeof url === "string" && url.length > 0) {
      return { url }
    }
    throw new Error("empty edit response")
  } catch (e) {
    throw new Error(
      `[marketing] editProductImage: product image edit failed (${
        e instanceof Error ? e.message : String(e)
      })`
    )
  }
}

export default OpenAiImageProvider
