/**
 * Marketing — AI Agents & Chatbots builder.
 *
 * Two tabs:
 *   - Agents: a list on the left, an editor + a grounded Playground on the
 *     right. An agent is a reusable AI persona (content / social / inbox / seo)
 *     grounded in a brand voice. The Playground POSTs to /run and shows the
 *     grounded output (with a "connect a provider" hint when needs_ai).
 *   - Chatbots: create a channel-bound bot, wire it to an agent + reply mode,
 *     and manage its knowledge base (FAQ / text entries). Shows the public_key.
 *
 * API:
 *   GET/POST      /admin/marketing/agents
 *   GET/POST/DELETE /admin/marketing/agents/:id
 *   POST          /admin/marketing/agents/:id/run
 *   GET/POST      /admin/marketing/chatbots
 *   GET/POST/DELETE /admin/marketing/chatbots/:id
 *   GET/POST      /admin/marketing/chatbots/:id/data  (DELETE ?data_id=)
 *   GET           /admin/marketing/brand-voice
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Sparkles, Plus, Trash, PlaySolid } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Tabs,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { PageHeader } from "../_components/ui-kit"

/* ------------------------------------------------------------------ */
/* Types + data layer                                                  */
/* ------------------------------------------------------------------ */

type AgentKind = "content" | "social" | "inbox" | "seo"
type ReplyMode = "draft" | "auto"
type DataKind = "faq" | "url" | "product_catalog" | "file" | "blog"

type Agent = {
  id: string
  name: string
  kind: AgentKind
  instructions?: string | null
  model?: string | null
  brand_voice_id?: string | null
  active?: boolean | null
  current_version_id?: string | null
  created_at?: string
}

type AgentVersion = {
  id: string
  version: number
  published?: boolean
}

type Chatbot = {
  id: string
  name: string
  greeting?: string | null
  agent_id?: string | null
  reply_mode?: ReplyMode | null
  public_key?: string | null
  active?: boolean | null
}

type ChatbotData = {
  id: string
  kind: DataKind
  content?: string | null
  source?: string | null
}

type BrandVoice = { id: string; name: string }

type RunResult = {
  output: string
  needs_ai: boolean
  used_knowledge: string[]
}

const KIND_COLORS: Record<AgentKind, "green" | "blue" | "orange" | "purple"> = {
  content: "blue",
  social: "purple",
  inbox: "green",
  seo: "orange",
}

const AGENT_KINDS: AgentKind[] = ["content", "social", "inbox", "seo"]
const DATA_KINDS: DataKind[] = ["faq", "url", "product_catalog", "file", "blog"]

async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    ...rest,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      (payload as any)?.message ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

/* ------------------------------------------------------------------ */
/* Agents tab                                                          */
/* ------------------------------------------------------------------ */

type AgentForm = {
  name: string
  kind: AgentKind
  instructions: string
  brand_voice_id: string
  model: string
}

const emptyAgentForm = (): AgentForm => ({
  name: "",
  kind: "content",
  instructions: "",
  brand_voice_id: "",
  model: "",
})

const AgentsTab = ({ voices }: { voices: BrandVoice[] }) => {
  const dialog = usePrompt()

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<AgentForm>(emptyAgentForm())
  const [saving, setSaving] = useState(false)

  const [runInput, setRunInput] = useState("")
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<{ agents?: Agent[] }>("/admin/marketing/agents")
      setAgents(data.agents ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Failed to load agents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = agents.find((a) => a.id === selectedId) ?? null

  const selectAgent = (a: Agent) => {
    setCreating(false)
    setSelectedId(a.id)
    setRunResult(null)
    setRunInput("")
    setForm({
      name: a.name ?? "",
      kind: a.kind ?? "content",
      instructions: a.instructions ?? "",
      brand_voice_id: a.brand_voice_id ?? "",
      model: a.model ?? "",
    })
  }

  const startCreate = () => {
    setCreating(true)
    setSelectedId(null)
    setRunResult(null)
    setForm(emptyAgentForm())
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("A name is required")
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        kind: form.kind,
        instructions: form.instructions.trim() || null,
        brand_voice_id: form.brand_voice_id || null,
        model: form.model.trim() || null,
      }
      if (creating) {
        const data = await api<{ agent?: Agent }>("/admin/marketing/agents", {
          method: "POST",
          json: body,
        })
        toast.success("Agent created")
        setCreating(false)
        await load()
        if (data.agent) {
          selectAgent(data.agent)
        }
      } else if (selected) {
        const data = await api<{ agent?: Agent }>(
          `/admin/marketing/agents/${selected.id}`,
          { method: "POST", json: body }
        )
        toast.success("Agent saved")
        await load()
        if (data.agent) {
          selectAgent(data.agent)
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save agent")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (a: Agent) => {
    const ok = await dialog({
      title: "Delete agent",
      description: `Delete "${a.name}"? This cannot be undone.`,
    })
    if (!ok) {
      return
    }
    try {
      await api(`/admin/marketing/agents/${a.id}`, { method: "DELETE" })
      toast.success("Agent deleted")
      if (selectedId === a.id) {
        setSelectedId(null)
      }
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete agent")
    }
  }

  const run = async () => {
    if (!selected) {
      return
    }
    if (!runInput.trim()) {
      toast.error("Enter a message to test")
      return
    }
    setRunning(true)
    setRunResult(null)
    try {
      const data = await api<RunResult>(
        `/admin/marketing/agents/${selected.id}/run`,
        { method: "POST", json: { input: runInput.trim() } }
      )
      setRunResult(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to run agent")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* LEFT: list */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Heading level="h3">Agents</Heading>
          <Button size="small" variant="secondary" onClick={startCreate}>
            <Plus /> New
          </Button>
        </div>

        {loading ? (
          <Text className="text-ui-fg-subtle" size="small">
            Loading…
          </Text>
        ) : error ? (
          <div className="flex flex-col gap-2">
            <Text className="text-ui-fg-error" size="small">
              {error}
            </Text>
            <Button size="small" variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        ) : agents.length === 0 ? (
          <Text className="text-ui-fg-subtle" size="small">
            No agents yet. Create your first AI persona.
          </Text>
        ) : (
          <div className="flex flex-col gap-1">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => selectAgent(a)}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                  selectedId === a.id
                    ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                    : "border-ui-border-base hover:bg-ui-bg-base-hover"
                }`}
              >
                <div className="flex flex-col">
                  <Text size="small" weight="plus">
                    {a.name}
                  </Text>
                  <div className="flex items-center gap-1">
                    <Badge size="2xsmall" color={KIND_COLORS[a.kind]}>
                      {a.kind}
                    </Badge>
                    {a.active === false ? (
                      <Badge size="2xsmall" color="grey">
                        inactive
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <IconButton
                  size="small"
                  variant="transparent"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(a)
                  }}
                >
                  <Trash />
                </IconButton>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: editor + playground */}
      <div className="flex flex-col gap-4">
        {!creating && !selected ? (
          <Text className="text-ui-fg-subtle" size="small">
            Select an agent to edit, or create a new one.
          </Text>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
              <Heading level="h3">
                {creating ? "New agent" : "Edit agent"}
              </Heading>

              <div className="flex flex-col gap-1">
                <Label size="small">Name</Label>
                <Input
                  value={form.name}
                  placeholder="e.g. Support Assistant"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label size="small">Kind</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, kind: v as AgentKind }))
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select kind" />
                    </Select.Trigger>
                    <Select.Content>
                      {AGENT_KINDS.map((k) => (
                        <Select.Item key={k} value={k}>
                          {k}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label size="small">Brand voice</Label>
                  <Select
                    value={form.brand_voice_id || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        brand_voice_id: v === "none" ? "" : v,
                      }))
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Default" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="none">Default</Select.Item>
                      {voices.map((v) => (
                        <Select.Item key={v.id} value={v.id}>
                          {v.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label size="small">Instructions</Label>
                <Textarea
                  rows={5}
                  value={form.instructions}
                  placeholder="Describe the agent's persona, tone, and what it should do…"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, instructions: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label size="small">Model (optional)</Label>
                <Input
                  value={form.model}
                  placeholder="e.g. gpt-4o-mini"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                />
              </div>

              <div>
                <Button onClick={save} isLoading={saving}>
                  {creating ? "Create agent" : "Save changes"}
                </Button>
              </div>
            </div>

            {/* Playground */}
            {selected && !creating ? (
              <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-ui-fg-subtle" />
                  <Heading level="h3">Playground</Heading>
                </div>
                <Text className="text-ui-fg-subtle" size="small">
                  Test the grounded agent. Replies are grounded in the brand
                  voice and product facts.
                </Text>
                <Textarea
                  rows={3}
                  value={runInput}
                  placeholder="Ask the agent something…"
                  onChange={(e) => setRunInput(e.target.value)}
                />
                <div>
                  <Button
                    variant="secondary"
                    onClick={run}
                    isLoading={running}
                  >
                    <PlaySolid /> Run
                  </Button>
                </div>

                {runResult ? (
                  runResult.needs_ai ? (
                    <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Text size="small" weight="plus">
                        Connect an AI provider
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        No text provider is configured. Set OPENAI_API_KEY to
                        enable grounded generation.
                      </Text>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Text size="small" className="whitespace-pre-wrap">
                        {runResult.output || "(empty response)"}
                      </Text>
                      {runResult.used_knowledge?.length ? (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Grounded in {runResult.used_knowledge.length}{" "}
                          knowledge snippet(s).
                        </Text>
                      ) : null}
                    </div>
                  )
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chatbots tab                                                        */
/* ------------------------------------------------------------------ */

const ChatbotsTab = ({ agents }: { agents: Agent[] }) => {
  const dialog = usePrompt()

  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // create form
  const [name, setName] = useState("")
  const [greeting, setGreeting] = useState("")
  const [agentId, setAgentId] = useState("")
  const [replyMode, setReplyMode] = useState<ReplyMode>("draft")
  const [creating, setCreating] = useState(false)

  // knowledge base
  const [data, setData] = useState<ChatbotData[]>([])
  const [kbKind, setKbKind] = useState<DataKind>("faq")
  const [kbContent, setKbContent] = useState("")
  const [kbSaving, setKbSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ chatbots?: Chatbot[] }>(
        "/admin/marketing/chatbots"
      )
      setChatbots(res.chatbots ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Failed to load chatbots")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadData = useCallback(async (id: string) => {
    try {
      const res = await api<{ data?: ChatbotData[] }>(
        `/admin/marketing/chatbots/${id}/data`
      )
      setData(res.data ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load knowledge base")
    }
  }, [])

  const selected = chatbots.find((c) => c.id === selectedId) ?? null

  const selectChatbot = (c: Chatbot) => {
    setSelectedId(c.id)
    loadData(c.id)
  }

  const create = async () => {
    if (!name.trim()) {
      toast.error("A name is required")
      return
    }
    setCreating(true)
    try {
      const res = await api<{ chatbot?: Chatbot }>(
        "/admin/marketing/chatbots",
        {
          method: "POST",
          json: {
            name: name.trim(),
            greeting: greeting.trim() || null,
            agent_id: agentId || null,
            reply_mode: replyMode,
          },
        }
      )
      toast.success("Chatbot created")
      setName("")
      setGreeting("")
      setAgentId("")
      setReplyMode("draft")
      await load()
      if (res.chatbot) {
        selectChatbot(res.chatbot)
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create chatbot")
    } finally {
      setCreating(false)
    }
  }

  const remove = async (c: Chatbot) => {
    const ok = await dialog({
      title: "Delete chatbot",
      description: `Delete "${c.name}"? This removes its knowledge base too.`,
    })
    if (!ok) {
      return
    }
    try {
      await api(`/admin/marketing/chatbots/${c.id}`, { method: "DELETE" })
      toast.success("Chatbot deleted")
      if (selectedId === c.id) {
        setSelectedId(null)
        setData([])
      }
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete chatbot")
    }
  }

  const addData = async () => {
    if (!selected) {
      return
    }
    if (!kbContent.trim()) {
      toast.error("Enter content for the knowledge entry")
      return
    }
    setKbSaving(true)
    try {
      await api(`/admin/marketing/chatbots/${selected.id}/data`, {
        method: "POST",
        json: { kind: kbKind, content: kbContent.trim() },
      })
      toast.success("Knowledge added")
      setKbContent("")
      await loadData(selected.id)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add knowledge")
    } finally {
      setKbSaving(false)
    }
  }

  const removeData = async (row: ChatbotData) => {
    if (!selected) {
      return
    }
    try {
      await api(
        `/admin/marketing/chatbots/${selected.id}/data?data_id=${row.id}`,
        { method: "DELETE" }
      )
      await loadData(selected.id)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete knowledge")
    }
  }

  const agentName = (id?: string | null) =>
    agents.find((a) => a.id === id)?.name ?? "—"

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      {/* LEFT: create + list */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
          <Heading level="h3">New chatbot</Heading>
          <div className="flex flex-col gap-1">
            <Label size="small">Name</Label>
            <Input
              value={name}
              placeholder="e.g. Storefront widget"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Greeting</Label>
            <Input
              value={greeting}
              placeholder="Hi! How can I help?"
              onChange={(e) => setGreeting(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Bind agent</Label>
            <Select
              value={agentId || "none"}
              onValueChange={(v) => setAgentId(v === "none" ? "" : v)}
            >
              <Select.Trigger>
                <Select.Value placeholder="No agent" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="none">No agent</Select.Item>
                {agents.map((a) => (
                  <Select.Item key={a.id} value={a.id}>
                    {a.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Reply mode</Label>
            <Select
              value={replyMode}
              onValueChange={(v) => setReplyMode(v as ReplyMode)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="draft">draft (review first)</Select.Item>
                <Select.Item value="auto">auto (send automatically)</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <div>
            <Button onClick={create} isLoading={creating}>
              <Plus /> Create chatbot
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Heading level="h3">Chatbots</Heading>
          {loading ? (
            <Text className="text-ui-fg-subtle" size="small">
              Loading…
            </Text>
          ) : error ? (
            <div className="flex flex-col gap-2">
              <Text className="text-ui-fg-error" size="small">
                {error}
              </Text>
              <Button size="small" variant="secondary" onClick={load}>
                Retry
              </Button>
            </div>
          ) : chatbots.length === 0 ? (
            <Text className="text-ui-fg-subtle" size="small">
              No chatbots yet.
            </Text>
          ) : (
            <div className="flex flex-col gap-1">
              {chatbots.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectChatbot(c)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedId === c.id
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                      : "border-ui-border-base hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <div className="flex flex-col">
                    <Text size="small" weight="plus">
                      {c.name}
                    </Text>
                    <div className="flex items-center gap-1">
                      <Badge size="2xsmall" color="grey">
                        {c.reply_mode ?? "draft"}
                      </Badge>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {agentName(c.agent_id)}
                      </Text>
                    </div>
                  </div>
                  <IconButton
                    size="small"
                    variant="transparent"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(c)
                    }}
                  >
                    <Trash />
                  </IconButton>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: selected chatbot + knowledge base */}
      <div className="flex flex-col gap-4">
        {!selected ? (
          <Text className="text-ui-fg-subtle" size="small">
            Select a chatbot to manage its knowledge base.
          </Text>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-4">
              <Heading level="h3">{selected.name}</Heading>
              <div className="flex flex-col gap-1">
                <Text size="small" className="text-ui-fg-subtle">
                  Agent: {agentName(selected.agent_id)} · mode:{" "}
                  {selected.reply_mode ?? "draft"}
                </Text>
                <div className="flex items-center gap-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    Public key:
                  </Text>
                  <Badge size="2xsmall">{selected.public_key ?? "—"}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
              <Heading level="h3">Knowledge base</Heading>
              <Text className="text-ui-fg-subtle" size="small">
                Facts the bot may use to answer. Add FAQ / text entries; the
                runner retrieves the most relevant ones per question.
              </Text>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]">
                <div className="flex flex-col gap-1">
                  <Label size="small">Kind</Label>
                  <Select
                    value={kbKind}
                    onValueChange={(v) => setKbKind(v as DataKind)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {DATA_KINDS.map((k) => (
                        <Select.Item key={k} value={k}>
                          {k}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="small">Content</Label>
                  <Textarea
                    rows={3}
                    value={kbContent}
                    placeholder="e.g. We offer free returns within 30 days."
                    onChange={(e) => setKbContent(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Button
                  variant="secondary"
                  onClick={addData}
                  isLoading={kbSaving}
                >
                  <Plus /> Add entry
                </Button>
              </div>

              {data.length === 0 ? (
                <Text className="text-ui-fg-subtle" size="small">
                  No knowledge entries yet.
                </Text>
              ) : (
                <div className="flex flex-col gap-1">
                  {data.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-ui-border-base p-3"
                    >
                      <div className="flex flex-col gap-1">
                        <Badge size="2xsmall" color="grey">
                          {row.kind}
                        </Badge>
                        <Text size="small" className="whitespace-pre-wrap">
                          {row.content ?? row.source ?? ""}
                        </Text>
                      </div>
                      <IconButton
                        size="small"
                        variant="transparent"
                        onClick={() => removeData(row)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page shell                                                          */
/* ------------------------------------------------------------------ */

const AgentsPage = () => {
  const [tab, setTab] = useState("agents")
  const [voices, setVoices] = useState<BrandVoice[]>([])
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api<{ brand_voices?: BrandVoice[] }>("/admin/marketing/brand-voice")
      .then((d) => setVoices(d.brand_voices ?? []))
      .catch(() => setVoices([]))
    api<{ agents?: Agent[] }>("/admin/marketing/agents")
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => setAgents([]))
  }, [])

  return (
    <Container className="flex flex-col gap-4 p-0">
      <PageHeader
        icon={Sparkles}
        accent="blue"
        title="AI Agents & Chatbots"
        subtitle="Build reusable, grounded AI personas and bind them to channel chatbots with their own knowledge base."
      />

      <Tabs value={tab} onValueChange={setTab} className="px-6 pb-6">
        <Tabs.List>
          <Tabs.Trigger value="agents">Agents</Tabs.Trigger>
          <Tabs.Trigger value="chatbots">Chatbots</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="agents" className="pt-4">
          <AgentsTab voices={voices} />
        </Tabs.Content>
        <Tabs.Content value="chatbots" className="pt-4">
          <ChatbotsTab agents={agents} />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "AI Agents",
  icon: Sparkles,
})

export default AgentsPage
