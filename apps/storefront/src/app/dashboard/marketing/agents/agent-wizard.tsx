"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowPath,
  Bolt,
  Check,
  ChevronLeft,
  Clock,
  DocumentText,
  ExclamationCircle,
  Globe,
  LightBulb,
  Sparkles,
  Swatch,
  XMark,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import {
  ApiError,
  createBrandVoice,
  createMarketingAgent,
  createMarketingSchedule,
  deleteMarketingSchedule,
  getMarketingAgent,
  listBrandVoices,
  listMarketingAgents,
  listSocialAccounts,
  updateMarketingAgent,
  updateMarketingSchedule,
  type AgentMode,
  type AgentSlot,
  type AgentSlotDay,
  type AgentPlaybook,
  type MarketingAgent,
  type MarketingBrandVoice,
  type SocialProvider,
} from "@lib/merchant-admin/api"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { platformMeta } from "../posts/post-utils"
import {
  browserTimezone,
  composeInstructions,
  cadenceSummary,
  DAY_OPTIONS,
  fromList,
  GOAL_OPTIONS,
  LENGTH_OPTIONS,
  MEDIA_REQUIRED_REASON,
  parseInstructions,
  POST_TYPE_OPTIONS,
  postTypeLabel,
  TIME_OPTIONS,
  timezoneOptions,
  toList,
  TONE_OPTIONS,
} from "./agent-utils"

export const WIZARD_STEPS = [
  { num: 1, label: "Platforms", icon: Globe },
  { num: 2, label: "Brand", icon: Swatch },
  { num: 3, label: "Post types", icon: DocumentText },
  { num: 4, label: "Voice and style", icon: LightBulb },
  { num: 5, label: "Schedule", icon: Clock },
  { num: 6, label: "Name and activate", icon: Sparkles },
] as const

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

type Draft = {
  name: string
  kind: "content" | "social"
  brandVoiceId: string
  about: string
  audience: string
  platforms: string[]
  postTypes: string[]
  tone: string
  creativity: number
  hashtagCount: number
  topics: string
  ctaTemplates: string
  goals: string[]
  length: string
  days: AgentSlotDay[]
  times: string[]
  timezone: string
  dailyPostCount: number
  mode: AgentMode
  active: boolean
}

function emptyDraft(): Draft {
  return {
    name: "",
    kind: "social",
    brandVoiceId: "",
    about: "",
    audience: "",
    platforms: [],
    postTypes: ["promo", "educational"],
    tone: "",
    creativity: 5,
    hashtagCount: 3,
    topics: "",
    ctaTemplates: "",
    goals: [],
    length: "medium",
    days: [],
    times: [],
    timezone: browserTimezone(),
    dailyPostCount: 1,
    mode: "approval",
    active: false,
  }
}

function toDraft(agent: MarketingAgent): Draft {
  const pb = agent.playbook
  const slots = pb?.cadence?.slots ?? []
  const { about, audience } = parseInstructions(agent.instructions)
  return {
    name: agent.name === "Untitled agent" ? "" : agent.name,
    kind: agent.kind === "content" ? "content" : "social",
    brandVoiceId: agent.brand_voice_id ?? "",
    about,
    audience,
    platforms: pb?.platforms ?? [],
    postTypes: pb?.post_types ?? [],
    tone: pb?.tone ?? "",
    creativity: pb?.creativity ?? 5,
    hashtagCount: pb?.hashtag_count ?? 3,
    topics: fromList(pb?.topics, "comma"),
    ctaTemplates: fromList(pb?.cta_templates, "line"),
    goals: pb?.goals ?? [],
    length: pb?.length ?? "medium",
    days: Array.from(new Set(slots.map((s) => s.day))) as AgentSlotDay[],
    times: Array.from(new Set(slots.map((s) => s.time))).sort(),
    timezone: pb?.cadence?.timezone || browserTimezone(),
    dailyPostCount: pb?.daily_post_count ?? 1,
    mode: pb?.mode === "auto" ? "auto" : "approval",
    active: agent.active,
  }
}

/** The cross product of the chosen weekdays and times: the cadence slots json. */
function draftSlots(draft: Draft): AgentSlot[] {
  const slots: AgentSlot[] = []
  for (const day of draft.days) {
    for (const time of draft.times) {
      slots.push({ day, time })
    }
  }
  return slots
}

function draftPlaybook(draft: Draft, scheduleId: string | null): AgentPlaybook {
  const slots = draftSlots(draft)
  const playbook: AgentPlaybook = {
    platforms: draft.platforms,
    mode: draft.mode,
    creativity: draft.creativity,
    hashtag_count: draft.hashtagCount,
    daily_post_count: draft.dailyPostCount,
  }
  if (draft.postTypes.length) playbook.post_types = draft.postTypes
  if (draft.tone.trim()) playbook.tone = draft.tone.trim()
  if (draft.topics.trim()) playbook.topics = toList(draft.topics, "comma")
  if (draft.ctaTemplates.trim()) {
    playbook.cta_templates = toList(draft.ctaTemplates, "line")
  }
  if (draft.goals.length) playbook.goals = draft.goals
  if (draft.length) playbook.length = draft.length as AgentPlaybook["length"]
  if (slots.length) {
    playbook.cadence = { timezone: draft.timezone, slots }
    if (scheduleId) playbook.schedule_id = scheduleId
  }
  return playbook
}

/**
 * The social media agent studio: a fullscreen, six-step wizard over ONE agent.
 *
 * State model, mirroring the chatbot studio next door:
 *   - the agent is loaded once into a local `draft`, so typing never round-trips,
 *   - the draft is PUT back on every step change and on Finish (autosave),
 *   - the cadence in step 5 is written to a real `marketing_schedule` owned by
 *     this agent, and referenced from the playbook as `schedule_id` (the tick
 *     prefers it over the inline cadence, and both are kept identical).
 *
 * Creation: the API will not accept an agent without at least one platform, so
 * unlike the chatbot studio the row cannot be created before the wizard opens.
 * It is created the moment step 1 is completed (paused, so nothing posts), and
 * every later step autosaves onto that row — the same "create early, configure
 * in the wizard" feel, within what the API allows.
 */
export function AgentWizard({
  token,
  agentId: initialAgentId,
  initialStep = 1,
  onClose,
  onSaved,
}: {
  token: string
  /** null = create a new agent (created when step 1 completes). */
  agentId: string | null
  initialStep?: WizardStep
  onClose: () => void
  onSaved: (agent: MarketingAgent) => void
}) {
  const [step, setStep] = useState<WizardStep>(initialStep)
  const [agentId, setAgentId] = useState<string | null>(initialAgentId)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [brandVoices, setBrandVoices] = useState<MarketingBrandVoice[]>([])
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [supported, setSupported] = useState<string[]>([])

  const [voiceFormOpen, setVoiceFormOpen] = useState(false)
  const [voiceName, setVoiceName] = useState("")
  const [voiceTone, setVoiceTone] = useState("")
  const [voiceSaving, setVoiceSaving] = useState(false)

  // The draft is seeded exactly once: a refetch must never clobber typing.
  const seeded = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      initialAgentId ? getMarketingAgent(token, initialAgentId) : null,
      listBrandVoices(token, { limit: 100 }),
      listSocialAccounts(token),
      listMarketingAgents(token, { limit: 1 }),
    ])
      .then(([agentRes, voicesRes, accountsRes, agentsRes]) => {
        if (cancelled) return
        setBrandVoices(voicesRes.brand_voices ?? [])
        setProviders(accountsRes.providers ?? [])
        setSupported(agentsRes.supported_platforms ?? [])

        if (agentRes && !seeded.current) {
          seeded.current = true
          setDraft(toDraft(agentRes.agent))
          setScheduleId(agentRes.agent.playbook?.schedule_id ?? null)
        } else if (!agentRes && !seeded.current) {
          seeded.current = true
          const defaultVoice = (voicesRes.brand_voices ?? []).find(
            (v) => v.is_default
          )
          if (defaultVoice) {
            setDraft((d) => ({ ...d, brandVoiceId: defaultVoice.id }))
          }
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(
          e instanceof ApiError ? e.message : "Could not load the agent studio."
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, initialAgentId])

  // Escape closes; the page behind must not scroll.
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

  const patch = useCallback((p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }))
  }, [])

  const toggleIn = useCallback(
    <T extends string>(list: T[], value: T): T[] =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    []
  )

  /**
   * Write the cadence to this agent's own marketing_schedule and return its id.
   * No slots means no cadence: the schedule is removed and the agent becomes
   * generate-on-demand only.
   */
  const syncSchedule = useCallback(
    async (name: string): Promise<string | null> => {
      const slots = draftSlots(draft)

      if (!slots.length) {
        if (scheduleId) {
          await deleteMarketingSchedule(token, scheduleId).catch(() => undefined)
          setScheduleId(null)
        }
        return null
      }

      const body = {
        name: `${name} cadence`,
        timezone: draft.timezone,
        slots,
        platform_filter: draft.platforms,
        active: true,
      }

      if (scheduleId) {
        const res = await updateMarketingSchedule(token, scheduleId, body)
        return res.schedule.id
      }
      const res = await createMarketingSchedule(token, body)
      setScheduleId(res.schedule.id)
      return res.schedule.id
    },
    [draft, scheduleId, token]
  )

  /** Autosave. Returns false when the save failed, so navigation can abort. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!draft.platforms.length) {
      setError("Choose at least one platform before continuing.")
      setStep(1)
      return false
    }

    setSaving(true)
    setError(null)
    try {
      const name = draft.name.trim() || "Untitled agent"
      const sid = await syncSchedule(name)
      const playbook = draftPlaybook(draft, sid)
      const body = {
        name,
        kind: draft.kind,
        instructions: composeInstructions(draft.about, draft.audience),
        brand_voice_id: draft.brandVoiceId || null,
        active: draft.active,
        playbook,
      }

      const res = agentId
        ? await updateMarketingAgent(token, agentId, body)
        : await createMarketingAgent(token, body)

      setAgentId(res.agent.id)
      onSaved(res.agent)
      return true
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save the agent."
      )
      return false
    } finally {
      setSaving(false)
    }
  }, [agentId, draft, onSaved, syncSchedule, token])

  const goTo = async (target: WizardStep) => {
    if (target === step || saving) return
    // Moving forward saves; moving back never blocks the merchant.
    if (target > step) {
      if (!(await save())) return
    }
    setError(null)
    setStep(target)
  }

  const finish = async () => {
    if (!draft.name.trim()) {
      setError("Give the agent a name.")
      return
    }
    if (!(await save())) return
    onClose()
  }

  const platformTiles = providers.length
    ? providers
    : supported.map(
        (platform): SocialProvider => ({
          platform,
          label: platformMeta(platform).label,
          configured: true,
          connect: "oauth",
          connected: false,
        })
      )

  const connectedSupported = platformTiles.filter(
    (p) => p.connected && supported.includes(p.platform)
  )

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
                  <span className="hidden xl:inline">{s.label}</span>
                  <Icon className="h-4 w-4 xl:hidden" />
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

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-grey-50">
          Loading the agent studio...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
            {error && (
              <div className="mb-6 flex items-start gap-2 rounded-base border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1 — Platforms */}
            {step === 1 && (
              <section>
                <StepHeading
                  eyebrow="Where should it publish?"
                  title="Choose the platforms"
                  description="An agent can only post where your store has a connected account. Platforms that need an image on every post cannot carry a text-only agent post yet."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  {platformTiles.map((p) => {
                    const meta = platformMeta(p.platform)
                    const Icon = meta.icon
                    const textCapable = supported.includes(p.platform)
                    const selectable = textCapable && p.connected
                    const selected = draft.platforms.includes(p.platform)

                    return (
                      <div
                        key={p.platform}
                        className={cn(
                          "rounded-large border p-4 transition-colors",
                          selected
                            ? "border-grey-90 bg-grey-10"
                            : "border-grey-20 bg-white",
                          !selectable && "opacity-70"
                        )}
                      >
                        <button
                          type="button"
                          disabled={!selectable}
                          onClick={() =>
                            patch({
                              platforms: toggleIn(draft.platforms, p.platform),
                            })
                          }
                          className={cn(
                            "flex w-full items-center gap-3 text-left",
                            selectable ? "cursor-pointer" : "cursor-not-allowed"
                          )}
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grey-10 text-grey-70">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-grey-90">
                              {p.label || meta.label}
                            </span>
                            <span className="block text-xs text-grey-50">
                              {!textCapable
                                ? MEDIA_REQUIRED_REASON
                                : p.connected
                                  ? "Connected and ready"
                                  : "Not connected yet"}
                            </span>
                          </span>
                          {selected && (
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-grey-90 text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>

                        {textCapable && !p.connected && (
                          <Link
                            href="/dashboard/marketing/connect"
                            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-grey-90 underline underline-offset-2"
                          >
                            Connect first
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!connectedSupported.length && (
                  <p className="mt-4 text-sm text-grey-50">
                    No account is connected yet.{" "}
                    <Link
                      href="/dashboard/marketing/connect"
                      className="font-medium text-grey-90 underline underline-offset-2"
                    >
                      Connect a social account
                    </Link>{" "}
                    and the agent can start posting to it.
                  </p>
                )}

                <StepFooter
                  saving={saving}
                  onNext={() => goTo(2)}
                  nextLabel={agentId ? "Continue" : "Create agent and continue"}
                  disabled={!draft.platforms.length}
                />
              </section>
            )}

            {/* Step 2 — Brand */}
            {step === 2 && (
              <section>
                <StepHeading
                  eyebrow="Who is it writing for?"
                  title="Brand and audience"
                  description="The brand voice sets the rules for every post. What you write here becomes the agent's standing instructions."
                />

                <div className="space-y-5">
                  <FormField
                    label="Brand voice"
                    hint="Tone, do rules and dont rules are applied to every generated post."
                  >
                    <div className="flex gap-2">
                      <Select
                        value={draft.brandVoiceId}
                        onChange={(e) => patch({ brandVoiceId: e.target.value })}
                      >
                        <option value="">No brand voice</option>
                        {brandVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                            {v.is_default ? " (default)" : ""}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={() => setVoiceFormOpen((o) => !o)}
                        className="shrink-0 rounded-base border border-grey-30 px-3 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
                      >
                        {voiceFormOpen ? "Cancel" : "New"}
                      </button>
                    </div>
                  </FormField>

                  {voiceFormOpen && (
                    <div className="space-y-3 rounded-large border border-grey-20 bg-grey-10 p-4">
                      <FormField label="Brand voice name">
                        <Input
                          value={voiceName}
                          onChange={(e) => setVoiceName(e.target.value)}
                          placeholder="House voice"
                        />
                      </FormField>
                      <FormField label="Tone">
                        <Select
                          value={voiceTone}
                          onChange={(e) => setVoiceTone(e.target.value)}
                        >
                          <option value="">Choose a tone</option>
                          {TONE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={voiceSaving || !voiceName.trim()}
                          onClick={async () => {
                            setVoiceSaving(true)
                            setError(null)
                            try {
                              const res = await createBrandVoice(token, {
                                name: voiceName.trim(),
                                tone: voiceTone || null,
                              })
                              setBrandVoices((prev) => [res.brand_voice, ...prev])
                              patch({ brandVoiceId: res.brand_voice.id })
                              setVoiceFormOpen(false)
                              setVoiceName("")
                              setVoiceTone("")
                            } catch (e) {
                              setError(
                                e instanceof ApiError
                                  ? e.message
                                  : "Could not create the brand voice."
                              )
                            } finally {
                              setVoiceSaving(false)
                            }
                          }}
                          className="rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {voiceSaving ? "Creating..." : "Create brand voice"}
                        </button>
                        <Link
                          href="/dashboard/marketing/brand-voice"
                          className="text-xs text-grey-50 underline underline-offset-2 hover:text-grey-90"
                        >
                          Manage brand voices
                        </Link>
                      </div>
                    </div>
                  )}

                  <FormField
                    label="About the business"
                    hint="What you sell, what makes it different, anything the agent must always know."
                  >
                    <Textarea
                      rows={4}
                      value={draft.about}
                      onChange={(e) => patch({ about: e.target.value })}
                      placeholder="We sell handmade ceramics, fired in small batches in Dhaka."
                    />
                  </FormField>

                  <FormField
                    label="Target audience"
                    hint="Who the posts are speaking to."
                  >
                    <Textarea
                      rows={3}
                      value={draft.audience}
                      onChange={(e) => patch({ audience: e.target.value })}
                      placeholder="Home cooks and gift buyers aged 25-45 who care about craft."
                    />
                  </FormField>
                </div>

                <StepFooter saving={saving} onBack={() => goTo(1)} onNext={() => goTo(3)} />
              </section>
            )}

            {/* Step 3 — Post types */}
            {step === 3 && (
              <section>
                <StepHeading
                  eyebrow="What should it write?"
                  title="Post types"
                  description="The agent rotates through these across the week, so the feed does not repeat itself."
                />

                <div className="space-y-2.5">
                  {POST_TYPE_OPTIONS.map((pt) => {
                    const selected = draft.postTypes.includes(pt.value)
                    return (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() =>
                          patch({ postTypes: toggleIn(draft.postTypes, pt.value) })
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-large border p-4 text-left transition-colors",
                          selected
                            ? "border-grey-90 bg-grey-10"
                            : "border-grey-20 bg-white hover:border-grey-30"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-base border",
                            selected
                              ? "border-grey-90 bg-grey-90 text-white"
                              : "border-grey-30"
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-grey-90">
                            {pt.label}
                          </span>
                          <span className="block text-xs text-grey-50">
                            {pt.description}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                <StepFooter
                  saving={saving}
                  onBack={() => goTo(2)}
                  onNext={() => goTo(4)}
                  disabled={!draft.postTypes.length}
                />
              </section>
            )}

            {/* Step 4 — Voice and style */}
            {step === 4 && (
              <section>
                <StepHeading
                  eyebrow="How should it sound?"
                  title="Voice and style"
                  description="These settings shape each post on top of the brand voice."
                />

                <div className="space-y-5 rounded-large border border-grey-20 bg-white p-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Tone">
                      <Select
                        value={draft.tone}
                        onChange={(e) => patch({ tone: e.target.value })}
                      >
                        <option value="">Follow the brand voice</option>
                        {TONE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Post length">
                      <Select
                        value={draft.length}
                        onChange={(e) => patch({ length: e.target.value })}
                      >
                        {LENGTH_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <FormField
                    label={`Creativity: ${draft.creativity} of 10`}
                    hint="Low stays close to the brief. High takes more liberties with angle and phrasing."
                  >
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={draft.creativity}
                      onChange={(e) =>
                        patch({ creativity: Number(e.target.value) })
                      }
                      className="w-full accent-grey-90"
                    />
                  </FormField>

                  <FormField
                    label="Hashtags per post"
                    hint="Between 0 and 30."
                  >
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={draft.hashtagCount}
                      onChange={(e) =>
                        patch({ hashtagCount: Number(e.target.value) })
                      }
                    />
                  </FormField>

                  <FormField
                    label="Topics"
                    hint="Comma separated. The agent rotates through them so posts stay varied."
                  >
                    <Input
                      value={draft.topics}
                      onChange={(e) => patch({ topics: e.target.value })}
                      placeholder="new arrivals, care tips, studio life"
                    />
                  </FormField>

                  <FormField
                    label="Call to action templates"
                    hint="One per line. The agent picks one per post."
                  >
                    <Textarea
                      rows={3}
                      value={draft.ctaTemplates}
                      onChange={(e) => patch({ ctaTemplates: e.target.value })}
                      placeholder={"Shop the collection\nRead the story on our site\nReply and we will help you choose"}
                    />
                  </FormField>

                  <FormField label="Goals">
                    <div className="flex flex-wrap gap-2">
                      {GOAL_OPTIONS.map((g) => {
                        const selected = draft.goals.includes(g)
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => patch({ goals: toggleIn(draft.goals, g) })}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                              selected
                                ? "border-grey-90 bg-grey-90 text-white"
                                : "border-grey-30 text-grey-60 hover:border-grey-90 hover:text-grey-90"
                            )}
                          >
                            {g}
                          </button>
                        )
                      })}
                    </div>
                  </FormField>
                </div>

                <StepFooter saving={saving} onBack={() => goTo(3)} onNext={() => goTo(5)} />
              </section>
            )}

            {/* Step 5 — Schedule */}
            {step === 5 && (
              <section>
                <StepHeading
                  eyebrow="When should it post?"
                  title="Cadence and publishing mode"
                  description="Pick the days and times. The agent wakes on every slot, writes a post, and either sends it for your approval or publishes it."
                />

                <div className="space-y-6 rounded-large border border-grey-20 bg-white p-5">
                  <FormField label="Days">
                    <div className="flex flex-wrap gap-2">
                      {DAY_OPTIONS.map((d) => {
                        const selected = draft.days.includes(d.value)
                        return (
                          <button
                            key={d.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => patch({ days: toggleIn(draft.days, d.value) })}
                            className={cn(
                              "h-10 w-14 rounded-base border text-sm font-medium transition-colors",
                              selected
                                ? "border-grey-90 bg-grey-90 text-white"
                                : "border-grey-30 text-grey-60 hover:border-grey-90 hover:text-grey-90"
                            )}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </FormField>

                  <FormField
                    label="Times"
                    hint="Wall-clock time in the timezone below. Every selected day fires at every selected time."
                  >
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {TIME_OPTIONS.map((t) => {
                        const selected = draft.times.includes(t)
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => patch({ times: toggleIn(draft.times, t) })}
                            className={cn(
                              "rounded-base border py-2 text-xs font-medium transition-colors",
                              selected
                                ? "border-grey-90 bg-grey-90 text-white"
                                : "border-grey-30 text-grey-60 hover:border-grey-90 hover:text-grey-90"
                            )}
                          >
                            {t}
                          </button>
                        )
                      })}
                    </div>
                  </FormField>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Timezone">
                      <Select
                        value={draft.timezone}
                        onChange={(e) => patch({ timezone: e.target.value })}
                      >
                        {timezoneOptions().map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField
                      label="Posts per slot"
                      hint="How many posts the agent writes each time it runs. Between 1 and 20."
                    >
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={draft.dailyPostCount}
                        onChange={(e) =>
                          patch({ dailyPostCount: Number(e.target.value) })
                        }
                      />
                    </FormField>
                  </div>

                  <FormField label="Publishing mode">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          {
                            value: "approval" as AgentMode,
                            title: "Needs approval",
                            body: "Every post the agent writes lands in the Posts queue as Needs approval. Nothing goes out until you approve it.",
                          },
                          {
                            value: "auto" as AgentMode,
                            title: "Auto-publish",
                            body: "The agent schedules its posts at the slot time and publishes them to your connected accounts without asking.",
                          },
                        ] as const
                      ).map((m) => {
                        const selected = draft.mode === m.value
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => patch({ mode: m.value })}
                            className={cn(
                              "rounded-large border p-4 text-left transition-colors",
                              selected
                                ? "border-grey-90 bg-grey-10"
                                : "border-grey-20 bg-white hover:border-grey-30"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  selected
                                    ? "border-grey-90 bg-grey-90 text-white"
                                    : "border-grey-30"
                                )}
                              >
                                {selected && <Check className="h-2.5 w-2.5" />}
                              </span>
                              <span className="text-sm font-medium text-grey-90">
                                {m.title}
                              </span>
                            </span>
                            <span className="mt-2 block text-xs leading-relaxed text-grey-50">
                              {m.body}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </FormField>

                  <p className="rounded-base bg-grey-10 p-3 text-xs text-grey-60">
                    {draftSlots(draft).length
                      ? cadenceSummary(draftPlaybook(draft, scheduleId))
                      : "No days or times selected. The agent will not post on its own, but you can still use Generate now."}
                  </p>
                </div>

                <StepFooter saving={saving} onBack={() => goTo(4)} onNext={() => goTo(6)} />
              </section>
            )}

            {/* Step 6 — Name and activate */}
            {step === 6 && (
              <section>
                <StepHeading
                  eyebrow="One last thing"
                  title="Name the agent and switch it on"
                  description="Check the summary, then activate. You can change any of this later."
                />

                <div className="space-y-5">
                  <FormField label="Agent name">
                    <Input
                      value={draft.name}
                      onChange={(e) => patch({ name: e.target.value })}
                      placeholder="Weekday social agent"
                      autoFocus
                    />
                  </FormField>

                  <div className="rounded-large border border-grey-20 bg-white p-5">
                    <h3 className="mb-4 text-sm font-semibold text-grey-90">
                      Summary
                    </h3>
                    <dl className="space-y-3 text-sm">
                      <SummaryRow
                        label="Platforms"
                        value={
                          draft.platforms
                            .map((p) => platformMeta(p).label)
                            .join(", ") || "None"
                        }
                      />
                      <SummaryRow
                        label="Brand voice"
                        value={
                          brandVoices.find((v) => v.id === draft.brandVoiceId)
                            ?.name || "None"
                        }
                      />
                      <SummaryRow
                        label="Post types"
                        value={
                          draft.postTypes.map(postTypeLabel).join(", ") || "None"
                        }
                      />
                      <SummaryRow
                        label="Voice"
                        value={`${draft.tone || "Brand voice"}, creativity ${draft.creativity} of 10, ${draft.hashtagCount} hashtags`}
                      />
                      <SummaryRow
                        label="Cadence"
                        value={cadenceSummary(draftPlaybook(draft, scheduleId))}
                      />
                      <SummaryRow
                        label="Timezone"
                        value={draft.timezone}
                      />
                      <SummaryRow
                        label="Mode"
                        value={
                          draft.mode === "auto"
                            ? "Auto-publish — posts go out without review"
                            : "Needs approval — posts wait in the queue"
                        }
                      />
                    </dl>
                  </div>

                  <div className="rounded-large border border-grey-20 bg-white p-5">
                    <FormToggle
                      checked={draft.active}
                      onChange={(v) => patch({ active: v })}
                      label="Agent is active"
                      description="An active agent runs its cadence. A paused agent stays configured but does nothing until you switch it back on."
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => goTo(5)}
                    disabled={saving}
                    className="rounded-base border border-grey-30 px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={finish}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <ArrowPath className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bolt className="h-4 w-4" />
                    )}
                    {saving ? "Saving..." : "Finish"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <header className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-grey-50">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-grey-90">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-grey-50">{description}</p>
    </header>
  )
}

function StepFooter({
  saving,
  onBack,
  onNext,
  nextLabel = "Continue",
  disabled,
}: {
  saving: boolean
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="rounded-base border border-grey-30 px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10 disabled:opacity-50"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving && <ArrowPath className="h-4 w-4 animate-spin" />}
        {saving ? "Saving..." : nextLabel}
      </button>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-grey-50">
        {label}
      </dt>
      <dd className="text-sm text-grey-90">{value}</dd>
    </div>
  )
}
