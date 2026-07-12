"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AcademicCap,
  ArrowPath,
  Check,
  ChevronLeft,
  Code,
  CogSixTooth,
  Swatch,
  XMark,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import {
  getMarketingChatbot,
  updateMarketingChatbot,
  ApiError,
  MarketingChatbot,
  MarketingChatbotData,
} from "@lib/merchant-admin/api"
import { ChatbotPreview } from "./chatbot-preview"
import { StepConfigure, StepCustomize, StepDeploy, StepTrain } from "./wizard-steps"
import { toDraft, type ChatbotDraft } from "./types"

export const WIZARD_STEPS = [
  { num: 1, label: "Configure", icon: CogSixTooth },
  { num: 2, label: "Customize", icon: Swatch },
  { num: 3, label: "Train", icon: AcademicCap },
  { num: 4, label: "Test and embed", icon: Code },
] as const

export type WizardStep = 1 | 2 | 3 | 4

/**
 * The chatbot studio: a fullscreen, four-step wizard over ONE chatbot.
 *
 * State model — the same one the reference product uses:
 *   - the bot is loaded once into a local `draft` (so every keystroke can
 *     re-render the live preview without a round trip),
 *   - the draft is PUT back on every step change and on Finish (autosave), and
 *   - steps 3 and 4 act on the SERVER's copy (knowledge rows, training,
 *     test chat), so they save the draft first and then work against real data.
 *
 * Steps 1-2 drive the preview on the right. Step 4 replaces the preview's mock
 * transcript with the real test conversation, so the merchant sees their own
 * bot answering inside the widget they just designed.
 */
export function ChatbotWizard({
  token,
  chatbotId,
  initialStep = 1,
  onClose,
  onSaved,
}: {
  token: string
  chatbotId: string
  initialStep?: WizardStep
  onClose: () => void
  /** Fired after every successful save so the list behind the wizard stays true. */
  onSaved: (bot: MarketingChatbot) => void
}) {
  const [step, setStep] = useState<WizardStep>(initialStep)
  const [chatbot, setChatbot] = useState<MarketingChatbot | null>(null)
  const [sources, setSources] = useState<MarketingChatbotData[]>([])
  const [draft, setDraft] = useState<ChatbotDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([])

  // The draft is seeded exactly once. A refetch must never clobber what the
  // merchant is currently typing.
  const seeded = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMarketingChatbot(token, chatbotId)
      .then((res) => {
        if (cancelled) return
        setChatbot(res.chatbot)
        setSources(res.data ?? [])
        if (!seeded.current) {
          seeded.current = true
          setDraft(toDraft(res.chatbot))
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(
          e instanceof ApiError ? e.message : "Could not load this chatbot."
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, chatbotId])

  // Escape closes the wizard; the body must not scroll behind the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const patch = useCallback((p: Partial<ChatbotDraft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
  }, [])

  /** Autosave. Returns false when the save failed, so navigation can be aborted. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !chatbot) return false
    if (!draft.name.trim()) {
      setError("Give the chatbot a name before continuing.")
      setStep(1)
      return false
    }
    setSaving(true)
    setError(null)
    try {
      const res = await updateMarketingChatbot(token, chatbot.id, {
        name: draft.name.trim(),
        bubble_message: draft.bubble_message,
        welcome_message: draft.welcome_message,
        instructions: draft.instructions,
        dont_go_beyond: draft.dont_go_beyond,
        language: draft.language,
        reply_mode: draft.reply_mode,
        active: draft.active,
        avatar: draft.avatar,
        color: draft.color,
        position: draft.position,
        show_logo: draft.show_logo,
        show_datetime: draft.show_datetime,
        collect_email: draft.collect_email,
        allow_attachments: draft.allow_attachments,
        allow_emoji: draft.allow_emoji,
        embed_width: draft.embed_width,
        embed_height: draft.embed_height,
      })
      setChatbot(res.chatbot)
      onSaved(res.chatbot)
      return true
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save your changes."
      )
      return false
    } finally {
      setSaving(false)
    }
  }, [draft, chatbot, token, onSaved])

  const goTo = async (target: WizardStep) => {
    if (target === step) return
    if (!(await save())) return
    setStep(target)
  }

  const finish = async () => {
    if (!(await save())) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header: close, step pills, save state */}
      <div className="shrink-0 border-b border-grey-20">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-base px-2 py-1.5 text-sm font-medium text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Close</span>
          </button>

          <nav className="flex items-center gap-1" aria-label="Wizard steps">
            {WIZARD_STEPS.map((s) => {
              const active = step === s.num
              const done = step > s.num
              const Icon = s.icon
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => goTo(s.num as WizardStep)}
                  disabled={saving || loading}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-base px-2 py-2 text-sm font-medium transition-colors sm:px-3",
                    active
                      ? "bg-grey-10 text-grey-90"
                      : "text-grey-50 hover:text-grey-90",
                    saving && "cursor-wait"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                      active || done
                        ? "border-grey-90 bg-grey-90 text-white"
                        : "border-grey-30 text-grey-50"
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </span>
                  <span className="hidden lg:inline">{s.label}</span>
                  <Icon className="h-4 w-4 lg:hidden" />
                </button>
              )
            })}
          </nav>

          <div className="flex min-w-[92px] items-center justify-end gap-1.5 text-xs text-grey-50">
            {saving ? (
              <>
                <ArrowPath className="h-3.5 w-3.5 animate-spin" />
                Saving
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-base p-1.5 text-grey-40 transition-colors hover:bg-grey-10 hover:text-grey-90"
              >
                <XMark className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="h-0.5 w-full bg-grey-10">
          <div
            className="h-full bg-grey-90 transition-all duration-300"
            style={{ width: `${(step / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {loading || !draft || !chatbot ? (
        <div className="flex flex-1 items-center justify-center">
          {error ? (
            <div className="max-w-sm text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-base border border-grey-20 px-4 py-2 text-sm font-medium text-grey-70 hover:bg-grey-10"
              >
                Close
              </button>
            </div>
          ) : (
            <ArrowPath className="h-6 w-6 animate-spin text-grey-40" />
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Form column */}
          <div className="w-full shrink-0 overflow-y-auto border-grey-20 p-5 sm:p-6 lg:w-[520px] lg:border-r">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-grey-90">
                {WIZARD_STEPS[step - 1].label}
              </h2>
              <p className="mt-0.5 text-sm text-grey-50">
                {step === 1 &&
                  "Give the bot its identity, its persona, and the rules it answers by."}
                {step === 2 && "Style the widget your visitors will see."}
                {step === 3 && "Teach it what it needs to know about your store."}
                {step === 4 &&
                  "Ask it a question, then put it on your site."}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-base border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {step === 1 && <StepConfigure draft={draft} onChange={patch} />}
            {step === 2 && <StepCustomize draft={draft} onChange={patch} />}
            {step === 3 && (
              <StepTrain
                token={token}
                chatbot={chatbot}
                sources={sources}
                onSourcesChange={setSources}
                onChatbotChange={(bot) => {
                  setChatbot(bot)
                  onSaved(bot)
                }}
              />
            )}
            {step === 4 && (
              <StepDeploy
                token={token}
                chatbot={chatbot}
                draft={draft}
                sources={sources}
                onTranscript={setTranscript}
              />
            )}

            {/* Back / Next / Finish */}
            <div className="mt-8 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => goTo((step - 1) as WizardStep)}
                  disabled={saving}
                  className="flex-1 rounded-base border border-grey-20 px-4 py-2.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
              )}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => goTo((step + 1) as WizardStep)}
                  disabled={saving}
                  className="flex-1 rounded-base bg-grey-90 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Next"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  className="flex-1 rounded-base bg-grey-90 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Finish"}
                </button>
              )}
            </div>
          </div>

          {/* Live preview column */}
          <div className="hidden flex-1 overflow-y-auto bg-grey-5 p-8 lg:block">
            <div className="mx-auto flex max-w-[520px] flex-col items-center">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-grey-50">
                {step === 4 && transcript.length > 0
                  ? "Live preview: your test conversation"
                  : "Live preview"}
              </p>
              <ChatbotPreview
                draft={draft}
                messages={step === 4 && transcript.length ? transcript : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
