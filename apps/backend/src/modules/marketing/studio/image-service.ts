import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
import { MedusaContainer } from "@medusajs/framework/types"
import { uploadFilesWorkflow } from "@medusajs/core-flows"

import { tenantScopedUploadFilename } from "../../../lib/tenant-upload"
import { MARKETING_MODULE } from ".."
import { getCommerceGateway } from "../gateway"
import { getAiImageProvider } from "../ai/registry"
import { editProductImage } from "../ai/openai-image"
import { getPreset } from "./size-presets"

/**
 * image-service — the product-image studio pipeline.
 *
 * Two production paths, picked per request:
 *   1. COMPOSITE (deterministic, primary): `sharp` places the REAL product image
 *      onto a branded canvas at an exact size with headline/subtext overlays.
 *      Never hallucinates the product. `sharp` is lazy-required in a try/catch so
 *      a missing native binary DEGRADES (clean error) rather than crashing boot.
 *   2. AI (optional, gated): OpenAI `gpt-image-1`, preferring the image EDIT
 *      endpoint (product image as input) for fidelity. Gated by OPENAI_API_KEY.
 *
 * MULTI-TENANT: every persisted row and every gateway read is scoped by tenant.
 */

const currentTenantId = (): string =>
  getCurrentTenantId() ??
  // Fail-closed: an AI-generated asset must never land on the shared
  // "default" tenant key. Reject the write when no tenant is resolvable.
  resolveTenantId("MARKETING_DEFAULT_TENANT", { allowDefault: false })

/** One rendered + persisted studio image. */
export type GeneratedImageDto = {
  id: string
  url: string | null
  preset: string
  width: number
  height: number
}

/** Input to `compositeProductImage`. */
export type CompositeInput = {
  productImageUrl: string
  width: number
  height: number
  headline?: string
  subtext?: string
  bgColor?: string
  accentColor?: string
}

/** Input to `generateProductImages`. */
export type GenerateInput = {
  tenantId?: string
  productId: string
  presetKeys: string[]
  mode: "composite" | "ai"
  headline?: string
  subtext?: string
  prompt?: string
}

/**
 * Lazily load the native `sharp` binding. Wrapped so a deploy host without the
 * native binary degrades to a clean error instead of crashing on boot/import.
 */
const loadSharp = (): any => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("sharp")
  } catch {
    throw new Error(
      "[marketing] image compositing unavailable: the `sharp` native binary could not be loaded on this host"
    )
  }
}

/** Escape a string for safe interpolation into SVG/XML text. */
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

/** Download an image URL into a Buffer, throwing a clean error on failure. */
const fetchImageBuffer = async (url: string): Promise<Buffer> => {
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`failed to fetch product image (${resp.status})`)
  }
  return Buffer.from(await resp.arrayBuffer())
}

/** Build the branded background as an SVG buffer (subtle gradient). */
const buildBackgroundSvg = (
  width: number,
  height: number,
  bgColor: string,
  accentColor: string
): Buffer => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${escapeXml(bgColor)}"/>
      <stop offset="100%" stop-color="${escapeXml(accentColor)}" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(bgColor)}"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
</svg>`
  return Buffer.from(svg)
}

/** Build the text overlay (headline + subtext) as a full-canvas SVG buffer. */
const buildTextSvg = (
  width: number,
  height: number,
  accentColor: string,
  headline?: string,
  subtext?: string
): Buffer | null => {
  const trimmedHeadline = headline?.trim()
  const trimmedSubtext = subtext?.trim()
  if (!trimmedHeadline && !trimmedSubtext) {
    return null
  }

  const font =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  const headlineSize = Math.round(width * 0.06)
  const subtextSize = Math.round(width * 0.038)
  const pad = Math.round(width * 0.06)
  const bandHeight = Math.round(height * 0.26)
  const bandTop = height - bandHeight

  const headlineY = trimmedSubtext
    ? bandTop + Math.round(bandHeight * 0.5)
    : bandTop + Math.round(bandHeight * 0.6)
  const subtextY = headlineY + Math.round(headlineSize * 1.15)

  const parts: string[] = []
  parts.push(
    `<rect x="0" y="${bandTop}" width="${width}" height="${bandHeight}" fill="#000000" fill-opacity="0.45"/>`
  )
  if (trimmedHeadline) {
    parts.push(
      `<text x="${pad}" y="${headlineY}" font-family="${font}" font-size="${headlineSize}" font-weight="700" fill="#ffffff">${escapeXml(
        trimmedHeadline
      )}</text>`
    )
  }
  if (trimmedSubtext) {
    parts.push(
      `<text x="${pad}" y="${subtextY}" font-family="${font}" font-size="${subtextSize}" font-weight="600" fill="${escapeXml(
        accentColor
      )}">${escapeXml(trimmedSubtext)}</text>`
    )
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join(
    ""
  )}</svg>`
  return Buffer.from(svg)
}

/**
 * Composite the REAL product image onto a branded canvas at an exact size with
 * a headline/subtext overlay. Returns a PNG buffer. Throws a clean error when
 * `sharp` is unavailable or the product image cannot be fetched.
 */
export const compositeProductImage = async (
  _container: MedusaContainer,
  input: CompositeInput
): Promise<Buffer> => {
  const sharp = loadSharp()

  const { width, height, productImageUrl } = input
  const bgColor = input.bgColor?.trim() || "#0f172a"
  const accentColor = input.accentColor?.trim() || "#6366f1"

  const productRaw = await fetchImageBuffer(productImageUrl)

  // Resize the product to fit ~70% of the canvas (contain, transparent pad).
  const productBuffer = await sharp(productRaw)
    .resize({
      width: Math.round(width * 0.7),
      height: Math.round(height * 0.7),
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const backgroundSvg = buildBackgroundSvg(width, height, bgColor, accentColor)
  const textSvg = buildTextSvg(
    width,
    height,
    accentColor,
    input.headline,
    input.subtext
  )

  const composites: Array<{ input: Buffer; gravity?: string }> = [
    { input: productBuffer, gravity: "center" },
  ]
  if (textSvg) {
    composites.push({ input: textSvg, gravity: "north" })
  }

  return await sharp(backgroundSvg).composite(composites).png().toBuffer()
}

/** Format a representative price as a short display string, or undefined. */
const formatPrice = (
  price: number | null | undefined,
  currency: string | null | undefined
): string | undefined => {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return undefined
  }
  const code = (currency ?? "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(price)
  } catch {
    return `${price} ${code}`
  }
}

/**
 * Generate one studio image per requested preset for a store's OWN product.
 *
 * Resolves the real product (image url, title, price) via the commerce gateway,
 * then for each preset builds the image (composite → buffer, or AI edit/generate
 * → base64 → buffer), uploads it via `uploadFilesWorkflow`, persists a
 * `marketing_generated_image` row, and returns a DTO. A single preset failure is
 * collected and skipped so partial success still returns.
 */
export const generateProductImages = async (
  container: MedusaContainer,
  input: GenerateInput
): Promise<GeneratedImageDto[]> => {
  const tenantId = input.tenantId ?? currentTenantId()
  const { productId, presetKeys, mode } = input

  const gateway = getCommerceGateway(container)
  const product = await gateway.getProduct(tenantId, productId)
  if (!product) {
    throw new Error(`Product with id "${productId}" was not found`)
  }

  const productImageUrl = product.thumbnail ?? product.images?.[0] ?? null
  if (!productImageUrl) {
    throw new Error(
      `Product "${productId}" has no image to build a marketing image from`
    )
  }

  const headline = input.headline?.trim() || product.title || "New arrival"
  const subtext =
    input.subtext?.trim() || formatPrice(product.price, product.currency_code)

  // Resolve the AI provider up front so an unconfigured "ai" request fails fast.
  const aiProvider = mode === "ai" ? getAiImageProvider(tenantId) : null
  if (mode === "ai" && !aiProvider) {
    throw new Error("AI image provider not configured")
  }

  const svc: any = container.resolve(MARKETING_MODULE)
  const results: GeneratedImageDto[] = []

  for (const key of presetKeys) {
    const preset = getPreset(key)
    if (!preset) {
      continue
    }

    try {
      const { width, height } = preset
      let buffer: Buffer

      if (mode === "ai") {
        const size = `${width}x${height}`
        const basePrompt =
          input.prompt?.trim() ||
          `A premium, on-brand marketing image for "${headline}". Keep the product exactly as shown; restyle only the scene, lighting and background. Clean, high-end e-commerce look.`
        let b64: string | undefined
        try {
          const edited = await editProductImage(
            productImageUrl,
            basePrompt,
            size
          )
          b64 = edited.b64
        } catch {
          // Fall back to text-to-image when the edit path is unavailable.
          const generated = await aiProvider!.generate(basePrompt, {
            size,
            count: 1,
          })
          b64 = generated?.[0]?.b64
        }
        if (!b64) {
          throw new Error("AI provider returned no image bytes")
        }
        buffer = Buffer.from(b64, "base64")
      } else {
        buffer = await compositeProductImage(container, {
          productImageUrl,
          width,
          height,
          headline,
          subtext,
        })
      }

      const filename = tenantScopedUploadFilename(
        tenantId,
        `marketing-${productId}-${key}.png`
      )
      const { result: uploaded } = await uploadFilesWorkflow(container).run({
        input: {
          files: [
            {
              filename,
              mimeType: "image/png",
              content: buffer.toString("base64"),
              access: "public" as const,
            },
          ],
        },
      })

      const file = (uploaded as { id: string; url: string }[])[0]

      const [row] = await svc.createMarketingGeneratedImages([
        {
          tenant_id: tenantId,
          prompt: mode === "ai" ? input.prompt ?? null : null,
          provider: mode === "ai" ? "openai-image" : "composite",
          file_id: file?.id ?? null,
          url: file?.url ?? null,
          product_id: productId,
          params: { preset: key, mode, width, height },
        } as any,
      ])

      results.push({
        id: row.id,
        url: row.url ?? file?.url ?? null,
        preset: key,
        width,
        height,
      })
    } catch {
      // Collect what succeeds — skip this preset and continue.
      continue
    }
  }

  return results
}
