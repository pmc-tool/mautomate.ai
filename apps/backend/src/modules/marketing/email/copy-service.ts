/**
 * email/copy-service — AI-authored, brand-grounded email copy.
 *
 * `generateEmailCopy` produces `{ subject, preheader, bodyHtml }` for a marketing
 * email from a short brief. It is the copy counterpart to the content engine:
 *   - The SYSTEM prompt is `buildBrandContext(...)` (brand voice + grounded
 *     product FACTS + the hard anti-invention rule) with email-specific writing
 *     guidance appended, so the model only states facts about grounded products
 *     and stays on-brand.
 *   - Tenancy: the brief, brand voice, and product facts are all scoped by
 *     `tenantId`.
 *   - Graceful degradation: no configured AI provider → `needs_ai: true` with
 *     empty strings so the caller can fall back to a manual/editor flow.
 *   - NO-THROW: any parse/model failure returns `needs_ai: false` with empty
 *     strings rather than crashing the request path.
 *
 * The returned `bodyHtml` is intentionally simple, inline-safe HTML (`<p>`,
 * `<strong>`, an optional single CTA hint) suitable to hand straight to the
 * email layout / builders.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { getAiTextProvider } from "../ai/registry"
import { buildBrandContext } from "../content/brand-context"

/** Which kind of email we're writing (shapes the guidance + tone). */
export type EmailCopyKind = "broadcast" | "recovery" | "welcome"

/** Input for {@link generateEmailCopy}. */
export type GenerateEmailCopyInput = {
  /** Tenant scope for brand voice + product facts. */
  tenantId: string
  /** Free-text brief describing what the email should say. */
  brief: string
  /** Email kind; defaults to "broadcast". */
  kind?: EmailCopyKind
  /** Product ids to ground the copy against (surfaced as usable facts). */
  productIds?: string[]
  /** Explicit brand voice row id; defaults to the tenant default. */
  brandVoiceId?: string
  /** Optional first name to weave in naturally (may be a literal or token). */
  firstName?: string
}

/** Result of {@link generateEmailCopy}. */
export type GenerateEmailCopyResult = {
  /** Concise subject line (<= ~55 chars). */
  subject: string
  /** Inbox preview snippet. */
  preheader: string
  /** Simple inline-safe HTML body. */
  bodyHtml: string
  /** True only when NO AI provider is configured (caller should fall back). */
  needs_ai: boolean
}

const EMPTY_NEEDS_AI: GenerateEmailCopyResult = {
  subject: "",
  preheader: "",
  bodyHtml: "",
  needs_ai: true,
}

const EMPTY_FAILED: GenerateEmailCopyResult = {
  subject: "",
  preheader: "",
  bodyHtml: "",
  needs_ai: false,
}

/** Per-kind steering appended to the writing guidance. */
const kindGuidance = (kind: EmailCopyKind): string => {
  switch (kind) {
    case "welcome":
      return (
        "This is a WELCOME email for a brand-new subscriber. Be warm and " +
        "inviting, set expectations, and point them to start shopping."
      )
    case "recovery":
      return (
        "This is an ABANDONED-CART recovery email. Be helpful, not pushy; " +
        "remind them what they left and make it easy to return. Only mention a " +
        "discount if one is present in the grounded facts."
      )
    case "broadcast":
    default:
      return (
        "This is a one-to-many BROADCAST (newsletter/announcement). Lead with " +
        "the single most interesting thing and keep it scannable."
      )
  }
}

/**
 * Best-effort JSON parse of a model response: handles a bare object, a
 * ```json fenced block, or prose surrounding a `{ ... }` object. Returns `{}`
 * when nothing parseable is found.
 */
const parseJsonLoose = (raw: string): Record<string, unknown> => {
  const text = (raw ?? "").trim()
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    // fall through
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>
    } catch {
      // fall through
    }
  }
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    } catch {
      // fall through
    }
  }
  return {}
}

/** Coerce an unknown json value into a trimmed string. */
const toStr = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

/** Build the user prompt from the brief + kind + optional name. */
const buildUserPrompt = (input: GenerateEmailCopyInput): string => {
  const kind = input.kind ?? "broadcast"
  const lines: string[] = []
  lines.push(kindGuidance(kind))
  lines.push("")
  lines.push(`Brief: ${input.brief}`)
  if (input.firstName) {
    lines.push(
      `The recipient's first name is "${input.firstName}" — you may greet them by name once, naturally.`
    )
  }
  lines.push("")
  lines.push(
    "Write the email now. Respond with ONLY a JSON object of this exact shape:"
  )
  lines.push(
    '{ "subject": string, "preheader": string, "body_html": string }'
  )
  lines.push("")
  lines.push("Rules for the fields:")
  lines.push(
    "- subject: a concise, compelling subject line, at most ~55 characters. " +
      "No ALL CAPS, no spammy words (FREE, ACT NOW, !!!), at most one emoji."
  )
  lines.push(
    "- preheader: a short inbox-preview snippet (~40-90 chars) that complements " +
      "the subject rather than repeating it."
  )
  lines.push(
    "- body_html: simple, inline-safe HTML using only <p> and <strong> tags, a " +
      "few short scannable paragraphs, and ONE clear call to action phrased as " +
      "text (do not write an <a> tag or invent a URL). No <html>, <head>, " +
      "<style>, images, or scripts."
  )
  lines.push(
    "- Only state facts grounded in the brand/product facts above. Never invent " +
      "prices, discounts, availability, or product claims."
  )
  return lines.join("\n")
}

/**
 * Generate brand-grounded email copy. Tenant-scoped and NO-THROW: returns
 * `needs_ai: true` when no provider is configured, `needs_ai: false` with empty
 * strings on any failure, and the parsed copy on success.
 */
export const generateEmailCopy = async (
  container: MedusaContainer,
  input: GenerateEmailCopyInput
): Promise<GenerateEmailCopyResult> => {
  const provider = getAiTextProvider()
  if (!provider) {
    return { ...EMPTY_NEEDS_AI }
  }

  try {
    const brandContext = await buildBrandContext(container, input.tenantId, {
      brandVoiceId: input.brandVoiceId,
      productIds: input.productIds,
    })

    const system =
      brandContext +
      "\n\n" +
      "You are now writing a marketing EMAIL. Keep it concise and scannable, " +
      "with one clear call to action. Prefer plain, human language over hype. " +
      "Avoid spammy words and ALL CAPS (they hurt deliverability). Only state " +
      "facts grounded in the information above."

    const raw = await provider.generate(buildUserPrompt(input), {
      system,
      json: true,
      temperature: 0.6,
    })

    const parsed = parseJsonLoose(raw)
    const subject = toStr(parsed.subject)
    const preheader = toStr(parsed.preheader)
    const bodyHtml = toStr(parsed.body_html)

    return {
      subject,
      preheader,
      bodyHtml,
      needs_ai: false,
    }
  } catch {
    // NO-THROW: degrade to an empty result the caller can handle.
    return { ...EMPTY_FAILED }
  }
}

export default generateEmailCopy
