/**
 * DEFAULT STORE ASSISTANT — the chatbot every new mAutomate store is born with.
 *
 * Mirrors the call-center's `provisionDefaultAgent`: a non-technical merchant
 * should not have to build a bot before their storefront can answer a customer.
 * So provisioning creates one, live and answering, on day one:
 *
 *   - reply_mode "auto" (a "draft" bot never actually replies to a visitor —
 *     that is the merchant-facing default and it would leave the widget mute),
 *   - a `public_key` (minted exactly as the merchant create route does — it is
 *     what /tenant-config hands the storefront to mount the widget),
 *   - an ACTIVE `web_widget` channel binding (the on/off switch for the widget),
 *   - real knowledge: the store's live catalog + the store's own starter policy
 *     pages, then a training pass so it answers grounded from the first minute.
 *
 * IDEMPOTENT: if the tenant already has ANY chatbot, this does nothing. It never
 * touches, retrains, or clobbers a bot a merchant made.
 *
 * NEVER THROWS: it runs inside store provisioning. Every failure degrades to a
 * returned result ({ created: false, error }) — a chatbot problem must never cost
 * a merchant their store.
 */

import crypto from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"

import { STARTER_PAGES } from "../cms/starter-pages"
import { MARKETING_MODULE } from "."
import {
  PRODUCT_CATALOG_SOURCE,
  STORE_PAGE_PREFIX,
  applyStoreName,
  htmlToText,
} from "./knowledge/dynamic-sources"
import { embedChatbotSources } from "./knowledge/rag"

export type DefaultChatbotResult = {
  created: boolean
  chatbot_id?: string
  channel_id?: string
  sources?: number
  training_status?: string
  chunks?: number
  /** Why nothing was created (already had a bot, or a failure). */
  reason?: string
}

/**
 * The default assistant's system prompt.
 *
 * Written for a store that has JUST been created: it may have almost no
 * knowledge yet, so the prompt's first job is to keep the bot honest. It may
 * only speak from what it was trained on (catalog + the store's own pages), it
 * must refuse to invent order status, delivery dates, prices, or policies, and
 * it hands off to a human whenever it is not sure. A bot that says "I'll get a
 * human to confirm" costs the merchant nothing; a bot that invents a refund
 * policy costs them a chargeback.
 */
export const DEFAULT_ASSISTANT_INSTRUCTIONS = [
  "You are the store assistant for this online store. You talk to shoppers on the store's website.",
  "",
  "How you answer:",
  "- Be warm, brief and concrete. Two or three sentences is usually enough. Plain language, no jargon, no sales pressure.",
  "- Answer only from the store knowledge you were given (its product catalog and its published store pages) and from what the customer tells you in the conversation.",
  "- When you do not know something, say so plainly and offer to pass the question to the store's team. Never guess.",
  "",
  "What you must never do:",
  "- Never invent or estimate an order status, tracking number, delivery date or shipping time.",
  "- Never invent a price, a discount, a stock level or a product the catalog does not list.",
  "- Never invent a policy. If the store's pages do not state a return window, a refund rule or a shipping fee, say that you cannot confirm it and offer to connect the customer with the team.",
  "- Never ask for card details, passwords or any payment information.",
  "",
  "When a customer asks about a specific order, explain that you cannot look up order details from here, and offer to have someone from the store follow up. Ask for their order number and email so the team can find it.",
  "",
  "When a customer asks for a product, use the catalog: name the product, its price and whether it is in stock, and point them to its product page. If nothing in the catalog matches, say the store does not appear to carry it rather than suggesting something that does not exist.",
  "",
  "If the customer is upset, or asks for anything you cannot answer from the store's knowledge, apologise once, briefly, and offer to connect them with a person from the store.",
].join("\n")

/** Knowledge seeded on a brand-new store's assistant. */
type SeedSource = {
  kind: "faq" | "product_catalog"
  source: string
  content: string | null
}

/**
 * The seed set. Deliberately conservative:
 *
 *   - the LIVE product catalog (regenerated on every training run — see
 *     knowledge/dynamic-sources.ts), so the bot knows what the store sells,
 *   - one source per starter CMS page the tenant is seeded with (about, store
 *     location, contact, support policy, FAQs), referenced BY SLUG so a training
 *     run always re-reads the merchant's current page copy.
 *
 * NOTHING here is invented. The page text is the store's own published copy; at
 * provisioning time the tenant's pages do not exist yet (the CMS seed step runs
 * after the store bootstrap), so the row is seeded with the exact starter copy
 * those pages are about to be created with, and any later training run replaces
 * it with whatever the merchant has since published. No policy that the store has
 * not stated is ever put into the bot's mouth.
 */
const buildSeedSources = (storeName: string): SeedSource[] => {
  const sources: SeedSource[] = [
    {
      kind: "product_catalog",
      source: PRODUCT_CATALOG_SOURCE,
      // Rendered fresh at training time; this is only the fallback/placeholder.
      content: `The product catalog of ${storeName}. Regenerated from the store's live products every time this assistant is trained.`,
    },
  ]

  for (const page of STARTER_PAGES) {
    const body = applyStoreName(htmlToText(page.html), storeName)
    if (!body) {
      continue
    }
    sources.push({
      kind: "faq",
      source: `${STORE_PAGE_PREFIX}${page.slug}`,
      content: `Store page: ${page.title} (/${page.slug})\n\n${body}`,
    })
  }

  return sources
}

/**
 * Idempotently provision the default store assistant for a tenant.
 *
 * Skips entirely when the tenant already has a chatbot. Safe to call repeatedly
 * (provisioning, backfill, re-run) — it will only ever create one.
 */
export async function provisionDefaultChatbot(
  container: MedusaContainer,
  tenant: { id: string; name?: string | null }
): Promise<DefaultChatbotResult> {
  const tenantId = tenant?.id
  if (!tenantId) {
    return { created: false, reason: "no tenant id" }
  }

  try {
    const mk: any = container.resolve(MARKETING_MODULE)

    // GUARD: never a second bot, never a touched merchant bot.
    const existing = await mk
      .listMarketingChatbots({ tenant_id: tenantId }, { take: 1 })
      .catch(() => [])
    if (Array.isArray(existing) && existing.length) {
      return {
        created: false,
        chatbot_id: existing[0]?.id,
        reason: "tenant already has a chatbot",
      }
    }

    const storeName = (tenant.name ?? "").trim() || "our store"

    const created = await mk.createMarketingChatbots({
      tenant_id: tenantId,
      name: `${storeName} Assistant`,
      // AUTO, not draft: a drafted reply is never sent, so a default bot in
      // draft mode would leave every visitor unanswered.
      reply_mode: "auto",
      active: true,
      public_key: crypto.randomBytes(12).toString("hex"),
      training_status: "not_trained",
      instructions: DEFAULT_ASSISTANT_INSTRUCTIONS,
      // Stay inside the trained knowledge: a fresh store's bot must refuse
      // rather than improvise a policy or a product.
      dont_go_beyond: true,
      // AUTO = null. A non-empty `language` pins every reply to that language
      // ("Always reply in <x>, whatever language the customer uses" —
      // messaging/ai-reply.ts personaSection); null lets the model mirror the
      // language the customer wrote in, which is what a default bot wants.
      language: null,
      welcome_message: `Hi, welcome to ${storeName}. I can help you find a product, check what is in stock, or answer a question about the store. What are you looking for?`,
      bubble_message: "Need a hand? Ask us anything.",
      greeting: `Hi, welcome to ${storeName}.`,
      color: "#017BE5",
      position: "right",
      show_logo: true,
      show_datetime: true,
      embed_width: 420,
      embed_height: 745,
      collect_email: true,
      allow_attachments: false,
      allow_emoji: true,
    })
    const chatbot = Array.isArray(created) ? created[0] : created

    // The web_widget binding IS the storefront widget's on/off switch.
    let channelId: string | undefined
    try {
      const channel = await mk.createMarketingChatbotChannels({
        tenant_id: tenantId,
        chatbot_id: chatbot.id,
        channel: "web_widget",
        active: true,
        config: { provisioned: "default_store_assistant" },
      })
      channelId = (Array.isArray(channel) ? channel[0] : channel)?.id
    } catch (e: any) {
      // A missing binding mutes the widget but must not undo the bot.
      // eslint-disable-next-line no-console
      console.log(
        `[default-chatbot] web_widget binding failed for ${tenantId}: ${e?.message}`
      )
    }

    const seeds = buildSeedSources(storeName)
    await mk
      .createMarketingChatbotData(
        seeds.map((s) => ({
          tenant_id: tenantId,
          chatbot_id: chatbot.id,
          kind: s.kind,
          source: s.source,
          content: s.content,
          status: "pending",
          error: null,
          embedding_ref: null,
        }))
      )
      .catch((e: any) => {
        // eslint-disable-next-line no-console
        console.log(
          `[default-chatbot] knowledge seed failed for ${tenantId}: ${e?.message}`
        )
      })

    // Train now so the store answers from its catalog immediately. This is a
    // network call (OpenAI) on the provisioning path: it is best-effort, and a
    // failure just leaves the bot `not_trained` for the merchant to retrain.
    let training_status: string | undefined
    let chunks: number | undefined
    try {
      const result = await embedChatbotSources(container, tenantId, chatbot.id)
      training_status = result.training_status
      chunks = result.chunks
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log(
        `[default-chatbot] training skipped for ${tenantId}: ${e?.message}`
      )
    }

    return {
      created: true,
      chatbot_id: chatbot.id,
      channel_id: channelId,
      sources: seeds.length,
      training_status,
      chunks,
    }
  } catch (e: any) {
    return { created: false, reason: e?.message ?? "default chatbot failed" }
  }
}
