import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getAiTextProvider } from "../ai/registry"
import { buildBrandContext } from "../content/brand-context"

/**
 * run-agent — the grounded runner that turns a stored marketing agent into an
 * on-brand, fact-grounded reply.
 *
 * The value here is grounding, not raw generation:
 *   1. The agent's own `instructions` set its persona / task.
 *   2. `buildBrandContext` layers brand voice + product facts (with its own
 *      anti-invention rule).
 *   3. When a chatbot is in play, `retrieveKnowledge` pulls the most relevant
 *      knowledge-base snippets into a KNOWLEDGE block.
 *   4. A hard anti-invention rule forbids fabricating policies, prices, order
 *      details, or stock that are not present in the knowledge/facts.
 *
 * NO-THROW: this runs on the live reply path. Any failure (missing agent,
 * provider error, ...) degrades to an empty output rather than crashing.
 */

/** A single prior turn in the conversation, oldest-first. */
export type AgentHistoryTurn = {
  role: "user" | "assistant" | string
  content: string
}

/** Input to {@link runAgent}. */
export type RunAgentInput = {
  tenantId: string
  agentId: string
  input: string
  chatbotId?: string
  productIds?: string[]
  history?: AgentHistoryTurn[]
}

/** The result of a run. `needs_ai` is true only when no provider is configured. */
export type RunAgentResult = {
  output: string
  needs_ai: boolean
  used_knowledge?: string[]
}

/** Lowercase a string and split it into meaningful (length >= 2) word tokens. */
const tokenize = (value: string): string[] => {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
}

/**
 * RAG-lite retrieval: load the chatbot's knowledge rows and rank each by simple
 * keyword/token overlap with `query`, returning the top-`limit` `content`
 * snippets.
 *
 * NOTE: `embedding_ref` on each row is reserved for a future vector search.
 * This keyword retriever needs no embeddings/model and is the reliable v1 — it
 * degrades gracefully (empty list) rather than failing the reply.
 */
export const retrieveKnowledge = async (
  mk: any,
  tenantId: string,
  chatbotId: string,
  query: string,
  limit = 5
): Promise<string[]> => {
  try {
    const rows = await mk.listMarketingChatbotData(
      { tenant_id: tenantId, chatbot_id: chatbotId },
      { take: 1000 }
    )
    const list: any[] = Array.isArray(rows) ? rows : []

    const queryTokens = new Set(tokenize(query))
    if (!queryTokens.size) {
      // No usable query terms: fall back to the first `limit` non-empty rows.
      return list
        .map((r) => (typeof r.content === "string" ? r.content.trim() : ""))
        .filter((c) => c.length > 0)
        .slice(0, limit)
    }

    const scored = list
      .map((r) => {
        const content = typeof r.content === "string" ? r.content.trim() : ""
        if (!content) {
          return { content, score: 0 }
        }
        const haystack = tokenize(`${content} ${r.source ?? ""}`)
        let score = 0
        for (const tok of haystack) {
          if (queryTokens.has(tok)) {
            score += 1
          }
        }
        return { content, score }
      })
      .filter((s) => s.content.length > 0 && s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored.map((s) => s.content)
  } catch {
    // No-throw: knowledge retrieval failure simply yields no grounding.
    return []
  }
}

/** Render prior turns as a compact transcript for the prompt. */
const renderHistory = (history?: AgentHistoryTurn[]): string => {
  const turns = (history ?? [])
    .filter((t) => t && typeof t.content === "string" && t.content.trim())
    .slice(-10)
  if (!turns.length) {
    return ""
  }
  return turns
    .map((t) => {
      const who = t.role === "assistant" ? "Assistant" : "User"
      return `${who}: ${t.content.trim()}`
    })
    .join("\n")
}

/**
 * Run a stored marketing agent against `input`, grounded in brand context and
 * (optionally) a chatbot's knowledge base. Never throws.
 *
 * Returns `{ output: "", needs_ai: true }` when no AI provider is configured,
 * so the caller can prompt the user to connect one. Otherwise returns
 * `{ output, needs_ai: false, used_knowledge }`.
 */
export const runAgent = async (
  container: MedusaContainer,
  {
    tenantId,
    agentId,
    input,
    chatbotId,
    productIds,
    history,
  }: RunAgentInput
): Promise<RunAgentResult> => {
  try {
    const mk: any = container.resolve(MARKETING_MODULE)

    const agent = await mk.retrieveMarketingAgent(agentId).catch(() => null)
    if (!agent || agent.tenant_id !== tenantId) {
      // Unknown / cross-tenant agent: no-throw, nothing to say.
      return { output: "", needs_ai: false, used_knowledge: [] }
    }

    const sections: string[] = []

    // 1. The agent's own persona / instructions.
    if (agent.instructions && String(agent.instructions).trim()) {
      sections.push(String(agent.instructions).trim())
    }

    // 2. Brand voice + product facts.
    const brandContext = await buildBrandContext(container, tenantId, {
      brandVoiceId: agent.brand_voice_id ?? undefined,
      productIds:
        Array.isArray(productIds) && productIds.length ? productIds : undefined,
    })
    if (brandContext) {
      sections.push(brandContext)
    }

    // 3. Knowledge base (chatbot only).
    let usedKnowledge: string[] = []
    if (chatbotId) {
      usedKnowledge = await retrieveKnowledge(mk, tenantId, chatbotId, input)
      if (usedKnowledge.length) {
        sections.push(
          "KNOWLEDGE (authoritative facts retrieved for this question — prefer " +
            "these over your own assumptions):\n" +
            usedKnowledge.map((k, i) => `[${i + 1}] ${k}`).join("\n")
        )
      }
    }

    // 4. Hard anti-invention rule.
    sections.push(
      "STRICT GROUNDING RULES: Never fabricate or guess policies, prices, " +
        "discounts, shipping/return terms, stock or availability, order details, " +
        "or any product claim that is not explicitly present in the KNOWLEDGE or " +
        "facts above. If the answer is not covered, say you don't have that " +
        "information and offer to connect the customer with a human, rather than " +
        "inventing an answer."
    )

    const system = sections.join("\n\n")

    const historyBlock = renderHistory(history)
    const prompt = historyBlock
      ? `Conversation so far:\n${historyBlock}\n\nUser: ${input}\n\nWrite the assistant's next reply.`
      : input

    const provider = getAiTextProvider()
    if (!provider) {
      return { output: "", needs_ai: true, used_knowledge: usedKnowledge }
    }

    const output = await provider
      .generate(prompt, { system, temperature: 0.4 })
      .catch(() => "")

    return {
      output: typeof output === "string" ? output.trim() : "",
      needs_ai: false,
      used_knowledge: usedKnowledge,
    }
  } catch {
    // No-throw: any unexpected failure degrades to an empty reply.
    return { output: "", needs_ai: false, used_knowledge: [] }
  }
}

/** Input to {@link draftChatbotReply}. */
export type DraftChatbotReplyInput = {
  tenantId: string
  chatbotId: string
  message: string
  history?: AgentHistoryTurn[]
}

/**
 * Convenience wrapper an inbox / web-widget auto-reply calls: resolve the
 * chatbot's bound agent and run it with the chatbot's knowledge base grounded
 * in. Never throws; returns the same shape as {@link runAgent}.
 */
export const draftChatbotReply = async (
  container: MedusaContainer,
  { tenantId, chatbotId, message, history }: DraftChatbotReplyInput
): Promise<RunAgentResult> => {
  try {
    const mk: any = container.resolve(MARKETING_MODULE)

    const chatbot = await mk
      .retrieveMarketingChatbot(chatbotId)
      .catch(() => null)
    if (!chatbot || chatbot.tenant_id !== tenantId) {
      return { output: "", needs_ai: false, used_knowledge: [] }
    }
    if (!chatbot.agent_id) {
      // A chatbot with no bound agent has no persona to reply with.
      return { output: "", needs_ai: false, used_knowledge: [] }
    }

    return await runAgent(container, {
      tenantId,
      agentId: chatbot.agent_id,
      input: message,
      chatbotId,
      history,
    })
  } catch {
    return { output: "", needs_ai: false, used_knowledge: [] }
  }
}

export default runAgent
