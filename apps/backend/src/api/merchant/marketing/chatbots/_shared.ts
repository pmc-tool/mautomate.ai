/**
 * Shared plumbing for the MERCHANT chatbot routes (`_` prefix keeps Medusa's
 * file-router from mounting this as an endpoint).
 *
 * Two jobs, defined exactly once so create/update/train/test/data cannot drift:
 *   - `loadOwnedChatbot` — fail-closed tenant ownership. A row that does not
 *     exist, or whose tenant_id is not STRICTLY the caller's, 404s identically:
 *     a merchant can never confirm another tenant's bot id exists.
 *   - `parseChatbotFields` — validate + normalise the studio's editable surface
 *     (persona, appearance, feature toggles, dimensions) into a partial update.
 *     Only keys the caller actually sent appear in the result, so a PUT from one
 *     wizard step never clobbers a field owned by another step.
 */

import type { MedusaResponse } from "@medusajs/framework/http"
import type MarketingModuleService from "../../../../modules/marketing/service"

export const REPLY_MODES = ["draft", "auto"] as const
export const DATA_KINDS = ["faq", "url", "product_catalog", "file", "blog"] as const
export const POSITIONS = ["left", "right"] as const

/** Widget geometry bounds — mirrored by the wizard's sliders. */
const EMBED_WIDTH = { min: 300, max: 600, fallback: 420 }
const EMBED_HEIGHT = { min: 400, max: 900, fallback: 745 }

const MAX_INSTRUCTIONS = 8000
const MAX_SHORT_TEXT = 500

export const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * Load a chatbot and assert it belongs to the caller's tenant. Null-safe and
 * fail-closed: a missing row OR any tenant_id that is not strictly equal to the
 * caller's (incl. null/undefined) 404s and returns null.
 */
export const loadOwnedChatbot = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const chatbot = await (svc as any)
    .retrieveMarketingChatbot(id)
    .catch(() => null)
  if (!chatbot || chatbot.tenant_id !== tenantId) {
    res.status(404).json({ message: `Chatbot ${id} was not found` })
    return null
  }
  return chatbot
}

const clampInt = (
  value: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number }
): number => {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Trim to a nullable text column: "" and whitespace collapse to null. */
const nullableText = (value: unknown, max: number): string | null => {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s ? s.slice(0, max) : null
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export type ParsedFields =
  | { ok: true; data: Record<string, any> }
  | { ok: false; message: string }

/**
 * Validate the chatbot fields a merchant may set. Every key is OPTIONAL: only
 * what the body actually carries lands in `data`, so partial autosaves are safe.
 * `name` is validated when present but NOT required here — the create route
 * requires it, the update route does not.
 */
export const parseChatbotFields = (body: Record<string, any>): ParsedFields => {
  const b = body ?? {}
  const data: Record<string, any> = {}

  if (b.name !== undefined) {
    const name = String(b.name).trim()
    if (!name) {
      return { ok: false, message: "Chatbot `name` cannot be empty." }
    }
    data.name = name.slice(0, 200)
  }

  if (b.reply_mode !== undefined) {
    const replyMode = String(b.reply_mode).trim()
    if (!(REPLY_MODES as readonly string[]).includes(replyMode)) {
      return {
        ok: false,
        message: `Chatbot \`reply_mode\` must be one of: ${REPLY_MODES.join(", ")}.`,
      }
    }
    data.reply_mode = replyMode
  }

  if (b.position !== undefined) {
    const position = String(b.position).trim()
    if (!(POSITIONS as readonly string[]).includes(position)) {
      return {
        ok: false,
        message: `Chatbot \`position\` must be one of: ${POSITIONS.join(", ")}.`,
      }
    }
    data.position = position
  }

  if (b.color !== undefined) {
    const color = String(b.color).trim()
    if (!HEX_COLOR.test(color)) {
      return {
        ok: false,
        message: "Chatbot `color` must be a hex colour such as #017BE5.",
      }
    }
    data.color = color.toUpperCase()
  }

  // Free text.
  if (b.greeting !== undefined) data.greeting = nullableText(b.greeting, MAX_SHORT_TEXT)
  if (b.welcome_message !== undefined) {
    data.welcome_message = nullableText(b.welcome_message, MAX_SHORT_TEXT)
  }
  if (b.bubble_message !== undefined) {
    data.bubble_message = nullableText(b.bubble_message, MAX_SHORT_TEXT)
  }
  if (b.instructions !== undefined) {
    data.instructions = nullableText(b.instructions, MAX_INSTRUCTIONS)
  }
  if (b.language !== undefined) data.language = nullableText(b.language, 50)
  if (b.avatar !== undefined) data.avatar = nullableText(b.avatar, 1000)
  if (b.agent_id !== undefined) data.agent_id = b.agent_id ?? null

  // Booleans — an explicit `=== true` so "false" strings cannot enable a flag.
  const bools = [
    "active",
    "dont_go_beyond",
    "show_logo",
    "show_datetime",
    "collect_email",
    "allow_attachments",
    "allow_emoji",
  ] as const
  for (const key of bools) {
    if (b[key] !== undefined) data[key] = b[key] === true
  }

  if (b.embed_width !== undefined) {
    data.embed_width = clampInt(b.embed_width, EMBED_WIDTH)
  }
  if (b.embed_height !== undefined) {
    data.embed_height = clampInt(b.embed_height, EMBED_HEIGHT)
  }

  if (b.channel_config !== undefined) {
    data.channel_config = b.channel_config ?? null
  }

  return { ok: true, data }
}
