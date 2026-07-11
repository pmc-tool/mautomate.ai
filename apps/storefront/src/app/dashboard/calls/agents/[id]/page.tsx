"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  Adjustments,
  User,
  AiAssistent,
  Tools,
  Map,
  BookOpen,
  Plus,
  Trash,
  XMarkMini,
  RocketLaunch,
  ShieldCheck,
  Clock,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import {
  FormField,
  Input,
  Textarea,
  Select,
} from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallAgent,
  updateCallAgent,
  deleteCallAgent,
  publishCallAgent,
  listAgentKnowledge,
  addAgentKnowledge,
  deleteAgentKnowledge,
  CallAgentDetail,
  CallAgentVersion,
  CallAgentKnowledge,
  CallAgentDefinition,
  ApiError,
} from "@lib/merchant-admin/api"
import { TestCallPanel } from "./test-call-panel"

// Editor-friendly shapes (arrays edited as strings, parsed on save).
type ToolDraft = {
  name: string
  description: string
  paramsText: string
}

type StateDraft = {
  id: string
  goal: string
  sampleLinesText: string
  allowedToolsText: string
  transitions: { on: string; to: string }[]
}

type TabId =
  | "general"
  | "persona"
  | "voice"
  | "tools"
  | "states"
  | "guardrails"
  | "knowledge"
  | "versions"

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "General", icon: Adjustments },
  { id: "persona", label: "Persona", icon: User },
  { id: "voice", label: "Voice", icon: AiAssistent },
  { id: "tools", label: "Tools", icon: Tools },
  { id: "states", label: "States", icon: Map },
  { id: "guardrails", label: "Guardrails", icon: ShieldCheck },
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { id: "versions", label: "History", icon: Clock },
]

// Curated catalog of the REAL backend tools, exposed as simple toggles.
// Toggling one on injects the full spec into the definition's tools[].
const TOOL_CATALOG: {
  name: string
  label: string
  description: string
  parameters: Record<string, any>
}[] = [
  {
    name: "findOrders",
    label: "Look up orders",
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
  {
    name: "listCustomerOrders",
    label: "List customer orders",
    description: "List a customer's recent orders by email or phone.",
    parameters: {
      type: "object",
      properties: { email: { type: "string" }, phone: { type: "string" } },
    },
  },
  {
    name: "searchProducts",
    label: "Search products",
    description: "Search the store catalog for availability, price and stock.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "integer" } },
      required: ["query"],
    },
  },
  {
    name: "getProduct",
    label: "Get product details",
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
  {
    name: "searchKnowledge",
    label: "Search knowledge base",
    description:
      "Answer store-policy questions (shipping, returns, hours) from the agent's knowledge base.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "transferToHuman",
    label: "Transfer to a human",
    description: "Hand the call to a human agent.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "endCall",
    label: "End the call",
    description: "End the call politely when the caller is done.",
    parameters: { type: "object", properties: {} },
  },
]

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

function splitCsv(text: string): string[] {
  return text
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)
}

export default function EditCallAgentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("general")

  const [agent, setAgent] = useState<CallAgentDetail | null>(null)
  const [versions, setVersions] = useState<CallAgentVersion[]>([])

  // General
  const [name, setName] = useState("")
  const [useCase, setUseCase] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [firstMessage, setFirstMessage] = useState("")
  const [objective, setObjective] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")

  // Persona
  const [personaName, setPersonaName] = useState("")
  const [tone, setTone] = useState("")
  const [style, setStyle] = useState("")
  const [personaLanguage, setPersonaLanguage] = useState("")

  // Voice
  const [voiceProvider, setVoiceProvider] = useState("")
  const [voiceId, setVoiceId] = useState("")
  const [voiceLanguage, setVoiceLanguage] = useState("")

  // Tools + States
  const [tools, setTools] = useState<ToolDraft[]>([])
  const [states, setStates] = useState<StateDraft[]>([])

  // Guardrails
  const [maxTurns, setMaxTurns] = useState(60)
  const [maxClarify, setMaxClarify] = useState(2)
  const [saveOfferOnce, setSaveOfferOnce] = useState(true)
  const [recordingDisclosure, setRecordingDisclosure] = useState("")

  // Knowledge base
  const [knowledge, setKnowledge] = useState<CallAgentKnowledge[]>([])
  const [kbLoading, setKbLoading] = useState(false)
  const [kbName, setKbName] = useState("")
  const [kbType, setKbType] = useState<"faq" | "text" | "url">("text")
  const [kbContent, setKbContent] = useState("")
  const [kbUrl, setKbUrl] = useState("")
  const [kbSaving, setKbSaving] = useState(false)

  // Load a training definition into the editor's local state. Shared by the
  // initial agent load AND the version-restore flow.
  const loadDefinition = (d: CallAgentDefinition) => {
    setFirstMessage(d.first_message || "")
    setObjective(d.objective || "")
    setSystemPrompt(d.system_prompt || d.prompt || "")

    const p = d.persona || {}
    setPersonaName(p.name || "")
    setTone(p.tone || "")
    setStyle(p.style || "")
    setPersonaLanguage(p.language || "")

    const v = d.voice || {}
    setVoiceProvider(v.provider || p.voice_provider || "")
    setVoiceId(v.voice_id || p.voice_id || "")
    setVoiceLanguage(v.language || p.language || "")

    setTools(
      (d.tools || []).map((t) => ({
        name: t.name || "",
        description: t.description || "",
        paramsText: JSON.stringify(t.parameters ?? {}, null, 2),
      }))
    )

    setStates(
      (d.states || []).map((s) => ({
        id: s.id || "",
        goal: s.goal || "",
        sampleLinesText: (s.sample_lines || []).join("\n"),
        allowedToolsText: (s.allowed_tools || []).join(", "),
        transitions: (s.transitions || []).map((tr) => ({
          on: tr.on || "",
          to: tr.to || "",
        })),
      }))
    )

    const g = d.guardrails || {}
    setMaxTurns(typeof g.max_turns === "number" ? g.max_turns : 60)
    setMaxClarify(typeof g.max_clarify === "number" ? g.max_clarify : 2)
    setSaveOfferOnce(
      typeof g.save_offer_once === "boolean" ? g.save_offer_once : true
    )
    setRecordingDisclosure(g.recording_disclosure || "")
  }

  const hydrate = (a: CallAgentDetail) => {
    setName(a.name || "")
    setUseCase(a.use_case || "")
    setStatus((a.status as "draft" | "published") || "draft")
    loadDefinition(a.definition || {})
  }

  const loadAgent = () => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    getCallAgent(token, id)
      .then((res) => {
        setAgent(res.agent)
        setVersions(res.versions || [])
        hydrate(res.agent)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load agent")
      })
      .finally(() => setLoading(false))
  }

  const loadKnowledge = () => {
    if (!token || !id) return
    setKbLoading(true)
    listAgentKnowledge(token, id)
      .then((res) => setKnowledge(res.knowledge || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load knowledge")
      })
      .finally(() => setKbLoading(false))
  }

  useEffect(() => {
    loadAgent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  useEffect(() => {
    if (tab === "knowledge") loadKnowledge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Assemble the definition in the EXACT shape the backend zod expects.
  const buildDefinition = (): { def: CallAgentDefinition | null; err?: string } => {
    const parsedTools = []
    for (const t of tools) {
      const nm = t.name.trim()
      if (!nm) return { def: null, err: "Every tool needs a name." }
      let parameters: Record<string, any> = {}
      const raw = t.paramsText.trim()
      if (raw) {
        try {
          parameters = JSON.parse(raw)
        } catch {
          return { def: null, err: `Tool "${nm}" has invalid JSON parameters.` }
        }
      }
      parsedTools.push({
        name: nm,
        description: t.description.trim(),
        parameters,
      })
    }

    const parsedStates = []
    for (const s of states) {
      const sid = s.id.trim()
      if (!sid) return { def: null, err: "Every state needs an id." }
      parsedStates.push({
        id: sid,
        goal: s.goal.trim(),
        sample_lines: splitLines(s.sampleLinesText),
        allowed_tools: splitCsv(s.allowedToolsText),
        transitions: s.transitions
          .filter((tr) => tr.on.trim() && tr.to.trim())
          .map((tr) => ({ on: tr.on.trim(), to: tr.to.trim() })),
      })
    }

    const def: CallAgentDefinition = {
      persona: {
        name: personaName.trim(),
        tone: tone.trim(),
        style: style.trim(),
        language: personaLanguage.trim(),
        voice_provider: voiceProvider.trim(),
        voice_id: voiceId.trim(),
      },
      voice: {
        provider: voiceProvider.trim(),
        voice_id: voiceId.trim(),
        language: voiceLanguage.trim(),
      },
      objective: objective.trim(),
      first_message: firstMessage.trim(),
      system_prompt: systemPrompt.trim(),
      states: parsedStates,
      tools: parsedTools,
      guardrails: {
        max_turns: Number(maxTurns),
        max_clarify: Number(maxClarify),
        save_offer_once: saveOfferOnce,
        recording_disclosure: recordingDisclosure.trim(),
      },
    }

    return { def }
  }

  const handleSave = async () => {
    if (!token || !agent) return
    if (!name.trim()) {
      setTab("general")
      setError("Name cannot be empty.")
      return
    }
    const { def, err } = buildDefinition()
    if (err || !def) {
      setError(err || "Could not build definition.")
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await updateCallAgent(token, agent.id, {
        name: name.trim(),
        use_case: useCase.trim() || undefined,
        status,
        definition: def,
      })
      setAgent(res.agent)
      hydrate(res.agent)
      setMessage("Agent training saved.")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout()
      setError(e instanceof Error ? e.message : "Failed to save agent")
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!token || !agent) return
    if (!window.confirm("Publish this agent? A new immutable version snapshot will be created and the agent will go live.")) {
      return
    }
    setPublishing(true)
    setError(null)
    setMessage(null)
    try {
      await publishCallAgent(token, agent.id)
      setMessage("Agent published.")
      loadAgent()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout()
      setError(e instanceof Error ? e.message : "Failed to publish agent")
    } finally {
      setPublishing(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !agent) return
    if (!window.confirm(`Delete agent "${agent.name}"? This removes all versions and knowledge. This cannot be undone.`)) {
      return
    }
    try {
      await deleteCallAgent(token, agent.id)
      router.push("/dashboard/calls/agents")
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout()
      setError(e instanceof Error ? e.message : "Failed to delete agent")
    }
  }

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !agent || !kbName.trim()) return
    setKbSaving(true)
    setError(null)
    try {
      await addAgentKnowledge(token, agent.id, {
        name: kbName.trim(),
        source_type: kbType,
        content: kbType === "url" ? null : kbContent.trim() || null,
        url: kbType === "url" ? kbUrl.trim() || null : null,
      })
      setKbName("")
      setKbContent("")
      setKbUrl("")
      setKbType("text")
      loadKnowledge()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to add knowledge")
    } finally {
      setKbSaving(false)
    }
  }

  const handleDeleteKnowledge = async (kbId: string) => {
    if (!token || !agent) return
    if (!window.confirm("Remove this knowledge entry?")) return
    try {
      await deleteAgentKnowledge(token, agent.id, kbId)
      setKnowledge((k) => k.filter((x) => x.id !== kbId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to delete knowledge")
    }
  }

  // Tool helpers
  const addTool = () =>
    setTools((t) => [...t, { name: "", description: "", paramsText: "{}" }])
  const updateTool = (i: number, patch: Partial<ToolDraft>) =>
    setTools((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const removeTool = (i: number) =>
    setTools((t) => t.filter((_, idx) => idx !== i))

  // Catalog toggle helpers ----------------------------------------------------
  const isCatalogToolOn = (name: string) =>
    tools.some((t) => t.name.trim() === name)

  const toggleCatalogTool = (name: string) => {
    const entry = TOOL_CATALOG.find((c) => c.name === name)
    if (!entry) return
    if (isCatalogToolOn(name)) {
      // Remove from tools[] AND from every state's allowed_tools.
      setTools((t) => t.filter((x) => x.name.trim() !== name))
      setStates((s) =>
        s.map((st) => ({
          ...st,
          allowedToolsText: splitCsv(st.allowedToolsText)
            .filter((tn) => tn !== name)
            .join(", "),
        }))
      )
    } else {
      // Add the full catalog spec to tools[].
      setTools((t) => [
        ...t,
        {
          name: entry.name,
          description: entry.description,
          paramsText: JSON.stringify(entry.parameters ?? {}, null, 2),
        },
      ])
      // Expose it in the FIRST state's allowed_tools (if any states exist).
      setStates((s) => {
        if (s.length === 0) return s
        return s.map((st, idx) => {
          if (idx !== 0) return st
          const existing = splitCsv(st.allowedToolsText)
          if (existing.includes(name)) return st
          return {
            ...st,
            allowedToolsText: [...existing, name].join(", "),
          }
        })
      })
    }
  }

  // State helpers
  const addState = () =>
    setStates((s) => [
      ...s,
      { id: "", goal: "", sampleLinesText: "", allowedToolsText: "", transitions: [] },
    ])
  const updateState = (i: number, patch: Partial<StateDraft>) =>
    setStates((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const removeState = (i: number) =>
    setStates((s) => s.filter((_, idx) => idx !== i))
  const addTransition = (i: number) =>
    setStates((s) =>
      s.map((x, idx) =>
        idx === i ? { ...x, transitions: [...x.transitions, { on: "", to: "" }] } : x
      )
    )
  const updateTransition = (
    i: number,
    ti: number,
    patch: Partial<{ on: string; to: string }>
  ) =>
    setStates((s) =>
      s.map((x, idx) =>
        idx === i
          ? {
              ...x,
              transitions: x.transitions.map((tr, tIdx) =>
                tIdx === ti ? { ...tr, ...patch } : tr
              ),
            }
          : x
      )
    )
  const removeTransition = (i: number, ti: number) =>
    setStates((s) =>
      s.map((x, idx) =>
        idx === i
          ? { ...x, transitions: x.transitions.filter((_, tIdx) => tIdx !== ti) }
          : x
      )
    )

  // Restore a previous version's definition into the editor. The versions
  // payload only carries the definition when the backend inlines it (see report
  // note); we read it defensively so this "just works" once it is present.
  const handleRestoreVersion = (v: CallAgentVersion) => {
    const def = (v as any).definition as CallAgentDefinition | undefined
    if (!def) {
      setError(
        `Version ${v.version} does not include its saved definition, so it cannot be restored from the browser yet.`
      )
      return
    }
    loadDefinition(def)
    setTab("general")
    setError(null)
    setMessage(
      `Loaded version ${v.version} — review and Save to make it the live version.`
    )
  }

  const liveVersion = useMemo(
    () => versions.find((v) => v.published)?.version ?? null,
    [versions]
  )

  if (loading) {
    return <div className="p-8 text-center text-sm text-grey-50">Loading agent…</div>
  }

  if (!agent) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/calls/agents"
          className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to agents
        </Link>
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Agent not found."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/calls/agents"
        className="inline-flex items-center gap-1 text-sm text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to agents
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <PageHeader title={agent.name} description="Train this AI voice agent's playbook." />
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-grey-50">
            <StatusBadge status={agent.status} />
            <span>Use case: {agent.use_case || "—"}</span>
            {agent.version != null && <span>· Draft v{agent.version}</span>}
            {liveVersion != null && <span>· Live v{liveVersion}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
          >
            <RocketLaunch className="h-4 w-4" />
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save training"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-base border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <TestCallPanel
        token={token}
        agentId={agent.id}
        disabled={!(agent.current_version_id || agent.version != null)}
        disabledReason="Save the agent's training before starting a test call."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-grey-20">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "border-grey-90 text-grey-90"
                  : "border-transparent text-grey-50 hover:text-grey-90")
              }
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* General */}
      {tab === "general" && (
        <SectionCard title="General" description="Identity, opening line, and top-level objective.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order confirmation agent" />
            </FormField>
            <FormField label="Use case">
              <Input value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="e.g. cod_confirmation" />
            </FormField>
            <FormField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </FormField>
          </div>
          <div className="mt-4 space-y-4">
            <FormField label="First message" hint="The first thing the agent says once connected. May contain merge tokens.">
              <Textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Hello, this is …" />
            </FormField>
            <FormField label="Objective" hint="What this agent is trying to accomplish overall.">
              <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Confirm the customer's cash-on-delivery order …" />
            </FormField>
            <FormField label="System prompt" hint="Base instructions that frame the agent's behaviour.">
              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="min-h-[140px]" placeholder="You are a polite, concise call-center agent …" />
            </FormField>
          </div>
        </SectionCard>
      )}

      {/* Persona */}
      {tab === "persona" && (
        <SectionCard title="Persona" description="How the agent presents itself — name, tone, style, spoken language.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Persona name">
              <Input value={personaName} onChange={(e) => setPersonaName(e.target.value)} placeholder="e.g. Ayesha" />
            </FormField>
            <FormField label="Language" hint="BCP-47 tag, e.g. en, bn.">
              <Input value={personaLanguage} onChange={(e) => setPersonaLanguage(e.target.value)} placeholder="en" />
            </FormField>
            <FormField label="Tone">
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. warm, professional" />
            </FormField>
            <FormField label="Style">
              <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g. concise, friendly" />
            </FormField>
          </div>
        </SectionCard>
      )}

      {/* Voice */}
      {tab === "voice" && (
        <SectionCard title="Voice" description="Text-to-speech voice used by the runtime.">
          <div className="mb-4 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Live voices require vendor API keys configured for your store. Until then these settings are saved but not spoken.
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Provider">
              <Input value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value)} placeholder="e.g. elevenlabs, openai" />
            </FormField>
            <FormField label="Voice ID">
              <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="e.g. alloy" />
            </FormField>
            <FormField label="Language" hint="BCP-47 tag, e.g. en, bn.">
              <Input value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} placeholder="en" />
            </FormField>
          </div>
        </SectionCard>
      )}

      {/* Tools */}
      {tab === "tools" && (
        <div className="space-y-6">
        <SectionCard
          title="Tool catalog"
          description="Turn on the store actions this agent may use. Each one is wired to a real backend tool — no JSON required."
        >
          <div className="space-y-2">
            {TOOL_CATALOG.map((c) => {
              const on = isCatalogToolOn(c.name)
              return (
                <label
                  key={c.name}
                  className="flex cursor-pointer items-start gap-3 rounded-base border border-grey-20 p-3 hover:bg-grey-5"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleCatalogTool(c.name)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-grey-90">{c.label}</span>
                      <code className="rounded bg-grey-10 px-1.5 py-0.5 font-mono text-[11px] text-grey-60">
                        {c.name}
                      </code>
                    </span>
                    <span className="mt-0.5 block text-xs text-grey-50">{c.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </SectionCard>
        <SectionCard
          title="Advanced tools"
          description="Model-callable tools. Parameters are a JSON-schema object."
          action={
            <button
              onClick={addTool}
              className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-5"
            >
              <Plus className="h-4 w-4" />
              Add tool
            </button>
          }
        >
          {tools.length === 0 ? (
            <EmptyState
              icon={Tools}
              title="No tools"
              description="Add tools the agent may call during the conversation."
            />
          ) : (
            <div className="space-y-4">
              {tools.map((t, i) => (
                <div key={i} className="rounded-base border border-grey-20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-grey-70">Tool {i + 1}</span>
                    <button
                      onClick={() => removeTool(i)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      <XMarkMini className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Name">
                      <Input value={t.name} onChange={(e) => updateTool(i, { name: e.target.value })} placeholder="e.g. lookup_order" />
                    </FormField>
                    <FormField label="Description">
                      <Input value={t.description} onChange={(e) => updateTool(i, { description: e.target.value })} placeholder="What the tool does" />
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <FormField label="Parameters (JSON schema)" hint='e.g. {"type":"object","properties":{}}'>
                      <Textarea
                        value={t.paramsText}
                        onChange={(e) => updateTool(i, { paramsText: e.target.value })}
                        className="min-h-[100px] font-mono text-xs"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        </div>
      )}

      {/* States */}
      {tab === "states" && (
        <SectionCard
          title="Conversation states"
          description="The state machine the agent follows. Each state has a goal, sample lines, allowed tools, and transitions."
          action={
            <button
              onClick={addState}
              className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-5"
            >
              <Plus className="h-4 w-4" />
              Add state
            </button>
          }
        >
          {states.length === 0 ? (
            <EmptyState
              icon={Map}
              title="No states"
              description="Add conversation states to shape the flow of the call."
            />
          ) : (
            <div className="space-y-4">
              {states.map((s, i) => (
                <div key={i} className="rounded-base border border-grey-20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-grey-70">State {i + 1}</span>
                    <button
                      onClick={() => removeState(i)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      <XMarkMini className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="State id">
                      <Input value={s.id} onChange={(e) => updateState(i, { id: e.target.value })} placeholder="e.g. greeting" />
                    </FormField>
                    <FormField label="Allowed tools" hint="Comma-separated tool names.">
                      <Input value={s.allowedToolsText} onChange={(e) => updateState(i, { allowedToolsText: e.target.value })} placeholder="lookup_order, save_reschedule" />
                    </FormField>
                  </div>
                  <div className="mt-4 space-y-4">
                    <FormField label="Goal / prompt" hint="What the model tries to accomplish in this state.">
                      <Textarea value={s.goal} onChange={(e) => updateState(i, { goal: e.target.value })} />
                    </FormField>
                    <FormField label="Sample lines" hint="One line per row. Anchors tone; not a verbatim script.">
                      <Textarea value={s.sampleLinesText} onChange={(e) => updateState(i, { sampleLinesText: e.target.value })} />
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-grey-70">Transitions</span>
                      <button
                        onClick={() => addTransition(i)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-grey-70 hover:text-grey-90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add transition
                      </button>
                    </div>
                    {s.transitions.length === 0 ? (
                      <p className="text-xs text-grey-50">No transitions. Add one to define an edge to another state.</p>
                    ) : (
                      <div className="space-y-2">
                        {s.transitions.map((tr, ti) => (
                          <div key={ti} className="flex items-center gap-2">
                            <Input
                              value={tr.on}
                              onChange={(e) => updateTransition(i, ti, { on: e.target.value })}
                              placeholder="on (event) e.g. confirmed"
                            />
                            <span className="text-grey-40">→</span>
                            <Input
                              value={tr.to}
                              onChange={(e) => updateTransition(i, ti, { to: e.target.value })}
                              placeholder="to (state id) e.g. wrap_up"
                            />
                            <button
                              onClick={() => removeTransition(i, ti)}
                              className="shrink-0 rounded-base p-1.5 text-grey-50 hover:bg-grey-10 hover:text-red-600"
                            >
                              <XMarkMini className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Guardrails */}
      {tab === "guardrails" && (
        <SectionCard
          title="Guardrails"
          description="Safety limits and compliance settings the runtime enforces during a call."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Max turns" hint="Hard cap on conversation turns before the call wraps up.">
              <Input
                type="number"
                min={1}
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                placeholder="60"
              />
            </FormField>
            <FormField label="Max clarifications" hint="How many times the agent may ask the caller to repeat before moving on.">
              <Input
                type="number"
                min={0}
                value={maxClarify}
                onChange={(e) => setMaxClarify(Number(e.target.value))}
                placeholder="2"
              />
            </FormField>
          </div>
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-base border border-grey-20 p-3 hover:bg-grey-5">
              <input
                type="checkbox"
                checked={saveOfferOnce}
                onChange={(e) => setSaveOfferOnce(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-grey-90">Only make a save/retention offer once</span>
                <span className="mt-0.5 block text-xs text-grey-50">
                  Prevents the agent from repeatedly pushing a retention or save offer in the same call.
                </span>
              </span>
            </label>
            <FormField
              label="Recording disclosure"
              hint="Spoken/legal notice that the call may be recorded. Left empty means no disclosure is played."
            >
              <Textarea
                value={recordingDisclosure}
                onChange={(e) => setRecordingDisclosure(e.target.value)}
                placeholder="This call may be recorded for quality and training purposes."
              />
            </FormField>
          </div>
        </SectionCard>
      )}

      {/* Knowledge Base */}
      {tab === "knowledge" && (
        <div className="space-y-6">
          <SectionCard title="Add knowledge" description="Attach FAQs, text, or URLs the agent can draw on.">
            <form onSubmit={handleAddKnowledge}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Name">
                  <Input value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="e.g. Return policy" required />
                </FormField>
                <FormField label="Source type">
                  <Select value={kbType} onChange={(e) => setKbType(e.target.value as "faq" | "text" | "url")}>
                    <option value="text">Text</option>
                    <option value="faq">FAQ</option>
                    <option value="url">URL</option>
                  </Select>
                </FormField>
              </div>
              <div className="mt-4">
                {kbType === "url" ? (
                  <FormField label="URL">
                    <Input value={kbUrl} onChange={(e) => setKbUrl(e.target.value)} placeholder="https://…" />
                  </FormField>
                ) : (
                  <FormField label="Content">
                    <Textarea value={kbContent} onChange={(e) => setKbContent(e.target.value)} className="min-h-[100px]" placeholder="Paste the FAQ or reference text …" />
                  </FormField>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={kbSaving || !kbName.trim()}
                  className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {kbSaving ? "Adding…" : "Add entry"}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Knowledge entries" description="Reference material attached to this agent.">
            {kbLoading ? (
              <div className="p-6 text-center text-sm text-grey-50">Loading knowledge…</div>
            ) : knowledge.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No knowledge yet"
                description="Add FAQs or reference text so the agent can answer accurately."
              />
            ) : (
              <div className="divide-y divide-grey-10">
                {knowledge.map((k) => (
                  <div key={k.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-grey-90">{k.name}</span>
                        <StatusBadge status={k.source_type} />
                      </div>
                      {k.url && <p className="mt-0.5 truncate text-xs text-sky-700">{k.url}</p>}
                      {k.content && <p className="mt-0.5 line-clamp-2 text-xs text-grey-50">{k.content}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteKnowledge(k.id)}
                      className="shrink-0 rounded-base p-1.5 text-grey-50 hover:bg-grey-10 hover:text-red-600"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Version history */}
      {tab === "versions" && (
        <SectionCard
          title="Version history"
          description="Every save and publish snapshots the agent. Restore loads a snapshot back into the editor — Save to make it the live version."
        >
          {versions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No versions yet"
              description="Save or publish the agent to create its first version snapshot."
            />
          ) : (
            <div className="divide-y divide-grey-10">
              {[...versions]
                .sort((a, b) => b.version - a.version)
                .map((v) => {
                  const isLive = v.published
                  const isCurrent = liveVersion != null && v.version === liveVersion
                  const hasDefinition = !!(v as any).definition
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-grey-90">
                            Version {v.version}
                          </span>
                          {isLive && <StatusBadge status="published" />}
                          {isCurrent && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                              Live
                            </span>
                          )}
                        </div>
                        {v.created_at && (
                          <p className="mt-0.5 text-xs text-grey-50">
                            {new Date(v.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {!isCurrent && (
                        <button
                          onClick={() => handleRestoreVersion(v)}
                          disabled={!hasDefinition}
                          title={
                            hasDefinition
                              ? undefined
                              : "This version's saved definition is not available in the browser."
                          }
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-base border border-grey-20 px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowLeftMini className="h-4 w-4" />
                          Restore this version
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
