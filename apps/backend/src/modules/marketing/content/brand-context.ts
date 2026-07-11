import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"
import type { CommerceProduct } from "../gateway"

/**
 * brand-context — builds the SYSTEM-PROMPT grounding block for content
 * generation.
 *
 * Two jobs, both commerce-native:
 *   1. Brand voice: load the tenant's tone / do / don't rules (an explicit
 *      `brandVoiceId`, else the default row) so copy sounds on-brand.
 *   2. Product facts: pull each referenced product through the CommerceGateway
 *      and surface title / description / price as *facts the model may use* —
 *      paired with a hard ANTI-INVENTION rule so the model never fabricates
 *      prices or availability.
 *
 * NO-THROW: this is a pure string builder used on the live request path. Any
 * lookup failure is swallowed and simply omitted from the block; the worst case
 * is a thinner prompt, never a crash.
 */

/** Options controlling what grounding is loaded into the block. */
export type BrandContextOptions = {
  /** Explicit brand voice row id; when absent the tenant default is used. */
  brandVoiceId?: string
  /** Product ids to surface as usable facts. */
  productIds?: string[]
}

/** Coerce an unknown json value into a clean list of non-empty strings. */
const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
      .filter((v) => v.length > 0)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

/** Render a product's usable facts as a single compact line. */
const productFactLine = (product: CommerceProduct): string => {
  const parts: string[] = []
  if (product.title) {
    parts.push(`title: ${product.title}`)
  }
  if (product.description) {
    // Keep descriptions short so one product does not dominate the prompt.
    const desc = product.description.replace(/\s+/g, " ").trim().slice(0, 400)
    if (desc) {
      parts.push(`description: ${desc}`)
    }
  }
  if (typeof product.price === "number") {
    const currency = product.currency_code
      ? product.currency_code.toUpperCase()
      : ""
    parts.push(`price: ${product.price}${currency ? ` ${currency}` : ""}`)
  }
  if (product.status) {
    parts.push(`status: ${product.status}`)
  }
  return `- ${parts.join(" | ")}`
}

/**
 * Build the grounding SYSTEM prompt for a generation call. Always returns a
 * string (possibly a minimal default) — never throws.
 */
export const buildBrandContext = async (
  container: MedusaContainer,
  tenantId: string,
  opts: BrandContextOptions = {}
): Promise<string> => {
  const sections: string[] = []

  sections.push(
    "You are an expert social-media and marketing copywriter for an e-commerce brand. " +
      "Write clear, engaging, platform-appropriate copy."
  )

  // --- Brand voice ---------------------------------------------------------
  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    let voice: any = null

    if (opts.brandVoiceId) {
      const rows = await mk.listMarketingBrandVoices(
        { tenant_id: tenantId, id: opts.brandVoiceId },
        { take: 1 }
      )
      voice = rows?.[0] ?? null
    }

    if (!voice) {
      const rows = await mk.listMarketingBrandVoices(
        { tenant_id: tenantId, is_default: true },
        { take: 1 }
      )
      voice = rows?.[0] ?? null
    }

    if (!voice) {
      const rows = await mk.listMarketingBrandVoices(
        { tenant_id: tenantId },
        { take: 1 }
      )
      voice = rows?.[0] ?? null
    }

    if (voice) {
      const voiceLines: string[] = []
      if (voice.name) {
        voiceLines.push(`Brand voice: ${voice.name}.`)
      }
      const tone = toStringList(voice.tone)
      if (tone.length) {
        voiceLines.push(`Tone: ${tone.join(", ")}.`)
      }
      const doRules = toStringList(voice.do_rules)
      if (doRules.length) {
        voiceLines.push(`Always: ${doRules.join("; ")}.`)
      }
      const dontRules = toStringList(voice.dont_rules)
      if (dontRules.length) {
        voiceLines.push(`Never: ${dontRules.join("; ")}.`)
      }
      if (voice.sample_copy) {
        voiceLines.push(`Example of on-brand copy: ${voice.sample_copy}`)
      }
      if (voice.language) {
        voiceLines.push(`Write in language: ${voice.language}.`)
      }
      if (voiceLines.length) {
        sections.push(voiceLines.join("\n"))
      }
    }
  } catch {
    // No-throw: a missing / failing brand voice simply thins the prompt.
  }

  // --- Product facts -------------------------------------------------------
  const productIds = (opts.productIds ?? []).filter(
    (id) => typeof id === "string" && id.length > 0
  )
  if (productIds.length) {
    const factLines: string[] = []
    try {
      const gateway = getCommerceGateway(container)
      for (const id of productIds) {
        try {
          const product = await gateway.getProduct(tenantId, id)
          if (product) {
            factLines.push(productFactLine(product))
          }
        } catch {
          // Skip a single unresolved product; keep the rest.
        }
      }
    } catch {
      // No-throw: gateway resolution failure yields no facts.
    }

    if (factLines.length) {
      sections.push(
        "Facts you may use (never invent prices, availability, discounts, or product " +
          "details not listed here):\n" +
          factLines.join("\n")
      )
    }
  }

  // --- Hard anti-invention rule -------------------------------------------
  sections.push(
    "IMPORTANT: Do not invent or guess prices, discounts, stock/availability, " +
      "shipping terms, or any product claim not grounded in the facts above. If a " +
      "detail is unknown, omit it rather than fabricate it."
  )

  return sections.join("\n\n")
}

export default buildBrandContext
