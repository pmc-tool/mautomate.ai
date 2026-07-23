/* ------------------------------------------------------------------ */
/* runJarvisStream — SSE-over-POST reader for /merchant/jarvis.          */
/*                                                                     */
/* Mirrors the exact frame protocol used by jarvis-stage.tsx /            */
/* jarvis-panel.tsx: POST with a bearer token, read resp.body via a         */
/* ReadableStream reader, split frames on a blank line, parse event/data.     */
/* Handlers are all OPTIONAL — a backend that has not yet deployed the         */
/* tool_call / tool_result events simply never fires those callbacks, and       */
/* the provider degrades gracefully (see os-provider.tsx onDone settle).         */
/* ------------------------------------------------------------------ */

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type ToolCallEvent = {
  id: string
  name: string
  label?: string
  kind?: "read" | "write"
  args?: Record<string, unknown>
}

export type ToolEvent = {
  id: string
  name?: string
  label?: string
  state: "running" | "done" | "error"
}

export type ToolResultEvent = {
  id: string
  name?: string
  ok: boolean
  data?: unknown
  error?: string | null
}

export type ConfirmEvent = {
  id: string
  action?: string
  name?: string
  label?: string
  tier: "soft" | "hard"
  require_text?: string | null
  summary?: string
  details?: Record<string, unknown>
  token: string
  exp: number
}

export type JarvisStreamHandlers = {
  onThinking?: () => void
  onToolCall?: (e: ToolCallEvent) => void
  onTool?: (e: ToolEvent) => void
  onToolResult?: (e: ToolResultEvent) => void
  onConfirm?: (e: ConfirmEvent) => void
  onMessage?: (text: string) => void
  onDone?: (e: { rounds?: number; conversation_id?: string }) => void
  onError?: (message: string) => void
}

export type RunStreamOpts = {
  token: string
  message: string
  history: ChatTurn[]
  conversationId?: string
  signal?: AbortSignal
  baseUrl?: string
} & JarvisStreamHandlers

export async function runJarvisStream(opts: RunStreamOpts): Promise<void> {
  const base = opts.baseUrl ?? ""
  const resp = await fetch(`${base}/merchant/jarvis`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({
      message: opts.message,
      history: opts.history,
      ...(opts.conversationId ? { conversation_id: opts.conversationId } : {}),
    }),
    signal: opts.signal,
  })
  if (!resp.ok || !resp.body) throw new Error("request failed")

  const reader = resp.body.getReader()
  const dec = new TextDecoder()
  let buf = ""

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      let ev = "message"
      let data = ""
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim()
        else if (line.startsWith("data:")) data += line.slice(5).trim()
      }
      let payload: any = {}
      try {
        payload = data ? JSON.parse(data) : {}
      } catch {
        payload = {}
      }
      dispatch(ev, payload, opts)
    }
  }
}

function dispatch(ev: string, p: any, h: JarvisStreamHandlers) {
  switch (ev) {
    case "thinking":
      h.onThinking?.()
      break
    case "tool_call":
      h.onToolCall?.({
        id: p.id,
        name: p.name,
        label: p.label,
        kind: p.kind === "write" ? "write" : "read",
        args: p.args ?? undefined,
      })
      break
    case "tool":
      h.onTool?.({
        id: p.id,
        name: p.name,
        label: p.label,
        state: p.state === "running" ? "running" : p.state === "error" ? "error" : "done",
      })
      break
    case "tool_result":
      h.onToolResult?.({
        id: p.id,
        name: p.name,
        ok: !!p.ok,
        data: p.data,
        error: p.error ?? null,
      })
      break
    case "confirm":
      h.onConfirm?.({
        id: p.id,
        action: p.action,
        name: p.name ?? p.action,
        label: p.label,
        tier: p.tier === "hard" ? "hard" : "soft",
        require_text: p.require_text ?? null,
        summary: p.summary,
        details: p.details ?? {},
        token: p.token,
        exp: Number(p.exp) || Math.floor(Date.now() / 1000) + 120,
      })
      break
    case "message":
      h.onMessage?.(p.text || "")
      break
    case "done":
      h.onDone?.({ rounds: p.rounds, conversation_id: p.conversation_id })
      break
    case "error":
      h.onError?.(p.message || "Something went wrong.")
      break
    default:
      break
  }
}
