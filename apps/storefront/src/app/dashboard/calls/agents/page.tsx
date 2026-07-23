"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  Plus,
  Robot,
  ChevronRight,
  Sparkles,
  Phone,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCallAgents,
  createCallAgent,
  CallAgent,
  CallAgentDefinition,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"

// Real backend tool specs, reused across templates.
const T = {
  findOrders: {
    name: "findOrders",
    description: "Find a caller's order by number, email or phone.",
    parameters: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
    },
  },
  listCustomerOrders: {
    name: "listCustomerOrders",
    description: "List a customer's recent orders by email or phone.",
    parameters: {
      type: "object",
      properties: { email: { type: "string" }, phone: { type: "string" } },
    },
  },
  searchProducts: {
    name: "searchProducts",
    description: "Search the store catalog for availability, price and stock.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "integer" } },
      required: ["query"],
    },
  },
  getProduct: {
    name: "getProduct",
    description: "Full details for one product by handle, id or title.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        handle: { type: "string" },
        title: { type: "string" },
      },
    },
  },
  searchKnowledge: {
    name: "searchKnowledge",
    description:
      "Answer store-policy questions (shipping, returns, hours) from the agent's knowledge base.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  transferToHuman: {
    name: "transferToHuman",
    description: "Hand the call to a human agent.",
    parameters: { type: "object", properties: {} },
  },
  endCall: {
    name: "endCall",
    description: "End the call politely when the caller is done.",
    parameters: { type: "object", properties: {} },
  },
}

const RECORDING_DISCLOSURE =
  "This call may be recorded for quality and training purposes."

// Prebuilt agents a merchant can clone with one click.
const AGENT_TEMPLATES: {
  id: string
  name: string
  description: string
  use_case: string
  definition: CallAgentDefinition
}[] = [
  {
    id: "concierge",
    name: "Store Concierge",
    description:
      "Answers questions about orders, products and store policy. Great inbound all-rounder.",
    use_case: "store_concierge",
    definition: {
      persona: {
        name: "Ava",
        voice_provider: "elevenlabs",
        voice_id: "alloy",
        language: "en",
        tone: "warm, helpful",
        style: "concise, friendly",
      },
      voice: { provider: "elevenlabs", voice_id: "alloy", language: "en" },
      objective:
        "Help the caller with orders, products, and store-policy questions, and hand off to a human when needed.",
      first_message:
        "Hi, thanks for calling! This is Ava, your virtual store assistant. How can I help you today?",
      system_prompt:
        "You are Ava, a warm and concise voice concierge for an online store. Use the available tools to look up orders and products and to answer policy questions from the knowledge base. If you cannot help, offer to transfer to a human. Keep answers short and natural for speech.",
      tools: [
        T.findOrders,
        T.listCustomerOrders,
        T.searchProducts,
        T.getProduct,
        T.searchKnowledge,
        T.transferToHuman,
        T.endCall,
      ],
      guardrails: {
        max_turns: 60,
        max_clarify: 2,
        save_offer_once: true,
        recording_disclosure: RECORDING_DISCLOSURE,
      },
      disposition_set: [
        "resolved",
        "transferred",
        "no_answer",
        "callback_requested",
      ],
    },
  },
  {
    id: "cod_confirmer",
    name: "COD Order Confirmer",
    description:
      "Calls customers to confirm cash-on-delivery orders before they ship.",
    use_case: "cod_confirmation",
    definition: {
      persona: {
        name: "Ava",
        voice_provider: "elevenlabs",
        voice_id: "alloy",
        language: "en",
        tone: "polite, reassuring",
        style: "concise, professional",
      },
      voice: { provider: "elevenlabs", voice_id: "alloy", language: "en" },
      objective:
        "Confirm the customer still wants their cash-on-delivery order and verify the delivery details.",
      first_message:
        "Hello, this is Ava calling from the store about your recent order. Do you have a quick moment to confirm it?",
      system_prompt:
        "You are Ava, confirming cash-on-delivery orders. Look up the order, confirm the items and delivery address, and record whether the customer still wants it. Be brief and polite. Transfer to a human if the customer has a complaint or an unusual request.",
      tools: [T.findOrders, T.listCustomerOrders, T.transferToHuman, T.endCall],
      guardrails: {
        max_turns: 40,
        max_clarify: 2,
        save_offer_once: true,
        recording_disclosure: RECORDING_DISCLOSURE,
      },
      disposition_set: [
        "confirmed",
        "cancelled",
        "reschedule",
        "no_answer",
        "transferred",
      ],
    },
  },
  {
    id: "wismo",
    name: "Order Status (WISMO)",
    description:
      'Handles "where is my order?" calls — looks up status and shipping ETA.',
    use_case: "order_status",
    definition: {
      persona: {
        name: "Ava",
        voice_provider: "elevenlabs",
        voice_id: "alloy",
        language: "en",
        tone: "calm, helpful",
        style: "concise, friendly",
      },
      voice: { provider: "elevenlabs", voice_id: "alloy", language: "en" },
      objective:
        "Tell the caller the current status and expected delivery of their order and resolve simple shipping questions.",
      first_message:
        "Hi, this is Ava. I can help you check on your order — could I get your order number or the email on the order?",
      system_prompt:
        "You are Ava, helping callers track orders. Look up the order, explain its current status and expected delivery in plain language, and use the knowledge base for shipping-policy questions. Transfer to a human for refunds, damage, or anything you cannot resolve.",
      tools: [
        T.findOrders,
        T.listCustomerOrders,
        T.searchKnowledge,
        T.transferToHuman,
        T.endCall,
      ],
      guardrails: {
        max_turns: 40,
        max_clarify: 2,
        save_offer_once: true,
        recording_disclosure: RECORDING_DISCLOSURE,
      },
      disposition_set: [
        "resolved",
        "escalated",
        "transferred",
        "no_answer",
      ],
    },
  },
  {
    id: "cart_recovery",
    name: "Cart Recovery",
    description:
      "Calls shoppers who left items behind to answer questions and win the sale.",
    use_case: "cart_recovery",
    definition: {
      persona: {
        name: "Ava",
        voice_provider: "elevenlabs",
        voice_id: "alloy",
        language: "en",
        tone: "friendly, upbeat",
        style: "concise, persuasive",
      },
      voice: { provider: "elevenlabs", voice_id: "alloy", language: "en" },
      objective:
        "Re-engage a shopper who abandoned their cart, answer product questions, and help them complete the purchase.",
      first_message:
        "Hi, this is Ava from the store. I noticed you were looking at a few items — is there anything I can help you with to finish up?",
      system_prompt:
        "You are Ava, a friendly sales assistant reaching out about an abandoned cart. Answer product and stock questions using the catalog tools and store policy from the knowledge base. Make at most one save/retention offer. Be respectful and never pushy; end the call politely if the shopper is not interested.",
      tools: [
        T.searchProducts,
        T.getProduct,
        T.searchKnowledge,
        T.transferToHuman,
        T.endCall,
      ],
      guardrails: {
        max_turns: 40,
        max_clarify: 2,
        save_offer_once: true,
        recording_disclosure: RECORDING_DISCLOSURE,
      },
      disposition_set: [
        "purchased",
        "interested",
        "not_interested",
        "no_answer",
        "transferred",
      ],
    },
  },
]

const BLANK_DEFINITION: CallAgentDefinition = {
  persona: { language: "en" },
  voice: { voice_id: "alloy", language: "en" },
}

// Presentation helper: initials for the agent avatar circle.
function agentInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AI"
  )
}

export default function CallAgentsPage() {
  const { token } = useMerchantAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<CallAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [templateId, setTemplateId] = useState<string>("blank")
  const [form, setForm] = useState({
    name: "",
    use_case: "general",
    status: "draft" as "draft" | "published",
  })

  // Pick a template: prefills the create form's use_case (and name if empty).
  const selectTemplate = (id: string) => {
    setTemplateId(id)
    const tpl = AGENT_TEMPLATES.find((t) => t.id === id)
    if (tpl) {
      setForm((f) => ({
        ...f,
        name: f.name.trim() ? f.name : tpl.name,
        use_case: tpl.use_case,
      }))
    }
  }

  const load = () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listCallAgents(token)
      .then((res) => setAgents(res.agents || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load agents"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [token])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setCreating(true)
    try {
      const tpl = AGENT_TEMPLATES.find((t) => t.id === templateId)
      const res = await createCallAgent(token, {
        name: form.name,
        use_case: form.use_case,
        status: form.status,
        definition: tpl ? tpl.definition : BLANK_DEFINITION,
      })
      setForm({ name: "", use_case: "general", status: "draft" })
      setTemplateId("blank")
      setShowForm(false)
      // Jump straight into the editor to start training the new agent.
      if (res.agent?.id) {
        router.push(`/dashboard/calls/agents/${res.agent.id}`)
      } else {
        load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent")
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/calls")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to call center
      </button>

      <PageHeader
        title="Call Agents"
        description="Create and train AI voice agents that answer and place calls for your store."
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "New agent"}
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base"
        >
          <div className="border-b border-grey-10 px-6 py-4">
            <h2 className="text-base font-semibold text-grey-90">Create a new agent</h2>
            <p className="mt-0.5 text-sm text-grey-50">
              Start from a proven playbook or build one from scratch — you can change everything later in the training studio.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <span className="mb-3 block text-sm font-medium text-grey-70">Template</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setTemplateId("blank")}
                  className={
                    "flex flex-col items-start gap-3 rounded-large border p-4 text-left transition-all " +
                    (templateId === "blank"
                      ? "border-grey-90 bg-grey-5 ring-1 ring-grey-90"
                      : "border-grey-20 hover:border-grey-40 hover:shadow-sm")
                  }
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={
                        "flex h-9 w-9 items-center justify-center rounded-base " +
                        (templateId === "blank"
                          ? "bg-grey-90 text-white"
                          : "bg-grey-10 text-grey-60")
                      }
                    >
                      <Robot className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-grey-10 px-2 py-0.5 text-[11px] font-medium text-grey-60">
                      Build your own
                    </span>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-grey-90">Blank agent</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-grey-50">
                      Start from scratch and train every step yourself.
                    </span>
                  </span>
                </button>
                {AGENT_TEMPLATES.map((tpl) => {
                  const active = templateId === tpl.id
                  const toolCount = tpl.definition.tools?.length ?? 0
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => selectTemplate(tpl.id)}
                      className={
                        "flex flex-col items-start gap-3 rounded-large border p-4 text-left transition-all " +
                        (active
                          ? "border-grey-90 bg-grey-5 ring-1 ring-grey-90"
                          : "border-grey-20 hover:border-grey-40 hover:shadow-sm")
                      }
                    >
                      <span className="flex w-full items-center justify-between">
                        <span
                          className={
                            "flex h-9 w-9 items-center justify-center rounded-base " +
                            (active ? "bg-grey-90 text-white" : "bg-grey-10 text-grey-60")
                          }
                        >
                          <Sparkles className="h-5 w-5" />
                        </span>
                        <span className="rounded-full bg-grey-10 px-2 py-0.5 text-[11px] font-medium text-grey-60">
                          {toolCount} {toolCount === 1 ? "tool" : "tools"}
                        </span>
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-grey-90">{tpl.name}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-grey-50">
                          {tpl.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-grey-70">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none"
                  placeholder="e.g. Order confirmation agent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-grey-70">Use case</label>
                <input
                  value={form.use_case}
                  onChange={(e) => setForm((f) => ({ ...f, use_case: e.target.value }))}
                  className="w-full rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none"
                  placeholder="e.g. cod_confirmation"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-grey-70">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                  className="w-full rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-grey-10 bg-grey-5 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-5 hover:text-grey-90"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create & train"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-large border border-grey-20 bg-grey-5"
            />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Robot}
          title="No agents yet"
          description="Create AI voice agents to run outbound and inbound call playbooks."
          action={
            !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
              >
                <Plus className="h-4 w-4" />
                New agent
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => router.push(`/dashboard/calls/agents/${agent.id}`)}
              className="group flex flex-col rounded-large border border-grey-20 bg-white p-5 text-left shadow-borders-base transition-all hover:-translate-y-0.5 hover:border-grey-40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grey-90 text-sm font-semibold text-white">
                  {agentInitials(agent.name)}
                </span>
                <StatusBadge status={agent.status} />
              </div>
              <div className="mt-4 min-w-0">
                <h3 className="truncate text-base font-semibold text-grey-90">{agent.name}</h3>
                <span className="mt-2 inline-flex max-w-full items-center truncate rounded-full bg-grey-10 px-2 py-0.5 text-[11px] font-medium text-grey-60">
                  {agent.use_case || "general"}
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-grey-10 pt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-grey-50">
                  <Phone className="h-3.5 w-3.5" />
                  Talk to it in the studio
                </span>
                <span className="inline-flex items-center gap-0.5 font-medium text-grey-40 transition-colors group-hover:text-grey-90">
                  Open
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
