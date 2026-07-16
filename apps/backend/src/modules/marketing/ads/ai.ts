import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { getCommerceGateway } from "../gateway"
import { getAiTextProvider } from "../ai/registry"
import {
  animateImage,
  promptToImage,
  type Orientation,
} from "../ai/video-generator"

/**
 * AI ad generation — copy, image, and video for the campaign wizard, built on
 * the SAME engines already proven live elsewhere in the platform (the text
 * provider behind post generation, the Novita image/SVD-XT video pipeline
 * behind the CMS studio). Nothing here fabricates: every function either
 * returns a real generated asset (stored durably in the tenant's bucket) or
 * throws an honest error. Credit metering happens at the route layer.
 */

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const novitaKey = (): string => {
  const key = process.env.NOVITA_API_KEY
  if (!key) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Image generation isn't switched on yet (missing image engine key)."
    )
  }
  return key
}

/** Store bytes durably in the tenant's bucket; returns the public url. */
const store = async (
  container: MedusaContainer,
  tenantId: string,
  name: string,
  buf: Buffer,
  mime: string
): Promise<string> => {
  const { result } = await uploadFilesWorkflow(container as any).run({
    input: {
      files: [
        {
          filename: `${tenantId}/${name}`,
          mimeType: mime,
          content: buf.toString("base64"),
          access: "public",
        },
      ],
    },
  })
  const url = (result as any)?.[0]?.url
  if (!url) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The generated file could not be stored."
    )
  }
  return url
}

const fetchBytes = async (url: string): Promise<Buffer> => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`asset fetch failed (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

export type AdProductContext = {
  id: string | null
  title: string
  description: string
  price: string | null
  handle: string | null
  thumbnail: string | null
}

/** The product the ad is about (or a whole-store stand-in). */
export const adProductContext = async (
  container: MedusaContainer,
  tenantId: string,
  productId: string | null | undefined,
  storeName: string
): Promise<AdProductContext> => {
  if (!productId) {
    return {
      id: null,
      title: storeName,
      description: `${storeName} — an online store`,
      price: null,
      handle: null,
      thumbnail: null,
    }
  }
  const gateway = getCommerceGateway(container)
  const product = await gateway.getProduct(tenantId, productId)
  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "That product was not found in this store."
    )
  }
  return {
    id: product.id,
    title: product.title ?? "(untitled product)",
    description: (product.description ?? product.subtitle ?? "").slice(0, 600),
    price:
      product.price != null && product.currency_code
        ? `${product.price} ${product.currency_code.toUpperCase()}`
        : null,
    handle: product.handle,
    thumbnail: product.thumbnail ?? product.images?.[0] ?? null,
  }
}

export type AdCopyDraft = {
  headline: string
  primary_text: string
  alt_headlines: string[]
  alt_texts: string[]
  image_prompt: string
  audience_hint: string | null
}

/** Pull the first JSON object out of a model reply (tolerates prose/fences). */
const parseJsonReply = (raw: string): Record<string, any> => {
  const text = raw.replace(/```(?:json)?/g, "")
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The AI returned an unusable draft — try again."
    )
  }
  return JSON.parse(text.slice(start, end + 1))
}

/**
 * Draft the complete ad copy package for a product + goal. Throws honestly
 * when no text provider is configured — never returns fabricated filler.
 */
export const generateAdCopy = async (
  container: MedusaContainer,
  tenantId: string,
  input: {
    product: AdProductContext
    goal: "sales" | "traffic" | "awareness"
    instructions?: string | null
    storeName: string
  }
): Promise<AdCopyDraft> => {
  const provider = getAiTextProvider()
  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "AI writing isn't switched on yet (no text provider configured)."
    )
  }

  const goalLine =
    input.goal === "sales"
      ? "drive purchases (clear offer, urgency without being pushy)"
      : input.goal === "awareness"
        ? "make people remember the brand (bold, memorable, minimal hard-sell)"
        : "get clicks to the store (curiosity + concrete benefit)"

  const prompt = [
    `You are a senior performance-marketing copywriter. Write a paid social ad for the product below. Objective: ${goalLine}.`,
    ``,
    `Store: ${input.storeName}`,
    `Product: ${input.product.title}`,
    input.product.price ? `Price: ${input.product.price}` : ``,
    `About: ${input.product.description || "(no description)"}`,
    input.instructions ? `Merchant notes: ${input.instructions}` : ``,
    ``,
    `Reply with ONLY a JSON object, no other text:`,
    `{`,
    `  "headline": "max 6 words, punchy",`,
    `  "primary_text": "2-4 short sentences, ends with a call to action",`,
    `  "alt_headlines": ["two alternative headlines"],`,
    `  "alt_texts": ["one alternative primary text"],`,
    `  "image_prompt": "one sentence describing a scroll-stopping product photo scene for this ad (subject, setting, lighting, mood; no text in image)",`,
    `  "audience_hint": "one short sentence on who this ad should reach"`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n")

  const raw = await provider.generate(prompt, { maxTokens: 700 } as any)
  const parsed = parseJsonReply(String(raw ?? ""))

  const headline = String(parsed.headline ?? "").trim()
  const primaryText = String(parsed.primary_text ?? "").trim()
  if (!headline || !primaryText) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The AI returned an incomplete draft — try again."
    )
  }
  return {
    headline,
    primary_text: primaryText,
    alt_headlines: Array.isArray(parsed.alt_headlines)
      ? parsed.alt_headlines.map(String).slice(0, 3)
      : [],
    alt_texts: Array.isArray(parsed.alt_texts)
      ? parsed.alt_texts.map(String).slice(0, 2)
      : [],
    image_prompt: String(
      parsed.image_prompt ??
        `professional product photo of ${input.product.title}, studio lighting`
    ).trim(),
    audience_hint: parsed.audience_hint ? String(parsed.audience_hint) : null,
  }
}

/** Fetch a url/data-uri into a Gemini inline part. */
const toInlinePart = async (url: string): Promise<any> => {
  if (url.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(url)
    if (!m) throw new Error("bad image data")
    return { inline_data: { mime_type: m[1], data: m[2] } }
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`could not fetch the product photo (${r.status})`)
  const mime = r.headers.get("content-type")?.split(";")[0] || "image/png"
  return {
    inline_data: {
      mime_type: mime,
      data: Buffer.from(await r.arrayBuffer()).toString("base64"),
    },
  }
}

/**
 * Product-anchored scene generation (the Gemini image model — the same
 * subject-consistent engine the CMS studio runs in production). The
 * merchant's REAL product photo goes in and comes back placed in the ad
 * scene: an ad must never show a product the store does not sell, so
 * text-to-image is only for whole-store ads with no product to preserve.
 */
const geminiProductScene = async (
  productImageUrl: string,
  scenePrompt: string
): Promise<Buffer | null> => {
  const gkey = process.env.GEMINI_API_KEY
  if (!gkey) return null
  try {
    const imagePart = await toInlinePart(productImageUrl)
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image"
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gkey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                imagePart,
                {
                  text:
                    `Create a professional advertising photograph using the EXACT product from the provided photo — ` +
                    `same design, colors, materials, and proportions; do not redesign, restyle, or replace it. ` +
                    `Scene: ${scenePrompt}. No text, no logos, no watermark.`,
                },
              ],
            },
          ],
          generationConfig: { imageConfig: { aspectRatio: "1:1" } },
        }),
        signal: AbortSignal.timeout(120000),
      }
    )
    const d: any = await r.json().catch(() => ({}))
    if (!r.ok) return null
    for (const p of d?.candidates?.[0]?.content?.parts ?? []) {
      if (p?.inlineData?.data) return Buffer.from(p.inlineData.data, "base64")
    }
    return null
  } catch {
    return null
  }
}

export type AdImageResult = {
  image_url: string
  /** Which engine produced it — drives honest credit pricing at the route. */
  engine: "product_scene" | "text_to_image"
}

/**
 * Generate the ad image. With a product photo, the product-anchored engine is
 * REQUIRED to succeed (falling back to inventing a lookalike product would be
 * a misleading ad); text-to-image only serves whole-store ads.
 */
export const generateAdImage = async (
  container: MedusaContainer,
  tenantId: string,
  input: {
    prompt: string
    product_image_url?: string | null
    orientation?: Orientation
  }
): Promise<AdImageResult> => {
  if (input.product_image_url) {
    const bytes = await geminiProductScene(input.product_image_url, input.prompt)
    if (!bytes) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The image engine couldn't build the scene around your product photo — try again, adjust the scene description, or use the product photo itself."
      )
    }
    const url = await store(
      container,
      tenantId,
      `ad-image-${Date.now()}.jpg`,
      bytes,
      "image/jpeg"
    )
    return { image_url: url, engine: "product_scene" }
  }

  const key = novitaKey()
  const orientation = input.orientation ?? "square"
  const tempUrl = await promptToImage(
    key,
    `${input.prompt}. Advertising photography, high detail, no text, no watermark.`,
    orientation
  )
  const bytes = await fetchBytes(tempUrl)
  const url = await store(
    container,
    tenantId,
    `ad-image-${Date.now()}.jpg`,
    bytes,
    "image/jpeg"
  )
  return { image_url: url, engine: "text_to_image" }
}

/** Animate an ad image into a ~4s video clip; stored durably. */
export const generateAdVideo = async (
  container: MedusaContainer,
  tenantId: string,
  input: { image_url: string; orientation?: Orientation; motion?: number }
): Promise<{ video_url: string; poster_url: string }> => {
  const key = novitaKey()
  const orientation = input.orientation ?? "square"
  const tempUrl = await animateImage(key, input.image_url, orientation, {
    motion: input.motion ?? 90,
  })
  const bytes = await fetchBytes(tempUrl)
  const url = await store(
    container,
    tenantId,
    `ad-video-${Date.now()}.mp4`,
    bytes,
    "video/mp4"
  )
  return { video_url: url, poster_url: input.image_url }
}
