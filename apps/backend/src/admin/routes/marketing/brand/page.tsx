/**
 * Marketing — Brand Voice & Kit.
 *
 * Manage the brand voices the AI uses to stay on-brand: a list on the left, an
 * editor on the right. A voice captures a name, a tone (a few 0–100 dimensions
 * stored as json), do / don't rules (tag inputs), sample copy, a language and a
 * default flag. "Draft from my storefront" asks the model to bootstrap a voice
 * from the store; if that endpoint isn't available it fails softly.
 *
 * API: GET/POST      /admin/marketing/brand-voice
 *      POST/DELETE    /admin/marketing/brand-voice/:id
 *      POST           /admin/marketing/generate-text { prompt, action }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, Plus, Sparkles, Swatch, Trash, XMarkMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { AccentIcon, PageHeader } from "../_components/ui-kit"

/* ------------------------------------------------------------------ */
/* Types + data layer                                                  */
/* ------------------------------------------------------------------ */

type Tone = Record<string, number>

type BrandVoice = {
  id: string
  name: string
  tone?: Tone | null
  do_rules?: string[] | null
  dont_rules?: string[] | null
  sample_copy?: string | null
  language?: string | null
  is_default?: boolean | null
  created_at?: string
  updated_at?: string
}

type BrandVoiceInput = {
  name: string
  tone: Tone
  do_rules: string[]
  dont_rules: string[]
  sample_copy: string
  language: string
  is_default: boolean
}

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
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.join("; ") : "") ||
      `Request failed (${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return payload as T
}

function listVoices(): Promise<{
  brand_voices?: BrandVoice[]
  voices?: BrandVoice[]
  data?: BrandVoice[]
}> {
  return api(`/admin/marketing/brand-voice`)
}

function createVoice(body: BrandVoiceInput): Promise<{ brand_voice?: BrandVoice }> {
  return api(`/admin/marketing/brand-voice`, { method: "POST", json: body })
}

function updateVoice(
  id: string,
  body: BrandVoiceInput
): Promise<{ brand_voice?: BrandVoice }> {
  return api(`/admin/marketing/brand-voice/${id}`, {
    method: "POST",
    json: body,
  })
}

function deleteVoice(id: string): Promise<any> {
  return api(`/admin/marketing/brand-voice/${id}`, { method: "DELETE" })
}

function draftFromStore(): Promise<any> {
  return api(`/admin/marketing/generate-text`, {
    method: "POST",
    json: {
      prompt: "draft a brand voice from our store",
      action: "brand_voice",
    },
  })
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TONE_DIMENSIONS: { key: string; label: string; low: string; high: string }[] =
  [
    { key: "formality", label: "Formality", low: "Casual", high: "Formal" },
    { key: "playfulness", label: "Playfulness", low: "Serious", high: "Playful" },
    { key: "enthusiasm", label: "Enthusiasm", low: "Calm", high: "Energetic" },
    { key: "warmth", label: "Warmth", low: "Neutral", high: "Warm" },
    { key: "confidence", label: "Confidence", low: "Humble", high: "Bold" },
  ]

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "bn", label: "Bengali" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
]

const defaultTone = (): Tone =>
  TONE_DIMENSIONS.reduce((acc, d) => {
    acc[d.key] = 50
    return acc
  }, {} as Tone)

const emptyForm = (): BrandVoiceInput => ({
  name: "",
  tone: defaultTone(),
  do_rules: [],
  dont_rules: [],
  sample_copy: "",
  language: "en",
  is_default: false,
})

const toForm = (v: BrandVoice): BrandVoiceInput => ({
  name: v.name ?? "",
  tone: { ...defaultTone(), ...(v.tone ?? {}) },
  do_rules: Array.isArray(v.do_rules) ? v.do_rules : [],
  dont_rules: Array.isArray(v.dont_rules) ? v.dont_rules : [],
  sample_copy: v.sample_copy ?? "",
  language: v.language ?? "en",
  is_default: !!v.is_default,
})

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const BrandVoicePage = () => {
  const dialog = usePrompt()
  const [voices, setVoices] = useState<BrandVoice[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // null selection = "new voice" mode.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<BrandVoiceInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listVoices()
      const list = data.brand_voices ?? data.voices ?? data.data ?? []
      setVoices(list)
      // Preserve current editor unless we have nothing loaded yet.
      setSelectedId((cur) => {
        if (creating) return cur
        if (cur && list.some((v) => v.id === cur)) return cur
        const first = list[0]
        if (first) {
          setForm(toForm(first))
          return first.id
        }
        return null
      })
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.")
      setVoices([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectVoice = (v: BrandVoice) => {
    setCreating(false)
    setSelectedId(v.id)
    setForm(toForm(v))
  }

  const startNew = () => {
    setCreating(true)
    setSelectedId(null)
    setForm(emptyForm())
  }

  const patch = (p: Partial<BrandVoiceInput>) =>
    setForm((f) => ({ ...f, ...p }))

  const setTone = (key: string, value: number) =>
    setForm((f) => ({ ...f, tone: { ...f.tone, [key]: value } }))

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("A name is required")
      return
    }
    const body: BrandVoiceInput = { ...form, name: form.name.trim() }
    setSaving(true)
    try {
      if (selectedId && !creating) {
        await updateVoice(selectedId, body)
        toast.success("Brand voice saved")
      } else {
        const res = await createVoice(body)
        toast.success("Brand voice created")
        const newId = res.brand_voice?.id ?? null
        setCreating(false)
        setSelectedId(newId)
      }
      await load()
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (v: BrandVoice) => {
    const ok = await dialog({
      title: "Delete brand voice",
      description: `Delete "${v.name}"? This can't be undone.`,
      confirmText: "Delete",
      cancelText: "Keep",
      variant: "danger",
    })
    if (!ok) return
    try {
      await deleteVoice(v.id)
      toast.success("Brand voice deleted")
      if (selectedId === v.id) {
        setSelectedId(null)
        setCreating(false)
      }
      await load()
    } catch (e: any) {
      toast.error("Could not delete", {
        description: e?.message ?? "Unexpected error.",
      })
    }
  }

  const draft = async () => {
    setDrafting(true)
    try {
      const res = await draftFromStore()
      // The generate-text response shape isn't guaranteed — pull a voice out of
      // whatever it returns, falling back to filling just the sample copy.
      const v: Partial<BrandVoice> =
        res?.brand_voice ?? res?.voice ?? res?.data ?? {}
      const text: string =
        res?.text ?? res?.result ?? res?.content ?? v?.sample_copy ?? ""
      setCreating(true)
      setSelectedId(null)
      setForm((f) => ({
        ...emptyForm(),
        name: v.name ?? "Store voice (draft)",
        tone: { ...defaultTone(), ...(v.tone ?? {}) },
        do_rules: Array.isArray(v.do_rules) ? v.do_rules : f.do_rules,
        dont_rules: Array.isArray(v.dont_rules) ? v.dont_rules : f.dont_rules,
        sample_copy: v.sample_copy ?? text ?? "",
        language: v.language ?? "en",
        is_default: false,
      }))
      toast.success("Drafted a voice from your store", {
        description: "Review it, then save to keep it.",
      })
    } catch (e: any) {
      toast.error("Couldn't draft from your store", {
        description:
          e?.status === 404
            ? "The AI drafting endpoint isn't available yet — you can still create a voice by hand."
            : e?.message ?? "Unexpected error.",
      })
    } finally {
      setDrafting(false)
    }
  }

  const isEditing = !!selectedId && !creating

  return (
    <Container className="p-0">
      <div className="border-b border-ui-border-base">
        <PageHeader
          icon={Swatch}
          accent="rose"
          title="Brand Voice"
          subtitle="The tone, rules and sample copy the AI uses to stay on-brand."
          actions={
            <>
              <Button
                size="small"
                variant="secondary"
                onClick={draft}
                isLoading={drafting}
              >
                <Sparkles />
                Draft from my storefront
              </Button>
              <Button size="small" onClick={startNew}>
                <Plus />
                New voice
              </Button>
            </>
          }
        />
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-y-3 px-6 py-12">
          <Text weight="plus">Could not load brand voices</Text>
          <Text size="small" className="text-ui-fg-subtle">
            {error}
          </Text>
          <Button size="small" variant="secondary" onClick={load}>
            <ArrowPath />
            Retry
          </Button>
        </div>
      ) : loading && !voices ? (
        <Text className="px-6 py-12 text-ui-fg-subtle">
          Loading brand voices…
        </Text>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr]">
          {/* List */}
          <div className="flex flex-col border-b border-ui-border-base lg:border-b-0 lg:border-r">
            {(voices ?? []).length === 0 ? (
              <div className="px-4 py-6">
                <Text size="small" className="text-ui-fg-subtle">
                  No brand voices yet. Create one, or draft from your store.
                </Text>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-ui-border-base">
                {(voices ?? []).map((v) => {
                  const active = v.id === selectedId && !creating
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVoice(v)}
                      className={`flex items-center justify-between gap-x-2 px-4 py-3 text-left transition-colors ${
                        active
                          ? "bg-ui-bg-base-pressed"
                          : "bg-ui-bg-base hover:bg-ui-bg-base-hover"
                      }`}
                    >
                      <div className="flex min-w-0 flex-col gap-y-0.5">
                        <Text size="small" weight="plus" className="truncate">
                          {v.name || "Untitled voice"}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {(v.language ?? "en").toUpperCase()}
                        </Text>
                      </div>
                      {v.is_default && (
                        <Badge size="2xsmall" color="green">
                          Default
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="p-6">
            {creating || selectedId ? (
              <VoiceEditor
                form={form}
                isEditing={isEditing}
                saving={saving}
                onPatch={patch}
                onTone={setTone}
                onSave={save}
                onDelete={
                  isEditing
                    ? () => {
                        const v = (voices ?? []).find(
                          (x) => x.id === selectedId
                        )
                        if (v) remove(v)
                      }
                    : undefined
                }
              />
            ) : (
              <div className="flex flex-col items-center gap-y-3 py-16 text-center">
                <AccentIcon icon={Swatch} accent="rose" size={48} />
                <Text weight="plus">Pick a voice to edit</Text>
                <Text size="small" className="max-w-sm text-ui-fg-subtle">
                  Select a brand voice on the left, or create a new one to get
                  started.
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  )
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

function VoiceEditor({
  form,
  isEditing,
  saving,
  onPatch,
  onTone,
  onSave,
  onDelete,
}: {
  form: BrandVoiceInput
  isEditing: boolean
  saving: boolean
  onPatch: (p: Partial<BrandVoiceInput>) => void
  onTone: (key: string, value: number) => void
  onSave: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <Heading level="h3">
          {isEditing ? "Edit voice" : "New voice"}
        </Heading>
        {onDelete && (
          <Button size="small" variant="transparent" onClick={onDelete}>
            <Trash />
            Delete
          </Button>
        )}
      </div>

      {/* Basics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Name">
          <Input
            value={form.name}
            placeholder="Playful & premium"
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </Field>
        <Field label="Language">
          <Select
            value={form.language}
            onValueChange={(v) => onPatch({ language: v })}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select language" />
            </Select.Trigger>
            <Select.Content>
              {LANGUAGES.map((l) => (
                <Select.Item key={l.value} value={l.value}>
                  {l.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Field>
      </div>

      {/* Tone */}
      <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4">
        <Text size="small" weight="plus">
          Tone
        </Text>
        <div className="flex flex-col gap-y-4">
          {TONE_DIMENSIONS.map((d) => {
            const val = form.tone[d.key] ?? 50
            return (
              <div key={d.key} className="flex flex-col gap-y-1">
                <div className="flex items-center justify-between">
                  <Text size="xsmall" weight="plus">
                    {d.label}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {val}
                  </Text>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={val}
                  onChange={(e) => onTone(d.key, Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ui-bg-component accent-ui-fg-interactive"
                />
                <div className="flex items-center justify-between">
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {d.low}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {d.high}
                  </Text>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rules */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TagInput
          label="Do"
          hint="Things the copy should always do."
          placeholder="Lead with the benefit…"
          tags={form.do_rules}
          onChange={(t) => onPatch({ do_rules: t })}
          color="green"
        />
        <TagInput
          label="Don't"
          hint="Things the copy should avoid."
          placeholder="Never use jargon…"
          tags={form.dont_rules}
          onChange={(t) => onPatch({ dont_rules: t })}
          color="red"
        />
      </div>

      {/* Sample copy */}
      <Field
        label="Sample copy"
        hint="A short example that captures the voice — the AI mirrors this."
      >
        <Textarea
          rows={5}
          value={form.sample_copy}
          placeholder="Meet the little upgrade your morning's been missing…"
          onChange={(e) => onPatch({ sample_copy: e.target.value })}
        />
      </Field>

      {/* Default toggle */}
      <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-4">
        <div className="flex flex-col gap-y-0.5">
          <Text size="small" weight="plus">
            Default voice
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            Use this voice when none is specified.
          </Text>
        </div>
        <Switch
          checked={form.is_default}
          onCheckedChange={(v) => onPatch({ is_default: v })}
        />
      </div>

      <div className="flex justify-end border-t border-ui-border-base pt-4">
        <Button onClick={onSave} isLoading={saving}>
          {isEditing ? "Save changes" : "Create voice"}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  )
}

function TagInput({
  label,
  hint,
  placeholder,
  tags,
  onChange,
  color,
}: {
  label: string
  hint?: string
  placeholder?: string
  tags: string[]
  onChange: (tags: string[]) => void
  color: "green" | "red"
}) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const t = draft.trim()
    if (!t) return
    if (!tags.includes(t)) onChange([...tags, t])
    setDraft("")
  }

  const remove = (t: string) => onChange(tags.filter((x) => x !== t))

  return (
    <div className="flex flex-col gap-y-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add()
          }
        }}
      />
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint} Press Enter to add.
        </Text>
      )}
      {tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-x-1 rounded-md border border-ui-border-base bg-ui-bg-subtle px-2 py-0.5"
            >
              <Badge size="2xsmall" color={color}>
                {t}
              </Badge>
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => remove(t)}
                className="text-ui-fg-muted transition-colors hover:text-ui-fg-base"
              >
                <XMarkMini />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Brand Voice",
  icon: Swatch,
})

export default BrandVoicePage
