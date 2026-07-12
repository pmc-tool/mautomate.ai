"use client"

import { useRef, useState } from "react"
import {
  AcademicCap,
  ArrowPath,
  Check,
  CheckCircleSolid,
  ExclamationCircle,
  Globe,
  PaperPlane,
  Plus,
  QuestionMarkCircle,
  SquareTwoStack,
  Text as TextIcon,
  Trash,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import {
  addMarketingChatbotData,
  deleteMarketingChatbotData,
  testMarketingChatbot,
  trainMarketingChatbot,
  ApiError,
  MarketingChatbot,
  MarketingChatbotData,
  MarketingChatbotTraining,
} from "@lib/merchant-admin/api"
import { ACCENT_COLORS, AVATAR_COLORS, BotAvatar } from "./chatbot-preview"
import { LANGUAGES, type ChatbotDraft } from "./types"

type StepProps = {
  draft: ChatbotDraft
  onChange: (patch: Partial<ChatbotDraft>) => void
}

/* ------------------------------------------------------------------------- */
/* Step 1 — Configure: who the bot is and how it behaves.                     */
/* ------------------------------------------------------------------------- */

export function StepConfigure({ draft, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <FormField label="Chatbot name" hint="Shown in the widget header.">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Store assistant"
        />
      </FormField>

      {/* The persona is the heart of the bot: give it the most room. */}
      <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
        <FormField
          label="Instructions (the bot's persona)"
          hint="This is the system prompt. Tell the bot who it is, what tone to use, what it may promise, and what it must never do. It is the single biggest lever on answer quality."
        >
          <Textarea
            rows={7}
            className="min-h-[150px] bg-white"
            value={draft.instructions ?? ""}
            onChange={(e) => onChange({ instructions: e.target.value })}
            placeholder={
              "You are the support assistant for our store. Be warm, brief and concrete.\n" +
              "Answer questions about products, shipping, returns and order status.\n" +
              "Never invent prices or promise a refund; offer to pass the customer to a human instead."
            }
          />
        </FormField>
      </div>

      <div className="rounded-large border border-grey-20 p-4">
        <FormToggle
          checked={draft.dont_go_beyond}
          onChange={(v) => onChange({ dont_go_beyond: v })}
          label="Do not answer beyond the provided knowledge"
          description="The bot answers only from its trained sources and the customer's own order history. If the answer is not there it says so and offers a human, rather than improvising."
        />
      </div>

      <FormField
        label="Welcome message"
        hint="The first message the visitor sees when the chat opens."
      >
        <Input
          value={draft.welcome_message ?? ""}
          onChange={(e) => onChange({ welcome_message: e.target.value })}
          placeholder="Hello. How can I help you today?"
        />
      </FormField>

      <FormField
        label="Bubble message"
        hint="The teaser next to the closed launcher. Leave empty for no teaser."
      >
        <Input
          value={draft.bubble_message ?? ""}
          onChange={(e) => onChange({ bubble_message: e.target.value })}
          placeholder="Need a hand?"
        />
      </FormField>

      <FormField
        label="Language"
        hint="Pin every reply to one language, or let the bot answer in whatever language the customer writes in."
      >
        <Select
          value={draft.language ?? ""}
          onChange={(e) => onChange({ language: e.target.value || null })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Reply mode">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "auto" as const,
                title: "Automatic",
                body: "The bot answers customers on its own, immediately, and hands off to a human when it cannot help.",
              },
              {
                value: "draft" as const,
                title: "Draft only",
                body: "The bot never speaks to the customer. It suggests a reply in your inbox and a human sends it.",
              },
            ]
          ).map((mode) => {
            const selected = draft.reply_mode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => onChange({ reply_mode: mode.value })}
                className={cn(
                  "relative rounded-large border p-4 text-left transition-colors",
                  selected
                    ? "border-grey-90 bg-grey-5"
                    : "border-grey-20 hover:border-grey-40"
                )}
              >
                {selected && (
                  <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-grey-90 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <p className="text-sm font-medium text-grey-90">{mode.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-grey-50">
                  {mode.body}
                </p>
              </button>
            )
          })}
        </div>
      </FormField>

      <div className="rounded-large border border-grey-20 p-4">
        <FormToggle
          checked={draft.active}
          onChange={(v) => onChange({ active: v })}
          label="Chatbot is active"
          description="A paused bot is not served to visitors and does not answer inbound messages."
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Step 2 — Customize: what the widget looks like.                            */
/* ------------------------------------------------------------------------- */

const FEATURE_TOGGLES: Array<{
  key: keyof Pick<
    ChatbotDraft,
    | "collect_email"
    | "allow_attachments"
    | "allow_emoji"
    | "show_logo"
    | "show_datetime"
  >
  label: string
  description: string
}> = [
  {
    key: "collect_email",
    label: "Ask for an email",
    description: "Request the visitor's email before the conversation starts.",
  },
  {
    key: "allow_attachments",
    label: "Allow attachments",
    description: "Let visitors attach a file to a message.",
  },
  {
    key: "allow_emoji",
    label: "Allow emoji",
    description: "Show the emoji picker in the composer.",
  },
  {
    key: "show_logo",
    label: "Show the mAutomate mark",
    description: "Display a small attribution line under the composer.",
  },
  {
    key: "show_datetime",
    label: "Show timestamps",
    description: "Print the time under each message.",
  },
]

export function StepCustomize({ draft, onChange }: StepProps) {
  const isImageAvatar = !!draft.avatar && /^https?:\/\//i.test(draft.avatar)
  const [imageUrl, setImageUrl] = useState(isImageAvatar ? (draft.avatar as string) : "")

  return (
    <div className="space-y-6">
      <FormField
        label="Avatar"
        hint="Use the bot's initial on a colour, or point at an image you host."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ avatar: null })}
            title="Use the accent colour"
            className={cn(
              "relative rounded-full p-0.5 transition-shadow",
              !draft.avatar
                ? "ring-2 ring-grey-90 ring-offset-2"
                : "hover:ring-2 hover:ring-grey-30 hover:ring-offset-2"
            )}
          >
            <BotAvatar
              avatar={null}
              color={draft.color}
              name={draft.name || "Chat"}
              className="h-10 w-10 text-sm"
            />
          </button>

          {AVATAR_COLORS.map((c) => {
            const value = `color:${c}`
            const selected = draft.avatar === value
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ avatar: value })}
                title={c}
                className={cn(
                  "relative rounded-full p-0.5 transition-shadow",
                  selected
                    ? "ring-2 ring-grey-90 ring-offset-2"
                    : "hover:ring-2 hover:ring-grey-30 hover:ring-offset-2"
                )}
              >
                <BotAvatar
                  avatar={value}
                  color={c}
                  name={draft.name || "Chat"}
                  className="h-10 w-10 text-sm"
                />
              </button>
            )
          })}
        </div>
      </FormField>

      <FormField
        label="Avatar image URL"
        hint="Optional. Must be a public https link to a square image."
      >
        <div className="flex gap-2">
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://cdn.example.com/bot.png"
          />
          <button
            type="button"
            onClick={() => {
              const v = imageUrl.trim()
              if (/^https?:\/\//i.test(v)) onChange({ avatar: v })
            }}
            disabled={!/^https?:\/\//i.test(imageUrl.trim())}
            className="shrink-0 rounded-base border border-grey-20 px-3 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use image
          </button>
        </div>
      </FormField>

      <FormField label="Accent colour">
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              title={c}
              aria-label={`Accent colour ${c}`}
              className={cn(
                "h-9 w-9 rounded-full border border-grey-20 transition-shadow",
                draft.color.toUpperCase() === c.toUpperCase()
                  ? "ring-2 ring-grey-90 ring-offset-2"
                  : "hover:ring-2 hover:ring-grey-30 hover:ring-offset-2"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-70 transition-colors hover:bg-grey-10">
            <input
              type="color"
              value={draft.color}
              onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            />
            <span className="font-mono text-xs uppercase">{draft.color}</span>
          </label>
        </div>
      </FormField>

      <FormField
        label="Launcher position"
        hint="Which corner of the page the chat button sits in."
      >
        <div className="grid grid-cols-2 gap-3">
          {(["left", "right"] as const).map((pos) => {
            const selected = draft.position === pos
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onChange({ position: pos })}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-large border p-4 transition-colors",
                  selected
                    ? "border-grey-90 bg-grey-5"
                    : "border-grey-20 hover:border-grey-40"
                )}
              >
                {selected && (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-grey-90 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                {/* A page with the launcher docked to the chosen corner. */}
                <span className="relative block h-16 w-24 rounded-base border border-grey-20 bg-white">
                  <span className="absolute inset-x-2 top-2 block h-1.5 rounded-full bg-grey-10" />
                  <span className="absolute inset-x-2 top-5 block h-1.5 w-12 rounded-full bg-grey-10" />
                  <span
                    className={cn(
                      "absolute bottom-1.5 h-4 w-4 rounded-full",
                      pos === "left" ? "left-1.5" : "right-1.5"
                    )}
                    style={{ backgroundColor: draft.color }}
                  />
                </span>
                <span className="text-sm font-medium capitalize text-grey-90">
                  {pos}
                </span>
              </button>
            )
          })}
        </div>
      </FormField>

      <FormField label="Features">
        <div className="divide-y divide-grey-10 rounded-large border border-grey-20">
          {FEATURE_TOGGLES.map((t) => (
            <div key={t.key} className="p-4">
              <FormToggle
                checked={draft[t.key]}
                onChange={(v) => onChange({ [t.key]: v } as Partial<ChatbotDraft>)}
                label={t.label}
                description={t.description}
              />
            </div>
          ))}
        </div>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={`Widget width: ${draft.embed_width}px`}>
          <input
            type="range"
            min={300}
            max={600}
            step={10}
            value={draft.embed_width}
            onChange={(e) => onChange({ embed_width: parseInt(e.target.value, 10) })}
            className="w-full accent-grey-90"
          />
        </FormField>
        <FormField label={`Widget height: ${draft.embed_height}px`}>
          <input
            type="range"
            min={400}
            max={900}
            step={10}
            value={draft.embed_height}
            onChange={(e) => onChange({ embed_height: parseInt(e.target.value, 10) })}
            className="w-full accent-grey-90"
          />
        </FormField>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Step 3 — Train: the knowledge the bot answers from.                        */
/* ------------------------------------------------------------------------- */

const SOURCE_TABS = [
  { id: "url" as const, label: "Website", icon: Globe },
  { id: "text" as const, label: "Text", icon: TextIcon },
  { id: "qa" as const, label: "Q and A", icon: QuestionMarkCircle },
]

/** A stored source's human label. Text and Q&A share the `faq` kind. */
function sourceTitle(row: MarketingChatbotData): string {
  if (row.kind === "url") return row.source || "Web page"
  const content = (row.content ?? "").trim()
  const firstLine = content.split("\n")[0]?.trim() ?? ""
  return firstLine.slice(0, 110) || "Untitled source"
}

function sourceKindLabel(row: MarketingChatbotData): string {
  if (row.kind === "url") return "Website"
  if (/^q\s*:/i.test((row.content ?? "").trim())) return "Q and A"
  if (row.kind === "faq") return "Text"
  return row.kind.replace(/_/g, " ")
}

export function StepTrain({
  token,
  chatbot,
  sources,
  onSourcesChange,
  onChatbotChange,
}: {
  token: string
  chatbot: MarketingChatbot
  sources: MarketingChatbotData[]
  onSourcesChange: (rows: MarketingChatbotData[]) => void
  onChatbotChange: (bot: MarketingChatbot) => void
}) {
  const [tab, setTab] = useState<"url" | "text" | "qa">("url")
  const [busy, setBusy] = useState(false)
  const [training, setTraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MarketingChatbotTraining | null>(null)

  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")

  const embedded = sources.filter((s) => s.status === "embedded").length
  const failed = sources.filter((s) => s.status === "failed").length
  const pending = sources.filter((s) => s.status === "pending").length

  const add = async (body: { kind: string; content?: string; source?: string }) => {
    setBusy(true)
    setError(null)
    try {
      const res = await addMarketingChatbotData(token, chatbot.id, body)
      onSourcesChange([res.data, ...sources])
      // The backend drops the bot back to not_trained when knowledge changes.
      onChatbotChange({ ...chatbot, training_status: "not_trained" })
      setResult(null)
      setUrl("")
      setText("")
      setQuestion("")
      setAnswer("")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add that source.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: MarketingChatbotData) => {
    setError(null)
    try {
      await deleteMarketingChatbotData(token, chatbot.id, row.id)
      onSourcesChange(sources.filter((s) => s.id !== row.id))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove that source.")
    }
  }

  const train = async () => {
    setTraining(true)
    setError(null)
    setResult(null)
    try {
      const res = await trainMarketingChatbot(token, chatbot.id)
      setResult(res.training)
      onSourcesChange(res.data)
      onChatbotChange(res.chatbot)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Training failed.")
    } finally {
      setTraining(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-large border border-grey-20 bg-grey-5 p-4">
        <p className="text-sm font-medium text-grey-90">What training does</p>
        <p className="mt-1 text-xs leading-relaxed text-grey-60">
          Each source below is split into passages and turned into embeddings.
          When a customer asks something, the bot searches those passages and
          answers from the ones that match, alongside the customer&apos;s own order
          history. A source only counts once it shows as embedded. Add or remove a
          source and the bot needs training again.
        </p>
      </div>

      {/* Source composer */}
      <div>
        <div className="mb-3 flex gap-1 rounded-base bg-grey-10 p-1">
          {SOURCE_TABS.map((t) => {
            const Icon = t.icon
            const selected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-base px-3 py-2 text-xs font-medium transition-colors",
                  selected
                    ? "bg-white text-grey-90 shadow-elevation-card-rest"
                    : "text-grey-50 hover:text-grey-90"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === "url" && (
          <div className="space-y-3">
            <FormField
              label="Page URL"
              hint="The page is fetched now and its text is stored. Only public pages can be imported."
            >
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-store.com/shipping"
                />
                <button
                  type="button"
                  onClick={() => add({ kind: "url", source: url.trim() })}
                  disabled={busy || !url.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <ArrowPath className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Import
                </button>
              </div>
            </FormField>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-3">
            <FormField
              label="Text"
              hint="Paste anything the bot should know: a policy, an About page, a price list."
            >
              <Textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="We are a family-run shop in Rotterdam. Orders placed before 15:00 ship the same day..."
              />
            </FormField>
            <button
              type="button"
              onClick={() => add({ kind: "faq", content: text.trim() })}
              disabled={busy || !text.trim()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add text
            </button>
          </div>
        )}

        {tab === "qa" && (
          <div className="space-y-3">
            <FormField label="Question">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="How long do refunds take?"
              />
            </FormField>
            <FormField label="Answer">
              <Textarea
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Refunds are issued to the original payment method within 5 working days."
              />
            </FormField>
            <button
              type="button"
              onClick={() =>
                add({
                  kind: "faq",
                  content: `Q: ${question.trim()}\nA: ${answer.trim()}`,
                })
              }
              disabled={busy || !question.trim() || !answer.trim()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add question and answer
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sources */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-grey-90">
            Knowledge sources ({sources.length})
          </p>
          {sources.length > 0 && (
            <p className="text-xs text-grey-50">
              {embedded} embedded
              {pending > 0 ? `, ${pending} not yet trained` : ""}
              {failed > 0 ? `, ${failed} failed` : ""}
            </p>
          )}
        </div>

        {sources.length === 0 ? (
          <div className="rounded-large border border-dashed border-grey-20 p-6 text-center">
            <p className="text-sm text-grey-50">
              No sources yet. Add a page, some text, or a question and answer above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-grey-10 rounded-large border border-grey-20">
            {sources.map((row) => (
              <li key={row.id} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 shrink-0">
                  {row.status === "embedded" ? (
                    <CheckCircleSolid className="h-4 w-4 text-emerald-600" />
                  ) : row.status === "failed" ? (
                    <ExclamationCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <span className="block h-4 w-4 rounded-full border-2 border-grey-30" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-grey-90">
                    {sourceTitle(row)}
                  </p>
                  <p className="mt-0.5 text-xs text-grey-50">
                    {sourceKindLabel(row)}
                    {" · "}
                    {row.status === "embedded"
                      ? "Embedded"
                      : row.status === "failed"
                        ? "Failed"
                        : "Not trained yet"}
                  </p>
                  {row.status === "failed" && row.error && (
                    <p className="mt-1 text-xs text-red-600">{row.error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(row)}
                  aria-label="Remove source"
                  className="shrink-0 rounded-base p-1.5 text-grey-40 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Train */}
      <div className="rounded-large border border-grey-20 p-4">
        <button
          type="button"
          onClick={train}
          disabled={training || sources.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-base bg-grey-90 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {training ? (
            <>
              <ArrowPath className="h-4 w-4 animate-spin" />
              Training. This can take a moment.
            </>
          ) : (
            <>
              <AcademicCap className="h-4 w-4" />
              {chatbot.training_status === "trained"
                ? "Train again"
                : "Train chatbot"}
            </>
          )}
        </button>

        {sources.length === 0 && (
          <p className="mt-2 text-center text-xs text-grey-50">
            Add at least one source before training.
          </p>
        )}

        {result && (
          <div
            className={cn(
              "mt-3 rounded-base border p-3 text-sm",
              result.error || result.failed > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            )}
          >
            <p className="font-medium">
              {result.embedded > 0
                ? `Trained on ${result.embedded} of ${result.sources} source${
                    result.sources === 1 ? "" : "s"
                  }, ${result.chunks} passage${result.chunks === 1 ? "" : "s"} embedded.`
                : "No source could be embedded."}
            </p>
            {result.failed > 0 && (
              <p className="mt-1 text-xs">
                {result.failed} source{result.failed === 1 ? "" : "s"} failed. See
                the reason on each one above.
              </p>
            )}
            {result.error && <p className="mt-1 text-xs">{result.error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Step 4 — Test and embed.                                                   */
/* ------------------------------------------------------------------------- */

type TestTurn = { role: "user" | "assistant"; text: string }

/**
 * The public origin of the backend that serves widget.js. The widget must load
 * from the backend itself (it calls /marketing-chat/* on its own origin), so an
 * embed snippet pointing at the dashboard's origin would not work.
 */
const BACKEND_ORIGIN = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || ""
).replace(/\/$/, "")

export function StepDeploy({
  token,
  chatbot,
  draft,
  sources,
  onTranscript,
}: {
  token: string
  chatbot: MarketingChatbot
  draft: ChatbotDraft
  sources: MarketingChatbotData[]
  /** Lifted so the live preview can show the real conversation. */
  onTranscript: (turns: TestTurn[]) => void
}) {
  const [turns, setTurns] = useState<TestTurn[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [lastKnowledge, setLastKnowledge] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const embeddedCount = sources.filter((s) => s.status === "embedded").length

  const snippet = chatbot.public_key
    ? `<script src="${BACKEND_ORIGIN}/marketing-chat/widget.js"\n        data-public-key="${chatbot.public_key}" defer></script>`
    : ""

  const send = async () => {
    const message = input.trim()
    if (!message || sending) return

    const history = turns.slice()
    const next: TestTurn[] = [...turns, { role: "user", text: message }]
    setTurns(next)
    onTranscript(next)
    setInput("")
    setSending(true)
    setError(null)

    try {
      const res = await testMarketingChatbot(token, chatbot.id, {
        message,
        history,
      })
      setLastKnowledge(res.used_knowledge)

      const reply = res.needs_ai
        ? "No AI provider is configured on this workspace, so the bot cannot answer yet."
        : res.reply ||
          "The bot returned an empty reply. Give it clearer instructions or more knowledge, then try again."

      const withReply: TestTurn[] = [...next, { role: "assistant", text: reply }]
      setTurns(withReply)
      onTranscript(withReply)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The bot could not answer.")
      setTurns(history)
      onTranscript(history)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const copy = async () => {
    if (!snippet) return
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy. Select the snippet and copy it manually.")
    }
  }

  return (
    <div className="space-y-6">
      {/* Test chat */}
      <div>
        <p className="text-sm font-medium text-grey-90">Test the bot</p>
        <p className="mt-1 text-xs leading-relaxed text-grey-60">
          This asks the real bot, with the persona and the trained knowledge you
          just configured. Nothing is saved to your inbox.
        </p>

        {chatbot.training_status !== "trained" && (
          <div className="mt-3 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {sources.length === 0
              ? "This bot has no knowledge sources. It will answer from its instructions alone."
              : "This bot has untrained sources. Go back to Train so it can answer from them."}
          </div>
        )}

        <div className="mt-3 space-y-3 rounded-large border border-grey-20 bg-grey-5 p-3">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {turns.length === 0 ? (
              <p className="py-6 text-center text-xs text-grey-50">
                Ask something you know the answer to, such as a question from one
                of your sources.
              </p>
            ) : (
              turns.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    t.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-large px-3 py-2 text-sm",
                      t.role === "user"
                        ? "bg-grey-90 text-white"
                        : "border border-grey-20 bg-white text-grey-90"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{t.text}</p>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-large border border-grey-20 bg-white px-3 py-2">
                  <ArrowPath className="h-4 w-4 animate-spin text-grey-40" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask the bot a question"
              disabled={sending}
              className="bg-white"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="inline-flex shrink-0 items-center justify-center rounded-base bg-grey-90 px-4 text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperPlane className="h-4 w-4" />
            </button>
          </div>

          {lastKnowledge !== null && (
            <p className="text-xs text-grey-50">
              {lastKnowledge > 0
                ? `The last answer used ${lastKnowledge} passage${
                    lastKnowledge === 1 ? "" : "s"
                  } of trained knowledge.`
                : embeddedCount > 0
                  ? "The last answer used no trained knowledge: nothing matched that question."
                  : "The last answer used no trained knowledge: this bot has none embedded yet."}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-base border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setTurns([])
              setLastKnowledge(null)
              onTranscript([])
            }}
            className="mt-2 text-xs font-medium text-grey-50 hover:text-grey-90"
          >
            Clear the test conversation
          </button>
        )}
      </div>

      {/* Embed */}
      <div className="border-t border-grey-10 pt-6">
        <p className="text-sm font-medium text-grey-90">Add it to any website</p>
        <p className="mt-1 text-xs leading-relaxed text-grey-60">
          Paste this before the closing body tag. It works on any site: a landing
          page, WordPress, anything.
        </p>

        {snippet ? (
          <>
            <pre className="mt-3 overflow-x-auto rounded-large border border-grey-20 bg-grey-90 p-3 text-xs leading-relaxed text-white">
              <code>{snippet}</code>
            </pre>
            <button
              type="button"
              onClick={copy}
              className="mt-2 inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <SquareTwoStack className="h-3.5 w-3.5" />
                  Copy snippet
                </>
              )}
            </button>
          </>
        ) : (
          <div className="mt-3 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            This bot has no public key yet, so it cannot be embedded. Save it and
            reopen this step.
          </div>
        )}

        <div className="mt-4 rounded-large border border-grey-20 bg-grey-5 p-4">
          <p className="text-xs leading-relaxed text-grey-60">
            You do not need this snippet for your own mAutomate storefront: an
            active chatbot is served there automatically. Use it for sites you host
            elsewhere.
          </p>
        </div>

        {!draft.active && (
          <div className="mt-3 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            This bot is paused, so the snippet will render nothing. Turn it on in
            the Configure step.
          </div>
        )}
      </div>
    </div>
  )
}
