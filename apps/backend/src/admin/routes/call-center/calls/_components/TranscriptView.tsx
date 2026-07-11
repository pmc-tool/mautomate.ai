/**
 * AI Call Center — turn-by-turn transcript.
 *
 * Renders call.transcript (a provider-shaped JSON array) as a two-sided
 * conversation: the AI agent on the left, the customer on the right. Speaker,
 * text and timestamp are each read defensively because the exact turn shape
 * varies by provider.
 */
import { ChatBubbleLeftRight, Sparkles, User } from "@medusajs/icons"
import { clx, Text } from "@medusajs/ui"
import type { TranscriptTurn } from "./lib"

type Side = "ai" | "customer"

/** Vocabularies that identify the AI/agent side of a turn. */
const AI_SPEAKERS = new Set([
  "ai",
  "assistant",
  "agent",
  "bot",
  "system",
  "ivr",
  "outbound",
])

/** Normalize a turn's speaker to one of the two rendered sides. */
function resolveSide(turn: TranscriptTurn): Side {
  const raw = String(
    turn.role ?? turn.speaker ?? turn.from ?? ""
  ).toLowerCase()
  if (AI_SPEAKERS.has(raw)) return "ai"
  // Anything customer/user/human/caller/inbound falls through to "customer".
  return "customer"
}

/** Read the spoken text from whichever field the provider used. */
function resolveText(turn: TranscriptTurn): string {
  return String(turn.text ?? turn.content ?? turn.message ?? "").trim()
}

/** Format a turn timestamp (ISO string, epoch ms, or seconds offset). */
function resolveTime(turn: TranscriptTurn): string | null {
  const t = turn.timestamp ?? turn.ts ?? turn.at
  if (t == null) {
    if (typeof turn.start === "number") {
      const m = Math.floor(turn.start / 60)
      const s = Math.floor(turn.start % 60)
      return `${m}:${String(s).padStart(2, "0")}`
    }
    return null
  }
  if (typeof t === "number") {
    try {
      return new Date(t).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return null
    }
  }
  const asDate = new Date(t)
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }
  return String(t)
}

export function TranscriptView({
  transcript,
}: {
  transcript?: TranscriptTurn[] | null
}) {
  const turns = Array.isArray(transcript) ? transcript : []

  if (turns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-2 rounded-lg border border-dashed border-ui-border-strong px-6 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-subtle">
          <ChatBubbleLeftRight />
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          No transcript is available for this call yet.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      {turns.map((turn, i) => {
        const side = resolveSide(turn)
        const text = resolveText(turn)
        const time = resolveTime(turn)
        const isAi = side === "ai"

        return (
          <div
            key={i}
            className={clx(
              "flex items-start gap-x-2",
              isAi ? "justify-start" : "flex-row-reverse justify-start"
            )}
          >
            <div
              className={clx(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                isAi
                  ? "bg-ui-tag-purple-bg text-ui-tag-purple-icon"
                  : "bg-ui-bg-subtle text-ui-fg-subtle"
              )}
            >
              {isAi ? <Sparkles /> : <User />}
            </div>
            <div
              className={clx(
                "flex max-w-[78%] flex-col gap-y-1 rounded-lg border px-3 py-2",
                isAi
                  ? "border-ui-border-base bg-ui-bg-base"
                  : "border-ui-border-base bg-ui-bg-component"
              )}
            >
              <div
                className={clx(
                  "flex items-center gap-x-2",
                  !isAi && "flex-row-reverse"
                )}
              >
                <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                  {isAi ? "AI agent" : "Customer"}
                </Text>
                {time && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {time}
                  </Text>
                )}
              </div>
              <Text
                size="small"
                className={clx(
                  "whitespace-pre-wrap break-words",
                  !isAi && "text-right"
                )}
              >
                {text || <span className="text-ui-fg-muted">(no text)</span>}
              </Text>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TranscriptView
